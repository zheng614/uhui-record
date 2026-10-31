/**
 * CSV 导出
 * ------------------------------------------------------------------
 * 小程序的本地文件系统可以直接写入 USER_DATA_PATH（用户目录，可持久化），
 * 写完后再通过 wx.shareFileMessage 把文件转发出去（发给文件传输助手即可保存到电脑）。
 * 若当前环境不支持转发（例如部分开发者工具版本），退化为复制到剪贴板。
 */

const dateUtil = require('./date')
const money = require('./money')

/** CSV 字段转义：含逗号、引号、换行时用双引号包裹并转义内部引号 */
function escapeField(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * 生成 CSV 文本
 * @param {Array} bills 账单列表
 * @param {Function} nameGetter (categoryId) => 分类名
 * @param {object} summary 汇总结果（可选，末尾补一行合计）
 */
function buildCsv(bills, nameGetter, summary) {
  const rows = [['日期', '分类', '备注', '优惠方式', '总价(元)', '优惠(元)', '实付(元)']]

  ;(bills || []).forEach((bill) => {
    // 折扣单导出成「8折」，满减单导出成「满减」
    const discountType = bill.discountType === 'rate'
      ? `${bill.discountRate || ''}折`
      : '满减'
    rows.push([
      bill.date,
      nameGetter ? nameGetter(bill.categoryId) : '',
      bill.note || '',
      discountType,
      money.format(bill.totalCents),
      money.format(bill.discountCents),
      money.format(bill.paidCents)
    ])
  })

  if (summary) {
    rows.push([
      '合计',
      `${summary.count} 笔`,
      '',
      '',
      money.format(summary.totalCents),
      money.format(summary.discountCents),
      money.format(summary.paidCents)
    ])
  }

  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n')
}

/**
 * 写入临时文件
 * @returns {Promise<{filePath:string, fileName:string}>}
 */
function writeToFile(content) {
  return new Promise((resolve, reject) => {
    const fileName = `U惠记录_${dateUtil.stamp()}.csv`
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
    const fs = wx.getFileSystemManager()
    fs.writeFile({
      filePath,
      // 前置 BOM，Excel 打开中文才不会乱码
      data: `\ufeff${content}`,
      encoding: 'utf8',
      success() {
        resolve({ filePath, fileName })
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

/** 调起「转发文件」；不支持或用户取消时都返回 ok:false，由调用方降级 */
function shareFile(filePath, fileName) {
  return new Promise((resolve) => {
    if (typeof wx.shareFileMessage !== 'function') {
      resolve({ ok: false, reason: 'unsupported' })
      return
    }
    wx.shareFileMessage({
      filePath,
      fileName,
      success() {
        resolve({ ok: true })
      },
      fail(err) {
        resolve({ ok: false, reason: (err && err.errMsg) || 'cancel' })
      }
    })
  })
}

/**
 * 导出并转发
 * @returns {Promise<{ok:boolean, filePath:string, fileName:string, shared:boolean}>}
 */
async function exportBills(bills, nameGetter, summary) {
  const content = buildCsv(bills, nameGetter, summary)
  const file = await writeToFile(content)
  const shared = await shareFile(file.filePath, file.fileName)
  return {
    ok: true,
    content,
    filePath: file.filePath,
    fileName: file.fileName,
    shared: shared.ok
  }
}

module.exports = {
  buildCsv,
  writeToFile,
  shareFile,
  exportBills
}
