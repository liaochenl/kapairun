/* 《真理学院》V2 AI：合法行动 → 连续追分模拟（Beam Search）→ Pass 判断。
   不依赖 DOM；不修改传入的 state（所有试算都在克隆上完成）。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./data.js'), require('./battle.js'));
  else root.TA_AI = factory(root.TA_DATA, root.TA_BATTLE);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA, BATTLE) {
  'use strict';

  const ROWS = DATA.ROWS;
  const BEAM_WIDTH = 20;
  const MAX_DEPTH = 10;

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function handGain(state, side, handIndex, opts) {
    const before = BATTLE.calculateScore(state);
    const copy = clone(state);
    const res = BATTLE.playCard(copy, side, handIndex, opts || {});
    if (!res.ok) return null;
    const after = BATTLE.calculateScore(copy);
    const opp = BATTLE.other(side);
    let gain = (after[side] - before[side]) - (after[opp] - before[opp]);
    const def = DATA.CARD_MAP[state[side].hand[handIndex]];
    if (def.ability === 'counterexample') gain += 5;
    else if (def.ability === 'citation') gain += 1;
    else if (def.ability === 'consensus') gain += 2;
    else if (def.ability === 'withdraw') gain += 3;
    return { gain: gain, state: copy };
  }

  function targetOptions(state, side, def) {
    if (def.type === 'unit') return [{ row: def.row }];
    if (def.ability === 'counterexample') {
      return ROWS.map(function (row) { return { row: row }; });
    }
    if (def.ability === 'citation') {
      const out = [];
      state[side].discard.forEach(function (id, index) {
        const d = DATA.CARD_MAP[id];
        if (d && d.type === 'unit' && !d.token) out.push({ discardIndex: index });
      });
      return out;
    }
    if (def.ability === 'withdraw') {
      const out = [];
      ROWS.forEach(function (row) {
        state[side].board[row].forEach(function (unit) {
          const d = DATA.CARD_MAP[unit.id];
          if (d.ability !== 'master' && !d.token) out.push({ unitUid: unit.uid });
        });
      });
      return out;
    }
    if (def.ability === 'clarify') {
      return ROWS.filter(function (row) { return !!state.effects[row]; })
        .map(function (row) { return { row: row }; });
    }
    if (def.ability === 'paradox') {
      return ROWS.map(function (row) { return { row: row }; });
    }
    if (def.ability === 'negate' || def.ability === 'draw') return [{}];
    if (def.ability === 'diagonal') {
      return ROWS.filter(function (row) {
        return state[BATTLE.other(side)].board[row].length >= 3;
      }).map(function (row) { return { row: row }; });
    }
    if (def.ability === 'axiomatize') {
      const out = [];
      ROWS.forEach(function (row) {
        state[side].board[row].forEach(function (unit) {
          if (unit.axiomized) return;
          if (DATA.CARD_MAP[unit.id].ability === 'master') return;
          out.push({ unitUid: unit.uid });
        });
      });
      return out;
    }
    return [{}];
  }

  function candidateActions(state, side) {
    const hand = state[side].hand;
    const actions = [];
    hand.forEach(function (id, index) {
      const def = DATA.CARD_MAP[id];
      if (!def) return;
      const options = targetOptions(state, side, def);
      options.forEach(function (opts) {
        const result = handGain(state, side, index, opts);
        if (!result) return;
        actions.push({
          index: index,
          cardId: id,
          def: def,
          opts: opts,
          gain: result.gain,
          state: result.state
        });
      });
    });
    actions.sort(function (a, b) { return b.gain - a.gain; });
    return actions;
  }

  /* 把状态改造成“轮到 side 连续行动，对手已 Pass”的模拟场。 */
  function prepareSimulation(state, side) {
    const sim = clone(state);
    const opp = BATTLE.other(side);
    sim.phase = 'play';
    sim.current = side;
    sim[side].passed = false;
    sim[side].plays = 0;
    sim[opp].passed = true;
    return sim;
  }

  /* 连续行动模拟：从当前场面出发，交替枚举合法动作，直到超过 targetScore。
     返回 { catchable, cardsNeeded, finalScore, sequence }。
     sequence[0] 是这条追分路线应该打出的第一张牌。 */
  function estimateCatchup(state, side, targetScore, options) {
    if (state.phase === 'matchEnd' || state.result) {
      return { catchable: false, cardsNeeded: Infinity, finalScore: 0, sequence: [] };
    }
    const sim = prepareSimulation(state, side);
    const opp = BATTLE.other(side);
    const target = targetScore == null ? BATTLE.calculateTotalScore(sim, opp) : targetScore;
    const startScore = BATTLE.calculateTotalScore(sim, side);
    const startOpp = BATTLE.calculateTotalScore(sim, opp);
    if (startScore > target) {
      return { catchable: true, cardsNeeded: 0, finalScore: startScore, sequence: [] };
    }

    const beamWidth = (options && options.beamWidth) || BEAM_WIDTH;
    const maxDepth = Math.min(sim[side].hand.length, (options && options.maxDepth) || MAX_DEPTH);
    let frontier = [{ state: sim, sequence: [], score: startScore }];
    let bestScore = startScore;
    let bestSequence = [];

    for (let depth = 1; depth <= maxDepth; depth++) {
      const next = [];
      for (let f = 0; f < frontier.length; f++) {
        const node = frontier[f];
        const actions = candidateActions(node.state, side);
        for (let a = 0; a < actions.length; a++) {
          const action = actions[a];
          const score = BATTLE.calculateTotalScore(action.state, side);
          /* 对手分数如果因自己的牌变化（例如反例给对手 +1），目标分也要跟着变。 */
          const goal = target + (BATTLE.calculateTotalScore(action.state, opp) - startOpp);
          const sequence = node.sequence.concat([action]);
          if (score > bestScore) {
            bestScore = score;
            bestSequence = sequence;
          }
          if (score > goal) {
            return {
              catchable: true,
              cardsNeeded: depth,
              finalScore: score,
              sequence: sequence
            };
          }
          next.push({ state: action.state, sequence: sequence, score: score });
        }
      }
      if (!next.length) break;
      next.sort(function (a, b) { return b.score - a.score; });
      frontier = next.slice(0, beamWidth);
    }

    return {
      catchable: false,
      cardsNeeded: Infinity,
      finalScore: bestScore,
      sequence: bestSequence
    };
  }

  function playAction(action, reason) {
    return {
      type: 'play',
      index: action.index,
      cardId: action.cardId,
      opts: action.opts,
      gain: action.gain,
      reason: reason
    };
  }

  const DEFAULT_PROFILE = {
    aggression: 0.5,
    conserve: 0.5,
    bluff: 0.2,
    comboBias: 0.6,
    controlBias: 0.3
  };

  function profileOf(profile) {
    return Object.assign({}, DEFAULT_PROFILE, profile || {});
  }

  function comboFirst(state, side) {
    const target = BATTLE.calculateTotalScore(state, side) + 4;
    const future = estimateCatchup(state, side, target);
    return future.sequence[0] || null;
  }

  function controlAction(actions) {
    const controls = ['negate', 'reductio', 'diagonal', 'axiomatize', 'clarify'];
    return actions.find(function (a) {
      return controls.indexOf(a.def.ability) !== -1 && a.gain > 0;
    }) || null;
  }

  function chooseAction(state, side, profile) {
    const ai = profileOf(profile);
    const opp = BATTLE.other(side);
    if (state.phase !== 'play' || state.current !== side) return { type: 'pass', reason: 'not-turn' };
    const me = state[side];
    const them = state[opp];
    if (me.passed) return { type: 'pass', reason: 'already-passed' };
    if (!me.hand.length) return { type: 'pass', reason: 'empty-hand', value: 0 };

    const actions = candidateActions(state, side);
    const best = actions[0];
    if (!best || best.gain <= 0) return { type: 'pass', reason: 'no-good-action', value: 0 };

    const myScore = BATTLE.calculateTotalScore(state, side);
    const oppScore = BATTLE.calculateTotalScore(state, opp);
    const diff = myScore - oppScore;
    const mustWin = me.seals === 1;
    const oppPassed = them.passed;
    const mePlays = me.plays || 0;

    /* 第 2 小局、刚赢下第 1 小局且对手未动：直接 Pass，保留手牌打决胜局。 */
    if (state.round === 2 && mePlays === 0 && state.lastWinner === 'ai' && me.seals === 2 && ai.conserve >= 0.5) {
      return { type: 'pass', reason: 'dry-pass', value: 0 };
    }

    if (oppPassed) {
      if (diff > 0) return { type: 'pass', reason: 'ahead-and-opponent-passed', value: 0 };
      const chase = estimateCatchup(state, side, oppScore);
      if (!chase.catchable) return { type: 'pass', reason: 'cannot-catch-up', value: 0 };
      // 让局：需要三张以上、且还有两枚印记时，保留手牌打下一局。
      if (!mustWin && chase.cardsNeeded >= 3 && me.seals >= 2) {
        return { type: 'pass', reason: 'too-expensive-to-catch-up', value: 0 };
      }
      if (!mustWin && me.seals >= 2 && chase.cardsNeeded >= 2 && me.hand.length <= 2) {
        return { type: 'pass', reason: 'save-cards', value: 0 };
      }
      const first = chase.sequence[0];
      if (!first) return { type: 'pass', reason: 'no-sequence', value: 0 };
      return playAction(first, 'fight-for-round');
    }

    /* 第 1 小局的手牌预算：由 aggression / conserve 调整，避免把整手牌倒在第一局。 */
    const budget = Math.max(2, Math.min(7, Math.round(4 + (ai.aggression - 0.5) * 3 - (ai.conserve - 0.5) * 3 + ai.bluff * 2)));
    if (state.round === 1 && me.seals === 2 && mePlays >= budget) {
      return { type: 'pass', reason: 'round-budget', value: 0 };
    }

    if (diff > 0) {
      if (them.hand.length === 0) return { type: 'pass', reason: 'opponent-empty-hand', value: 0 };
      // 如果 AI 现在 Pass，对手连续行动能不能反超？不能才安全 Pass。
      const threat = estimateCatchup(state, opp, myScore);
      if (!threat.catchable) {
        return { type: 'pass', reason: 'lead-unreachable', value: 0 };
      }
      const control = ai.controlBias >= 0.65 ? controlAction(actions) : null;
      if (control) return playAction(control, 'press-lead-control');
      if (ai.comboBias >= 0.7) {
        const first = comboFirst(state, side);
        if (first) return playAction(first, 'press-lead-combo');
      }
      return playAction(best, 'press-lead');
    }

    if (diff < 0) {
      const chase = estimateCatchup(state, side, oppScore);
      if (!chase.catchable && !mustWin && me.seals >= 2) {
        return { type: 'pass', reason: 'cannot-catch-up', value: 0 };
      }
      const first = chase.sequence[0] || best;
      return playAction(first, 'catch-up');
    }

    if (ai.comboBias >= 0.7) {
      const first = comboFirst(state, side);
      if (first) return playAction(first, 'open-round-combo');
    }
    return playAction(best, 'open-round');
  }

  /* 换牌：换掉最没有保留价值的两张（重复的联动牌与低价值策略牌）。 */
  function keepValue(state, side, id) {
    const def = DATA.CARD_MAP[id];
    if (!def) return 0;
    if (def.type === 'unit') {
      let value = def.power + (def.ability === 'corroborate' ? 2 : 0);
      if (def.ability === 'bond') {
        const inHand = state[side].hand.filter(function (x) { return x === id; }).length;
        value += 2 * inHand;
      }
      return value;
    }
    const specialValues = {
      counterexample: 8,
      citation: 5,
      consensus: 6,
      withdraw: 2,
      reductio: 4,
      clarify: 1,
      paradox: 3,
      negate: 6,
      diagonal: 5,
      axiomatize: 4,
      draw: 7
    };
    return specialValues[def.ability] || 2;
  }

  function autoMulligan(state, side) {
    if (state.phase !== 'mulligan') return { ok: false, reason: '不在换牌阶段' };
    const s = state[side];
    if (s.mulliganUsed) return { ok: false, reason: '已经换过牌' };
    const scored = s.hand.map(function (id, index) {
      return { index: index, value: keepValue(state, side, id) };
    }).sort(function (a, b) { return a.value - b.value; });
    const chosen = scored.slice(0, BATTLE.MULLIGAN_MAX)
      .filter(function (x) { return x.value <= 4; })
      .map(function (x) { return x.index; });
    return BATTLE.mulligan(state, side, chosen);
  }

  /* 让 AI 走一步。UI 直接调用。 */
  function act(state, side, profile) {
    const action = chooseAction(state, side, profile);
    if (action.type === 'pass') {
      const res = BATTLE.pass(state, side);
      return { ok: res.ok, action: action, reason: res.reason };
    }
    const res = BATTLE.playCard(state, side, action.index, action.opts);
    return { ok: res.ok, action: action, reason: res.reason };
  }

  return {
    chooseAction: chooseAction,
    candidateActions: candidateActions,
    estimateCatchup: estimateCatchup,
    prepareSimulation: prepareSimulation,
    autoMulligan: autoMulligan,
    act: act,
    keepValue: keepValue
  };
});
