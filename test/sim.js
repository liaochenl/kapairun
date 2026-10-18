'use strict';
/* 第二阶段模拟：几何 / 逻辑两套牌组跑第一、二章，输出 Pass 与卡差数据。
   运行：npm run sim */
const DATA = require('../js/data.js');
const BATTLE = require('../js/battle.js');
const AI = require('../js/ai.js');

const GEOMETRY_STARTER = DATA.STARTER_DECK.slice();

const GEOMETRY_FULL = [
  'euclid', 'gauss', 'riemann', 'pythagoras', 'descartes',
  'pythagoras-disciple', 'pythagoras-disciple',
  'pythagorean-theorem', 'pythagorean-theorem',
  'proportion', 'proportion', 'set',
  'triangle', 'triangle', 'number-line', 'number-line',
  'parallel', 'parallel', 'coordinate', 'limit', 'infinity',
  'consensus', 'reductio', 'citation', 'counterexample'
];

const LOGIC_STARTER = DATA.LOGIC_STARTER_DECK.slice();

const LOGIC_FULL = [
  'godel-master', 'cantor-master',
  'godel', 'cantor', 'hilbert', 'turing', 'russell-adv', 'boole', 'dedekind',
  'proposition', 'proposition', 'predicate', 'predicate', 'relation', 'relation',
  'proof-tree', 'proof-tree', 'set', 'set', 'cardinal', 'cardinal',
  'logical-negation', 'diagonal', 'formalization', 'completeness'
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
    const profile = state.current === 'ai' ? DATA.AI_PROFILES[stage.id] : null;
    const res = AI.act(state, state.current, profile);
    if (!res.ok) throw new Error(stage.id + ' AI 行动失败：' + res.reason);
  }
  const round1Cards = state.log.filter(function (l) {
    return l.round === 1 && l.side === 'player' && (l.kind === 'play' || l.kind === 'special');
  }).length;
  const passes = state.log.filter(function (l) {
    return l.side === 'player' && l.kind === 'pass';
  }).length;
  const last = state.rounds[state.rounds.length - 1];
  return {
    state: state,
    timeout: !state.result,
    actions: guard,
    round1Cards: round1Cards,
    passes: passes,
    remaining: state.player.hand.length,
    finalDiff: last ? last.playerScore - last.aiScore : 0
  };
}

function run(label, deck, chapter) {
  validateDeck(deck, label);
  console.log('\n== ' + label + ' ==');
  console.log('关卡   对手          胜/场  平均小局 平均行动 R1投入 Pass 剩余 分差');
  const stages = DATA.STAGES.filter(function (s) { return !chapter || s.chapter === chapter; });
  let wins = 0;
  let games = 0;
  stages.forEach(function (stage) {
    const n = 12;
    let w = 0, rounds = 0, actions = 0, r1 = 0, pass = 0, remain = 0, diff = 0, timeouts = 0;
    for (let i = 0; i < n; i++) {
      const seed = 9000 + stage.index * 131 + i * 37;
      const result = playMatch(stage, deck, seed);
      if (result.timeout) timeouts++;
      if (result.state.result) {
        if (result.state.result.winner === 'player') w++;
        rounds += result.state.result.rounds;
        actions += result.actions;
        r1 += result.round1Cards;
        pass += result.passes;
        remain += result.remaining;
        diff += result.finalDiff;
      }
    }
    wins += w; games += n;
    console.log(
      stage.id.padEnd(6),
      DATA.AI_DECKS[stage.ai].name.padEnd(8),
      String(w + '/' + n).padStart(5),
      (rounds / n).toFixed(1).padStart(8),
      (actions / n).toFixed(1).padStart(7),
      (r1 / n).toFixed(1).padStart(5),
      (pass / n).toFixed(1).padStart(3),
      (remain / n).toFixed(1).padStart(4),
      (diff / n).toFixed(1).padStart(5),
      timeouts ? ' 超时' + timeouts : ''
    );
  });
  console.log('合计：' + wins + '/' + games);
  return { wins: wins, games: games };
}

function main() {
  console.log('《真理学院》第二阶段全章模拟');
  run('几何初始牌组 · 第一章', GEOMETRY_STARTER, 1);
  run('几何成型牌组 · 第一章', GEOMETRY_FULL, 1);
  run('几何成型牌组 · 第二章', GEOMETRY_FULL, 2);
  run('逻辑初始牌组 · 第二章', LOGIC_STARTER, 2);
  run('逻辑成型牌组 · 第二章', LOGIC_FULL, 2);
}

if (require.main === module) main();

module.exports = {
  playMatch, run, validateDeck,
  STARTER: GEOMETRY_STARTER,
  FULL_DECK: GEOMETRY_FULL,
  LOGIC_STARTER: LOGIC_STARTER,
  LOGIC_FULL: LOGIC_FULL
};
