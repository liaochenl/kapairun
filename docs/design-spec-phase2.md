# 《真理学院》第二阶段：形式之塔

- 基础分支：`gwent-v2-core`
- 存档：`truth_academy_save_v2`（第一阶段 V2 自动迁移，不清档）
- 目标：把「昆特牌核心 Demo」升级为有两个阵营、两章、商店、金币、三套牌、三态图鉴的完整单机原型。

## 1. 范围

实现：金币、学术商店、收藏三态、多牌组、阵营限制、逻辑与集合、第二章 2-1～2-10、卡池 59、AI 性格、卡牌详情与卡框、旧 V2 迁移。

不做：PvP、联网、排行榜、每日任务、付费、抽卡、等级、突破、装备、碎片、Battle Pass、活动、第三/第四学派、无限关卡、Roguelike。

## 2. 金币与关卡奖励

唯一新货币 `gold`，初始 150。

| 类型 | 首通 | 重复 |
|---|---:|---:|
| 第一章普通关 | 40 | 15 |
| 第一章 Boss | 100 | 30 |
| 第二章普通关 | 60 | 15 |
| 第二章 Boss | 150 | 30 |

首通卡牌奖励与金币同时发放；`completeStage()` 负责金币、通关、1-10 的逻辑解锁。

## 3. 商店

`js/shop.js` 只负责数据与规则，不碰 DOM。

```text
createShop(profile, seed)
ensureShop(profile)
refreshShop(profile, { free, seed })
buyShopCard(profile, slotIndex)
buildShopPool(profile)
getShopPrice(cardId)
```

- 6 槽位，每槽 `{ cardId, price, sold }`，写入 `profile.shop`。
- 通关获得 1 次免费刷新（`freeRefreshes`，上限 3），不自动改变库存；无免费次数时刷新 20 金币。
- 同 seed 可复现；刷新后存档，重载不重随机。
- 商店池：`collectible && shop && 未达上限 && 章节已解锁 && 通关进度 >= shopUnlockIndex`。
- 首通奖励在对应关卡通关后才进入商店；巨匠、悖论不进入随机池。
- 价格：basic 35 / advanced 60 / special 80；`price` 可覆盖。
- 购买：扣金币、`collection +1`、`discoveredCards`、`sold = true`。
- 池不足 6 时留空槽，不复制已满卡。
- 逻辑牌在 `unlockedFactions.logic` 前不会出现。

## 4. 档案与迁移

```js
{
  version: 2,
  gold: 150,
  collection: {},
  discoveredCards: [],
  decks: [{ id, name, faction, cards }],
  activeDeckId,
  clearedStages: {},
  claimedRewards: {},
  unlockedFactions: { geometry: true, logic: false },
  unlockedChapters: { 1: true, 2: false },
  shop: { inventory: [], seed: 0, refreshCount: 0, freeRefreshes: 0 },
  settings: { sound: true, animations: true }
}
```

旧第一阶段 V2：

```text
profile.deck -> decks[0].cards
collection / clearedStages / claimedRewards / discoveredCards 保留
gold = 150
其他新字段默认值
```

`ensureProfile()` 负责迁移、清理无效卡、修复 activeDeckId、补默认商店。

## 5. 多牌组与阵营

- 最多 3 套玩家牌组；逻辑未解锁时上限 2，1-10 赠送的逻辑套牌标记 `system`，不受普通上限影响。
- 主阵营 `geometry` / `logic`，只能加入对应阵营 + `neutral`。
- `canUseInDeck()` 统一判断；`validateDeck()` 返回逐条错误。
- 每套牌 25 张，同名普通 3 / 巨匠 1。
- 通关 1-10：`unlockedFactions.logic = true`、`unlockedChapters[2] = true`，赠送 25 张逻辑初始牌组，并保证收藏数量足够。

## 6. 收藏三态与来源

- 已拥有：`collection > 0`。
- 已发现：`discoveredCards` 包含，但未拥有。
- 未发现：`???`、卡背，不暴露名称/效果。

发现时机：获得卡、敌方出牌、Boss 特殊牌、商店第一次出现、通关奖励。

卡牌新增 `sources`：

```js
sources: [
  { type: 'starter', faction: 'logic' },
  { type: 'stage', stage: '2-3', chapter: 2 },
  { type: 'boss', stage: '2-10', chapter: 2 },
  { type: 'shop' }
]
```

图鉴与卡牌详情统一由 `sourceLabel()` 显示。

## 7. 卡池

59 张可收集卡：

- 第一阶段 30 张（几何 + 中立 + 悖论）。
- 第二阶段 29 张：逻辑基础单位、数学家、两张巨匠、6 张策略。
- 原 `limit / infinity / riemann / gauss / set / noether` 改为 `neutral`，不形成第三正式阵营。
- 每张卡有 `chapter`、`shopTier`、`shop`、`price`、`sources`。
- 所有 collectible 至少一个真实来源，有测试。

## 8. 新机制

- `negate`：只否定对方上一动作中 `negatable` 且带 `undo` 的策略；`lastAction` 记录完整 undo，否定后下一动作覆盖。
- `diagonal`：对方一排 ≥3 单位时，己方对应排生成 3 点自指命题。
- `deduce`：若上一张牌是逻辑单位，本牌 +4；`deduced` 在打出时固化。
- `axiomatize`：普通单位 `axiomized = true`，本小局不受排效果；巨匠本来就免疫。

`battle.js` 仍为纯逻辑、可序列化；`lastAction` / `lastPlayed` / `deduced` / `axiomized` 都是普通对象字段。

## 9. AI 性格

每关 `AI_PROFILES`：

```js
{ aggression, conserve, bluff, comboBias, controlBias }
```

- aggression / conserve 调整第一局预算与干 Pass。
- comboBias 高时优先打连续模拟路线的第一张。
- controlBias 高时优先否定 / 反证 / 对角线 / 公理化。
- 不同关卡不再共享同一套节奏。

## 10. 第二章

2-1 命题大厅 → 2-2 集合阶梯 → 2-3 否定之门 → 2-4 模型室 → 2-5 对角线 → 2-6 公理系统 → 2-7 希尔伯特计划 → 2-8 完备性 → 2-9 不完备 → 2-10 不完备性定理。

BOSS `incompleteness`：第 2、3 小局开始时随机一排 -3。

首通奖励见 README。三选一可重复挑战领完。

## 11. UI

- 主页：课程 / 卡组 / 图鉴 / 商店 + 金币。
- 课程：两章分组，显示金币与奖励。
- 卡组：3 个标签页、主阵营、25 张校验、新建 / 重命名 / 删除。
- 图鉴：三态、来源、卡牌详情。
- 商店：6 槽、购买、刷新、已售出 / 已满 / 金币不足。
- 战斗：新机制目标选择、`deduced` / `axiomized` 视觉、金币结算。
- 试玩记录保持独立。

## 12. 测试

- `engine.test.js`：45 条基础规则。
- `playtest.test.js`：6 条试玩记录。
- `phase2.test.js`：39 条迁移、金币、多牌组、阵营、商店、逻辑机制、第二章。
- `sim.js`：几何 / 逻辑 × 第一章 / 第二章，输出 R1 投入、Pass、剩余手牌、分差。
- `browser.js`：1-1、商店购买/刷新、多牌组、1-10 解锁、逻辑牌组、2-1、刷新读档。

合计 90 条自动化测试。

## 13. 验收

- 第一阶段战斗规则不退化。
- 可以赚金币、买牌、刷新、看到库存变化。
- 图鉴三态正确。
- 3 套牌与阵营限制正确。
- 几何与逻辑玩起来不同。
- 2-1～2-10 可通关。
- 所有 collectible 有来源。
- 旧 V2 存档不丢收藏 / 通关 / 牌组。
- 第二章 AI 会 Pass、让局、追分。
- 桌面浏览器完整可用。

## 14. 封版修复（第二阶段收尾）

- **逻辑否定**：`lastAction` 只记录对手上一动作；只有 `negatable` 且带 `undo` 的策略才可否定。抽牌类（反例、反例扩展、完备性）、引证、逻辑否定本身不可否定。undo 记录完整包含 side / row / uid / 原单位或原排效果，不再猜测 token 在哪一侧。
- **商店刷新**：通关不再自动换库存；每次通关获得 1 次免费刷新（上限 3）。玩家主动使用免费次数，否则支付 20 金币。
- **牌组槽位**：逻辑未解锁时最多 2 套；解锁后 3 套。1-10 赠送的逻辑套牌标记 `system: true`，不受普通上限限制，历史 3 套几何档也能拿到合法逻辑牌组。
- **旧档迁移**：四张经典悖论改为 `neutral`；旧 V2 `deck` 迁移后调用 `repairDeck()`，优先用当前阵营合法卡补足 25 张，不足则 `needsRepair = true` 并在 UI 提示。
- **AI 抽牌价值**：删除反例/引证/共识硬编码，统一用「牌库减少量 × 4」计算抽牌价值；Beam Search 深度允许超过初始手牌数，能模拟抽牌后的后续行动。
- **商店进度**：卡牌新增 `shopUnlockIndex`；商店池按最高通关关卡过滤。1-10 后不会出现 2-8 后期卡；2-3 后逻辑否定进入池，2-5 后对角线进入池。巨匠与悖论仍不进入普通池。

## 15. 最终 UI 与系统收口

- 系统逻辑牌组带 `system: true`，不计入 `playerDeckCount`；自建牌组上限仍是 2（逻辑前）/ 3（逻辑后），系统牌组不占槽位。
- 系统牌组禁止删除，UI 删除按钮 disabled，并显示「系统」Badge；允许切换、编辑、重命名。
- 逻辑否定文字与 2-3 教学改为「上一动作 / 可否定」；可否定策略在卡牌与详情中显示 `◈ 可否定`。
- `repairDeck()` 对同一候选卡循环补多张，收藏足够时可一次补到 25；仍不足才标记 `needsRepair`。
- 视觉收口：深绿黑板中心光、旧金边、阵营色左缘与 Badge、手牌卡框、战场排符号、Pass/印记/总分强化、悖论弱 pulse、商店售出印章、卡组构成条、页面英文小标题。
- 移动端保持手牌横向滚动、商店单列、Modal 不超屏；关闭动态效果时也关闭悖论 pulse。
