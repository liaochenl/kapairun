'use strict';
/* 第二阶段测试：档案迁移、金币、多牌组、阵营、商店、逻辑卡、第二章。 */
const test = require('node:test');
const assert = require('node:assert');

const DATA = require('../js/data.js');
const BATTLE = require('../js/battle.js');
const AI = require('../js/ai.js');
const META = require('../js/meta.js');
const SHOP = require('../js/shop.js');

function memStorage() {
  const mem = {};
  return {
    getItem: function (k) { return mem[k] == null ? null : mem[k]; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };
}

function playState(playerHand, aiHand) {
  const state = BATTLE.createMatch({
    playerDeck: DATA.STARTER_DECK.slice(),
    aiDeck: DATA.STARTER_DECK.slice(),
    seed: 11,
    skipMulligan: true,
    first: 'player'
  });
  state.player.hand = (playerHand || []).slice();
  state.ai.hand = (aiHand || []).slice();
  state.player.deck = [];
  state.ai.deck = [];
  state.current = 'player';
  state.phase = 'play';
  return state;
}

function play(state, side, cardId, opts) {
  const idx = state[side].hand.indexOf(cardId);
  assert.notStrictEqual(idx, -1, side + ' 手牌里应当有 ' + cardId);
  return BATTLE.playCard(state, side, idx, opts || {});
}

function place(state, side, cardId, row) {
  const def = DATA.CARD_MAP[cardId];
  const unit = { uid: state.uid++, id: cardId, row: row || def.row };
  state[side].board[unit.row].push(unit);
  return unit;
}

test('第一阶段 V2 存档迁移：deck -> decks，保留收藏与通关', function () {
  const storage = memStorage();
  const old = {
    version: 2,
    collection: { 'euclid-apprentice': 3, 'triangle': 2 },
    discoveredCards: ['euclid-apprentice', 'triangle'],
    deck: ['euclid-apprentice', 'euclid-apprentice', 'triangle'],
    clearedStages: { '1-1': true },
    claimedRewards: {},
    settings: { sound: true, animations: true }
  };
  storage.setItem(META.STORAGE_KEY, JSON.stringify(old));
  const p = META.loadProfile(storage);
  assert.ok(p);
  assert.strictEqual(p.gold, 150);
  assert.strictEqual(p.decks.length, 1);
  assert.strictEqual(p.decks[0].faction, 'geometry');
  assert.ok(p.decks[0].cards.indexOf('euclid-apprentice') !== -1);
  assert.ok(p.decks[0].cards.indexOf('triangle') !== -1);
  assert.strictEqual(p.decks[0].needsRepair, true);
  assert.strictEqual(p.activeDeckId, p.decks[0].id);
  assert.strictEqual(p.clearedStages['1-1'], true);
  assert.strictEqual(p.collection.triangle, 2);
});

test('初始金币 150，首通 / 重复 / Boss 金币正确', function () {
  const p = META.defaultProfile();
  assert.strictEqual(p.gold, 150);
  let r = META.completeStage(p, '1-1');
  assert.strictEqual(r.gold, 40);
  assert.strictEqual(p.gold, 190);
  r = META.completeStage(p, '1-1');
  assert.strictEqual(r.gold, 15);
  assert.strictEqual(p.gold, 205);
  r = META.completeStage(p, '1-10');
  assert.strictEqual(r.gold, 100);
  r = META.completeStage(p, '1-10');
  assert.strictEqual(r.gold, 30);
});

test('最多 3 套牌，可切换 / 重命名 / 删除', function () {
  const p = META.defaultProfile();
  let r = META.createDeck(p, { name: '第二套', faction: 'geometry' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(p.decks.length, 2);
  r = META.createDeck(p, { name: '第三套', faction: 'geometry' });
  assert.strictEqual(r.ok, false);
  p.unlockedFactions.logic = true;
  p.unlockedChapters[2] = true;
  r = META.createDeck(p, { name: '第三套', faction: 'geometry' });
  assert.strictEqual(r.ok, true);
  r = META.createDeck(p, { name: '第四套', faction: 'geometry' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(META.setActiveDeck(p, p.decks[1].id).ok, true);
  assert.strictEqual(p.activeDeckId, p.decks[1].id);
  assert.strictEqual(META.renameDeck(p, p.decks[1].id, '控制流').ok, true);
  assert.strictEqual(META.getDeck(p, p.decks[1].id).name, '控制流');
  assert.strictEqual(META.deleteDeck(p, p.decks[1].id).ok, true);
  assert.strictEqual(p.decks.length, 2);
});

test('阵营限制：几何牌组不能加入逻辑专属，中立可以', function () {
  const p = META.defaultProfile();
  p.collection.cantor = 1;
  p.collection.infinity = 1;
  const deck = META.activeDeck(p);
  deck.cards.pop();
  assert.strictEqual(META.canAdd(p, 'cantor', p.activeDeckId).ok, false);
  assert.strictEqual(META.canAdd(p, 'infinity', p.activeDeckId).ok, true);
  assert.strictEqual(META.addCard(p, 'infinity').ok, true);
});

test('逻辑未解锁时最多 2 套，解锁后 3 套', function () {
  const p = META.defaultProfile();
  assert.strictEqual(META.currentDeckLimit(p), 2);
  assert.strictEqual(META.createDeck(p, { name: 'B', faction: 'geometry' }).ok, true);
  assert.strictEqual(META.createDeck(p, { name: 'C', faction: 'geometry' }).ok, false);
  p.unlockedFactions.logic = true;
  p.unlockedChapters[2] = true;
  assert.strictEqual(META.currentDeckLimit(p), 3);
  assert.strictEqual(META.createDeck(p, { name: 'C', faction: 'geometry' }).ok, true);
  assert.strictEqual(META.createDeck(p, { name: 'D', faction: 'geometry' }).ok, false);
});

test('已有 3 套几何旧档，通关 1-10 仍会赠送系统逻辑套牌', function () {
  const p = META.defaultProfile();
  p.decks.push(
    { id: 'deck-2', name: '几何 B', faction: 'geometry', cards: DATA.STARTER_DECK.slice() },
    { id: 'deck-3', name: '几何 C', faction: 'geometry', cards: DATA.STARTER_DECK.slice() }
  );
  p.activeDeckId = 'deck-3';
  META.completeStage(p, '1-10');
  assert.strictEqual(p.decks.length, 4);
  const logic = p.decks.find(function (d) { return d.faction === 'logic'; });
  assert.ok(logic);
  assert.strictEqual(logic.system, true);
  assert.strictEqual(logic.cards.length, 25);
  assert.strictEqual(META.validateDeck(p, logic).ok, true);
});

test('通关 1-10 解锁逻辑与第二章，赠送合法逻辑套牌', function () {
  const p = META.defaultProfile();
  META.completeStage(p, '1-10');
  assert.strictEqual(p.unlockedFactions.logic, true);
  assert.strictEqual(p.unlockedChapters[2], true);
  assert.strictEqual(META.isStageUnlocked(p, '2-1'), true);
  const logic = p.decks.find(function (d) { return d.faction === 'logic'; });
  assert.ok(logic);
  assert.strictEqual(logic.cards.length, 25);
  assert.strictEqual(META.validateDeck(p, logic).ok, true, META.validateDeck(p, logic).errors.join('；'));
});

test('商店同一 seed 可复现，稳定 6 槽', function () {
  const a = META.defaultProfile();
  const b = META.defaultProfile();
  SHOP.createShop(a, 12345);
  SHOP.createShop(b, 12345);
  assert.strictEqual(a.shop.inventory.length, 6);
  assert.deepStrictEqual(a.shop.inventory.map(function (s) { return s.cardId; }),
    b.shop.inventory.map(function (s) { return s.cardId; }));
  assert.strictEqual(new Set(a.shop.inventory.map(function (s) { return s.cardId; })).size, 6);
});

test('购买扣金币、进入收藏、不可重复购买', function () {
  const p = META.defaultProfile();
  SHOP.createShop(p, 7);
  const slot = p.shop.inventory[0];
  const gold = p.gold;
  const before = META.owned(p, slot.cardId);
  const res = SHOP.buyShopCard(p, 0);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(p.gold, gold - slot.price);
  assert.strictEqual(META.owned(p, slot.cardId), before + 1);
  assert.ok(p.discoveredCards.indexOf(slot.cardId) !== -1);
  assert.strictEqual(p.shop.inventory[0].sold, true);
  assert.strictEqual(SHOP.buyShopCard(p, 0).ok, false);
});

test('金币不足与拥有上限时不能购买', function () {
  const p = META.defaultProfile();
  SHOP.createShop(p, 8);
  p.gold = 0;
  assert.strictEqual(SHOP.buyShopCard(p, 0).ok, false);
  p.gold = 999;
  const slot = p.shop.inventory[0];
  p.collection[slot.cardId] = DATA.maxCopies(slot.cardId);
  assert.strictEqual(SHOP.buyShopCard(p, 0).ok, false);
});

test('通关增加免费刷新，且不改变当前库存', function () {
  const p = META.defaultProfile();
  SHOP.createShop(p, 9);
  const before = p.shop.inventory.map(function (s) { return s.cardId; });
  META.completeStage(p, '1-1');
  assert.deepStrictEqual(p.shop.inventory.map(function (s) { return s.cardId; }), before);
  assert.strictEqual(p.shop.freeRefreshes, 1);
  META.completeStage(p, '1-1');
  assert.strictEqual(p.shop.freeRefreshes, 2);
  META.completeStage(p, '1-1');
  assert.strictEqual(p.shop.freeRefreshes, 3);
  META.completeStage(p, '1-1');
  assert.strictEqual(p.shop.freeRefreshes, 3);
  META.completeStage(p, '1-1');
});

test('免费刷新不扣金币、次数递减；用完后刷新扣 20', function () {
  const p = META.defaultProfile();
  SHOP.createShop(p, 9);
  p.shop.freeRefreshes = 1;
  const gold = p.gold;
  let res = SHOP.refreshShop(p);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.usedFree, true);
  assert.strictEqual(res.cost, 0);
  assert.strictEqual(p.gold, gold);
  assert.strictEqual(p.shop.freeRefreshes, 0);
  res = SHOP.refreshShop(p);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.usedFree, false);
  assert.strictEqual(p.gold, gold - 20);
});

test('商店按最高通关关卡逐步开放', function () {
  const p = META.defaultProfile();
  ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9', '1-10'].forEach(function (id) {
    META.completeStage(p, id);
  });
  let pool = SHOP.buildShopPool(p);
  assert.strictEqual(pool.indexOf('logical-negation'), -1);
  assert.strictEqual(pool.indexOf('diagonal'), -1);
  META.completeStage(p, '2-3');
  pool = SHOP.buildShopPool(p);
  assert.ok(pool.indexOf('logical-negation') !== -1);
  assert.strictEqual(pool.indexOf('diagonal'), -1);
  META.completeStage(p, '2-5');
  pool = SHOP.buildShopPool(p);
  assert.ok(pool.indexOf('diagonal') !== -1);
});

test('逻辑牌在解锁前不会进入商店，巨匠不会进入普通商店', function () {
  const p = META.defaultProfile();
  const pool = SHOP.buildShopPool(p);
  assert.ok(pool.every(function (id) { return DATA.CARD_MAP[id].faction !== 'logic'; }));
  assert.ok(pool.every(function (id) { return DATA.CARD_MAP[id].ability !== 'master'; }));
  ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9', '1-10', '2-1', '2-2', '2-3'].forEach(function (id) {
    META.completeStage(p, id);
  });
  const pool2 = SHOP.buildShopPool(p);
  assert.ok(pool2.some(function (id) { return DATA.CARD_MAP[id].faction === 'logic'; }));
  assert.ok(pool2.every(function (id) { return DATA.CARD_MAP[id].ability !== 'master'; }));
  assert.ok(pool2.indexOf('logical-negation') !== -1);
  assert.strictEqual(pool2.indexOf('diagonal'), -1);
  META.completeStage(p, '2-5');
  assert.ok(SHOP.buildShopPool(p).indexOf('diagonal') !== -1);
});

test('deduce 会根据上一张逻辑单位 +4', function () {
  const state = playState(['proposition', 'mapping'], []);
  assert.strictEqual(play(state, 'player', 'proposition').ok, true);
  BATTLE.pass(state, 'ai');
  state.current = 'player';
  assert.strictEqual(play(state, 'player', 'mapping').ok, true);
  const unit = state.player.board.reasoning[0];
  assert.strictEqual(unit.deduced, true);
  assert.strictEqual(BATTLE.unitPower(state, 'player', unit), 9);
});

test('AI 用牌库减少量统一计算抽牌价值', function () {
  const state = playState(['completeness', 'counterexample', 'extended-counterexample'], []);
  state.player.deck = ['proposition', 'relation'];
  const actions = AI.candidateActions(state, 'player');
  const pick = function (id) {
    return actions.find(function (a) { return a.cardId === id; });
  };
  assert.ok(pick('completeness').gain >= 8);
  assert.ok(pick('extended-counterexample').gain > pick('counterexample').gain);
});

test('完备性不会被 AI 当成 0 价值直接 Pass', function () {
  const state = playState([], ['completeness']);
  state.current = 'ai';
  state.ai.deck = ['triangle'];
  const action = AI.chooseAction(state, 'ai');
  assert.strictEqual(action.type, 'play');
  assert.strictEqual(action.cardId, 'completeness');
});

test('Beam Search 会模拟抽牌后的后续行动', function () {
  const state = playState(['completeness'], []);
  state.player.deck = ['triangle'];
  const chase = AI.estimateCatchup(state, 'player', 3);
  assert.strictEqual(chase.catchable, true);
  assert.strictEqual(chase.cardsNeeded, 2);
  assert.strictEqual(chase.sequence[0].cardId, 'completeness');
});

test('negate 取消反证法并恢复原单位', function () {
  const state = playState(['reductio'], ['logical-negation']);
  const target = place(state, 'ai', 'descartes', 'reasoning');
  assert.strictEqual(play(state, 'player', 'reductio').ok, true);
  assert.strictEqual(state.ai.board.reasoning.length, 0);
  assert.strictEqual(play(state, 'ai', 'logical-negation').ok, true);
  assert.strictEqual(state.ai.board.reasoning.length, 1);
  assert.strictEqual(state.ai.board.reasoning[0].uid, target.uid);
  assert.ok(state.ai.discard.indexOf('descartes') === -1);
  assert.strictEqual(state.lastAction.cardId, 'logical-negation');
});

test('negate 对角线时删除正确一方的自指 token', function () {
  const state = playState(['diagonal'], ['logical-negation']);
  place(state, 'ai', 'relation');
  place(state, 'ai', 'mapping');
  place(state, 'ai', 'predicate');
  assert.strictEqual(play(state, 'player', 'diagonal', { row: 'reasoning' }).ok, true);
  assert.strictEqual(state.player.board.reasoning.length, 1);
  assert.strictEqual(play(state, 'ai', 'logical-negation').ok, true);
  assert.strictEqual(state.player.board.reasoning.length, 0);
});

test('negate 悖论时恢复之前的排效果', function () {
  const state = playState(['zeno'], ['logical-negation']);
  state.effects.reasoning = { cardId: 'old', name: '旧效果', mode: 'flat', value: -1 };
  assert.strictEqual(play(state, 'player', 'zeno', { row: 'reasoning' }).ok, true);
  assert.strictEqual(state.effects.reasoning.cardId, 'zeno');
  assert.strictEqual(play(state, 'ai', 'logical-negation').ok, true);
  assert.strictEqual(state.effects.reasoning.cardId, 'old');
});

test('对方策略后又打单位，不能再否定更早的策略', function () {
  const state = playState(['consensus', 'logical-negation'], ['proposition']);
  assert.strictEqual(play(state, 'player', 'consensus').ok, true);
  assert.strictEqual(play(state, 'ai', 'proposition').ok, true);
  assert.strictEqual(play(state, 'player', 'logical-negation').ok, false);
});

test('对方 Pass 后不能否定之前的策略', function () {
  const state = playState(['consensus', 'logical-negation'], []);
  assert.strictEqual(play(state, 'player', 'consensus').ok, true);
  assert.strictEqual(BATTLE.pass(state, 'ai').ok, true);
  assert.strictEqual(play(state, 'player', 'logical-negation').ok, false);
});

test('完备性抽牌不可被否定', function () {
  const state = playState(['completeness'], ['logical-negation']);
  assert.strictEqual(play(state, 'player', 'completeness').ok, true);
  assert.strictEqual(play(state, 'ai', 'logical-negation').ok, false);
});

test('反例扩展不可被否定', function () {
  const state = playState(['extended-counterexample'], ['logical-negation']);
  assert.strictEqual(play(state, 'player', 'extended-counterexample', { row: 'reasoning' }).ok, true);
  assert.strictEqual(state.ai.board.reasoning.length, 1);
  assert.strictEqual(play(state, 'ai', 'logical-negation').ok, false);
  assert.strictEqual(state.ai.board.reasoning.length, 1);
});

test('逻辑否定本身不能被逻辑否定', function () {
  const state = playState(['consensus', 'logical-negation'], ['logical-negation']);
  assert.strictEqual(play(state, 'player', 'consensus').ok, true);
  assert.strictEqual(play(state, 'ai', 'logical-negation').ok, true);
  assert.strictEqual(play(state, 'player', 'logical-negation').ok, false);
});

test('diagonal 在对方三单位时生成自指命题', function () {
  const state = playState(['diagonal'], []);
  place(state, 'ai', 'relation');
  place(state, 'ai', 'mapping');
  place(state, 'ai', 'predicate');
  assert.strictEqual(play(state, 'player', 'diagonal', { row: 'reasoning' }).ok, true);
  const token = state.player.board.reasoning[0];
  assert.strictEqual(token.id, 'self-reference-token');
  assert.strictEqual(BATTLE.unitPower(state, 'player', token), 3);
});

test('axiomatize 让普通单位不受悖论影响', function () {
  const state = playState(['formalization'], []);
  const unit = place(state, 'player', 'proposition', 'axiom');
  state.effects.axiom = { cardId: 'zeno', name: '芝诺困境', mode: 'flat', value: -2 };
  assert.strictEqual(BATTLE.unitPower(state, 'player', unit), 2);
  assert.strictEqual(play(state, 'player', 'formalization', { unitUid: unit.uid }).ok, true);
  assert.strictEqual(unit.axiomized, true);
  assert.strictEqual(BATTLE.unitPower(state, 'player', unit), 4);
});

test('2-10 Boss 自指规则应用不完备性危机', function () {
  const state = BATTLE.createMatch({
    playerDeck: DATA.STARTER_DECK,
    aiDeck: DATA.AI_DECKS['2-10'].deck,
    seed: 31,
    skipMulligan: true,
    first: 'player',
    stageId: '2-10',
    bossRule: 'incompleteness'
  });
  BATTLE.pass(state, 'player');
  BATTLE.pass(state, 'ai');
  assert.strictEqual(state.phase, 'roundEnd');
  BATTLE.startNextRound(state);
  const rows = DATA.ROWS.filter(function (r) { return !!state.effects[r]; });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(state.effects[rows[0]].cardId, 'incompleteness');
});

test('第二章 AI 牌组全部合法，且机制不提前', function () {
  const intro = DATA.MECHANIC_INTRO_STAGE;
  DATA.STAGES.forEach(function (stage) {
    const deck = DATA.AI_DECKS[stage.ai].deck;
    assert.strictEqual(deck.length, 25, stage.id);
    const counts = {};
    deck.forEach(function (id) {
      const def = DATA.CARD_MAP[id];
      assert.ok(def, id);
      counts[id] = (counts[id] || 0) + 1;
      assert.ok(counts[id] <= DATA.maxCopies(id), stage.id + ' ' + id);
      const need = intro[def.ability];
      if (need && stage.index < need) assert.fail(stage.id + ' 提前出现 ' + def.name);
    });
  });
});

test('旧 V2 存档迁移后仍可保存读取，新增字段默认值正确', function () {
  const storage = memStorage();
  const old = {
    version: 2,
    collection: { 'euclid-apprentice': 3 },
    deck: ['euclid-apprentice'],
    clearedStages: {},
    claimedRewards: {},
    discoveredCards: ['euclid-apprentice'],
    settings: { sound: true, animations: true }
  };
  storage.setItem(META.STORAGE_KEY, JSON.stringify(old));
  const p = META.loadProfile(storage);
  META.saveProfile(p, storage);
  const again = META.loadProfile(storage);
  assert.ok(again);
  assert.strictEqual(again.gold, 150);
  assert.strictEqual(again.decks.length, 1);
  assert.strictEqual(again.shop.inventory.length, 0);
  assert.strictEqual(again.activeDeckId, again.decks[0].id);
});


test('商店免费刷新次数写入存档并读回', function () {
  const storage = memStorage();
  const p = META.defaultProfile();
  SHOP.createShop(p, 12);
  p.shop.freeRefreshes = 2;
  META.saveProfile(p, storage);
  const loaded = META.loadProfile(storage);
  assert.ok(loaded);
  assert.strictEqual(loaded.shop.freeRefreshes, 2);
  const before = loaded.shop.inventory.map(function (s) { return s.cardId; });
  const res = SHOP.refreshShop(loaded);
  assert.strictEqual(res.usedFree, true);
  assert.strictEqual(loaded.shop.freeRefreshes, 1);
  assert.notDeepStrictEqual(loaded.shop.inventory.map(function (s) { return s.cardId; }), before);
});


test('旧 V2 牌组中的经典悖论迁移后仍是 25 张合法牌组', function () {
  const storage = memStorage();
  const collection = Object.assign({}, DATA.STARTER_COUNTS, { russell: 1, zeno: 1 });
  const deck = DATA.STARTER_DECK.slice(0, 23).concat(['russell', 'zeno']);
  storage.setItem(META.STORAGE_KEY, JSON.stringify({
    version: 2, collection: collection, deck: deck,
    clearedStages: {}, claimedRewards: {}, discoveredCards: Object.keys(collection),
    settings: { sound: true, animations: true }
  }));
  const p = META.loadProfile(storage);
  assert.ok(p);
  assert.strictEqual(p.decks[0].cards.length, 25);
  assert.ok(p.decks[0].cards.indexOf('russell') !== -1);
  assert.ok(p.decks[0].cards.indexOf('zeno') !== -1);
  assert.strictEqual(META.validateDeck(p, p.decks[0]).ok, true);
});

test('旧 V2 含非法卡时 repairDeck 自动补足 25 张', function () {
  const storage = memStorage();
  const deck = DATA.STARTER_DECK.slice(0, 24).concat(['deleted-card']);
  const collection = Object.assign({}, DATA.STARTER_COUNTS, { 'auxiliary-line': 1 });
  storage.setItem(META.STORAGE_KEY, JSON.stringify({
    version: 2, collection: collection, deck: deck,
    clearedStages: {}, claimedRewards: {}, discoveredCards: Object.keys(collection),
    settings: { sound: true, animations: true }
  }));
  const p = META.loadProfile(storage);
  assert.strictEqual(p.decks[0].cards.length, 25);
  assert.strictEqual(p.decks[0].needsRepair, false);
  assert.strictEqual(META.validateDeck(p, p.decks[0]).ok, true);
});

test('收藏不足时 repairDeck 标记 needsRepair', function () {
  const p = META.defaultProfile();
  p.collection = { 'euclid-apprentice': 1 };
  const deck = { id: 'deck-1', name: '残缺', faction: 'geometry', cards: ['euclid-apprentice'] };
  const res = META.repairDeck(p, deck);
  assert.strictEqual(deck.needsRepair, true);
  assert.strictEqual(deck.cards.length, 1);
  assert.strictEqual(res.needsRepair, true);
});
