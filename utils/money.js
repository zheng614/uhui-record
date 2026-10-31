/**
 * 金额工具
 * 约定：所有金额在逻辑层与 Storage 中统一以「分」为单位的整数保存，
 * 只在展示与用户输入时转换成「元」，从根本上避免浮点数累加误差。
 */

/** 把用户输入的元（字符串/数字）转成整数分 */
function toCents(input) {
  if (input === null || input === undefined || input === '') return 0
  // 允许用户输入 ¥ / 逗号 / 空格等，先清洗再解析
  const cleaned = String(input).replace(/[^\d.-]/g, '')
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

/** 整数分 -> 数字元 */
function toYuan(cents) {
  const n = Number(cents)
  if (!Number.isFinite(n)) return 0
  return n / 100
}

/** 整数分 -> 两位小数字符串，例如 1250 -> "12.50" */
function format(cents) {
  return toYuan(cents).toFixed(2)
}

module.exports = {
  toCents,
  toYuan,
  format
}
