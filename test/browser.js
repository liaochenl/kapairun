'use strict';
/* 浏览器端自动验收：用 CDP 点击真实 UI，抓取截图与控制台错误。 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const PROFILE = '/tmp/ta-cdp-profile';
const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + ROOT + '/index.html?skipintro=1#home';

const errors = [];
let chrome;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json');
      const list = await res.json();
      const page = list.find(p => p.type === 'page');
      if (page) return page;
    } catch (e) { /* not ready */ }
    await wait(200);
  }
  throw new Error('Chrome CDP 未就绪');
}

async function main() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + PROFILE,
    '--window-size=1280,800',
    '--hide-scrollbars',
    URL
  ], { stdio: 'ignore' });

  const page = await getPage();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let seq = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + (msg.params.exceptionDetails.text || '') + ' ' +
        (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || ''));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push('log: ' + msg.params.entry.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('console: ' + msg.params.args.map(a => a.value || a.description || '').join(' '));
    }
  };

  function send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  async function evalJs(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error('eval failed: ' + expression + ' :: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async function shot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/ta-' + name + '.png', Buffer.from(res.data, 'base64'));
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await wait(1200);

  const title = await evalJs('document.title');
  console.log('title:', title);
  console.log('errors after load:', await evalJs('JSON.stringify(window.__TA_ERRORS || [])'));

  // 主页
  await shot('cdp-home');

  // 地图、编队、图鉴
  await evalJs("location.hash='#map'");
  await wait(350);
  await shot('cdp-map');
  console.log('map nodes:', await evalJs("document.querySelectorAll('.map-node').length"));

  await evalJs("location.hash='#team'");
  await wait(350);
  await shot('cdp-team');

  await evalJs("location.hash='#codex'");
  await wait(350);
  await shot('cdp-codex');

  // 抽卡
  await evalJs("location.hash='#gacha'");
  await wait(350);
  await shot('cdp-gacha');
  const inspBefore = await evalJs('TA_UI.app.profile.inspiration');
  await evalJs("document.querySelector('[data-action=\\\"pull\\\"][data-count=\\\"10\\\"]').click()");
  await wait(900);
  await shot('cdp-pull');
  const afterPull = await evalJs('JSON.stringify({insp:TA_UI.app.profile.inspiration, total:TA_UI.app.profile.gacha.totalPulls, roster:Object.keys(TA_UI.app.profile.roster).length, cards:document.querySelectorAll(".pull-card").length})');
  console.log('pull before:', inspBefore, 'after:', afterPull);
  await evalJs("document.querySelector('[data-action=\\\"close-modal\\\"]').click()");
  await wait(250);

  // 学者详情
  await evalJs("location.hash='#codex'; setTimeout(()=>{},0)");
  await wait(300);
  await evalJs("document.querySelector('[data-action=\\\"codex-tab\\\"][data-tab=\\\"scholars\\\"]').click()");
  await wait(200);
  await evalJs("document.querySelector('[data-action=\\\"scholar-detail\\\"][data-id=\\\"euclid\\\"]').click()");
  await wait(300);
  await shot('cdp-scholar');
  await evalJs("document.querySelector('[data-action=\\\"close-modal\\\"]').click()");

  // 战斗
  await evalJs("TA_UI.startBattle('1-1', true, 6)");
  await wait(500);
  await shot('cdp-battle');
  console.log('battle start:', await evalJs('JSON.stringify({turn:TA_UI.app.battle.turn, ap:TA_UI.app.battle.ap, enemies:TA_UI.app.battle.enemies.length})'));

  // 欧几里得公理 → 毕达哥拉斯比例 → 勾股定理
  await evalJs("document.querySelector('[data-action=\\\"battle-scholar\\\"][data-uid=\\\"s0\\\"]').click()");
  await wait(150);
  await evalJs("document.querySelector('[data-action=\\\"battle-skill\\\"][data-scholar=\\\"s0\\\"][data-id=\\\"euclid_axiom\\\"]').click()");
  await wait(350);
  await evalJs("document.querySelector('[data-action=\\\"battle-scholar\\\"][data-uid=\\\"s1\\\"]').click()");
  await wait(150);
  await evalJs("document.querySelector('[data-action=\\\"battle-skill\\\"][data-scholar=\\\"s1\\\"][data-id=\\\"pyth_ratio\\\"]').click()");
  await wait(350);
  await shot('cdp-theorem');
  console.log('combo:', await evalJs('JSON.stringify({combo:TA_UI.app.battle.comboCount, ap:TA_UI.app.battle.ap, theorem:TA_UI.app.battle.lastTheorem && TA_UI.app.battle.lastTheorem.name, log:TA_UI.app.battle.log.slice(-3)})'));

  // 结束回合
  await evalJs("document.querySelector('[data-action=\\\"battle-end-turn\\\"]').click()");
  await wait(800);
  await shot('cdp-battle-turn2');
  console.log('after turn:', await evalJs('JSON.stringify({turn:TA_UI.app.battle.turn, ap:TA_UI.app.battle.ap, phase:TA_UI.app.battle.phase, result:TA_UI.app.battle.result})'));

  // 第二回合：毕达哥拉斯再补一刀，应当结束 1-1
  await evalJs("document.querySelector('[data-action=\\\"battle-scholar\\\"][data-uid=\\\"s1\\\"]').click()");
  await wait(150);
  await evalJs("document.querySelector('[data-action=\\\"battle-skill\\\"][data-scholar=\\\"s1\\\"][data-id=\\\"pyth_ratio\\\"]').click()");
  await wait(1600);
  await shot('cdp-result');
  console.log('final:', await evalJs('JSON.stringify({result:TA_UI.app.battle && TA_UI.app.battle.result, stars:TA_UI.app.profile.stageStars, insp:TA_UI.app.profile.inspiration, modal:!!document.querySelector(".result-modal")})'));

  await evalJs("(document.querySelector('[data-action=\\\"result-map\\\"]')||document.querySelector('[data-action=\\\"close-modal\\\"]')).click()");
  await wait(600);
  await shot('cdp-map-after');
  console.log('after win map:', await evalJs('JSON.stringify({screen:TA_UI.app.screen, stars:TA_UI.app.profile.stageStars, best:TA_META.bestStage(TA_UI.app.profile)})'));

  // Boss 画面
  await evalJs("TA_UI.startBattle('1-10', true, 20)");
  await wait(600);
  await shot('cdp-boss');
  console.log('boss:', await evalJs('JSON.stringify({name:TA_UI.app.battle.enemies[0].name, hp:TA_UI.app.battle.enemies[0].hp, shield:TA_UI.app.battle.enemies[0].paradoxShield, phase:TA_UI.app.battle.enemies[0].phase})'));

  // 主页队伍条
  await evalJs("location.hash='#home'");
  await wait(400);
  console.log('home team:', await evalJs("JSON.stringify({cards:document.querySelectorAll('.home-scholar').length, screen:TA_UI.app.screen})"));

  // 地图最后一项是否在视口内
  await evalJs("location.hash='#map'");
  await wait(400);
  console.log('map layout:', await evalJs("JSON.stringify((function(){var ns=document.querySelectorAll('.map-node');var last=ns[ns.length-1].getBoundingClientRect();var bi=document.querySelector('.board-inner').getBoundingClientRect();return {count:ns.length,lastBottom:Math.round(last.bottom),innerBottom:Math.round(bi.bottom)};})())"));

  // 编队替换：先确保拥有笛卡尔
  await evalJs("TA_META.grantScholar(TA_UI.app.profile,'descartes'); TA_META.saveProfile(TA_UI.app.profile); location.hash='#team'");
  await wait(400);
  await evalJs("document.querySelector('[data-action=\\\"pick-scholar\\\"][data-id=\\\"descartes\\\"]').click()");
  await wait(300);
  console.log('team replace:', await evalJs("JSON.stringify({team:TA_UI.app.profile.team, descartes:!!TA_UI.app.profile.roster.descartes})"));
  await shot('cdp-team2');

  // 图鉴标签
  await evalJs("location.hash='#codex'");
  await wait(300);
  await evalJs("document.querySelector('[data-action=\\\"codex-tab\\\"][data-tab=\\\"theorems\\\"]').click()");
  await wait(200);
  console.log('theorem codex cards:', await evalJs("document.querySelectorAll('.codex-card').length"));
  await shot('cdp-codex-theorems');
  await evalJs("document.querySelector('[data-action=\\\"codex-tab\\\"][data-tab=\\\"paradoxes\\\"]').click()");
  await wait(200);
  console.log('paradox codex cards:', await evalJs("document.querySelectorAll('.codex-card').length"));

  // 升级
  await evalJs("document.querySelector('[data-action=\\\"codex-tab\\\"][data-tab=\\\"scholars\\\"]').click()");
  await wait(200);
  await evalJs("document.querySelector('[data-action=\\\"scholar-detail\\\"][data-id=\\\"euclid\\\"]').click()");
  await wait(300);
  const lvBefore = await evalJs('TA_UI.app.profile.roster.euclid.level');
  const notesBefore = await evalJs('TA_UI.app.profile.notes');
  await evalJs("document.querySelector('[data-action=\\\"upgrade\\\"][data-id=\\\"euclid\\\"][data-times=\\\"1\\\"]').click()");
  await wait(350);
  console.log('upgrade:', await evalJs("JSON.stringify({before:" + lvBefore + ",after:TA_UI.app.profile.roster.euclid.level,notesBefore:" + notesBefore + ",notesAfter:TA_UI.app.profile.notes,modal:!!document.querySelector('.scholar-modal')})"));
  await shot('cdp-scholar2');
  await evalJs("document.querySelector('[data-action=\\\"close-modal\\\"]').click()");

  // 设置开关
  await evalJs("location.hash='#settings'");
  await wait(300);
  const soundBefore = await evalJs('TA_UI.app.profile.settings.sound');
  await evalJs("document.querySelector('[data-action=\\\"toggle-sound\\\"]').click()");
  await wait(200);
  console.log('sound toggle:', await evalJs("JSON.stringify({before:" + soundBefore + ",after:TA_UI.app.profile.settings.sound})"));

  // 刷新后存档是否保留
  await evalJs("location.hash='#home'");
  await wait(300);
  await evalJs('location.reload()');
  await wait(1400);
  console.log('after reload:', await evalJs("JSON.stringify({screen:TA_UI.app.screen, stars:TA_UI.app.profile.stageStars, descartes:!!TA_UI.app.profile.roster.descartes, sound:TA_UI.app.profile.settings.sound, team:TA_UI.app.profile.team})"));
  await shot('cdp-reload');

  // 地图/编队是否落在首屏
  await evalJs("location.hash='#map'");
  await wait(400);
  console.log('map fit:', await evalJs("JSON.stringify((function(){var ns=document.querySelectorAll('.map-node');var last=ns[ns.length-1].getBoundingClientRect();var bi=document.querySelector('.board-inner').getBoundingClientRect();return {lastBottom:Math.round(last.bottom),innerBottom:Math.round(bi.bottom)};})())"));
  await evalJs("location.hash='#team'");
  await wait(400);
  console.log('team fit:', await evalJs("JSON.stringify((function(){var p=document.querySelector('.team-slots');var r=p.getBoundingClientRect();var bi=document.querySelector('.board-inner').getBoundingClientRect();return {panelBottom:Math.round(r.bottom),innerBottom:Math.round(bi.bottom)};})())"));
  await shot('cdp-team3');

  // Boss 二阶段
  await evalJs("TA_UI.startBattle('1-10', true, 22)");
  await wait(500);
  await evalJs("TA_UI.app.battle.enemies[0].hp = Math.ceil(TA_UI.app.battle.enemies[0].maxHp * 0.5) + 20; TA_UI.render()");
  await wait(200);
  await evalJs("document.querySelector('[data-action=\\\"battle-scholar\\\"][data-uid=\\\"s0\\\"]').click()");
  await wait(100);
  await evalJs("document.querySelector('[data-action=\\\"battle-skill\\\"][data-scholar=\\\"s0\\\"][data-id=\\\"descartes_coord\\\"]').click()");
  await wait(700);
  console.log('boss phase:', await evalJs("JSON.stringify({phase:TA_UI.app.battle.enemies[0].phase, shield:TA_UI.app.battle.enemies[0].paradoxShield, statuses:TA_UI.app.battle.enemies[0].statuses.map(x=>x.id)})"));
  await shot('cdp-boss-phase2');

  // 失败结算
  await evalJs("TA_UI.startBattle('1-10', true, 1)");
  await wait(400);
  for (let i = 0; i < 10; i++) {
    const done = await evalJs('!!(TA_UI.app.battle && TA_UI.app.battle.result)');
    if (done) break;
    await evalJs("var btn=document.querySelector('[data-action=\\\"battle-end-turn\\\"]'); if(btn) btn.click();");
    await wait(500);
  }
  await wait(1000);
  console.log('defeat:', await evalJs("JSON.stringify({result:TA_UI.app.battle && TA_UI.app.battle.result, modal:!!document.querySelector('.result-modal'), modalText:document.querySelector('.result-modal')?document.querySelector('.result-modal').innerText.slice(0,40):''})"));
  await shot('cdp-defeat');

  console.log('page errors:', JSON.stringify(errors, null, 2));
  console.log('window errors:', await evalJs('JSON.stringify(window.__TA_ERRORS || [])'));

  ws.close();
  chrome.kill('SIGTERM');
  await wait(300);
}

main().catch(async (err) => {
  console.error('FAILED:', err);
  console.error('errors:', errors);
  if (chrome) chrome.kill('SIGTERM');
  process.exit(1);
});
