'use strict';
/* 浏览器端自动验收（V2）：用真实 Chrome 走完 1-1 的完整 UI 闭环。
   - 主页 → 课程 → 1-1 → 换牌 → 出牌 / 目标选择 → 小局结算 → 获胜 → 领奖
   - 卡组编辑：移除一张、加入新卡
   - 刷新后验证 V2 存档
   运行：npm run qa */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9336;
const WEB_PORT = 8123;
const PROFILE = '/tmp/ta-v2-cdp-profile';
const ROOT = path.resolve(__dirname, '..');
const URL = 'http://127.0.0.1:' + WEB_PORT + '/index.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const errors = [];
let chrome;
let webServer;

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function startWebServer() {
  webServer = http.createServer(function (req, res) {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.join(ROOT, rel);
    if (file.indexOf(ROOT) !== 0 || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(function (resolve) {
    webServer.listen(WEB_PORT, '127.0.0.1', resolve);
  });
}

async function getPage() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + CDP_PORT + '/json');
      const list = await res.json();
      const page = list.find(function (p) { return p.type === 'page'; });
      if (page) return page;
    } catch (e) { /* not ready */ }
    await wait(200);
  }
  throw new Error('Chrome CDP 未就绪');
}

async function main() {
  await startWebServer();
  fs.rmSync(PROFILE, { recursive: true, force: true });
  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + PROFILE,
    '--window-size=1280,860',
    '--hide-scrollbars',
    URL
  ], { stdio: 'ignore' });

  const page = await getPage();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(function (resolve, reject) {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let seq = 0;
  const pending = new Map();
  ws.onmessage = function (event) {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + (msg.params.exceptionDetails.text || '') + ' ' +
        ((msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description) || ''));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push('log: ' + msg.params.entry.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('console: ' + msg.params.args.map(function (a) { return a.value || a.description || ''; }).join(' '));
    }
  };

  function send(method, params) {
    return new Promise(function (resolve, reject) {
      const id = ++seq;
      pending.set(id, { resolve: resolve, reject: reject });
      ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }

  async function evalJs(expression) {
    const res = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error('eval failed: ' + expression + ' :: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async function shot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/ta-v2-' + name + '.png', Buffer.from(res.data, 'base64'));
  }

  async function click(selector) {
    return evalJs('(function(){var el=document.querySelector(' + JSON.stringify(selector) + '); if(!el) return false; el.click(); return true;})()');
  }

  async function appState() {
    return evalJs('JSON.stringify((function(){var a=TA_UI.app,m=a.match;return {screen:a.screen,modal:a.modal&&a.modal.type,phase:m&&m.phase,current:m&&m.current,round:m&&m.round,cleared:a.profile.clearedStages,collection:a.profile.collection,deckLen:a.profile.deck.length,deckHasPyth:a.profile.deck.indexOf("pythagoras")!==-1,hand:m&&m.player.hand.length,aiHand:m&&m.ai.hand.length,seals:m&&{p:m.player.seals,a:m.ai.seals},board:m&&{p:TA_BATTLE.calculateTotalScore(m,"player"),a:TA_BATTLE.calculateTotalScore(m,"ai")}};})())');
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
  await wait(1000);

  console.log('title:', await evalJs('document.title'));
  console.log('loaded:', await evalJs('JSON.stringify({ui:!!window.TA_UI,data:!!window.TA_DATA,ai:!!window.TA_AI})'));
  await shot('home');

  /* 主页 → 课程 */
  await click('[data-action="nav-stages"]');
  await wait(350);
  console.log('stages:', await evalJs('JSON.stringify({count:document.querySelectorAll(".stage-card").length,locked:document.querySelectorAll(".stage-card.locked").length})'));
  await shot('stages');

  /* 1-1 介绍 → 换牌 */
  await click('[data-action="open-stage"][data-id="1-1"]');
  await wait(250);
  console.log('stage modal:', await evalJs('document.querySelector(".modal").innerText.slice(0,60).replace(/\\n/g," | ")'));
  await shot('stage-modal');

  await click('[data-action="begin-battle"][data-id="1-1"]');
  await wait(350);
  console.log('mulligan:', await evalJs('JSON.stringify({modal:TA_UI.app.modal&&TA_UI.app.modal.type,cards:document.querySelectorAll(".mull-card").length})'));
  await shot('mulligan');

  await click('.mull-card[data-index="0"]');
  await click('.mull-card[data-index="1"]');
  await wait(150);
  await click('[data-action="mulligan-confirm"]');
  await wait(450);
  await evalJs('TA_UI.app.aiDelay=40');
  console.log('after mulligan:', await appState());
  await shot('battle');

  /* 打出一张单位牌 */
  const played = await evalJs('(function(){var a=TA_UI.app,m=a.match;var i=m.player.hand.findIndex(function(id){return TA_DATA.CARD_MAP[id].type==="unit";});if(i<0)return -1;var btn=document.querySelector(\'[data-action="hand-card"][data-index="\'+i+\'"]\');if(btn)btn.click();return i;})()');
  console.log('played unit index:', played);
  await wait(600);
  console.log('after unit + ai:', await appState());
  await shot('battle-mid');

  /* 目标选择：注入一张撤回命题，收回场上的单位 */
  await evalJs('TA_UI.app.match.player.hand.push("withdraw"); TA_UI.render()');
  await wait(150);
  const withdrew = await evalJs('(function(){var a=TA_UI.app,m=a.match;var i=m.player.hand.indexOf("withdraw");var btn=document.querySelector(\'[data-action="hand-card"][data-index="\'+i+\'"]\');if(!btn)return "no-btn";btn.click();return a.modal&&a.modal.type;})()');
  await wait(200);
  console.log('withdraw modal:', withdrew);
  await shot('target');
  await click('[data-action="target-pick"]');
  await wait(500);
  console.log('after withdraw:', await appState());

  /* 目标选择：反例，选择对方一排 */
  await evalJs('TA_UI.app.match.player.hand.push("counterexample"); TA_UI.render()');
  await wait(150);
  const counterOpened = await evalJs('(function(){var a=TA_UI.app,m=a.match;var i=m.player.hand.indexOf("counterexample");var btn=document.querySelector(\'[data-action="hand-card"][data-index="\'+i+\'"]\');if(!btn)return "no-btn";btn.click();return a.modal&&a.modal.type;})()');
  console.log('counterexample modal:', counterOpened);
  await wait(150);
  await shot('target-row');
  const beforeCounter = await evalJs('JSON.stringify({hand:TA_UI.app.match.player.hand.length,ai:TA_UI.app.match.ai.board.axiom.length})');
  await click('[data-action="target-pick"]');
  await wait(500);
  console.log('after counterexample:', beforeCounter, '->', await evalJs('JSON.stringify({hand:TA_UI.app.match.player.hand.length,ai:TA_UI.app.match.ai.board.axiom.length})'));

  /* 为了稳定验收结算与奖励：清空对手手牌与战场，保留真实 UI 结算流程 */
  await evalJs('(function(){var m=TA_UI.app.match;m.ai.hand=[];m.ai.deck=[];m.ai.board={axiom:[],reasoning:[],theorem:[]};TA_UI.render();return true;})()');

  /* 自动推进：每小局打到 2 张单位后 Pass */
  let finished = false;
  for (let i = 0; i < 120; i++) {
    const step = await evalJs('(function(){' +
      'var a=TA_UI.app,m=a.match;' +
      'if(!m)return "no-match";' +
      'if(a.modal){' +
      '  var t=a.modal.type;' +
      '  if(t==="round"){document.querySelector(\'[data-action="round-continue"]\').click();return "round";}' +
      '  if(t==="reward"){document.querySelector(\'[data-action="reward-pick"]\').click();return "reward";}' +
      '  if(t==="result"){return "result";}' +
      '  if(t==="target"){document.querySelector(\'[data-action="target-pick"]\').click();return "target";}' +
      '}' +
      'if(m.phase==="matchEnd")return "matchEnd";' +
      'if(m.phase!=="play")return "phase-"+m.phase;' +
      'if(m.current!=="player")return "wait-ai";' +
      'if(m.player.passed)return "passed";' +
      'var units=0;TA_DATA.ROWS.forEach(function(r){units+=m.player.board[r].length;});' +
      'if(units>=2){var pb=document.querySelector(\'[data-action="pass"]\');if(pb&&!pb.disabled){pb.click();return "pass";}return "pass-disabled";}' +
      'var idx=m.player.hand.findIndex(function(id){return TA_DATA.CARD_MAP[id].type==="unit";});' +
      'if(idx<0)return "no-units";' +
      'var btn=document.querySelector(\'[data-action="hand-card"][data-index="\'+idx+\'"]\');' +
      'if(!btn)return "no-btn";btn.click();return "play";' +
      '})()');
    if (step === 'result') { finished = true; break; }
    if (step === 'matchEnd') {
      await wait(150);
      continue;
    }
    await wait(step === 'wait-ai' ? 60 : 130);
  }
  console.log('finished:', finished, 'state:', await appState());
  if (!finished) throw new Error('自动验收未能在限定步数内结束比赛');
  await shot('result');

  const resultCheck = await evalJs('JSON.stringify({modal:TA_UI.app.modal&&TA_UI.app.modal.type,winner:TA_UI.app.match.result.winner,cleared:TA_UI.app.profile.clearedStages["1-1"],collection:TA_UI.app.profile.collection.pythagoras,gained:TA_UI.app.rewardGained&&TA_UI.app.rewardGained.id})');
  console.log('result check:', resultCheck);

  /* 返回课程，确认 1-2 解锁 */
  await click('[data-action="battle-quit"]');
  await wait(400);
  console.log('stages after:', await evalJs('JSON.stringify({screen:TA_UI.app.screen,locked:document.querySelectorAll(".stage-card.locked").length,unlocked12:!document.querySelector(\'[data-action="open-stage"][data-id="1-2"]\').disabled})'));

  /* 卡组编辑：移除一张，把毕达哥拉斯加入 */
  await click('[data-action="nav-deck"]');
  await wait(350);
  console.log('deck before:', await evalJs('JSON.stringify({len:TA_UI.app.profile.deck.length,valid:TA_META.validateDeck(TA_UI.app.profile).ok})'));
  await click('[data-action="deck-remove"]');
  await wait(200);
  console.log('deck after remove:', await evalJs('TA_UI.app.profile.deck.length'));
  await click('[data-action="deck-add"][data-id="pythagoras"]');
  await wait(250);
  console.log('deck after add:', await evalJs('JSON.stringify({len:TA_UI.app.profile.deck.length,has:TA_UI.app.profile.deck.indexOf("pythagoras")!==-1,valid:TA_META.validateDeck(TA_UI.app.profile).ok})'));
  await shot('deck');

  /* 刷新后 V2 存档 */
  await evalJs('location.reload()');
  await wait(1200);
  const reloaded = await evalJs('JSON.stringify({cleared:TA_UI.app.profile.clearedStages["1-1"]===true,pythagoras:TA_UI.app.profile.collection.pythagoras,deckLen:TA_UI.app.profile.deck.length,inDeck:TA_UI.app.profile.deck.indexOf("pythagoras")!==-1,key:!!localStorage.getItem("truth_academy_save_v2"),v1:!!localStorage.getItem("truth_academy_save_v1")})');
  console.log('after reload:', reloaded);
  await click('[data-action="nav-stages"]');
  await wait(300);
  await shot('stages-after');

  /* 图鉴 */
  await click('[data-action="nav-codex"]');
  await wait(350);
  console.log('codex:', await evalJs('JSON.stringify({cards:document.querySelectorAll(".codex-card").length,locked:document.querySelectorAll(".codex-card.locked").length})'));
  await shot('codex');

  /* 三选一奖励弹层（只做界面验收，不实际领取） */
  await evalJs('(function(){TA_UI.app.stage=TA_DATA.STAGE_MAP["1-5"];TA_UI.app.modal={type:"reward",stageId:"1-5",cards:TA_META.rewardOptions(TA_UI.app.profile,"1-5")};TA_UI.render();return true;})()');
  await wait(250);
  console.log('reward choices:', await evalJs('document.querySelectorAll("[data-action=reward-pick]").length'));
  await shot('reward');
  await evalJs('TA_UI.app.modal=null; TA_UI.render();');

  /* 移动端布局检查 */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await evalJs('TA_UI.beginBattle("1-1")');
  await wait(300);
  await click('[data-action="mulligan-confirm"]');
  await wait(500);
  console.log('mobile battle:', await evalJs('JSON.stringify({w:document.documentElement.clientWidth,hand:document.querySelectorAll(".hand-card").length,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth})'));
  await shot('mobile-battle');
  await evalJs('TA_UI.quitBattle()');
  await wait(200);

  console.log('page errors:', JSON.stringify(errors, null, 2));
  console.log('window errors:', await evalJs('JSON.stringify(window.__TA_ERRORS || [])'));

  ws.close();
  chrome.kill('SIGTERM');
  webServer.close();
  await wait(300);
}

main().catch(async function (err) {
  console.error('FAILED:', err);
  console.error('errors:', errors);
  if (chrome) chrome.kill('SIGTERM');
  if (webServer) webServer.close();
  process.exit(1);
});
