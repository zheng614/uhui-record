/**
 * 首页：账单列表
 * ------------------------------------------------------------------
 * 结构：合计卡片 -> 筛选条 -> 账单列表 -> 底部操作（清空）
 * 数据全部来自本地 Storage，onShow 时重新读取，保证从编辑页返回后即时刷新。
 */
const store = require('../../utils/store')
const filterUtil = require('../../utils/filter')
const money = require('../../utils/money')
const csv = require('../../utils/csv')
const theme = require('../../utils/theme')

Page({
  data: {
    themeKey: 'green',
    filter: filterUtil.DEFAULT_FILTER,
    caption: '全部账单',
    bills: [],      // 展示用的视图数据
    summary: { count: 0, totalCents: 0, discountCents: 0, paidCents: 0 },
    empty: true
  },

  onShow() {
    this.setData({ themeKey: theme.getTheme().key })
    theme.syncTabBar()
    this.reload()
  },

  onPullDownRefresh() {
    this.reload()
    wx.stopPullDownRefresh()
  },

  /** 重新读取数据并按当前筛选条件组装视图 */
  reload() {
    const filter = filterUtil.getFilter()
    const allBills = store.getBills()
    const filtered = filterUtil.applyFilter(allBills, filter)
    const summary = filterUtil.summarize(filtered)
    const nameMap = this.buildNameMap()

    const bills = filtered.map((bill) => ({
      id: bill.id,
      date: bill.date,
      title: bill.note ? bill.note : '无备注',
      categoryName: nameMap[bill.categoryId] || '未分类',
      totalText: money.format(bill.totalCents),
      discountText: money.format(bill.discountCents),
      paidText: money.format(bill.paidCents),
      hasDiscount: (bill.discountCents || 0) > 0,
      // 折扣单展示「8折」小角标，满减单不展示
      rateTag: bill.discountType === 'rate' && bill.discountRate ? `${bill.discountRate}折` : ''
    }))

    this.setData({
      filter,
      caption: filterUtil.label(filter),
      bills,
      summary,
      empty: bills.length === 0
    })
  },

  /** categoryId -> 分类名 映射表 */
  buildNameMap() {
    const map = {}
    store.getCategories().forEach((category) => {
      map[category.id] = category.name
    })
    return map
  },

  /** 筛选条变化：持久化并刷新 */
  onFilterChange(e) {
    const filter = filterUtil.setFilter(e.detail.filter)
    this.setData({ filter })
    this.reload()
  },

  /** 去记一笔 */
  onCreate() {
    wx.navigateTo({ url: '/pages/edit/edit' })
  },

  /** 点击整行进入编辑 */
  onBillTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/edit/edit?id=${id}` })
  },

  /** 行内「编辑」按钮（阻止冒泡） */
  onEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/edit/edit?id=${id}` })
  },

  /** 行内「删除」按钮：必须二次确认 */
  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const bill = store.getBillById(id)
    if (!bill) {
      this.reload()
      return
    }
    const desc = `${bill.date} · ¥${money.format(bill.totalCents)}`
    wx.showModal({
      title: '删除这笔账单？',
      content: `${desc}\n删除后不可恢复。`,
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

  /** 导出当前筛选范围内的账单 */
  onExport() {
    const filter = filterUtil.getFilter()
    const bills = filterUtil.applyFilter(store.getBills(), filter)
    if (bills.length === 0) {
      wx.showToast({ title: '当前范围内没有账单', icon: 'none' })
      return
    }

    const summary = filterUtil.summarize(bills)
    const nameMap = this.buildNameMap()
    const rangeText = filterUtil.label(filter)

    wx.showLoading({ title: '正在导出', mask: true })

    csv
      .exportBills(bills, (id) => nameMap[id] || '未分类', summary)
      .then((result) => {
        wx.hideLoading()
        if (result.shared) {
          wx.showModal({
            title: '导出成功',
            content: `已生成 ${result.fileName}（共 ${bills.length} 笔，范围：${rangeText}）。\n把它转发给「文件传输助手」即可在电脑上打开。`,
            showCancel: false,
            confirmText: '知道了'
          })
        } else {
          wx.showModal({
            title: 'CSV 已生成',
            content: `文件位置：${result.filePath}\n当前环境不支持直接转发，可复制下方内容另存为 .csv 文件。`,
            confirmText: '复制内容',
            success: (res) => {
              if (res.confirm) {
                wx.setClipboardData({ data: result.content })
              }
            }
          })
        }
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '导出失败，请重试', icon: 'none' })
      })
  },

  /** 清空全部账单：两次确认 */
  onClearAll() {
    const total = store.getBills().length
    if (total === 0) {
      wx.showToast({ title: '还没有任何账单', icon: 'none' })
      return
    }

    wx.showModal({
      title: '清空全部账单？',
      content: `当前共有 ${total} 笔账单，清空后不可恢复。`,
      confirmText: '继续',
      confirmColor: '#e5484d',
      success: (first) => {
        if (!first.confirm) return
        wx.showModal({
          title: '再次确认',
          content: '所有账单记录将被永久删除，确定继续吗？',
          confirmText: '确认清空',
          confirmColor: '#e5484d',
          success: (second) => {
            if (!second.confirm) return
            store.clearBills()
            this.reload()
            wx.showToast({ title: '已清空', icon: 'success' })
          }
        })
      }
    })
  }
})
