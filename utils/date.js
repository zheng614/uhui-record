/**
 * 日期工具
 * 账单日期统一使用 "YYYY-MM-DD" 字符串保存，字符串可直接比较大小，
 * 既便于筛选又不会有时区问题。
 */

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`
}

/** 今天，返回 YYYY-MM-DD */
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 把 Date 转成 YYYY-MM-DD */
function toDateString(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 某年某月的天数 */
function daysInMonth(year, month) {
  // month 为 1-12
  return new Date(year, month, 0).getDate()
}

/**
 * 取得相对当前月份的区间
 * @param {number} offset 0=本月，-1=上月
 * @returns {{start: string, end: string}}
 */
function monthRange(offset) {
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth() + (offset || 0), 1)
  const year = base.getFullYear()
  const month = base.getMonth() + 1
  const start = `${year}-${pad2(month)}-01`
  const end = `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`
  return { start, end }
}

/** 文件名用的时间戳，例如 20261031_181630 */
function stamp() {
  const d = new Date()
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  )
}

/** 展示用：2026-10-31 -> 10月31日 */
function pretty(dateStr) {
  if (!dateStr || dateStr.length < 10) return dateStr || ''
  const parts = dateStr.split('-')
  return `${Number(parts[1])}月${Number(parts[2])}日`
}

module.exports = {
  pad2,
  today,
  toDateString,
  monthRange,
  stamp,
  pretty
}
