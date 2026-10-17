/* 《真理学院》元游戏：档案、抽卡、养成、关卡奖励、存档。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./data.js'), require('./battle.js'), require('./rng.js'));
  } else {
    root.TA_META = factory(root.TA_DATA, root.TA_BATTLE, root.TA_RNG);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA, BATTLE, RNG) {
  'use strict';

  const STORAGE_KEY = 'truth_academy_save_v1';
  const ASC_CAPS = [15, 25, 30];
  const ASC_COSTS = [
    { manu: 2, notes: 150 },
    { manu: 4, notes: 300 }
  ];

  function now() {
    return Date.now();
  }

  function defaultProfile() {
    const roster = {};
    DATA.STARTERS.forEach(function (id) {
      roster[id] = { level: 3, dupes: 0, ascension: 0 };
    });
    return {
      version: DATA.VERSION,
      createdAt: now(),
      inspiration: 3200,
      notes: 600,
      manuscripts: 2,
      roster: roster,
      team: DATA.STARTERS.slice(0, 3),
      stageStars: {},
      discovered: [],
      seenEnemies: [],
      gacha: { sinceSSR: 0, totalPulls: 0 },
      settings: { sound: true, animations: true },
      flags: { introSeen: false, tutorialSeen: false, chapterDone: false },
      lastStage: '1-1'
    };
  }

  function ensureProfile(raw) {
    if (!raw || typeof raw !== 'object') return defaultProfile();
    const p = raw;
    p.version = DATA.VERSION;
    if (!p.roster || typeof p.roster !== 'object') p.roster = {};
    DATA.STARTERS.forEach(function (id) {
      if (!p.roster[id]) p.roster[id] = { level: 3, dupes: 0, ascension: 0 };
    });
    Object.keys(p.roster).forEach(function (id) {
      const m = p.roster[id];
      if (!m || typeof m !== 'object') { delete p.roster[id]; return; }
      m.level = clamp(Math.floor(Number(m.level) || 1), 1, 30);
      m.dupes = clamp(Math.floor(Number(m.dupes) || 0), 0, DATA.GACHA.maxDupes);
      m.ascension = clamp(Math.floor(Number(m.ascension) || 0), 0, 2);
      m.level = Math.min(m.level, ASC_CAPS[m.ascension]);
    });
    if (!Array.isArray(p.team) || p.team.length !== 3) {
      const owned = Object.keys(p.roster);
      p.team = [];
      for (let i = 0; i < 3; i++) p.team.push(DATA.STARTERS[i] && p.roster[DATA.STARTERS[i]] ? DATA.STARTERS[i] : owned[i]);
      if (p.team.some(function (id) { return !id; })) {
        p.team = owned.slice(0, 3);
        while (p.team.length < 3 && owned.length) p.team.push(owned[p.team.length % owned.length]);
      }
    }
    p.team = p.team.filter(function (id) { return !!p.roster[id]; });
    Array.from(new Set(p.team)).forEach(function (id) { if (p.team.indexOf(id) === -1) p.team.push(id); });
    p.team = p.team.slice(0, 3);
    while (p.team.length < 3 && Object.keys(p.roster).length) {
      const id = Object.keys(p.roster).find(function (x) { return p.team.indexOf(x) === -1; });
      if (!id) break;
      p.team.push(id);
    }
    p.inspiration = Math.max(0, Math.floor(Number(p.inspiration) || 0));
    p.notes = Math.max(0, Math.floor(Number(p.notes) || 0));
    p.manuscripts = Math.max(0, Math.floor(Number(p.manuscripts) || 0));
    if (!p.stageStars || typeof p.stageStars !== 'object') p.stageStars = {};
    if (!Array.isArray(p.discovered)) p.discovered = [];
    if (!Array.isArray(p.seenEnemies)) p.seenEnemies = [];
    if (!p.gacha || typeof p.gacha !== 'object') p.gacha = { sinceSSR: 0, totalPulls: 0 };
    p.gacha.sinceSSR = clamp(Math.floor(Number(p.gacha.sinceSSR) || 0), 0, DATA.GACHA.pity);
    p.gacha.totalPulls = Math.max(0, Math.floor(Number(p.gacha.totalPulls) || 0));
    if (!p.settings) p.settings = { sound: true, animations: true };
    if (!p.flags) p.flags = { introSeen: false, tutorialSeen: false, chapterDone: false };
    if (!DATA.STAGE_MAP[p.lastStage]) p.lastStage = '1-1';
    return p;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getMember(profile, id) {
    return profile.roster[id] || null;
  }

  function statsFor(profile, id) {
    const def = DATA.SCHOLAR_MAP[id];
    const member = profile.roster[id];
    if (!def || !member) return null;
    return BATTLE.computeStats(def, member);
  }

  function teamMembers(profile) {
    return profile.team.map(function (id) {
      const m = profile.roster[id];
      return { id: id, level: m.level, dupes: m.dupes, ascension: m.ascension };
    }).filter(function (m) { return !!DATA.SCHOLAR_MAP[m.id]; });
  }

  function teamPower(profile) {
    return teamMembers(profile).reduce(function (sum, m) {
      const st = statsFor(profile, m.id);
      if (!st) return sum;
      return sum + Math.round(st.hp / 6 + st.atk * 2 + st.def * 3);
    }, 0);
  }

  function setTeam(profile, team) {
    if (!Array.isArray(team) || team.length !== 3) return { ok: false, reason: '队伍必须恰好有 3 名学者' };
    const unique = Array.from(new Set(team));
    if (unique.length !== 3) return { ok: false, reason: '不能重复上场' };
    for (const id of unique) if (!profile.roster[id]) return { ok: false, reason: '尚未拥有该学者' };
    profile.team = unique;
    return { ok: true, reason: '' };
  }

  function maxLevelFor(member) {
    return ASC_CAPS[clamp(member.ascension || 0, 0, 2)];
  }

  function levelCost(level) {
    return 10 + level * 3;
  }

  function levelUp(profile, id, times) {
    const member = profile.roster[id];
    if (!member) return { ok: false, reason: '尚未拥有该学者', gained: 0, spent: 0 };
    const cap = maxLevelFor(member);
    if (member.level >= cap) {
      return {
        ok: false, gained: 0, spent: 0,
        reason: member.ascension >= 2 ? '已达到等级上限' : '需要突破后才能继续升级'
      };
    }
    const want = Math.max(1, times || 1);
    let gained = 0;
    let spent = 0;
    while (gained < want && member.level < cap) {
      const cost = levelCost(member.level);
      if (profile.notes < cost) break;
      profile.notes -= cost;
      spent += cost;
      member.level += 1;
      gained += 1;
    }
    if (!gained) {
      return { ok: false, gained: 0, spent: 0, reason: profile.notes < levelCost(member.level) ? '讲义不足' : '无法继续升级' };
    }
    return { ok: true, gained: gained, spent: spent, reason: '' };
  }

  function breakthrough(profile, id) {
    const member = profile.roster[id];
    if (!member) return { ok: false, reason: '尚未拥有该学者' };
    const asc = member.ascension || 0;
    if (asc >= 2) return { ok: false, reason: '已经完成全部突破' };
    if (member.level < ASC_CAPS[asc]) {
      return { ok: false, reason: '需要达到 Lv.' + ASC_CAPS[asc] + ' 才能突破' };
    }
    const cost = ASC_COSTS[asc];
    if (profile.manuscripts < cost.manu) return { ok: false, reason: '手稿不足（需要 ' + cost.manu + '）' };
    if (profile.notes < cost.notes) return { ok: false, reason: '讲义不足（需要 ' + cost.notes + '）' };
    profile.manuscripts -= cost.manu;
    profile.notes -= cost.notes;
    member.ascension = asc + 1;
    return { ok: true, reason: '', ascension: member.ascension, cost: cost };
  }

  /* ---------- 抽卡 ---------- */

  function rollRarity(profile, rng) {
    const g = DATA.GACHA;
    const nextPity = profile.gacha.sinceSSR + 1;
    let ssrRate = g.rates.SSR;
    if (nextPity >= g.pity) ssrRate = 1;
    else if (nextPity > g.softPity) ssrRate += (nextPity - g.softPity) * g.softPityStep;
    const roll = rng.next();
    if (roll < ssrRate) return 'SSR';
    if (roll < ssrRate + g.rates.SR) return 'SR';
    return 'R';
  }

  function pickScholar(rarity, rng) {
    const pool = DATA.SCHOLARS.filter(function (s) { return s.rarity === rarity; });
    return rng.pick(pool);
  }

  function grantScholar(profile, id) {
    const def = DATA.SCHOLAR_MAP[id];
    if (!def) return null;
    const existing = profile.roster[id];
    if (!existing) {
      profile.roster[id] = { level: 1, dupes: 0, ascension: 0 };
      return { id: id, rarity: def.rarity, isNew: true, dupes: 0, compensation: 0 };
    }
    if (existing.dupes < DATA.GACHA.maxDupes) {
      existing.dupes += 1;
      return { id: id, rarity: def.rarity, isNew: false, dupes: existing.dupes, compensation: 0 };
    }
    const comp = DATA.GACHA.dupeCompensation[def.rarity] || 0;
    profile.inspiration += comp;
    return { id: id, rarity: def.rarity, isNew: false, dupes: existing.dupes, compensation: comp };
  }

  function pull(profile, count, rng) {
    const c = count === 10 ? 10 : 1;
    const cost = c === 10 ? DATA.GACHA.tenCost : DATA.GACHA.cost;
    if (profile.inspiration < cost) {
      return { ok: false, reason: '灵感不足（需要 ' + cost + '）', results: [], spent: 0 };
    }
    profile.inspiration -= cost;
    const results = [];
    let gotSR = false;
    for (let i = 0; i < c; i++) {
      let rarity = rollRarity(profile, rng);
      if (c === 10 && i === 9 && !gotSR && rarity === 'R') rarity = 'SR';
      if (rarity !== 'R') gotSR = true;
      const scholar = pickScholar(rarity, rng);
      const gained = grantScholar(profile, scholar.id);
      profile.gacha.totalPulls += 1;
      profile.gacha.sinceSSR = rarity === 'SSR' ? 0 : profile.gacha.sinceSSR + 1;
      results.push(gained);
    }
    return { ok: true, reason: '', results: results, spent: cost };
  }

  /* ---------- 关卡 ---------- */

  function isStageUnlocked(profile, stageId) {
    const idx = DATA.STAGES.findIndex(function (s) { return s.id === stageId; });
    if (idx <= 0) return idx === 0;
    const prev = DATA.STAGES[idx - 1];
    return (profile.stageStars[prev.id] || 0) > 0;
  }

  function bestStage(profile) {
    for (const stage of DATA.STAGES) {
      if (!isStageUnlocked(profile, stage.id)) break;
      if (!(profile.stageStars[stage.id] > 0)) return stage.id;
    }
    const unlocked = DATA.STAGES.filter(function (s) { return isStageUnlocked(profile, s.id); });
    return unlocked.length ? unlocked[unlocked.length - 1].id : '1-1';
  }

  function totalStars(profile) {
    return DATA.STAGES.reduce(function (sum, s) { return sum + (profile.stageStars[s.id] || 0); }, 0);
  }

  function markSeen(profile, stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage) return;
    stage.enemyIds.forEach(function (id) {
      if (profile.seenEnemies.indexOf(id) === -1) profile.seenEnemies.push(id);
    });
  }

  function recordDiscoveries(profile, ids) {
    (ids || []).forEach(function (id) {
      if (profile.discovered.indexOf(id) === -1) profile.discovered.push(id);
    });
  }

  function applyStageResult(profile, result) {
    const stage = DATA.STAGE_MAP[result.stageId];
    recordDiscoveries(profile, result.discovered);
    if (!stage) return { rewards: { insp: 0, notes: 0, manu: 0 }, newStars: 0, firstClear: false };
    if (!result.win) {
      return { rewards: { insp: 0, notes: 0, manu: 0 }, newStars: 0, firstClear: false };
    }
    const oldStars = profile.stageStars[result.stageId] || 0;
    const newStars = Math.max(0, (result.stars || 0) - oldStars);
    const base = oldStars === 0 ? stage.rewards.first : stage.rewards.repeat;
    const rewards = {
      insp: base.insp + newStars * stage.rewards.perStar,
      notes: base.notes,
      manu: base.manu
    };
    profile.inspiration += rewards.insp;
    profile.notes += rewards.notes;
    profile.manuscripts += rewards.manu;
    profile.stageStars[result.stageId] = Math.max(oldStars, result.stars || 0);
    profile.lastStage = bestStage(profile);
    if (result.win && result.stageId === '1-10') profile.flags.chapterDone = true;
    return { rewards: rewards, newStars: newStars, firstClear: oldStars === 0 };
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
      return ensureProfile(JSON.parse(raw));
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

  function createRng(seed) {
    return RNG.createRng(seed);
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    ASC_CAPS: ASC_CAPS,
    ASC_COSTS: ASC_COSTS,
    defaultProfile: defaultProfile,
    ensureProfile: ensureProfile,
    getMember: getMember,
    statsFor: statsFor,
    teamMembers: teamMembers,
    teamPower: teamPower,
    setTeam: setTeam,
    maxLevelFor: maxLevelFor,
    levelCost: levelCost,
    levelUp: levelUp,
    breakthrough: breakthrough,
    rollRarity: rollRarity,
    grantScholar: grantScholar,
    pull: pull,
    isStageUnlocked: isStageUnlocked,
    bestStage: bestStage,
    totalStars: totalStars,
    markSeen: markSeen,
    recordDiscoveries: recordDiscoveries,
    applyStageResult: applyStageResult,
    saveProfile: saveProfile,
    loadProfile: loadProfile,
    resetProfile: resetProfile,
    createRng: createRng
  };
});
