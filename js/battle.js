/* 《真理学院》V2 昆特牌引擎。纯逻辑、可序列化（rngState 为数字），可由 Node 直接测试。
   规则见 docs/design-spec-v2.md。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./data.js'));
  else root.TA_BATTLE = factory(root.TA_DATA);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA) {
  'use strict';

  const ROWS = DATA.ROWS;
  const ROW_LABELS = DATA.ROW_LABELS;
  const SIDES = ['player', 'ai'];
  const SEALS = 2;
  const HAND_SIZE = 10;
  const MULLIGAN_MAX = 2;

  function other(side) {
    return side === 'player' ? 'ai' : 'player';
  }

  function isSide(side) {
    return side === 'player' || side === 'ai';
  }

  function isRow(row) {
    return ROWS.indexOf(row) !== -1;
  }

  /* ---------- 随机数（状态可序列化，便于复现与测试） ---------- */

  function nextRandom(state) {
    state.rngState = (state.rngState + 0x6d2b79f5) | 0;
    let t = state.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function shuffle(state, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom(state) * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ---------- 初始化 ---------- */

  function makeSide(deck) {
    return {
      seals: SEALS,
      deck: deck.slice(),
      hand: [],
      discard: [],
      passed: false,
      mulliganUsed: false,
      plays: 0,
      aura: 0,
      board: { axiom: [], reasoning: [], theorem: [] }
    };
  }

  function draw(state, side, count) {
    const s = state[side];
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (!s.deck.length) break;
      const id = s.deck.pop();
      s.hand.push(id);
      drawn.push(id);
    }
    return drawn;
  }

  function createMatch(options) {
    const opts = options || {};
    const seed = (Number(opts.seed) >>> 0) || 0x9e3779b9;
    const forcedFirst = opts.first === 'ai' || opts.first === 'player' ? opts.first : null;
    const state = {
      version: DATA.VERSION,
      stageId: opts.stageId || null,
      bossRule: opts.bossRule || null,
      round: 1,
      current: null,
      phase: 'mulligan',
      firstSide: forcedFirst || 'player',
      lastStarter: forcedFirst || 'player',
      uid: 1,
      rngState: seed,
      effects: { axiom: null, reasoning: null, theorem: null },
      lastRound: null,
      rounds: [],
      result: null,
      log: [],
      player: makeSide(opts.playerDeck || []),
      ai: makeSide(opts.aiDeck || [])
    };
    SIDES.forEach(function (side) {
      shuffle(state, state[side].deck);
      draw(state, side, HAND_SIZE);
    });
    if (!forcedFirst) {
      const first = nextRandom(state) < 0.5 ? 'player' : 'ai';
      state.firstSide = first;
      state.lastStarter = first;
      addLog(state, 'system', 1, '掷硬币：' + (first === 'player' ? '你先手' : '对手先手') + '。');
    }
    addLog(state, 'system', 1, '对局开始：双方各 2 枚真理印记，开局抽 10 张。');
    if (opts.skipMulligan) beginPlay(state);
    return state;
  }

  function addLog(state, side, round, text, kind) {
    state.log.push({ side: side, round: round, text: text, kind: kind || 'info' });
    if (state.log.length > 80) state.log.shift();
  }

  function beginPlay(state) {
    if (state.phase !== 'mulligan') return { ok: false, reason: '当前不在换牌阶段' };
    state.phase = 'play';
    state.current = state.firstSide;
    addLog(state, 'system', 1, '开始第一小局，' + (state.current === 'player' ? '你' : '对手') + '先手。');
    return { ok: true, reason: '' };
  }

  /* ---------- 重抽 ---------- */

  function mulligan(state, side, indices) {
    if (!isSide(side)) return { ok: false, reason: '未知的一方' };
    if (state.phase !== 'mulligan') return { ok: false, reason: '换牌阶段已结束' };
    const s = state[side];
    if (s.mulliganUsed) return { ok: false, reason: '每方只能重抽一次' };
    const list = Array.isArray(indices) ? indices.slice() : [];
    if (list.length > MULLIGAN_MAX) return { ok: false, reason: '最多重抽 2 张' };
    const unique = Array.from(new Set(list));
    if (unique.length !== list.length) return { ok: false, reason: '不能重复选择同一张牌' };
    for (const i of unique) {
      if (!Number.isInteger(i) || i < 0 || i >= s.hand.length) {
        return { ok: false, reason: '手牌位置无效' };
      }
    }
    if (!unique.length) {
      s.mulliganUsed = true;
      return { ok: true, reason: '', swapped: 0 };
    }
    unique.sort(function (a, b) { return b - a; });
    const returned = [];
    unique.forEach(function (i) {
      returned.push(s.hand.splice(i, 1)[0]);
    });
    s.deck = s.deck.concat(returned);
    shuffle(state, s.deck);
    draw(state, side, returned.length);
    s.mulliganUsed = true;
    addLog(state, side, state.round, (side === 'player' ? '你' : '对手') + '重抽了 ' + returned.length + ' 张牌。');
    return { ok: true, reason: '', swapped: returned.length, returned: returned };
  }

  /* ---------- 论证力 ---------- */

  function applyEffect(power, effect) {
    if (!effect) return Math.max(1, power);
    if (effect.mode === 'flat') return Math.max(1, power + (effect.value || 0));
    if (effect.mode === 'halve') return Math.max(1, Math.floor(power / 2));
    if (effect.mode === 'cap') return Math.max(1, Math.min(power, effect.value || 1));
    return Math.max(1, power);
  }

  function bondCount(state, side, bondId, excludeUid) {
    let count = 0;
    ROWS.forEach(function (row) {
      state[side].board[row].forEach(function (u) {
        if (excludeUid && u.uid === excludeUid) return;
        const def = DATA.CARD_MAP[u.id];
        if (def && def.bondId === bondId) count += 1;
      });
    });
    return count;
  }

  function unitPower(state, side, unit) {
    const def = DATA.CARD_MAP[unit.id];
    if (!def) return 0;
    let power = def.power || 0;
    if (def.ability === 'bond' && def.bondId) {
      const count = bondCount(state, side, def.bondId, null);
      if (count >= 2) power = power * 2;
    } else if (def.ability === 'corroborate') {
      const row = unit.row || def.row;
      const others = state[side].board[row].filter(function (u) {
        return u.uid !== unit.uid;
      }).length;
      power += 2 * others;
    }
    power += state[side].aura || 0;
    if (def.ability !== 'master') {
      power = applyEffect(power, state.effects[unit.row || def.row]);
    }
    return Math.max(1, power);
  }

  function calculateRowScore(state, side, row) {
    if (!state[side] || !isRow(row)) return 0;
    return state[side].board[row].reduce(function (sum, unit) {
      return sum + unitPower(state, side, unit);
    }, 0);
  }

  function calculateTotalScore(state, side) {
    return ROWS.reduce(function (sum, row) {
      return sum + calculateRowScore(state, side, row);
    }, 0);
  }

  function calculateScore(state) {
    return {
      player: calculateTotalScore(state, 'player'),
      ai: calculateTotalScore(state, 'ai')
    };
  }

  function rowScores(state, side) {
    const out = {};
    ROWS.forEach(function (row) { out[row] = calculateRowScore(state, side, row); });
    return out;
  }

  /* ---------- 出牌 ---------- */

  function findUnit(state, side, uid) {
    for (const row of ROWS) {
      const unit = state[side].board[row].find(function (u) { return u.uid === uid; });
      if (unit) return { row: row, unit: unit };
    }
    return null;
  }

  function validateSpecial(state, side, def, opts) {
    const o = opts || {};
    const opp = other(side);
    if (def.ability === 'counterexample') {
      if (!isRow(o.row)) return '请选择对方的一排';
    } else if (def.ability === 'citation') {
      const id = state[side].discard[o.discardIndex];
      const d = DATA.CARD_MAP[id];
      if (!d || d.type !== 'unit' || d.token) return '弃牌堆中没有可引证的单位';
    } else if (def.ability === 'withdraw') {
      const found = findUnit(state, side, o.unitUid);
      if (!found) return '请选择己方一张单位';
      if (DATA.CARD_MAP[found.unit.id].ability === 'master') return '巨匠不能被撤回';
    } else if (def.ability === 'reductio') {
      const target = highestOpponentUnit(state, side);
      if (!target) return '对方没有可摧毁的非巨匠单位';
    } else if (def.ability === 'clarify') {
      if (!isRow(o.row) || !state.effects[o.row]) return '该排没有需要澄清的悖论';
    } else if (def.ability === 'paradox') {
      if (!isRow(o.row)) return '请选择一排';
    }
    return null;
  }

  function highestOpponentUnit(state, side) {
    const opp = other(side);
    let best = null;
    ROWS.forEach(function (row) {
      state[opp].board[row].forEach(function (unit) {
        const def = DATA.CARD_MAP[unit.id];
        if (def.ability === 'master') return;
        const power = unitPower(state, opp, unit);
        if (!best || power > best.power || (power === best.power && unit.uid < best.unit.uid)) {
          best = { row: row, unit: unit, power: power };
        }
      });
    });
    return best;
  }

  function spawnUnit(state, side, cardId, row) {
    const def = DATA.CARD_MAP[cardId];
    const unit = { uid: state.uid++, id: cardId, row: row };
    state[side].board[row].push(unit);
    addLog(state, side, state.round,
      (side === 'player' ? '你' : '对手') + '在' + ROW_LABELS[row] + '生成「' + def.name + '」（' + (def.power || 0) + '）。',
      'spawn');
    return unit;
  }

  function playCard(state, side, handIndex, opts) {
    if (!isSide(side)) return { ok: false, reason: '未知的一方' };
    if (state.phase !== 'play') return { ok: false, reason: '当前不能出牌' };
    if (state.current !== side) return { ok: false, reason: side === 'ai' ? '还没轮到对手' : '还没轮到你' };
    const s = state[side];
    if (s.passed) return { ok: false, reason: '已 Pass，本小局不能再出牌' };
    if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= s.hand.length) {
      return { ok: false, reason: '手牌不存在' };
    }
    const cardId = s.hand[handIndex];
    const def = DATA.CARD_MAP[cardId];
    if (!def) return { ok: false, reason: '未知卡牌' };
    const o = opts || {};
    if (def.type === 'unit') {
      if (o.row && o.row !== def.row) {
        return { ok: false, reason: '「' + def.name + '」只能进入' + ROW_LABELS[def.row] };
      }
    } else {
      const err = validateSpecial(state, side, def, o);
      if (err) return { ok: false, reason: err };
    }

    /* 通过校验，开始结算 */
    s.hand.splice(handIndex, 1);
    s.plays = (s.plays || 0) + 1;
    if (def.type === 'unit') {
      const unit = { uid: state.uid++, id: cardId, row: def.row };
      s.board[def.row].push(unit);
      addLog(state, side, state.round,
        (side === 'player' ? '你' : '对手') + '打出「' + def.name + '」到' + ROW_LABELS[def.row] +
        '（' + unitPower(state, side, unit) + '）。', 'play');
    } else {
      applySpecial(state, side, def, o);
      s.discard.push(cardId);
      addLog(state, side, state.round,
        (side === 'player' ? '你' : '对手') + '使用「' + def.name + '」。', 'special');
    }
    finishAction(state, side);
    return { ok: true, reason: '' };
  }

  function applySpecial(state, side, def, opts) {
    const opp = other(side);
    if (def.ability === 'counterexample') {
      spawnUnit(state, opp, 'counterexample-token', opts.row);
      const drawn = draw(state, side, 1);
      if (drawn.length) {
        addLog(state, side, state.round, (side === 'player' ? '你' : '对手') + '抽了 1 张牌。', 'draw');
      }
    } else if (def.ability === 'citation') {
      const idx = opts.discardIndex;
      const id = state[side].discard[idx];
      const d = DATA.CARD_MAP[id];
      state[side].discard.splice(idx, 1);
      const unit = { uid: state.uid++, id: id, row: d.row };
      state[side].board[d.row].push(unit);
      addLog(state, side, state.round,
        (side === 'player' ? '你' : '对手') + '引证「' + d.name + '」回到' + ROW_LABELS[d.row] + '。', 'revive');
    } else if (def.ability === 'withdraw') {
      const found = findUnit(state, side, opts.unitUid);
      const idx = state[side].board[found.row].findIndex(function (u) { return u.uid === found.unit.uid; });
      const target = DATA.CARD_MAP[found.unit.id];
      state[side].board[found.row].splice(idx, 1);
      state[side].hand.push(found.unit.id);
      addLog(state, side, state.round,
        (side === 'player' ? '你' : '对手') + '撤回「' + target.name + '」回到手牌。', 'withdraw');
    } else if (def.ability === 'reductio') {
      const target = highestOpponentUnit(state, side);
      const list = state[opp].board[target.row];
      const idx = list.findIndex(function (u) { return u.uid === target.unit.uid; });
      const removed = list.splice(idx, 1)[0];
      state[opp].discard.push(removed.id);
      addLog(state, side, state.round,
        (side === 'player' ? '你' : '对手') + '用反证法摧毁了「' +
        DATA.CARD_MAP[removed.id].name + '」（' + target.power + '）。', 'destroy');
    } else if (def.ability === 'consensus') {
      state[side].aura += 2;
      addLog(state, side, state.round,
        (side === 'player' ? '你' : '对手') + '达成学术共识：己方单位 +2。', 'buff');
    } else if (def.ability === 'clarify') {
      const old = state.effects[opts.row];
      state.effects[opts.row] = null;
      addLog(state, side, state.round,
        '公理澄清解除了' + ROW_LABELS[opts.row] + '上的「' + (old ? old.name : '悖论') + '」。', 'clarify');
    } else if (def.ability === 'paradox') {
      state.effects[opts.row] = {
        cardId: def.id,
        name: def.name,
        mode: def.effect.mode,
        value: def.effect.value
      };
      addLog(state, side, state.round,
        (side === 'player' ? '你' : '对手') + '让「' + def.name + '」笼罩' + ROW_LABELS[opts.row] + '。', 'paradox');
    }
  }

  function finishAction(state, side) {
    if (state.phase !== 'play') return;
    if (state.player.passed && state.ai.passed) {
      resolveRound(state);
      return;
    }
    const opp = other(side);
    state.current = state[opp].passed ? side : opp;
  }

  /* ---------- Pass 与结算 ---------- */

  function pass(state, side) {
    if (!isSide(side)) return { ok: false, reason: '未知的一方' };
    if (state.phase !== 'play') return { ok: false, reason: '当前不能 Pass' };
    if (state.current !== side) return { ok: false, reason: side === 'ai' ? '还没轮到对手' : '还没轮到你' };
    const s = state[side];
    if (s.passed) return { ok: false, reason: '本小局已经 Pass' };
    s.passed = true;
    addLog(state, side, state.round, (side === 'player' ? '你' : '对手') + '选择 Pass。', 'pass');
    if (state.player.passed && state.ai.passed) {
      resolveRound(state);
      return { ok: true, reason: '' };
    }
    state.current = other(side);
    return { ok: true, reason: '' };
  }

  function checkRoundEnd(state) {
    return state.player.passed && state.ai.passed;
  }

  function checkMatchEnd(state) {
    if (state.result) return state.result;
    if (state.player.seals > 0 && state.ai.seals > 0) return null;
    const winner = state.player.seals === state.ai.seals ? 'draw' : (state.player.seals > state.ai.seals ? 'player' : 'ai');
    return { winner: winner };
  }

  function resolveRound(state) {
    if (state.phase !== 'play') return null;
    if (!checkRoundEnd(state)) return null;
    const playerScore = calculateTotalScore(state, 'player');
    const aiScore = calculateTotalScore(state, 'ai');
    let winner;
    if (playerScore > aiScore) winner = 'player';
    else if (aiScore > playerScore) winner = 'ai';
    else winner = 'draw';

    if (winner === 'player') state.ai.seals = Math.max(0, state.ai.seals - 1);
    else if (winner === 'ai') state.player.seals = Math.max(0, state.player.seals - 1);
    else {
      state.player.seals = Math.max(0, state.player.seals - 1);
      state.ai.seals = Math.max(0, state.ai.seals - 1);
    }

    const summary = {
      round: state.round,
      playerScore: playerScore,
      aiScore: aiScore,
      playerRows: rowScores(state, 'player'),
      aiRows: rowScores(state, 'ai'),
      winner: winner,
      seals: { player: state.player.seals, ai: state.ai.seals }
    };
    state.lastRound = summary;
    state.rounds.push(summary);
    state.phase = 'roundEnd';
    state.current = null;

    const text = winner === 'draw'
      ? '双方论证力相同，各失去 1 枚真理印记。'
      : (winner === 'player' ? '你' : '对手') + '以 ' +
        (winner === 'player' ? playerScore + ' : ' + aiScore : aiScore + ' : ' + playerScore) +
        ' 赢下小局，' + (winner === 'player' ? '对手' : '你') + '失去 1 枚真理印记。';
    addLog(state, 'system', state.round, '第 ' + state.round + ' 小局结束：' + text, 'round');

    const ended = checkMatchEnd(state);
    if (ended) {
      state.phase = 'matchEnd';
      state.result = {
        winner: ended.winner,
        playerSeals: state.player.seals,
        aiSeals: state.ai.seals,
        rounds: state.rounds.length,
        roundHistory: state.rounds.slice()
      };
    }
    return summary;
  }

  function startNextRound(state) {
    if (state.phase !== 'roundEnd') return { ok: false, reason: '当前不能开始下一小局' };
    const finished = state.lastRound;
    state.lastWinner = finished ? finished.winner : null;
    SIDES.forEach(function (side) {
      ROWS.forEach(function (row) {
        state[side].board[row].forEach(function (unit) {
          const def = DATA.CARD_MAP[unit.id];
          if (!def.token) state[side].discard.push(unit.id);
        });
        state[side].board[row] = [];
      });
      state[side].passed = false;
      state[side].plays = 0;
      state[side].aura = 0;
    });
    state.effects = { axiom: null, reasoning: null, theorem: null };
    state.round += 1;
    state.lastRound = null;
    state.phase = 'play';

    if (state.bossRule === 'self-reference' && state.round > 1) {
      const row = ROWS[Math.floor(nextRandom(state) * ROWS.length)];
      state.effects[row] = {
        cardId: 'russell',
        name: '罗素悖论',
        mode: 'halve',
        value: 0
      };
      addLog(state, 'system', state.round,
        '自指：罗素悖论自动笼罩' + ROW_LABELS[row] + '。', 'boss');
    }

    let starter;
    if (!finished || finished.winner === 'draw') {
      starter = other(state.lastStarter || 'player');
    } else {
      starter = finished.winner;
    }
    state.lastStarter = starter;
    state.current = starter;
    addLog(state, 'system', state.round,
      '第 ' + state.round + ' 小局开始，' + (starter === 'player' ? '你' : '对手') + '先手。' +
      '手牌与牌库保留，不自动抽牌。', 'round');
    return { ok: true, reason: '', round: state.round, starter: starter };
  }

  return {
    SIDES: SIDES,
    ROWS: ROWS,
    ROW_LABELS: ROW_LABELS,
    SEALS: SEALS,
    HAND_SIZE: HAND_SIZE,
    MULLIGAN_MAX: MULLIGAN_MAX,
    other: other,
    createMatch: createMatch,
    mulligan: mulligan,
    beginPlay: beginPlay,
    playCard: playCard,
    pass: pass,
    resolveRound: resolveRound,
    startNextRound: startNextRound,
    calculateRowScore: calculateRowScore,
    calculateTotalScore: calculateTotalScore,
    calculateScore: calculateScore,
    rowScores: rowScores,
    unitPower: unitPower,
    checkRoundEnd: checkRoundEnd,
    checkMatchEnd: checkMatchEnd,
    highestOpponentUnit: highestOpponentUnit,
    findUnit: findUnit,
    draw: draw,
    nextRandom: nextRandom,
    addLog: addLog
  };
});
