/* 《真理学院》V2 元游戏：金币、多牌组、收藏、关卡解锁、奖励、V2 存档。
   第二阶段档案：gold / collection / discoveredCards / decks / activeDeckId /
   clearedStages / claimedRewards / unlockedFactions / unlockedChapters / shop / settings。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./data.js'));
  else root.TA_META = factory(root.TA_DATA);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA) {
  'use strict';

  const STORAGE_KEY = 'truth_academy_save_v2';
  const VERSION = 2;
  const DECK_SIZE = 25;
  const MAX_DECKS = 3;
  const START_GOLD = 150;

  function now() {
    return Date.now();
  }

  function defaultProfile() {
    const collection = {};
    Object.keys(DATA.STARTER_COUNTS).forEach(function (id) {
      collection[id] = DATA.STARTER_COUNTS[id];
    });
    return {
      version: VERSION,
      createdAt: now(),
      gold: START_GOLD,
      collection: collection,
      discoveredCards: Object.keys(collection),
      decks: [{
        id: 'deck-1',
        name: '几何基础',
        faction: 'geometry',
        cards: DATA.STARTER_DECK.slice()
      }],
      activeDeckId: 'deck-1',
      clearedStages: {},
      claimedRewards: {},
      unlockedFactions: { geometry: true, logic: false },
      unlockedChapters: { 1: true, 2: false },
      shop: { inventory: [], seed: 0, refreshCount: 0, freeRefreshes: 0 },
      settings: { sound: true, animations: true }
    };
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function owned(profile, id) {
    return Math.max(0, Math.floor(profile.collection[id] || 0));
  }

  function canUseInDeck(profile, cardId, faction) {
    const def = DATA.CARD_MAP[cardId];
    if (!def || !def.collectible) return false;
    if (faction !== 'geometry' && faction !== 'logic') return false;
    if (!profile.unlockedFactions[faction]) return false;
    return def.faction === faction || def.faction === 'neutral';
  }

  function deckCounts(deck) {
    const counts = {};
    (deck && deck.cards || []).forEach(function (id) {
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }

  function getDeck(profile, deckId) {
    const id = deckId || profile.activeDeckId;
    return profile.decks.find(function (d) { return d.id === id; }) || null;
  }

  function activeDeck(profile) {
    let deck = getDeck(profile, profile.activeDeckId);
    if (deck) return deck;
    deck = profile.decks[0];
    if (deck) profile.activeDeckId = deck.id;
    return deck || null;
  }

  function inDeck(profile, cardId, deckId) {
    const deck = getDeck(profile, deckId) || activeDeck(profile);
    return deckCounts(deck)[cardId] || 0;
  }

  function canAdd(profile, cardId, deckId) {
    const deck = getDeck(profile, deckId) || activeDeck(profile);
    if (!deck) return { ok: false, reason: '没有牌组' };
    const def = DATA.CARD_MAP[cardId];
    if (!def || !def.collectible) return { ok: false, reason: '这张牌不能加入牌组' };
    if (deck.cards.length >= DECK_SIZE) return { ok: false, reason: '牌组已满 25 张，请先移除一张' };
    if (!canUseInDeck(profile, cardId, deck.faction)) {
      return { ok: false, reason: '这张牌不属于「' + (DATA.FACTIONS[deck.faction] || {}).name + '」牌组' };
    }
    if (inDeck(profile, cardId, deck.id) >= DATA.maxCopies(cardId)) {
      return { ok: false, reason: '同名上限 ' + DATA.maxCopies(cardId) + ' 张' };
    }
    if (inDeck(profile, cardId, deck.id) >= owned(profile, cardId)) {
      return { ok: false, reason: '收藏中的数量不足' };
    }
    return { ok: true, reason: '' };
  }

  function addCard(profile, cardId, deckId) {
    const check = canAdd(profile, cardId, deckId);
    if (!check.ok) return check;
    const deck = getDeck(profile, deckId) || activeDeck(profile);
    deck.cards.push(cardId);
    if (deck.cards.length >= DECK_SIZE) deck.needsRepair = false;
    return { ok: true, reason: '' };
  }

  function removeCard(profile, cardId, deckId) {
    const deck = getDeck(profile, deckId) || activeDeck(profile);
    if (!deck) return { ok: false, reason: '没有牌组' };
    const idx = deck.cards.lastIndexOf(cardId);
    if (idx === -1) return { ok: false, reason: '牌组里没有这张牌' };
    deck.cards.splice(idx, 1);
    return { ok: true, reason: '' };
  }

  function repairDeck(profile, deck) {
    if (!deck || !Array.isArray(deck.cards)) return { added: 0, needsRepair: true };
    const counts = deckCounts(deck);
    const candidates = DATA.CARDS.filter(function (def) {
      if (!def.collectible) return false;
      if (!canUseInDeck(profile, def.id, deck.faction)) return false;
      const have = owned(profile, def.id);
      const inDeck = counts[def.id] || 0;
      return inDeck < have && inDeck < DATA.maxCopies(def.id);
    }).sort(function (a, b) {
      const af = a.faction === deck.faction ? 0 : 1;
      const bf = b.faction === deck.faction ? 0 : 1;
      if (af !== bf) return af - bf;
      const tier = { basic: 0, advanced: 1, special: 2, master: 3 };
      return (tier[a.shopTier] || 0) - (tier[b.shopTier] || 0);
    });
    let added = 0;
    for (let i = 0; i < candidates.length && deck.cards.length < DECK_SIZE; i++) {
      const id = candidates[i].id;
      deck.cards.push(id);
      counts[id] = (counts[id] || 0) + 1;
      added++;
    }
    deck.needsRepair = deck.cards.length < DECK_SIZE;
    return { added: added, needsRepair: deck.needsRepair };
  }

  function validateDeck(profile, deckOrId) {
    const deck = typeof deckOrId === 'string' ? getDeck(profile, deckOrId) : (deckOrId || activeDeck(profile));
    const errors = [];
    if (!deck) return { ok: false, errors: ['没有牌组'], count: 0, deck: null };
    if (deck.cards.length !== DECK_SIZE) {
      errors.push('牌组需要恰好 25 张，当前 ' + deck.cards.length + ' 张');
    }
    const counts = deckCounts(deck);
    Object.keys(counts).forEach(function (id) {
      const def = DATA.CARD_MAP[id];
      if (!def) {
        errors.push('牌组中有未知卡牌：' + id);
        return;
      }
      if (counts[id] > DATA.maxCopies(id)) {
        errors.push(def.name + ' 超过同名上限 ' + DATA.maxCopies(id) + ' 张');
      }
      if (counts[id] > owned(profile, id)) {
        errors.push(def.name + ' 数量超过收藏');
      }
      if (!canUseInDeck(profile, id, deck.faction)) {
        errors.push(def.name + ' 不能加入「' + (DATA.FACTIONS[deck.faction] || {}).name + '」牌组');
      }
    });
    return { ok: errors.length === 0, errors: errors, count: deck.cards.length, deck: deck };
  }

  function currentDeckLimit(profile) {
    return profile.unlockedFactions && profile.unlockedFactions.logic ? 3 : 2;
  }

  function createDeck(profile, options) {
    const limit = currentDeckLimit(profile);
    if (profile.decks.length >= limit) return { ok: false, reason: '最多保存 ' + limit + ' 套牌' };
    const faction = options && options.faction === 'logic' ? 'logic' : 'geometry';
    if (!profile.unlockedFactions[faction]) return { ok: false, reason: '该学派尚未解锁' };
    let n = 1;
    while (getDeck(profile, 'deck-' + n)) n++;
    const deck = {
      id: 'deck-' + n,
      name: (options && options.name) || ('新牌组 ' + n),
      faction: faction,
      cards: []
    };
    profile.decks.push(deck);
    profile.activeDeckId = deck.id;
    return { ok: true, reason: '', deck: deck };
  }

  function deleteDeck(profile, deckId) {
    if (profile.decks.length <= 1) return { ok: false, reason: '至少保留一套牌组' };
    const idx = profile.decks.findIndex(function (d) { return d.id === deckId; });
    if (idx === -1) return { ok: false, reason: '牌组不存在' };
    profile.decks.splice(idx, 1);
    if (profile.activeDeckId === deckId) profile.activeDeckId = profile.decks[0].id;
    return { ok: true, reason: '' };
  }

  function renameDeck(profile, deckId, name) {
    const deck = getDeck(profile, deckId);
    if (!deck) return { ok: false, reason: '牌组不存在' };
    const clean = String(name || '').trim();
    if (!clean) return { ok: false, reason: '名字不能为空' };
    deck.name = clean.slice(0, 16);
    return { ok: true, reason: '' };
  }

  function setActiveDeck(profile, deckId) {
    const deck = getDeck(profile, deckId);
    if (!deck) return { ok: false, reason: '牌组不存在' };
    profile.activeDeckId = deckId;
    return { ok: true, reason: '' };
  }

  function discoverCard(profile, cardId) {
    if (!DATA.CARD_MAP[cardId]) return false;
    if (profile.discoveredCards.indexOf(cardId) === -1) {
      profile.discoveredCards.push(cardId);
      return true;
    }
    return false;
  }

  function ensureCollectionCount(profile, cardId, count) {
    const def = DATA.CARD_MAP[cardId];
    if (!def || !def.collectible) return;
    const target = Math.min(DATA.maxCopies(cardId), Math.max(owned(profile, cardId), count));
    profile.collection[cardId] = target;
    discoverCard(profile, cardId);
  }

  function unlockLogic(profile) {
    const before = profile.unlockedFactions.logic;
    profile.unlockedFactions.logic = true;
    profile.unlockedChapters[2] = true;
    const counts = DATA.FACTION_STARTER_COUNTS.logic || {};
    Object.keys(counts).forEach(function (id) {
      ensureCollectionCount(profile, id, counts[id]);
    });
    let deckAdded = false;
    const existing = profile.decks.find(function (d) { return d.faction === 'logic'; });
    if (existing) {
      if (!existing.cards.length) existing.cards = DATA.LOGIC_STARTER_DECK.slice();
    } else {
      let n = 1;
      while (getDeck(profile, 'deck-' + n)) n++;
      profile.decks.push({
        id: 'deck-' + n,
        name: '逻辑与集合',
        faction: 'logic',
        cards: DATA.LOGIC_STARTER_DECK.slice(),
        system: true
      });
      deckAdded = true;
    }
    return { newlyUnlocked: !before, deckAdded: deckAdded };
  }

  function isStageUnlocked(profile, stageId) {
    const idx = DATA.STAGES.findIndex(function (s) { return s.id === stageId; });
    if (idx < 0) return false;
    if (idx === 0) return true;
    const stage = DATA.STAGES[idx];
    if (stage.chapter === 2 && !profile.unlockedChapters[2]) return false;
    return !!profile.clearedStages[DATA.STAGES[idx - 1].id];
  }

  function clearedCount(profile) {
    return DATA.STAGES.filter(function (s) { return !!profile.clearedStages[s.id]; }).length;
  }

  function bestStage(profile) {
    for (const stage of DATA.STAGES) {
      if (!isStageUnlocked(profile, stage.id)) break;
      if (!profile.clearedStages[stage.id]) return stage.id;
    }
    const unlocked = DATA.STAGES.filter(function (s) { return isStageUnlocked(profile, s.id); });
    return unlocked.length ? unlocked[unlocked.length - 1].id : '1-1';
  }

  function completeStage(profile, stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage) return { ok: false, reason: '未知关卡', firstClear: false, gold: 0 };
    const firstClear = !profile.clearedStages[stageId];
    profile.clearedStages[stageId] = true;
    const gold = firstClear ? (stage.goldFirst || 0) : (stage.goldRepeat || 0);
    profile.gold += gold;
    const beforeFree = (profile.shop && profile.shop.freeRefreshes) || 0;
    if (!profile.shop) profile.shop = { inventory: [], seed: 0, refreshCount: 0, freeRefreshes: 0 };
    profile.shop.freeRefreshes = Math.min(3, beforeFree + 1);
    if (stageId === '1-10') unlockLogic(profile);
    return {
      ok: true, reason: '', firstClear: firstClear, gold: gold,
      freeRefresh: profile.shop.freeRefreshes > beforeFree
    };
  }

  function markCleared(profile, stageId) {
    const res = completeStage(profile, stageId);
    return { ok: res.ok, reason: res.reason, firstClear: res.firstClear };
  }

  /* ---------- 奖励 ---------- */

  function fixedRewardCards(profile, stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage || !stage.reward) return [];
    const claimed = profile.claimedRewards[stageId] || [];
    return (stage.reward.fixed || []).filter(function (id) {
      if (claimed.indexOf(id) !== -1) return false;
      if (owned(profile, id) >= DATA.maxCopies(id)) return false;
      return true;
    });
  }

  function claimFixedRewards(profile, stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage || !stage.reward) return { newly: [], count: 0 };
    const fixed = stage.reward.fixed || [];
    const claimed = profile.claimedRewards[stageId] || [];
    const newly = [];
    fixed.forEach(function (id) {
      if (claimed.indexOf(id) !== -1) return;
      if (owned(profile, id) < DATA.maxCopies(id)) {
        profile.collection[id] = owned(profile, id) + 1;
        discoverCard(profile, id);
        newly.push(DATA.CARD_MAP[id]);
      }
      claimed.push(id);
    });
    profile.claimedRewards[stageId] = claimed;
    return { newly: newly, count: newly.length };
  }

  function rewardOptions(profile, stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage || !stage.reward) return [];
    const claimed = profile.claimedRewards[stageId] || [];
    return (stage.reward.choice || []).filter(function (id) {
      if (claimed.indexOf(id) !== -1) return false;
      if (owned(profile, id) >= DATA.maxCopies(id)) return false;
      return true;
    });
  }

  function hasReward(profile, stageId) {
    return fixedRewardCards(profile, stageId).length > 0 ||
      rewardOptions(profile, stageId).length > 0;
  }

  function claimReward(profile, stageId, cardId) {
    const options = rewardOptions(profile, stageId);
    if (options.indexOf(cardId) === -1) {
      return { ok: false, reason: '这张牌不能作为本次奖励' };
    }
    const def = DATA.CARD_MAP[cardId];
    profile.collection[cardId] = Math.min(DATA.maxCopies(cardId), owned(profile, cardId) + 1);
    if (!profile.claimedRewards[stageId]) profile.claimedRewards[stageId] = [];
    if (profile.claimedRewards[stageId].indexOf(cardId) === -1) {
      profile.claimedRewards[stageId].push(cardId);
    }
    discoverCard(profile, cardId);
    return { ok: true, reason: '', card: def, count: profile.collection[cardId] };
  }

  function unlockParadoxes(profile) {
    const ids = ['russell', 'zeno', 'incompleteness', 'liar'];
    const newly = [];
    ids.forEach(function (id) {
      if (owned(profile, id) > 0) return;
      profile.collection[id] = 1;
      discoverCard(profile, id);
      newly.push(id);
    });
    return newly;
  }

  function grantCard(profile, cardId) {
    const def = DATA.CARD_MAP[cardId];
    if (!def || !def.collectible) return { ok: false, reason: '不能获得这张牌' };
    profile.collection[cardId] = Math.min(DATA.maxCopies(cardId), owned(profile, cardId) + 1);
    discoverCard(profile, cardId);
    return { ok: true, reason: '', count: profile.collection[cardId] };
  }

  /* ---------- 存档 ---------- */

  function getStorage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* ignore */ }
    return null;
  }

  function sanitizeDecks(profile) {
    const decks = [];
    const rawDecks = Array.isArray(profile.decks) ? profile.decks : [];
    rawDecks.slice(0, MAX_DECKS + 1).forEach(function (raw, i) {
      if (!raw || typeof raw !== 'object') return;
      const faction = raw.faction === 'logic' ? 'logic' : 'geometry';
      const counts = {};
      const cards = [];
      (Array.isArray(raw.cards) ? raw.cards : []).forEach(function (id) {
        const def = DATA.CARD_MAP[id];
        if (!def || !def.collectible) return;
        if (!canUseInDeck(profile, id, faction)) return;
        const n = counts[id] || 0;
        if (n >= owned(profile, id) || n >= DATA.maxCopies(id)) return;
        if (cards.length >= DECK_SIZE) return;
        counts[id] = n + 1;
        cards.push(id);
      });
      decks.push({
        id: raw.id || ('deck-' + (i + 1)),
        name: String(raw.name || ('牌组 ' + (i + 1))).slice(0, 16),
        faction: faction,
        cards: cards,
        system: !!raw.system
      });
    });
    if (!decks.length) {
      const cards = DATA.STARTER_DECK.filter(function (id) {
        return owned(profile, id) > 0 && canUseInDeck(profile, id, 'geometry');
      }).slice(0, DECK_SIZE);
      decks.push({ id: 'deck-1', name: '几何基础', faction: 'geometry', cards: cards });
    }
    profile.decks = decks;
    if (!getDeck(profile, profile.activeDeckId)) profile.activeDeckId = decks[0].id;
  }

  function ensureProfile(raw) {
    if (!raw || typeof raw !== 'object') return defaultProfile();
    if (Number(raw.version) === 1) return defaultProfile();
    const p = raw;
    p.version = VERSION;

    /* V2 第一阶段旧档案：deck -> decks[0] */
    const hadLegacyDeck = Array.isArray(p.deck) && !Array.isArray(p.decks);
    if (hadLegacyDeck) {
      p.decks = [{ id: 'deck-1', name: '几何基础', faction: 'geometry', cards: p.deck.slice() }];
      p.activeDeckId = 'deck-1';
    }
    delete p.deck;

    const collection = {};
    if (p.collection && typeof p.collection === 'object') {
      Object.keys(p.collection).forEach(function (id) {
        const def = DATA.CARD_MAP[id];
        if (!def || !def.collectible) return;
        const n = Math.floor(Number(p.collection[id]) || 0);
        if (n > 0) collection[id] = clamp(n, 0, DATA.maxCopies(id));
      });
    }
    p.collection = collection;
    p.gold = p.gold == null ? START_GOLD : Math.max(0, Math.floor(Number(p.gold) || 0));

    if (!Array.isArray(p.discoveredCards)) p.discoveredCards = [];
    Object.keys(p.collection).forEach(function (id) {
      if (p.discoveredCards.indexOf(id) === -1) p.discoveredCards.push(id);
    });
    p.discoveredCards = p.discoveredCards.filter(function (id) { return !!DATA.CARD_MAP[id]; });

    if (!p.clearedStages || typeof p.clearedStages !== 'object') p.clearedStages = {};
    if (!p.claimedRewards || typeof p.claimedRewards !== 'object') p.claimedRewards = {};
    Object.keys(p.claimedRewards).forEach(function (stageId) {
      if (!DATA.STAGE_MAP[stageId] || !Array.isArray(p.claimedRewards[stageId])) {
        delete p.claimedRewards[stageId];
        return;
      }
      p.claimedRewards[stageId] = p.claimedRewards[stageId].filter(function (id) {
        return !!DATA.CARD_MAP[id];
      });
    });
    Object.keys(p.clearedStages).forEach(function (stageId) {
      if (!DATA.STAGE_MAP[stageId]) delete p.clearedStages[stageId];
    });

    if (!p.unlockedFactions || typeof p.unlockedFactions !== 'object') {
      p.unlockedFactions = { geometry: true, logic: false };
    }
    p.unlockedFactions.geometry = true;
    p.unlockedFactions.logic = !!p.unlockedFactions.logic;
    if (!p.unlockedChapters || typeof p.unlockedChapters !== 'object') {
      p.unlockedChapters = { 1: true, 2: false };
    }
    p.unlockedChapters[1] = true;
    p.unlockedChapters[2] = !!p.unlockedChapters[2];

    if (!p.shop || typeof p.shop !== 'object') p.shop = { inventory: [], seed: 0, refreshCount: 0, freeRefreshes: 0 };
    if (!Array.isArray(p.shop.inventory)) p.shop.inventory = [];
    p.shop.freeRefreshes = Math.max(0, Math.min(3, Math.floor(Number(p.shop.freeRefreshes) || 0)));
    p.shop.inventory = p.shop.inventory.filter(function (slot) {
      return slot && typeof slot === 'object' && !!DATA.CARD_MAP[slot.cardId];
    }).slice(0, 6);
    p.shop.seed = Math.floor(Number(p.shop.seed) || 0);
    p.shop.refreshCount = Math.max(0, Math.floor(Number(p.shop.refreshCount) || 0));

    sanitizeDecks(p);
    if (hadLegacyDeck) p.decks.forEach(function (deck) { repairDeck(p, deck); });

    if (!p.settings || typeof p.settings !== 'object') p.settings = { sound: true, animations: true };
    if (typeof p.settings.sound !== 'boolean') p.settings.sound = true;
    if (typeof p.settings.animations !== 'boolean') p.settings.animations = true;

    if (p.clearedStages['1-10']) unlockLogic(p);
    return p;
  }

  function saveProfile(profile, storage) {
    const store = storage || getStorage();
    if (!store) return false;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(profile));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadProfile(storage) {
    const store = storage || getStorage();
    if (!store) return null;
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || Number(parsed.version) !== VERSION) return null;
      return ensureProfile(parsed);
    } catch (e) {
      return null;
    }
  }

  function resetProfile(storage) {
    const store = storage || getStorage();
    if (store) {
      try { store.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    }
    return defaultProfile();
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    DECK_SIZE: DECK_SIZE,
    MAX_DECKS: MAX_DECKS,
    START_GOLD: START_GOLD,
    currentDeckLimit: currentDeckLimit,
    defaultProfile: defaultProfile,
    ensureProfile: ensureProfile,
    owned: owned,
    canUseInDeck: canUseInDeck,
    deckCounts: deckCounts,
    getDeck: getDeck,
    activeDeck: activeDeck,
    inDeck: inDeck,
    canAdd: canAdd,
    addCard: addCard,
    removeCard: removeCard,
    repairDeck: repairDeck,
    validateDeck: validateDeck,
    createDeck: createDeck,
    deleteDeck: deleteDeck,
    renameDeck: renameDeck,
    setActiveDeck: setActiveDeck,
    discoverCard: discoverCard,
    unlockLogic: unlockLogic,
    isStageUnlocked: isStageUnlocked,
    clearedCount: clearedCount,
    bestStage: bestStage,
    completeStage: completeStage,
    markCleared: markCleared,
    fixedRewardCards: fixedRewardCards,
    claimFixedRewards: claimFixedRewards,
    rewardOptions: rewardOptions,
    hasReward: hasReward,
    claimReward: claimReward,
    unlockParadoxes: unlockParadoxes,
    grantCard: grantCard,
    saveProfile: saveProfile,
    loadProfile: loadProfile,
    resetProfile: resetProfile
  };
});
