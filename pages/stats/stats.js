/**
 * 统计页：按分类分组统计
 * ------------------------------------------------------------------
 * 顶部：全部（当前筛选范围内）账单的三项合计
 * 下面：每个分类一张卡片，卡片内含「分类合计行」（浅灰底、加粗）+ 明细
 * 筛选条件与首页共用同一份 Storage 记录，所以两页联动。
 */
const store = require('../../utils/store')
const filterUtil = require('../../utils/filter')
const money = require('../../utils/money')
const theme = require('../../utils/theme')

Page({
  data: {
    themeKey: 'green',
    filter: filterUtil.DEFAULT_FILTER,
    caption: '全部账单',
    summary: { count: 0, totalCents: 0, discountCents: 0, paidCents: 0 },
    groups: [],
    categoryCount: 0,
    empty: true
  },

  onLoad() {
    // 折叠状态不放进 data，避免每次刷新被重置
    this.collapsed = {}
  },

  onShow() {
    this.setData({ themeKey: theme.getTheme().key })
    this.reload()
  },

  onPullDownRefresh() {
    this.reload()
    wx.stopPullDownRefresh()
  },

  reload() {
    const filter = filterUtil.getFilter()
    const filtered = filterUtil.applyFilter(store.getBills(), filter)
    const summary = filterUtil.summarize(filtered)
    const categories = store.getCategories()
    const rawGroups = filterUtil.groupByCategory(filtered, categories)

    // 计算每个分类在「实付合计」中的占比，便于一眼看出花销结构
    const totalPaid = summary.paidCents || 0
    const groups = rawGroups.map((group) => {
      const share = totalPaid > 0 ? Math.round((group.paidCents / totalPaid) * 100) : 0
      return {
        categoryId: group.categoryId,
        name: group.name,
        count: group.count,
        totalText: money.format(group.totalCents),
        discountText: money.format(group.discountCents),
        paidText: money.format(group.paidCents),
        shareText: share > 0 ? `占 ${share}%` : '占 0%',
        collapsed: !!this.collapsed[group.categoryId],
        items: group.bills.map((bill) => ({
          id: bill.id,
          date: bill.date,
          title: bill.note ? bill.note : '无备注',
          totalText: money.format(bill.totalCents),
          discountText: money.format(bill.discountCents),
          paidText: money.format(bill.paidCents),
          hasDiscount: (bill.discountCents || 0) > 0
        }))
      }
    })

    this.setData({
      filter,
      caption: filterUtil.label(filter),
      summary,
      groups,
      categoryCount: groups.length,
      empty: groups.length === 0
    })
  },

  onFilterChange(e) {
    const filter = filterUtil.setFilter(e.detail.filter)
    this.setData({ filter })
    this.reload()
  },

  /** 折叠 / 展开某个分类 */
  onToggle(e) {
    const index = e.currentTarget.dataset.index
    const group = this.data.groups[index]
    if (!group) return
    const nextCollapsed = !group.collapsed
    this.collapsed[group.categoryId] = nextCollapsed
    this.setData({ [`groups[${index}].collapsed`]: nextCollapsed })
  },

  /** 点击明细跳转编辑 */
  onBillTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/edit/edit?id=${id}` })
  }
})
