'use strict';
/* V2 全章自动模拟：AI 对 AI，检查死循环、牌组合法性与大致难度曲线。
   运行：npm run sim */
const DATA = require('../js/data.js');
const BATTLE = require('../js/battle.js');
const AI = require('../js/ai.js');

const STARTER = DATA.STARTER_DECK.slice();

/* 打完全章、拿满奖励后可以组出的 25 张牌（含 1-5 / 1-8 的重复挑战选项）。 */
const FULL_DECK = [
  'euclid',
  'gauss',
  'riemann',
  'pythagoras',
  'descartes',
  'pythagoras-disciple', 'pythagoras-disciple',
  'pythagorean-theorem', 'pythagorean-theorem',
  'proportion', 'proportion',
  'set',
  'triangle', 'triangle',
  'number-line', 'number-line',
  'parallel', 'parallel',
  'coordinate',
  'limit',
  'infinity',
  'consensus',
  'reductio',
  'citation',
  'counterexample'
];

function validateDeck(deck, label) {
  if (deck.length !== 25) throw new Error(label + ' 不是 25 张：' + deck.length);
  const counts = {};
  deck.forEach(function (id) {
    if (!DATA.CARD_MAP[id]) throw new Error(label + ' 含未知牌 ' + id);
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > DATA.maxCopies(id)) throw new Error(label + ' 超出上限 ' + id);
  });
}

function playMatch(stage, playerDeck, seed) {
  const state = BATTLE.createMatch({
    playerDeck: playerDeck,
    aiDeck: DATA.AI_DECKS[stage.ai].deck,
    seed: seed,
    stageId: stage.id,
    bossRule: stage.bossRule
  });
  AI.autoMulligan(state, 'player');
  AI.autoMulligan(state, 'ai');
  BATTLE.beginPlay(state);
  let guard = 0;
  while (!state.result && guard++ < 500) {
    if (state.phase === 'roundEnd') {
      BATTLE.startNextRound(state);
      continue;
    }
    if (state.phase !== 'play') break;
    const res = AI.act(state, state.current);
    if (!res.ok) throw new Error(stage.id + ' AI 行动失败：' + res.reason);
  }
  return {
    state: state,
    timeout: !state.result,
    actions: guard
  };
}

function run(label, deck) {
  validateDeck(deck, label);
  console.log('\n== ' + label + ' ==');
  console.log('关卡   对手          胜/场   平均小局  平均行动  平均比分');
  const totals = { wins: 0, games: 0 };
  DATA.STAGES.forEach(function (stage) {
    const n = 12;
    let wins = 0;
    let rounds = 0;
    let actions = 0;
    let playerScore = 0;
    let aiScore = 0;
    let timeouts = 0;
    for (let i = 0; i < n; i++) {
      const seed = 9000 + stage.index * 131 + i * 37;
      const result = playMatch(stage, deck, seed);
      if (result.timeout) timeouts++;
      if (result.state.result) {
        rounds += result.state.result.rounds;
        actions += result.actions;
        if (result.state.result.winner === 'player') wins++;
        result.state.rounds.forEach(function (r) {
          playerScore += r.playerScore;
          aiScore += r.aiScore;
        });
      }
    }
    totals.wins += wins;
    totals.games += n;
    console.log(
      stage.id.padEnd(6),
      DATA.AI_DECKS[stage.ai].name.padEnd(8),
      String(wins + '/' + n).padStart(6),
      (rounds / n).toFixed(1).padStart(9),
      (actions / n).toFixed(1).padStart(9),
      (playerScore / n).toFixed(1).padStart(6) + ' : ' + (aiScore / n).toFixed(1).padStart(5),
      timeouts ? ' 超时 ' + timeouts : ''
    );
  });
  console.log('合计：' + totals.wins + '/' + totals.games);
  return totals;
}

function main() {
  console.log('《真理学院》V2 全章模拟');
  run('初始几何牌组（25 张）', STARTER);
  run('全收集 25 张（含 1-5 / 1-8 重复挑战）', FULL_DECK);
}

if (require.main === module) main();

module.exports = { playMatch, run, validateDeck, STARTER, FULL_DECK };
