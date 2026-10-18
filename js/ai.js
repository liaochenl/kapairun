/* 《真理学院》V2 AI：合法行动 → 即时收益 → Pass 判断。
   不依赖 DOM；不修改传入的 state（所有试算都在克隆上完成）。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./data.js'), require('./battle.js'));
  else root.TA_AI = factory(root.TA_DATA, root.TA_BATTLE);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA, BATTLE) {
  'use strict';

  const ROWS = DATA.ROWS;

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function handGain(state, side, handIndex, opts) {
    const before = BATTLE.calculateScore(state);
    const copy = clone(state);
    const res = BATTLE.playCard(copy, side, handIndex, opts || {});
    if (!res.ok) return null;
    const after = BATTLE.calculateScore(copy);
    const me = state === copy ? side : side;
    const opp = BATTLE.other(side);
    let gain = (after[me] - before[me]) - (after[opp] - before[opp]);
    const def = DATA.CARD_MAP[state[side].hand[handIndex]];
    if (def.ability === 'counterexample') gain += 5;
    else if (def.ability === 'citation') gain += 1;
    else if (def.ability === 'consensus') gain += 2;
    else if (def.ability === 'withdraw') gain += 3;
    // 抽牌与手牌价值：反例的抽牌已经体现在 +5，其余不重复计算。
    return { gain: gain, state: copy };
  }

  function targetOptions(state, side, def) {
    const opp = BATTLE.other(side);
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
          if (d.ability !== 'master') out.push({ unitUid: unit.uid });
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

  function capacity(state, side, actions) {
    const bestPerHand = {};
    (actions || candidateActions(state, side)).forEach(function (a) {
      if (a.gain <= 0) return;
      // 按手牌位置统计，不按 cardId 去重：三张三角形就是三份追分能力。
      const key = a.index;
      if (!bestPerHand[key] || a.gain > bestPerHand[key]) bestPerHand[key] = a.gain;
    });
    return Object.keys(bestPerHand).reduce(function (sum, key) {
      return sum + bestPerHand[key];
    }, 0);
  }

  function minCardsToOvertake(gains, need) {
    const sorted = gains.slice().sort(function (a, b) { return b - a; });
    let sum = 0;
    for (let i = 0; i < sorted.length; i++) {
      sum += sorted[i];
      if (sum > need) return i + 1;
    }
    return Infinity;
  }

  function bestGains(actions) {
    const bestPerHand = {};
    actions.forEach(function (a) {
      if (a.gain <= 0) return;
      const key = a.index;
      if (!bestPerHand[key] || a.gain > bestPerHand[key]) bestPerHand[key] = a.gain;
    });
    return Object.keys(bestPerHand).map(function (key) { return bestPerHand[key]; });
  }

  function chooseAction(state, side) {
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
    const myCapacity = capacity(state, side, actions);
    const gains = bestGains(actions);
    const mePlays = me.plays || 0;

    /* 第 2 小局、刚赢下第 1 小局且对手未动：直接 Pass，保留手牌打决胜局。 */
    if (state.round === 2 && mePlays === 0 && state.lastWinner === 'ai' && me.seals === 2) {
      return { type: 'pass', reason: 'dry-pass', value: 0 };
    }

    if (oppPassed) {
      if (diff > 0) return { type: 'pass', reason: 'ahead-and-opponent-passed', value: 0 };
      if (diff === 0) return playAction(best, 'take-lead');
      const need = -diff;
      if (myCapacity < need) return { type: 'pass', reason: 'cannot-catch-up', value: 0 };
      const needed = minCardsToOvertake(gains, need);
      if (!isFinite(needed)) return { type: 'pass', reason: 'cannot-catch-up', value: 0 };
      // 让局：需要三张以上、且还有两枚印记时，保留手牌打下一局。
      if (!mustWin && needed >= 3 && me.seals >= 2) {
        return { type: 'pass', reason: 'too-expensive-to-catch-up', value: 0 };
      }
      if (!mustWin && me.seals >= 2 && needed >= 2 && me.hand.length <= 2) {
        return { type: 'pass', reason: 'save-cards', value: 0 };
      }
      return playAction(best, 'fight-for-round');
    }

    /* 第 1 小局的手牌预算：打满 4 张就收手，避免把整手牌倒在第一局。 */
    if (state.round === 1 && me.seals === 2 && mePlays >= 4) {
      return { type: 'pass', reason: 'round-budget', value: 0 };
    }

    if (diff > 0) {
      if (them.hand.length === 0) return { type: 'pass', reason: 'opponent-empty-hand', value: 0 };
      const oppCapacity = capacity(state, opp);
      if (diff >= oppCapacity && them.hand.length <= 4) {
        return { type: 'pass', reason: 'lead-unreachable', value: 0 };
      }
      if (diff >= 12 && me.seals >= 2 && them.hand.length <= 2) {
        return { type: 'pass', reason: 'big-lead-save-cards', value: 0 };
      }
      return playAction(best, 'press-lead');
    }

    if (diff < 0) {
      if (myCapacity < -diff && !mustWin && me.seals >= 2) {
        return { type: 'pass', reason: 'cannot-catch-up', value: 0 };
      }
      return playAction(best, 'catch-up');
    }

    return playAction(best, 'open-round');
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
      paradox: 3
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
  function act(state, side) {
    const action = chooseAction(state, side);
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
    autoMulligan: autoMulligan,
    act: act,
    capacity: capacity,
    keepValue: keepValue
  };
});
