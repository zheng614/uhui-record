/**
 * U惠记录 - 小程序入口
 * 纯前端应用：所有数据保存在小程序本地 Storage，不依赖任何后端服务。
 */
const store = require('./utils/store')

App({
  globalData: {
    version: '1.0.0'
  },

  onLaunch() {
    // 首次启动时写入默认分类，保证录入界面可以直接使用
    store.initStorage()
  }
})
