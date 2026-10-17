/* 《真理学院》静态内容：学者、公式、公理、定理配方、悖论、关卡。 */
(function (root, factory) {
  'use strict';
  const DATA = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  if (root) root.TA_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;

  const SCHOOLS = {
    analysis: { name: '分析', color: '#8fc7e8', desc: '极限、级数、连续' },
    number: { name: '数论', color: '#e8c46a', desc: '整数、同余、素数' },
    algebra: { name: '代数', color: '#c9a7e8', desc: '结构、对称、不变量' },
    geometry: { name: '几何', color: '#9ccb86', desc: '图形、构造、空间' },
    probability: { name: '概率', color: '#e8a0a0', desc: '随机、期望、统计' }
  };

  const RARITY = {
    SSR: { name: 'SSR', label: '传说', color: '#e8c46a', order: 3 },
    SR: { name: 'SR', label: '典藏', color: '#8fc7e8', order: 2 },
    R: { name: 'R', label: '讲义', color: '#d8d5ca', order: 1 }
  };

  const METHODS = {
    deduct: { name: '演绎', glyph: '⊢', color: '#8fc7e8', desc: '从公理推出结论' },
    calc: { name: '计算', glyph: '∑', color: '#e8c46a', desc: '把量算到底' },
    construct: { name: '构造', glyph: '△', color: '#9ccb86', desc: '把对象造出来' }
  };

  const TAGS = {
    limit: { name: '极限', glyph: 'lim' },
    series: { name: '级数', glyph: '∑' },
    congruence: { name: '同余', glyph: '≡' },
    induction: { name: '归纳', glyph: '∵' },
    symmetry: { name: '对称', glyph: '↔' },
    axiom: { name: '公理', glyph: '⊢' },
    construction: { name: '作图', glyph: '△' },
    coordinate: { name: '坐标', glyph: '(x,y)' },
    ratio: { name: '比例', glyph: '∝' },
    probability: { name: '概率', glyph: 'P' }
  };

  const STATUSES = {
    vuln: { name: '破绽', kind: 'debuff', icon: '◇', desc: '受到的伤害提高' },
    atkUp: { name: '昂扬', kind: 'buff', icon: '↑', desc: '攻击提高' },
    atkDown: { name: '气馁', kind: 'debuff', icon: '↓', desc: '攻击降低' },
    defUp: { name: '稳固', kind: 'buff', icon: '▣', desc: '防御提高' },
    defDown: { name: '松动', kind: 'debuff', icon: '▢', desc: '防御降低' },
    taunt: { name: '讲台', kind: 'buff', icon: '◎', desc: '敌方单体攻击优先指向此学者' },
    silence: { name: '失语', kind: 'debuff', icon: '…', desc: '无法使用公理' },
    insight: { name: '灵光', kind: 'buff', icon: '✦', desc: '下一张公式不消耗行动力' },
    ward: { name: '澄明', kind: 'buff', icon: '○', desc: '免疫负面状态' },
    contradiction: { name: '矛盾', kind: 'dot', icon: '⊗', desc: '回合结束时受到伤害' },
    charge: { name: '蓄势', kind: 'buff', icon: '!', desc: '下次攻击威力提高' }
  };

  const SCHOLARS = [
    {
      id: 'euler',
      name: '欧拉',
      latin: 'Leonhard Euler',
      era: '1707–1783',
      title: '分析的化身',
      rarity: 'SSR',
      school: 'analysis',
      sigil: 'euler',
      color: '#e8c46a',
      quote: 'e^{iπ} + 1 = 0。',
      bio: '失明之后，他仍以口述写完了近半数著作。有人说，只要把欧拉的名字从数学里擦掉，整块黑板都会塌下来。',
      base: { hp: 118, atk: 30, def: 8 },
      growth: { hp: 10, atk: 1.7, def: 0.5 },
      formulas: [
        {
          id: 'euler_series', name: '无穷级数', tag: 'series', method: 'calc', cost: 1, target: 'allEnemies',
          formula: '∑ 1/n² = π²/6',
          desc: '把所有敌人收进同一条级数，造成计算伤害并留下破绽。',
          effects: [
            { type: 'damage', target: 'allEnemies', mult: 0.5, flat: 5, method: 'calc' },
            { type: 'status', target: 'allEnemies', status: 'vuln', duration: 2, value: 0.25 }
          ]
        },
        {
          id: 'euler_formula', name: '欧拉公式', tag: 'limit', method: 'deduct', cost: 1, target: 'enemy',
          formula: 'e^{iθ} = cosθ + i·sinθ',
          desc: '把指数与三角函数缝在一起，对单体造成演绎伤害并提高自身攻击。',
          effects: [
            { type: 'damage', target: 'selected', mult: 0.95, flat: 4, method: 'deduct' },
            { type: 'buff', target: 'self', stat: 'atk', value: 0.2, duration: 2 }
          ]
        }
      ],
      axiom: {
        id: 'euler_identity', name: '欧拉恒等式', formula: 'e^{iπ} + 1 = 0', cost: 2, cooldown: 3,
        target: 'allEnemies', method: 'deduct',
        desc: '五个最重要的常数收束成一个等式：对所有敌人造成演绎伤害，并施加较深的破绽。',
        effects: [
          { type: 'damage', target: 'allEnemies', mult: 1.0, flat: 8, method: 'deduct' },
          { type: 'status', target: 'allEnemies', status: 'vuln', duration: 3, value: 0.3 }
        ]
      }
    },
    {
      id: 'gauss',
      name: '高斯',
      latin: 'Carl Friedrich Gauss',
      era: '1777–1855',
      title: '数学的王子',
      rarity: 'SSR',
      school: 'number',
      sigil: 'gauss',
      color: '#e8c46a',
      quote: '数学是科学的皇后。',
      bio: '十九岁作出正十七边形，随后要求自己每一步都无可挑剔。他的草稿本上写满了「已经知道，但还不想说」。',
      base: { hp: 112, atk: 32, def: 7 },
      growth: { hp: 9, atk: 1.85, def: 0.48 },
      formulas: [
        {
          id: 'gauss_congruence', name: '同余', tag: 'congruence', method: 'deduct', cost: 1, target: 'enemy',
          formula: 'a ≡ b (mod n)',
          desc: '在模意义下把敌人归类，造成演绎伤害并降低其防御。',
          effects: [
            { type: 'damage', target: 'selected', mult: 0.95, flat: 4, method: 'deduct' },
            { type: 'status', target: 'selected', status: 'defDown', duration: 2, value: 0.3 }
          ]
        },
        {
          id: 'gauss_squares', name: '最小二乘', tag: 'induction', method: 'calc', cost: 1, target: 'enemy',
          formula: 'min Σ (yᵢ − f(xᵢ))²',
          desc: '用一条误差最小的线同时命中最脆弱的两处：伤害敌人，治疗并净化生命最低的同伴。',
          effects: [
            { type: 'damage', target: 'selected', mult: 0.75, flat: 4, method: 'calc' },
            { type: 'heal', target: 'lowestAlly', mult: 0.35, flat: 3 },
            { type: 'cleanse', target: 'lowestAlly' }
          ]
        }
      ],
      axiom: {
        id: 'gauss_fundamental', name: '代数基本定理', formula: 'xⁿ = a 恰有 n 个复根', cost: 2, cooldown: 3,
        target: 'enemy', method: 'deduct',
        desc: '三次同余式连击，把「一定有根」变成「一定打得中」。',
        effects: [
          { type: 'damage', target: 'selected', mult: 0.5, flat: 2, hits: 3, method: 'deduct' },
          { type: 'status', target: 'selected', status: 'defDown', duration: 2, value: 0.25 }
        ]
      }
    },
    {
      id: 'noether',
      name: '诺特',
      latin: 'Emmy Noether',
      era: '1882–1935',
      title: '代数之母',
      rarity: 'SR',
      school: 'algebra',
      sigil: 'noether',
      color: '#c9a7e8',
      quote: '对称性会自己说话。',
      bio: '她曾在门口挂上「诺特先生」的牌子，只为能站上讲台。后来，整个物理学都用她的定理来记住守恒。',
      base: { hp: 136, atk: 22, def: 10 },
      growth: { hp: 11.5, atk: 1.3, def: 0.62 },
      formulas: [
        {
          id: 'noether_symmetry', name: '对称', tag: 'symmetry', method: 'construct', cost: 1, target: 'allAllies',
          formula: 'G × V → V',
          desc: '让全队的结构对齐：获得护盾，攻击提高。',
          effects: [
            { type: 'shield', target: 'allAllies', mult: 0.3, flat: 4 },
            { type: 'buff', target: 'allAllies', stat: 'atk', value: 0.12, duration: 2 }
          ]
        },
        {
          id: 'noether_ideal', name: '理想', tag: 'axiom', method: 'construct', cost: 1, target: 'ally',
          formula: 'I ⊲ R',
          desc: '为一名同伴立起理想的边界：护盾并净化其负面状态。',
          effects: [
            { type: 'shield', target: 'selected', mult: 0.75, flat: 6 },
            { type: 'cleanse', target: 'selected' }
          ]
        }
      ],
      axiom: {
        id: 'noether_theorem', name: '诺特定理', formula: '对称性 ⇄ 守恒量', cost: 2, cooldown: 3,
        target: 'allAllies', method: 'construct',
        desc: '把一次对称写成全队的守恒：攻击提高，并立刻返还 1 点行动力。',
        effects: [
          { type: 'buff', target: 'allAllies', stat: 'atk', value: 0.25, duration: 2 },
          { type: 'ap', value: 1 },
          { type: 'shield', target: 'allAllies', mult: 0.2, flat: 3 }
        ]
      }
    },
    {
      id: 'ramanujan',
      name: '拉马努金',
      latin: 'Srinivasa Ramanujan',
      era: '1887–1920',
      title: '直觉的旅人',
      rarity: 'SR',
      school: 'analysis',
      sigil: 'ramanujan',
      color: '#8fc7e8',
      quote: '一个方程对我没有意义，除非它表达了神的想法。',
      bio: '他把公式写在石板上，说梦里有人告诉他。哈代问他怎么想到的，他回答：是娜玛卡尔女神写的。',
      base: { hp: 104, atk: 34, def: 6 },
      growth: { hp: 8.5, atk: 1.95, def: 0.42 },
      formulas: [
        {
          id: 'ramanujan_series', name: '发散级数', tag: 'series', method: 'calc', cost: 1, target: 'enemy',
          formula: '1 + 2 + 3 + …',
          desc: '不按常理地求和：对单体造成 2–4 次随机的计算伤害。',
          effects: [
            { type: 'randomHits', target: 'selected', min: 2, max: 4, mult: 0.33, flat: 2, method: 'calc' }
          ]
        },
        {
          id: 'ramanujan_partition', name: '整数分拆', tag: 'induction', method: 'deduct', cost: 1, target: 'self',
          formula: 'p(100) = 79270',
          desc: '把自己拆成更小的部分：损失少量生命，换来灵光与攻击提升。',
          effects: [
            { type: 'hpCost', value: 0.08 },
            { type: 'status', target: 'self', status: 'insight', duration: 1 },
            { type: 'buff', target: 'self', stat: 'atk', value: 0.3, duration: 1 }
          ]
        }
      ],
      axiom: {
        id: 'ramanujan_sum', name: '拉马努金求和', formula: '1 + 2 + 3 + … = −1/12', cost: 2, cooldown: 3,
        target: 'enemy', method: 'calc',
        desc: '用一次不讲道理的重排，对单体造成极高计算伤害；代价是自身生命。',
        effects: [
          { type: 'hpCost', value: 0.1 },
          { type: 'damage', target: 'selected', mult: 2.0, flat: 6, method: 'calc' }
        ]
      }
    },
    {
      id: 'euclid',
      name: '欧几里得',
      latin: 'Euclid',
      era: '约前 300',
      title: '公设的立法者',
      rarity: 'SR',
      school: 'geometry',
      sigil: 'euclid',
      color: '#9ccb86',
      quote: '几何无王者之道。',
      bio: '他用五条公设搭起一座两千多年没有塌的房子。有人问学几何有什么用，他让仆人给那人一枚硬币。',
      base: { hp: 164, atk: 18, def: 14 },
      growth: { hp: 13.5, atk: 1.05, def: 0.8 },
      formulas: [
        {
          id: 'euclid_axiom', name: '公理', tag: 'axiom', method: 'deduct', cost: 1, target: 'self',
          formula: '两点之间可作一条直线',
          desc: '站到讲台上：获得护盾，并让敌人的单体攻击优先指向自己。',
          effects: [
            { type: 'status', target: 'self', status: 'taunt', duration: 2 },
            { type: 'shield', target: 'self', mult: 0.8, flat: 6 }
          ]
        },
        {
          id: 'euclid_construct', name: '尺规作图', tag: 'construction', method: 'construct', cost: 1, target: 'ally',
          formula: '作圆与直线，仅此而已',
          desc: '为一名同伴作一道护盾，并加固其防御。',
          effects: [
            { type: 'shield', target: 'selected', mult: 0.65, flat: 5 },
            { type: 'buff', target: 'selected', stat: 'def', value: 0.2, duration: 2 }
          ]
        }
      ],
      axiom: {
        id: 'euclid_fifth', name: '第五公设', formula: '过直线外一点，有且只有一条平行线', cost: 2, cooldown: 3,
        target: 'allAllies', method: 'construct',
        desc: '用一条平行线把全队护在身后：全队护盾与防御提高，自身进入讲台。',
        effects: [
          { type: 'shield', target: 'allAllies', mult: 0.4, flat: 4 },
          { type: 'status', target: 'self', status: 'taunt', duration: 2 },
          { type: 'buff', target: 'allAllies', stat: 'def', value: 0.25, duration: 2 }
        ]
      }
    },
    {
      id: 'pythagoras',
      name: '毕达哥拉斯',
      latin: 'Pythagoras',
      era: '约前 570',
      title: '数的教团',
      rarity: 'R',
      school: 'geometry',
      sigil: 'pythagoras',
      color: '#9ccb86',
      quote: '万物皆数。',
      bio: '他相信整数与比例就是宇宙的秩序。直到他的学生发现，正方形的对角线无法写成两个整数之比。',
      base: { hp: 112, atk: 27, def: 8 },
      growth: { hp: 9.5, atk: 1.55, def: 0.55 },
      formulas: [
        {
          id: 'pyth_ratio', name: '比例', tag: 'ratio', method: 'calc', cost: 1, target: 'enemy',
          formula: 'a : b = c : d',
          desc: '用比例锁定敌人：造成计算伤害，并使其露出破绽。',
          effects: [
            { type: 'damage', target: 'selected', mult: 0.9, flat: 4, method: 'calc' },
            { type: 'status', target: 'selected', status: 'vuln', duration: 2, value: 0.25 }
          ]
        },
        {
          id: 'pyth_construct', name: '作图', tag: 'construction', method: 'construct', cost: 1, target: 'ally',
          formula: '以弦为边作正方形',
          desc: '为一名同伴作护盾，并让他的攻击更锋利。',
          effects: [
            { type: 'shield', target: 'selected', mult: 0.45, flat: 4 },
            { type: 'buff', target: 'selected', stat: 'atk', value: 0.12, duration: 2 }
          ]
        }
      ],
      axiom: {
        id: 'pyth_bull', name: '百牛大祭', formula: 'a² + b² = c²', cost: 2, cooldown: 3,
        target: 'enemy', method: 'calc',
        desc: '传说他证得定理后宰了一百头牛。对单体造成计算伤害，防御越高，伤害越高。',
        effects: [
          { type: 'damage', target: 'selected', mult: 1.15, flat: 6, method: 'calc', defScale: 1.0 }
        ]
      }
    },
    {
      id: 'pascal',
      name: '帕斯卡',
      latin: 'Blaise Pascal',
      era: '1623–1662',
      title: '赌局的先知',
      rarity: 'R',
      school: 'probability',
      sigil: 'pascal',
      color: '#e8a0a0',
      quote: '人是一根会思想的芦苇。',
      bio: '他十六岁写出圆锥曲线论，后来在赌桌边与费马通信，替概率论翻开了第一页。最后，他把赌注押在了信仰上。',
      base: { hp: 122, atk: 20, def: 9 },
      growth: { hp: 10, atk: 1.2, def: 0.6 },
      formulas: [
        {
          id: 'pascal_chance', name: '概率', tag: 'probability', method: 'calc', cost: 1, target: 'allAllies',
          formula: 'P(A) = |A| / |Ω|',
          desc: '把好运气分给全队：治疗所有人，并小幅提高攻击。',
          effects: [
            { type: 'heal', target: 'allAllies', mult: 0.45, flat: 4 },
            { type: 'buff', target: 'allAllies', stat: 'atk', value: 0.1, duration: 2 }
          ]
        },
        {
          id: 'pascal_induction', name: '归纳', tag: 'induction', method: 'deduct', cost: 1, target: 'enemy',
          formula: 'P(1) 且 P(n) ⇒ P(n+1)',
          desc: '从第一项推到无穷：造成演绎伤害，并把结论分享给全队。',
          effects: [
            { type: 'damage', target: 'selected', mult: 0.65, flat: 4, method: 'deduct' },
            { type: 'buff', target: 'allAllies', stat: 'atk', value: 0.1, duration: 2 }
          ]
        }
      ],
      axiom: {
        id: 'pascal_wager', name: '帕斯卡赌注', formula: 'P(信) × ∞ > P(疑) × 有限', cost: 2, cooldown: 3,
        target: 'allAllies', method: 'calc',
        desc: '五五开的赌局：成功时全队大幅治疗并获得昂扬；失败时只得到小回复与护盾。',
        effects: [
          {
            type: 'randomOutcome', chance: 0.5,
            success: [
              { type: 'heal', target: 'allAllies', mult: 0.5, flat: 6 },
              { type: 'buff', target: 'allAllies', stat: 'atk', value: 0.25, duration: 2 }
            ],
            fail: [
              { type: 'heal', target: 'allAllies', mult: 0.2, flat: 2 },
              { type: 'shield', target: 'allAllies', mult: 0.2, flat: 3 }
            ]
          }
        ]
      }
    },
    {
      id: 'descartes',
      name: '笛卡尔',
      latin: 'René Descartes',
      era: '1596–1650',
      title: '坐标的缝匠',
      rarity: 'R',
      school: 'geometry',
      sigil: 'descartes',
      color: '#9ccb86',
      quote: '我思故我在。',
      bio: '他用两条垂直的线，把代数与几何缝在一起。从此，图形可以被计算，方程也可以被看见。',
      base: { hp: 116, atk: 28, def: 7 },
      growth: { hp: 9.5, atk: 1.6, def: 0.5 },
      formulas: [
        {
          id: 'descartes_coord', name: '坐标', tag: 'coordinate', method: 'construct', cost: 1, target: 'enemy',
          formula: 'P(x, y) ↦ (x, f(x))',
          desc: '把敌人钉在坐标系上：造成构造伤害并削弱其防御。',
          effects: [
            { type: 'damage', target: 'selected', mult: 0.75, flat: 4, method: 'construct' },
            { type: 'status', target: 'selected', status: 'defDown', duration: 2, value: 0.3 }
          ]
        },
        {
          id: 'descartes_doubt', name: '怀疑', tag: 'axiom', method: 'deduct', cost: 1, target: 'enemy',
          formula: 'De omnibus dubitandum',
          desc: '怀疑一切，包括敌人的力量：造成演绎伤害并降低其攻击。',
          effects: [
            { type: 'damage', target: 'selected', mult: 0.55, flat: 3, method: 'deduct' },
            { type: 'status', target: 'selected', status: 'atkDown', duration: 2, value: 0.2 }
          ]
        }
      ],
      axiom: {
        id: 'descartes_cogito', name: '我思故我在', formula: 'Cogito, ergo sum.', cost: 2, cooldown: 3,
        target: 'allAllies', method: 'deduct',
        desc: '先把一切清空，再确认自己还在：净化全队、获得澄明，并治疗。',
        effects: [
          { type: 'cleanse', target: 'allAllies' },
          { type: 'status', target: 'allAllies', status: 'ward', duration: 2 },
          { type: 'heal', target: 'allAllies', mult: 0.35, flat: 4 }
        ]
      }
    }
  ];

  const SCHOLAR_MAP = {};
  SCHOLARS.forEach(function (s) { SCHOLAR_MAP[s.id] = s; });

  const RECIPES = [
    {
      id: 'cauchy', name: '柯西收敛定理', tags: ['limit', 'series'], formula: '∀ ε > 0, ∃ N, |aₙ − a| < ε',
      desc: '把两条无穷的线索并成一条收敛的证明：对所有敌人造成真理伤害，并净化全队。',
      flavor: '「再给我一个 N，我就能把误差压到你想要的地方。」',
      effects: [
        { type: 'damage', target: 'allEnemies', mult: 0.65, flat: 6, truth: true },
        { type: 'cleanse', target: 'allAllies' }
      ]
    },
    {
      id: 'arithmetic', name: '算术基本定理', tags: ['congruence', 'induction'], formula: 'n = p₁^{a₁} · p₂^{a₂} · …',
      desc: '任何整数都能被拆成素数的乘积：对单体造成高额真理伤害，并令其防御松动。',
      flavor: '分解到底，剩下的就再也分不动了。',
      effects: [
        { type: 'damage', target: 'selected', mult: 1.45, flat: 8, truth: true },
        { type: 'status', target: 'selected', status: 'defDown', duration: 3, value: 0.3 }
      ]
    },
    {
      id: 'conservation', name: '守恒律', tags: ['symmetry', 'axiom'], formula: '对称性 ⇒ 守恒量',
      desc: '每一个对称都对应一个不变量：全队攻击提高，并立刻返还 1 点行动力。',
      flavor: '你以为你改变了一切，其实只是换了一个角度看同一个东西。',
      effects: [
        { type: 'buff', target: 'allAllies', stat: 'atk', value: 0.25, duration: 2 },
        { type: 'ap', value: 1 }
      ]
    },
    {
      id: 'analytic_geometry', name: '解析几何', tags: ['construction', 'coordinate'], formula: '曲线 ⇄ 方程',
      desc: '把图形钉进坐标系：对单体造成真理伤害，并使其长时间暴露破绽。',
      flavor: '只要有了坐标，连灵魂都能被写成方程。',
      effects: [
        { type: 'damage', target: 'selected', mult: 1.05, flat: 6, truth: true },
        { type: 'status', target: 'selected', status: 'vuln', duration: 3, value: 0.35 }
      ]
    },
    {
      id: 'pythagorean', name: '勾股定理', tags: ['ratio', 'axiom'], formula: 'a² + b² = c²',
      desc: '两条直角边撑起一条斜边：对单体造成真理伤害，并给生命最低的同伴护盾。',
      flavor: '「所以，三、四、五。」他说完，牛群开始哀鸣。',
      effects: [
        { type: 'damage', target: 'selected', mult: 1.0, flat: 6, truth: true },
        { type: 'shield', target: 'lowestAlly', mult: 0.5, flat: 5 }
      ]
    },
    {
      id: 'law_large_numbers', name: '大数定律', tags: ['probability', 'induction'], formula: 'n → ∞ 时，频率 → 概率',
      desc: '把足够多的偶然叠成必然：治疗全队，并净化全队负面状态。',
      flavor: '一次是意外，一万次就是规律。',
      effects: [
        { type: 'heal', target: 'allAllies', mult: 0.5, flat: 5 },
        { type: 'cleanse', target: 'allAllies' }
      ]
    },
    {
      id: 'fourier', name: '傅里叶展开', tags: ['series', 'coordinate'], formula: 'f(x) = Σ (aₙ cos nx + bₙ sin nx)',
      desc: '任何波形都能拆成简谐波：对所有敌人造成真理伤害，并削弱其攻击。',
      flavor: '你以为它很复杂，其实只是很多个圆在同时转。',
      effects: [
        { type: 'damage', target: 'allEnemies', mult: 0.6, flat: 6, truth: true },
        { type: 'status', target: 'allEnemies', status: 'atkDown', duration: 2, value: 0.2 }
      ]
    },
    {
      id: 'central_limit', name: '中心极限定理', tags: ['limit', 'probability'], formula: '(X̄ − μ) / (σ/√n) → N(0, 1)',
      desc: '再混乱的分布，平均之后也会走向同一个钟形：全队获得护盾与攻击提升。',
      flavor: '世界很吵，但平均值很安静。',
      effects: [
        { type: 'shield', target: 'allAllies', mult: 0.45, flat: 5 },
        { type: 'buff', target: 'allAllies', stat: 'atk', value: 0.15, duration: 2 }
      ]
    },
    {
      id: 'choice', name: '选择公理', tags: ['axiom', 'axiom'], formula: '∀ 非空集合族，存在选择函数',
      desc: '从每一堆里各挑一个：返还 1 点行动力，全队获得护盾并净化。',
      flavor: '你说不出怎么选，但你就是选了。',
      effects: [
        { type: 'ap', value: 1 },
        { type: 'shield', target: 'allAllies', mult: 0.3, flat: 4 },
        { type: 'cleanse', target: 'allAllies' }
      ]
    },
    {
      id: 'similar', name: '相似三角形', tags: ['construction', 'ratio'], formula: '对应边成比例',
      desc: '形状相同，大小不同：对所有敌人造成真理伤害并留下破绽。',
      flavor: '放大之后，你还是你。',
      effects: [
        { type: 'damage', target: 'allEnemies', mult: 0.55, flat: 5, truth: true },
        { type: 'status', target: 'allEnemies', status: 'vuln', duration: 2, value: 0.25 }
      ]
    },
    {
      id: 'fermat_little', name: '费马小定理', tags: ['congruence', 'coordinate'], formula: 'a^{p−1} ≡ 1 (mod p)',
      desc: '在素数模下，一切都会回到 1：对单体造成真理伤害，并同时削弱其攻击与防御。',
      flavor: '「我还有一个绝妙的证明，但页边太窄了。」',
      effects: [
        { type: 'damage', target: 'selected', mult: 1.2, flat: 6, truth: true },
        { type: 'status', target: 'selected', status: 'atkDown', duration: 2, value: 0.25 },
        { type: 'status', target: 'selected', status: 'defDown', duration: 2, value: 0.2 }
      ]
    },
    {
      id: 'group_representation', name: '群表示', tags: ['symmetry', 'induction'], formula: 'G → GL(V)',
      desc: '把抽象的对称放进一个具体的空间：全队攻击提高并获得护盾。',
      flavor: '同一个群，换一件衣服，就能被看见。',
      effects: [
        { type: 'buff', target: 'allAllies', stat: 'atk', value: 0.2, duration: 2 },
        { type: 'shield', target: 'allAllies', mult: 0.3, flat: 4 }
      ]
    },
    {
      id: 'trisection', name: '三等分角', tags: ['construction', 'construction'], formula: '尺规不能三等分任意角',
      desc: '有些东西造不出来，但这不妨碍你用它防守：对单体造成真理伤害、削弱其攻击，并给同伴护盾。',
      flavor: '「做不到」本身，就是一条定理。',
      effects: [
        { type: 'damage', target: 'selected', mult: 0.8, flat: 5, truth: true },
        { type: 'status', target: 'selected', status: 'atkDown', duration: 2, value: 0.3 },
        { type: 'shield', target: 'lowestAlly', mult: 0.3, flat: 4 }
      ]
    },
    {
      id: 'expectation', name: '期望', tags: ['series', 'probability'], formula: 'E[X] = Σ xᵢ · P(xᵢ)',
      desc: '把可能性加权成一个数：五五开地对单体造成高额真理伤害，或治疗全队。',
      flavor: '赌徒不是不算，他只是把算盘打在了心里。',
      effects: [
        {
          type: 'randomOutcome', chance: 0.5,
          success: [
            { type: 'damage', target: 'selected', mult: 1.55, flat: 8, truth: true }
          ],
          fail: [
            { type: 'heal', target: 'allAllies', mult: 0.45, flat: 5 }
          ]
        }
      ]
    }
  ];

  const RECIPE_MAP = {};
  RECIPES.forEach(function (r) {
    const key = r.tags.slice().sort().join('|');
    RECIPE_MAP[key] = r;
  });

  function getRecipe(tagA, tagB) {
    if (!tagA || !tagB) return null;
    return RECIPE_MAP[[tagA, tagB].sort().join('|')] || null;
  }

  const ENEMIES = [
    {
      id: 'liar', name: '说谎者', title: '「这句话是假的。」', sigil: 'liar', color: '#e0705f',
      hp: 100, atk: 12, def: 2, weakness: 'calc', resist: 'deduct',
      desc: '你越追问，它越有精神。它靠你的困惑活着。',
      pattern: [
        { type: 'attack', target: 'single', mult: 0.9, label: '自指一击' },
        { type: 'status', target: 'single', status: 'atkDown', value: 0.2, duration: 2, label: '真假难辨' },
        { type: 'attack', target: 'single', mult: 1.0, label: '循环论证' }
      ]
    },
    {
      id: 'tortoise', name: '芝诺之龟', title: '无限二分', sigil: 'tortoise', color: '#9ccb86',
      hp: 122, atk: 10, def: 9, weakness: 'construct', resist: 'calc',
      desc: '每当你逼近一半，它就再向前半步。壳上刻满了没有终点的刻度。',
      pattern: [
        { type: 'shield', value: 10, label: '缩进壳里' },
        { type: 'attack', target: 'single', mult: 0.7, label: '慢半步' },
        { type: 'attack', target: 'all', mult: 0.35, label: '无限逼近' }
      ]
    },
    {
      id: 'hotel', name: '希尔伯特旅馆', title: '客满，但永远有空房', sigil: 'hotel', color: '#8fc7e8',
      hp: 138, atk: 11, def: 4, weakness: 'deduct', resist: 'construct',
      desc: '前台挂着「满房」的牌子。你每敲开一扇门，里面都还有一扇。',
      pattern: [
        { type: 'heal', target: 'self', value: 12, label: '再开一间房' },
        { type: 'attack', target: 'all', mult: 0.4, label: '无限走廊' },
        { type: 'buff', target: 'self', stat: 'atk', value: 0.2, duration: 2, label: '房客越来越多' }
      ]
    },
    {
      id: 'barber', name: '理发师', title: '只给不自己理发的人理发', sigil: 'barber', color: '#c9a7e8',
      hp: 132, atk: 15, def: 5, weakness: 'deduct', resist: 'calc',
      desc: '他举起剪刀，忽然停住。你看见他的头发已经很长了。',
      pattern: [
        { type: 'attack', target: 'single', mult: 1.1, label: '剪刀落下' },
        { type: 'status', target: 'single', status: 'defDown', value: 0.2, duration: 2, label: '剃掉防御' },
        { type: 'attack', target: 'single', mult: 1.1, label: '再来一次' }
      ]
    },
    {
      id: 'berry', name: '贝里悖论', title: '用少于十九个字描述它', sigil: 'berry', color: '#e8a0a0',
      hp: 92, atk: 14, def: 3, weakness: 'calc', resist: 'deduct',
      desc: '「最小的不能用十九个字描述的数。」它刚被说完，就已经被描述了。',
      pattern: [
        { type: 'status', target: 'all', status: 'silence', duration: 2, label: '不可描述' },
        { type: 'attack', target: 'single', mult: 0.95, label: '词不达意' },
        { type: 'attack', target: 'all', mult: 0.35, label: '语言失效' }
      ]
    },
    {
      id: 'simpson', name: '辛普森幽灵', title: '分组上升，合并下降', sigil: 'simpson', color: '#e8a0a0',
      hp: 152, atk: 13, def: 4, weakness: 'construct', resist: 'calc',
      desc: '它同时站在两条趋势线上。你每证明一条，它就换到另一条。',
      pattern: [
        { type: 'heal', target: 'allies', value: 10, label: '统计修正' },
        { type: 'buff', target: 'allies', stat: 'atk', value: 0.15, duration: 2, label: '加权平均' },
        { type: 'attack', target: 'single', mult: 0.9, label: '分组陷阱' }
      ]
    },
    {
      id: 'hanging', name: '意外绞刑', title: '行刑日将出乎意料', sigil: 'hanging', color: '#e0705f',
      hp: 162, atk: 18, def: 6, weakness: 'construct', resist: 'deduct',
      desc: '判决说，行刑日会在你意想不到的那天到来。于是你开始害怕每一个清晨。',
      pattern: [
        { type: 'charge', value: 0.7, label: '挑选行刑日' },
        { type: 'attack', target: 'all', mult: 1.15, label: '意料之外' },
        { type: 'attack', target: 'single', mult: 0.8, label: '绳索收紧' }
      ]
    },
    {
      id: 'empty_set', name: '空集之影', title: '存在，但不包含任何东西', sigil: 'empty_set', color: '#8fc7e8',
      hp: 86, atk: 17, def: 2, weakness: 'deduct', resist: 'construct', passive: 'evadeFirst',
      desc: '你看见了它。它也看见了你。但当你伸手，那里什么都没有。',
      pattern: [
        { type: 'attack', target: 'single', mult: 1.0, label: '空无一物' },
        { type: 'status', target: 'single', status: 'vuln', value: 0.2, duration: 2, label: '被移除的边界' },
        { type: 'attack', target: 'all', mult: 0.4, label: '∅' }
      ]
    },
    {
      id: 'recursion', name: '无穷递归', title: '它调用自己', sigil: 'recursion', color: '#c9a7e8',
      hp: 172, atk: 15, def: 5, weakness: 'calc', resist: 'deduct', passive: 'revive',
      desc: '你砍掉它的头，它从自己的调用栈里又长出一个。',
      pattern: [
        { type: 'attack', target: 'single', mult: 0.9, label: '再入' },
        { type: 'heal', target: 'self', value: 12, label: '栈帧恢复' },
        { type: 'attack', target: 'all', mult: 0.45, label: '栈溢出' }
      ]
    },
    {
      id: 'russell', name: '罗素悖论', title: '所有不包含自身的集合，是否包含自身？', sigil: 'russell', color: '#e8c46a',
      hp: 620, atk: 32, def: 8, weakness: null, resist: null, boss: true, paradoxShield: 60,
      desc: '它站在讲台上，身后是无数个互相吞食的圆。它没有影子——因为影子也在它里面。',
      pattern: [
        { type: 'attack', target: 'single', mult: 1.0, label: '自指之矛' },
        { type: 'attack', target: 'all', mult: 0.55, label: '全集之压' },
        { type: 'charge', value: 0.8, label: '罗素之环' },
        { type: 'attack', target: 'all', mult: 1.15, label: '无限降维' }
      ],
      phase2: {
        at: 0.5,
        text: '罗素悖论裂成两个互相指认的圆。「那么，我是否包含我自己？」',
        effects: [
          { type: 'buff', target: 'self', stat: 'atk', value: 0.2, duration: 99 },
          { type: 'paradox', value: 40 }
        ],
        pattern: [
          { type: 'attack', target: 'single', mult: 1.2, label: '自指之矛·二重' },
          { type: 'attack', target: 'all', mult: 0.7, label: '全集之压·二重' },
          { type: 'status', target: 'all', status: 'vuln', value: 0.25, duration: 2, label: '集合的裂缝' },
          { type: 'attack', target: 'all', mult: 1.3, label: '无限降维' }
        ]
      }
    }
  ];

  const ENEMY_MAP = {};
  ENEMIES.forEach(function (e) { ENEMY_MAP[e.id] = e; });

  const STAGES = [
    {
      id: '1-1', index: 1, name: '第一课', subtitle: '说谎者', kind: 'normal', level: 1, rec: 1, par: 6,
      enemyIds: ['liar'], tutorial: true,
      storyBefore: '康托尔失踪的第七天，学院的黑板开始自己写字。第一行是：「这句话是假的。」',
      storyAfter: '你第一次把谎言从黑板上擦掉。粉笔灰落下来，像一场很轻的雪。',
      rewards: { first: { insp: 160, notes: 120, manu: 0 }, repeat: { insp: 20, notes: 40, manu: 0 }, perStar: 40 }
    },
    {
      id: '1-2', index: 2, name: '走廊尽头', subtitle: '芝诺之龟', kind: 'normal', level: 3, rec: 3, par: 7,
      enemyIds: ['tortoise'],
      storyBefore: '走廊比昨天长了一倍。尽头有一只乌龟，正把地板画成无数个越来越小的格子。',
      storyAfter: '你跨过最后半个格子。乌龟说：「你只是还没走到。」你没理它。',
      rewards: { first: { insp: 180, notes: 150, manu: 0 }, repeat: { insp: 24, notes: 50, manu: 0 }, perStar: 40 }
    },
    {
      id: '1-3', index: 3, name: '无限客房', subtitle: '希尔伯特旅馆', kind: 'normal', level: 5, rec: 5, par: 8,
      enemyIds: ['hotel', 'liar'],
      storyBefore: '旅馆前台说客满了，然后递给你一把钥匙。钥匙上写着「∞ 号房」。',
      storyAfter: '你退房时，前台问：「您确定您住过吗？」',
      rewards: { first: { insp: 200, notes: 180, manu: 1 }, repeat: { insp: 26, notes: 60, manu: 0 }, perStar: 50 }
    },
    {
      id: '1-4', index: 4, name: '理发师', subtitle: '精英 · 只给不自己理发的人理发', kind: 'elite', level: 7, rec: 7, par: 9,
      enemyIds: ['barber', 'empty_set'],
      storyBefore: '理发店的门楣上挂着一把剪刀。剪刀下面站着一个头发很长的人。',
      storyAfter: '你走出理发店，发现自己的影子少了一小块。空集之影把它借走了。',
      rewards: { first: { insp: 260, notes: 220, manu: 2 }, repeat: { insp: 32, notes: 70, manu: 1 }, perStar: 60 }
    },
    {
      id: '1-5', index: 5, name: '统计陷阱', subtitle: '辛普森幽灵', kind: 'normal', level: 9, rec: 9, par: 8,
      enemyIds: ['simpson', 'liar'],
      storyBefore: '阶梯教室的每一级台阶，都写着一条互相矛盾的趋势线。',
      storyAfter: '你终于看懂了：它没有撒谎，它只是把两个群体混在了一起。',
      rewards: { first: { insp: 220, notes: 200, manu: 1 }, repeat: { insp: 28, notes: 65, manu: 0 }, perStar: 50 }
    },
    {
      id: '1-6', index: 6, name: '钟楼', subtitle: '意外绞刑', kind: 'normal', level: 11, rec: 11, par: 9,
      enemyIds: ['hanging', 'berry'],
      storyBefore: '钟楼的钟停在十一点五十九分。每一分钟，都有人从楼下经过，又都觉得自己不是那个人。',
      storyAfter: '钟声响起。你意识到，意外之所以意外，是因为它从不提前通知。',
      rewards: { first: { insp: 240, notes: 220, manu: 1 }, repeat: { insp: 30, notes: 70, manu: 0 }, perStar: 60 }
    },
    {
      id: '1-7', index: 7, name: '递归书库', subtitle: '无穷递归', kind: 'normal', level: 13, rec: 13, par: 10,
      enemyIds: ['recursion', 'tortoise'],
      storyBefore: '每一本书都在引用自己。你翻开一页，发现下一页是同一页。',
      storyAfter: '你合上书。书里也合上了一本书。',
      rewards: { first: { insp: 260, notes: 240, manu: 1 }, repeat: { insp: 32, notes: 75, manu: 0 }, perStar: 60 }
    },
    {
      id: '1-8', index: 8, name: '空集', subtitle: '精英 · 存在，但不包含任何东西', kind: 'elite', level: 15, rec: 14, par: 9,
      enemyIds: ['empty_set', 'empty_set', 'berry'],
      storyBefore: '走廊尽头有三扇门。三扇门后都是空的。但你能听见里面有呼吸声。',
      storyAfter: '你确认了三遍：那里什么都没有。可你的手还在抖。',
      rewards: { first: { insp: 300, notes: 260, manu: 2 }, repeat: { insp: 36, notes: 80, manu: 1 }, perStar: 70 }
    },
    {
      id: '1-9', index: 9, name: '自指回廊', subtitle: '意外的重逢', kind: 'normal', level: 17, rec: 16, par: 10,
      enemyIds: ['hanging', 'simpson', 'liar'],
      storyBefore: '回廊的墙上挂着所有你击败过的悖论。它们没有死，只是在等你回头。',
      storyAfter: '你没有回头。你听见身后有人鼓掌，声音像粉笔在黑板上折断。',
      rewards: { first: { insp: 320, notes: 280, manu: 1 }, repeat: { insp: 38, notes: 85, manu: 0 }, perStar: 70 }
    },
    {
      id: '1-10', index: 10, name: '讲台', subtitle: 'Boss · 罗素悖论', kind: 'boss', level: 20, rec: 18, par: 14,
      enemyIds: ['russell'],
      storyBefore: '讲台上站着一个没有影子的人。它问：「所有不包含自身的集合，是否包含自身？」',
      storyAfter: '悖论没有消失，它只是退回了黑板的边缘。康托尔的办公室里，有人用粉笔写下：「下一站，无穷。」',
      rewards: { first: { insp: 600, notes: 400, manu: 4 }, repeat: { insp: 60, notes: 120, manu: 1 }, perStar: 100 }
    }
  ];

  const STAGE_MAP = {};
  STAGES.forEach(function (s) { STAGE_MAP[s.id] = s; });

  const GACHA = {
    cost: 160,
    tenCost: 1600,
    rates: { SSR: 0.03, SR: 0.17, R: 0.8 },
    pity: 40,
    softPity: 30,
    softPityStep: 0.05,
    dupeCompensation: { SSR: 600, SR: 200, R: 80 },
    maxDupes: 5
  };

  const STARTERS = ['euclid', 'pythagoras', 'pascal'];

  return {
    VERSION: VERSION,
    SCHOOLS: SCHOOLS,
    RARITY: RARITY,
    METHODS: METHODS,
    TAGS: TAGS,
    STATUSES: STATUSES,
    SCHOLARS: SCHOLARS,
    SCHOLAR_MAP: SCHOLAR_MAP,
    RECIPES: RECIPES,
    RECIPE_MAP: RECIPE_MAP,
    getRecipe: getRecipe,
    ENEMIES: ENEMIES,
    ENEMY_MAP: ENEMY_MAP,
    STAGES: STAGES,
    STAGE_MAP: STAGE_MAP,
    GACHA: GACHA,
    STARTERS: STARTERS
  };
});
