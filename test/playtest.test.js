'use strict';
/* 本地试玩记录模块测试。 */
const test = require('node:test');
const assert = require('node:assert');
const PT = require('../js/playtest.js');

function memStorage() {
  const mem = {};
  return {
    getItem: function (k) { return mem[k] == null ? null : mem[k]; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; },
    _mem: mem
  };
}

function record(over) {
  return Object.assign({
    id: 'r1',
    ts: 1000,
    stageId: '1-1',
    stageName: '第一课',
    result: 'player',
    win: true,
    rounds: 2,
    seals: { player: 2, ai: 0 },
    roundStats: [
      { round: 1, cards: 4, units: 3, specials: 1, actions: 5, passAction: 5, passCards: 4, playerScore: 30, aiScore: 20, winner: 'player' }
    ],
    deckAtStart: ['a', 'b', 'c'],
    deckAfter: ['a', 'b', 'c'],
    durationMs: 60000,
    reward: null
  }, over || {});
}

test('试玩记录：空存档返回空列表与空统计', function () {
  const storage = memStorage();
  assert.deepStrictEqual(PT.load(storage), []);
  const s = PT.summary([], ['a']);
  assert.strictEqual(s.games, 0);
  assert.strictEqual(s.winRate, 0);
  assert.strictEqual(s.avgR1Cards, 0);
});

test('试玩记录：写入、读取、更新', function () {
  const storage = memStorage();
  PT.add(record(), storage);
  const list = PT.load(storage);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].stageId, '1-1');
  assert.strictEqual(PT.update('r1', { reward: 'pythagoras' }, storage), true);
  assert.strictEqual(PT.load(storage)[0].reward, 'pythagoras');
  assert.strictEqual(PT.update('missing', { reward: 'x' }, storage), false);
});

test('试玩记录：最多保留 80 条', function () {
  const storage = memStorage();
  for (let i = 0; i < 85; i++) {
    PT.add(record({ id: 'r' + i, ts: i }), storage);
  }
  const list = PT.load(storage);
  assert.strictEqual(list.length, PT.MAX_RECORDS);
  assert.strictEqual(list[0].id, 'r5');
  assert.strictEqual(list[list.length - 1].id, 'r84');
});

test('试玩记录：换牌判断在记录之间与当前牌组上都成立', function () {
  const storage = memStorage();
  const a = record({ id: 'a', deckAfter: ['x', 'y'] });
  const b = record({ id: 'b', deckAtStart: ['x', 'z'], deckAfter: ['x', 'z'] });
  PT.add(a, storage);
  PT.add(b, storage);
  const list = PT.load(storage);
  assert.strictEqual(PT.deckChangedFor(list, 0, ['x', 'z']), true);
  assert.strictEqual(PT.deckChangedFor(list, 1, ['x', 'z']), false);
  assert.strictEqual(PT.deckChangedFor(list, 1, ['q']), true);
});

test('试玩记录：统计第一局投入、首次 Pass 与换牌率', function () {
  const storage = memStorage();
  const a = record({
    id: 'a',
    roundStats: [
      { round: 1, cards: 4, passCards: 4, passAction: 5 },
      { round: 2, cards: 2, passCards: 2, passAction: 3 }
    ],
    deckAfter: ['x', 'y'],
    win: true,
    rounds: 2
  });
  const b = record({
    id: 'b',
    roundStats: [
      { round: 1, cards: 2, passCards: 2, passAction: 2 }
    ],
    deckAtStart: ['x', 'z'],
    deckAfter: ['x', 'z'],
    win: false,
    rounds: 1
  });
  PT.add(a, storage);
  PT.add(b, storage);
  const list = PT.load(storage);
  const s = PT.summary(list, ['x', 'z']);
  assert.strictEqual(s.games, 2);
  assert.strictEqual(s.wins, 1);
  assert.strictEqual(s.winRate, 0.5);
  assert.strictEqual(s.avgRounds, 1.5);
  assert.strictEqual(s.avgR1Cards, 3);
  assert.strictEqual(s.avgPassCards, 3);
  assert.strictEqual(s.changed, 1);
  assert.strictEqual(s.changeRate, 0.5);
});

test('试玩记录：清空', function () {
  const storage = memStorage();
  PT.add(record(), storage);
  assert.strictEqual(PT.load(storage).length, 1);
  assert.strictEqual(PT.clear(storage), true);
  assert.strictEqual(PT.load(storage).length, 0);
});
