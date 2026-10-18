/* 《真理学院》V2 卡牌数据：30 张卡、初始牌组、AI 牌组、关卡与奖励。
   规则见 docs/design-spec-v2.md。本文件不依赖 DOM，可被 Node 直接 require。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TA_DATA = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 2;

  const ROWS = ['axiom', 'reasoning', 'theorem'];
  const ROW_LABELS = { axiom: '公理域', reasoning: '推演域', theorem: '定理域' };
  const ROW_SHORT = { axiom: '公理', reasoning: '推演', theorem: '定理' };

  const FACTIONS = {
    geometry: { id: 'geometry', name: '几何学派', mark: '△', color: '#7fc8a9' },
    analysis: { id: 'analysis', name: '分析学派', mark: '∫', color: '#8db6e8' },
    logic: { id: 'logic', name: '逻辑与集合', mark: '⊢', color: '#b49ae8' },
    neutral: { id: 'neutral', name: '通用', mark: '∴', color: '#cfc7ac' }
  };

  function unit(id, name, faction, row, power, ability, extra) {
    return Object.assign({
      id: id,
      name: name,
      faction: faction,
      type: 'unit',
      row: row,
      power: power,
      ability: ability || null,
      bondId: null,
      maxCopies: ability === 'master' ? 1 : 3,
      collectible: true,
      text: ''
    }, extra || {});
  }

  function special(id, name, ability, text, extra) {
    return Object.assign({
      id: id,
      name: name,
      faction: 'neutral',
      type: 'special',
      row: null,
      power: 0,
      ability: ability,
      bondId: null,
      maxCopies: 3,
      collectible: true,
      negatable: false,
      text: text
    }, extra || {});
  }

  function paradox(id, name, effect, text) {
    return {
      id: id,
      name: name,
      faction: 'neutral',
      type: 'paradox',
      row: null,
      power: 0,
      ability: 'paradox',
      effect: effect,
      bondId: null,
      maxCopies: 3,
      collectible: true,
      negatable: true,
      text: text
    };
  }

  const CARDS = [
    /* ---- 普通单位 ×14 ---- */
    unit('euclid-apprentice', '欧几里得学徒', 'geometry', 'axiom', 4, null, {
      text: '几何学的起点。没有特效，但稳定。'
    }),
    unit('ruler-compass', '尺规作图', 'geometry', 'reasoning', 5, null, {
      text: '圆规与直尺，古希腊几何的全部工具。'
    }),
    unit('proportion', '比例论', 'geometry', 'reasoning', 5, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('triangle', '三角形', 'geometry', 'theorem', 4, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('parallel', '平行公设', 'geometry', 'axiom', 6, null, {
      text: '第五公设。看起来理所当然，却孕育了非欧几何。'
    }),
    unit('geometric-proof', '几何证明', 'geometry', 'theorem', 5, null, {
      text: '一步一步，把结论钉死在黑板上。'
    }),
    unit('pythagoras-disciple', '毕达哥拉斯门徒', 'geometry', 'reasoning', 5, 'bond', {
      bondId: 'pythagorean',
      text: '学派联动·毕达哥拉斯：与另一张同组牌同时存在时，论证力翻倍。'
    }),
    unit('pythagorean-theorem', '勾股定理', 'geometry', 'theorem', 6, 'bond', {
      bondId: 'pythagorean',
      text: '学派联动·毕达哥拉斯：与另一张同组牌同时存在时，论证力翻倍。'
    }),
    unit('number-line', '数轴', 'geometry', 'axiom', 4, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('coordinate', '坐标系', 'geometry', 'reasoning', 5, null, {
      text: '把几何翻译成代数。'
    }),
    unit('auxiliary-line', '辅助线', 'geometry', 'axiom', 3, null, {
      text: '一条临时画上去的线，常常是整道证明的入口。'
    }),
    unit('conic', '圆锥曲线', 'geometry', 'theorem', 5, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('limit', '极限', 'neutral', 'theorem', 6, 'bond', {
      bondId: 'infinite',
      text: '学派联动·无穷：与另一张同组牌同时存在时，论证力翻倍。'
    }),
    unit('set', '集合', 'neutral', 'reasoning', 4, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('infinity', '无穷', 'neutral', 'theorem', 6, 'bond', {
      bondId: 'infinite',
      text: '学派联动·无穷：与另一张同组牌同时存在时，论证力翻倍。'
    }),

    /* ---- 高级单位 ×4 ---- */
    unit('pythagoras', '毕达哥拉斯', 'geometry', 'reasoning', 6, 'bond', {
      bondId: 'pythagorean',
      text: '学派联动·毕达哥拉斯：与另一张同组牌同时存在时，论证力翻倍。'
    }),
    unit('descartes', '笛卡尔', 'geometry', 'reasoning', 7, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('riemann', '黎曼', 'neutral', 'theorem', 8, 'bond', {
      bondId: 'infinite',
      text: '学派联动·无穷：与另一张同组牌同时存在时，论证力翻倍。'
    }),
    unit('noether', '诺特', 'neutral', 'theorem', 7, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),

    /* ---- 巨匠 ×2 ---- */
    unit('euclid', '欧几里得·巨匠', 'geometry', 'axiom', 10, 'master', {
      text: '巨匠：不受悖论、反证法与撤回命题影响。'
    }),
    unit('gauss', '高斯·巨匠', 'neutral', 'theorem', 10, 'master', {
      text: '巨匠：不受悖论、反证法与撤回命题影响。'
    }),

    /* ---- 策略 ×6 ---- */
    special('counterexample', '反例', 'counterexample',
      '在对方任一排生成一张 1 点「反例」，然后抽 1 张牌。'),
    special('citation', '引证', 'citation',
      '选择弃牌堆中一张单位牌，直接放回它所在的排。'),
    special('consensus', '学术共识', 'consensus',
      '己方场上所有单位 +2 论证力，持续到本小局结束。', { negatable: true }),
    special('withdraw', '撤回命题', 'withdraw',
      '将己方一张单位收回手牌。', { negatable: true }),
    special('reductio', '反证法', 'reductio',
      '摧毁对方论证力最高的非巨匠单位。', { negatable: true }),
    special('clarify', '公理澄清', 'clarify',
      '解除一排的悖论效果。', { negatable: true }),

    /* ---- 逻辑与集合：基础单位 ×9 ---- */
    unit('proposition', '命题', 'logic', 'axiom', 4, null, {
      text: '逻辑学的原子。一个命题非真即假。'
    }),
    unit('predicate', '谓词', 'logic', 'reasoning', 4, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('relation', '关系', 'logic', 'reasoning', 5, null, {
      text: '两个对象之间可以成立或不成立的东西。'
    }),
    unit('mapping', '映射', 'logic', 'reasoning', 5, 'deduce', {
      text: '推论：若上一张牌是逻辑单位，+4 论证力。'
    }),
    unit('formal-language', '形式语言', 'logic', 'axiom', 4, null, {
      text: '把自然语言压缩成符号，再把符号变成证明。'
    }),
    unit('proof-tree', '证明树', 'logic', 'theorem', 6, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('model', '模型', 'logic', 'theorem', 6, 'deduce', {
      text: '推论：若上一张牌是逻辑单位，+4 论证力。'
    }),
    unit('cardinal', '基数', 'logic', 'theorem', 5, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('ordinal', '序数', 'logic', 'axiom', 5, null, {
      text: '不仅问“多少”，还问“排在第几”。'
    }),

    /* ---- 逻辑与集合：数学家 ×10 ---- */
    unit('cantor', '康托尔', 'logic', 'theorem', 7, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('russell-adv', '罗素', 'logic', 'reasoning', 7, 'deduce', {
      text: '推论：若上一张牌是逻辑单位，+4 论证力。'
    }),
    unit('hilbert', '希尔伯特', 'logic', 'axiom', 7, 'deduce', {
      text: '推论：若上一张牌是逻辑单位，+4 论证力。'
    }),
    unit('frege', '弗雷格', 'logic', 'reasoning', 6, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('boole', '布尔', 'logic', 'reasoning', 7, 'deduce', {
      text: '推论：若上一张牌是逻辑单位，+4 论证力。'
    }),
    unit('turing', '图灵', 'logic', 'theorem', 8, 'deduce', {
      text: '推论：若上一张牌是逻辑单位，+4 论证力。'
    }),
    unit('zermelo', '策梅洛', 'logic', 'axiom', 7, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('tarski', '塔斯基', 'logic', 'theorem', 7, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('dedekind', '戴德金', 'logic', 'reasoning', 7, 'deduce', {
      text: '推论：若上一张牌是逻辑单位，+4 论证力。'
    }),
    unit('peano', '皮亚诺', 'logic', 'axiom', 6, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),

    unit('godel', '哥德尔', 'logic', 'theorem', 8, 'deduce', {
      text: '推论：若上一张牌是逻辑单位，+4 论证力。'
    }),

    /* ---- 逻辑与集合：巨匠 ×2 ---- */
    unit('cantor-master', '康托尔·巨匠', 'logic', 'theorem', 10, 'master', {
      text: '巨匠：不受悖论、反证法与撤回命题影响。'
    }),
    unit('godel-master', '哥德尔·巨匠', 'logic', 'theorem', 10, 'master', {
      text: '巨匠：不受悖论、反证法与撤回命题影响。'
    }),

    /* ---- 逻辑与集合：特殊牌 ×6 ---- */
    special('extended-counterexample', '反例扩展', 'counterexample',
      '在对方任一排生成一张 1 点「反例」，然后抽 2 张牌。', { draw: 2 }),
    special('logical-negation', '逻辑否定', 'negate',
      '取消对方最近打出的一张策略牌的效果。'),
    special('diagonal', '对角线法', 'diagonal',
      '对方一排有至少 3 个单位时，在己方对应排生成一个 3 点「自指命题」。', { negatable: true }),
    special('formalization', '形式化', 'axiomatize',
      '选择己方一个普通单位，使其本小局不受悖论影响。', { negatable: true }),
    special('consistency', '一致性', 'clarify',
      '解除一排的悖论效果。', { negatable: true }),
    special('completeness', '完备性', 'draw',
      '抽 2 张牌。', { draw: 2 }),

    /* ---- 悖论 ×4（通关 1-10 后解锁收藏） ---- */
    paradox('russell', '罗素悖论',
      { mode: 'halve', value: 0 },
      '选择一排：双方该排单位论证力减半（最低 1）。'),
    paradox('zeno', '芝诺困境',
      { mode: 'flat', value: -2 },
      '选择一排：双方该排单位论证力 -2（最低 1）。'),
    paradox('incompleteness', '不完备性危机',
      { mode: 'flat', value: -3 },
      '选择一排：双方该排单位论证力 -3（最低 1）。'),
    paradox('liar', '说谎者悖论',
      { mode: 'cap', value: 4 },
      '选择一排：双方该排单位论证力最高为 4。')
  ];

  const TOKENS = {
    'self-reference-token': {
      id: 'self-reference-token',
      name: '自指命题',
      faction: 'logic',
      type: 'unit',
      row: null,
      power: 3,
      ability: null,
      bondId: null,
      maxCopies: 0,
      collectible: false,
      token: true,
      text: '由「对角线法」生成。'
    },
    'counterexample-token': {
      id: 'counterexample-token',
      name: '反例',
      faction: 'neutral',
      type: 'unit',
      row: null,
      power: 1,
      ability: null,
      bondId: null,
      maxCopies: 0,
      collectible: false,
      token: true,
      text: '由「反例」生成。'
    }
  };

  const CARD_MAP = {};
  CARDS.forEach(function (c) { CARD_MAP[c.id] = c; });
  Object.keys(TOKENS).forEach(function (id) { CARD_MAP[id] = TOKENS[id]; });

  function getCard(id) {
    return CARD_MAP[id] || null;
  }

  function maxCopies(id) {
    const c = CARD_MAP[id];
    if (!c) return 0;
    return c.maxCopies == null ? 3 : c.maxCopies;
  }

  function deck(entries) {
    const out = [];
    Object.keys(entries).forEach(function (id) {
      if (!CARD_MAP[id]) throw new Error('未知卡牌：' + id);
      if (entries[id] > maxCopies(id)) throw new Error('超过同名上限：' + id);
      for (let i = 0; i < entries[id]; i++) out.push(id);
    });
    return out;
  }

  const STARTER_ENTRIES = {
    'euclid-apprentice': 3,
    'ruler-compass': 3,
    'proportion': 3,
    'triangle': 3,
    'parallel': 3,
    'geometric-proof': 3,
    'pythagoras-disciple': 2,
    'pythagorean-theorem': 1,
    'number-line': 2,
    'coordinate': 1,
    'conic': 1
  };

  const STARTER_DECK = deck(STARTER_ENTRIES);

  const STARTER_COUNTS = {};
  Object.keys(STARTER_ENTRIES).forEach(function (id) {
    STARTER_COUNTS[id] = STARTER_ENTRIES[id];
  });

  const LOGIC_STARTER_ENTRIES = {
    'proposition': 2,
    'predicate': 3,
    'relation': 3,
    'mapping': 3,
    'formal-language': 2,
    'proof-tree': 3,
    'set': 3,
    'counterexample': 2,
    'clarify': 1,
    'ordinal': 2,
    'cardinal': 1
  };

  const LOGIC_STARTER_DECK = deck(LOGIC_STARTER_ENTRIES);

  const FACTION_STARTER_DECKS = {
    geometry: STARTER_DECK.slice(),
    logic: LOGIC_STARTER_DECK.slice()
  };

  const FACTION_STARTER_COUNTS = {
    geometry: STARTER_COUNTS,
    logic: LOGIC_STARTER_ENTRIES
  };

  const AI_DECKS = {
    '1-1': {
      name: '学徒欧几里得',
      deck: deck({
        'euclid-apprentice': 3,
        'ruler-compass': 3,
        'proportion': 3,
        'triangle': 3,
        'number-line': 3,
        'coordinate': 3,
        'geometric-proof': 3,
        'conic': 3,
        'parallel': 1
      })
    },
    '1-2': {
      name: '芝诺',
      deck: deck({
        'ruler-compass': 3,
        'proportion': 3,
        'triangle': 3,
        'number-line': 3,
        'coordinate': 3,
        'parallel': 2,
        'conic': 2,
        'geometric-proof': 3,
        'euclid-apprentice': 3
      })
    },
    '1-3': {
      name: '共证讲师',
      deck: deck({
        'proportion': 3,
        'triangle': 3,
        'set': 3,
        'conic': 3,
        'coordinate': 3,
        'number-line': 3,
        'descartes': 1,
        'geometric-proof': 1,
        'parallel': 1,
        'euclid-apprentice': 2,
        'pythagoras-disciple': 1,
        'pythagorean-theorem': 1
      })
    },
    '1-4': {
      name: '命题回收员',
      deck: deck({
        'pythagoras-disciple': 3,
        'pythagorean-theorem': 3,
        'proportion': 3,
        'triangle': 3,
        'coordinate': 3,
        'withdraw': 2,
        'euclid-apprentice': 3,
        'number-line': 2,
        'geometric-proof': 2,
        'parallel': 1
      })
    },
    '1-5': {
      name: '反例工坊主',
      deck: deck({
        'counterexample': 3,
        'pythagoras-disciple': 3,
        'pythagorean-theorem': 3,
        'proportion': 2,
        'coordinate': 2,
        'ruler-compass': 2,
        'parallel': 2,
        'number-line': 2,
        'conic': 2,
        'geometric-proof': 2,
        'euclid-apprentice': 2
      })
    },
    '1-6': {
      name: '悖论看守',
      deck: deck({
        'zeno': 2,
        'liar': 2,
        'incompleteness': 2,
        'russell': 1,
        'clarify': 1,
        'set': 3,
        'proportion': 3,
        'triangle': 3,
        'number-line': 2,
        'coordinate': 2,
        'geometric-proof': 2,
        'conic': 2
      })
    },
    '1-7': {
      name: '引证学士',
      deck: deck({
        'citation': 2,
        'infinity': 2,
        'limit': 2,
        'riemann': 1,
        'set': 3,
        'proportion': 2,
        'triangle': 2,
        'coordinate': 2,
        'number-line': 2,
        'parallel': 2,
        'conic': 2,
        'geometric-proof': 2,
        'euclid-apprentice': 1
      })
    },
    '1-8': {
      name: '归谬法官',
      deck: deck({
        'reductio': 2,
        'descartes': 2,
        'pythagoras-disciple': 2,
        'pythagorean-theorem': 2,
        'proportion': 2,
        'triangle': 2,
        'set': 2,
        'infinity': 2,
        'limit': 2,
        'parallel': 2,
        'number-line': 2,
        'geometric-proof': 2,
        'conic': 1
      })
    },
    '1-9': {
      name: '综合辩手',
      deck: deck({
        'pythagoras': 1,
        'pythagoras-disciple': 2,
        'pythagorean-theorem': 2,
        'infinity': 2,
        'limit': 2,
        'riemann': 1,
        'set': 2,
        'proportion': 2,
        'coordinate': 2,
        'consensus': 1,
        'clarify': 1,
        'geometric-proof': 2,
        'triangle': 2,
        'number-line': 2,
        'parallel': 1
      })
    },
    '1-10': {
      name: '自指者',
      deck: deck({
        'gauss': 1,
        'riemann': 2,
        'noether': 2,
        'descartes': 2,
        'set': 2,
        'infinity': 2,
        'limit': 2,
        'proportion': 1,
        'consensus': 1,
        'clarify': 1,
        'reductio': 2,
        'russell': 1,
        'zeno': 1,
        'incompleteness': 1,
        'liar': 1,
        'withdraw': 1,
        'counterexample': 1,
        'citation': 1
      })
    },
    '2-1': {
      name: '命题大厅',
      deck: deck({
        'proposition': 3,
        'predicate': 3,
        'relation': 3,
        'formal-language': 3,
        'proof-tree': 3,
        'set': 3,
        'cardinal': 3,
        'ordinal': 3,
        'counterexample': 1
      })
    },
    '2-2': {
      name: '集合阶梯',
      deck: deck({
        'proposition': 3,
        'predicate': 3,
        'relation': 3,
        'formal-language': 3,
        'proof-tree': 3,
        'set': 3,
        'cardinal': 3,
        'ordinal': 2,
        'cantor': 1,
        'counterexample': 1
      })
    },
    '2-3': {
      name: '否定之门',
      deck: deck({
        'logical-negation': 3,
        'counterexample': 2,
        'set': 3,
        'relation': 3,
        'proposition': 3,
        'predicate': 3,
        'formal-language': 2,
        'proof-tree': 2,
        'cardinal': 1,
        'ordinal': 1,
        'limit': 2
      })
    },
    '2-4': {
      name: '模型室',
      deck: deck({
        'mapping': 3,
        'model': 3,
        'proposition': 2,
        'predicate': 2,
        'relation': 1,
        'formal-language': 2,
        'proof-tree': 2,
        'set': 2,
        'logical-negation': 2,
        'counterexample': 2,
        'cardinal': 1,
        'ordinal': 1,
        'cantor': 1,
        'clarify': 1
      })
    },
    '2-5': {
      name: '对角线',
      deck: deck({
        'diagonal': 2,
        'mapping': 2,
        'model': 2,
        'cantor': 2,
        'proposition': 2,
        'predicate': 2,
        'relation': 2,
        'proof-tree': 2,
        'set': 2,
        'counterexample': 2,
        'logical-negation': 1,
        'formal-language': 1,
        'cardinal': 1,
        'ordinal': 1,
        'clarify': 1
      })
    },
    '2-6': {
      name: '公理系统',
      deck: deck({
        'formalization': 2,
        'model': 2,
        'mapping': 2,
        'cantor': 2,
        'hilbert': 1,
        'proposition': 2,
        'predicate': 2,
        'proof-tree': 2,
        'set': 2,
        'diagonal': 2,
        'logical-negation': 2,
        'counterexample': 1,
        'cardinal': 1,
        'ordinal': 1,
        'frege': 1
      })
    },
    '2-7': {
      name: '希尔伯特计划',
      deck: deck({
        'hilbert': 3,
        'cantor': 2,
        'turing': 1,
        'model': 2,
        'mapping': 2,
        'formalization': 2,
        'logical-negation': 2,
        'reductio': 2,
        'citation': 2,
        'consistency': 1,
        'completeness': 1,
        'proof-tree': 2,
        'set': 2,
        'counterexample': 1
      })
    },
    '2-8': {
      name: '完备性',
      deck: deck({
        'russell-adv': 2,
        'turing': 2,
        'boole': 2,
        'dedekind': 2,
        'peano': 2,
        'cantor': 2,
        'hilbert': 2,
        'frege': 1,
        'tarski': 1,
        'zermelo': 1,
        'completeness': 2,
        'consistency': 1,
        'diagonal': 2,
        'logical-negation': 2,
        'model': 1
      })
    },
    '2-9': {
      name: '不完备',
      deck: deck({
        'godel': 2,
        'cantor': 2,
        'hilbert': 2,
        'turing': 2,
        'russell-adv': 2,
        'boole': 1,
        'dedekind': 1,
        'frege': 1,
        'zermelo': 1,
        'tarski': 1,
        'completeness': 2,
        'consistency': 2,
        'logical-negation': 2,
        'diagonal': 2,
        'formalization': 2
      })
    },
    '2-10': {
      name: '哥德尔·巨匠',
      deck: deck({
        'godel-master': 1,
        'godel': 1,
        'cantor-master': 1,
        'cantor': 2,
        'hilbert': 1,
        'turing': 1,
        'russell-adv': 1,
        'boole': 2,
        'dedekind': 1,
        'frege': 1,
        'zermelo': 1,
        'tarski': 1,
        'completeness': 1,
        'consistency': 1,
        'logical-negation': 1,
        'diagonal': 1,
        'withdraw': 1,
        'counterexample': 1,
        'russell': 1,
        'citation': 1,
        'reductio': 1,
        'consensus': 1,
        'formalization': 1
      })
    }
  };

  /* 主动特殊机制的首次教学关。测试会扫描 AI 牌组，禁止提前出现。 */
  const MECHANIC_INTRO_STAGE = {
    withdraw: 4,
    counterexample: 5,
    paradox: 6,
    clarify: 6,
    citation: 7,
    reductio: 8,
    consensus: 9,
    negate: 13,
    deduce: 14,
    diagonal: 15,
    axiomatize: 16
  };

  const STAGES = [
    {
      id: '1-1', index: 1, name: '第一课', subtitle: '出牌、三排与比分',
      lesson: '把牌打进它所属的排。三排分数相加，高者赢下小局。',
      tip: '先手不必急着 Pass：你打出的每一张牌都在给三排加分。',
      ai: '1-1', bossRule: null,
      reward: { fixed: ['pythagoras'], choice: [] }
    },
    {
      id: '1-2', index: 2, name: '芝诺的龟', subtitle: 'Pass 与卡差',
      lesson: '对手 Pass 后你仍可行动。追不上就及时让局，手牌就是下一局的筹码。',
      tip: '领先时对手 Pass，直接 Pass 即可拿下小局；落后太多则不必把牌打光。',
      ai: '1-2', bossRule: null,
      reward: { fixed: ['set'], choice: [] }
    },
    {
      id: '1-3', index: 3, name: '共证课堂', subtitle: '共证',
      lesson: '共证单位在同排每有一张其他友方单位就 +2，堆排比散打更划算。',
      tip: '比例论、三角形、圆锥曲线都有共证。',
      ai: '1-3', bossRule: null,
      reward: { fixed: ['withdraw'], choice: [] }
    },
    {
      id: '1-4', index: 4, name: '命题回收', subtitle: '撤回命题',
      lesson: '撤回命题把己方单位收回手牌：可以救回被针对的牌，也可以重新触发联动。',
      tip: '撤回不是净赚，收回的牌需要再花一次行动打出。',
      ai: '1-4', bossRule: null,
      reward: { fixed: ['counterexample'], choice: [] }
    },
    {
      id: '1-5', index: 5, name: '反例工坊', subtitle: '反例与抽牌',
      lesson: '反例会在对方战场留下 1 点单位，但你能立刻抽一张牌。',
      tip: '卡差比 1 点论证力更值钱，尤其是小局之间不自动抽牌。',
      ai: '1-5', bossRule: null,
      reward: { fixed: ['clarify'], choice: ['limit', 'infinity', 'descartes'] }
    },
    {
      id: '1-6', index: 6, name: '悖论走廊', subtitle: '悖论与公理澄清',
      lesson: '悖论同时削弱双方一整排。公理澄清可以解除它。',
      tip: '巨匠免疫悖论。把巨匠放在被诅咒的排里，是稳定的反制。',
      ai: '1-6', bossRule: null,
      reward: { fixed: ['citation'], choice: [] }
    },
    {
      id: '1-7', index: 7, name: '引证院', subtitle: '引证',
      lesson: '引证从弃牌堆复活一张单位。小局结束时被清场的单位，就是引证的素材。',
      tip: '第一局打出去的单位，第二局还能再回来一次。',
      ai: '1-7', bossRule: null,
      reward: { fixed: ['reductio'], choice: [] }
    },
    {
      id: '1-8', index: 8, name: '归谬法庭', subtitle: '反证法',
      lesson: '反证法摧毁对方论证力最高的非巨匠单位。',
      tip: '把巨匠留在场上，可以挡住对手的反证法。',
      ai: '1-8', bossRule: null,
      reward: { fixed: [], choice: ['gauss', 'noether', 'riemann'] }
    },
    {
      id: '1-9', index: 9, name: '综合辩场', subtitle: '联动与共识',
      lesson: '学派联动、共证、学术共识可以叠成一套完整的论证。',
      tip: '看清对手的牌组再决定这一局投入多少。',
      ai: '1-9', bossRule: null,
      reward: { fixed: ['consensus'], choice: [] }
    },
    {
      id: '1-10', index: 10, name: '罗素悖论', subtitle: 'Boss · 自指',
      lesson: 'Boss 自指：第 2、3 小局开始时，罗素悖论会自动影响随机一排。',
      tip: '留一张公理澄清，或者用巨匠顶住被诅咒的排。',
      ai: '1-10', bossRule: 'self-reference',
      reward: { fixed: ['euclid'], choice: [] }
    },
    {
      id: '2-1', index: 11, name: '命题大厅', subtitle: '逻辑基础',
      lesson: '逻辑与集合的第一课：命题、谓词、关系。它们不靠巨匠，而靠共证和连续出牌。',
      tip: '先用稳定的基础单位铺排，再把共证牌放进同一排。',
      ai: '2-1', bossRule: null,
      reward: { fixed: ['proposition'], choice: [] }
    },
    {
      id: '2-2', index: 12, name: '集合阶梯', subtitle: '集合与基数',
      lesson: '康托尔把无穷分成不同大小。集合、基数、序数是逻辑阵营的骨架。',
      tip: '逻辑牌组同样需要论证力，只是它更擅长用控制牌改变交换。',
      ai: '2-2', bossRule: null,
      reward: { fixed: ['cantor'], choice: [] }
    },
    {
      id: '2-3', index: 13, name: '否定之门', subtitle: '否定',
      lesson: '逻辑否定可以取消对方最近打出的一张策略牌。看清楚再否定，别浪费。',
      tip: '否定只对策略牌有效；对方刚打出单位时不要用。',
      ai: '2-3', bossRule: null,
      reward: { fixed: ['logical-negation'], choice: [] }
    },
    {
      id: '2-4', index: 14, name: '模型室', subtitle: '推论',
      lesson: '推论：如果上一张牌是逻辑单位，本牌 +4。顺序本身就是论证力。',
      tip: '先打逻辑单位，再接映射、模型或布尔。',
      ai: '2-4', bossRule: null,
      reward: { fixed: ['model'], choice: [] }
    },
    {
      id: '2-5', index: 15, name: '对角线', subtitle: '对角线法',
      lesson: '对方一排有至少 3 个单位时，对角线法会在己方对应排生成 3 点「自指命题」。',
      tip: '对手铺得越整齐，对角线法越赚。',
      ai: '2-5', bossRule: null,
      reward: { fixed: ['diagonal'], choice: [] }
    },
    {
      id: '2-6', index: 16, name: '公理系统', subtitle: '公理化',
      lesson: '形式化让一个普通单位本小局不受悖论影响。把关键单位从天气里保下来。',
      tip: '巨匠本来就免疫；形式化是给普通单位的局部保护。',
      ai: '2-6', bossRule: null,
      reward: { fixed: ['formalization'], choice: [] }
    },
    {
      id: '2-7', index: 17, name: '希尔伯特计划', subtitle: '控制与卡差',
      lesson: '希尔伯特想把所有数学形式化。这里开始，控制牌与卡差比单纯堆点更重要。',
      tip: '反证法、引证、否定、对角线可以交替使用。',
      ai: '2-7', bossRule: null,
      reward: { fixed: ['hilbert'], choice: [] }
    },
    {
      id: '2-8', index: 18, name: '完备性', subtitle: '综合逻辑',
      lesson: '完备性说：真命题都能被证明。但证明需要构筑，不是把强牌都塞进去。',
      tip: '三选一里有康托尔·巨匠，也有罗素与图灵。',
      ai: '2-8', bossRule: null,
      reward: { fixed: [], choice: ['cantor-master', 'russell-adv', 'turing'] }
    },
    {
      id: '2-9', index: 19, name: '不完备', subtitle: '哥德尔',
      lesson: '哥德尔证明：任何足够强的形式系统里，都存在无法在系统内证明的真命题。',
      tip: '这一关的 AI 已经会连续追分与控制；别把第一局打空。',
      ai: '2-9', bossRule: null,
      reward: { fixed: ['godel'], choice: [] }
    },
    {
      id: '2-10', index: 20, name: '不完备性定理', subtitle: 'Boss · 形式之塔',
      lesson: 'Boss 能力「不完备」：第 2、3 小局开始时，随机一排自动被不完备性危机笼罩（-3）。',
      tip: '公理澄清、形式化与巨匠都能对抗它。',
      ai: '2-10', bossRule: 'incompleteness',
      reward: { fixed: ['godel-master'], choice: [] }
    }
  ];

  /* 章节与关卡元数据 */
  STAGES.forEach(function (stage) {
    stage.chapter = Number(stage.id.split('-')[0]);
    const isBoss = stage.id === '1-10' || stage.id === '2-10';
    stage.boss = isBoss;
    stage.goldFirst = stage.chapter === 1
      ? (isBoss ? 100 : 40)
      : (isBoss ? 150 : 60);
    stage.goldRepeat = isBoss ? 30 : 15;
  });

  const CHAPTERS = [
    { id: 1, name: '悖论裂缝', subtitle: '第一章 · 几何学派', stages: STAGES.filter(function (s) { return s.chapter === 1; }).map(function (s) { return s.id; }) },
    { id: 2, name: '形式之塔', subtitle: '第二章 · 逻辑与集合', stages: STAGES.filter(function (s) { return s.chapter === 2; }).map(function (s) { return s.id; }) }
  ];

  const AI_PROFILES = {
    '1-1': { aggression: 0.3, conserve: 0.45, bluff: 0.05, comboBias: 0.4, controlBias: 0.1 },
    '1-2': { aggression: 0.25, conserve: 0.85, bluff: 0.1, comboBias: 0.4, controlBias: 0.2 },
    '1-3': { aggression: 0.45, conserve: 0.5, bluff: 0.1, comboBias: 0.9, controlBias: 0.2 },
    '1-4': { aggression: 0.4, conserve: 0.7, bluff: 0.15, comboBias: 0.6, controlBias: 0.4 },
    '1-5': { aggression: 0.5, conserve: 0.55, bluff: 0.2, comboBias: 0.6, controlBias: 0.6 },
    '1-6': { aggression: 0.5, conserve: 0.65, bluff: 0.15, comboBias: 0.5, controlBias: 0.8 },
    '1-7': { aggression: 0.45, conserve: 0.6, bluff: 0.2, comboBias: 0.7, controlBias: 0.5 },
    '1-8': { aggression: 0.7, conserve: 0.5, bluff: 0.15, comboBias: 0.7, controlBias: 0.9 },
    '1-9': { aggression: 0.6, conserve: 0.65, bluff: 0.25, comboBias: 0.9, controlBias: 0.6 },
    '1-10': { aggression: 0.6, conserve: 0.7, bluff: 0.2, comboBias: 0.8, controlBias: 0.9 },
    '2-1': { aggression: 0.35, conserve: 0.5, bluff: 0.1, comboBias: 0.5, controlBias: 0.2 },
    '2-2': { aggression: 0.45, conserve: 0.55, bluff: 0.1, comboBias: 0.8, controlBias: 0.3 },
    '2-3': { aggression: 0.5, conserve: 0.55, bluff: 0.2, comboBias: 0.6, controlBias: 0.7 },
    '2-4': { aggression: 0.5, conserve: 0.6, bluff: 0.15, comboBias: 0.9, controlBias: 0.4 },
    '2-5': { aggression: 0.55, conserve: 0.6, bluff: 0.2, comboBias: 0.8, controlBias: 0.7 },
    '2-6': { aggression: 0.55, conserve: 0.65, bluff: 0.2, comboBias: 0.7, controlBias: 0.8 },
    '2-7': { aggression: 0.6, conserve: 0.7, bluff: 0.25, comboBias: 0.7, controlBias: 0.9 },
    '2-8': { aggression: 0.65, conserve: 0.7, bluff: 0.3, comboBias: 0.9, controlBias: 0.8 },
    '2-9': { aggression: 0.75, conserve: 0.75, bluff: 0.3, comboBias: 0.9, controlBias: 0.9 },
    '2-10': { aggression: 0.7, conserve: 0.8, bluff: 0.35, comboBias: 0.9, controlBias: 1.0 }
  };

  const STAGE_MAP = {};
  STAGES.forEach(function (s) { STAGE_MAP[s.id] = s; });

  /* 商店价格与卡牌来源 */
  const SHOP_TIERS = {
    basic: 35,
    advanced: 60,
    special: 80,
    master: 0
  };

  CARDS.forEach(function (card) {
    card.chapter = 1;
    if (card.type === 'paradox') card.shopTier = 'master';
    else if (card.ability === 'master') card.shopTier = 'master';
    else if (card.type === 'special') card.shopTier = 'special';
    else if ((card.power || 0) >= 7) card.shopTier = 'advanced';
    else card.shopTier = 'basic';
    card.shop = card.collectible && card.shopTier !== 'master';
    card.price = card.price != null ? card.price : SHOP_TIERS[card.shopTier];
    card.shopUnlockIndex = 0;
    card.sources = [];
  });

  function addSource(card, source) {
    const exists = card.sources.some(function (s) {
      return s.type === source.type && s.stage === source.stage && s.faction === source.faction;
    });
    if (!exists) card.sources.push(source);
  }

  ['geometry', 'logic'].forEach(function (faction) {
    (FACTION_STARTER_DECKS[faction] || []).forEach(function (id) {
      addSource(CARD_MAP[id], { type: 'starter', faction: faction });
    });
  });

  STAGES.forEach(function (stage) {
    const reward = stage.reward || {};
    (reward.fixed || []).concat(reward.choice || []).forEach(function (id) {
      addSource(CARD_MAP[id], {
        type: stage.boss ? 'boss' : 'stage',
        stage: stage.id,
        chapter: stage.chapter
      });
    });
  });

  ['russell', 'zeno', 'incompleteness', 'liar'].forEach(function (id) {
    addSource(CARD_MAP[id], { type: 'boss', stage: '1-10', chapter: 1 });
  });

  const PHASE2_IDS = CARDS.filter(function (card) {
    return (card.faction === 'logic' && card.type !== 'paradox') ||
      ['extended-counterexample', 'logical-negation', 'diagonal', 'formalization', 'consistency', 'completeness'].indexOf(card.id) !== -1;
  }).map(function (card) { return card.id; });
  PHASE2_IDS.forEach(function (id) { CARD_MAP[id].chapter = 2; });

  /* 首通奖励在对应关卡通关后才进入商店；巨匠与悖论仍不进入普通池。 */
  CARDS.forEach(function (card) {
    card.sources.forEach(function (src) {
      if (src.type === 'stage' || src.type === 'boss') {
        const stage = STAGE_MAP[src.stage];
        if (stage) card.shopUnlockIndex = Math.max(card.shopUnlockIndex, stage.index);
      }
    });
    if (card.ability === 'master' || card.type === 'paradox') card.shop = false;
  });

  /* 第二章商店进度：机制在教学关之后才进入普通池。 */
  const SHOP_UNLOCK = {
    'proposition': 11, 'predicate': 11, 'relation': 11, 'formal-language': 11,
    'proof-tree': 11, 'cardinal': 11, 'ordinal': 11,
    'cantor': 12,
    'logical-negation': 13, 'extended-counterexample': 13,
    'mapping': 14, 'model': 14,
    'diagonal': 15,
    'formalization': 16, 'consistency': 16, 'frege': 16, 'peano': 16,
    'hilbert': 17, 'boole': 17, 'dedekind': 17, 'zermelo': 17, 'tarski': 17,
    'turing': 18, 'russell-adv': 18, 'completeness': 18,
    'godel': 19
  };
  Object.keys(SHOP_UNLOCK).forEach(function (id) {
    if (CARD_MAP[id]) CARD_MAP[id].shopUnlockIndex = Math.max(CARD_MAP[id].shopUnlockIndex, SHOP_UNLOCK[id]);
  });

  CARDS.forEach(function (card) {
    if (card.shop) addSource(card, { type: 'shop' });
  });

  return {
    VERSION: VERSION,
    ROWS: ROWS,
    ROW_LABELS: ROW_LABELS,
    ROW_SHORT: ROW_SHORT,
    FACTIONS: FACTIONS,
    CARDS: CARDS,
    CARD_MAP: CARD_MAP,
    TOKENS: TOKENS,
    getCard: getCard,
    maxCopies: maxCopies,
    STARTER_DECK: STARTER_DECK,
    STARTER_COUNTS: STARTER_COUNTS,
    LOGIC_STARTER_DECK: LOGIC_STARTER_DECK,
    LOGIC_STARTER_ENTRIES: LOGIC_STARTER_ENTRIES,
    FACTION_STARTER_DECKS: FACTION_STARTER_DECKS,
    FACTION_STARTER_COUNTS: FACTION_STARTER_COUNTS,
    AI_DECKS: AI_DECKS,
    AI_PROFILES: AI_PROFILES,
    STAGES: STAGES,
    STAGE_MAP: STAGE_MAP,
    CHAPTERS: CHAPTERS,
    SHOP_TIERS: SHOP_TIERS,
    MECHANIC_INTRO_STAGE: MECHANIC_INTRO_STAGE
  };
});
