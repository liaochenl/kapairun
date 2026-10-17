/* 《真理学院》战斗引擎。纯逻辑、可序列化、可由 Node 测试。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./data.js'), require('./rng.js'));
  } else {
    root.TA_BATTLE = factory(root.TA_DATA, root.TA_RNG);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA, RNG) {
  'use strict';

  const TAGS = DATA.TAGS;
  const STATUSES = DATA.STATUSES;

  /* ---------- 数值 ---------- */

  function computeStats(def, member) {
    const level = Math.max(1, Math.min(30, member.level || 1));
    const dupes = Math.max(0, Math.min(5, member.dupes || 0));
    const ascension = Math.max(0, Math.min(2, member.ascension || 0));
    const dupeMul = 1 + dupes * 0.06;
    const ascMul = 1 + ascension * 0.1;
    return {
      level,
      hp: Math.round((def.base.hp + def.growth.hp * (level - 1)) * dupeMul * ascMul),
      atk: Math.round((def.base.atk + def.growth.atk * (level - 1)) * dupeMul * ascMul),
      def: Math.round((def.base.def + def.growth.def * (level - 1)) * dupeMul * ascMul * 10) / 10
    };
  }

  function scaleEnemy(base, level) {
    return {
      hp: Math.round(base.hp * (1 + 0.085 * (level - 1))),
      atk: Math.round(base.atk * (1 + 0.055 * (level - 1))),
      def: Math.round((base.def + 0.28 * (level - 1)) * 10) / 10
    };
  }

  /* ---------- 创建 ---------- */

  function makeScholar(member, idx) {
    const def = DATA.SCHOLAR_MAP[member.id];
    if (!def) throw new Error('未知学者：' + member.id);
    const stats = computeStats(def, member);
    return {
      uid: 's' + idx,
      side: 'ally',
      id: def.id,
      name: def.name,
      rarity: def.rarity,
      school: def.school,
      level: stats.level,
      hp: stats.hp,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      shield: 0,
      statuses: [],
      usedFormulas: [],
      cooldowns: { axiom: 0 },
      alive: true
    };
  }

  function makeEnemy(base, level, idx) {
    const stats = scaleEnemy(base, level);
    return {
      uid: 'e' + idx,
      side: 'enemy',
      id: base.id,
      name: base.name,
      title: base.title,
      boss: !!base.boss,
      hp: stats.hp,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      weakness: base.weakness || null,
      resist: base.resist || null,
      passive: base.passive || null,
      shield: 0,
      paradoxShield: base.paradoxShield || 0,
      statuses: [],
      pattern: base.pattern,
      phasePattern: base.phase2 ? base.phase2.pattern : null,
      phase2At: base.phase2 ? base.phase2.at : null,
      phase2Text: base.phase2 ? base.phase2.text : null,
      phase2Effects: base.phase2 ? base.phase2.effects : null,
      phase: 1,
      phase2Used: false,
      patternIndex: 0,
      chargeBonus: 0,
      reviveUsed: false,
      evadeUsed: false,
      alive: true,
      level: level
    };
  }

  function createBattle(opts) {
    const stage = DATA.STAGE_MAP[opts.stageId];
    if (!stage) throw new Error('未知关卡：' + opts.stageId);
    const team = opts.team || [];
    if (!team.length) throw new Error('队伍为空');
    const seed = opts.seed == null ? (Date.now() >>> 0) : (opts.seed >>> 0);
    const rng = RNG.createRng(seed);
    const scholars = team.map(makeScholar);
    const enemies = stage.enemyIds.map(function (id, i) {
      return makeEnemy(DATA.ENEMY_MAP[id], stage.level, i);
    });
    const state = {
      stageId: stage.id,
      stageName: stage.name,
      stageKind: stage.kind,
      stageSubtitle: stage.subtitle,
      level: stage.level,
      par: stage.par,
      turn: 1,
      phase: 'player',
      ap: 3,
      maxAp: 3,
      chain: [],
      theoremsThisTurn: [],
      comboCount: 0,
      discovered: [],
      scholars: scholars,
      enemies: enemies,
      log: [],
      lastTheorem: null,
      result: null,
      seed: seed,
      rng: rng
    };
    log(state, '第 1 回合 · 你的行动', 'turn');
    return state;
  }

  /* ---------- 查询 ---------- */

  function findScholar(state, uid) {
    return state.scholars.find(function (s) { return s.uid === uid; });
  }

  function findEnemy(state, uid) {
    return state.enemies.find(function (e) { return e.uid === uid; });
  }

  function getScholarDef(scholar) {
    return DATA.SCHOLAR_MAP[scholar.id];
  }

  function formulasOf(scholar) {
    return getScholarDef(scholar).formulas;
  }

  function getFormula(scholar, formulaId) {
    return formulasOf(scholar).find(function (f) { return f.id === formulaId; }) || null;
  }

  function getAxiom(scholar) {
    return getScholarDef(scholar).axiom;
  }

  function aliveScholars(state) {
    return state.scholars.filter(function (s) { return s.alive; });
  }

  function aliveEnemies(state) {
    return state.enemies.filter(function (e) { return e.alive; });
  }

  function hasStatus(unit, id) {
    return !!unit.statuses.find(function (s) { return s.id === id && s.turns > 0; });
  }

  function statusValue(unit, id) {
    return unit.statuses.reduce(function (sum, s) {
      return s.id === id && s.turns > 0 ? sum + (s.value || 0) : sum;
    }, 0);
  }

  function statMul(unit, stat) {
    let mul = 1;
    unit.statuses.forEach(function (s) {
      if (s.turns <= 0) return;
      if (stat === 'atk' && s.id === 'atkUp') mul += s.value || 0;
      if (stat === 'atk' && s.id === 'atkDown') mul -= s.value || 0;
      if (stat === 'def' && s.id === 'defUp') mul += s.value || 0;
      if (stat === 'def' && s.id === 'defDown') mul -= s.value || 0;
    });
    return Math.max(0.1, mul);
  }

  function effAtk(unit) {
    return unit.atk * statMul(unit, 'atk');
  }

  function effDef(unit) {
    return Math.max(0, unit.def * statMul(unit, 'def'));
  }

  function vulnMul(unit) {
    return 1 + statusValue(unit, 'vuln');
  }

  /* ---------- 日志与事件 ---------- */

  function log(state, text, kind) {
    state.log.push({ turn: state.turn, text: text, kind: kind || 'info' });
    if (state.log.length > 100) state.log.shift();
  }

  function emit(events, ev) {
    events.push(ev);
  }

  function sideName(unit) {
    return unit.side === 'enemy' ? '悖论' : '学者';
  }

  /* ---------- 行动校验 ---------- */

  function canUseFormula(state, scholarUid, formulaId) {
    if (state.result) return { ok: false, reason: '战斗已经结束' };
    if (state.phase !== 'player') return { ok: false, reason: '现在是悖论回合' };
    const s = findScholar(state, scholarUid);
    if (!s || !s.alive) return { ok: false, reason: '该学者无法行动' };
    const f = getFormula(s, formulaId);
    if (!f) return { ok: false, reason: '未知公式' };
    if (s.usedFormulas.indexOf(f.id) !== -1) return { ok: false, reason: '这张公式本回合已经用过' };
    const free = hasStatus(s, 'insight');
    if (!free && state.ap < f.cost) return { ok: false, reason: '行动力不足' };
    return { ok: true, reason: '' };
  }

  function canUseAxiom(state, scholarUid) {
    if (state.result) return { ok: false, reason: '战斗已经结束' };
    if (state.phase !== 'player') return { ok: false, reason: '现在是悖论回合' };
    const s = findScholar(state, scholarUid);
    if (!s || !s.alive) return { ok: false, reason: '该学者无法行动' };
    if (hasStatus(s, 'silence')) return { ok: false, reason: '失语：无法使用公理' };
    const ax = getAxiom(s);
    if (s.cooldowns.axiom > 0) return { ok: false, reason: '公理冷却中（' + s.cooldowns.axiom + '）' };
    if (state.ap < ax.cost) return { ok: false, reason: '行动力不足' };
    return { ok: true, reason: '' };
  }

  /* ---------- 目标 ---------- */

  function lowestAlly(state) {
    const list = aliveScholars(state);
    if (!list.length) return null;
    return list.slice().sort(function (a, b) {
      return (a.hp / a.maxHp) - (b.hp / b.maxHp);
    })[0];
  }

  function resolveTargets(state, target, ctx) {
    switch (target) {
      case 'selected':
        return ctx.target && ctx.target.alive ? [ctx.target] : [];
      case 'self':
        return ctx.actor && ctx.actor.alive ? [ctx.actor] : [];
      case 'allEnemies':
        return aliveEnemies(state);
      case 'allAllies':
        return aliveScholars(state);
      case 'lowestAlly': {
        const ally = lowestAlly(state);
        return ally ? [ally] : [];
      }
      case 'randomEnemy': {
        const list = aliveEnemies(state);
        return list.length ? [state.rng.pick(list)] : [];
      }
      case 'randomAlly': {
        const list = aliveScholars(state);
        return list.length ? [state.rng.pick(list)] : [];
      }
      default:
        return [];
    }
  }

  function resolveActionTarget(state, targetUid, targetType) {
    if (targetType === 'self') {
      return null;
    }
    if (targetUid) {
      const unit = findEnemy(state, targetUid) || findScholar(state, targetUid);
      if (unit && unit.alive) return unit;
    }
    if (targetType === 'ally' || targetType === 'allAllies') return lowestAlly(state);
    const list = aliveEnemies(state);
    return list.length ? list[0] : null;
  }

  function resolveComboTarget(state, targetUid) {
    if (targetUid) {
      const unit = findEnemy(state, targetUid) || findScholar(state, targetUid);
      if (unit && unit.alive) return unit;
    }
    const list = aliveEnemies(state);
    return list.length ? list[0] : null;
  }

  /* ---------- 状态 ---------- */

  function defaultStatusValue(id) {
    if (id === 'vuln') return 0.3;
    if (id === 'atkUp' || id === 'atkDown' || id === 'defUp' || id === 'defDown') return 0.25;
    if (id === 'charge') return 0.5;
    return 0;
  }

  function addStatus(state, unit, id, duration, value) {
    if (!unit || !unit.alive) return false;
    const meta = STATUSES[id];
    if (!meta) return false;
    if (meta.kind === 'debuff' && hasStatus(unit, 'ward')) {
      log(state, unit.name + ' 处于澄明，抵挡了「' + meta.name + '」', 'status');
      return false;
    }
    const v = value == null ? defaultStatusValue(id) : value;
    const existing = unit.statuses.find(function (s) { return s.id === id; });
    if (existing) {
      existing.turns = Math.max(existing.turns, duration);
      existing.value = Math.max(existing.value || 0, v);
    } else {
      unit.statuses.push({ id: id, turns: duration, value: v });
    }
    return true;
  }

  function removeStatus(unit, id) {
    unit.statuses = unit.statuses.filter(function (s) { return s.id !== id; });
  }

  function cleanse(unit) {
    unit.statuses = unit.statuses.filter(function (s) {
      const meta = STATUSES[s.id];
      return meta && meta.kind !== 'debuff' && meta.kind !== 'dot';
    });
  }

  function tickStatuses(state, units, events) {
    units.forEach(function (unit) {
      if (!unit.alive) return;
      const dot = unit.statuses.find(function (s) { return s.id === 'contradiction' && s.turns > 0; });
      if (dot) {
        const dmg = Math.max(1, Math.round(dot.value || 4));
        unit.hp = Math.max(0, unit.hp - dmg);
        emit(events, { type: 'damage', targetUid: unit.uid, amount: dmg, exact: true });
        log(state, unit.name + ' 受到矛盾反噬（' + dmg + '）', 'status');
        if (unit.hp <= 0) handleDeath(state, unit, events);
      }
      unit.statuses.forEach(function (s) { s.turns -= 1; });
      unit.statuses = unit.statuses.filter(function (s) { return s.turns > 0; });
    });
  }

  /* ---------- 伤害 ---------- */

  function handleDeath(state, unit, events) {
    if (!unit.alive) return;
    if (unit.side === 'enemy' && unit.passive === 'revive' && !unit.reviveUsed) {
      unit.reviveUsed = true;
      unit.hp = Math.max(1, Math.round(unit.maxHp * 0.4));
      unit.statuses = [];
      emit(events, { type: 'revive', targetUid: unit.uid, amount: unit.hp });
      log(state, unit.name + ' 从调用栈里重新长了出来', 'status');
      return;
    }
    unit.alive = false;
    unit.hp = 0;
    unit.shield = 0;
    unit.statuses = [];
    if (unit.side === 'enemy') {
      log(state, unit.name + ' 被擦除', 'death');
      emit(events, { type: 'death', targetUid: unit.uid });
    } else {
      log(state, unit.name + ' 倒下了', 'death');
      emit(events, { type: 'death', targetUid: unit.uid });
    }
  }

  function triggerPhase2(state, enemy, events) {
    if (enemy.phase !== 1 || !enemy.phase2Effects) return;
    enemy.phase = 2;
    enemy.phase2Used = true;
    enemy.patternIndex = 0;
    log(state, enemy.phase2Text || (enemy.name + ' 进入了第二阶段'), 'phase');
    emit(events, { type: 'phase', targetUid: enemy.uid, text: enemy.phase2Text });
    enemy.phase2Effects.forEach(function (effect) {
      if (effect.type === 'buff') {
        addStatus(state, enemy, effect.stat === 'atk' ? 'atkUp' : 'defUp', effect.duration || 2, effect.value || 0.2);
      } else if (effect.type === 'paradox') {
        enemy.paradoxShield += effect.value || 0;
        emit(events, { type: 'paradox', targetUid: enemy.uid, amount: effect.value || 0 });
      } else if (effect.type === 'shield') {
        enemy.shield += effect.value || 0;
      }
    });
  }

  function dealDamage(state, attacker, target, opts, events) {
    if (!target || !target.alive) return 0;
    if (target.side === 'enemy' && target.passive === 'evadeFirst' && !target.evadeUsed) {
      target.evadeUsed = true;
      emit(events, { type: 'miss', targetUid: target.uid });
      log(state, target.name + ' 是空集：这一次攻击什么也没碰到', 'status');
      return 0;
    }
    const atkValue = opts.atkOverride != null ? opts.atkOverride : effAtk(attacker);
    let raw = atkValue * (opts.mult == null ? 1 : opts.mult) + (opts.flat || 0);
    if (opts.defScale && attacker) raw += effDef(attacker) * opts.defScale;
    if (opts.chargeBonus) raw *= (1 + opts.chargeBonus);
    if (!opts.truth && opts.method && target.side === 'enemy') {
      if (target.weakness === opts.method) raw *= 1.5;
      else if (target.resist === opts.method) raw *= 0.7;
    }
    raw *= vulnMul(target);
    if (!opts.truth) {
      raw = raw * 100 / (100 + effDef(target) * 2.5);
    }
    raw = Math.max(1, Math.round(raw));

    let paradoxAbsorbed = 0;
    if (target.paradoxShield > 0) {
      if (opts.truth) {
        paradoxAbsorbed = Math.min(target.paradoxShield, raw);
        target.paradoxShield -= paradoxAbsorbed;
        raw -= paradoxAbsorbed;
        emit(events, { type: 'paradox', targetUid: target.uid, amount: -paradoxAbsorbed });
        if (target.paradoxShield <= 0) {
          log(state, '悖论护盾碎裂！' + target.name + ' 露出了破绽', 'theorem');
          addStatus(state, target, 'vuln', 2, 0.3);
          emit(events, { type: 'shieldBreak', targetUid: target.uid });
        }
      } else {
        raw = Math.max(1, Math.round(raw * 0.5));
      }
    }

    let blocked = 0;
    if (target.shield > 0 && raw > 0) {
      blocked = Math.min(target.shield, raw);
      target.shield -= blocked;
      raw -= blocked;
    }
    if (raw > 0) target.hp = Math.max(0, target.hp - raw);
    emit(events, {
      type: 'damage',
      targetUid: target.uid,
      amount: raw,
      blocked: blocked,
      paradox: paradoxAbsorbed,
      truth: !!opts.truth,
      method: opts.method || null
    });

    if (target.side === 'enemy' && target.boss && target.phase === 1 && target.phase2At &&
        target.hp > 0 && target.hp <= target.maxHp * target.phase2At) {
      triggerPhase2(state, target, events);
    }
    if (target.hp <= 0) handleDeath(state, target, events);
    return raw;
  }

  /* ---------- 效果 ---------- */

  function healUnit(state, unit, amount, events) {
    if (!unit || !unit.alive || amount <= 0) return 0;
    const before = unit.hp;
    unit.hp = Math.min(unit.maxHp, unit.hp + amount);
    const healed = unit.hp - before;
    emit(events, { type: 'heal', targetUid: unit.uid, amount: healed });
    return healed;
  }

  function applyEffects(state, effects, ctx, events) {
    effects.forEach(function (effect) {
      applyEffect(state, effect, ctx, events);
    });
  }

  function applyEffect(state, effect, ctx, events) {
    if (!effect) return;
    const sourceAtk = ctx.sourceAtk != null ? ctx.sourceAtk : (ctx.actor ? effAtk(ctx.actor) : 0);

    switch (effect.type) {
      case 'damage': {
        const targets = resolveTargets(state, effect.target || 'selected', ctx);
        const hits = effect.hits || 1;
        targets.forEach(function (target) {
          for (let i = 0; i < hits; i++) {
            if (!target.alive) break;
            dealDamage(state, ctx.actor, target, {
              atkOverride: sourceAtk,
              mult: effect.mult,
              flat: effect.flat,
              method: effect.method,
              defScale: effect.defScale,
              truth: !!effect.truth || !!ctx.isTheorem
            }, events);
          }
        });
        break;
      }
      case 'randomHits': {
        const targets = resolveTargets(state, effect.target || 'selected', ctx);
        const target = targets[0];
        if (!target) break;
        const count = effect.min + state.rng.int(effect.max - effect.min + 1);
        emit(events, { type: 'roll', kind: 'hits', value: count });
        for (let i = 0; i < count; i++) {
          if (!target.alive) break;
          dealDamage(state, ctx.actor, target, {
            atkOverride: sourceAtk,
            mult: effect.mult,
            flat: effect.flat,
            method: effect.method
          }, events);
        }
        break;
      }
      case 'heal': {
        const targets = resolveTargets(state, effect.target || 'self', ctx);
        const amount = Math.round(sourceAtk * (effect.mult || 0) + (effect.flat || 0));
        targets.forEach(function (target) { healUnit(state, target, amount, events); });
        break;
      }
      case 'shield': {
        const targets = resolveTargets(state, effect.target || 'self', ctx);
        const amount = Math.round(sourceAtk * (effect.mult || 0) + (effect.flat || 0));
        targets.forEach(function (target) {
          if (!target.alive) return;
          target.shield += amount;
          emit(events, { type: 'shield', targetUid: target.uid, amount: amount });
        });
        break;
      }
      case 'buff': {
        const targets = resolveTargets(state, effect.target || 'self', ctx);
        const id = effect.stat === 'atk' ? (effect.value >= 0 ? 'atkUp' : 'atkDown') : (effect.value >= 0 ? 'defUp' : 'defDown');
        const value = Math.abs(effect.value || 0);
        targets.forEach(function (target) {
          addStatus(state, target, id, effect.duration || 2, value);
        });
        break;
      }
      case 'status': {
        const targets = resolveTargets(state, effect.target || 'selected', ctx);
        targets.forEach(function (target) {
          addStatus(state, target, effect.status, effect.duration || 2, effect.value);
        });
        break;
      }
      case 'cleanse': {
        const targets = resolveTargets(state, effect.target || 'allAllies', ctx);
        targets.forEach(function (target) {
          cleanse(target);
          emit(events, { type: 'cleanse', targetUid: target.uid });
        });
        break;
      }
      case 'ap': {
        state.ap += effect.value || 0;
        emit(events, { type: 'ap', value: effect.value || 0 });
        break;
      }
      case 'hpCost': {
        if (!ctx.actor || !ctx.actor.alive) break;
        const cost = Math.max(1, Math.round(ctx.actor.maxHp * (effect.value || 0)));
        ctx.actor.hp = Math.max(1, ctx.actor.hp - cost);
        emit(events, { type: 'damage', targetUid: ctx.actor.uid, amount: cost, selfInflicted: true });
        log(state, ctx.actor.name + ' 以 ' + cost + ' 点生命为代价', 'status');
        break;
      }
      case 'randomOutcome': {
        const success = state.rng.chance(effect.chance == null ? 0.5 : effect.chance);
        emit(events, { type: 'roll', kind: 'outcome', success: success });
        applyEffects(state, success ? effect.success : effect.fail, ctx, events);
        break;
      }
      default:
        break;
    }
  }

  /* ---------- 玩家行动 ---------- */

  function useFormula(state, scholarUid, formulaId, targetUid) {
    const events = [];
    const check = canUseFormula(state, scholarUid, formulaId);
    if (!check.ok) return { ok: false, reason: check.reason, events: events };
    const scholar = findScholar(state, scholarUid);
    const formula = getFormula(scholar, formulaId);
    const free = hasStatus(scholar, 'insight');
    if (free) {
      removeStatus(scholar, 'insight');
      log(state, scholar.name + ' 的灵光让这次演算不消耗行动力', 'status');
    } else {
      state.ap -= formula.cost;
    }
    scholar.usedFormulas.push(formula.id);
    log(state, scholar.name + ' 写出「' + formula.name + '」[' + TAGS[formula.tag].name + ']', 'action');
    emit(events, {
      type: 'cast', scholarUid: scholar.uid, kind: 'formula',
      name: formula.name, formula: formula.formula, tag: formula.tag, method: formula.method
    });

    const target = resolveActionTarget(state, targetUid, formula.target);
    applyEffects(state, formula.effects, {
      actor: scholar, target: target, sourceAtk: effAtk(scholar), isTheorem: false
    }, events);

    const prev = state.chain[0];
    const recipe = prev && prev.scholarUid !== scholar.uid ? DATA.getRecipe(prev.tag, formula.tag) : null;
    let theorem = null;
    if (recipe && state.theoremsThisTurn.indexOf(recipe.id) === -1) {
      const partner = findScholar(state, prev.scholarUid);
      const avg = Math.round((effAtk(scholar) + effAtk(partner)) / 2);
      const comboTarget = resolveComboTarget(state, targetUid);
      log(state, '定理成立 · 「' + recipe.name + '」', 'theorem');
      emit(events, {
        type: 'theorem', recipeId: recipe.id, name: recipe.name,
        formula: recipe.formula, desc: recipe.desc, flavor: recipe.flavor,
        scholars: [prev.scholarUid, scholar.uid], partnerName: partner.name
      });
      applyEffects(state, recipe.effects, {
        actor: scholar, target: comboTarget, sourceAtk: avg, isTheorem: true
      }, events);
      state.theoremsThisTurn.push(recipe.id);
      state.comboCount += 1;
      if (state.discovered.indexOf(recipe.id) === -1) state.discovered.push(recipe.id);
      state.chain = [];
      theorem = {
        id: recipe.id, name: recipe.name, formula: recipe.formula,
        desc: recipe.desc, flavor: recipe.flavor, turn: state.turn,
        scholars: [prev.scholarUid, scholar.uid]
      };
      state.lastTheorem = theorem;
    } else {
      state.chain = [{
        scholarUid: scholar.uid, formulaId: formula.id, tag: formula.tag, name: formula.name
      }];
    }

    checkResult(state, events);
    return { ok: true, reason: '', events: events, theorem: theorem };
  }

  function useAxiom(state, scholarUid, targetUid) {
    const events = [];
    const check = canUseAxiom(state, scholarUid);
    if (!check.ok) return { ok: false, reason: check.reason, events: events };
    const scholar = findScholar(state, scholarUid);
    const axiom = getAxiom(scholar);
    state.ap -= axiom.cost;
    scholar.cooldowns.axiom = axiom.cooldown;
    state.chain = [];
    log(state, scholar.name + ' 展开公理「' + axiom.name + '」', 'axiom');
    emit(events, {
      type: 'cast', scholarUid: scholar.uid, kind: 'axiom',
      name: axiom.name, formula: axiom.formula, tag: null, method: axiom.method
    });
    const target = resolveActionTarget(state, targetUid, axiom.target);
    applyEffects(state, axiom.effects, {
      actor: scholar, target: target, sourceAtk: effAtk(scholar), isTheorem: false
    }, events);
    checkResult(state, events);
    return { ok: true, reason: '', events: events, theorem: null };
  }

  /* ---------- 组合提示 ---------- */

  function getComboOptions(state) {
    if (!state.chain.length || state.result) return [];
    const entry = state.chain[0];
    const options = [];
    aliveScholars(state).forEach(function (scholar) {
      if (scholar.uid === entry.scholarUid) return;
      formulasOf(scholar).forEach(function (formula) {
        if (scholar.usedFormulas.indexOf(formula.id) !== -1) return;
        const recipe = DATA.getRecipe(entry.tag, formula.tag);
        if (!recipe) return;
        if (state.theoremsThisTurn.indexOf(recipe.id) !== -1) return;
        options.push({
          recipeId: recipe.id, recipeName: recipe.name, recipeFormula: recipe.formula,
          scholarUid: scholar.uid, scholarName: scholar.name,
          formulaId: formula.id, formulaName: formula.name, tag: formula.tag,
          usable: canUseFormula(state, scholar.uid, formula.id).ok
        });
      });
    });
    return options;
  }

  function getIntent(enemy) {
    if (!enemy || !enemy.alive) return null;
    const pattern = enemy.phase === 2 && enemy.phasePattern ? enemy.phasePattern : enemy.pattern;
    return pattern[enemy.patternIndex % pattern.length];
  }

  /* ---------- 敌方行动 ---------- */

  function enemyTargets(state, action) {
    if (action.target === 'all') return aliveScholars(state);
    if (action.target === 'self') return [state.currentEnemy];
    if (action.target === 'allies') return aliveEnemies(state);
    const allies = aliveScholars(state);
    if (!allies.length) return [];
    const taunts = allies.filter(function (s) { return hasStatus(s, 'taunt'); });
    if (taunts.length) return [state.rng.pick(taunts)];
    return [state.rng.pick(allies)];
  }

  function executeEnemyAction(state, enemy, events) {
    const action = getIntent(enemy);
    if (!action) return;
    state.currentEnemy = enemy;
    log(state, enemy.name + ' 使用「' + action.label + '」', 'enemy');
    emit(events, { type: 'enemyAction', enemyUid: enemy.uid, label: action.label, actionType: action.type });

    switch (action.type) {
      case 'attack': {
        const targets = enemyTargets(state, action);
        targets.forEach(function (target) {
          if (!target.alive) return;
          dealDamage(state, enemy, target, {
            mult: action.mult,
            flat: action.flat || 0,
            chargeBonus: enemy.chargeBonus,
            truth: false
          }, events);
        });
        if (enemy.chargeBonus > 0) {
          enemy.chargeBonus = 0;
          removeStatus(enemy, 'charge');
        }
        break;
      }
      case 'status': {
        const targets = enemyTargets(state, action);
        targets.forEach(function (target) {
          addStatus(state, target, action.status, action.duration || 2, action.value);
        });
        break;
      }
      case 'buff': {
        const targets = enemyTargets(state, action);
        targets.forEach(function (target) {
          addStatus(state, target, action.stat === 'atk' ? 'atkUp' : 'defUp', action.duration || 2, action.value || 0.2);
        });
        break;
      }
      case 'shield': {
        enemy.shield += action.value || 0;
        emit(events, { type: 'shield', targetUid: enemy.uid, amount: action.value || 0 });
        break;
      }
      case 'heal': {
        const targets = enemyTargets(state, action);
        targets.forEach(function (target) {
          healUnit(state, target, action.value || 0, events);
        });
        break;
      }
      case 'charge': {
        enemy.chargeBonus = action.value || 0.5;
        addStatus(state, enemy, 'charge', 2, action.value || 0.5);
        emit(events, { type: 'charge', targetUid: enemy.uid, value: enemy.chargeBonus });
        break;
      }
      case 'paradox': {
        enemy.paradoxShield += action.value || 0;
        emit(events, { type: 'paradox', targetUid: enemy.uid, amount: action.value || 0 });
        break;
      }
      default:
        break;
    }
    enemy.patternIndex += 1;
    state.currentEnemy = null;
  }

  /* ---------- 回合 ---------- */

  function endTurn(state) {
    const events = [];
    if (state.result) return { ok: false, reason: '战斗已经结束', events: events };
    if (state.phase !== 'player') return { ok: false, reason: '现在是悖论回合', events: events };

    state.phase = 'enemy';
    state.chain = [];
    log(state, '悖论回合', 'turn');

    const enemies = aliveEnemies(state);
    for (let i = 0; i < enemies.length; i++) {
      if (state.result) break;
      executeEnemyAction(state, enemies[i], events);
      checkResult(state, events);
      if (state.result && state.result.win) break;
    }

    if (!state.result) {
      tickStatuses(state, aliveEnemies(state), events);
      checkResult(state, events);
    }

    if (!state.result) {
      state.turn += 1;
      state.phase = 'player';
      state.ap = state.maxAp;
      state.theoremsThisTurn = [];
      state.scholars.forEach(function (s) {
        if (s.cooldowns.axiom > 0) s.cooldowns.axiom -= 1;
        s.usedFormulas = [];
      });
      state.enemies.forEach(function (e) { e.evadeUsed = false; });
      tickStatuses(state, aliveScholars(state), events);
      checkResult(state, events);
      if (!state.result) {
        log(state, '第 ' + state.turn + ' 回合 · 你的行动', 'turn');
        emit(events, { type: 'turn', turn: state.turn });
      }
    }
    return { ok: true, reason: '', events: events };
  }

  /* ---------- 结算 ---------- */

  function checkResult(state, events) {
    if (state.result) return;
    const alliesAlive = state.scholars.some(function (s) { return s.alive; });
    if (!alliesAlive) {
      state.phase = 'lost';
      state.result = {
        win: false, stageId: state.stageId, stageName: state.stageName,
        stars: 0, turns: state.turn, par: state.par,
        comboCount: state.comboCount, discovered: state.discovered.slice(),
        scholarsDown: state.scholars.length
      };
      log(state, '证明中断了。', 'result');
      emit(events, { type: 'result', result: state.result });
      return;
    }
    const enemiesAlive = state.enemies.some(function (e) { return e.alive; });
    if (!enemiesAlive) {
      const noDown = state.scholars.every(function (s) { return s.alive; });
      const fast = state.turn <= state.par;
      const stars = 1 + (noDown ? 1 : 0) + (fast ? 1 : 0);
      state.phase = 'won';
      state.result = {
        win: true, stageId: state.stageId, stageName: state.stageName,
        stars: stars, turns: state.turn, par: state.par,
        comboCount: state.comboCount, discovered: state.discovered.slice(),
        scholarsDown: state.scholars.filter(function (s) { return !s.alive; }).length,
        noDown: noDown, fast: fast
      };
      log(state, '证明完成。', 'result');
      emit(events, { type: 'result', result: state.result });
    }
  }

  /* ---------- 队伍预览 ---------- */

  function teamRecipePreview(teamIds) {
    const seen = {};
    const result = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        const a = DATA.SCHOLAR_MAP[teamIds[i]];
        const b = DATA.SCHOLAR_MAP[teamIds[j]];
        if (!a || !b) continue;
        a.formulas.forEach(function (fa) {
          b.formulas.forEach(function (fb) {
            const recipe = DATA.getRecipe(fa.tag, fb.tag);
            if (recipe && !seen[recipe.id]) {
              seen[recipe.id] = true;
              result.push(recipe);
            }
          });
        });
      }
    }
    return result;
  }

  return {
    createBattle: createBattle,
    computeStats: computeStats,
    scaleEnemy: scaleEnemy,
    canUseFormula: canUseFormula,
    canUseAxiom: canUseAxiom,
    useFormula: useFormula,
    useAxiom: useAxiom,
    endTurn: endTurn,
    getComboOptions: getComboOptions,
    getIntent: getIntent,
    teamRecipePreview: teamRecipePreview,
    formulasOf: formulasOf,
    getFormula: getFormula,
    getAxiom: getAxiom,
    getScholarDef: getScholarDef,
    findScholar: findScholar,
    findEnemy: findEnemy,
    hasStatus: hasStatus,
    statusValue: statusValue,
    effAtk: effAtk,
    effDef: effDef,
    lowestAlly: lowestAlly,
    aliveScholars: aliveScholars,
    aliveEnemies: aliveEnemies
  };
});
