/* 《真理学院》V2 元游戏：V2 存档、收藏、牌组、关卡解锁、奖励。
   只保留 collection / deck / clearedStages / claimedRewards / discoveredCards / settings。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./data.js'));
  else root.TA_META = factory(root.TA_DATA);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA) {
  'use strict';

  const STORAGE_KEY = 'truth_academy_save_v2';
  const VERSION = 2;
  const DECK_SIZE = 25;

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
      collection: collection,
      deck: DATA.STARTER_DECK.slice(),
      clearedStages: {},
      claimedRewards: {},
      discoveredCards: Object.keys(collection),
      settings: { sound: true, animations: true }
    };
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function ensureProfile(raw) {
    if (!raw || typeof raw !== 'object') return defaultProfile();
    if (Number(raw.version) === 1) return defaultProfile();
    const p = raw;
    p.version = VERSION;

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

    const deck = [];
    if (Array.isArray(p.deck)) {
      const counts = {};
      p.deck.forEach(function (id) {
        const def = DATA.CARD_MAP[id];
        if (!def || !def.collectible) return;
        const n = counts[id] || 0;
        if (n >= (collection[id] || 0)) return;
        if (n >= DATA.maxCopies(id)) return;
        if (deck.length >= DECK_SIZE) return;
        counts[id] = n + 1;
        deck.push(id);
      });
    }
    p.deck = deck;

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

    if (!Array.isArray(p.discoveredCards)) p.discoveredCards = [];
    Object.keys(p.collection).forEach(function (id) {
      if (p.discoveredCards.indexOf(id) === -1) p.discoveredCards.push(id);
    });
    p.discoveredCards = p.discoveredCards.filter(function (id) { return !!DATA.CARD_MAP[id]; });

    if (!p.settings || typeof p.settings !== 'object') p.settings = { sound: true, animations: true };
    if (typeof p.settings.sound !== 'boolean') p.settings.sound = true;
    if (typeof p.settings.animations !== 'boolean') p.settings.animations = true;
    return p;
  }

  /* ---------- 收藏与牌组 ---------- */

  function owned(profile, id) {
    return Math.max(0, Math.floor(profile.collection[id] || 0));
  }

  function deckCounts(profile) {
    const counts = {};
    profile.deck.forEach(function (id) {
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }

  function inDeck(profile, id) {
    return deckCounts(profile)[id] || 0;
  }

  function canAdd(profile, id) {
    const def = DATA.CARD_MAP[id];
    if (!def || !def.collectible) return { ok: false, reason: '这张牌不能加入牌组' };
    if (profile.deck.length >= DECK_SIZE) return { ok: false, reason: '牌组已满 25 张，请先移除一张' };
    if (inDeck(profile, id) >= DATA.maxCopies(id)) {
      return { ok: false, reason: '同名上限 ' + DATA.maxCopies(id) + ' 张' };
    }
    if (inDeck(profile, id) >= owned(profile, id)) {
      return { ok: false, reason: '收藏中的数量不足' };
    }
    return { ok: true, reason: '' };
  }

  function addCard(profile, id) {
    const check = canAdd(profile, id);
    if (!check.ok) return check;
    profile.deck.push(id);
    return { ok: true, reason: '' };
  }

  function removeCard(profile, id) {
    const idx = profile.deck.lastIndexOf(id);
    if (idx === -1) return { ok: false, reason: '牌组里没有这张牌' };
    profile.deck.splice(idx, 1);
    return { ok: true, reason: '' };
  }

  function validateDeck(profile) {
    const errors = [];
    if (profile.deck.length !== DECK_SIZE) {
      errors.push('牌组需要恰好 25 张，当前 ' + profile.deck.length + ' 张');
    }
    const counts = deckCounts(profile);
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
    });
    return { ok: errors.length === 0, errors: errors, count: profile.deck.length };
  }

  /* ---------- 关卡 ---------- */

  function isStageUnlocked(profile, stageId) {
    const idx = DATA.STAGES.findIndex(function (s) { return s.id === stageId; });
    if (idx < 0) return false;
    if (idx === 0) return true;
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

  function markCleared(profile, stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage) return { ok: false, reason: '未知关卡', firstClear: false };
    const firstClear = !profile.clearedStages[stageId];
    profile.clearedStages[stageId] = true;
    return { ok: true, reason: '', firstClear: firstClear };
  }

  /* ---------- 奖励 ---------- */

  function rewardOptions(profile, stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage || !stage.reward) return [];
    const claimed = profile.claimedRewards[stageId] || [];
    return stage.reward.cards.filter(function (id) {
      if (claimed.indexOf(id) !== -1) return false;
      if (owned(profile, id) >= DATA.maxCopies(id)) return false;
      return true;
    });
  }

  function hasReward(profile, stageId) {
    return rewardOptions(profile, stageId).length > 0;
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
    if (profile.discoveredCards.indexOf(cardId) === -1) {
      profile.discoveredCards.push(cardId);
    }
    return { ok: true, reason: '', card: def, count: profile.collection[cardId] };
  }

  function grantCard(profile, cardId) {
    const def = DATA.CARD_MAP[cardId];
    if (!def || !def.collectible) return { ok: false, reason: '不能获得这张牌' };
    profile.collection[cardId] = Math.min(DATA.maxCopies(cardId), owned(profile, cardId) + 1);
    if (profile.discoveredCards.indexOf(cardId) === -1) profile.discoveredCards.push(cardId);
    return { ok: true, reason: '', count: profile.collection[cardId] };
  }

  /* ---------- 存档 ---------- */

  function getStorage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* ignore */ }
    return null;
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
    defaultProfile: defaultProfile,
    ensureProfile: ensureProfile,
    owned: owned,
    deckCounts: deckCounts,
    inDeck: inDeck,
    canAdd: canAdd,
    addCard: addCard,
    removeCard: removeCard,
    validateDeck: validateDeck,
    isStageUnlocked: isStageUnlocked,
    clearedCount: clearedCount,
    bestStage: bestStage,
    markCleared: markCleared,
    rewardOptions: rewardOptions,
    hasReward: hasReward,
    claimReward: claimReward,
    grantCard: grantCard,
    saveProfile: saveProfile,
    loadProfile: loadProfile,
    resetProfile: resetProfile
  };
});
