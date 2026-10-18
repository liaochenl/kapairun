/* 《真理学院》V2 界面：主页、课程、卡组、图鉴、战斗。
   战斗只调用 battle.js 的纯逻辑；AI 只通过 ai.js 行动。 */
(function () {
  'use strict';

  const DATA = window.TA_DATA;
  const BATTLE = window.TA_BATTLE;
  const AI = window.TA_AI;
  const META = window.TA_META;
  const PLAYTEST = window.TA_PLAYTEST;
  const SHOP = window.TA_SHOP;

  const ROW_LABELS = DATA.ROW_LABELS;
  const ROW_SHORT = { axiom: '公', reasoning: '推', theorem: '定' };

  const app = {
    profile: null,
    screen: 'home',
    match: null,
    stage: null,
    modal: null,
    mulliganSel: [],
    aiTimer: null,
    aiThinking: false,
    matchEnded: false,
    rewardGained: null,
    fixedGained: [],
    paradoxUnlocked: null,
    stageGold: 0,
    stageFreeRefresh: false,
    playtestSession: null,
    aiDelay: 620
  };

  /* ---------- 小工具 ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function $(sel) { return document.querySelector(sel); }

  function card(id) { return DATA.CARD_MAP[id]; }

  function owned(id) { return app.profile ? app.profile.collection[id] || 0 : 0; }

  function activeDeck() { return app.profile ? META.activeDeck(app.profile) : null; }

  function inDeck(id) { return app.profile ? META.inDeck(app.profile, id) : 0; }

  function deckSize() { const d = activeDeck(); return d ? d.cards.length : 0; }

  function isDiscovered(id) {
    return !!app.profile && app.profile.discoveredCards.indexOf(id) !== -1;
  }

  function sourceLabel(def) {
    if (!def || !def.sources) return '未知';
    return def.sources.map(function (src) {
      if (src.type === 'starter') return src.faction === 'logic' ? '逻辑初始套牌' : '几何初始套牌';
      if (src.type === 'shop') return '学术商店';
      if (src.type === 'boss') return src.stage + ' Boss 首通';
      if (src.type === 'stage') return '第' + (src.chapter === 2 ? '二' : '一') + '章 ' + src.stage + ' 奖励';
      return '未知';
    }).join(' · ');
  }

  function save() { META.saveProfile(app.profile); }

  function toast(message) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    root.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2200);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2700);
  }

  function typeLabel(def) {
    if (def.type === 'unit') return '单位';
    if (def.type === 'paradox') return '悖论';
    return '策略';
  }

  function abilityLabel(def) {
    if (def.ability === 'master') return '巨匠';
    if (def.ability === 'bond') return '联动';
    if (def.ability === 'corroborate') return '共证';
    if (def.ability === 'counterexample') return '反例';
    if (def.ability === 'citation') return '引证';
    if (def.ability === 'consensus') return '共识';
    if (def.ability === 'withdraw') return '撤回';
    if (def.ability === 'reductio') return '反证';
    if (def.ability === 'clarify') return '澄清';
    if (def.ability === 'paradox') return '排效果';
    if (def.ability === 'negate') return '否定';
    if (def.ability === 'diagonal') return '对角线';
    if (def.ability === 'deduce') return '推论';
    if (def.ability === 'axiomatize') return '公理化';
    if (def.ability === 'draw') return '抽牌';
    return '';
  }

  function cardMeta(def) {
    if (def.type === 'unit') {
      return typeLabel(def) + ' · ' + ROW_LABELS[def.row] + ' · 论证 ' + def.power;
    }
    return typeLabel(def) + ' · ' + abilityLabel(def);
  }

  function cardTitle(def) {
    return def.name + '\n' + (def.text || '');
  }

  function effectLabel(eff) {
    if (!eff) return '';
    if (eff.mode === 'flat') return eff.name + ' ' + eff.value;
    if (eff.mode === 'halve') return eff.name + ' ÷2';
    if (eff.mode === 'cap') return eff.name + ' ≤' + eff.value;
    return eff.name;
  }

  function sealsHTML(n) {
    let out = '';
    for (let i = 0; i < BATTLE.SEALS; i++) {
      out += '<span class="seal ' + (i < n ? 'on' : 'off') + '">' + (i < n ? '✦' : '✧') + '</span>';
    }
    return '<span class="seals" title="真理印记">' + out + '</span>';
  }

  function rewardLabel(stage) {
    function names(ids) {
      return (ids || []).map(function (id) {
        const def = card(id);
        return def ? def.name : id;
      });
    }
    const fixed = names(META.fixedRewardCards(app.profile, stage.id));
    const choice = names(META.rewardOptions(app.profile, stage.id));
    const parts = [];
    if (fixed.length) parts.push(fixed.join('、'));
    if (choice.length) parts.push('三选一：' + choice.join(' / '));
    if (stage.id === '1-10') parts.push('四种悖论解禁');
    return parts.join(' + ') || '—';
  }

  function canAct() {
    const m = app.match;
    return !!m && m.phase === 'play' && m.current === 'player' && !m.player.passed && !app.aiThinking;
  }

  function clearAITimer() {
    if (app.aiTimer) {
      clearTimeout(app.aiTimer);
      app.aiTimer = null;
    }
    app.aiThinking = false;
  }

  /* ---------- 路由 ---------- */

  function route() {
    const h = (location.hash || '#home').replace('#', '');
    if (h === 'battle' && !app.match) {
      location.hash = '#stages';
      return;
    }
    const screen = ['home', 'stages', 'deck', 'codex', 'shop', 'battle', 'playtest'].indexOf(h) >= 0 ? h : 'home';
    if (screen !== 'battle') {
      clearAITimer();
      app.modal = null;
    }
    app.screen = screen;
    render();
  }

  function go(screen) {
    clearAITimer();
    if (screen !== 'battle') {
      app.match = null;
      app.stage = null;
      app.modal = null;
    }
    if (location.hash === '#' + screen) {
      app.screen = screen;
      render();
    } else {
      location.hash = '#' + screen;
    }
  }

  /* ---------- 渲染入口 ---------- */

  function render() {
    const el = document.getElementById('app');
    if (!el) return;
    let html = '';
    if (app.screen === 'stages') html = stagesHTML();
    else if (app.screen === 'deck') html = deckHTML();
    else if (app.screen === 'codex') html = codexHTML();
    else if (app.screen === 'battle') html = battleHTML();
    else if (app.screen === 'shop') html = shopHTML();
    else if (app.screen === 'playtest') html = playtestHTML();
    else html = homeHTML();
    el.innerHTML = html;
    document.body.classList.toggle('in-battle', app.screen === 'battle');
    document.body.classList.toggle('no-anim', !app.profile.settings.animations);
    renderOverlay();
  }

  function renderOverlay() {
    const root = document.getElementById('overlay-root');
    if (!root) return;
    if (!app.modal) {
      root.innerHTML = '';
      document.body.classList.remove('modal-open');
      return;
    }
    document.body.classList.add('modal-open');
    let body = '';
    if (app.modal.type === 'stage') body = stageModalHTML(app.modal.stageId);
    else if (app.modal.type === 'newdeck') body = newDeckModalHTML();
    else if (app.modal.type === 'rename') body = renameModalHTML();
    else if (app.modal.type === 'card') body = cardDetailHTML(app.modal.cardId);
    else if (app.modal.type === 'mulligan') body = mulliganModalHTML();
    else if (app.modal.type === 'target') body = targetModalHTML();
    else if (app.modal.type === 'round') body = roundModalHTML();
    else if (app.modal.type === 'reward') body = rewardModalHTML();
    else if (app.modal.type === 'result') body = resultModalHTML();
    root.innerHTML = '<div class="overlay"><div class="modal ' + (app.modal.type || '') + '">' + body + '</div></div>';
  }

  /* ---------- 主页 ---------- */

  function homeHTML() {
    const cleared = META.clearedCount(app.profile);
    const total = DATA.STAGES.length;
    const ownedKinds = DATA.CARDS.filter(function (c) {
      return c.collectible && (owned(c.id) > 0 || isDiscovered(c.id));
    }).length;
    const totalKinds = DATA.CARDS.filter(function (c) { return c.collectible; }).length;
    const p = app.profile;
    return '' +
      '<section class="screen home">' +
      '  <div class="hero">' +
      '    <div class="hero-mark" aria-hidden="true">Σ</div>' +
      '    <p class="eyebrow">TRUTH ACADEMY · GWENT CORE</p>' +
      '    <h1>真理学院</h1>' +
      '    <p class="hero-sub">三排 · 两枚真理印记 · 二十五张牌</p>' +
      '    <p class="hero-body">把学者打进公理、推演、定理三排，用论证力压过对手。' +
      '        必要时让掉一小局——手牌就是下一局的筹码。</p>' +
      '  </div>' +
      '  <div class="menu">' +
      '    <button class="menu-btn primary" data-action="nav-stages">' +
      '      <span class="mb-title">课程</span>' +
      '      <span class="mb-sub">1-1 ～ 2-10 · 已通关 ' + cleared + '/' + total + '</span>' +
      '    </button>' +
      '    <button class="menu-btn" data-action="nav-deck">' +
      '      <span class="mb-title">卡组</span>' +
      '      <span class="mb-sub">' + deckSize() + ' / 25 张 · ' +
      (META.validateDeck(p).ok ? '可以开课' : '需要调整') + '</span>' +
      '    </button>' +
      '    <button class="menu-btn" data-action="nav-codex">' +
      '      <span class="mb-title">图鉴</span>' +
      '      <span class="mb-sub">已发现 ' + ownedKinds + ' / ' + totalKinds + ' 种</span>' +
      '    </button>' +
      '    <button class="menu-btn" data-action="nav-shop">' +
      '      <span class="mb-title">商店</span>' +
      '      <span class="mb-sub">金币 ' + (p.gold || 0) + ' · 学术商店</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="home-foot">' +
      '    <div class="settings">' +
      '      <button class="chip-toggle ' + (p.settings.animations ? 'on' : '') + '" data-action="toggle-anim">动画 ' + (p.settings.animations ? '开' : '关') + '</button>' +
      '      <button class="chip-toggle" data-action="nav-playtest">试玩记录' + (PLAYTEST.load().length ? ' · ' + PLAYTEST.load().length : '') + '</button>' +
      '      <button class="chip-toggle danger" data-action="reset-save">重置存档</button>' +
      '    </div>' +
      '    <p class="save-note">存档 v2 · truth_academy_save_v2</p>' +
      '  </div>' +
      '</section>';
  }

  /* ---------- 课程 ---------- */

  function stageCardHTML(stage) {
    const unlocked = META.isStageUnlocked(app.profile, stage.id);
    const cleared = !!app.profile.clearedStages[stage.id];
    const rewardLeft = META.hasReward(app.profile, stage.id);
    const gold = cleared ? stage.goldRepeat : stage.goldFirst;
    const rewardText = rewardLeft ? rewardLabel(stage) : '已领取';
    return '' +
      '<button class="stage-card ' + (unlocked ? '' : 'locked') + (cleared ? ' cleared' : '') + (stage.boss ? ' boss' : '') + (unlocked && !cleared ? ' current' : '') + '"' +
      ' data-action="open-stage" data-id="' + stage.id + '"' + (unlocked ? '' : ' disabled') + '>' +
      '  <span class="stage-index">' + stage.id + '</span>' +
      '  <span class="stage-main">' +
      '    <span class="stage-name">' + esc(stage.name) + '</span>' +
      '    <span class="stage-sub">' + esc(stage.subtitle) + ' · ' + esc(DATA.AI_DECKS[stage.ai].name) + '</span>' +
      '    <span class="stage-reward">金币 ' + gold + ' · ' + (rewardLeft ? '奖励 ' + esc(rewardText) : '奖励已领取') + '</span>' +
      '  </span>' +
      '  <span class="stage-state">' + (cleared ? '✓ 已通关' : stage.boss && unlocked ? 'BOSS · 可挑战' : unlocked ? '可挑战' : '未解锁') + '</span>' +
      '</button>';
  }

  function stagesHTML() {
    const sections = DATA.CHAPTERS.map(function (chapter) {
      const locked = chapter.id === 2 && !app.profile.unlockedChapters[2];
      const stages = chapter.stages.map(function (id) {
        return stageCardHTML(DATA.STAGE_MAP[id]);
      }).join('');
      return '' +
        '<section class="chapter-block chapter-' + chapter.id + ' ' + (locked ? 'locked' : '') + '">' +
        '  <div class="chapter-head"><div><h3>' + (chapter.id === 2 ? '第二章' : '第一章') + ' · ' + esc(chapter.name) + '</h3>' +
        '    <p>' + esc(chapter.subtitle) + (locked ? ' · 通关 1-10 解锁' : '') + '</p></div>' +
        '    <span>' + chapter.stages.filter(function (id) { return app.profile.clearedStages[id]; }).length +
        ' / ' + chapter.stages.length + '</span></div>' +
        '  <div class="stage-list">' + stages + '</div>' +
        '</section>';
    }).join('');
    return '' +
      '<section class="screen stages">' +
      '  <header class="page-head">' +
      '    <button class="ghost" data-action="nav-home">← 学院</button>' +
      '    <div><p class="page-kicker">COURSES</p><h2>课程</h2><p>两章 · 二十关 · 几何与逻辑</p></div>' +
      '    <div class="head-actions">' +
      '      <button class="ghost" data-action="nav-deck">卡组</button>' +
      '      <button class="ghost" data-action="nav-codex">图鉴</button>' +
      '      <button class="ghost" data-action="nav-shop">商店</button>' +
      '      <span class="page-count">' + META.clearedCount(app.profile) + ' / ' + DATA.STAGES.length + '</span>' +
      '    </div>' +
      '  </header>' +
      sections +
      '  <p class="page-note">首通金币与卡牌同时发放；重复通关给少量金币。三选一奖励可重复挑战领完。</p>' +
      '</section>';
  }

  /* ---------- 卡组 ---------- */

  function deckHTML() {
    const p = app.profile;
    const deck = activeDeck();
    if (!deck) return '<section class="screen"><p class="empty-state">没有牌组。</p></section>';
    const counts = META.deckCounts(deck);
    const check = META.validateDeck(p, deck);
    const list = DATA.CARDS.filter(function (c) { return c.collectible && owned(c.id) > 0; })
      .sort(function (a, b) {
        const order = { axiom: 0, reasoning: 1, theorem: 2 };
        if (a.type !== b.type) return a.type === 'unit' ? -1 : 1;
        if (a.type === 'unit' && b.type === 'unit') return (order[a.row] - order[b.row]) || a.power - b.power;
        return a.name.localeCompare(b.name);
      });

    const rows = list.map(function (c) {
      const n = owned(c.id);
      const d = counts[c.id] || 0;
      const addCheck = META.canAdd(p, c.id, deck.id);
      const allowed = META.canUseInDeck(p, c.id, deck.faction);
      return '' +
        '<div class="own-card ' + (allowed ? '' : 'off-faction') + '">' +
        '  <div class="oc-info" title="' + esc(cardTitle(c)) + '" data-action="card-detail" data-id="' + c.id + '">' +
        '    <span class="oc-name">' + esc(c.name) + '</span>' +
        '    <span class="oc-meta">' + esc(cardMeta(c)) + (abilityLabel(c) ? ' · ' + abilityLabel(c) : '') + '</span>' +
        '  </div>' +
        '  <span class="oc-count">收藏 ' + n + ' · 牌组 ' + d + '</span>' +
        '  <span class="oc-actions">' +
        '    <button class="mini" data-action="deck-remove" data-id="' + c.id + '"' + (d ? '' : ' disabled') + '>−</button>' +
        '    <button class="mini" data-action="deck-add" data-id="' + c.id + '"' + (addCheck.ok ? '' : ' disabled') +
        ' title="' + esc(addCheck.ok ? '加入牌组' : addCheck.reason) + '">+</button>' +
        '  </span>' +
        '</div>';
    }).join('');

    const tabs = p.decks.map(function (d) {
      return '<button class="deck-tab ' + (d.id === deck.id ? 'active' : '') + '" data-action="switch-deck" data-id="' + d.id + '">' +
        '<span>' + esc(d.name) + (d.system ? ' · 赠送' : '') + '</span><small>' + esc((DATA.FACTIONS[d.faction] || {}).name || d.faction) + ' · ' + d.cards.length + '/25</small></button>';
    }).join('');

    const rowCounts = { axiom: 0, reasoning: 0, theorem: 0 };
    const typeCounts = { unit: 0, special: 0, paradox: 0 };
    deck.cards.forEach(function (id) {
      const def = card(id);
      if (!def) return;
      if (def.type === 'unit') {
        if (rowCounts[def.row] != null) rowCounts[def.row]++;
        typeCounts.unit++;
      } else if (def.type === 'special') {
        typeCounts.special++;
      } else if (def.type === 'paradox') {
        typeCounts.paradox++;
      }
    });

    return '' +
      '<section class="screen deck-screen">' +
      '  <header class="page-head">' +
      '    <button class="ghost" data-action="nav-home">← 学院</button>' +
      '    <div><p class="page-kicker">DECK ARCHIVE</p><h2>卡组</h2><p>最多 3 套自建牌组 · 系统赠送牌组不占槽位</p></div>' +
      '    <span class="deck-total ' + (check.ok ? 'ok' : 'bad') + '">' + deck.cards.length + ' / 25</span>' +
      '  </header>' +
      '  <div class="deck-tabs">' + tabs +
      '    <button class="deck-tab add" data-action="new-deck"' + (META.playerDeckCount(p) >= META.currentDeckLimit(p) ? ' disabled' : '') + '>＋ 新牌组</button>' +
      '  </div>' +
      '  <div class="deck-deckhead">' +
      '    <div><strong>' + esc(deck.name) + (deck.system ? ' <em class="system-badge">系统</em>' : '') + '</strong><span>' + esc((DATA.FACTIONS[deck.faction] || {}).name || deck.faction) + '</span></div>' +
      '    <div class="head-actions">' +
      '      <button class="ghost" data-action="rename-deck">重命名</button>' +
      '      <button class="ghost danger" data-action="delete-deck"' + (deck.system || p.decks.length <= 1 ? ' disabled' : '') +
      (deck.system ? ' title="系统赠送牌组不能删除"' : '') + '>删除</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="deck-layout">' +
      '    <div class="owned-panel">' +
      '      <h3>已拥有</h3>' +
      '      <div class="owned-list">' + (rows || '<p class="empty-state">还没有卡牌。</p>') + '</div>' +
      '    </div>' +
      '    <aside class="deck-summary">' +
      '      <h3>当前牌组</h3>' +
      '      <div class="deck-meter"><span style="width:' + Math.min(100, deck.cards.length / 25 * 100) + '%"></span></div>' +
      '      <dl class="deck-breakdown">' +
      '        <div><dt>公理域</dt><dd>' + rowCounts.axiom + '</dd><span class="bar"><i style="width:' + (rowCounts.axiom / 25 * 100) + '%"></i></span></div>' +
      '        <div><dt>推演域</dt><dd>' + rowCounts.reasoning + '</dd><span class="bar"><i style="width:' + (rowCounts.reasoning / 25 * 100) + '%"></i></span></div>' +
      '        <div><dt>定理域</dt><dd>' + rowCounts.theorem + '</dd><span class="bar"><i style="width:' + (rowCounts.theorem / 25 * 100) + '%"></i></span></div>' +
      '        <div><dt>单位</dt><dd>' + typeCounts.unit + '</dd><span class="bar"><i style="width:' + (typeCounts.unit / 25 * 100) + '%"></i></span></div>' +
      '        <div><dt>策略</dt><dd>' + typeCounts.special + '</dd><span class="bar"><i style="width:' + (typeCounts.special / 25 * 100) + '%"></i></span></div>' +
      '        <div><dt>悖论</dt><dd>' + typeCounts.paradox + '</dd><span class="bar"><i style="width:' + (typeCounts.paradox / 25 * 100) + '%"></i></span></div>' +
      '      </dl>' +
      (check.ok ? '<p class="deck-valid">牌组合法，可以开课。</p>'
        : '<ul class="deck-errors">' + check.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>') +
      (deck.needsRepair ? '<p class="deck-errors">版本更新后该牌组需要补充 ' + (25 - deck.cards.length) + ' 张牌。</p>' : '') +
      '      <button class="primary wide" data-action="nav-stages">去课程</button>' +
      '    </aside>' +
      '  </div>' +
      '</section>';
  }

  /* ---------- 图鉴 ---------- */

  function codexHTML() {
    const groups = [
      { key: 'unit', label: '单位' },
      { key: 'special', label: '策略' },
      { key: 'paradox', label: '悖论' }
    ];
    const sections = groups.map(function (g) {
      const list = DATA.CARDS.filter(function (c) { return c.type === g.key; });
      const cards = list.map(function (c) {
        const have = c.collectible ? owned(c.id) : 0;
        const known = have > 0 || isDiscovered(c.id);
        if (!known) {
          return '' +
            '<article class="codex-card unknown type-' + c.type + '">' +
            '  <header><span class="cc-name">???</span><span class="cc-count">未发现</span></header>' +
            '  <div class="cc-art">?</div>' +
            '  <p class="cc-meta">尚未在课程或商店中见过</p>' +
            '</article>';
        }
        return '' +
          '<article class="codex-card ' + (have > 0 ? 'owned' : 'revealed') + ' faction-' + c.faction + ' type-' + c.type + (c.ability === 'master' ? ' master' : '') + '" data-action="card-detail" data-id="' + c.id + '" title="' + esc(cardTitle(c)) + '">' +
          '  <header><span class="cc-name">' + esc(c.name) + '</span>' +
          '    <span class="cc-count">' + (have > 0 ? '×' + have : '已发现') + '</span>' +
          '  </header>' +
          '  <div class="cc-art">' + esc((DATA.FACTIONS[c.faction] || {}).mark || '∴') + '</div>' +
          '  <p class="cc-meta">' + esc(cardMeta(c)) + '</p>' +
          '  <p class="cc-text">' + esc(c.text) + '</p>' +
          '  <p class="cc-source">' + esc(sourceLabel(c)) + (c.negatable ? ' ' + negatableBadge(c) : '') + '</p>' +
          '</article>';
      }).join('');
      return '<section class="codex-group"><h3>' + g.label + '</h3><div class="codex-grid">' + cards + '</div></section>';
    }).join('');
    const knownCount = DATA.CARDS.filter(function (c) { return owned(c.id) > 0 || isDiscovered(c.id); }).length;
    return '' +
      '<section class="screen codex">' +
      '  <header class="page-head">' +
      '    <button class="ghost" data-action="nav-home">← 学院</button>' +
      '    <div><p class="page-kicker">CATALOGUE</p><h2>图鉴</h2><p>' + DATA.CARDS.length + ' 张卡 · 已发现 ' + knownCount + '</p></div>' +
      '  </header>' +
      sections +
      '</section>';
  }

  /* ---------- 商店 ---------- */

  function shopHTML() {
    if (SHOP.ensureShop(app.profile)) save();
    const p = app.profile;
    const slots = [];
    for (let i = 0; i < SHOP.SLOTS; i++) {
      const slot = p.shop.inventory[i];
      if (!slot) {
        slots.push('<div class="shop-slot empty"><span>暂无合适卡牌</span></div>');
        continue;
      }
      const def = card(slot.cardId);
      const have = owned(slot.cardId);
      const maxed = have >= DATA.maxCopies(slot.cardId);
      const disabled = slot.sold || maxed || p.gold < slot.price;
      slots.push('' +
        '<div class="shop-slot faction-' + def.faction + ' type-' + def.type + (slot.sold ? ' sold' : '') + '">' +
        '  <div class="shop-card" data-action="card-detail" data-id="' + def.id + '">' +
        '    <span class="sc-faction">' + esc((DATA.FACTIONS[def.faction] || {}).name || def.faction) + '</span>' +
        '    <strong>' + esc(def.name) + '</strong>' +
        '    <span class="sc-meta">' + esc(cardMeta(def)) + '</span>' +
        '    <span class="sc-text">' + esc(def.text) + '</span>' +
        '    <span class="sc-have">已拥有 ' + have + ' / ' + DATA.maxCopies(def.id) + ' ' + negatableBadge(def) + '</span>' +
        '  </div>' +
        '  <button class="shop-buy" data-action="shop-buy" data-slot="' + i + '"' + (disabled ? ' disabled' : '') + '>' +
        (slot.sold ? '已售出' : maxed ? '已满' : '购买 ' + slot.price + ' 金币') +
        '  </button>' +
        '</div>');
    }
    return '' +
      '<section class="screen shop">' +
      '  <header class="page-head">' +
      '    <button class="ghost" data-action="nav-home">← 学院</button>' +
      '    <div><p class="page-kicker">ACADEMIC SHOP</p><h2>学术商店</h2><p>通关获得免费刷新次数 · 商店不会自动换货 · 首通奖励通关后可购买</p></div>' +
      '    <div class="shop-head-right"><span class="gold-chip">金币 ' + p.gold + '</span>' +
      '      <button class="ghost' + ((p.shop.freeRefreshes || 0) > 0 ? ' free-refresh' : '') + '" data-action="shop-refresh"' +
      ((p.shop.freeRefreshes || 0) > 0 || p.gold >= SHOP.REFRESH_COST ? '' : ' disabled') + '>' +
      ((p.shop.freeRefreshes || 0) > 0 ? '免费刷新 · 剩余 ' + p.shop.freeRefreshes : '刷新 · ' + SHOP.REFRESH_COST + ' 金币') +
      '</button>' +
      '    </div>' +
      '  </header>' +
      '  <div class="shop-grid">' + slots.join('') + '</div>' +
      '  <p class="page-note">刷新后旧商品会消失；购买后立即进入收藏。首通奖励在通关后才会进入商店，巨匠与悖论不出售。</p>' +
      '</section>';
  }

  /* ---------- 试玩记录 ---------- */

  function emptyRoundStats() {
    return { cards: 0, units: 0, specials: 0, actions: 0, passAction: null, passCards: null };
  }

  function createPlaytestSession(stage) {
    return {
      stageId: stage.id,
      stageName: stage.name,
      startedAt: Date.now(),
      deckAtStart: (activeDeck() ? activeDeck().cards.slice() : []),
      rounds: [],
      current: emptyRoundStats(),
      finished: false,
      recordId: null
    };
  }

  function notePlayerPlay(def) {
    const s = app.playtestSession;
    if (!s || s.finished || !def) return;
    s.current.cards += 1;
    s.current.actions += 1;
    if (def.type === 'unit') s.current.units += 1;
    else s.current.specials += 1;
  }

  function notePlayerPass() {
    const s = app.playtestSession;
    if (!s || s.finished) return;
    if (s.current.passAction == null) {
      s.current.actions += 1;
      s.current.passAction = s.current.actions;
      s.current.passCards = s.current.cards;
    }
  }

  function captureRound() {
    const s = app.playtestSession;
    const m = app.match;
    if (!s || !m || !m.lastRound) return;
    const r = m.lastRound;
    if (s.rounds.some(function (x) { return x.round === r.round; })) return;
    s.rounds.push({
      round: r.round,
      cards: s.current.cards,
      units: s.current.units,
      specials: s.current.specials,
      actions: s.current.actions,
      passAction: s.current.passAction,
      passCards: s.current.passCards,
      playerScore: r.playerScore,
      aiScore: r.aiScore,
      winner: r.winner
    });
    s.current = emptyRoundStats();
  }

  function playtestHTML() {
    const records = PLAYTEST.load();
    const summary = PLAYTEST.summary(records, activeDeck() ? activeDeck().cards : []);
    const rows = records.map(function (r, i) {
      return { record: r, changed: PLAYTEST.deckChangedFor(records, i, activeDeck() ? activeDeck().cards : []) };
    }).reverse();

    const stats = [
      { label: '对局', value: summary.games },
      { label: '胜率', value: summary.games ? Math.round(summary.winRate * 100) + '%' : '—' },
      { label: '平均小局', value: summary.games ? summary.avgRounds.toFixed(1) : '—' },
      { label: 'R1 平均投入', value: summary.games ? summary.avgR1Cards.toFixed(1) + ' 张' : '—' },
      { label: '首次 Pass', value: summary.passSamples ? summary.avgPassCards.toFixed(1) + ' 张后' : '—' },
      { label: '换牌率', value: summary.games ? Math.round(summary.changeRate * 100) + '%' : '—' }
    ].map(function (x) {
      return '<div class="pt-stat"><span>' + x.label + '</span><strong>' + x.value + '</strong></div>';
    }).join('');

    const list = rows.map(function (item) {
      const r = item.record;
      const r1 = (r.roundStats || []).find(function (x) { return x.round === 1; });
      const resultText = r.result === 'player' ? '胜' : r.result === 'ai' ? '负' : '平';
      const resultClass = r.result === 'player' ? 'win' : r.result === 'ai' ? 'loss' : 'draw';
      const passText = r1 && r1.passCards != null
        ? r1.passCards + ' 张后 Pass'
        : (r1 ? '未 Pass' : '—');
      const rewardIds = [].concat(r.fixedReward || [], r.reward ? [r.reward] : []);
      const rewards = rewardIds.map(function (id) {
        const def = card(id);
        return def ? def.name : id;
      });
      return '' +
        '<article class="pt-row">' +
        '  <div class="pt-main">' +
        '    <span class="pt-badge ' + resultClass + '">' + resultText + '</span>' +
        '    <div><strong>' + esc(r.stageId + ' ' + (r.stageName || '')) + '</strong>' +
        '      <small>' + (r.rounds || 0) + ' 小局 · 印记 ' + (r.seals ? r.seals.player : '?') + ' : ' + (r.seals ? r.seals.ai : '?') + '</small></div>' +
        '  </div>' +
        '  <div class="pt-metrics">' +
        '    <span>R1 投入 <b>' + (r1 ? r1.cards : '—') + '</b> 张</span>' +
        '    <span>' + esc(passText) + '</span>' +
        '    <span class="pt-deck ' + (item.changed ? 'changed' : '') + '">' + (item.changed ? '已换牌' : '未换牌') + '</span>' +
        (rewards.length ? '<span class="pt-reward">奖励 ' + esc(rewards.join('、')) + '</span>' : '') +
        '  </div>' +
        '  <time>' + new Date(r.ts || Date.now()).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</time>' +
        '</article>';
    }).join('');

    return '' +
      '<section class="screen playtest">' +
      '  <header class="page-head">' +
      '    <button class="ghost" data-action="nav-home">← 学院</button>' +
      '    <div><p class="page-kicker">PLAYTEST LOG</p><h2>试玩记录</h2><p>本地记录 · 只统计主动开始的对局</p></div>' +
      (records.length ? '<button class="ghost" data-action="clear-playtest">清空记录</button>' : '') +
      '  </header>' +
      '  <div class="pt-summary">' + stats + '</div>' +
      (records.length
        ? '<div class="pt-list">' + list + '</div>' +
          '<p class="page-note">“已换牌”按下一盘开始时的牌组比较；最后一盘按当前牌组比较。AI 自动模拟不会写入这里。</p>'
        : '<div class="pt-empty"><p class="empty-state">还没有试玩记录。</p><p>主动点「开始对局」打一盘，这里会自动记录；AI 模拟不会写入。</p><button class="primary" data-action="nav-stages">去开一局</button></div>') +
      '</section>';
  }

  /* ---------- 战斗 ---------- */

  function battleHTML() {
    const m = app.match;
    if (!m) return '<section class="screen"><p class="empty-state">没有进行中的对局。</p></section>';
    const stage = app.stage;
    const yourTurn = m.phase === 'play' && m.current === 'player' && !m.player.passed;
    let turnText = '结算中';
    if (m.phase === 'play') {
      if (app.aiThinking) turnText = '对手思考中…';
      else if (m.player.passed) turnText = '你已 Pass';
      else if (m.ai.passed) turnText = '对手已 Pass · 你可继续';
      else if (yourTurn) turnText = '你的回合';
      else turnText = '对手回合';
    }
    const playerScore = BATTLE.calculateTotalScore(m, 'player');
    const aiScore = BATTLE.calculateTotalScore(m, 'ai');

    return '' +
      '<section class="screen battle">' +
      '  <header class="battle-head">' +
      '    <button class="ghost" data-action="battle-quit">← 课程</button>' +
      '    <div class="bt-title">' +
      '      <strong>' + stage.id + ' ' + esc(stage.name) + '</strong>' +
      '      <span>第 ' + m.round + ' 小局 · 对手 ' + esc(DATA.AI_DECKS[stage.ai].name) + '</span>' +
      '    </div>' +
      '    <span class="turn-pill ' + (yourTurn ? 'yours' : app.aiThinking ? 'thinking' : (m.ai.passed && !m.player.passed ? 'yours' : '')) + '">' + turnText + '</span>' +
      '  </header>' +
      sidePanel('ai') +
      '  <div class="totals">' +
      '    <div class="ts-end ai' + (aiScore > playerScore ? ' ahead' : '') + '"><span class="ts-side">对手</span><span class="ts-num">' + aiScore + '</span></div>' +
      '    <div class="ts-label">论证力</div>' +
      '    <div class="ts-end player' + (playerScore > aiScore ? ' ahead' : '') + '"><span class="ts-num">' + playerScore + '</span><span class="ts-side">你</span></div>' +
      '  </div>' +
      sidePanel('player') +
      '  <div class="hand-zone">' +
      '    <div class="hand-label"><span>手牌</span><span>' + m.player.hand.length + ' 张 · 牌库 ' + m.player.deck.length + '</span></div>' +
      '    <div class="hand">' + handHTML() + '</div>' +
      '  </div>' +
      '  <div class="battle-actions">' +
      '    <button class="pass-btn" data-action="pass"' + (canAct() ? '' : ' disabled') + '>' +
      '      <span>PASS</span><small>结束本小局</small>' +
      '    </button>' +
      '    <div class="battle-hint">' + battleHint() + '</div>' +
      '  </div>' +
      '  <div class="battle-log">' + logHTML() + '</div>' +
      '</section>';
  }

  function sidePanel(side) {
    const m = app.match;
    const st = m[side];
    const rows = side === 'ai' ? ['theorem', 'reasoning', 'axiom'] : ['axiom', 'reasoning', 'theorem'];
    const name = side === 'ai' ? DATA.AI_DECKS[app.stage.ai].name : '你';
    return '' +
      '<section class="side ' + side + '">' +
      '  <header class="side-head">' +
      '    <span class="side-name">' + esc(name) + '</span>' +
      sealsHTML(st.seals) +
      (side === 'ai' ? '<span class="hand-count">手牌 ' + st.hand.length + '</span>' : '<span class="hand-count">牌库 ' + st.deck.length + '</span>') +
      (st.passed ? '<span class="pass-tag">已 PASS</span>' : '') +
      '    <span class="side-score">' + BATTLE.calculateTotalScore(m, side) + '</span>' +
      '  </header>' +
      '  <div class="rows">' + rows.map(function (row) { return rowHTML(side, row); }).join('') + '</div>' +
      '</section>';
  }

  function rowHTML(side, row) {
    const m = app.match;
    const st = m[side];
    const units = st.board[row];
    const score = BATTLE.calculateRowScore(m, side, row);
    const eff = m.effects[row];
    const unitHTML = units.length
      ? units.map(function (u) {
        const def = card(u.id);
        const power = BATTLE.unitPower(m, side, u);
        const cls = ['unit', 'faction-' + def.faction];
        if (def.token) cls.push('token');
        if (def.ability === 'master') cls.push('master');
        if (def.ability === 'bond') cls.push('bond');
        if (def.ability === 'corroborate') cls.push('corroborate');
        if (def.ability === 'deduce' && u.deduced) cls.push('deduced');
        if (u.axiomized) cls.push('axiomized');
        return '<span class="' + cls.join(' ') + '" title="' + esc(cardTitle(def)) + '">' +
          '<span class="u-name">' + esc(def.name) + '</span>' +
          '<span class="u-power">' + power + '</span>' +
          '</span>';
      }).join('')
      : '<span class="row-empty">—</span>';
    return '' +
      '<div class="row row-' + row + (eff ? ' cursed' : '') + '">' +
      '  <div class="row-label"><span class="rl-name">' + ROW_LABELS[row] + '</span>' +
      '    <span class="rl-score">' + score + '</span></div>' +
      '  <div class="row-units">' + unitHTML + '</div>' +
      (eff ? '<span class="effect-chip" title="' + esc(effectLabel(eff)) + '：该排双方单位受影响">' + esc(effectLabel(eff)) + '</span>' : '') +
      '</div>';
  }

  function negatableBadge(def) {
    return def && def.negatable ? '<span class="neg-badge" title="可被逻辑否定">◈ 可否定</span>' : '';
  }

  function handHTML() {
    const m = app.match;
    const active = canAct();
    return m.player.hand.map(function (id, index) {
      const def = card(id);
      if (!def) return '';
      const isUnit = def.type === 'unit';
      const mark = (DATA.FACTIONS[def.faction] || {}).mark || '∴';
      const power = isUnit ? def.power : (def.type === 'paradox' ? '⚠' : '∴');
      return '' +
        '<button class="hand-card faction-' + def.faction + ' type-' + def.type + (def.ability === 'master' ? ' master' : '') + (active ? '' : ' disabled') + '"' +
        ' data-action="hand-card" data-index="' + index + '"' +
        ' title="' + esc(cardTitle(def)) + '"' + (active ? '' : ' disabled') + '>' +
        '  <span class="hc-top"><span class="hc-faction">' + esc(mark) + '</span><span class="hc-power">' + esc(power) + '</span></span>' +
        '  <span class="hc-name">' + esc(def.name) + '</span>' +
        '  <span class="hc-ability">' + esc(isUnit ? (abilityLabel(def) || '稳定论证') : (abilityLabel(def) || typeLabel(def))) + '</span>' +
        '  <span class="hc-bottom"><span>' + (isUnit ? ROW_LABELS[def.row] : typeLabel(def)) + '</span>' + negatableBadge(def) + '</span>' +
        '</button>';
    }).join('');
  }

  function battleHint() {
    const m = app.match;
    if (m.phase !== 'play') return '本小局已结束。';
    if (m.current === 'player') {
      if (m.player.passed) return '你已 Pass，等待对手行动。';
      if (m.ai.passed) return '对手已 Pass。你可以继续出牌，直到自己 Pass。';
      return '点击手牌打出。特殊牌需要选择目标。';
    }
    return app.aiThinking ? '对手正在权衡是否继续投入。' : '等待对手行动。';
  }

  function logHTML() {
    const m = app.match;
    const entries = m.log.slice(-5).reverse();
    return entries.map(function (e) {
      return '<p class="log-line ' + (e.side || 'system') + '"><span class="log-round">R' + (e.round || m.round) + '</span>' + esc(e.text) + '</p>';
    }).join('');
  }

  /* ---------- 弹层 ---------- */

  function stageModalHTML(stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    const deckCheck = META.validateDeck(app.profile);
    const aiDeck = DATA.AI_DECKS[stage.ai];
    return '' +
      '<div class="modal-head">' +
      '  <p class="modal-eyebrow">' + stage.id + ' · ' + esc(stage.subtitle) + '</p>' +
      '  <h2>' + esc(stage.name) + '</h2>' +
      '</div>' +
      '<p class="modal-lesson">' + esc(stage.lesson) + '</p>' +
      '<div class="modal-grid">' +
      '  <div><span class="mg-label">对手</span><span class="mg-value">' + esc(aiDeck.name) + '</span></div>' +
      '  <div><span class="mg-label">奖励</span><span class="mg-value">' + esc(rewardLabel(stage)) + '</span></div>' +
      '  <div><span class="mg-label">金币</span><span class="mg-value">首通 ' + stage.goldFirst + ' / 重复 ' + stage.goldRepeat + '</span></div>' +
      '  <div><span class="mg-label">你的牌组</span><span class="mg-value ' + (deckCheck.ok ? '' : 'bad') + '">' +
      (activeDeck() ? esc(activeDeck().name) + ' · ' + activeDeck().cards.length + ' / 25' : '无') + '</span></div>' +
      '  <div><span class="mg-label">真理印记</span><span class="mg-value">2 : 2</span></div>' +
      '  <div><span class="mg-label">先手</span><span class="mg-value">掷硬币</span></div>' +
      '</div>' +
      '<p class="modal-tip">' + esc(stage.tip) + '</p>' +
      (deckCheck.ok ? '' : '<ul class="deck-errors">' + deckCheck.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>') +
      '<div class="modal-actions">' +
      '  <button class="ghost" data-action="modal-close">取消</button>' +
      (deckCheck.ok
        ? '<button class="primary" data-action="begin-battle" data-id="' + stage.id + '">开始对局</button>'
        : '<button class="primary" data-action="modal-deck">去编辑卡组</button>') +
      '</div>';
  }

  function mulliganModalHTML() {
    const m = app.match;
    const selected = app.mulliganSel;
    const cards = m.player.hand.map(function (id, index) {
      const def = card(id);
      const on = selected.indexOf(index) !== -1;
      return '' +
        '<button class="mull-card type-' + def.type + (on ? ' selected' : '') + '" data-action="mulligan-toggle" data-index="' + index + '">' +
        '  <span class="mc-index">' + (on ? '换' : '') + '</span>' +
        '  <span class="mc-name">' + esc(def.name) + '</span>' +
        '  <span class="mc-meta">' + esc(cardMeta(def)) + '</span>' +
        '</button>';
    }).join('');
    return '' +
      '<div class="modal-head">' +
      '  <p class="modal-eyebrow">开局 · 换牌</p>' +
      '  <h2>重抽最多 2 张</h2>' +
      '</div>' +
      '<p class="modal-lesson">把不想要的开局牌换回牌库。重抽只有这一次，之后整场比赛不会自动抽牌。</p>' +
      '<p class="mulligan-first">' + (m.firstSide === 'player' ? '本局你先手' : '本局对手先手') + '</p>' +
      '<div class="mull-grid">' + cards + '</div>' +
      '<p class="modal-tip">已选择 ' + selected.length + ' / 2 张</p>' +
      '<div class="modal-actions">' +
      '  <button class="ghost" data-action="mulligan-clear">清空</button>' +
      '  <button class="primary" data-action="mulligan-confirm">开始对局</button>' +
      '</div>';
  }

  function targetModalHTML() {
    const modal = app.modal;
    const def = card(modal.cardId);
    const options = modal.options.map(function (o, i) {
      return '<button class="target-option" data-action="target-pick" data-idx="' + i + '">' +
        '<span>' + esc(o.label) + '</span>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</button>';
    }).join('');
    return '' +
      '<div class="modal-head">' +
      '  <p class="modal-eyebrow">' + esc(typeLabel(def)) + ' · ' + esc(abilityLabel(def)) + '</p>' +
      '  <h2>' + esc(def.name) + '</h2>' +
      '</div>' +
      '<p class="modal-lesson">' + esc(modal.prompt) + '</p>' +
      '<div class="target-list">' + options + '</div>' +
      '<div class="modal-actions"><button class="ghost" data-action="modal-close">取消</button></div>';
  }

  function roundModalHTML() {
    const m = app.match;
    const r = m.lastRound;
    const title = r.winner === 'draw' ? '小局平局' : r.winner === 'player' ? '你赢下这一局' : '对手赢下这一局';
    return '' +
      '<div class="modal-head">' +
      '  <p class="modal-eyebrow">第 ' + r.round + ' 小局结算</p>' +
      '  <h2>' + title + '</h2>' +
      '</div>' +
      '<div class="round-score">' +
      '  <div class="rs-side"><span>' + esc(DATA.AI_DECKS[app.stage.ai].name) + '</span><strong>' + r.aiScore + '</strong></div>' +
      '  <span class="rs-vs">:</span>' +
      '  <div class="rs-side"><span>你</span><strong>' + r.playerScore + '</strong></div>' +
      '</div>' +
      '<div class="round-seals">' +
      '  <div><span>对手印记</span>' + sealsHTML(r.seals.ai) + '</div>' +
      '  <div><span>你的印记</span>' + sealsHTML(r.seals.player) + '</div>' +
      '</div>' +
      '<div class="modal-actions"><button class="primary" data-action="round-continue">进入第 ' + (m.round + 1) + ' 小局</button></div>';
  }

  function rewardModalHTML() {
    const modal = app.modal;
    const options = modal.cards.map(function (id) {
      const def = card(id);
      const have = owned(id);
      return '' +
        '<button class="reward-card type-' + def.type + '" data-action="reward-pick" data-id="' + id + '">' +
        '  <span class="rc-type">' + esc(typeLabel(def)) + ' · ' + esc(abilityLabel(def) || '—') + '</span>' +
        '  <span class="rc-name">' + esc(def.name) + '</span>' +
        '  <span class="rc-text">' + esc(def.text) + '</span>' +
        '  <span class="rc-have">已拥有 ' + have + ' / ' + DATA.maxCopies(id) + '</span>' +
        '</button>';
    }).join('');
    return '' +
      '<div class="modal-head">' +
      '  <p class="modal-eyebrow">首通奖励 · ' + app.stage.id + '</p>' +
      '  <h2>选择一张新卡</h2>' +
      '</div>' +
      '<p class="modal-lesson">' + (modal.cards.length > 1
        ? '没有选走的牌不会消失，重复挑战这一关还能继续选择。'
        : '选择后直接加入收藏，可以立刻编入牌组。') + '</p>' +
      ((app.fixedGained && app.fixedGained.length)
        ? '<p class="modal-tip">固定奖励已发放：' + app.fixedGained.map(function (c) { return esc(c.name); }).join('、') + '</p>'
        : '') +
      '<div class="reward-list">' + options + '</div>' +
      '<div class="modal-actions"><button class="ghost" data-action="reward-skip">稍后再选</button></div>';
  }

  function newDeckModalHTML() {
    const factions = ['geometry', 'logic'].filter(function (f) {
      return app.profile.unlockedFactions[f];
    });
    const chosen = app.newDeckFaction || (activeDeck() ? activeDeck().faction : 'geometry');
    return '' +
      '<div class="modal-head"><p class="modal-eyebrow">最多 3 套自建牌组</p><h2>新建牌组</h2></div>' +
      '<label class="field-label">牌组名<input id="new-deck-name" class="text-input" maxlength="16" value="新牌组"></label>' +
      '<p class="field-label">主阵营</p>' +
      '<div class="faction-pick">' + factions.map(function (f) {
        return '<button class="faction-option ' + (f === chosen ? 'active' : '') + '" data-action="new-deck-faction" data-faction="' + f + '">' +
          '<strong>' + esc((DATA.FACTIONS[f] || {}).name || f) + '</strong>' +
          '<small>' + (f === 'logic' ? '逻辑与集合 · 控制与推论' : '几何学派 · 共证与联动') + '</small></button>';
      }).join('') + '</div>' +
      '<p class="modal-tip">新牌组从 0 张开始，需要自己加入 25 张合法卡牌。</p>' +
      '<div class="modal-actions"><button class="ghost" data-action="modal-close">取消</button>' +
      '<button class="primary" data-action="create-deck">创建</button></div>';
  }

  function renameModalHTML() {
    const deck = activeDeck();
    return '' +
      '<div class="modal-head"><p class="modal-eyebrow">当前牌组</p><h2>重命名</h2></div>' +
      '<label class="field-label">牌组名<input id="rename-deck-name" class="text-input" maxlength="16" value="' + esc(deck ? deck.name : '') + '"></label>' +
      '<div class="modal-actions"><button class="ghost" data-action="modal-close">取消</button>' +
      '<button class="primary" data-action="rename-deck-confirm">保存</button></div>';
  }

  function cardDetailHTML(cardId) {
    const def = card(cardId);
    if (!def) return '<p class="empty-state">卡牌不存在。</p>';
    const have = owned(def.id);
    const inDecks = app.profile.decks.map(function (d) {
      const count = META.deckCounts(d)[def.id] || 0;
      return count ? d.name + ' ×' + count : null;
    }).filter(Boolean);
    return '' +
      '<div class="card-detail-head">' +
      '  <div class="card-art faction-' + def.faction + ' type-' + def.type + (def.ability === 'master' ? ' master' : '') + '">' +
      '    <span>' + esc((DATA.FACTIONS[def.faction] || {}).mark || '∴') + '</span>' +
      '  </div>' +
      '  <div>' +
      '    <p class="modal-eyebrow">' + esc(typeLabel(def)) + ' · ' + esc((DATA.FACTIONS[def.faction] || {}).name || def.faction) + '</p>' +
      '    <h2>' + esc(def.name) + '</h2>' +
      '    <p class="cc-meta">' + esc(cardMeta(def)) + (abilityLabel(def) ? ' · ' + abilityLabel(def) : '') + '</p>' +
      '    <p class="card-badges">' + (def.ability === 'master' ? '<span class="gold-badge">巨匠</span>' : '') + negatableBadge(def) + '</p>' +
      '  </div>' +
      '</div>' +
      '<p class="modal-lesson">' + esc(def.text) + '</p>' +
      '<div class="modal-grid">' +
      '  <div><span class="mg-label">拥有</span><span class="mg-value">' + have + ' / ' + DATA.maxCopies(def.id) + '</span></div>' +
      '  <div><span class="mg-label">牌组</span><span class="mg-value">' + (inDecks.length ? esc(inDecks.join(' · ')) : '未编入') + '</span></div>' +
      '  <div><span class="mg-label">获取来源</span><span class="mg-value">' + esc(sourceLabel(def)) + '</span></div>' +
      '  <div><span class="mg-label">商店等级</span><span class="mg-value">' + esc(def.shopTier || '—') + (def.shop ? ' · 可出售' : ' · 不出售') + '</span></div>' +
      '</div>' +
      '<div class="modal-actions"><button class="primary" data-action="modal-close">关闭</button></div>';
  }

  function openCardDetail(cardId) {
    app.modal = { type: 'card', cardId: cardId };
    renderOverlay();
  }

  function resultModalHTML() {
    const m = app.match;
    const res = m ? m.result : null;
    if (!res) return '<p class="empty-state">没有结算数据。</p>';
    const title = res.winner === 'draw' ? '平局' : res.winner === 'player' ? '你赢了' : '你输了';
    const gained = app.rewardGained;
    const more = app.stage ? META.hasReward(app.profile, app.stage.id) : false;
    return '' +
      '<div class="modal-head">' +
      '  <p class="modal-eyebrow">' + app.stage.id + ' · ' + esc(app.stage.name) + '</p>' +
      '  <h2 class="result-title ' + res.winner + '">' + title + '</h2>' +
      '</div>' +
      (app.stageGold ? '<div class="gained"><span>金币 · 已获得</span><strong>+' + app.stageGold + ' 学术金币</strong><small>当前金币 ' + app.profile.gold + '</small></div>' : '') +
      (app.stageFreeRefresh ? '<p class="modal-tip">获得 1 次免费商店刷新。商店不会自动换货。</p>' : '') +
      '<div class="final-score">' +
      '  <span class="fs-side">你</span><strong>' + res.playerSeals + '</strong>' +
      '  <span class="fs-colon">:</span>' +
      '  <strong>' + res.aiSeals + '</strong><span class="fs-side">对手</span>' +
      '</div>' +
      '<p class="final-label">真理印记</p>' +
      '<p class="modal-lesson">' + (res.winner === 'player'
        ? '对手的印记归零，这一课通过。'
        : res.winner === 'draw'
          ? '双方同时失去最后一枚印记，整场平局。'
          : '你的印记归零。调整牌组，或者换一种投入节奏再来一次。') + '</p>' +
      (app.fixedGained && app.fixedGained.length
        ? '<div class="gained"><span>固定奖励 · 已获得</span><strong>' + app.fixedGained.map(function (c) { return esc(c.name); }).join('、') + '</strong><small>已加入收藏，可以编入牌组。</small></div>'
        : '') +
      (gained ? '<div class="gained"><span>已获得</span><strong>' + esc(gained.name) + '</strong><small>' + esc(gained.text) + '</small></div>' : '') +
      (app.paradoxUnlocked && app.paradoxUnlocked.length
        ? '<div class="gained paradox-unlock"><span>第一章通关 · 悖论解禁</span><strong>罗素悖论 · 芝诺困境 · 不完备性危机 · 说谎者悖论</strong><small>四种悖论已进入收藏，可在卡组编辑器中使用。</small></div>'
        : '') +
      (more && !gained ? '<p class="modal-tip">这一关还有未领取的奖励，重复挑战仍可选择。</p>' : '') +
      '<div class="modal-actions">' +
      '  <button class="ghost" data-action="battle-quit">返回课程</button>' +
      '  <button class="ghost" data-action="result-deck">编辑卡组</button>' +
      '  <button class="primary" data-action="battle-again">再来一局</button>' +
      '</div>';
  }

  /* ---------- 战斗流程 ---------- */

  function openStage(stageId) {
    app.modal = { type: 'stage', stageId: stageId };
    renderOverlay();
  }

  function beginBattle(stageId) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage) return;
    const check = META.validateDeck(app.profile);
    if (!check.ok) {
      toast(check.errors[0]);
      return;
    }
    clearAITimer();
    app.match = BATTLE.createMatch({
      playerDeck: activeDeck().cards,
      aiDeck: DATA.AI_DECKS[stage.ai].deck,
      seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
      stageId: stage.id,
      bossRule: stage.bossRule
    });
    app.stage = stage;
    app.playtestSession = createPlaytestSession(stage);
    app.matchEnded = false;
    app.rewardGained = null;
    app.fixedGained = [];
    app.paradoxUnlocked = null;
    app.stageGold = 0;
    app.stageFreeRefresh = false;
    app.mulliganSel = [];
    app.modal = { type: 'mulligan' };
    if (location.hash === '#battle') {
      app.screen = 'battle';
      render();
    } else {
      location.hash = '#battle';
    }
  }

  function confirmMulligan() {
    const m = app.match;
    if (!m || m.phase !== 'mulligan') return;
    const indices = app.mulliganSel.slice().sort(function (a, b) { return a - b; });
    if (indices.length) {
      const res = BATTLE.mulligan(m, 'player', indices);
      if (!res.ok) { toast(res.reason); return; }
    } else {
      BATTLE.mulligan(m, 'player', []);
    }
    AI.autoMulligan(m, 'ai');
    BATTLE.beginPlay(m);
    app.mulliganSel = [];
    app.modal = null;
    render();
    maybeAI();
  }

  function handCard(index) {
    if (!canAct()) {
      toast(app.match && app.match.player.passed ? '你已经 Pass 了' : '现在不是你的回合');
      return;
    }
    const id = app.match.player.hand[index];
    const def = card(id);
    if (!def) return;
    if (def.type === 'unit' || def.ability === 'reductio' || def.ability === 'consensus' ||
        def.ability === 'draw' || def.ability === 'negate') {
      playPlayer(index, {});
      return;
    }
    const target = buildTargets(def);
    if (!target) {
      toast(targetReason(def));
      return;
    }
    app.modal = {
      type: 'target',
      index: index,
      cardId: id,
      prompt: target.prompt,
      options: target.options
    };
    renderOverlay();
  }

  function targetReason(def) {
    if (def.ability === 'citation') return '弃牌堆里还没有可引证的单位';
    if (def.ability === 'withdraw') return '场上没有可撤回的单位';
    if (def.ability === 'clarify') return '没有需要澄清的悖论';
    if (def.ability === 'negate') return '对方最近没有可以否定的策略牌';
    if (def.ability === 'diagonal') return '对方没有一排达到 3 个单位';
    if (def.ability === 'axiomatize') return '场上没有可以公理化的普通单位';
    return '现在不能打出这张牌';
  }

  function buildTargets(def) {
    const m = app.match;
    if (def.ability === 'counterexample') {
      return {
        prompt: '选择对方的一排，放置 1 点「反例」，然后抽 1 张牌。',
        options: BATTLE.ROWS.map(function (row) {
          return {
            row: row,
            label: '对手 · ' + ROW_LABELS[row],
            sub: '该排当前 ' + BATTLE.calculateRowScore(m, 'ai', row) + ' 点'
          };
        })
      };
    }
    if (def.ability === 'citation') {
      const options = [];
      m.player.discard.forEach(function (id, i) {
        const d = card(id);
        if (!d || d.type !== 'unit' || d.token) return;
        options.push({
          discardIndex: i,
          label: d.name + '（' + d.power + ' 点）',
          sub: '回到' + ROW_LABELS[d.row]
        });
      });
      if (!options.length) return null;
      return { prompt: '选择弃牌堆中的一张单位，直接放回它所在的排。', options: options };
    }
    if (def.ability === 'withdraw') {
      const options = [];
      BATTLE.ROWS.forEach(function (row) {
        m.player.board[row].forEach(function (u) {
          const d = card(u.id);
          if (d.ability === 'master' || d.token) return;
          options.push({
            unitUid: u.uid,
            label: d.name + '（' + BATTLE.unitPower(m, 'player', u) + ' 点）',
            sub: ROW_LABELS[row] + ' · 收回手牌'
          });
        });
      });
      if (!options.length) return null;
      return { prompt: '选择己方一张单位收回手牌。', options: options };
    }
    if (def.ability === 'clarify') {
      const options = BATTLE.ROWS.filter(function (row) { return !!m.effects[row]; })
        .map(function (row) {
          return {
            row: row,
            label: ROW_LABELS[row] + ' · ' + effectLabel(m.effects[row]),
            sub: '解除该排悖论'
          };
        });
      if (!options.length) return null;
      return { prompt: '选择要解除悖论的一排。', options: options };
    }
    if (def.ability === 'paradox') {
      return {
        prompt: '选择一排，对双方该排单位施加悖论。',
        options: BATTLE.ROWS.map(function (row) {
          return {
            row: row,
            label: ROW_LABELS[row],
            sub: '你 ' + BATTLE.calculateRowScore(m, 'player', row) + ' / 对手 ' + BATTLE.calculateRowScore(m, 'ai', row)
          };
        })
      };
    }
    if (def.ability === 'diagonal') {
      const options = BATTLE.ROWS.filter(function (row) {
        return m.ai.board[row].length >= 3;
      }).map(function (row) {
        return {
          row: row,
          label: '对手 · ' + ROW_LABELS[row] + '（' + m.ai.board[row].length + ' 个单位）',
          sub: '在己方' + ROW_LABELS[row] + '生成 3 点自指命题'
        };
      });
      if (!options.length) return null;
      return { prompt: '选择对方铺满三单位的一排。', options: options };
    }
    if (def.ability === 'axiomatize') {
      const options = [];
      BATTLE.ROWS.forEach(function (row) {
        m.player.board[row].forEach(function (u) {
          const d = card(u.id);
          if (d.ability === 'master' || u.axiomized) return;
          options.push({
            unitUid: u.uid,
            label: d.name + '（' + BATTLE.unitPower(m, 'player', u) + ' 点）',
            sub: ROW_LABELS[row] + ' · 本小局不受悖论影响'
          });
        });
      });
      if (!options.length) return null;
      return { prompt: '选择一个普通单位，使其本小局不受悖论影响。', options: options };
    }
    return null;
  }

  function playPlayer(index, opts) {
    const m = app.match;
    const cardId = m.player.hand[index];
    const def = card(cardId);
    const res = BATTLE.playCard(m, 'player', index, opts);
    if (!res.ok) { toast(res.reason); return; }
    notePlayerPlay(def);
    app.modal = null;
    afterAction();
  }

  function passPlayer() {
    if (!canAct()) return;
    const res = BATTLE.pass(app.match, 'player');
    if (!res.ok) { toast(res.reason); return; }
    notePlayerPass();
    app.modal = null;
    afterAction();
  }

  function afterAction() {
    const m = app.match;
    if (!m) return;
    captureRound();
    if (m.phase === 'roundEnd') {
      app.modal = { type: 'round' };
      render();
      return;
    }
    if (m.phase === 'matchEnd') {
      finishMatch();
      return;
    }
    render();
    maybeAI();
  }

  function maybeAI() {
    const m = app.match;
    if (!m || m.phase !== 'play' || m.current !== 'ai' || app.aiThinking) return;
    app.aiThinking = true;
    render();
    app.aiTimer = setTimeout(function () {
      app.aiTimer = null;
      app.aiThinking = false;
      const cur = app.match;
      if (!cur || cur.phase !== 'play' || cur.current !== 'ai') {
        render();
        return;
      }
      const res = AI.act(cur, 'ai', DATA.AI_PROFILES[app.stage.id]);
      if (!res.ok) {
        BATTLE.pass(cur, 'ai');
      } else if (res.action && res.action.type === 'play') {
        if (META.discoverCard(app.profile, res.action.cardId)) save();
      }
      captureRound();
      if (cur.phase === 'roundEnd') {
        app.modal = { type: 'round' };
        render();
        return;
      }
      if (cur.phase === 'matchEnd') {
        finishMatch();
        return;
      }
      render();
      maybeAI();
    }, app.aiDelay || 620);
  }

  function continueRound() {
    const m = app.match;
    if (!m || m.phase !== 'roundEnd') return;
    BATTLE.startNextRound(m);
    app.modal = null;
    render();
    maybeAI();
  }

  function finishMatch() {
    if (app.matchEnded) return;
    app.matchEnded = true;
    const m = app.match;
    if (!m || !m.result) return;
    captureRound();
    if (m.result.winner === 'player') {
      const clear = META.completeStage(app.profile, app.stage.id);
      app.stageGold = clear.gold;
      app.stageFreeRefresh = clear.freeRefresh;
      const fixed = META.claimFixedRewards(app.profile, app.stage.id);
      app.fixedGained = fixed.newly;
      if (app.stage.id === '1-10') app.paradoxUnlocked = META.unlockParadoxes(app.profile);
      save();
      const options = META.rewardOptions(app.profile, app.stage.id);
      if (options.length) {
        app.modal = { type: 'reward', stageId: app.stage.id, cards: options };
      } else {
        app.modal = { type: 'result' };
      }
    } else {
      app.modal = { type: 'result' };
    }

    const session = app.playtestSession;
    if (session && !session.finished) {
      session.finished = true;
      const record = {
        id: 'pt-' + Date.now() + '-' + app.stage.id,
        ts: Date.now(),
        stageId: app.stage.id,
        stageName: app.stage.name,
        result: m.result.winner,
        win: m.result.winner === 'player',
        rounds: m.result.rounds,
        seals: { player: m.result.playerSeals, ai: m.result.aiSeals },
        roundStats: session.rounds.slice(),
        deckAtStart: session.deckAtStart.slice(),
        deckAfter: (activeDeck() ? activeDeck().cards.slice() : []),
        durationMs: Date.now() - session.startedAt,
        fixedReward: (app.fixedGained || []).map(function (c) { return c.id; }),
        paradoxUnlocked: (app.paradoxUnlocked || []).slice(),
        reward: null
      };
      session.recordId = record.id;
      PLAYTEST.add(record);
    }
    render();
  }

  function claimReward(cardId) {
    const modal = app.modal;
    if (!modal || modal.type !== 'reward') return;
    const res = META.claimReward(app.profile, modal.stageId, cardId);
    if (!res.ok) { toast(res.reason); return; }
    app.rewardGained = res.card;
    save();
    if (app.playtestSession && app.playtestSession.recordId) {
      PLAYTEST.update(app.playtestSession.recordId, { reward: cardId });
    }
    app.modal = { type: 'result' };
    render();
  }

  function quitBattle() {
    clearAITimer();
    app.match = null;
    app.stage = null;
    app.playtestSession = null;
    app.modal = null;
    app.matchEnded = false;
    app.rewardGained = null;
    app.fixedGained = [];
    app.paradoxUnlocked = null;
    app.stageGold = 0;
    app.stageFreeRefresh = false;
    go('stages');
  }

  /* ---------- 交互 ---------- */

  function onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');

    if (action === 'nav-home') { go('home'); return; }
    if (action === 'nav-stages') { go('stages'); return; }
    if (action === 'nav-deck') { go('deck'); return; }
    if (action === 'nav-codex') { go('codex'); return; }
    if (action === 'nav-shop') { go('shop'); return; }
    if (action === 'nav-playtest') { go('playtest'); return; }
    if (action === 'card-detail') { openCardDetail(id); return; }
    if (action === 'switch-deck') {
      META.setActiveDeck(app.profile, id);
      save(); render(); return;
    }
    if (action === 'new-deck') {
      app.newDeckFaction = activeDeck() ? activeDeck().faction : 'geometry';
      app.modal = { type: 'newdeck' };
      renderOverlay(); return;
    }
    if (action === 'new-deck-faction') {
      app.newDeckFaction = el.getAttribute('data-faction');
      renderOverlay(); return;
    }
    if (action === 'create-deck') {
      const input = document.getElementById('new-deck-name');
      const res = META.createDeck(app.profile, { name: input ? input.value : '', faction: app.newDeckFaction });
      if (!res.ok) { toast(res.reason); return; }
      save();
      app.modal = null;
      render();
      toast('已创建「' + res.deck.name + '」');
      return;
    }
    if (action === 'rename-deck') {
      app.modal = { type: 'rename' };
      renderOverlay(); return;
    }
    if (action === 'rename-deck-confirm') {
      const input = document.getElementById('rename-deck-name');
      const res = META.renameDeck(app.profile, app.profile.activeDeckId, input ? input.value : '');
      if (!res.ok) { toast(res.reason); return; }
      save();
      app.modal = null;
      render(); return;
    }
    if (action === 'delete-deck') {
      if (!window.confirm('删除当前牌组？牌不会从收藏中消失。')) return;
      const res = META.deleteDeck(app.profile, app.profile.activeDeckId);
      if (!res.ok) { toast(res.reason); return; }
      save(); render(); return;
    }
    if (action === 'shop-buy') {
      const slot = Number(el.getAttribute('data-slot'));
      const res = SHOP.buyShopCard(app.profile, slot);
      if (!res.ok) { toast(res.reason); return; }
      save();
      render();
      toast('已获得「' + res.card.name + '」');
      return;
    }
    if (action === 'shop-refresh') {
      const res = SHOP.refreshShop(app.profile);
      if (!res.ok) { toast(res.reason); return; }
      save();
      render();
      toast(res.usedFree ? '免费刷新已使用 · 剩余 ' + res.freeRefreshes : '商店已刷新 · -' + res.cost + ' 金币');
      return;
    }
    if (action === 'clear-playtest') {
      if (!window.confirm('清空本地试玩记录？不会影响游戏存档。')) return;
      PLAYTEST.clear();
      render();
      toast('试玩记录已清空');
      return;
    }

    if (action === 'toggle-anim') {
      app.profile.settings.animations = !app.profile.settings.animations;
      save(); render(); return;
    }
    if (action === 'reset-save') {
      if (!window.confirm('确定清空 V2 存档？收藏、牌组与通关进度都会重置。旧版 V1 存档不受影响。')) return;
      app.profile = META.resetProfile();
      save();
      go('home');
      toast('已重置 V2 存档');
      return;
    }

    if (action === 'open-stage') {
      if (!META.isStageUnlocked(app.profile, id)) return;
      openStage(id); return;
    }
    if (action === 'modal-close' || action === 'reward-skip') {
      if (app.modal && app.modal.type === 'reward') {
        app.rewardGained = null;
        app.modal = { type: 'result' };
      } else if (app.modal && app.modal.type === 'target') {
        app.modal = null;
      } else {
        app.modal = null;
      }
      render(); return;
    }
    if (action === 'modal-deck') {
      app.modal = null;
      go('deck'); return;
    }
    if (action === 'begin-battle') { beginBattle(id); return; }

    if (action === 'deck-add') {
      const res = META.addCard(app.profile, id);
      if (!res.ok) { toast(res.reason); return; }
      save(); render(); return;
    }
    if (action === 'deck-remove') {
      const res = META.removeCard(app.profile, id);
      if (!res.ok) { toast(res.reason); return; }
      save(); render(); return;
    }

    if (action === 'mulligan-toggle') {
      const index = Number(el.getAttribute('data-index'));
      const at = app.mulliganSel.indexOf(index);
      if (at !== -1) app.mulliganSel.splice(at, 1);
      else {
        if (app.mulliganSel.length >= BATTLE.MULLIGAN_MAX) {
          toast('最多只能重抽 2 张');
          return;
        }
        app.mulliganSel.push(index);
      }
      renderOverlay(); return;
    }
    if (action === 'mulligan-clear') { app.mulliganSel = []; renderOverlay(); return; }
    if (action === 'mulligan-confirm') { confirmMulligan(); return; }

    if (action === 'target-pick') {
      const modal = app.modal;
      if (!modal || modal.type !== 'target') return;
      const opt = modal.options[Number(el.getAttribute('data-idx'))];
      if (!opt) return;
      const statics = ['row', 'discardIndex', 'unitUid'];
      const opts = {};
      statics.forEach(function (k) { if (opt[k] !== undefined) opts[k] = opt[k]; });
      playPlayer(modal.index, opts);
      return;
    }

    if (action === 'hand-card') {
      handCard(Number(el.getAttribute('data-index'))); return;
    }
    if (action === 'pass') { passPlayer(); return; }
    if (action === 'round-continue') { continueRound(); return; }
    if (action === 'battle-quit') {
      if (app.match && app.match.phase === 'play' && !window.confirm('离开对局？本局进度不会保存。')) return;
      quitBattle(); return;
    }
    if (action === 'battle-again') {
      const stageId = app.stage.id;
      beginBattle(stageId); return;
    }
    if (action === 'result-deck') {
      clearAITimer();
      app.match = null;
      app.stage = null;
      app.playtestSession = null;
      app.modal = null;
      app.matchEnded = false;
      app.rewardGained = null;
      app.fixedGained = [];
      app.paradoxUnlocked = null;
      app.stageGold = 0;
      app.stageFreeRefresh = false;
      go('deck'); return;
    }
    if (action === 'reward-pick') { claimReward(id); return; }
  }

  function init() {
    app.profile = META.loadProfile() || META.defaultProfile();
    SHOP.ensureShop(app.profile);
    if (!META.saveProfile(app.profile)) { /* file:// 仍可能写入，失败就算了 */ }
    document.getElementById('app').addEventListener('click', onClick);
    document.getElementById('overlay-root').addEventListener('click', onClick);
    window.addEventListener('hashchange', route);
    if (!location.hash) location.hash = '#home';
    route();
  }

  window.TA_UI_INTERNAL = { init: init };
  window.TA_UI = {
    app: app,
    render: render,
    route: route,
    go: go,
    openStage: openStage,
    beginBattle: beginBattle,
    claimReward: claimReward,
    quitBattle: quitBattle,
    toast: toast
  };
})();
