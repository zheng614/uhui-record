/**
 * 主题色
 * ------------------------------------------------------------------
 * 小程序里用 CSS 变量做主题：app.wxss 里为每个主题定义一组 --brand 变量，
 * 页面根节点加上 `theme-xxx` 类名即可整页换色（含渐变合计卡、按钮、标签）。
 *
 * 新增主题只需在 THEMES 里加一项，并在 app.wxss 中补同名 class。
 */

const THEME_KEY = 'uhui_theme_v1'

/** 内置配色（都是常见、耐看的颜色） */
const THEMES = [
  { key: 'green', name: '森林绿', brand: '#0a8f5b', dark: '#087a4d', soft: '#e8f5ee', tag: '#0a8f5b' },
  { key: 'blue', name: '深海蓝', brand: '#2f6fed', dark: '#255fd1', soft: '#e9f0ff', tag: '#2f6fed' },
  { key: 'purple', name: '暮光紫', brand: '#7c5cff', dark: '#6a4ae6', soft: '#f0ecff', tag: '#7c5cff' },
  { key: 'orange', name: '暖阳橙', brand: '#f5741a', dark: '#d9610c', soft: '#fff1e6', tag: '#f5741a' },
  { key: 'pink', name: '樱花粉', brand: '#e8517f', dark: '#d13a68', soft: '#ffe9f0', tag: '#e8517f' },
  { key: 'ink', name: '墨黑', brand: '#2b2f36', dark: '#1c1f24', soft: '#eceef1', tag: '#2b2f36' }
]

const DEFAULT_KEY = 'green'

/** 当前主题（永远返回一个可用对象） */
function getTheme() {
  const saved = wx.getStorageSync(THEME_KEY)
  const key = saved && saved.key ? saved.key : DEFAULT_KEY
  return THEMES.find((item) => item.key === key) || THEMES[0]
}

/**
 * 切换主题：写入 Storage，并同步底部 tabBar 的选中色
 * （tabBar 颜色只能通过 API 改，不会跟着 CSS 变量走）
 */
function setTheme(key) {
  const theme = THEMES.find((item) => item.key === key) || THEMES[0]
  wx.setStorageSync(THEME_KEY, { key: theme.key })
  syncTabBar(theme)
  return theme
}

/** 把当前主题色同步到 tabBar 选中色，进入小程序时调用一次即可 */
function syncTabBar(theme) {
  const current = theme || getTheme()
  try {
    wx.setTabBarStyle({
      selectedColor: current.brand,
      color: '#8a8f99',
      backgroundColor: '#ffffff',
      borderStyle: 'white'
    })
  } catch (err) {
    // tabBar 未就绪（比如在非 tab 页调用）时忽略即可
  }
}

module.exports = {
  THEME_KEY,
  THEMES,
  DEFAULT_KEY,
  getTheme,
  setTheme,
  syncTabBar
}
