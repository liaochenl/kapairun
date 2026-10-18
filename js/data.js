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
    logic: { id: 'logic', name: '逻辑学派', mark: '⊢', color: '#e0a86b' },
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

  function special(id, name, ability, text) {
    return {
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
      text: text
    };
  }

  function paradox(id, name, effect, text) {
    return {
      id: id,
      name: name,
      faction: 'logic',
      type: 'paradox',
      row: null,
      power: 0,
      ability: 'paradox',
      effect: effect,
      bondId: null,
      maxCopies: 3,
      collectible: true,
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
    unit('conic', '圆锥曲线', 'geometry', 'theorem', 5, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('limit', '极限', 'analysis', 'theorem', 6, 'bond', {
      bondId: 'infinite',
      text: '学派联动·无穷：与另一张同组牌同时存在时，论证力翻倍。'
    }),
    unit('set', '集合', 'logic', 'reasoning', 4, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),
    unit('infinity', '无穷', 'analysis', 'theorem', 6, 'bond', {
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
    unit('riemann', '黎曼', 'analysis', 'theorem', 8, 'bond', {
      bondId: 'infinite',
      text: '学派联动·无穷：与另一张同组牌同时存在时，论证力翻倍。'
    }),
    unit('noether', '诺特', 'logic', 'theorem', 7, 'corroborate', {
      text: '共证：同排每有一张其他友方单位，+2 论证力。'
    }),

    /* ---- 巨匠 ×2 ---- */
    unit('euclid', '欧几里得·巨匠', 'geometry', 'axiom', 10, 'master', {
      text: '巨匠：不受悖论、反证法与撤回命题影响。'
    }),
    unit('gauss', '高斯·巨匠', 'analysis', 'theorem', 10, 'master', {
      text: '巨匠：不受悖论、反证法与撤回命题影响。'
    }),

    /* ---- 策略 ×6 ---- */
    special('counterexample', '反例', 'counterexample',
      '在对方任一排生成一张 1 点「反例」，然后抽 1 张牌。'),
    special('citation', '引证', 'citation',
      '选择弃牌堆中一张单位牌，直接放回它所在的排。'),
    special('consensus', '学术共识', 'consensus',
      '己方场上所有单位 +2 论证力，持续到本小局结束。'),
    special('withdraw', '撤回命题', 'withdraw',
      '将己方一张单位收回手牌。'),
    special('reductio', '反证法', 'reductio',
      '摧毁对方论证力最高的非巨匠单位。'),
    special('clarify', '公理澄清', 'clarify',
      '解除一排的悖论效果。'),

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
    'proportion': 2,
    'triangle': 2,
    'parallel': 2,
    'geometric-proof': 2,
    'pythagoras-disciple': 2,
    'pythagorean-theorem': 1,
    'number-line': 2,
    'coordinate': 1,
    'conic': 1,
    'counterexample': 2,
    'withdraw': 1,
    'clarify': 1
  };

  const STARTER_DECK = deck(STARTER_ENTRIES);

  const STARTER_COUNTS = {};
  Object.keys(STARTER_ENTRIES).forEach(function (id) {
    STARTER_COUNTS[id] = STARTER_ENTRIES[id];
  });

  const AI_DECKS = {
    '1-1': {
      name: '学徒欧几里得',
      deck: deck({
        'euclid-apprentice': 3,
        'ruler-compass': 3,
        'proportion': 2,
        'triangle': 3,
        'number-line': 3,
        'coordinate': 3,
        'geometric-proof': 2,
        'conic': 2,
        'withdraw': 2,
        'clarify': 2
      })
    },
    '1-2': {
      name: '芝诺',
      deck: deck({
        'ruler-compass': 3,
        'proportion': 3,
        'triangle': 3,
        'number-line': 2,
        'coordinate': 2,
        'parallel': 2,
        'conic': 2,
        'geometric-proof': 2,
        'zeno': 2,
        'counterexample': 2,
        'euclid-apprentice': 2
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
        'geometric-proof': 2,
        'parallel': 2,
        'euclid-apprentice': 2
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
        'citation': 2
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
        'proportion': 2,
        'consensus': 1,
        'clarify': 1,
        'reductio': 2,
        'russell': 1,
        'zeno': 1,
        'incompleteness': 1,
        'liar': 1,
        'number-line': 2
      })
    }
  };

  const STAGES = [
    {
      id: '1-1', index: 1, name: '第一课', subtitle: '出牌、三排与比分',
      lesson: '把牌打进它所属的排。三排分数相加，高者赢下小局。',
      tip: '先手不必急着 Pass：你打出的每一张牌都在给三排加分。',
      ai: '1-1', bossRule: null,
      reward: { type: 'fixed', cards: ['pythagoras'] }
    },
    {
      id: '1-2', index: 2, name: '芝诺的龟', subtitle: 'Pass 与卡差',
      lesson: '对手 Pass 后你仍可行动。追不上就及时让局，手牌就是下一局的筹码。',
      tip: '领先时对手 Pass，直接 Pass 即可拿下小局；落后太多则不必把牌打光。',
      ai: '1-2', bossRule: null,
      reward: { type: 'fixed', cards: ['pythagorean-theorem'] }
    },
    {
      id: '1-3', index: 3, name: '共证课堂', subtitle: '共证',
      lesson: '共证单位在同排每有一张其他友方单位就 +2，堆排比散打更划算。',
      tip: '比例论、三角形、圆锥曲线都有共证。',
      ai: '1-3', bossRule: null,
      reward: { type: 'fixed', cards: ['set'] }
    },
    {
      id: '1-4', index: 4, name: '命题回收', subtitle: '撤回命题',
      lesson: '撤回命题把己方单位收回手牌：可以救回被针对的牌，也可以重新触发联动。',
      tip: '撤回不是净赚，收回的牌需要再花一次行动打出。',
      ai: '1-4', bossRule: null,
      reward: { type: 'fixed', cards: ['descartes'] }
    },
    {
      id: '1-5', index: 5, name: '反例工坊', subtitle: '反例与抽牌',
      lesson: '反例会在对方战场留下 1 点单位，但你能立刻抽一张牌。',
      tip: '卡差比 1 点论证力更值钱，尤其是小局之间不自动抽牌。',
      ai: '1-5', bossRule: null,
      reward: { type: 'choice', cards: ['citation', 'infinity', 'limit'] }
    },
    {
      id: '1-6', index: 6, name: '悖论走廊', subtitle: '悖论与公理澄清',
      lesson: '悖论同时削弱双方一整排。公理澄清可以解除它。',
      tip: '巨匠免疫悖论。把巨匠放在被诅咒的排里，是稳定的反制。',
      ai: '1-6', bossRule: null,
      reward: { type: 'fixed', cards: ['reductio'] }
    },
    {
      id: '1-7', index: 7, name: '引证院', subtitle: '引证',
      lesson: '引证从弃牌堆复活一张单位。小局结束时被清场的单位，就是引证的素材。',
      tip: '第一局打出去的单位，第二局还能再回来一次。',
      ai: '1-7', bossRule: null,
      reward: { type: 'fixed', cards: ['riemann'] }
    },
    {
      id: '1-8', index: 8, name: '归谬法庭', subtitle: '反证法',
      lesson: '反证法摧毁对方论证力最高的非巨匠单位。',
      tip: '把巨匠留在场上，可以挡住对手的反证法。',
      ai: '1-8', bossRule: null,
      reward: { type: 'choice', cards: ['gauss', 'noether', 'pythagoras'] }
    },
    {
      id: '1-9', index: 9, name: '综合辩场', subtitle: '联动与共识',
      lesson: '学派联动、共证、学术共识可以叠成一套完整的论证。',
      tip: '看清对手的牌组再决定这一局投入多少。',
      ai: '1-9', bossRule: null,
      reward: { type: 'fixed', cards: ['consensus'] }
    },
    {
      id: '1-10', index: 10, name: '罗素悖论', subtitle: 'Boss · 自指',
      lesson: 'Boss 自指：第 2、3 小局开始时，罗素悖论会自动影响随机一排。',
      tip: '留一张公理澄清，或者用巨匠顶住被诅咒的排。',
      ai: '1-10', bossRule: 'self-reference',
      reward: { type: 'fixed', cards: ['euclid'] }
    }
  ];

  const STAGE_MAP = {};
  STAGES.forEach(function (s) { STAGE_MAP[s.id] = s; });

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
    AI_DECKS: AI_DECKS,
    STAGES: STAGES,
    STAGE_MAP: STAGE_MAP
  };
});
