# U惠记录 · 微信小程序

[![CI](https://github.com/zheng614/uhui-record/actions/workflows/ci.yml/badge.svg)](https://github.com/zheng614/uhui-record/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

个人账单记账工具，**纯前端**，所有数据保存在小程序本地 Storage，不需要后端服务。

---

## 一、功能清单

| # | 需求 | 实现位置 |
|---|------|----------|
| 1 | 新增账单表单：日期（默认今天，可改）、总价、**优惠方式（满减 / 折扣）**、实付、分类（面板选择）、备注；**总价 / 优惠 / 实付任意填两项自动算第三项** | `pages/edit/edit.*` |
| 2 | 账单列表：**分类徽章在前（醒目大字）、备注在后（小一号）**；总价黑色最大字号，优惠大红加粗，实付与总价同色略小，依次跟在总价后方 | `pages/index/index.*`、`app.wxss` |
| 3 | 分类统计：按分类分组，组内自动合计（总价/优惠/实付）；页面顶部展示当前范围全部账单合计 | `pages/stats/stats.*` |
| 4 | 分类管理（在「记一笔」里）：新增、删除任意分类、**拖动 ⠿ 手柄排序** | `pages/edit/edit.*`（分类面板）、`utils/store.js` |
| 5 | 账单操作：编辑、删除（删除有确认弹窗） | `pages/edit`、`pages/index`、`pages/day` |
| 6 | 时间筛选：全部 / 本月 / 上月 / 自定义起止日期，统计数据联动 | `components/filter-bar`、`utils/filter.js` |
| 7 | 数据功能：导出 CSV（含优惠方式列）、一键清空全部账单（二次确认） | `utils/csv.js`、`pages/index/index.js` |
| 8 | UI：简洁清爽，合计数字加粗，分类合计行浅灰底色 | `app.wxss` 及各页 wxss |
| 9 | **我的**：每日签到（+1 积分，连续 7 天送 1 天会员）、日历（每天显示当天优惠金额，点日期进当日账单） | `pages/mine/mine.*`、`utils/checkin.js` |
| 10 | **主题色**：内置 6 套配色，选中后整站换色（含 tabBar 选中色） | `utils/theme.js`、`app.wxss` |
| 11 | **数据升级不丢**：Storage Key 固定不改名，新版本启动时只补字段不删数据 | `utils/store.js`（`normalizeBill` / `initStorage`） |
| 12 | 结构规范、注释清晰、可直接在开发者工具运行 | 见下 |

---

## 二、目录结构

```
uhui-record/
├── app.js                        # 入口，启动时初始化默认分类
├── app.json                      # 页面注册 + tabBar
├── app.wxss                      # 全局样式（卡片、金额、按钮、空状态）
├── sitemap.json
├── project.config.json           # 开发者工具项目配置（appid 为公共占位值，真实 AppID 见下方说明）
├── project.private.config.example.json  # 私有配置模板（复制为 project.private.config.json 后填自己的 AppID）
├── components/
│   ├── filter-bar/               # 时间筛选条（全部/本月/上月/自定义）
│   └── summary-card/             # 三项合计卡片
├── pages/
│   ├── index/                    # 记账：合计 + 筛选 + 账单列表 + 导出/清空
│   ├── stats/                    # 统计：分类分组 + 分类合计行
│   ├── edit/                     # 新增 / 编辑账单表单（含分类面板、优惠方式）
│   ├── mine/                     # 我的：签到、日历、主题色
│   └── day/                      # 当日账单（自定义导航栏，左上角返回）
└── utils/
    ├── money.js                  # 金额：统一以「分」为单位存储
    ├── date.js                   # 日期：YYYY-MM-DD + 月份区间
    ├── store.js                  # Storage 读写：账单、分类（含排序）
    ├── filter.js                 # 筛选条件 + 汇总 + 分类分组统计
    ├── theme.js                  # 主题色：内置 6 套配色 + tabBar 同步
    ├── checkin.js                # 签到：积分 / 连续天数 / 会员天数
    └── csv.js                    # CSV 生成、写文件、转发
```

---

## 三、运行方式

1. 克隆或下载本项目到任意目录（项目内没有绝对路径依赖，放哪都能跑）：

   ```bash
   git clone https://github.com/zheng614/uhui-record.git
   ```

2. （可选）复制私有配置模板，填上**你自己的**小程序 AppID：

   ```bash
   cp project.private.config.example.json project.private.config.json
   ```

   打开 `project.private.config.json`，把 `"appid": "touristappid"` 改成你的 AppID。
   这个文件已在 `.gitignore` 中，不会被提交，也不会泄露你的 AppID。

3. 打开微信开发者工具 →「导入项目」→ 目录选本项目根目录 → 创建。

4. 首次运行会提示「您信任此项目的作者吗」，选「信任并运行」即可在模拟器看到「记账」页。

> 只想看效果、不打算真机预览的话，可以连 AppID 都不填：`project.config.json` 里的 `touristappid` 就是游客模式占位值，模拟器照常运行，只有「预览 / 上传」不可用。
>
> 如果开发者工具没有读取 `project.private.config.json` 里的 AppID，也可以在「详情 → 基本信息」里改；**工具可能会把 AppID 写回 `project.config.json`**，提交前记得把它改回占位值（`git checkout project.config.json`），别把自己的 AppID 推上来。

**环境要求**：微信开发者工具 1.06 以上，基础库 2.17.1+（用到了 `wx.showModal({ editable })`、`wx.shareFileMessage`）。

---

## 四、一起完善（协作指南）

这个项目是个人记账工具，欢迎提 Issue、提 PR 一起把它做顺。约定如下：

### 分支与提交

- `main` 保持随时可运行，改动走个人分支 → PR。
- 提交信息用约定式前缀：`feat:` 新功能、`fix:` 修 bug、`style:` 纯样式、`refactor:` 重构、`docs:` 文档、`chore:` 杂项。
- 一个 PR 只做一件事，描述里写清「改了什么 / 为什么 / 怎么验证」。

### 提交前自检

```bash
node scripts/check.js      # 零依赖，本地跑的就是 CI 跑的那一份
```

一次过查完：JSON/JS 语法、文件 BOM、`app.json` 页面文件是否齐全、`usingComponents` 路径是否存在、`project.config.json` 的 appid 是否为占位值、全仓库有没有真实 AppID 或 Windows 绝对路径。

CI 每次 push / PR 会自动跑同一份脚本（工作流原文见 [`docs/ci-workflow.yml`](docs/ci-workflow.yml)，复制到 `.github/workflows/ci.yml` 即启用）。

### 代码约定

- 全部使用原生小程序语法（WXML / WXSS / JS），**不引入第三方依赖、不做 npm 构建**，保证克隆即可跑。
- 金额一律以**整数分**在 `utils/` 与 Storage 之间传递，只在渲染前用 `utils/money.js` 转成「元」的字符串。
- 主题色统一用 `var(--brand)` / `var(--brand-dark)` / `var(--brand-soft)`，不要在页面里写死颜色，否则换主题会漏。
- 新增 Storage 字段沿用版本化 key（`uhui_xxx_v1`），需要改结构时写迁移逻辑，别让用户的历史账单丢失。
- 关键函数保留中文注释，复杂交互（拖动排序、金额联动）在注释里说明状态流转。

### 不要提交的东西

- `project.private.config.json`（含你的 AppID 与本地编译偏好）
- `node_modules/`、`miniprogram_npm/`、`dist/`、`*.log`
- 任何截图、个人账单导出文件（`.csv`）

### 反馈

有想法或遇到问题：开 [Issue](https://github.com/zheng614/uhui-record/issues)。

---

## 五、数据结构

金额统一使用**整数分**保存（`utils/money.js` 负责与「元」互转），从根上避免浮点累加误差。

```js
// 账单 Bill
{
  id: 'bill_xxx',          // 本地生成，无需后端
  date: '2026-10-31',      // YYYY-MM-DD，字符串可直接比较大小
  totalCents: 12500,       // 总价 125.00 元
  discountCents: 2500,     // 优惠 25.00 元（两种优惠方式都折算成金额存这里）
  paidCents: 10000,        // 实付 100.00 元
  discountType: 'minus',   // minus=满减（减多少钱），rate=折扣（打几折）
  discountRate: '',        // 折扣单才有：8 表示 8 折；满减单为 ''
  categoryId: 'cat_xxx',
  note: '超市满减',
  createdAt: 1761900000000,
  updatedAt: 1761900000000
}

// 分类 Category（数组顺序即展示顺序，可在「记一笔 → 分类」面板拖动调整）
{ id: 'cat_xxx', name: '餐饮', createdAt: 1761900000000 }

// 签到 Checkin
{ points: 3, streak: 3, lastDate: '2026-10-31', memberDays: 0,
  memberExpire: '', history: ['2026-10-29', '2026-10-30', '2026-10-31'] }
```

> `categoryId: ''` 表示「未分类」：分类被删除后，其下账单会退回这个状态，
> 统计页会单独成组，账单编辑页会提示「原分类已删除，请重新选择」。

Storage Key（带版本号，便于后续升级）：
**这些 key 一旦发布就不能改名** —— 小程序发新版本时微信会沿用同一 AppID 下的
本地数据，key 不变、也不调用 `wx.clearStorage()`，用户升级后账单就都还在。
新增字段由 `store.normalizeBill()` 在读取时补齐，不会因为你加了字段而丢掉老账单。

- `uhui_bills_v1` 账单数组
- `uhui_categories_v1` 分类数组
- `uhui_filter_v1` 当前筛选条件（首页与统计页共用，因此筛选联动）
- `uhui_theme_v1` 主题色 `{ key }`
- `uhui_checkin_v1` 签到 / 积分 / 会员记录

---

## 六、交互说明

- **记一笔**：记账页右下角悬浮按钮 → 表单。
- **金额三向联动**：总价 / 优惠（折扣模式下是「几折」）/ 实付，**任意填两项，第三项自动算好**。
  - 先填总价再填优惠 → 自动出实付；
  - 先填总价再改实付 → 自动反推优惠金额（折扣模式下反推几折）；
  - 先填优惠和实付 → 自动算出总价。
- **优惠方式**：表单里切换「满减（减多少钱）」和「折扣（打几折）」。
  - 满减：`100 - 50 = 50`，输入优惠金额；
  - 折扣：`100 × 0.8 = 80`，输入 `8` 表示 8 折；切换过去时折扣框默认是 0，只有总价和实付都填了才会自动换算成真实折扣，列表里带「8折」角标。
- **分类（在记一笔里）**：点「分类」行打开面板 —— 左侧 `⠿` 手柄按住可上下拖动排序；点分类名即选用；「删除」可删任意分类（账单会转未分类，不会丢）；「＋ 新增分类」添加新分类。顺序会同步到统计页分组与记账时的面板顺序。
- **编辑**：点击账单整行或行内「编辑」。
- **删除**：行内「删除」、当日账单页「删除」，或编辑页底部「删除账单」，都会弹确认框。
- **筛选**：记账页与统计页共用同一个筛选状态，切页后仍然保持。
- **导出 CSV**：记账号「导出 CSV」，导出**当前筛选范围内**的账单（含「优惠方式」列与一行合计）。文件写入小程序用户目录，并调起「转发文件」，发给文件传输助手即可在电脑上打开；环境不支持转发时可直接复制内容另存为 `.csv`。
- **清空**：首页底部「清空全部账单」，两次确认后执行（分类保留）。
- **我的 → 签到**：每天 +1 积分；连续签到每满 7 天额外 +1 天会员。积分与会员权益暂定，现在只做记录与展示。
- **我的 → 日历**：日期下方的大红数字是**当天优惠总额**；点任意日期进入当日账单，左上角「‹ 返回」回到日历。
- **我的 → 主题颜色**：6 套配色，选中后合计卡、按钮、标签、悬浮按钮、tabBar 选中色一起换。

---

## 七、升级不丢数据

小程序发新版本时，微信会沿用**同一个 AppID** 下的本地 Storage，因此只要满足下面三条，用户升级后账单原样都在：

1. **不调用 `wx.clearStorage()` / `wx.clearStorageSync()`**（全项目没有这两处调用，`scripts/check.js` 也不会放过误加）；
2. **不改 Storage Key 的名字**（`uhui_bills_v1`、`uhui_categories_v1` 等，见上一节）；
3. **新字段只补不删**：`utils/store.js` 的 `normalizeBill()` 会在读取时把老账单补齐成最新结构（缺 `discountType` 就按满减算），`initStorage()` 在启动时做一次迁移，且迁移只写不删、旧 key 也保留作备份。

> 需要清数据的只有两个地方：「清空全部账单」按钮（用户自己点、还两次确认）和「删除单条账单」。

---

## 八、备注

- 所有代码均为原生小程序语法（WXML / WXSS / JS），无第三方依赖、无 npm 构建步骤。
- 导出使用 `wx.shareFileMessage`（基础库 2.16.1+）与 `wx.getFileSystemManager`，在真机上体验最佳。
- 新增分类使用 `wx.showModal({ editable: true })`（基础库 2.17.1+）。
