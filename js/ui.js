/* 《真理学院》界面层。 */
(function () {
  'use strict';

  const DATA = window.TA_DATA;
  const BATTLE = window.TA_BATTLE;
  const META = window.TA_META;

  const app = {
    profile: null,
    battle: null,
    screen: 'home',
    selectedStage: '1-1',
    teamSlot: 0,
    codexTab: 'scholars',
    detailScholar: null,
    targeting: null,
    selectedScholarUid: null,
    resultApplied: false,
    lastResult: null,
    lastPullCount: 1,
    introShown: false,
    scrollTop: false
  };

  /* ---------- 小工具 ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtFormula(s) {
    return esc(s)
      .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
      .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  }

  function tagPill(tag) {
    return '<span class="tag">[' + DATA.TAGS[tag].name + ']</span>';
  }

  function methodPill(method) {
    const m = DATA.METHODS[method];
    if (!m) return '';
    return '<span class="method-pill"><span class="m-glyph" style="color:' + m.color + '">' +
      m.glyph + '</span>' + m.name + '</span>';
  }

  function rarityBadge(r) {
    return '<span class="rarity rarity-' + r + '">' + r + '</span>';
  }

  function schoolName(school) {
    return DATA.SCHOOLS[school] ? DATA.SCHOOLS[school].name : '';
  }

  function sigilColor(def) {
    return def.color || 'var(--chalk)';
  }

  function hpBar(unit) {
    const pct = Math.max(0, Math.min(100, unit.hp / unit.maxHp * 100));
    return '<div class="hp-bar ' + (pct < 30 ? 'low' : '') + '"><span style="width:' + pct + '%"></span>' +
      '<div class="hp-text">' + Math.max(0, unit.hp) + ' / ' + unit.maxHp + '</div></div>';
  }

  function statusChips(unit) {
    if (!unit.statuses || !unit.statuses.length) return '';
    return unit.statuses.map(function (s) {
      const meta = DATA.STATUSES[s.id];
      if (!meta) return '';
      let v = '';
      if (s.value && (s.id === 'vuln' || s.id === 'atkUp' || s.id === 'atkDown' || s.id === 'defUp' || s.id === 'defDown')) {
        v = ' ' + Math.round(s.value * 100) + '%';
      } else if (s.value && s.id === 'charge') {
        v = ' +' + Math.round(s.value * 100) + '%';
      }
      return '<span class="status-chip ' + meta.kind + '" title="' + esc(meta.desc) + '">' +
        meta.icon + ' ' + meta.name + v + '·' + s.turns + '</span>';
    }).join('');
  }

  function toast(msg, kind) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, 2100);
  }

  function save() {
    META.saveProfile(app.profile);
  }

  /* ---------- 音效 ---------- */

  const Sound = {
    ctx: null,
    init: function () {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
    },
    tone: function (freq, dur, type, vol, delay) {
      if (!app.profile || !app.profile.settings.sound) return;
      this.init();
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.045, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    click: function () { this.tone(520, 0.045, 'triangle', 0.025); },
    chalk: function () { this.tone(780, 0.05, 'sine', 0.02); this.tone(1040, 0.04, 'sine', 0.012, 0.03); },
    hit: function () { this.tone(120, 0.12, 'sawtooth', 0.035); },
    heal: function () { this.tone(660, 0.16, 'sine', 0.035); this.tone(880, 0.18, 'sine', 0.025, 0.07); },
    theorem: function () {
      this.tone(523.25, 0.24, 'triangle', 0.04);
      this.tone(659.25, 0.28, 'triangle', 0.035, 0.08);
      this.tone(783.99, 0.42, 'triangle', 0.03, 0.16);
    },
    win: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        Sound.tone(f, 0.34, 'triangle', 0.035, i * 0.1);
      });
    },
    lose: function () { this.tone(220, 0.5, 'sine', 0.04); this.tone(164.8, 0.6, 'sine', 0.03, 0.18); },
    pull: function () {
      this.tone(392, 0.16, 'triangle', 0.03);
      this.tone(587.33, 0.2, 'triangle', 0.035, 0.08);
      this.tone(880, 0.3, 'triangle', 0.03, 0.16);
    }
  };

  /* ---------- 纹章 ---------- */

  function polyPoints(n, r, cx, cy, rot) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i / n) + (rot || 0) - Math.PI / 2;
      pts.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }

  function spiralPath(cx, cy, turns, r0, r1) {
    let d = '';
    const steps = 150;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * Math.PI * 2 * turns;
      const r = r0 + (r1 - r0) * t;
      const x = (cx + r * Math.cos(a)).toFixed(2);
      const y = (cy + r * Math.sin(a)).toFixed(2);
      d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
    }
    return d;
  }

  function cardioidPath() {
    let d = '';
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI * 2 * i / steps;
      const r = 13 * (1 - Math.sin(a));
      const x = (50 + r * Math.cos(a)).toFixed(2);
      const y = (46 + r * Math.sin(a)).toFixed(2);
      d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
    }
    return d + 'Z';
  }

  function pascalDots() {
    let out = '';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        const x = 50 + (col - row / 2) * 11;
        const y = 30 + row * 11;
        out += '<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="2.1" fill="currentColor" stroke="none" opacity=".8"/>';
        if (col < row) {
          out += '<line x1="' + x.toFixed(1) + '" y1="' + y + '" x2="' + (x + 5.5).toFixed(1) + '" y2="' + (y + 11) + '" opacity=".25"/>';
          out += '<line x1="' + x.toFixed(1) + '" y1="' + y + '" x2="' + (x - 5.5).toFixed(1) + '" y2="' + (y + 11) + '" opacity=".25"/>';
        }
      }
    }
    return out;
  }

  function sigilMarkup(id) {
    const open = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    let body = '';

    switch (id) {
      case 'euler':
        body = '<circle cx="50" cy="50" r="31" opacity=".85"/>' +
          '<circle cx="50" cy="50" r="22" opacity=".22"/>' +
          '<path d="M50 19 C 34 34 34 66 50 81 C 66 66 66 34 50 19" opacity=".55"/>' +
          '<line x1="19" y1="50" x2="81" y2="50" opacity=".28"/>' +
          '<line x1="50" y1="19" x2="50" y2="81" opacity=".28"/>' +
          '<circle cx="50" cy="50" r="2.6" fill="currentColor" stroke="none"/>';
        break;
      case 'gauss':
        body = '<polygon points="' + polyPoints(17, 31, 50, 50) + '" opacity=".55"/>' +
          '<polygon points="' + polyPoints(17, 19, 50, 50) + '" opacity=".22"/>' +
          '<path d="M17 81 C 31 81 31 58 50 58 C 69 58 69 81 83 81" opacity=".9"/>' +
          '<line x1="15" y1="81" x2="85" y2="81" opacity=".3"/>' +
          '<circle cx="50" cy="50" r="1.9" fill="currentColor" stroke="none"/>';
        break;
      case 'noether':
        body = '<circle cx="50" cy="50" r="31" opacity=".22"/>' +
          '<circle cx="50" cy="50" r="20"/>' +
          '<path d="M50 30 C 68 40 68 60 50 70 C 32 60 32 40 50 30" opacity=".8"/>' +
          '<path d="M50 30 C 68 40 68 60 50 70 C 32 60 32 40 50 30" transform="rotate(60 50 50)" opacity=".6"/>' +
          '<path d="M50 30 C 68 40 68 60 50 70 C 32 60 32 40 50 30" transform="rotate(120 50 50)" opacity=".6"/>' +
          '<circle cx="50" cy="50" r="2.4" fill="currentColor" stroke="none"/>';
        break;
      case 'ramanujan':
        body = '<path d="' + spiralPath(50, 50, 3.2, 2, 30) + '" opacity=".9"/>' +
          '<circle cx="50" cy="50" r="2.3" fill="currentColor" stroke="none"/>' +
          '<text x="50" y="94" text-anchor="middle" font-size="7.5" fill="currentColor" stroke="none" opacity=".6">1729</text>';
        break;
      case 'euclid':
        body = '<circle cx="40" cy="50" r="24" opacity=".75"/>' +
          '<circle cx="60" cy="50" r="24" opacity=".75"/>' +
          '<path d="M50 28 L 50 72 M50 28 L 40 50 M50 72 L 60 50" opacity=".55"/>' +
          '<line x1="50" y1="16" x2="50" y2="84" stroke-dasharray="2 4" opacity=".28"/>' +
          '<circle cx="50" cy="50" r="2.2" fill="currentColor" stroke="none"/>';
        break;
      case 'pythagoras':
        body = '<path d="M26 70 L 70 70 L 70 30 Z"/>' +
          '<path d="M26 70 L 48 70 L 48 92 L 26 92 Z" opacity=".35"/>' +
          '<path d="M70 48 L 92 48 L 92 26 L 70 26 Z" opacity=".35"/>' +
          '<path d="M26 70 L 70 70 L 70 30" stroke-width="1.8" opacity=".9"/>' +
          '<text x="48" y="62" text-anchor="middle" font-size="8" fill="currentColor" stroke="none" opacity=".8">a²+b²=c²</text>';
        break;
      case 'pascal':
        body = '<path d="M50 16 L 16 80 L 84 80 Z" opacity=".3"/>' + pascalDots();
        break;
      case 'descartes':
        body = '<line x1="12" y1="50" x2="88" y2="50" opacity=".3"/>' +
          '<line x1="50" y1="88" x2="50" y2="12" opacity=".3"/>' +
          '<path d="' + cardioidPath() + '" opacity=".9"/>' +
          '<circle cx="50" cy="50" r="2" fill="currentColor" stroke="none"/>' +
          '<line x1="50" y1="50" x2="72" y2="36" stroke-dasharray="2 3" opacity=".4"/>';
        break;
      case 'liar':
        body = '<path d="M16 24 h32 a7 7 0 0 1 7 7 v16 a7 7 0 0 1 -7 7 h-19 l-8 8 v-8 h-5 a7 7 0 0 1 -7 -7 v-16 a7 7 0 0 1 7 -7z" opacity=".85"/>' +
          '<path d="M47 43 h28 a6 6 0 0 1 6 6 v12 a6 6 0 0 1 -6 6 h-14 l-6 6 v-6 h-8 a6 6 0 0 1 -6 -6 v-12 a6 6 0 0 1 6 -6z" opacity=".4"/>' +
          '<path d="M28 34 l12 12 M40 34 l-12 12" opacity=".9"/>';
        break;
      case 'tortoise':
        body = '<ellipse cx="48" cy="57" rx="31" ry="20" opacity=".8"/>' +
          '<path d="' + spiralPath(48, 57, 2.2, 2, 17) + '" opacity=".7"/>' +
          '<circle cx="81" cy="49" r="7" opacity=".9"/>' +
          '<circle cx="83" cy="47" r="1.2" fill="currentColor" stroke="none"/>' +
          '<path d="M29 75 l-5 8 M42 78 l-3 8 M63 78 l3 8 M76 73 l6 7" opacity=".5"/>';
        break;
      case 'hotel':
        body = '<path d="M16 80 L 16 28 L 84 28 L 84 80" opacity=".35"/>' +
          '<path d="M26 80 L 26 40 L 74 40 L 74 80" opacity=".5"/>' +
          '<path d="M36 80 L 36 52 L 64 52 L 64 80" opacity=".65"/>' +
          '<path d="M16 80 L 84 80" opacity=".8"/>' +
          '<path d="M45 80 v-11 h10 v11" opacity=".9"/>' +
          '<line x1="50" y1="28" x2="50" y2="80" stroke-dasharray="2 5" opacity=".25"/>';
        break;
      case 'barber':
        body = '<circle cx="29" cy="74" r="8"/><circle cx="71" cy="74" r="8"/>' +
          '<line x1="35" y1="68" x2="75" y2="21"/><line x1="65" y1="68" x2="25" y2="21"/>' +
          '<circle cx="50" cy="44" r="2.4" fill="currentColor" stroke="none"/>' +
          '<path d="M43 20 h14" opacity=".35"/>';
        break;
      case 'berry':
        body = '<circle cx="50" cy="50" r="29" stroke-dasharray="2 5" opacity=".45"/>' +
          '<circle cx="50" cy="50" r="3" fill="currentColor" stroke="none"/>' +
          '<path d="M24 36 h8 M68 36 h8 M20 58 h6 M74 58 h6 M30 72 l4 4 M70 72 l-4 4" opacity=".45"/>' +
          '<text x="50" y="89" text-anchor="middle" font-size="8" fill="currentColor" stroke="none" opacity=".6">19 个字</text>';
        break;
      case 'simpson':
        body = '<path d="M15 70 C 32 64 42 55 56 49 C 68 44 78 38 85 31" opacity=".85"/>' +
          '<path d="M15 33 C 32 39 42 48 56 54 C 68 59 78 65 85 72" opacity=".45"/>' +
          '<circle cx="30" cy="61" r="2.3" fill="currentColor" stroke="none"/>' +
          '<circle cx="50" cy="52" r="2.3" fill="currentColor" stroke="none"/>' +
          '<circle cx="70" cy="43" r="2.3" fill="currentColor" stroke="none"/>' +
          '<line x1="50" y1="18" x2="50" y2="82" stroke-dasharray="2 4" opacity=".22"/>';
        break;
      case 'hanging':
        body = '<circle cx="50" cy="34" r="18"/>' +
          '<line x1="50" y1="16" x2="50" y2="34" opacity=".7"/>' +
          '<line x1="50" y1="34" x2="61" y2="40"/>' +
          '<line x1="50" y1="34" x2="45" y2="48"/>' +
          '<line x1="50" y1="52" x2="50" y2="74" opacity=".7"/>' +
          '<circle cx="50" cy="78" r="4" opacity=".8"/>' +
          '<path d="M34 88 h32" opacity=".3"/>';
        break;
      case 'empty_set':
        body = '<circle cx="50" cy="50" r="27" opacity=".85"/>' +
          '<line x1="31" y1="31" x2="69" y2="69" stroke-width="2"/>' +
          '<circle cx="50" cy="50" r="12" stroke-dasharray="1 4" opacity=".3"/>';
        break;
      case 'recursion':
        body = '<path d="M50 18 a32 32 0 1 1 -23 9" opacity=".85"/>' +
          '<path d="M27 17 l0 10 10 0" opacity=".85"/>' +
          '<path d="M50 33 a17 17 0 1 0 12 6" opacity=".4"/>' +
          '<path d="M62 33 l0 6 -6 0" opacity=".4"/>';
        break;
      case 'russell':
        body = '<circle cx="50" cy="50" r="30" opacity=".85"/>' +
          '<circle cx="50" cy="50" r="16" opacity=".45"/>' +
          '<path d="M38 38 C 45 45 55 55 62 62" opacity=".8"/>' +
          '<path d="M62 62 l-8 1 1-8" opacity=".8"/>' +
          '<text x="50" y="92" text-anchor="middle" font-size="10" fill="currentColor" stroke="none" opacity=".55">?</text>';
        break;
      default:
        body = '<circle cx="50" cy="50" r="28" opacity=".6"/><path d="M36 50 h28 M50 36 v28" opacity=".4"/>';
    }
    return open + body + '</svg>';
  }

  function sigil(id, color, sizeClass) {
    return '<span class="sigil ' + (sizeClass || '') + '" style="color:' + esc(color) + '">' + sigilMarkup(id) + '</span>';
  }

  /* ---------- 顶栏 ---------- */

  function topbar(active) {
    const p = app.profile;
    const items = [
      ['home', '学院'],
      ['map', '课程'],
      ['team', '编队'],
      ['gacha', '召唤'],
      ['codex', '图鉴']
    ];
    const nav = items.map(function (it) {
      return '<button class="nav-btn ' + (active === it[0] ? 'active' : '') + '" data-action="nav" data-screen="' + it[0] + '"' +
        (active === it[0] ? ' aria-current="page"' : '') + '>' + it[1] + '</button>';
    }).join('');
    return '<header class="topbar">' +
      '<button class="brand" data-action="nav" data-screen="home" aria-label="返回学院">' +
      '<span class="brand-mark">Σ</span><span class="brand-name">真理学院</span>' +
      '</button>' +
      '<nav class="nav" aria-label="主导航">' + nav + '</nav>' +
      '<div class="resources">' +
      '<span class="res insp" title="灵感：用于召唤"><span class="glyph">✦</span><b>' + p.inspiration + '</b></span>' +
      '<span class="res notes" title="讲义：用于升级"><span class="glyph">✎</span><b>' + p.notes + '</b></span>' +
      '<span class="res manu" title="手稿：用于突破"><span class="glyph">▤</span><b>' + p.manuscripts + '</b></span>' +
      '<button class="icon-btn" data-action="nav" data-screen="settings" title="设置" aria-label="设置">⚙</button>' +
      '</div></header>';
  }

  function screenHead(eyebrow, title, sub, right) {
    return '<div class="page-head"><div><div class="eyebrow">' + eyebrow + '</div><h1 class="page-title">' +
      title + '</h1><div class="page-sub">' + (sub || '') + '</div></div><div>' + (right || '') + '</div></div>';
  }

  function avgTeamLevel() {
    const members = META.teamMembers(app.profile);
    if (!members.length) return 0;
    return Math.round(members.reduce(function (s, m) { return s + m.level; }, 0) / members.length);
  }

  /* ---------- 主页 ---------- */

  function renderHome() {
    const p = app.profile;
    const bestId = META.bestStage(p);
    const best = DATA.STAGE_MAP[bestId];
    const stars = META.totalStars(p);
    const cleared = DATA.STAGES.filter(function (s) { return (p.stageStars[s.id] || 0) > 0; }).length;
    const done = !!p.flags.chapterDone;
    const dots = DATA.STAGES.map(function (s) {
      const st = p.stageStars[s.id] || 0;
      return '<span class="pdot ' + (st > 0 ? 'cleared' : '') + ' ' + (s.id === bestId && st === 0 ? 'current' : '') +
        '" title="' + s.id + ' ' + esc(s.name) + '">' + (st > 0 ? '★' : String(s.index).padStart(2, '0')) + '</span>';
    }).join('');

    const tips = [
      '每回合 3 点行动力；公式 1 点，公理 2 点。',
      '两名不同学者的公式按标签接续，就能合成定理。',
      '战斗前先看敌人的弱点：演绎、计算、构造，各有克制。',
      'Boss 的悖论护盾只吃「定理」伤害；普通公式只能刮掉一半。',
      '重复学者会转化为顿悟，每级 +6% 生命、攻击与防御。'
    ];
    const tip = p.flags.tutorialSeen ? tips[p.gacha.totalPulls % tips.length] : '第一次上课？让两名学者先后打出公式，看看会发生什么。';

    return '<div class="screen">' + topbar('home') +
      '<section class="hero panel">' +
      '<div class="hero-copy">' +
      '<div class="eyebrow">第一章 · 悖论裂缝</div>' +
      '<h1 class="hero-title"><span class="accent">真理</span>学院</h1>' +
      '<p class="hero-lede">康托尔失踪的第七天，黑板开始自己写字。<br>第一行是：「这句话是假的。」</p>' +
      '<div class="hero-meta">' +
      '<span>课程 <b>' + cleared + '</b> / ' + DATA.STAGES.length + '</span>' +
      '<span>星章 <b>' + stars + '</b> / ' + (DATA.STAGES.length * 3) + '</span>' +
      '<span>队伍战力 <b>' + META.teamPower(p) + '</b></span>' +
      '</div>' +
      '<div class="cta-row">' +
      '<button class="btn primary" data-action="continue">' + (done ? '重访第一章' : '继续授课 · ' + bestId) + '</button>' +
      '<button class="btn ghost" data-action="nav" data-screen="team">调整编队</button>' +
      '</div>' +
      '</div>' +
      '<div class="hero-art">' +
      '<span class="sigil hero-sigil" style="color:var(--gold)">' + sigilMarkup('euler') + '</span>' +
      '<div class="hero-formula">e<sup>iπ</sup> + 1 = 0</div>' +
      '</div>' +
      '</section>' +
      '<div class="home-grid">' +
      '<section class="panel chapter-card">' +
      '<div class="panel-head"><h3>第一章 · 悖论裂缝</h3><small>' + (done ? '已完成' : '进行中') + '</small></div>' +
      '<div class="progress-dots">' + dots + '</div>' +
      '<div class="progress-bar"><span style="width:' + Math.round(cleared / DATA.STAGES.length * 100) + '%"></span></div>' +
      '<div class="chapter-line" style="margin-top:10px"><span>下一课 · ' + esc(best.name) + '</span><span>' + esc(best.subtitle) + '</span></div>' +
      '</section>' +
      '<button class="panel quick-card" data-action="nav" data-screen="gacha">' +
      '<span class="quick-glyph">✦</span><div><h4>在无穷里点名</h4><p>消耗灵感，从无限集中召回新的学者。<br>十连至少一名 SR。</p></div>' +
      '</button>' +
      '<button class="panel quick-card" data-action="nav" data-screen="codex">' +
      '<span class="quick-glyph">∎</span><div><h4>定理与悖论</h4><p>已发现 ' + p.discovered.length + ' / ' + DATA.RECIPES.length +
      ' 条定理。<br>翻翻看还有哪些没被证明。</p></div>' +
      '</button>' +
      '</div>' +
      '<section class="panel home-team">' +
      '<div class="home-team-row">' + META.teamMembers(p).map(function (m) {
        const def = DATA.SCHOLAR_MAP[m.id];
        const st = META.statsFor(p, m.id);
        return '<button class="home-scholar" data-action="scholar-detail" data-id="' + m.id + '">' +
          sigil(def.sigil, def.color) + '<span><b>' + esc(def.name) + '</b><small>Lv.' + m.level + ' · ' + schoolName(def.school) + ' · 战力 ' + (st ? Math.round(st.atk * 2 + st.hp / 6 + st.def * 3) : 0) + '</small></span></button>';
      }).join('') + '</div>' +
      '<div class="home-team-aside"><span class="section-label">讲师提示</span>' + esc(tip) + '</div>' +
      '<button class="btn ghost small" data-action="nav" data-screen="team">调整编队</button>' +
      '</section>' +
      '</div>';
  }

  /* ---------- 地图 ---------- */

  function stageKindLabel(kind) {
    if (kind === 'elite') return '精英课程';
    if (kind === 'boss') return '终局课程';
    return '课程';
  }

  function starsMarkup(stars) {
    let out = '';
    for (let i = 1; i <= 3; i++) out += '<span class="' + (i <= stars ? '' : 'off') + '">★</span>';
    return out;
  }

  function renderMap() {
    const p = app.profile;
    const selectedId = DATA.STAGE_MAP[app.selectedStage] ? app.selectedStage : META.bestStage(p);
    app.selectedStage = selectedId;
    const stage = DATA.STAGE_MAP[selectedId];
    const unlocked = META.isStageUnlocked(p, selectedId);
    const stars = p.stageStars[selectedId] || 0;
    const bestId = META.bestStage(p);

    const nodes = DATA.STAGES.map(function (s) {
      const st = p.stageStars[s.id] || 0;
      const open = META.isStageUnlocked(p, s.id);
      const cls = [
        'map-node',
        s.kind === 'elite' ? 'kind-elite' : '',
        s.kind === 'boss' ? 'kind-boss' : '',
        st > 0 ? 'cleared' : '',
        s.id === bestId && st === 0 ? 'current' : '',
        s.id === selectedId ? 'active' : '',
        open ? '' : 'locked'
      ].join(' ');
      return '<button class="' + cls + '" data-action="select-stage" data-id="' + s.id + '"' + (open ? '' : ' disabled') + '>' +
        '<span class="node-dot">' + (st > 0 ? '★' : String(s.index).padStart(2, '0')) + '</span>' +
        '<span class="node-copy"><b>' + esc(s.name) + '</b><small>' + stageKindLabel(s.kind) + ' · Lv.' + s.rec +
        (open ? '' : ' · 未解锁') + '</small></span>' +
        '<span class="node-stars">' + starsMarkup(st) + '</span>' +
        '</button>';
    }).join('');

    const enemyPreview = stage.enemyIds.map(function (id) {
      const e = DATA.ENEMY_MAP[id];
      return '<div class="enemy-mini">' + sigil(e.sigil, e.color) + '<span>' + esc(e.name) +
        '<br><small class="muted">Lv.' + stage.level + '</small></span></div>';
    }).join('');

    const story = (stars > 0 && stage.storyAfter) ? stage.storyAfter : stage.storyBefore;
    const storyLabel = (stars > 0 && stage.storyAfter) ? '课后' : '课前';

    const objectives = [
      { text: '完成授课', done: stars >= 1 },
      { text: '无人倒下', done: stars >= 2 },
      { text: '≤ ' + stage.par + ' 回合内完成', done: stars >= 3 }
    ];
    const objHtml = objectives.map(function (o) {
      return '<li class="' + (o.done ? 'done' : '') + '">' + o.text + (o.done ? ' ✓' : '') + '</li>';
    }).join('');

    const rew = stage.rewards;
    const first = stars === 0;
    const baseRew = first ? rew.first : rew.repeat;
    const rewardHtml = '<span class="reward-chip insp">✦ 灵感 <b>' + baseRew.insp + '</b></span>' +
      '<span class="reward-chip">✎ 讲义 <b>' + baseRew.notes + '</b></span>' +
      (baseRew.manu ? '<span class="reward-chip">▤ 手稿 <b>' + baseRew.manu + '</b></span>' : '') +
      '<span class="reward-chip insp">每颗新星章 +<b>' + rew.perStar + '</b></span>';

    const team = META.teamMembers(p);
    const canStart = unlocked && team.length === 3;
    const avgLv = avgTeamLevel();
    const underLeveled = unlocked && avgLv < stage.rec - 1;

    return '<div class="screen">' + topbar('map') +
      screenHead('第一章 · 悖论裂缝', '课程表', '沿走廊向下，直到讲台。',
        '<div class="chapter-line" style="justify-content:flex-end"><span>星章 ' + META.totalStars(p) + ' / ' + (DATA.STAGES.length * 3) + '</span></div>') +
      '<div class="map-layout">' +
      '<section class="panel map-path" aria-label="章节地图">' + nodes + '</section>' +
      '<aside class="panel stage-detail">' +
      '<span class="stage-kind">' + stageKindLabel(stage.kind) + ' · ' + selectedId + '</span>' +
      '<h2>' + esc(stage.name) + '</h2>' +
      '<div class="stage-sub">' + esc(stage.subtitle) + '</div>' +
      '<div class="stage-story"><span class="section-label">' + storyLabel + '</span>' + esc(story) + '</div>' +
      '<div><div class="section-label">拦路的悖论</div><div class="enemy-preview">' + enemyPreview + '</div></div>' +
      '<div><div class="section-label">星章条件</div><ul class="objective-list">' + objHtml + '</ul></div>' +
      '<div><div class="section-label">课业奖励 · ' + (first ? '首通' : '重复授课') + '</div><div class="reward-row">' + rewardHtml + '</div></div>' +
      '<div class="chapter-line" style="border-top:1px dashed var(--chalk-faint);padding-top:10px">' +
      '<span>推荐等级 <b class="gold">Lv.' + stage.rec + '</b></span><span>队伍平均 <b>Lv.' + avgLv + '</b></span></div>' +
      (underLeveled ? '<div class="hint-box">队伍平均等级低于推荐等级。可以到「图鉴 → 学者」中消耗讲义升级，或先去刷前面的课程。</div>' : '') +
      '<button class="btn primary block" data-action="start-stage" data-id="' + stage.id + '"' + (canStart ? '' : ' disabled') + '>' +
      (unlocked ? '开始授课' : '先完成上一课') + '</button>' +
      (!unlocked ? '<div class="muted" style="font-size:10.5px;text-align:center">完成「' + esc(DATA.STAGES[stage.index - 2].name) + '」后解锁</div>' : '') +
      '</aside>' +
      '</div></div>';
  }

  /* ---------- 编队 ---------- */

  function ownedSorted() {
    const p = app.profile;
    return Object.keys(p.roster).map(function (id) { return DATA.SCHOLAR_MAP[id]; }).filter(Boolean)
      .sort(function (a, b) {
        const ra = DATA.RARITY[a.rarity].order;
        const rb = DATA.RARITY[b.rarity].order;
        if (ra !== rb) return rb - ra;
        return a.name.localeCompare(b.name, 'zh');
      });
  }

  function renderTeam() {
    const p = app.profile;
    const members = META.teamMembers(p);
    if (app.teamSlot < 0 || app.teamSlot > 2) app.teamSlot = 0;

    const slots = p.team.map(function (id, i) {
      const def = DATA.SCHOLAR_MAP[id];
      if (!def) return '';
      const st = META.statsFor(p, id);
      const member = p.roster[id];
      return '<button class="slot-card ' + (i === app.teamSlot ? 'selected' : '') + '" data-action="team-slot" data-index="' + i + '">' +
        sigil(def.sigil, def.color) +
        '<span><span class="slot-name">' + esc(def.name) + '</span><span class="slot-meta">Lv.' + member.level + ' · ' + schoolName(def.school) +
        ' · HP ' + st.hp + ' / ATK ' + st.atk + '</span></span>' +
        '<span class="slot-index">' + (i + 1) + '</span>' +
        '</button>';
    }).join('');

    const selectedId = p.team[app.teamSlot];
    const selectedDef = DATA.SCHOLAR_MAP[selectedId];
    const selectedStats = selectedId ? META.statsFor(p, selectedId) : null;

    const roster = ownedSorted().map(function (def) {
      const inTeam = p.team.indexOf(def.id) !== -1;
      const member = p.roster[def.id];
      return '<button class="roster-card ' + (inTeam ? 'in-team' : '') + '" data-action="pick-scholar" data-id="' + def.id + '" title="' +
        (inTeam ? '已在队伍中，点击切换选中位置' : '点击替换当前选中的位置') + '">' + sigil(def.sigil, def.color) +
        '<span class="rc-name">' + esc(def.name) + '</span>' +
        '<span class="rc-meta">' + rarityBadge(def.rarity) + '<span>Lv.' + member.level + '</span><span>顿悟 ' + member.dupes + '</span></span>' +
        '</button>';
    }).join('');

    const recipes = BATTLE.teamRecipePreview(p.team);
    const recipeHtml = recipes.length ? recipes.map(function (r) {
      const found = p.discovered.indexOf(r.id) !== -1;
      return '<div class="recipe-chip ' + (found ? '' : 'locked') + '">' +
        '<span class="rname">' + esc(r.name) + '</span>' +
        '<span class="rtags">' + r.tags.map(function (t) { return '[' + DATA.TAGS[t].name + ']'; }).join(' ') + ' · ' + (found ? '已发现' : '未发现') + '</span>' +
        '</div>';
    }).join('') : '<div class="combo-empty">这套编队暂时凑不出已知定理。试着换入标签互补的学者。</div>';

    return '<div class="screen">' + topbar('team') +
      screenHead('编队 · 三人讲堂', '选择你的学者', '同一回合里，用两名不同学者的公式接续，合成定理。',
        '<button class="btn ghost" data-action="nav" data-screen="map">前往课程</button>') +
      '<div class="team-layout">' +
      '<section class="panel team-slots">' +
      '<div class="panel-head"><h3>上场三人</h3><small>点击选择位置</small></div>' +
      '<div class="slots">' + slots + '</div>' +
      '<div class="team-power"><span>队伍战力</span><b>' + META.teamPower(p) + '</b></div>' +
      (selectedStats ? '<div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-top:10px">' +
        '<div class="stat-cell"><small>生命</small><b>' + selectedStats.hp + '</b></div>' +
        '<div class="stat-cell"><small>攻击</small><b>' + selectedStats.atk + '</b></div>' +
        '<div class="stat-cell"><small>防御</small><b>' + selectedStats.def + '</b></div>' +
        '</div>' : '') +
      '<div style="margin-top:16px"><div class="section-label">本队可合成定理 · ' + recipes.length + ' 条</div>' +
      '<div class="recipe-list">' + recipeHtml + '</div></div>' +
      '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
      (selectedDef ? '<button class="btn small ghost" data-action="scholar-detail" data-id="' + selectedDef.id + '">查看 ' + esc(selectedDef.name) + '</button>' : '') +
      '<button class="btn small primary" data-action="nav" data-screen="map">开始授课</button>' +
      '</div>' +
      '</section>' +
      '<section class="panel roster-panel">' +
      '<div class="panel-head"><h3>学者名册</h3><small>点击替换所选位置 · 共 ' + Object.keys(p.roster).length + ' 名</small></div>' +
      '<div class="roster-grid">' + roster + '</div>' +
      '<div class="tip-line" style="margin-top:16px">编队提示 · 公式上的标签决定它能接出什么。带 <span class="gold">[公理]</span> 与 <span class="gold">[比例]</span> 的公式可以合成「勾股定理」。</div>' +
      '</section>' +
      '</div></div>';
  }

  /* ---------- 图鉴 ---------- */

  function renderCodex() {
    const p = app.profile;
    const tabs = [
      ['scholars', '学者', Object.keys(p.roster).length + ' / ' + DATA.SCHOLARS.length],
      ['theorems', '定理', p.discovered.length + ' / ' + DATA.RECIPES.length],
      ['paradoxes', '悖论', p.seenEnemies.length + ' / ' + DATA.ENEMIES.length]
    ].map(function (t) {
      return '<button class="tab-btn ' + (app.codexTab === t[0] ? 'active' : '') + '" data-action="codex-tab" data-tab="' + t[0] + '">' +
        t[1] + ' <small>' + t[2] + '</small></button>';
    }).join('');

    let content = '';
    if (app.codexTab === 'theorems') {
      content = DATA.RECIPES.map(function (r) {
        const found = p.discovered.indexOf(r.id) !== -1;
        return '<div class="codex-card ' + (found ? 'discovered' : 'locked') + '">' +
          '<div class="cc-top"><h4>' + (found ? esc(r.name) : '未发现的定理') + '</h4>' +
          '<div class="tags">' + r.tags.map(function (t) { return '<span class="tag">[' + DATA.TAGS[t].name + ']</span>'; }).join('') + '</div></div>' +
          '<div class="formula">' + (found ? fmtFormula(r.formula) : '? ? ?') + '</div>' +
          '<p>' + (found ? esc(r.desc) : '在战斗中用两名不同学者的对应公式接续，即可证明它。') + '</p>' +
          (found ? '<p class="gold" style="font-family:var(--serif)">' + esc(r.flavor) + '</p>' : '') +
          '</div>';
      }).join('');
    } else if (app.codexTab === 'paradoxes') {
      content = DATA.ENEMIES.map(function (e) {
        const seen = p.seenEnemies.indexOf(e.id) !== -1;
        return '<div class="codex-card ' + (seen ? 'discovered' : 'locked') + '">' +
          '<div class="cc-top"><h4>' + (seen ? esc(e.name) : '未知悖论') + '</h4>' + (seen ? sigil(e.sigil, e.color) : '') + '</div>' +
          '<div class="formula">' + (seen ? esc(e.title) : '? ? ?') + '</div>' +
          '<p>' + (seen ? esc(e.desc) : '尚未在课程中遭遇。') + '</p>' +
          (seen ? '<p class="muted">基础生命 ' + e.hp + ' · 攻击 ' + e.atk + ' · 防御 ' + e.def + '</p>' : '') +
          '</div>';
      }).join('');
    } else {
      content = DATA.SCHOLARS.map(function (def) {
        const owned = !!p.roster[def.id];
        const member = p.roster[def.id];
        return '<div class="codex-card ' + (owned ? 'discovered' : 'locked') + '">' +
          '<div class="cc-top"><div style="display:flex;align-items:center;gap:9px">' +
          sigil(def.sigil, owned ? def.color : 'rgba(236,235,227,.3)') +
          '<div><h4>' + (owned ? esc(def.name) : '？？？') + '</h4><small class="muted">' + (owned ? esc(def.latin) : '未记录') + '</small></div></div>' +
          rarityBadge(def.rarity) + '</div>' +
          '<div class="formula">' + (owned ? schoolName(def.school) + ' · ' + esc(def.title) : '尚未召回') + '</div>' +
          '<p>' + (owned ? esc(def.quote) + '<br><span class="muted">Lv.' + member.level + ' · 顿悟 ' + member.dupes + '</span>' : '可以在「召唤」中尝试点名。') + '</p>' +
          (owned ? '<button class="btn small ghost" data-action="scholar-detail" data-id="' + def.id + '">查看详情</button>' : '') +
          '</div>';
      }).join('');
    }

    return '<div class="screen">' + topbar('codex') +
      screenHead('图鉴 · 无限集', '已被证明的与仍未证明的', '定理在战斗中被发现；悖论在课程中被记录。',
        '<div class="chapter-line" style="justify-content:flex-end"><span>星章 ' + META.totalStars(p) + '</span></div>') +
      '<div class="codex-tabs">' + tabs + '</div>' +
      '<div class="codex-scroll"><div class="codex-grid">' + content + '</div></div>' +
      '</div>';
  }

  /* ---------- 召唤 ---------- */

  function renderGacha() {
    const p = app.profile;
    const g = DATA.GACHA;
    const remain = Math.max(0, g.pity - p.gacha.sinceSSR);
    const pct = Math.min(100, p.gacha.sinceSSR / g.pity * 100);
    const featured = ['euler', 'gauss'].map(function (id) {
      const s = DATA.SCHOLAR_MAP[id];
      return '<div class="featured-card">' + sigil(s.sigil, s.color) + '<b>' + esc(s.name) + '</b><small>' + s.rarity + ' · ' + schoolName(s.school) + '</small></div>';
    }).join('');

    return '<div class="screen">' + topbar('gacha') +
      '<section class="panel gacha-banner">' +
      '<div class="gacha-copy">' +
      '<div class="eyebrow">常驻讲义 · 无限集</div>' +
      '<h2>在无穷里点名</h2>' +
      '<p>翻开一页讲义，把历史中的学者召回讲台。<br>他们带来的不是数值，而是可以互相接续的公式。</p>' +
      '<div class="cta-row">' +
      '<button class="btn primary" data-action="pull" data-count="10"' + (p.inspiration < g.tenCost ? ' disabled' : '') + '>十连讲授 · ' + g.tenCost + ' 灵感</button>' +
      '<button class="btn ghost" data-action="pull" data-count="1"' + (p.inspiration < g.cost ? ' disabled' : '') + '>单次讲授 · ' + g.cost + ' 灵感</button>' +
      '</div>' +
      '<div class="muted" style="font-size:10.5px;margin-top:10px">当前灵感 ' + p.inspiration + ' · 十连必得至少一名 SR</div>' +
      '</div>' +
      '<div class="featured">' + featured + '</div>' +
      '</section>' +
      '<div class="gacha-info">' +
      '<section class="panel gacha-rates">' +
      '<div class="panel-head"><h3>概率公示</h3><small>常驻池</small></div>' +
      '<div class="rate-line"><span>SSR · 传说</span><b style="color:var(--gold)">3%</b></div>' +
      '<div class="rate-line"><span>SR · 典藏</span><b style="color:var(--blue)">17%</b></div>' +
      '<div class="rate-line"><span>R · 讲义</span><b>80%</b></div>' +
      '<div class="rate-line"><span>十连保底</span><b>SR 或以上</b></div>' +
      '<div class="muted" style="font-size:10.5px;line-height:1.8;margin-top:8px">重复学者会转为「顿悟」；满顿悟后返还灵感。本作无内购，灵感只来自课程与星章。</div>' +
      '</section>' +
      '<section class="panel pity-box">' +
      '<div class="pity-top"><span class="section-label" style="margin:0">SSR 保底</span><b>' + remain + '</b></div>' +
      '<div class="progress-bar"><span style="width:' + pct + '%"></span></div>' +
      '<div class="pity-note">距离必出 SSR 还差 <b class="gold">' + remain + '</b> 抽。第 30 抽后概率逐步提升；第 ' + g.pity + ' 抽必出。</div>' +
      '<div class="pity-note">累计讲授 <b>' + p.gacha.totalPulls + '</b> 次 · 已召回 <b>' + Object.keys(p.roster).length + '</b> 名学者</div>' +
      '</section>' +
      '</div></div>';
  }

  /* ---------- 设置 ---------- */

  function renderSettings() {
    const p = app.profile;
    return '<div class="screen">' + topbar('settings') +
      screenHead('学院事务', '设置', '黑板、粉笔，以及一点安静。',
        '<button class="btn ghost" data-action="help">查看规则</button>') +
      '<div class="gacha-info" style="grid-template-columns:1.2fr .8fr">' +
      '<section class="panel" style="padding:18px 22px">' +
      '<div class="panel-head"><h3>课堂偏好</h3></div>' +
      '<div class="settings-list">' +
      '<div class="setting-row"><div><div class="set-title">音效</div><div class="set-desc">粉笔、定理与抽卡的和弦。</div></div>' +
      '<button class="switch ' + (p.settings.sound ? 'on' : '') + '" data-action="toggle-sound" aria-label="切换音效"></button></div>' +
      '<div class="setting-row"><div><div class="set-title">动画</div><div class="set-desc">粉笔尘、伤害数字与定理闪光。</div></div>' +
      '<button class="switch ' + (p.settings.animations ? 'on' : '') + '" data-action="toggle-anim" aria-label="切换动画"></button></div>' +
      '<div class="setting-row"><div><div class="set-title">重新开始</div><div class="set-desc">清空存档，回到第一课。此操作不可撤销。</div></div>' +
      '<button class="btn small danger" data-action="reset-save">重置存档</button></div>' +
      '</div></section>' +
      '<section class="panel" style="padding:18px 22px">' +
      '<div class="panel-head"><h3>课堂统计</h3></div>' +
      '<div class="kv" style="display:grid;gap:8px;font-size:12px;color:var(--chalk-dim)">' +
      '<div class="rate-line"><span>累计讲授</span><b style="font-family:var(--math);color:var(--chalk)">' + p.gacha.totalPulls + '</b></div>' +
      '<div class="rate-line"><span>星章</span><b style="font-family:var(--math);color:var(--gold)">' + META.totalStars(p) + '</b></div>' +
      '<div class="rate-line"><span>已发现定理</span><b style="font-family:var(--math);color:var(--chalk)">' + p.discovered.length + ' / ' + DATA.RECIPES.length + '</b></div>' +
      '<div class="rate-line"><span>已记录悖论</span><b style="font-family:var(--math);color:var(--chalk)">' + p.seenEnemies.length + ' / ' + DATA.ENEMIES.length + '</b></div>' +
      '</div>' +
      '<div class="muted" style="font-size:10.5px;line-height:1.9;margin-top:12px">《真理学院》v0.1 · 单机 Demo<br>纯 HTML / CSS / JS，零外部资源。存档保存在本机浏览器。</div>' +
      '</section>' +
      '</div></div>';
  }


  /* ---------- 弹窗 ---------- */

  function modalCloseBtn(action) {
    return '<button class="modal-close" data-action="' + (action || 'close-modal') + '" aria-label="关闭">×</button>';
  }

  function openModal(html, opts) {
    opts = opts || {};
    const root = document.getElementById('overlay-root');
    root.innerHTML = '<div class="modal-overlay" data-action="modal-backdrop"' + (opts.sticky ? ' data-sticky="1"' : '') + '>' +
      '<div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
  }

  function closeModal() {
    const root = document.getElementById('overlay-root');
    if (root) root.innerHTML = '';
    app.detailScholar = null;
  }

  function isModalOpen() {
    return !!document.querySelector('#overlay-root .modal-overlay');
  }

  /* ---------- 学者详情与养成 ---------- */

  function showScholarDetail(id) {
    const def = DATA.SCHOLAR_MAP[id];
    const member = app.profile.roster[id];
    if (!def || !member) return;
    app.detailScholar = id;
    const st = META.statsFor(app.profile, id);
    const cap = META.maxLevelFor(member);
    const cost = META.levelCost(member.level);
    const canLevel = member.level < cap && app.profile.notes >= cost;
    const atCap = member.level >= cap;
    const ascCost = member.ascension < 2 ? META.ASC_COSTS[member.ascension] : null;
    const canBreak = atCap && member.ascension < 2 && app.profile.manuscripts >= ascCost.manu && app.profile.notes >= ascCost.notes;

    const formulas = def.formulas.map(function (f) {
      return '<div class="skill-mini">' +
        '<div class="sm-top">' + tagPill(f.tag) + methodPill(f.method) +
        '<span class="sm-name">' + esc(f.name) + '</span><span class="sm-formula">' + fmtFormula(f.formula) + '</span></div>' +
        '<p>' + esc(f.desc) + '</p></div>';
    }).join('');

    const ax = def.axiom;
    const axiomHtml = '<div class="skill-mini" style="border-color:rgba(231,196,107,.4)">' +
      '<div class="sm-top"><span class="tag" style="border-color:rgba(231,196,107,.5);color:var(--gold)">公理 · 2 AP</span>' +
      methodPill(ax.method) + '<span class="sm-name">' + esc(ax.name) + '</span>' +
      '<span class="sm-formula">' + fmtFormula(ax.formula) + '</span></div>' +
      '<p>' + esc(ax.desc) + ' <span class="muted">冷却 ' + ax.cooldown + ' 回合。</span></p></div>';

    let dupePips = '';
    for (let i = 1; i <= 5; i++) dupePips += '<i class="' + (i <= member.dupes ? 'on' : '') + '"></i>';

    let upgrade = '';
    if (member.level < cap) {
      upgrade = '<div class="upgrade-row">' +
        '<button class="btn small primary" data-action="upgrade" data-id="' + id + '" data-times="1"' + (canLevel ? '' : ' disabled') + '>升 1 级</button>' +
        '<button class="btn small ghost" data-action="upgrade" data-id="' + id + '" data-times="5"' + (canLevel ? '' : ' disabled') + '>升 5 级</button>' +
        '<span class="cost-note">下一级消耗 <b>' + cost + '</b> 讲义 · 当前 <b>' + app.profile.notes + '</b></span>' +
        '</div>' +
        '<div class="cost-note" style="margin-top:4px">等级上限 Lv.' + cap + '。' + (atCap && member.ascension < 2 ? '已到上限，需突破。' : '') + '</div>';
    } else if (member.ascension < 2) {
      upgrade = '<div class="cost-note" style="margin-top:8px">已到当前上限 Lv.' + cap + '，突破后可继续升级。</div>';
    } else {
      upgrade = '<div class="cost-note" style="margin-top:8px">已满级 Lv.30。</div>';
    }

    let breakHtml = '';
    if (member.ascension < 2) {
      breakHtml = '<div class="upgrade-row" style="margin-top:8px">' +
        '<button class="btn small ' + (canBreak ? 'primary' : 'ghost') + '" data-action="breakthrough" data-id="' + id + '"' + (canBreak ? '' : ' disabled') + '>突破 ' + (member.ascension + 1) + ' 阶</button>' +
        '<span class="cost-note">需要 Lv.' + cap + ' · 手稿 <b>' + ascCost.manu + '</b> · 讲义 <b>' + ascCost.notes + '</b></span>' +
        '</div>';
    }

    const html = modalCloseBtn() +
      '<div class="detail-head">' +
      sigil(def.sigil, def.color) +
      '<div><div class="detail-name"><h2>' + esc(def.name) + '</h2>' + rarityBadge(def.rarity) +
      '<span class="muted" style="font-size:11px">' + schoolName(def.school) + ' · ' + esc(def.title) + '</span></div>' +
      '<div class="detail-latin">' + esc(def.latin) + ' · ' + esc(def.era) + '</div>' +
      '<div class="detail-quote">「' + esc(def.quote) + '」</div></div>' +
      '<div style="text-align:right"><div class="cost-note">当前等级</div><div style="font-family:var(--math);font-size:30px;color:var(--gold);line-height:1.1">Lv.' + member.level + '</div>' +
      '<div class="dupe-pips" title="顿悟层数">' + dupePips + '</div><div class="cost-note">顿悟 ' + member.dupes + ' / 5</div></div>' +
      '</div>' +
      '<div class="stat-grid">' +
      '<div class="stat-cell"><small>生命</small><b>' + st.hp + '</b></div>' +
      '<div class="stat-cell"><small>攻击</small><b>' + st.atk + '</b></div>' +
      '<div class="stat-cell"><small>防御</small><b>' + st.def + '</b></div>' +
      '<div class="stat-cell"><small>突破</small><b>' + member.ascension + ' / 2</b></div>' +
      '</div>' +
      '<p style="margin-top:12px">' + esc(def.bio) + '</p>' +
      '<h3>公式</h3>' + formulas +
      '<h3>公理</h3>' + axiomHtml +
      '<h3>养成</h3>' + upgrade + breakHtml +
      '<div class="modal-actions"><button class="btn ghost" data-action="close-modal">关闭</button></div>';

    openModal(html, { cls: 'wide scholar-modal' });
  }

  /* ---------- 规则 / 介绍 ---------- */

  function showRules() {
    const html = modalCloseBtn() +
      '<div class="eyebrow">课堂规则</div><h2>如何证明一条定理</h2>' +
      '<p>每回合你有 <b class="gold">3 点行动力</b>。公式消耗 1 点，公理消耗 2 点。</p>' +
      '<div class="help-grid">' +
      '<div class="help-card"><h4>公式与标签</h4><p>每张公式都有标签，如 [极限]、[级数]、[同余]。每张公式每回合只能使用一次。</p></div>' +
      '<div class="help-card"><h4>合成定理</h4><p>同一回合内，用两名不同学者的公式按标签接续，就会触发一条定理。已发现的配方会高亮提示。</p></div>' +
      '<div class="help-card"><h4>公理</h4><p>公理是学者的绝技，消耗 2 点行动力，使用后进入冷却。失语状态下无法使用。</p></div>' +
      '<div class="help-card"><h4>方法克制</h4><p>公式分为演绎、计算、构造。命中敌人的弱点方法，伤害提高 50%；被抗性抵挡则降低 30%。</p></div>' +
      '<div class="help-card"><h4>悖论护盾</h4><p>Boss 的悖论护盾只被定理伤害削减；护盾存在时，普通公式伤害减半。</p></div>' +
      '<div class="help-card"><h4>星章</h4><p>通关 1 星；无人倒下 +1 星；在指定回合数内完成 +1 星。提升星章会获得额外灵感。</p></div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn primary" data-action="close-modal">明白了</button></div>';
    openModal(html, { cls: 'wide' });
  }

  function maybeIntro() {
    if (app.introShown || app.profile.flags.introSeen) return;
    try {
      if (new URLSearchParams(location.search).has('skipintro')) return;
    } catch (e) { /* ignore */ }
    app.introShown = true;
    setTimeout(function () {
      if (app.screen !== 'home' || app.battle) return;
      const html = '<div class="intro-modal">' +
        '<div class="eyebrow">第一章 · 悖论裂缝</div>' +
        '<h2 class="page-title" style="font-size:38px;margin-top:6px">真理学院</h2>' +
        '<p>康托尔失踪的第七天，学院的黑板开始自己写字。</p>' +
        '<div class="intro-quote">「这句话是假的。」</div>' +
        '<p>你是新任「求证者」。翻开讲义，把历史中的学者召回讲台；用他们的公式接续出定理，把被悖论侵蚀的证明一条条补回来。</p>' +
        '<p class="muted" style="font-size:12px">三名学者 · 3 点行动力 · 两名不同学者的公式可以合成定理。</p>' +
        '<div class="modal-actions"><button class="btn primary" data-action="intro-close">走进学院</button></div>' +
        '</div>';
      openModal(html, { cls: 'narrow', sticky: true });
    }, 260);
  }

  /* ---------- 抽卡 ---------- */

  function doPull(count) {
    const c = count === 10 ? 10 : 1;
    app.lastPullCount = c;
    const seed = (Date.now() ^ (app.profile.gacha.totalPulls * 2654435761)) >>> 0;
    const rng = META.createRng(seed);
    const res = META.pull(app.profile, c, rng);
    if (!res.ok) {
      toast(res.reason, 'bad');
      return;
    }
    save();
    render();
    showGachaModal(res);
    Sound.pull();
  }

  function showGachaModal(res) {
    const cards = res.results.map(function (r, i) {
      const def = DATA.SCHOLAR_MAP[r.id];
      let note = '新学者';
      if (!r.isNew && r.compensation > 0) note = '满顿悟 · 灵感 +' + r.compensation;
      else if (!r.isNew) note = '顿悟 +1';
      return '<div class="pull-card rarity-' + r.rarity + '" style="--i:' + i + '">' +
        (r.isNew ? '<span class="new-mark">NEW</span>' : '') +
        sigil(def.sigil, def.color, 'sm') +
        '<div class="pc-name">' + esc(def.name) + '</div>' +
        '<div class="pc-tag">' + r.rarity + ' · ' + schoolName(def.school) + '<br>' + note + '</div>' +
        '</div>';
    }).join('');

    const pityLeft = Math.max(0, DATA.GACHA.pity - app.profile.gacha.sinceSSR);
    const html = modalCloseBtn() +
      '<div class="eyebrow">无限集 · 点名结果</div>' +
      '<h2>本次召回</h2>' +
      '<p class="muted">消耗 ' + res.spent + ' 灵感 · 距离 SSR 保底还有 ' + pityLeft + ' 抽</p>' +
      '<div class="gacha-results">' + cards + '</div>' +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-action="pull" data-count="' + app.lastPullCount + '"' +
      (app.profile.inspiration < (app.lastPullCount === 10 ? DATA.GACHA.tenCost : DATA.GACHA.cost) ? ' disabled' : '') + '>再抽一次</button>' +
      '<button class="btn primary" data-action="close-modal">收下讲义</button>' +
      '</div>';
    openModal(html, { cls: 'wide' });
  }

  /* ---------- 战斗 ---------- */

  function startBattle(stageId, fromHash, debugLevel) {
    const stage = DATA.STAGE_MAP[stageId];
    if (!stage) {
      toast('未知的课程', 'bad');
      return;
    }
    if (!fromHash && !META.isStageUnlocked(app.profile, stageId)) {
      toast('先完成上一课', 'bad');
      return;
    }
    let members = META.teamMembers(app.profile);
    if (debugLevel) {
      members = members.map(function (m) {
        return { id: m.id, level: debugLevel, dupes: 0, ascension: debugLevel > 15 ? 1 : 0 };
      });
    }
    if (members.length !== 3) {
      toast('需要 3 名学者上场', 'bad');
      return;
    }
    META.markSeen(app.profile, stageId);
    save();
    const seed = (Date.now() ^ Math.floor(Math.random() * 1000000000)) >>> 0;
    app.battle = BATTLE.createBattle({ stageId: stageId, team: members, seed: seed });
    app.selectedScholarUid = app.battle.scholars[0].uid;
    app.targeting = null;
    app.resultApplied = false;
    app.lastResult = null;
    app.screen = 'battle';
    app.scrollTop = true;
    closeModal();
    render();
    Sound.chalk();
  }

  function targetName(type) {
    return type === 'enemy' ? '悖论' : '学者';
  }

  function battleHint(b) {
    const options = BATTLE.getComboOptions(b);
    if (b.result) return '';
    if (!b.chain.length) {
      if (b.comboCount === 0) {
        return '<b>第一步</b><br>点击下方学者，打出任意公式。公式的标签会决定下一步能接出什么。';
      }
      return '<b>下一步</b><br>再写出一式公式，或直接结束回合。';
    }
    if (options.length) {
      return '<b>可以合成了</b><br>用高亮的公式接上「' + DATA.TAGS[b.chain[0].tag].name + '」，触发定理。';
    }
    return '<b>这一式接不上</b><br>换一名学者的公式，或结束回合。';
  }

  function intentDamage(b, enemy, intent) {
    if (!intent || intent.type !== 'attack') return null;
    let raw = BATTLE.effAtk(enemy) * (intent.mult || 1) + (intent.flat || 0);
    if (enemy.chargeBonus) raw *= (1 + enemy.chargeBonus);
    const allies = BATTLE.aliveScholars(b);
    if (!allies.length) return 0;
    const avgDef = allies.reduce(function (s, a) { return s + BATTLE.effDef(a); }, 0) / allies.length;
    return Math.round(raw * 100 / (100 + avgDef * 2.5));
  }

  function renderBattle() {
    const b = app.battle;
    if (!b) {
      app.screen = 'home';
      return renderHome();
    }
    const stage = DATA.STAGE_MAP[b.stageId];
    if (!stage) {
      app.screen = 'home';
      return renderHome();
    }
    let selected = b.scholars.find(function (s) { return s.uid === app.selectedScholarUid && s.alive; });
    if (!selected) {
      selected = b.scholars.find(function (s) { return s.alive; }) || b.scholars[0];
      app.selectedScholarUid = selected.uid;
    }
    const comboOptions = BATTLE.getComboOptions(b);
    const chain = b.chain[0] || null;
    const targetMode = app.targeting;

    let pips = '';
    for (let i = 0; i < Math.max(3, b.ap); i++) {
      const cls = i < Math.min(b.ap, 3) ? 'full' : (i < b.ap ? 'extra' : '');
      pips += '<span class="pip ' + cls + '"></span>';
    }

    const enemies = b.enemies.map(function (e) {
      const intent = BATTLE.getIntent(e);
      const dmg = intentDamage(b, e, intent);
      const canTarget = targetMode && targetMode.kind === 'enemy' && e.alive;
      const base = DATA.ENEMY_MAP[e.id];
      const shieldPct = e.paradoxShield > 0 ? Math.min(100, e.paradoxShield / Math.max(60, e.paradoxShield) * 100) : 0;
      return '<div class="unit enemy-card ' + (!e.alive ? 'dead' : '') + ' ' + (canTarget ? 'targetable' : '') + '"' +
        ' data-uid="' + e.uid + '" data-side="enemy"' + (canTarget ? ' data-action="battle-target"' : '') + '>' +
        (e.shield > 0 ? '<span class="shield-badge">盾 ' + e.shield + '</span>' : '') +
        '<div class="unit-head">' + sigil(base.sigil, base.color) +
        '<div style="min-width:0"><div class="unit-name">' + esc(e.name) + '</div><div class="unit-title">' + esc(e.title || '') + '</div></div></div>' +
        hpBar(e) +
        (e.paradoxShield > 0 ? '<div class="paradox-label"><span>悖论护盾</span><span>' + e.paradoxShield + '</span></div>' +
          '<div class="hp-bar paradox-bar"><span style="width:' + shieldPct + '%"></span></div>' : '') +
        '<div class="intent">▸ <b>' + (intent ? esc(intent.label) : '—') + '</b>' +
        (dmg != null ? '<span class="intent-dmg">≈ ' + dmg + '</span>' : '<span class="intent-dmg">' + (intent && intent.type === 'charge' ? '蓄力' : '') + '</span>') + '</div>' +
        '<div class="enemy-traits"><span>弱点 <b class="wk">' + (e.weakness ? DATA.METHODS[e.weakness].name : '无') + '</b></span>' +
        '<span>抗性 <b class="rs">' + (e.resist ? DATA.METHODS[e.resist].name : '无') + '</b></span>' +
        '<span class="muted">Lv.' + e.level + (e.boss ? ' · 阶段 ' + e.phase + '/2' : '') + '</span></div>' +
        '<div class="status-chips">' + statusChips(e) + '</div>' +
        '</div>';
    }).join('');

    const scholars = b.scholars.map(function (s) {
      const def = DATA.SCHOLAR_MAP[s.id];
      const canTarget = targetMode && targetMode.kind === 'ally' && s.alive;
      return '<button class="unit scholar-card ' + (s.uid === selected.uid ? 'selected' : '') + ' ' + (!s.alive ? 'dead' : '') + ' ' + (canTarget ? 'targetable' : '') + '"' +
        ' data-action="battle-scholar" data-uid="' + s.uid + '"' + (s.alive ? '' : ' disabled') + '>' +
        (s.shield > 0 ? '<span class="shield-badge">盾 ' + s.shield + '</span>' : '') +
        '<div class="unit-head">' + sigil(def.sigil, def.color) +
        '<div style="min-width:0;flex:1"><div class="unit-name">' + esc(s.name) + '</div><div class="unit-title">Lv.' + s.level + ' · ' + schoolName(def.school) + '</div></div>' +
        (s.cooldowns.axiom > 0 ? '<span class="cooldown-pill">公理 ' + s.cooldowns.axiom + '</span>' : '') + '</div>' +
        hpBar(s) + '<div class="status-chips">' + statusChips(s) + '</div></button>';
    }).join('');

    let skills = '';
    if (selected && selected.alive) {
      const def = DATA.SCHOLAR_MAP[selected.id];
      const formulaButtons = def.formulas.map(function (f) {
        const can = BATTLE.canUseFormula(b, selected.uid, f.id);
        const ready = comboOptions.some(function (o) { return o.scholarUid === selected.uid && o.formulaId === f.id; });
        return '<button class="skill-btn ' + (ready ? 'combo-ready' : '') + '" data-action="battle-skill" data-scholar="' + selected.uid + '" data-kind="formula" data-id="' + f.id + '"' +
          (can.ok ? '' : ' disabled') + ' title="' + esc(can.ok ? f.desc : can.reason) + '">' +
          '<div class="skill-top">' + tagPill(f.tag) + methodPill(f.method) + '<span class="skill-cost">' + f.cost + ' AP</span></div>' +
          '<div class="skill-name">' + esc(f.name) + '</div>' +
          '<div class="skill-formula">' + fmtFormula(f.formula) + '</div>' +
          '<div class="skill-desc">' + esc(f.desc) + '</div>' +
          '</button>';
      }).join('');
      const ax = def.axiom;
      const canAx = BATTLE.canUseAxiom(b, selected.uid);
      const cd = selected.cooldowns.axiom;
      const axiomButton = '<button class="skill-btn axiom" data-action="battle-skill" data-scholar="' + selected.uid + '" data-kind="axiom" data-id="' + ax.id + '"' +
        (canAx.ok ? '' : ' disabled') + ' title="' + esc(canAx.ok ? ax.desc : canAx.reason) + '">' +
        '<div class="skill-top"><span class="tag" style="border-color:rgba(231,196,107,.55);color:var(--gold)">[公理]</span>' + methodPill(ax.method) +
        '<span class="skill-cost">' + ax.cost + ' AP</span></div>' +
        '<div class="skill-name">' + esc(ax.name) + (cd > 0 ? ' <span class="skill-cd">冷却 ' + cd + '</span>' : '') + '</div>' +
        '<div class="skill-formula">' + fmtFormula(ax.formula) + '</div>' +
        '<div class="skill-desc">' + esc(ax.desc) + '</div>' +
        '</button>';
      skills = '<div class="skill-panel-head"><span class="sp-name">' + esc(selected.name) + '</span>' +
        '<span class="sp-meta">Lv.' + selected.level + ' · ' + schoolName(def.school) + ' · ' + esc(def.title) + '</span>' +
        '<span class="sp-ap">行动力 ' + b.ap + ' / 3</span></div>' +
        '<div class="skill-list">' + formulaButtons + axiomButton + '</div>';
    } else {
      skills = '<div class="empty-state">没有可以行动的学者。</div>';
    }

    let comboList = '';
    if (!chain) {
      comboList = '<div class="combo-empty">先写出一式公式，这里会提示能接出的定理。</div>';
    } else if (!comboOptions.length) {
      comboList = '<div class="combo-empty">这一式没有已知定理能接上。<br>试试换一名学者的公式。</div>';
    } else {
      comboList = comboOptions.map(function (o) {
        return '<div class="combo-option ' + (o.usable ? '' : 'off') + '"><span class="co-name">' + esc(o.recipeName) + '</span>' +
          '<span class="co-who">' + esc(o.scholarName) + ' · ' + esc(o.formulaName) + '</span></div>';
      }).join('');
    }

    const logHtml = b.log.slice(-20).map(function (l) {
      return '<div class="log-line ' + (l.kind || '') + '">' + esc(l.text) + '</div>';
    }).join('');

    const chainHtml = chain
      ? '<span class="chain-slot filled"><span class="tag">[' + DATA.TAGS[chain.tag].name + ']</span>' + esc(chain.name) + '</span>' +
        '<span class="chain-arrow">→</span><span class="chain-slot">等待另一名学者接续</span>'
      : '<span class="chain-slot">尚未落笔</span><span class="chain-arrow">→</span><span class="chain-slot">等待第一式</span>';

    const hintHtml = stage.tutorial ? '<div class="hint-box">' + battleHint(b) + '</div>' : '';

    return '<div class="battle">' +
      '<div class="battle-top">' +
      '<button class="btn ghost small" data-action="battle-retreat">← 撤退</button>' +
      '<div class="stage-title">' + stage.id + ' ' + esc(stage.name) +
      '<small>第 ' + b.turn + ' 回合 · ' + (b.phase === 'player' ? '你的回合' : (b.result ? '已结束' : '悖论回合')) + '</small></div>' +
      '<div class="spacer"></div>' +
      '<span class="muted" style="font-size:10.5px">星章条件 · ' + stage.par + ' 回合内</span>' +
      '<button class="icon-btn" data-action="help" title="规则">?</button>' +
      '</div>' +
      (targetMode ? '<div class="target-banner">选择' + targetName(targetMode.kind) + '作为「' + esc(targetMode.name) + '」的目标' +
        '<button class="btn small ghost" data-action="cancel-target">取消</button></div>' : '') +
      '<div class="battle-grid">' +
      '<div class="battle-main">' +
      '<div class="enemy-row">' + enemies + '</div>' +
      '<div class="chain-strip"><span class="chain-label">演算链</span>' + chainHtml +
      '<div class="chain-hint">' + (chain && comboOptions.length
        ? '可合成 <b>' + esc(comboOptions[0].recipeName) + '</b><br><span class="muted">' + esc(comboOptions[0].scholarName) + ' · ' + esc(comboOptions[0].formulaName) + '</span>'
        : (chain ? '<span class="muted">没有已知配方</span>' : '公式标签决定接续')) + '</div></div>' +
      '<div class="scholar-row">' + scholars + '</div>' +
      '<div class="panel skill-panel">' + skills + '</div>' +
      '</div>' +
      '<aside class="battle-side">' +
      '<div class="side-block ap-block"><span class="ap-label">行动力</span><div class="ap-pips">' + pips + '</div><span class="ap-num">' + b.ap + '</span></div>' +
      '<div class="side-block combo-block"><div class="combo-title">可续接定理</div>' + comboList + '</div>' +
      (hintHtml ? hintHtml : '') +
      '<div class="side-block log-block"><div class="log-head">课堂记录</div><div class="battle-log" id="battle-log">' + logHtml + '</div></div>' +
      '<button class="btn primary end-turn" data-action="battle-end-turn"' + (b.result ? ' disabled' : '') + '>结束回合</button>' +
      '</aside>' +
      '</div>' +
      '<div class="battle-foot"><span>✦ 完成授课 · 无人倒下 · ' + stage.par + ' 回合内 → 三星</span><span class="qd">Q.E.D.</span></div>' +
      '</div>';
  }

  function showFloat(ev) {
    if (!app.profile.settings.animations) return;
    const el = document.querySelector('[data-uid="' + ev.targetUid + '"]');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const span = document.createElement('span');
    let text = '';
    if (ev.type === 'damage') {
      if (ev.amount > 0) text = '-' + ev.amount;
      else if (ev.blocked > 0) text = '盾 -' + ev.blocked;
      if (ev.truth) span.className = 'float-num truth';
      else span.className = 'float-num';
    } else if (ev.type === 'heal') {
      span.className = 'float-num heal';
      text = '+' + ev.amount;
    } else if (ev.type === 'shield') {
      span.className = 'float-num shield';
      text = '盾 +' + ev.amount;
    }
    if (!text) return;
    span.textContent = text;
    span.style.left = (rect.left + rect.width / 2 + (Math.random() * 30 - 15)) + 'px';
    span.style.top = (rect.top + rect.height / 2) + 'px';
    document.body.appendChild(span);
    el.classList.add('hit');
    setTimeout(function () { span.remove(); }, 1100);
    setTimeout(function () { el.classList.remove('hit'); }, 380);
  }

  function dustBurst(x, y) {
    if (!app.profile.settings.animations) return;
    for (let i = 0; i < 14; i++) {
      const d = document.createElement('span');
      d.className = 'chalk-particle';
      const a = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 90;
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      d.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(1) + 'px');
      d.style.setProperty('--dy', (Math.sin(a) * dist).toFixed(1) + 'px');
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 1400);
    }
  }

  function showTheorem(ev) {
    if (!app.profile.settings.animations) {
      toast('定理成立 · ' + ev.name, 'good');
      return;
    }
    const root = document.getElementById('overlay-root');
    const div = document.createElement('div');
    div.className = 'theorem-flash';
    div.innerHTML = '<div class="tf-kicker">定理成立</div>' +
      '<div class="tf-name">' + esc(ev.name) + '</div>' +
      '<div class="tf-formula">' + fmtFormula(ev.formula) + '</div>' +
      '<div class="tf-desc">' + esc(ev.desc || '') + '</div>';
    root.appendChild(div);
    const rect = div.getBoundingClientRect();
    dustBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    setTimeout(function () { div.remove(); }, 1900);
  }

  function showPhase(ev) {
    const div = document.createElement('div');
    div.className = 'phase-banner';
    div.textContent = ev.text || '悖论改变了形态。';
    document.body.appendChild(div);
    setTimeout(function () { div.remove(); }, 2500);
  }

  function showTurn(ev) {
    if (!app.profile.settings.animations) return;
    const div = document.createElement('div');
    div.className = 'turn-flash';
    div.textContent = '第 ' + ev.turn + ' 回合';
    document.body.appendChild(div);
    setTimeout(function () { div.remove(); }, 1300);
  }

  function playEvents(events) {
    if (!events || !events.length) return;
    const battleRef = app.battle;
    let delay = 0;
    let hitPlayed = false;
    events.forEach(function (ev) {
      const d = delay;
      if (ev.type === 'cast') {
        setTimeout(function () { if (app.battle === battleRef) Sound.chalk(); }, d);
      } else if (ev.type === 'damage') {
        if (!hitPlayed) { hitPlayed = true; Sound.hit(); }
        setTimeout(function () { if (app.battle === battleRef) showFloat(ev); }, d);
        delay += 95;
      } else if (ev.type === 'heal') {
        Sound.heal();
        setTimeout(function () { if (app.battle === battleRef) showFloat(ev); }, d);
        delay += 95;
      } else if (ev.type === 'shield') {
        setTimeout(function () { if (app.battle === battleRef) showFloat(ev); }, d);
        delay += 60;
      } else if (ev.type === 'theorem') {
        setTimeout(function () { if (app.battle === battleRef) showTheorem(ev); }, Math.max(80, d));
        Sound.theorem();
      } else if (ev.type === 'phase') {
        setTimeout(function () { if (app.battle === battleRef) showPhase(ev); }, d);
      } else if (ev.type === 'turn') {
        setTimeout(function () { if (app.battle === battleRef) showTurn(ev); }, d);
      } else if (ev.type === 'shieldBreak') {
        toast('悖论护盾碎裂', 'good');
      }
    });
  }

  function executeSkill(scholarUid, kind, skillId, targetUid) {
    const b = app.battle;
    if (!b || b.result) return;
    const res = kind === 'formula'
      ? BATTLE.useFormula(b, scholarUid, skillId, targetUid)
      : BATTLE.useAxiom(b, scholarUid, targetUid);
    app.targeting = null;
    if (!res.ok) {
      toast(res.reason || '无法行动', 'bad');
      render();
      return;
    }
    render();
    playEvents(res.events);
    if (b.result) finishBattle(b.result);
  }

  function trySkill(scholarUid, kind, skillId) {
    const b = app.battle;
    if (!b || b.result) return;
    const s = b.scholars.find(function (x) { return x.uid === scholarUid; });
    if (!s || !s.alive) return;
    const skill = kind === 'formula' ? BATTLE.getFormula(s, skillId) : BATTLE.getAxiom(s);
    if (!skill) return;
    const can = kind === 'formula' ? BATTLE.canUseFormula(b, s.uid, skillId) : BATTLE.canUseAxiom(b, s.uid);
    if (!can.ok) {
      toast(can.reason, 'bad');
      return;
    }
    app.selectedScholarUid = s.uid;
    if (skill.target === 'enemy' || skill.target === 'ally') {
      const targets = skill.target === 'enemy' ? BATTLE.aliveEnemies(b) : BATTLE.aliveScholars(b);
      if (!targets.length) {
        toast('没有可选目标', 'bad');
        return;
      }
      if (targets.length === 1) {
        executeSkill(s.uid, kind, skillId, targets[0].uid);
        return;
      }
      app.targeting = {
        kind: skill.target, scholarUid: s.uid, skillKind: kind,
        skillId: skillId, name: skill.name
      };
      render();
      toast('选择一名' + targetName(skill.target), 'good');
    } else {
      executeSkill(s.uid, kind, skillId, null);
    }
  }

  function endTurn() {
    const b = app.battle;
    if (!b || b.result) return;
    const res = BATTLE.endTurn(b);
    if (!res.ok) {
      toast(res.reason, 'bad');
      return;
    }
    app.targeting = null;
    render();
    playEvents(res.events);
    if (b.result) finishBattle(b.result);
  }

  function finishBattle(result) {
    if (app.resultApplied) return;
    app.resultApplied = true;
    const out = META.applyStageResult(app.profile, result);
    if (result.stageId === '1-1') app.profile.flags.tutorialSeen = true;
    save();
    app.lastResult = { result: result, out: out };
    if (result.win) {
      app.selectedStage = META.bestStage(app.profile);
      Sound.win();
    } else {
      Sound.lose();
    }
    setTimeout(function () {
      showResultModal(result, out);
    }, app.profile.settings.animations ? 620 : 60);
  }

  function nextStageId(id) {
    const i = DATA.STAGES.findIndex(function (s) { return s.id === id; });
    return i >= 0 && i < DATA.STAGES.length - 1 ? DATA.STAGES[i + 1].id : null;
  }

  function showResultModal(result, out) {
    const stage = DATA.STAGE_MAP[result.stageId];
    const next = nextStageId(result.stageId);
    const starHtml = [1, 2, 3].map(function (i) {
      return '<span class="' + (i <= result.stars ? 'on' : '') + '">★</span>';
    }).join('');
    const rew = out.rewards || { insp: 0, notes: 0, manu: 0 };
    const rewardHtml = (rew.insp || rew.notes || rew.manu)
      ? '<div class="reward-panel">' +
        (rew.insp ? '<div class="reward-item">✦ 灵感 <b>+' + rew.insp + '</b></div>' : '') +
        (rew.notes ? '<div class="reward-item">✎ 讲义 <b>+' + rew.notes + '</b></div>' : '') +
        (rew.manu ? '<div class="reward-item">▤ 手稿 <b>+' + rew.manu + '</b></div>' : '') +
        '</div>'
      : '<p class="muted" style="margin-top:12px">' + (result.win ? '重复授课不再发放首通奖励。' : '没有课业奖励，但本局发现的定理已录入图鉴。') + '</p>';

    const nextBtn = result.win && next
      ? '<button class="btn primary" data-action="result-next" data-id="' + next + '">下一课 · ' + next + '</button>'
      : (result.win && !next ? '<button class="btn primary" data-action="result-home">回到学院</button>' : '');
    const title = result.win ? (result.stageId === '1-10' ? '第一章 · 完' : stage.name) : '败下讲台';
    const sub = result.win
      ? (result.stageId === '1-10' ? '讲台上的圆终于安静下来。' : stage.storyAfter || '黑板擦干净了，下一课还在等你。')
      : '黑板没有原谅你，但公式还记得。';

    const html = '<div class="result-modal">' +
      '<div class="result-kicker">' + (result.win ? '证明完成' : '证明中断') + '</div>' +
      '<h2>' + esc(title) + '</h2>' +
      '<div class="result-sub">' + esc(sub) + '</div>' +
      '<div class="result-stars">' + starHtml + '</div>' +
      '<div class="result-stats"><span>回合 <b>' + result.turns + '</b> / ' + result.par + '</span>' +
      '<span>定理 <b>' + result.comboCount + '</b></span>' +
      '<span>倒下 <b>' + result.scholarsDown + '</b></span></div>' +
      rewardHtml +
      (result.discovered && result.discovered.length ? '<div class="muted" style="font-size:10.5px;margin-top:8px">新定理已录入图鉴 · ' + result.discovered.length + ' 条</div>' : '') +
      '<div class="modal-actions" style="justify-content:center">' +
      '<button class="btn ghost" data-action="result-map">返回课程表</button>' +
      (result.win ? '' : '<button class="btn ghost" data-action="result-team">调整编队</button>') +
      '<button class="btn ' + (result.win ? 'ghost' : 'primary') + '" data-action="result-retry">重试本课</button>' +
      nextBtn +
      '</div></div>';
    openModal(html, { cls: 'narrow', sticky: true });
  }

  /* ---------- 路由与渲染 ---------- */

  function render() {
    const root = document.getElementById('app');
    if (!root) return;
    let html = '';
    if (app.screen === 'battle' && app.battle) {
      html = renderBattle();
    } else {
      if (app.screen === 'map') html = renderMap();
      else if (app.screen === 'team') html = renderTeam();
      else if (app.screen === 'codex') html = renderCodex();
      else if (app.screen === 'gacha') html = renderGacha();
      else if (app.screen === 'settings') html = renderSettings();
      else html = renderHome();
    }
    root.innerHTML = html;
    if (app.scrollTop) {
      const bi = document.querySelector('.board-inner');
      if (bi) bi.scrollTop = 0;
      app.scrollTop = false;
    }
    if (app.screen === 'battle') {
      const log = document.getElementById('battle-log');
      if (log) log.scrollTop = log.scrollHeight;
    }
  }

  function navigate(screen) {
    closeModal();
    app.battle = null;
    app.targeting = null;
    app.screen = screen;
    app.scrollTop = true;
    const target = '#' + screen;
    if (location.hash === target) {
      render();
    } else {
      location.hash = target;
    }
  }

  function route() {
    const raw = (location.hash || '#home').slice(1);
    if (raw.indexOf('battle/') === 0) {
      const path = raw.slice(7);
      const qIndex = path.indexOf('?');
      const id = qIndex >= 0 ? path.slice(0, qIndex) : path;
      let lv = 0;
      if (qIndex >= 0) {
        const params = new URLSearchParams(path.slice(qIndex + 1));
        lv = Number(params.get('lv')) || 0;
      }
      if (DATA.STAGE_MAP[id]) {
        startBattle(id, true, lv);
        return;
      }
    }
    const allowed = ['home', 'map', 'team', 'gacha', 'codex', 'settings'];
    const screen = allowed.indexOf(raw) >= 0 ? raw : 'home';
    app.screen = screen;
    app.battle = null;
    app.targeting = null;
    app.scrollTop = true;
    if (!DATA.STAGE_MAP[app.selectedStage]) app.selectedStage = META.bestStage(app.profile);
    render();
    if (screen === 'home') maybeIntro();
  }

  /* ---------- 交互 ---------- */

  function assignScholar(id) {
    const p = app.profile;
    if (p.team.indexOf(id) !== -1) {
      app.teamSlot = p.team.indexOf(id);
      render();
      return;
    }
    const next = p.team.slice();
    next[app.teamSlot] = id;
    const r = META.setTeam(p, next);
    if (!r.ok) {
      toast(r.reason, 'bad');
      return;
    }
    save();
    toast('已换入 ' + DATA.SCHOLAR_MAP[id].name, 'good');
    render();
  }

  function confirmRetreat() {
    openModal('<h2>撤回学院？</h2><p>本局战斗进度将丢弃，不会获得课业奖励。已发现的定理会在结算时记录。</p>' +
      '<div class="modal-actions"><button class="btn ghost" data-action="close-modal">继续授课</button>' +
      '<button class="btn danger" data-action="confirm-retreat">撤回</button></div>', { cls: 'narrow' });
  }

  function confirmReset() {
    openModal('<h2>重置存档？</h2><p>所有学者、等级、星章与已发现的定理都会被清空，回到第一课。此操作不可撤销。</p>' +
      '<div class="modal-actions"><button class="btn ghost" data-action="close-modal">取消</button>' +
      '<button class="btn danger" data-action="confirm-reset">确认重置</button></div>', { cls: 'narrow' });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (app.targeting) {
        app.targeting = null;
        render();
        return;
      }
      if (isModalOpen()) {
        closeModal();
        return;
      }
      return;
    }
    if (isModalOpen() || app.screen !== 'battle' || !app.battle || app.battle.result) return;
    const b = app.battle;
    const selected = b.scholars.find(function (s) { return s.uid === app.selectedScholarUid && s.alive; });
    if (!selected) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      const idx = Number(e.key) - 1;
      const s = b.scholars[idx];
      if (s && s.alive) {
        app.selectedScholarUid = s.uid;
        render();
      }
      e.preventDefault();
    } else if (e.key === 'q' || e.key === 'w' || e.key === 'e') {
      const def = DATA.SCHOLAR_MAP[selected.id];
      if (e.key === 'e') trySkill(selected.uid, 'axiom', def.axiom.id);
      else {
        const f = def.formulas[e.key === 'q' ? 0 : 1];
        if (f) trySkill(selected.uid, 'formula', f.id);
      }
      e.preventDefault();
    } else if (e.key === ' ') {
      endTurn();
      e.preventDefault();
    }
  }

  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'modal-backdrop') {
      if (e.target === el && !el.dataset.sticky) closeModal();
      return;
    }
    Sound.init();
    Sound.click();
    const id = el.dataset.id;
    const screen = el.dataset.screen;

    switch (action) {
      case 'nav':
        navigate(screen);
        break;
      case 'continue':
        app.selectedStage = META.bestStage(app.profile);
        navigate('map');
        break;
      case 'select-stage':
        if (!META.isStageUnlocked(app.profile, id)) return;
        app.selectedStage = id;
        render();
        break;
      case 'start-stage':
        closeModal();
        startBattle(id);
        break;
      case 'team-slot':
        app.teamSlot = Number(el.dataset.index) || 0;
        render();
        break;
      case 'pick-scholar':
        assignScholar(id);
        break;
      case 'scholar-detail':
        showScholarDetail(id);
        break;
      case 'codex-tab':
        app.codexTab = el.dataset.tab;
        render();
        break;
      case 'pull':
        doPull(Number(el.dataset.count) || 1);
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'toggle-sound':
        app.profile.settings.sound = !app.profile.settings.sound;
        save();
        if (app.profile.settings.sound) Sound.click();
        render();
        break;
      case 'toggle-anim':
        app.profile.settings.animations = !app.profile.settings.animations;
        save();
        render();
        break;
      case 'reset-save':
        confirmReset();
        break;
      case 'confirm-reset':
        app.profile = META.resetProfile();
        save();
        app.introShown = false;
        app.battle = null;
        app.targeting = null;
        closeModal();
        app.screen = 'home';
        location.hash = '#home';
        render();
        maybeIntro();
        break;
      case 'help':
        showRules();
        break;
      case 'intro-close':
        app.profile.flags.introSeen = true;
        save();
        closeModal();
        break;
      case 'upgrade': {
        const times = Number(el.dataset.times) || 1;
        const r = META.levelUp(app.profile, id, times);
        if (!r.ok) {
          toast(r.reason, 'bad');
          return;
        }
        save();
        toast('等级提升 ' + r.gained + ' 级', 'good');
        render();
        showScholarDetail(id);
        break;
      }
      case 'breakthrough': {
        const r = META.breakthrough(app.profile, id);
        if (!r.ok) {
          toast(r.reason, 'bad');
          return;
        }
        save();
        toast('突破成功 · ' + r.ascension + ' 阶', 'good');
        render();
        showScholarDetail(id);
        break;
      }
      case 'battle-scholar': {
        const uid = el.dataset.uid;
        if (app.targeting && app.targeting.kind === 'ally') {
          executeSkill(app.targeting.scholarUid, app.targeting.skillKind, app.targeting.skillId, uid);
        } else {
          app.selectedScholarUid = uid;
          render();
        }
        break;
      }
      case 'battle-target': {
        if (app.targeting && app.targeting.kind === 'enemy') {
          executeSkill(app.targeting.scholarUid, app.targeting.skillKind, app.targeting.skillId, el.dataset.uid);
        }
        break;
      }
      case 'battle-skill':
        trySkill(el.dataset.scholar, el.dataset.kind, el.dataset.id);
        break;
      case 'battle-end-turn':
        endTurn();
        break;
      case 'cancel-target':
        app.targeting = null;
        render();
        break;
      case 'battle-retreat':
        confirmRetreat();
        break;
      case 'confirm-retreat':
        closeModal();
        app.battle = null;
        navigate('map');
        break;
      case 'result-map':
        closeModal();
        app.battle = null;
        navigate('map');
        break;
      case 'result-team':
        closeModal();
        app.battle = null;
        navigate('team');
        break;
      case 'result-retry': {
        const stageId = app.lastResult ? app.lastResult.result.stageId : null;
        closeModal();
        if (stageId) startBattle(stageId, true);
        break;
      }
      case 'result-next':
        closeModal();
        startBattle(id, true);
        break;
      case 'result-home':
        closeModal();
        app.battle = null;
        navigate('home');
        break;
      default:
        break;
    }
  }

  /* ---------- 启动 ---------- */

  function init() {
    const loaded = META.loadProfile();
    app.profile = loaded ? META.ensureProfile(loaded) : META.defaultProfile();
    app.selectedStage = META.bestStage(app.profile);
    save();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', route);
    route();
    if (app.screen === 'home' && !app.profile.flags.introSeen) maybeIntro();
    window.TA_UI = {
      app: app,
      render: render,
      startBattle: startBattle,
      doPull: doPull,
      reset: function () {
        app.profile = META.defaultProfile();
        save();
        app.battle = null;
        app.screen = 'home';
        location.hash = '#home';
        render();
        maybeIntro();
      }
    };
  }

  window.TA_UI_INTERNAL = { init: init };
})();

