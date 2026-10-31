# 参与贡献

感谢想一起完善「U惠记录」。这个项目刻意保持**零依赖、纯原生**，改动门槛很低，下面几条约定能让合并更顺。

## 一、本地跑起来

```bash
git clone https://github.com/zheng614/uhui-record.git
cd uhui-record
cp project.private.config.example.json project.private.config.json   # 想把项目关联到自己的小程序时，填 appid
```

用微信开发者工具「导入项目」选择该目录即可。只想跑模拟器的话，AppID 可以留着占位值。

## 二、提交前自检

```bash
node scripts/check.js
```

零依赖脚本，本地跑的就是 CI（`.github/workflows/ci.yml`）跑的那一份，一次过查完：

- 所有 `.json` 语法合法、所有 `.js` 语法合法（等价 `node --check`）
- 源码不带 UTF-8 BOM（带 BOM 会让模拟器渲染出乱码方块）
- `app.json` 声明的每个页面都有 `.js/.json/.wxml/.wxss`，tabBar 项都在 pages 里
- 页面 json 里 `usingComponents` 指向的组件确实存在
- `project.config.json` 的 `appid` 必须是 `touristappid`
- 全仓库不得出现真实 AppID（`wx` + 16 位十六进制）或 Windows 绝对路径

另外在开发者工具里点一次「编译」，控制台无红色报错；改动涉及金额/统计时，用几条账单实测合计是否正确。

> CI 会在你提 PR 时自动跑一遍，红了就按提示改；本地先过一遍能省一轮往返。

## 三、代码约定

| 类型 | 约定 |
|---|---|
| 语言 | 原生 WXML / WXSS / JS，不引入第三方库，不做 npm 构建 |
| 金额 | 全程用**整数分**（`utils/money.js`），只在渲染时转成「元」字符串 |
| 颜色 | 只用 `var(--brand)` / `var(--brand-dark)` / `var(--brand-soft)`，禁止写死主色，否则换主题会漏 |
| Storage | 版本化 key（`uhui_xxx_v1`），结构变更必须写迁移，不能丢用户历史账单 |
| 注释 | 关键函数、复杂交互（拖动排序、金额联动）写清状态流转 |
| 命名 | 页面 `pages/<name>/<name>.*`，工具函数放 `utils/`，纯计算逻辑不要写进页面 |

## 四、提交信息

约定式前缀：`feat:` / `fix:` / `style:` / `refactor:` / `docs:` / `chore:`。

```
feat: 支持按月份导出 CSV
fix: 折扣模式下实付未跟随总价刷新
```

一个 PR 只做一件事，描述里写清：改了什么、为什么改、怎么验证（截图或步骤都行）。

## 五、可以做什么

- 新的统计维度（按周、按标签、趋势图）
- 数据备份/恢复（导出 JSON、导入合并）
- 无障碍与暗色模式
- 性能与包体积优化

不确定要不要做的功能，先开 Issue 聊一版，避免白写。

## 六、反馈渠道

- GitHub Issue：问题、需求、想法都欢迎
- 小程序内「我的 → 提建议」：走微信客服会话直达作者（需要在公众平台配置客服人员）
