/**
 * 筛选与统计工具
 * ------------------------------------------------------------------
 * 筛选条件在两个页面（记账 / 统计）之间共享，因此持久化到 Storage，
 * 保证「筛选后统计数据跟着联动」。
 *
 * filter 结构：
 *   { type: 'all' | 'thisMonth' | 'lastMonth' | 'custom',
 *     start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 * type 为 all / thisMonth / lastMonth 时 start、end 会被自动推导。
 */

const dateUtil = require('./date')

const FILTER_KEY = 'uhui_filter_v1'

const DEFAULT_FILTER = { type: 'all', start: '', end: '' }

/** 读取筛选条件，顺便把区间补全，保证调用方拿到的都是完整结构 */
function getFilter() {
  const saved = wx.getStorageSync(FILTER_KEY)
  const filter = Object.assign({}, DEFAULT_FILTER, saved && typeof saved === 'object' ? saved : {})
  if (!['all', 'thisMonth', 'lastMonth', 'custom'].includes(filter.type)) {
    filter.type = 'all'
  }
  return filter
}

function setFilter(filter) {
  const next = Object.assign({}, DEFAULT_FILTER, filter || {})
  wx.setStorageSync(FILTER_KEY, next)
  return next
}

/**
 * 把筛选条件解析成真正参与比较的日期区间
 * @returns {{start: string, end: string}} 空字符串表示不限
 */
function resolveRange(filter) {
  const f = filter || getFilter()
  if (f.type === 'thisMonth') {
    return dateUtil.monthRange(0)
  }
  if (f.type === 'lastMonth') {
    return dateUtil.monthRange(-1)
  }
  if (f.type === 'custom') {
    return { start: f.start || '', end: f.end || '' }
  }
  return { start: '', end: '' }
}

/** 日期是否落在区间内（YYYY-MM-DD 字符串可直接比较） */
function inRange(dateStr, range) {
  if (!dateStr) return false
  if (range.start && dateStr < range.start) return false
  if (range.end && dateStr > range.end) return false
  return true
}

/** 按筛选条件过滤账单 */
function applyFilter(bills, filter) {
  const range = resolveRange(filter)
  if (!range.start && !range.end) return (bills || []).slice()
  return (bills || []).filter((bill) => inRange(bill.date, range))
}

/** 筛选条件的可读文案，用于页面标题与导出文件说明 */
function label(filter) {
  const f = filter || getFilter()
  if (f.type === 'thisMonth') return '本月'
  if (f.type === 'lastMonth') return '上月'
  if (f.type === 'custom') {
    const start = f.start || '最早'
    const end = f.end || '至今'
    return `${start} 至 ${end}`
  }
  return '全部账单'
}

/**
 * 汇总账单：使用整数分累加，结果永远精确
 * @returns {{count:number, totalCents:number, discountCents:number, paidCents:number}}
 */
function summarize(bills) {
  const list = bills || []
  let totalCents = 0
  let discountCents = 0
  let paidCents = 0
  list.forEach((bill) => {
    totalCents += bill.totalCents || 0
    discountCents += bill.discountCents || 0
    paidCents += bill.paidCents || 0
  })
  return {
    count: list.length,
    totalCents,
    discountCents,
    paidCents
  }
}

/**
 * 按分类分组统计
 * @param {Array} bills 已过滤的账单
 * @param {Array} categories 分类列表（用于保持展示顺序）
 * @returns {Array} [{ categoryId, name, count, totalCents, discountCents, paidCents, bills }]
 */
function groupByCategory(bills, categories) {
  const list = bills || []
  const cats = categories || []
  const map = {}
  const groups = []

  // 先按分类顺序建分组，保证统计页顺序稳定
  cats.forEach((category) => {
    const group = {
      categoryId: category.id,
      name: category.name,
      count: 0,
      totalCents: 0,
      discountCents: 0,
      paidCents: 0,
      bills: []
    }
    map[category.id] = group
    groups.push(group)
  })

  // 账单里可能残留已被删除分类的 id，用「未分类」兜底，避免数据丢失
  const fallback = {
    categoryId: '__unknown__',
    name: '未分类',
    count: 0,
    totalCents: 0,
    discountCents: 0,
    paidCents: 0,
    bills: []
  }

  list.forEach((bill) => {
    const group = map[bill.categoryId] || fallback
    group.count += 1
    group.totalCents += bill.totalCents || 0
    group.discountCents += bill.discountCents || 0
    group.paidCents += bill.paidCents || 0
    group.bills.push(bill)
  })

  const result = groups.filter((group) => group.count > 0)
  if (fallback.count > 0) {
    result.push(fallback)
  }
  return result
}

module.exports = {
  FILTER_KEY,
  DEFAULT_FILTER,
  getFilter,
  setFilter,
  resolveRange,
  inRange,
  applyFilter,
  label,
  summarize,
  groupByCategory
}
