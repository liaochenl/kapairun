/* 《真理学院》商店：卡池、刷新、价格、购买。纯逻辑，不依赖 DOM。
   库存保存在 profile.shop，刷新页面不会重新随机。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./data.js'));
  else root.TA_SHOP = factory(root.TA_DATA);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA) {
  'use strict';

  const SLOTS = 6;
  const REFRESH_COST = 20;

  function rng(seed) {
    let a = (Number(seed) >>> 0) || 0x9e3779b9;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getShopPrice(cardId) {
    const def = DATA.CARD_MAP[cardId];
    if (!def) return 0;
    if (def.price != null) return def.price;
    return DATA.SHOP_TIERS[def.shopTier] || DATA.SHOP_TIERS.basic;
  }

  function buildShopPool(profile) {
    return DATA.CARDS.filter(function (def) {
      if (!def.collectible || !def.shop) return false;
      if (profile.collection[def.id] >= DATA.maxCopies(def.id)) return false;
      if (def.faction === 'logic' && !profile.unlockedFactions.logic) return false;
      if (!profile.unlockedChapters[def.chapter || 1]) return false;
      return true;
    }).map(function (def) { return def.id; });
  }

  function buildInventory(profile, seed) {
    const pool = buildShopPool(profile).slice();
    const rand = rng(seed);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    return pool.slice(0, SLOTS).map(function (cardId) {
      return { cardId: cardId, price: getShopPrice(cardId), sold: false };
    });
  }

  function discoverSlot(profile, slot) {
    if (profile.discoveredCards.indexOf(slot.cardId) === -1) {
      profile.discoveredCards.push(slot.cardId);
    }
  }

  function createShop(profile, seed) {
    const used = Number(seed) >>> 0 || ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
    profile.shop.seed = used;
    profile.shop.inventory = buildInventory(profile, used);
    profile.shop.inventory.forEach(function (slot) { discoverSlot(profile, slot); });
    return profile.shop.inventory;
  }

  function ensureShop(profile) {
    if (!profile.shop) profile.shop = { inventory: [], seed: 0, refreshCount: 0 };
    if (!profile.shop.seed) {
      createShop(profile);
      return true;
    }
    return false;
  }

  function refreshShop(profile, options) {
    const opts = options || {};
    ensureShop(profile);
    if (!opts.free) {
      if (profile.gold < REFRESH_COST) {
        return { ok: false, reason: '金币不足（需要 ' + REFRESH_COST + '）', inventory: profile.shop.inventory };
      }
      profile.gold -= REFRESH_COST;
    }
    const seed = opts.seed != null
      ? (Number(opts.seed) >>> 0)
      : ((profile.shop.seed + 1) >>> 0);
    profile.shop.seed = seed;
    profile.shop.inventory = buildInventory(profile, seed);
    profile.shop.refreshCount += 1;
    profile.shop.inventory.forEach(function (slot) { discoverSlot(profile, slot); });
    return {
      ok: true,
      reason: '',
      inventory: profile.shop.inventory,
      cost: opts.free ? 0 : REFRESH_COST,
      seed: seed
    };
  }

  function buyShopCard(profile, slotIndex) {
    ensureShop(profile);
    const slot = profile.shop.inventory[slotIndex];
    if (!slot) return { ok: false, reason: '商品不存在' };
    if (slot.sold) return { ok: false, reason: '这件商品已经售出' };
    const def = DATA.CARD_MAP[slot.cardId];
    if (!def || !def.collectible) return { ok: false, reason: '这张牌不能购买' };
    if (profile.gold < slot.price) return { ok: false, reason: '金币不足' };
    if (profile.collection[slot.cardId] >= DATA.maxCopies(slot.cardId)) {
      return { ok: false, reason: '已达到拥有上限' };
    }
    profile.gold -= slot.price;
    profile.collection[slot.cardId] = (profile.collection[slot.cardId] || 0) + 1;
    discoverSlot(profile, slot);
    slot.sold = true;
    return {
      ok: true,
      reason: '',
      card: def,
      price: slot.price,
      count: profile.collection[slot.cardId]
    };
  }

  return {
    SLOTS: SLOTS,
    REFRESH_COST: REFRESH_COST,
    getShopPrice: getShopPrice,
    buildShopPool: buildShopPool,
    buildInventory: buildInventory,
    createShop: createShop,
    ensureShop: ensureShop,
    refreshShop: refreshShop,
    buyShopCard: buyShopCard
  };
});
