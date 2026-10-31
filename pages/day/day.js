/**
 * 当日账单
 * ------------------------------------------------------------------
 * 从「我的 → 日历」点某一天进来，只显示这一天的账单。
 * 页面使用自定义导航栏，左上角固定「‹ 返回」，点一下回到上一页（日历）。
 */
const store = require('../../utils/store')
const money = require('../../utils/money')
const dateUtil = require('../../utils/date')
const theme = require('../../utils/theme')
const filterUtil = require('../../utils/filter')

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

Page({
  data: {
    themeKey: 'green',
    date: '',
    dateLabel: '',
    bills: [],
    summary: { count: 0, totalCents: 0, discountCents: 0, paidCents: 0 },
    empty: true,
    statusBarHeight: 20,
    navHeight: 44
  },

  onLoad(options) {
    const date = (options && options.date) || dateUtil.today()
    const sys = wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    // 自定义导航栏高度：状态栏 + 胶囊高度（拿不到时退回 44px）
    const navHeight = menu && menu.height ? (menu.top - sys.statusBarHeight) * 2 + menu.height : 44

    this.setData({
      date,
      dateLabel: this.formatLabel(date),
      themeKey: theme.getTheme().key,
      statusBarHeight: sys.statusBarHeight || 20,
      navHeight
    })
  },

  onShow() {
    this.setData({ themeKey: theme.getTheme().key })
    this.reload()
  },

  /** 2026-10-31 -> 2026 年 10 月 31 日 周六 */
  formatLabel(date) {
    const [y, m, d] = String(date).split('-').map(Number)
    const weekday = WEEK[new Date(y, (m || 1) - 1, d || 1).getDay()]
    return `${y} 年 ${m} 月 ${d} 日 ${weekday}`
  },

  /** 读取当天账单 */
  reload() {
    const { date } = this.data
    const nameMap = {}
    store.getCategories().forEach((item) => { nameMap[item.id] = item.name })

    const bills = store.getBills()
      .filter((bill) => bill.date === date)
      .map((bill) => ({
        id: bill.id,
        categoryName: nameMap[bill.categoryId] || '未分类',
        title: bill.note ? bill.note : '无备注',
        totalText: money.format(bill.totalCents),
        discountText: money.format(bill.discountCents),
        paidText: money.format(bill.paidCents),
        hasDiscount: (bill.discountCents || 0) > 0,
        rateTag: bill.discountType === 'rate' && bill.discountRate ? `${bill.discountRate}折` : ''
      }))

    const dayBills = store.getBills().filter((bill) => bill.date === date)
    const raw = filterUtil.summarize(dayBills)

    this.setData({
      bills,
      summary: {
        count: raw.count,
        totalText: money.format(raw.totalCents),
        discountText: money.format(raw.discountCents),
        paidText: money.format(raw.paidCents)
      },
      empty: bills.length === 0
    })
  },

  /** 左上角返回 */
  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  onBillTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/edit/edit?id=${id}` })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这笔账单？',
      content: '删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#e5484d',
      success: (res) => {
        if (!res.confirm) return
        store.removeBill(id)
        this.reload()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },

  /** 当天再补一笔 */
  onCreate() {
    wx.navigateTo({ url: `/pages/edit/edit?date=${this.data.date}` })
  }
})
