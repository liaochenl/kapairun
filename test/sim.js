'use strict';
/* 简易自动对战：用于平衡性检查，不追求最优打法。 */
const DATA = require('../js/data.js');
const BATTLE = require('../js/battle.js');

function teamOf(ids, level, ascension) {
  return ids.map(id => ({ id, level, ascension: ascension || 0, dupes: 0 }));
}

function statusScore(effect) {
  if (effect.status === 'vuln' || effect.status === 'defDown') return 8;
  if (effect.status === 'silence') return 12;
  return 4;
}

function effectScore(state, effect, actor) {
  let score = 0;
  if (effect.type === 'damage') {
    const hits = effect.hits || 1;
    const mult = (effect.mult || 0) * 18 + (effect.flat || 0) * 1.2;
    score += mult * hits;
    const enemies = BATTLE.aliveEnemies(state);
    if (effect.method && enemies.some(e => e.weakness === effect.method)) score += 8;
  } else if (effect.type === 'randomHits') {
    score += ((effect.min + effect.max) / 2) * ((effect.mult || 0) * 18 + (effect.flat || 0) * 1.2);
  } else if (effect.type === 'heal') {
    score += (effect.flat || 0) * 2 + (effect.mult || 0) * 20;
    const low = state.scholars.filter(s => s.alive && s.hp / s.maxHp < 0.55).length;
    if (low) score += 25 * low;
  } else if (effect.type === 'shield') {
    score += (effect.flat || 0) * 1.5 + (effect.mult || 0) * 14;
  } else if (effect.type === 'buff') {
    score += Math.abs(effect.value || 0) * 32 + (effect.duration || 2) * 2;
  } else if (effect.type === 'status') {
    score += statusScore(effect);
  } else if (effect.type === 'ap') {
    score += 22;
  } else if (effect.type === 'cleanse') {
    score += 8;
  } else if (effect.type === 'hpCost') {
    score -= 16;
  } else if (effect.type === 'randomOutcome') {
    score += 0.5 * (effect.success || []).reduce((s, e) => s + effectScore(state, e, actor), 0);
    score += 0.5 * (effect.fail || []).reduce((s, e) => s + effectScore(state, e, actor), 0);
  }
  return score;
}

function actionScore(state, action) {
  let score = action.effects.reduce((sum, e) => sum + effectScore(state, e, action), 0);
  if (action.type === 'axiom') score *= 1.25;
  return score;
}

function formulaScore(state, scholar, formula) {
  return actionScore(state, formula);
}

function recipeScore(state, recipe) {
  return actionScore(state, recipe);
}

function hasComboStarter(state, scholar, formula) {
  return BATTLE.aliveScholars(state).some(other => {
    if (other.uid === scholar.uid) return false;
    return BATTLE.formulasOf(other).some(f => {
      if (other.usedFormulas.indexOf(f.id) !== -1) return false;
      return !!DATA.getRecipe(formula.tag, f.tag);
    });
  });
}

function bestComboScore(state, scholar, formula) {
  let best = 0;
  BATTLE.aliveScholars(state).forEach(other => {
    if (other.uid === scholar.uid) return;
    BATTLE.formulasOf(other).forEach(f => {
      if (other.usedFormulas.indexOf(f.id) !== -1) return;
      const recipe = DATA.getRecipe(formula.tag, f.tag);
      if (recipe) best = Math.max(best, recipeScore(state, recipe));
    });
  });
  return best;
}

function chooseCombo(state, options) {
  const usable = options.filter(o => o.usable);
  if (!usable.length) return null;
  let best = null;
  let bestScore = -1;
  usable.forEach(o => {
    const recipe = DATA.RECIPE_MAP[o.recipeId];
    const score = recipe ? recipeScore(state, recipe) : 0;
    if (score > bestScore) { bestScore = score; best = o; }
  });
  return best;
}

function chooseStarter(state) {
  const candidates = [];
  BATTLE.aliveScholars(state).forEach(scholar => {
    BATTLE.formulasOf(scholar).forEach(formula => {
      if (scholar.usedFormulas.indexOf(formula.id) !== -1) return;
      if (!BATTLE.canUseFormula(state, scholar.uid, formula.id).ok) return;
      const base = formulaScore(state, scholar, formula);
      const combo = hasComboStarter(state, scholar, formula) ? bestComboScore(state, scholar, formula) : 0;
      const score = base + combo * 0.85 + (combo > 0 ? 6 : 0);
      candidates.push({ kind: 'formula', scholar, formula, score });
    });
    const ax = BATTLE.getAxiom(scholar);
    if (BATTLE.canUseAxiom(state, scholar.uid).ok) {
      const base = actionScore(state, Object.assign({ type: 'axiom' }, ax));
      const lowTeam = state.scholars.filter(s => s.alive && s.hp / s.maxHp < 0.5).length;
      let bonus = 0;
      if (lowTeam && (ax.name.indexOf('诺特') >= 0 || ax.name.indexOf('第五') >= 0 || ax.name.indexOf('赌注') >= 0 || ax.name.indexOf('我思') >= 0)) bonus += 20;
      if (state.enemies.length > 1 && (ax.name.indexOf('恒等式') >= 0 || ax.name.indexOf('代数') >= 0)) bonus += 10;
      candidates.push({ kind: 'axiom', scholar, formula: null, score: base + bonus });
    }
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function targetFor(state, action) {
  if (!action) return null;
  if (action.target === 'ally') {
    const low = BATTLE.lowestAlly(state);
    return low ? low.uid : null;
  }
  if (action.target === 'allAllies' || action.target === 'self') return null;
  const enemies = BATTLE.aliveEnemies(state);
  if (!enemies.length) return null;
  enemies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
  return enemies[0].uid;
}

function playBattle(stageId, team, seed) {
  const state = BATTLE.createBattle({ stageId, team, seed });
  let guard = 0;
  while (!state.result && state.turn <= 30 && guard++ < 300) {
    let actions = 0;
    while (!state.result && actions++ < 12) {
      const combo = chooseCombo(state, BATTLE.getComboOptions(state));
      if (combo) {
        const r = BATTLE.useFormula(state, combo.scholarUid, combo.formulaId, targetFor(state, { target: 'enemy' }));
        if (!r.ok) break;
        continue;
      }
      if (state.ap <= 0) break;
      const pick = chooseStarter(state);
      if (!pick) break;
      if (pick.kind === 'formula') {
        const target = targetFor(state, pick.formula);
        const r = BATTLE.useFormula(state, pick.scholar.uid, pick.formula.id, target);
        if (!r.ok) break;
      } else {
        const target = targetFor(state, BATTLE.getAxiom(pick.scholar));
        const r = BATTLE.useAxiom(state, pick.scholar.uid, target);
        if (!r.ok) break;
      }
    }
    if (state.result) break;
    const r = BATTLE.endTurn(state);
    if (!r.ok) break;
  }
  return state;
}

function run(label, ids, levelFn, ascFn, seeds) {
  console.log('\n== ' + label + ' ==');
  DATA.STAGES.forEach(stage => {
    const level = levelFn(stage);
    const asc = ascFn(stage);
    let wins = 0, stars = 0, turns = 0;
    const n = seeds || 10;
    for (let i = 0; i < n; i++) {
      const s = playBattle(stage.id, teamOf(ids, level, asc), 1000 + i * 37 + stage.index);
      if (s.result && s.result.win) { wins++; stars += s.result.stars; turns += s.result.turns; }
    }
    const avgStars = wins ? (stars / wins).toFixed(1) : '-';
    const avgTurns = wins ? (turns / wins).toFixed(1) : '-';
    console.log(
      stage.id.padEnd(5), 'Lv' + String(stage.rec).padEnd(3),
      'win', String(wins).padStart(2) + '/' + n,
      'stars', avgStars, 'turns', avgTurns,
      'teamLv', level, 'asc', asc
    );
  });
}

function main() {
  const levelFor = stage => Math.min(stage.rec + 1, 15);
  const ascFor = () => 0;
  run('初始三人组（欧几里得/毕达哥拉斯/帕斯卡）Lv 上限 15', ['euclid', 'pythagoras', 'pascal'], levelFor, ascFor);

  const levelFor18 = stage => Math.min(stage.rec + 1, 18);
  const ascFor18 = stage => (stage.rec >= 15 ? 1 : 0);
  run('初始三人组 Lv18 + 一破', ['euclid', 'pythagoras', 'pascal'], levelFor18, ascFor18);

  const levelFor20 = stage => Math.min(stage.rec + 1, 20);
  const ascFor20 = stage => (stage.rec >= 15 ? 1 : 0);
  run('抽取后的三人组（欧拉/高斯/欧几里得）', ['euler', 'gauss', 'euclid'], levelFor20, ascFor20);

  const levelFor25 = stage => Math.min(stage.rec + 1, 25);
  const ascFor25 = stage => (stage.rec >= 15 ? 1 : 0);
  run('欧拉/拉马努金/诺特', ['euler', 'ramanujan', 'noether'], levelFor25, ascFor25);
}

if (require.main === module) main();

module.exports = { playBattle, teamOf, run, main };
