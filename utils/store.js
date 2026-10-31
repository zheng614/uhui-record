/**
 * 本地数据仓库（基于小程序 Storage）
 * ------------------------------------------------------------------
 * 所有业务数据只保存在本机，不涉及任何网络请求。
 *
 * Storage Key 约定（带版本号，便于以后做数据结构升级）：
 *   uhui_bills_v1     账单数组
 *   uhui_categories_v1 分类数组
 *   uhui_filter_v1     当前筛选条件
 *
 * 数据结构：
 *   Bill     { id, date:'YYYY-MM-DD', totalCents, discountCents, paidCents,
 *              categoryId, note, createdAt, updatedAt }
 *   Category { id, name, createdAt }
 * 金额单位统一为「分」，见 utils/money.js。
 */

const BILL_KEY = 'uhui_bills_v1'
const CATEGORY_KEY = 'uhui_categories_v1'

/** 首次使用时写入的默认分类，避免录入时下拉框为空 */
const DEFAULT_CATEGORY_NAMES = ['餐饮', '购物', '交通', '日用', '娱乐', '医疗', '其它']

/** 生成一个足够唯一的本地 id（无需后端也能保证不冲突） */
function createId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix || 'id'}_${Date.now().toString(36)}_${rand}`
}

/* ============================ 分类 ============================ */

/** 读取分类列表；同时兼容早期的「字符串数组」结构 */
function getCategories() {
  let list = wx.getStorageSync(CATEGORY_KEY)
  if (!Array.isArray(list)) {
    list = []
  }
  // 结构迁移：["餐饮", ...] -> [{ id, name, createdAt }]
  const migrated = list.map((item) =>
    typeof item === 'string'
      ? { id: createId('cat'), name: item, createdAt: Date.now() }
      : item
  ).filter((item) => item && item.name)

  // 统一去掉首尾空格并剔除空名
  return migrated
}

function saveCategories(list) {
  wx.setStorageSync(CATEGORY_KEY, list || [])
  return list || []
}

/** 分类名去重时使用的归一化规则：去空格 + 忽略大小写 */
function normalizeName(name) {
  return String(name || '').trim().toLowerCase()
}

/** 新增分类 */
function addCategory(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) {
    return { ok: false, message: '分类名称不能为空' }
  }
  if (trimmed.length > 12) {
    return { ok: false, message: '分类名称请控制在 12 个字以内' }
  }
  const list = getCategories()
  const exists = list.some((item) => normalizeName(item.name) === normalizeName(trimmed))
  if (exists) {
    return { ok: false, message: '该分类已存在' }
  }
  const category = { id: createId('cat'), name: trimmed, createdAt: Date.now() }
  list.push(category)
  saveCategories(list)
  return { ok: true, message: '添加成功', category }
}

/** 修改分类名称 */
function renameCategory(id, name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) {
    return { ok: false, message: '分类名称不能为空' }
  }
  if (trimmed.length > 12) {
    return { ok: false, message: '分类名称请控制在 12 个字以内' }
  }
  const list = getCategories()
  const current = list.find((item) => item.id === id)
  if (!current) {
    return { ok: false, message: '分类不存在' }
  }
  const duplicated = list.some(
    (item) => item.id !== id && normalizeName(item.name) === normalizeName(trimmed)
  )
  if (duplicated) {
    return { ok: false, message: '该分类名称已存在' }
  }
  current.name = trimmed
  saveCategories(list)
  return { ok: true, message: '修改成功' }
}

/**
 * 删除分类
 * ------------------------------------------------------------------
 * 任意分类都可以删除：
 *   · 分类下没有账单  -> 直接删除
 *   · 分类下还有账单  -> 账单不删除，只把 categoryId 置空转为「未分类」，
 *                       统计与列表会自动归入「未分类」，用户可再进账单编辑重新指定
 * 始终保留至少一个分类，避免录入时下拉框为空。
 * @returns {{ok:boolean, message:string, movedBills?:number}}
 */
function removeCategory(id) {
  const list = getCategories()
  const target = list.find((item) => item.id === id)
  if (!target) {
    return { ok: false, message: '分类不存在' }
  }
  if (list.length <= 1) {
    return { ok: false, message: '至少保留一个分类' }
  }

  // 先把该分类下的账单转为「未分类」，再删分类，顺序很重要：
  // 中途失败也不会出现「账单指向已不存在的分类」的悬空状态。
  const raw = wx.getStorageSync(BILL_KEY)
  const bills = Array.isArray(raw) ? raw : []
  const now = Date.now()
  let movedBills = 0
  const nextBills = bills.map((bill) => {
    if (bill.categoryId !== id) return bill
    movedBills += 1
    return Object.assign({}, bill, { categoryId: '', updatedAt: now })
  })
  if (movedBills > 0) saveBills(nextBills)

  saveCategories(list.filter((item) => item.id !== id))
  return {
    ok: true,
    message: movedBills > 0 ? `已删除，${movedBills} 笔账单转为未分类` : '已删除',
    movedBills
  }
}

/**
 * 调整分类顺序：把某个分类上移/下移一位
 * @param {string} id 分类 id
 * @param {number} delta -1 上移，1 下移
 * @returns {{ok:boolean, message:string}}
 */
function moveCategory(id, delta) {
  const list = getCategories()
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) {
    return { ok: false, message: '分类不存在' }
  }
  return moveCategoryTo(id, index + (delta < 0 ? -1 : 1))
}

/**
 * 把分类移动到指定位置（0 表示排到第一个）
 * 顺序会同步影响：统计页分组顺序、录入时的下拉顺序。
 * @returns {{ok:boolean, message:string}}
 */
function moveCategoryTo(id, targetIndex) {
  const list = getCategories()
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) {
    return { ok: false, message: '分类不存在' }
  }
  const target = Math.max(0, Math.min(list.length - 1, Number(targetIndex) || 0))
  if (target === index) {
    return { ok: false, message: index === 0 ? '已经在第一位' : '已经在最后一位' }
  }
  const next = list.slice()
  const moved = next.splice(index, 1)[0]
  next.splice(target, 0, moved)
  saveCategories(next)
  return { ok: true, message: '顺序已调整' }
}

/** 统计「未分类」账单（分类被删除后账单会落到这里） */
function getUncategorized() {
  const bills = getBills().filter((bill) => !bill.categoryId)
  const paidCents = bills.reduce((sum, bill) => sum + (bill.paidCents || 0), 0)
  return { count: bills.length, paidCents }
}

/**
 * 按给定 id 顺序重排分类（拖拽排序后调用）
 * 传入的 id 里不存在的会被忽略，没传到的分类按原顺序补在末尾，
 * 这样即使数据不一致也不会丢分类。
 * @param {string[]} orderedIds
 */
function setCategoryOrder(orderedIds) {
  const list = getCategories()
  const ids = Array.isArray(orderedIds) ? orderedIds : []
  const map = {}
  list.forEach((item) => { map[item.id] = item })

  const next = []
  ids.forEach((id) => {
    if (map[id]) {
      next.push(map[id])
      delete map[id]
    }
  })
  list.forEach((item) => {
    if (map[item.id]) next.push(item)
  })

  saveCategories(next)
  return next
}

/** 按 id 查分类名 */
function getCategoryName(id) {
  const found = getCategories().find((item) => item.id === id)
  return found ? found.name : '未分类'
}

/** 统计某分类下的账单数量 */
function countBillsByCategory(id) {
  return getBills().filter((bill) => bill.categoryId === id).length
}

/* ============================ 账单 ============================ */

/** 读取账单：按日期倒序、同日期按创建时间倒序 */
function getBills() {
  const list = wx.getStorageSync(BILL_KEY)
  if (!Array.isArray(list)) return []
  return list.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
}

function saveBills(list) {
  wx.setStorageSync(BILL_KEY, list || [])
  return list || []
}

function getBillById(id) {
  return getBills().find((bill) => bill.id === id) || null
}

/**
 * 新增或更新一条账单
 * @param {object} record 账单数据，带 id 表示更新
 */
function upsertBill(record) {
  const list = wx.getStorageSync(BILL_KEY)
  const bills = Array.isArray(list) ? list : []
  const now = Date.now()

  if (record.id) {
    const index = bills.findIndex((bill) => bill.id === record.id)
    if (index === -1) {
      // id 不存在时按新增处理，保证不丢数据
      const created = Object.assign({}, record, { id: createId('bill'), createdAt: now, updatedAt: now })
      bills.push(created)
      saveBills(bills)
      return created
    }
    const updated = Object.assign({}, bills[index], record, { updatedAt: now })
    bills[index] = updated
    saveBills(bills)
    return updated
  }

  const created = Object.assign({}, record, { id: createId('bill'), createdAt: now, updatedAt: now })
  bills.push(created)
  saveBills(bills)
  return created
}

/** 删除单条账单 */
function removeBill(id) {
  const list = wx.getStorageSync(BILL_KEY)
  const bills = Array.isArray(list) ? list : []
  saveBills(bills.filter((bill) => bill.id !== id))
  return true
}

/** 清空全部账单（分类保留） */
function clearBills() {
  wx.setStorageSync(BILL_KEY, [])
  return true
}

/* ============================ 初始化 ============================ */

/** 应用启动时调用：保证分类表有内容 */
function initStorage() {
  const categories = getCategories()
  if (categories.length === 0) {
    saveCategories(
      DEFAULT_CATEGORY_NAMES.map((name) => ({
        id: createId('cat'),
        name,
        createdAt: Date.now()
      }))
    )
  } else {
    // 把迁移后的结构写回，避免每次读取都做转换
    saveCategories(categories)
  }
}

module.exports = {
  BILL_KEY,
  CATEGORY_KEY,
  DEFAULT_CATEGORY_NAMES,
  createId,
  initStorage,
  getCategories,
  saveCategories,
  addCategory,
  renameCategory,
  removeCategory,
  moveCategory,
  moveCategoryTo,
  setCategoryOrder,
  getUncategorized,
  getCategoryName,
  countBillsByCategory,
  getBills,
  saveBills,
  getBillById,
  upsertBill,
  removeBill,
  clearBills
}
