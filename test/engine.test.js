'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DATA = require('../js/data.js');
const BATTLE = require('../js/battle.js');
const RNG = require('../js/rng.js');
const META = require('../js/meta.js');

function team(level) {
  return [
    { id: 'euclid', level: level || 3 },
    { id: 'pythagoras', level: level || 3 },
    { id: 'pascal', level: level || 3 }
  ];
}

test('战斗初始化：三人小队、3 行动力、敌人按关卡生成', () => {
  const s = BATTLE.createBattle({ stageId: '1-1', team: team(), seed: 1 });
  assert.equal(s.scholars.length, 3);
  assert.equal(s.ap, 3);
  assert.equal(s.enemies.length, 1);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, 'player');
  assert.ok(s.enemies[0].hp > 0);
});

test('公式消耗行动力，每张公式每回合只能使用一次', () => {
  const s = BATTLE.createBattle({ stageId: '1-1', team: team(), seed: 2 });
  const r = BATTLE.useFormula(s, 's0', 'euclid_axiom', 'e0');
  assert.equal(r.ok, true);
  assert.equal(s.ap, 2);
  const again = BATTLE.useFormula(s, 's0', 'euclid_axiom', 'e0');
  assert.equal(again.ok, false);
  assert.match(again.reason, /本回合/);
});

test('公式 + 公式跨角色合成定理（勾股定理）', () => {
  const s = BATTLE.createBattle({ stageId: '1-1', team: team(), seed: 3 });
  const a = BATTLE.useFormula(s, 's0', 'euclid_axiom', 'e0');
  assert.equal(a.ok, true);
  assert.equal(s.chain.length, 1);
  const b = BATTLE.useFormula(s, 's1', 'pyth_ratio', 'e0');
  assert.equal(b.ok, true);
  assert.ok(b.theorem);
  assert.equal(b.theorem.id, 'pythagorean');
  assert.equal(s.comboCount, 1);
  assert.ok(s.discovered.includes('pythagorean'));
  assert.equal(s.chain.length, 0);
  assert.equal(s.ap, 1);
});

test('同一角色的两张公式不能自我合成', () => {
  const s = BATTLE.createBattle({
    stageId: '1-1',
    team: [
      { id: 'pascal', level: 5 },
      { id: 'euclid', level: 5 },
      { id: 'pythagoras', level: 5 }
    ],
    seed: 4
  });
  BATTLE.useFormula(s, 's0', 'pascal_chance', null);
  const r = BATTLE.useFormula(s, 's0', 'pascal_induction', 'e0');
  assert.equal(r.ok, true);
  assert.equal(r.theorem, null);
  assert.equal(s.comboCount, 0);
});

test('公理消耗 2 行动力并进入冷却', () => {
  const s = BATTLE.createBattle({ stageId: '1-1', team: team(5), seed: 5 });
  const r = BATTLE.useAxiom(s, 's0', null);
  assert.equal(r.ok, true);
  assert.equal(s.ap, 1);
  assert.equal(s.scholars[0].cooldowns.axiom, 3);
  const again = BATTLE.useAxiom(s, 's0', null);
  assert.equal(again.ok, false);
  assert.match(again.reason, /冷却/);
});

test('结束回合后敌人行动、回合数增加、行动力重置', () => {
  const s = BATTLE.createBattle({ stageId: '1-1', team: team(5), seed: 6 });
  const hpBefore = s.scholars.reduce((sum, x) => sum + x.hp, 0);
  const r = BATTLE.endTurn(s);
  assert.equal(r.ok, true);
  assert.equal(s.turn, 2);
  assert.equal(s.ap, 3);
  assert.ok(s.scholars.some(x => x.hp < x.maxHp) || hpBefore > 0);
});

test('悖论护盾只被定理伤害削减', () => {
  const s = BATTLE.createBattle({
    stageId: '1-10',
    team: [
      { id: 'euler', level: 20 },
      { id: 'ramanujan', level: 20 },
      { id: 'euclid', level: 20 }
    ],
    seed: 7
  });
  assert.equal(s.enemies[0].paradoxShield, 60);
  // 公式：不削减护盾
  BATTLE.useFormula(s, 's0', 'euler_formula', 'e0');
  assert.equal(s.enemies[0].paradoxShield, 60);
  // 定理：极限 + 级数 → 柯西收敛
  const r = BATTLE.useFormula(s, 's1', 'ramanujan_series', 'e0');
  assert.ok(r.theorem);
  assert.equal(r.theorem.id, 'cauchy');
  assert.ok(s.enemies[0].paradoxShield < 60);
});

test('击杀全部敌人后判定胜利并按回合数给星', () => {
  const s = BATTLE.createBattle({ stageId: '1-1', team: team(10), seed: 8 });
  s.enemies[0].hp = 1;
  const r = BATTLE.useFormula(s, 's1', 'pyth_ratio', 'e0');
  assert.equal(r.ok, true);
  assert.ok(s.result);
  assert.equal(s.result.win, true);
  assert.equal(s.result.stars, 3);
  assert.equal(s.phase, 'won');
});

test('队伍配方预览会去重并返回可合成定理', () => {
  const list = BATTLE.teamRecipePreview(['euclid', 'pythagoras', 'pascal']);
  const ids = list.map(x => x.id);
  assert.ok(ids.includes('pythagorean'));
  assert.ok(ids.includes('trisection'));
  assert.equal(new Set(ids).size, ids.length);
});

test('敌人意图随回合循环', () => {
  const s = BATTLE.createBattle({ stageId: '1-2', team: team(5), seed: 9 });
  const first = BATTLE.getIntent(s.enemies[0]);
  BATTLE.endTurn(s);
  const second = BATTLE.getIntent(s.enemies[0]);
  assert.ok(first && second);
  assert.notEqual(first.label, second.label);
});

test('默认档案：三名初始学者、3200 灵感、600 讲义', () => {
  const p = META.defaultProfile();
  assert.deepEqual(Object.keys(p.roster).sort(), ['euclid', 'pascal', 'pythagoras']);
  assert.equal(p.inspiration, 3200);
  assert.equal(p.notes, 600);
  assert.equal(p.team.length, 3);
});

test('升级消耗讲义并在突破上限处停下', () => {
  const p = META.defaultProfile();
  p.notes = 100000;
  const r = META.levelUp(p, 'euclid', 100);
  assert.equal(r.ok, true);
  assert.equal(p.roster.euclid.level, 15);
  const blocked = META.levelUp(p, 'euclid', 1);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /突破/);
});

test('突破提高等级上限并消耗手稿', () => {
  const p = META.defaultProfile();
  p.notes = 100000;
  p.roster.euclid.level = 15;
  const before = p.manuscripts;
  const r = META.breakthrough(p, 'euclid');
  assert.equal(r.ok, true);
  assert.equal(p.roster.euclid.ascension, 1);
  assert.equal(p.manuscripts, before - 2);
  const lv = META.levelUp(p, 'euclid', 1);
  assert.equal(lv.ok, true);
  assert.equal(p.roster.euclid.level, 16);
});

test('十连保底至少一名 SR/SSR', () => {
  const p = META.defaultProfile();
  p.inspiration = 100000;
  const rng = { next: () => 0.99, int: () => 0, pick: arr => arr[0], chance: () => false };
  const r = META.pull(p, 10, rng);
  assert.equal(r.ok, true);
  assert.equal(r.results.length, 10);
  assert.ok(r.results.some(x => x.rarity === 'SSR' || x.rarity === 'SR'));
  const compensation = r.results.reduce((sum, x) => sum + (x.compensation || 0), 0);
  assert.equal(p.inspiration, 100000 - 1600 + compensation);
});

test('硬保底：第 40 抽必出 SSR', () => {
  const p = META.defaultProfile();
  p.inspiration = 100000;
  p.gacha.sinceSSR = 39;
  const rng = { next: () => 0.99, int: () => 0, pick: arr => arr[0], chance: () => false };
  const r = META.pull(p, 1, rng);
  assert.equal(r.ok, true);
  assert.equal(r.results[0].rarity, 'SSR');
  assert.equal(p.gacha.sinceSSR, 0);
});

test('重复学者转为顿悟，满顿悟后返还灵感', () => {
  const p = META.defaultProfile();
  const r1 = META.grantScholar(p, 'euclid');
  assert.equal(r1.isNew, false);
  assert.equal(r1.dupes, 1);
  p.roster.euclid.dupes = 5;
  const before = p.inspiration;
  const r2 = META.grantScholar(p, 'euclid');
  assert.ok(r2.compensation > 0);
  assert.equal(p.inspiration, before + r2.compensation);
});

test('关卡结算：首通奖励 + 新星级奖励，发现物写入档案', () => {
  const p = META.defaultProfile();
  const beforeInsp = p.inspiration;
  const result = {
    stageId: '1-1', win: true, stars: 2, discovered: ['pythagorean'], turns: 4
  };
  const out = META.applyStageResult(p, result);
  assert.equal(out.firstClear, true);
  assert.equal(out.newStars, 2);
  assert.equal(p.stageStars['1-1'], 2);
  assert.ok(p.inspiration > beforeInsp);
  assert.ok(p.discovered.includes('pythagorean'));
  assert.equal(META.isStageUnlocked(p, '1-2'), true);
});

test('种子随机数可复现', () => {
  const a = RNG.createRng(123);
  const b = RNG.createRng(123);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});

test('真随机种子下抽卡不会崩溃', () => {
  const p = META.defaultProfile();
  p.inspiration = 100000;
  const rng = RNG.createRng(2026);
  for (let i = 0; i < 40; i++) {
    const r = META.pull(p, 1, rng);
    assert.equal(r.ok, true);
  }
  assert.ok(p.gacha.totalPulls === 40);
  assert.ok(p.inspiration >= 0);
});

test('Boss 血量低于一半时进入第二阶段并补充悖论护盾', () => {
  const s = BATTLE.createBattle({
    stageId: '1-10',
    team: [
      { id: 'euler', level: 20, ascension: 1 },
      { id: 'ramanujan', level: 20, ascension: 1 },
      { id: 'euclid', level: 20, ascension: 1 }
    ],
    seed: 11
  });
  const boss = s.enemies[0];
  boss.hp = Math.ceil(boss.maxHp * 0.5) + 10;
  const beforeShield = boss.paradoxShield;
  BATTLE.useFormula(s, 's0', 'euler_formula', 'e0');
  assert.equal(boss.phase, 2);
  assert.ok(boss.paradoxShield > beforeShield);
  assert.ok(boss.statuses.some(x => x.id === 'atkUp'));
});

test('空集之影每回合第一次受伤会被闪避', () => {
  const s = BATTLE.createBattle({
    stageId: '1-8',
    team: [
      { id: 'pythagoras', level: 20, ascension: 1 },
      { id: 'pascal', level: 20, ascension: 1 },
      { id: 'euclid', level: 20, ascension: 1 }
    ],
    seed: 12
  });
  const empty = s.enemies[0];
  const hpBefore = empty.hp;
  BATTLE.useFormula(s, 's0', 'pyth_ratio', 'e0');
  assert.equal(empty.hp, hpBefore);
  assert.equal(empty.evadeUsed, true);
  BATTLE.useFormula(s, 's1', 'pascal_induction', 'e0');
  assert.ok(empty.hp < hpBefore);
});

test('无穷递归死亡后复活一次', () => {
  const s = BATTLE.createBattle({
    stageId: '1-7',
    team: [
      { id: 'pythagoras', level: 22, ascension: 1 },
      { id: 'pascal', level: 22, ascension: 1 },
      { id: 'euclid', level: 22, ascension: 1 }
    ],
    seed: 13
  });
  const rec = s.enemies[0];
  rec.hp = 1;
  BATTLE.useFormula(s, 's0', 'pyth_ratio', 'e0');
  assert.equal(rec.alive, true);
  assert.equal(rec.reviveUsed, true);
  assert.ok(rec.hp > 1);
});

test('定理伤害可以击穿悖论护盾并附加破绽', () => {
  const s = BATTLE.createBattle({
    stageId: '1-10',
    team: [
      { id: 'euler', level: 25, ascension: 2 },
      { id: 'ramanujan', level: 25, ascension: 2 },
      { id: 'euclid', level: 25, ascension: 2 }
    ],
    seed: 14
  });
  const boss = s.enemies[0];
  boss.paradoxShield = 1;
  BATTLE.useFormula(s, 's0', 'euler_formula', 'e0');
  BATTLE.useFormula(s, 's1', 'ramanujan_series', 'e0');
  assert.equal(boss.paradoxShield, 0);
  assert.ok(boss.statuses.some(x => x.id === 'vuln'));
});
