/**
 * U惠记录 - 小程序入口
 * 纯前端应用：所有数据保存在小程序本地 Storage，不依赖任何后端服务。
 *
 * 数据安全说明：
 *   小程序发新版本时，微信会沿用同一 AppID 下的本地 Storage，
 *   只要不调用 wx.clearStorage()、不改 Storage Key，用户升级后数据照旧。
 *   initStorage() 只做「补齐字段 / 首次写默认分类」，不会删除任何账单。
 */
const store = require('./utils/store')

App({
  globalData: {
    version: '1.1.0'
  },

  onLaunch() {
    // 1) 老数据的字段迁移（只补不删）2) 首次启动写入默认分类
    store.initStorage()
  },

  /**
   * 兜底：万一某个页面抛错导致白屏，也不清数据
   * 这里只打日志，方便在开发者工具里定位问题
   */
  onError(err) {
    console.error('[U惠记录] 未捕获错误：', err)
  }
})
