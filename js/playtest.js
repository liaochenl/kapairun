/* 《真理学院》本地试玩记录：只记录玩家主动开始的对局，不改动战斗规则。
   独立存储键 truth_academy_playtest_v1，不写入 V2 游戏存档。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TA_PLAYTEST = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const KEY = 'truth_academy_playtest_v1';
  const MAX_RECORDS = 80;

  function getStorage(storage) {
    if (storage) return storage;
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* ignore */ }
    return null;
  }

  function load(storage) {
    const store = getStorage(storage);
    if (!store) return [];
    try {
      const raw = store.getItem(KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.filter(function (r) {
        return r && typeof r === 'object' && typeof r.stageId === 'string';
      }).slice(-MAX_RECORDS);
    } catch (e) {
      return [];
    }
  }

  function save(records, storage) {
    const store = getStorage(storage);
    if (!store) return false;
    try {
      store.setItem(KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function add(record, storage) {
    const list = load(storage);
    list.push(record);
    while (list.length > MAX_RECORDS) list.shift();
    save(list, storage);
    return list;
  }

  function update(id, patch, storage) {
    const list = load(storage);
    const found = list.find(function (r) { return r.id === id; });
    if (!found) return false;
    Object.keys(patch || {}).forEach(function (k) { found[k] = patch[k]; });
    save(list, storage);
    return true;
  }

  function clear(storage) {
    const store = getStorage(storage);
    if (!store) return false;
    try {
      store.removeItem(KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sameDeck(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    const x = a.slice().sort();
    const y = b.slice().sort();
    for (let i = 0; i < x.length; i++) {
      if (x[i] !== y[i]) return false;
    }
    return true;
  }

  /* 这条记录结束后、下一盘开始前，玩家有没有换过牌。
     最后一条记录用当前牌组比较，因此“刚换完还没开下一盘”也会显示已换。 */
  function deckChangedFor(records, index, currentDeck) {
    const record = records[index];
    if (!record || !Array.isArray(record.deckAfter)) return false;
    const next = records[index + 1];
    const target = next && Array.isArray(next.deckAtStart) ? next.deckAtStart : currentDeck;
    return !!target && !sameDeck(record.deckAfter, target);
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
  }

  function summary(records, currentDeck) {
    const games = records.length;
    const wins = records.filter(function (r) { return r.win === true; }).length;
    const roundCounts = records.map(function (r) { return Number(r.rounds) || 0; });
    const firstRounds = [];
    const passCards = [];
    const passActions = [];
    records.forEach(function (r) {
      const r1 = (r.roundStats || []).find(function (x) { return x && x.round === 1; });
      if (!r1) return;
      firstRounds.push(r1);
      if (r1.passCards != null) passCards.push(r1.passCards);
      if (r1.passAction != null) passActions.push(r1.passAction);
    });
    let changed = 0;
    for (let i = 0; i < records.length; i++) {
      if (deckChangedFor(records, i, currentDeck)) changed++;
    }
    return {
      games: games,
      wins: wins,
      winRate: games ? wins / games : 0,
      avgRounds: average(roundCounts),
      avgR1Cards: average(firstRounds.map(function (r) { return Number(r.cards) || 0; })),
      avgR1Units: average(firstRounds.map(function (r) { return Number(r.units) || 0; })),
      avgPassCards: average(passCards),
      avgPassActions: average(passActions),
      passSamples: passCards.length,
      changed: changed,
      changeRate: games ? changed / games : 0,
      avgDurationMs: average(records.map(function (r) { return Number(r.durationMs) || 0; }))
    };
  }

  return {
    KEY: KEY,
    MAX_RECORDS: MAX_RECORDS,
    load: load,
    save: save,
    add: add,
    update: update,
    clear: clear,
    sameDeck: sameDeck,
    deckChangedFor: deckChangedFor,
    summary: summary
  };
});
