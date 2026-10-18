# 《真理学院》V2：数学主题昆特牌核心版

- 状态：第一阶段规则冻结
- 分支：`gwent-v2-core`
- 存档：`truth_academy_save_v2`（旧版 `truth_academy_save_v1` 不读取、不删除）
- 旧版设计：[design-spec.md](design-spec.md)

## 1. 范围

第一阶段只做一件事：让「领初始牌组 → 打 1-1 → 重抽 → 三局两胜式博弈 → 拿新卡 → 换进牌组 → 打下一关」这条闭环完整可玩。

明确不做：商店、金币、卡包、抽卡、碎片、制作、等级、突破、稀有度、每日任务、研究树、多套牌、四大学派全开、PvP、排行榜、剧情演出、批量卡面插画。

## 2. 对局规则

- 双方各 2 枚真理印记。
- 每小局双方轮流行动，每次只能打出一张牌或 Pass。
- Pass 后本小局不能再行动；对手 Pass 后，未 Pass 的一方可以连续行动。
- 双方都 Pass 后比较论证力：低者失去 1 枚印记；平局双方各失去 1 枚。
- 任意一方印记归零即结束；同时归零为平局。
- 最多 3 小局。小局之间不自动抽牌，手牌与牌库保留，卡差是核心资源。
- 上一小局的胜者获得下一小局先手；平局时先手轮换。

## 3. 牌组与开局

- 牌组固定 25 张，编辑器最多 25 张。
- 开局随机抽 10 张，牌库剩 15 张。
- 开局可重抽最多 2 张，每方一次。
- 同名卡上限：普通 3 张，巨匠 1 张。
- 卡组编辑器允许临时少于 25 张，但不足 25 张不能开课。

## 4. 三排

双方各有 `axiom`（公理域）、`reasoning`（推演域）、`theorem`（定理域）三排。单位牌固定进入其中一排，第一阶段不支持多排选择。

## 5. 卡牌与机制

共 30 种卡：20 单位（14 普通 / 4 高级 / 2 巨匠）、6 策略、4 悖论。第一阶段进入玩家收藏的是 26 种；4 张悖论牌为敌方专属。

| 机制 | 实现 |
|---|---|
| 巨匠 `master` | 不受悖论、反证法、撤回命题等效果影响 |
| 学派联动 `bond` | 与另一张同组牌同时存在时，论证力翻倍 |
| 共证 `corroborate` | 同排每有一张其他友方单位，+2 论证力 |
| 反例 `counterexample` | 在对方一排生成 1 点「反例」，自己抽 1 张 |
| 引证 `citation` | 从弃牌堆选一张单位，直接放回其所在排 |
| 学术共识 `consensus` | 己方所有单位 +2 论证力，持续到本小局结束 |
| 反证法 `reductio` | 摧毁对方论证力最高的非巨匠单位 |
| 撤回命题 `withdraw` | 将己方一张单位收回手牌 |
| 悖论 `paradox` | 对某一排双方单位施加持续整局的排效果 |
| 公理澄清 `clarify` | 解除一排的悖论效果 |

排效果在单位自身能力结算后施加，最低为 1；巨匠免疫排效果。

## 6. 数据结构

`data.js` 导出：`FACTIONS`、`CARDS`、`CARD_MAP`、`TOKENS`、`STARTER_DECK`、`STARTER_COUNTS`、`AI_DECKS`、`STAGES`、`STAGE_MAP`。关卡奖励直接挂在 `STAGES[i].reward`。

单位牌：

```js
{
  id: "pythagoras",
  name: "毕达哥拉斯",
  faction: "geometry",
  type: "unit",
  row: "reasoning",
  power: 6,
  ability: "bond",
  bondId: "pythagorean",
  maxCopies: 3,
  text: "学派联动：与另一张同组牌同时存在时，论证力翻倍。"
}
```

## 7. 引擎接口

`battle.js` 为纯逻辑，不依赖 DOM，可被 Node 直接 require。

```text
createMatch({ playerDeck, aiDeck, seed, stageId, bossRule })
mulligan(state, side, indices)
beginPlay(state)
playCard(state, side, handIndex, opts)
pass(state, side)
resolveRound(state)
startNextRound(state)
calculateRowScore(state, side, row)
calculateTotalScore(state, side)
checkRoundEnd(state)
checkMatchEnd(state)
```

状态：`round`、`current`、`phase`、双方 `seals/deck/hand/discard/passed/board/aura`、`effects`、`lastRound`、`result`、`log`。随机数用可序列化的 `rngState`，保证测试可复现。

## 8. AI

`ai.js` 三层：合法行动枚举 → 即时收益评分（论证力、联动、抽牌、控制）→ Pass 判断（比分差、剩余手牌、追分成本、印记数量）。

- 对手已 Pass 且自己领先：立即 Pass。
- 落后且需要 3 张以上才能追、自己还有 2 枚印记：主动让局。
- 第 1 小局打满 4 张后收手，避免把整手牌倒在第一局。
- 赢下第 1 小局后，第 2 小局可干 Pass，保留手牌打决胜局。

## 9. 关卡与奖励

10 关，难度来自 AI 牌组成熟度，不来自数值等级。

| 关卡 | 教学 | AI 牌组 | 首通奖励 |
|---|---|---|---|
| 1-1 | 出牌、三排、比分 | 学徒欧几里得 | 毕达哥拉斯 |
| 1-2 | Pass 与卡差 | 芝诺 | 勾股定理 |
| 1-3 | 共证 | 共证讲师 | 集合 |
| 1-4 | 撤回命题 | 命题回收员 | 笛卡尔 |
| 1-5 | 反例 | 反例工坊主 | 三选一：引证 / 无穷 / 极限 |
| 1-6 | 悖论与公理澄清 | 悖论看守 | 反证法 |
| 1-7 | 引证 | 引证学士 | 黎曼 |
| 1-8 | 反证法 | 归谬法官 | 三选一：高斯 / 诺特 / 毕达哥拉斯 |
| 1-9 | 综合 | 综合辩手 | 学术共识 |
| 1-10 | Boss | 自指者 | 欧几里得·巨匠 |

三选一奖励可重复挑战：未选走的牌不会消失，仍会出现在下一次通关的选项中。

Boss 特殊规则「自指」：第 2、3 小局开始时，随机一排自动施加罗素悖论（论证力减半）。

## 10. 养成与存档

V2 档案只有：`collection`、`deck`、`clearedStages`、`claimedRewards`、`discoveredCards`、`settings`。

存档键 `truth_academy_save_v2`，刷新后收藏、牌组、通关进度全部保留。旧 RPG 存档不迁移。

## 11. UI

只重做三页：主页（课程 / 卡组 / 图鉴）、卡组编辑、战斗。战斗布局优先「一眼看懂」：上方 AI 手牌与印记、三排与分数、总计、下方玩家三排、手牌与 Pass。特殊牌需要选排 / 选单位 / 选弃牌时弹出目标选择层。

## 12. 测试

`engine.test.js` 共 32 条，覆盖：开局 10 张、重抽上限、返库、合法/非法出牌、回合切换、Pass、双方 Pass 结算、失去印记、平局、清场、弃牌、巨匠免疫、反例、引证、共证、悖论、公理澄清、反证法、撤回命题、比赛结束、牌组/奖励/存档、AI 让局。

`sim.js` 跑 AI vs AI 全章，检查死循环与胜率。`browser.js` 用真实 Chrome 走完 1-1 的完整 UI 闭环并刷新验证存档。

## 13. 第一阶段验收

1. 不依赖 HP / AP 完成对局。
2. Pass 的取舍可被玩家理解。
3. AI 会主动让局，不会无脑打光手牌。
4. 至少 3 种构筑思路（几何联动、分析联动、逻辑共证）。
5. 1-1～1-10 可通关。
6. 新卡可立即加入牌组。
7. 刷新后收藏、牌组、进度保留。
8. 连续玩几局仍有「这一局要不要继续投入」的决策感。
