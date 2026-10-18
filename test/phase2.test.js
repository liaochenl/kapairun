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
  assert.strictEqual(p.decks[0].cards.length, 3);
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

test('手动刷新扣 20，自动刷新不扣金币', function () {
  const p = META.defaultProfile();
  SHOP.createShop(p, 9);
  let gold = p.gold;
  let res = SHOP.refreshShop(p, { free: false });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(p.gold, gold - 20);
  gold = p.gold;
  res = SHOP.refreshShop(p, { free: true });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(p.gold, gold);
});

test('逻辑牌在解锁前不会进入商店，巨匠不会进入普通商店', function () {
  const p = META.defaultProfile();
  const pool = SHOP.buildShopPool(p);
  assert.ok(pool.every(function (id) { return DATA.CARD_MAP[id].faction !== 'logic'; }));
  assert.ok(pool.every(function (id) { return DATA.CARD_MAP[id].ability !== 'master'; }));
  p.unlockedFactions.logic = true;
  p.unlockedChapters[2] = true;
  const pool2 = SHOP.buildShopPool(p);
  assert.ok(pool2.some(function (id) { return DATA.CARD_MAP[id].faction === 'logic'; }));
  assert.ok(pool2.every(function (id) { return DATA.CARD_MAP[id].ability !== 'master'; }));
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

test('negate 取消对方最近打出的策略牌', function () {
  const state = playState(['counterexample'], ['logical-negation']);
  assert.strictEqual(play(state, 'player', 'counterexample', { row: 'reasoning' }).ok, true);
  assert.strictEqual(state.ai.board.reasoning.length, 1);
  assert.strictEqual(play(state, 'ai', 'logical-negation').ok, true);
  assert.strictEqual(state.ai.board.reasoning.length, 0);
  assert.strictEqual(state.lastSpecial, null);
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
