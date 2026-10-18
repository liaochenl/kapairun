'use strict';
/* V2 规则测试：昆特牌核心引擎、AI 与 V2 档案。运行：npm test */
const test = require('node:test');
const assert = require('node:assert');

const DATA = require('../js/data.js');
const BATTLE = require('../js/battle.js');
const AI = require('../js/ai.js');
const META = require('../js/meta.js');

function newMatch(opts) {
  const o = Object.assign({
    playerDeck: DATA.STARTER_DECK.slice(),
    aiDeck: DATA.STARTER_DECK.slice(),
    seed: 20261018
  }, opts || {});
  return BATTLE.createMatch(o);
}

function playState(playerHand, aiHand) {
  const state = BATTLE.createMatch({
    playerDeck: (playerHand || []).slice(),
    aiDeck: (aiHand || []).slice(),
    seed: 7,
    skipMulligan: true
  });
  state.player.hand = (playerHand || []).slice();
  state.ai.hand = (aiHand || []).slice();
  state.player.deck = [];
  state.ai.deck = [];
  state.current = 'player';
  state.phase = 'play';
  return state;
}

function place(state, side, cardId, row) {
  const def = DATA.CARD_MAP[cardId];
  const unit = { uid: state.uid++, id: cardId, row: row || def.row };
  state[side].board[unit.row].push(unit);
  return unit;
}

function indexOf(state, side, cardId) {
  return state[side].hand.indexOf(cardId);
}

function play(state, side, cardId, opts) {
  const idx = indexOf(state, side, cardId);
  assert.notStrictEqual(idx, -1, '手牌里应当有 ' + cardId);
  return BATTLE.playCard(state, side, idx, opts);
}

/* ---------- 开局与重抽 ---------- */

test('开局每人抽 10 张，牌库剩 15 张', function () {
  const state = newMatch();
  assert.strictEqual(state.player.hand.length, 10);
  assert.strictEqual(state.ai.hand.length, 10);
  assert.strictEqual(state.player.deck.length, 15);
  assert.strictEqual(state.ai.deck.length, 15);
  assert.strictEqual(state.phase, 'mulligan');
});

test('重抽最多 2 张，且每方只能重抽一次', function () {
  const state = newMatch();
  let res = BATTLE.mulligan(state, 'player', [0, 1, 2]);
  assert.strictEqual(res.ok, false);
  res = BATTLE.mulligan(state, 'player', [0, 1]);
  assert.strictEqual(res.ok, true);
  res = BATTLE.mulligan(state, 'player', [0]);
  assert.strictEqual(res.ok, false);
  res = BATTLE.mulligan(state, 'ai', [0, 1]);
  assert.strictEqual(res.ok, true);
});

test('重抽的牌正确返回牌库，总牌数不变', function () {
  const state = newMatch({ seed: 99 });
  const before = state.player.hand.slice();
  const res = BATTLE.mulligan(state, 'player', [0, 1]);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.player.hand.length, 10);
  assert.strictEqual(state.player.deck.length, 15);
  const all = state.player.hand.concat(state.player.deck);
  assert.strictEqual(all.length, 25);
  assert.strictEqual(res.returned.length, 2);
  res.returned.forEach(function (id) {
    assert.ok(before.indexOf(id) !== -1);
    assert.ok(all.indexOf(id) !== -1, '重抽的 ' + id + ' 应该仍在手牌或牌库');
  });
});

/* ---------- 出牌与回合 ---------- */

test('单位牌进入合法排，非法排不能出牌', function () {
  const state = playState(['triangle'], ['ruler-compass']);
  let res = play(state, 'player', 'triangle', { row: 'axiom' });
  assert.strictEqual(res.ok, false);
  res = play(state, 'player', 'triangle');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.player.board.theorem.length, 1);
  assert.strictEqual(state.player.board.theorem[0].id, 'triangle');
});

test('只能在自己的回合出牌，出牌后轮到对手', function () {
  const state = playState(['triangle', 'ruler-compass'], []);
  let res = BATTLE.playCard(state, 'ai', 0, {});
  assert.strictEqual(res.ok, false);
  res = play(state, 'player', 'triangle');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.current, 'ai');
});

test('Pass 后本小局不能再出牌', function () {
  const state = playState(['triangle', 'ruler-compass'], ['set']);
  let res = BATTLE.pass(state, 'player');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.player.passed, true);
  assert.strictEqual(state.current, 'ai');
  res = BATTLE.playCard(state, 'player', 0, {});
  assert.strictEqual(res.ok, false);
});

test('对手 Pass 后，未 Pass 的一方可以继续连续出牌', function () {
  const state = playState(['triangle', 'ruler-compass'], ['set', 'number-line']);
  BATTLE.pass(state, 'player');
  assert.strictEqual(state.current, 'ai');
  let res = play(state, 'ai', 'set');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.current, 'ai', '玩家已 Pass，AI 应继续行动');
  res = play(state, 'ai', 'number-line');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.current, 'ai');
});

/* ---------- 小局结算 ---------- */

test('双方 Pass 后正确结算，低分者失去真理印记', function () {
  const state = playState([], []);
  place(state, 'player', 'triangle');      /* 4 */
  place(state, 'ai', 'parallel');          /* 6 */
  BATTLE.pass(state, 'player');
  BATTLE.pass(state, 'ai');
  assert.strictEqual(state.phase, 'roundEnd');
  assert.strictEqual(state.lastRound.winner, 'ai');
  assert.strictEqual(state.player.seals, 1);
  assert.strictEqual(state.ai.seals, 2);
});

test('平局时双方各失去 1 枚真理印记', function () {
  const state = playState([], []);
  place(state, 'player', 'triangle');      /* 4 */
  place(state, 'ai', 'triangle');          /* 4 */
  BATTLE.pass(state, 'player');
  BATTLE.pass(state, 'ai');
  assert.strictEqual(state.lastRound.winner, 'draw');
  assert.strictEqual(state.player.seals, 1);
  assert.strictEqual(state.ai.seals, 1);
});

test('任意一方印记归零时比赛结束', function () {
  const state = playState([], []);
  state.player.seals = 1;
  place(state, 'ai', 'parallel');
  BATTLE.pass(state, 'player');
  BATTLE.pass(state, 'ai');
  assert.strictEqual(state.phase, 'matchEnd');
  assert.strictEqual(state.result.winner, 'ai');
});

test('新小局清空战场，单位进入弃牌堆', function () {
  const state = playState([], []);
  place(state, 'player', 'triangle');
  place(state, 'ai', 'set');
  state.effects.reasoning = { cardId: 'zeno', name: '芝诺困境', mode: 'flat', value: -2 };
  BATTLE.pass(state, 'player');
  BATTLE.pass(state, 'ai');
  assert.strictEqual(state.phase, 'roundEnd');
  const res = BATTLE.startNextRound(state);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.round, 2);
  assert.strictEqual(state.player.board.theorem.length, 0);
  assert.strictEqual(state.ai.board.reasoning.length, 0);
  assert.strictEqual(state.effects.reasoning, null);
  assert.ok(state.player.discard.indexOf('triangle') !== -1);
  assert.ok(state.ai.discard.indexOf('set') !== -1);
});

test('Boss 自指在第 2 小局开始时自动施加罗素悖论', function () {
  const state = BATTLE.createMatch({
    playerDeck: DATA.STARTER_DECK,
    aiDeck: DATA.AI_DECKS['1-10'].deck,
    seed: 5,
    skipMulligan: true,
    bossRule: 'self-reference',
    stageId: '1-10'
  });
  BATTLE.pass(state, 'player');
  BATTLE.pass(state, 'ai');
  assert.strictEqual(state.phase, 'roundEnd');
  BATTLE.startNextRound(state);
  const rows = DATA.ROWS.filter(function (r) { return !!state.effects[r]; });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(state.effects[rows[0]].mode, 'halve');
});

/* ---------- 卡牌机制 ---------- */

test('巨匠免疫悖论效果', function () {
  const state = playState([], []);
  place(state, 'player', 'euclid');            /* 10，巨匠 */
  place(state, 'player', 'euclid-apprentice'); /* 4 */
  state.effects.axiom = { cardId: 'zeno', name: '芝诺困境', mode: 'flat', value: -2 };
  const master = state.player.board.axiom[0];
  const normal = state.player.board.axiom[1];
  assert.strictEqual(BATTLE.unitPower(state, 'player', master), 10);
  assert.strictEqual(BATTLE.unitPower(state, 'player', normal), 2);
});

test('反例进入对方战场并抽 1 张牌', function () {
  const state = playState(['counterexample'], []);
  state.player.deck = ['triangle'];
  const res = play(state, 'player', 'counterexample', { row: 'reasoning' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.ai.board.reasoning.length, 1);
  assert.strictEqual(state.ai.board.reasoning[0].id, 'counterexample-token');
  assert.strictEqual(BATTLE.unitPower(state, 'ai', state.ai.board.reasoning[0]), 1);
  assert.strictEqual(state.player.hand.length, 1);
  assert.strictEqual(state.player.hand[0], 'triangle');
});

test('引证从弃牌堆复活单位到其所在排', function () {
  const state = playState(['citation'], []);
  state.player.discard = ['triangle'];
  const res = play(state, 'player', 'citation', { discardIndex: 0 });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.player.board.theorem.length, 1);
  assert.strictEqual(state.player.board.theorem[0].id, 'triangle');
  assert.ok(state.player.discard.indexOf('triangle') === -1);
});

test('共证按同排其他友方单位计算', function () {
  const state = playState([], []);
  place(state, 'player', 'proportion');  /* 5 */
  place(state, 'player', 'set');         /* 4 */
  const proportion = state.player.board.reasoning[0];
  const set = state.player.board.reasoning[1];
  assert.strictEqual(BATTLE.unitPower(state, 'player', proportion), 7);
  assert.strictEqual(BATTLE.unitPower(state, 'player', set), 6);
  assert.strictEqual(BATTLE.calculateRowScore(state, 'player', 'reasoning'), 13);
});

test('学派联动按同名组在场数量翻倍', function () {
  const state = playState([], []);
  place(state, 'player', 'pythagoras');            /* 6 × 2 = 12 */
  place(state, 'player', 'pythagoras-disciple');   /* 5 × 2 = 10 */
  assert.strictEqual(BATTLE.unitPower(state, 'player', state.player.board.reasoning[0]), 12);
  assert.strictEqual(BATTLE.unitPower(state, 'player', state.player.board.reasoning[1]), 10);
});

test('悖论影响一整排的双方单位', function () {
  const state = playState([], []);
  place(state, 'player', 'ruler-compass');  /* 5 */
  place(state, 'ai', 'proportion');         /* 5，单独时共证不生效 */
  state.effects.reasoning = { cardId: 'zeno', name: '芝诺困境', mode: 'flat', value: -2 };
  assert.strictEqual(BATTLE.calculateRowScore(state, 'player', 'reasoning'), 3);
  assert.strictEqual(BATTLE.calculateRowScore(state, 'ai', 'reasoning'), 3);
});

test('公理澄清解除一排的悖论', function () {
  const state = playState(['clarify'], []);
  state.effects.theorem = { cardId: 'incompleteness', name: '不完备性危机', mode: 'flat', value: -3 };
  const res = play(state, 'player', 'clarify', { row: 'theorem' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.effects.theorem, null);
});

test('反证法摧毁对方论证力最高的非巨匠单位', function () {
  const state = playState(['reductio'], []);
  place(state, 'ai', 'gauss');       /* 10，巨匠，不能被选 */
  place(state, 'ai', 'descartes');   /* 7，单排共证不生效 */
  place(state, 'ai', 'set');         /* 4 */
  const res = play(state, 'player', 'reductio');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.ai.board.reasoning.length, 1);
  assert.ok(state.ai.discard.indexOf('descartes') !== -1);
  assert.strictEqual(state.ai.board.theorem.length, 1);
});

test('撤回命题把单位换回手牌', function () {
  const state = playState(['withdraw'], []);
  const unit = place(state, 'player', 'euclid-apprentice');
  const res = play(state, 'player', 'withdraw', { unitUid: unit.uid });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(state.player.board.axiom.length, 0);
  assert.ok(state.player.hand.indexOf('euclid-apprentice') !== -1);
});

test('学术共识为场上单位提供持续到小局结束的增益', function () {
  const state = playState(['consensus'], []);
  place(state, 'player', 'triangle');
  let res = play(state, 'player', 'consensus');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(BATTLE.calculateRowScore(state, 'player', 'theorem'), 6);
  assert.strictEqual(state.player.aura, 2);
});

/* ---------- 牌组、奖励、存档 ---------- */

test('初始牌组恰好 25 张且合法', function () {
  const profile = META.defaultProfile();
  assert.strictEqual(profile.deck.length, 25);
  const check = META.validateDeck(profile);
  assert.strictEqual(check.ok, true, check.errors.join('；'));
  assert.strictEqual(new Set(profile.deck).size >= 10, true);
});

test('三选一奖励可以重复领取剩余选项', function () {
  const profile = META.defaultProfile();
  let options = META.rewardOptions(profile, '1-5');
  assert.deepStrictEqual(options, ['citation', 'infinity', 'limit']);
  const first = META.claimReward(profile, '1-5', 'citation');
  assert.strictEqual(first.ok, true);
  options = META.rewardOptions(profile, '1-5');
  assert.deepStrictEqual(options, ['infinity', 'limit']);
  META.claimReward(profile, '1-5', 'infinity');
  options = META.rewardOptions(profile, '1-5');
  assert.deepStrictEqual(options, ['limit']);
  META.claimReward(profile, '1-5', 'limit');
  assert.deepStrictEqual(META.rewardOptions(profile, '1-5'), []);
});

test('固定奖励只能领取一次，同名数量不超过上限', function () {
  const profile = META.defaultProfile();
  assert.deepStrictEqual(META.rewardOptions(profile, '1-1'), ['pythagoras']);
  META.claimReward(profile, '1-1', 'pythagoras');
  assert.deepStrictEqual(META.rewardOptions(profile, '1-1'), []);
  assert.strictEqual(profile.collection.pythagoras, 1);
  META.grantCard(profile, 'pythagoras');
  META.grantCard(profile, 'pythagoras');
  META.grantCard(profile, 'pythagoras');
  assert.strictEqual(profile.collection.pythagoras, 3);
});

test('关卡顺序解锁，通关后解锁下一关', function () {
  const profile = META.defaultProfile();
  assert.strictEqual(META.isStageUnlocked(profile, '1-1'), true);
  assert.strictEqual(META.isStageUnlocked(profile, '1-2'), false);
  META.markCleared(profile, '1-1');
  assert.strictEqual(META.isStageUnlocked(profile, '1-2'), true);
  assert.strictEqual(META.clearedCount(profile), 1);
});

test('V2 存档能完整读回', function () {
  const mem = {};
  const storage = {
    getItem: function (k) { return mem[k] == null ? null : mem[k]; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };
  const profile = META.defaultProfile();
  META.markCleared(profile, '1-1');
  META.claimReward(profile, '1-1', 'pythagoras');
  META.addCard(profile, 'pythagoras');
  assert.strictEqual(META.saveProfile(profile, storage), true);
  const loaded = META.loadProfile(storage);
  assert.ok(loaded);
  assert.strictEqual(loaded.clearedStages['1-1'], true);
  assert.strictEqual(loaded.collection.pythagoras, 1);
  assert.strictEqual(META.validateDeck(loaded).ok, true);
  assert.strictEqual(JSON.parse(mem[META.STORAGE_KEY]).version, 2);
});

/* ---------- AI ---------- */

test('AI 领先且对手已 Pass 时主动 Pass', function () {
  const state = playState([], ['triangle', 'set']);
  state.current = 'ai';
  state.player.passed = true;
  place(state, 'ai', 'parallel');
  const action = AI.chooseAction(state, 'ai');
  assert.strictEqual(action.type, 'pass');
});

test('AI 落后太多且需要多张牌时主动让局', function () {
  const state = playState([], []);
  state.current = 'ai';
  state.player.passed = true;
  state.ai.hand = ['euclid-apprentice', 'triangle', 'number-line'];
  place(state, 'player', 'euclid');      /* 10 */
  place(state, 'player', 'pythagoras');  /* 6 */
  place(state, 'player', 'descartes');   /* 7 */
  place(state, 'player', 'parallel');    /* 6 */
  const action = AI.chooseAction(state, 'ai');
  assert.strictEqual(action.type, 'pass');
  assert.strictEqual(action.reason, 'cannot-catch-up');
});

test('AI 在必须赢下小局时会尝试追分', function () {
  const state = playState([], []);
  state.current = 'ai';
  state.ai.seals = 1;
  state.ai.hand = ['parallel', 'ruler-compass', 'triangle'];
  state.player.passed = true;
  place(state, 'player', 'euclid-apprentice'); /* 4 */
  const action = AI.chooseAction(state, 'ai');
  assert.strictEqual(action.type, 'play');
});

test('AI vs AI 能完整结束一整场比赛（无死循环）', function () {
  const state = newMatch({
    playerDeck: DATA.AI_DECKS['1-5'].deck,
    aiDeck: DATA.AI_DECKS['1-5'].deck,
    seed: 12345
  });
  AI.autoMulligan(state, 'player');
  AI.autoMulligan(state, 'ai');
  BATTLE.beginPlay(state);
  let guard = 0;
  while (!state.result && guard++ < 300) {
    if (state.phase === 'roundEnd') {
      BATTLE.startNextRound(state);
      continue;
    }
    if (state.phase === 'matchEnd') break;
    const side = state.current;
    const res = AI.act(state, side);
    assert.strictEqual(res.ok, true, 'AI 行动失败：' + res.reason);
  }
  assert.ok(state.result, '比赛应当结束');
  assert.ok(['player', 'ai', 'draw'].indexOf(state.result.winner) !== -1);
  assert.ok(state.result.rounds <= 3);
});

test('1-1 到 1-10 的 AI 牌组都合法', function () {
  DATA.STAGES.forEach(function (stage) {
    const deck = DATA.AI_DECKS[stage.ai].deck;
    assert.strictEqual(deck.length, 25, stage.id + ' AI 牌组应为 25 张');
    const counts = {};
    deck.forEach(function (id) {
      assert.ok(DATA.CARD_MAP[id], id + ' 不存在');
      counts[id] = (counts[id] || 0) + 1;
      assert.ok(counts[id] <= DATA.maxCopies(id), stage.id + ' 的 ' + id + ' 超过上限');
    });
  });
});
