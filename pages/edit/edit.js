/**
 * 记一笔 / 编辑账单
 * ------------------------------------------------------------------
 * 支持两种优惠方式：
 *   · 满减：总价 - 优惠 = 实付
 *   · 折扣：总价 × 折扣 = 实付（如 100 × 0.8 = 80，输入 8 表示 8 折）
 *
 * 三个金额「任意填两个，自动算出第三个」：
 *   · 满减：总价 / 优惠金额 / 实付
 *   · 折扣：总价 / 折扣（几折）/ 实付
 * 规则：你最后修改的字段 + 它之外最近动过的字段作为已知条件，
 *       第三个数自动填好。所以改优惠会立刻改实付，改实付会反推优惠。
 *
 * 分类下拉改为「分类面板」：点分类行打开面板，面板里可以直接拖动排序
 * （每行左侧 ⠿ 手柄）、新增分类、删除分类、点名称选用。
 * 排序结果写入 Storage，统计页分组顺序与记账下拉顺序会同步变化。
 */
const store = require('../../utils/store')
const money = require('../../utils/money')
const dateUtil = require('../../utils/date')
const theme = require('../../utils/theme')

/** 分类面板每行高度（px），用于计算拖拽后的落点索引 */
const SHEET_ITEM_PX = 56

Page({
  data: {
    id: '',
    isEdit: false,
    themeKey: 'green',

    date: '',

    /* 金额 */
    totalInput: '',
    discountType: 'minus',   // minus=满减，rate=折扣
    discountInput: '',
    rateInput: '',
    paidInput: '',
    previewText: '',

    /* 分类 */
    categoryId: '',
    categoryName: '请选择分类',
    categoryStale: false,

    /* 分类面板 */
    sheetVisible: false,
    sortList: [],
    sheetItemPx: SHEET_ITEM_PX,
    sheetAreaHeight: 0,
    draggingId: '',

    note: ''
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    // 从「当日账单」补记时会把日期带进来，默认仍取今天
    const today = (options && options.date) || dateUtil.today()
    const current = theme.getTheme()

    this.setData({ themeKey: current.key })

    if (id) {
      const bill = store.getBillById(id)
      if (!bill) {
        wx.showToast({ title: '账单不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 800)
        return
      }
      wx.setNavigationBarTitle({ title: '编辑账单' })

      const discountType = bill.discountType === 'rate' ? 'rate' : 'minus'
      this.setData({
        id,
        isEdit: true,
        date: bill.date || today,
        totalInput: money.format(bill.totalCents),
        discountType,
        discountInput: discountType === 'minus' ? money.format(bill.discountCents) : '',
        rateInput: discountType === 'rate' && bill.discountRate ? String(bill.discountRate) : '',
        paidInput: money.format(bill.paidCents),
        note: bill.note || ''
      })
      this.loadCategory(bill.categoryId, true)
    } else {
      wx.setNavigationBarTitle({ title: '记一笔' })
      this.setData({ date: today })
      this.loadCategory('', false)
    }

    this.updatePreview()
  },

  onShow() {
    theme.syncTabBar()
  },

  /* ==================== 分类 ==================== */

  /**
   * 读取当前分类并计算展示文案
   * @param {string} selectedId 选中的分类 id
   * @param {boolean} isExistingBill 是否在编辑已有账单（用于识别「原分类已删除」）
   */
  loadCategory(selectedId, isExistingBill) {
    const categories = store.getCategories()
    const found = categories.find((item) => item.id === selectedId)
    const stale = !!isExistingBill && !found

    if (found) {
      this.setData({ categoryId: found.id, categoryName: found.name, categoryStale: false })
      return
    }

    if (stale) {
      this.setData({ categoryId: '', categoryName: '未分类（请选择）', categoryStale: true })
      return
    }

    // 新增账单：默认第一个分类
    const first = categories[0]
    this.setData({
      categoryId: first ? first.id : '',
      categoryName: first ? first.name : '请选择分类',
      categoryStale: false
    })
  },

  /** 打开分类面板（可拖动排序） */
  openSheet() {
    this.buildSortList()
    this.setData({ sheetVisible: true })
  },

  closeSheet() {
    this.setData({ sheetVisible: false, draggingId: '' })
  },

  /** 依据当前分类顺序生成面板列表（y 为 movable-view 的像素偏移） */
  buildSortList() {
    const list = store.getCategories().map((item, index) => ({
      id: item.id,
      name: item.name,
      y: index * SHEET_ITEM_PX
    }))
    this.setData({
      sortList: list,
      sheetAreaHeight: list.length * SHEET_ITEM_PX
    })
  },

  onSortTouchStart(e) {
    this.setData({ draggingId: e.currentTarget.dataset.id })
  },

  /** 拖拽过程中记录实时位置（高频事件，放在 this 上避免频繁 setData） */
  onSortChange(e) {
    const id = e.currentTarget.dataset.id
    if (!this._dragPos) this._dragPos = {}
    this._dragPos[id] = e.detail.y
  },

  /** 松手后按最终位置换算目标索引并落库 */
  onSortTouchEnd(e) {
    const id = e.currentTarget.dataset.id
    const y = this._dragPos && typeof this._dragPos[id] === 'number' ? this._dragPos[id] : 0
    const ids = this.data.sortList.map((item) => item.id)
    const from = ids.indexOf(id)
    const to = Math.max(0, Math.min(ids.length - 1, Math.round(y / SHEET_ITEM_PX)))

    this.setData({ draggingId: '' })

    if (from < 0 || from === to) {
      this.buildSortList() // 归位
      return
    }

    const next = ids.slice()
    next.splice(from, 1)
    next.splice(to, 0, id)
    store.setCategoryOrder(next)
    this.buildSortList()
  },

  /** 面板里点分类名 -> 选用 */
  onSheetPick(e) {
    const id = e.currentTarget.dataset.id
    const found = store.getCategories().find((item) => item.id === id)
    if (!found) return
    this.setData({
      categoryId: found.id,
      categoryName: found.name,
      categoryStale: false,
      sheetVisible: false
    })
  },

  /** 面板里新增分类 */
  onSheetAdd() {
    wx.showModal({
      title: '新增分类',
      editable: true,
      placeholderText: '例如：宠物、房租、礼物',
      confirmText: '添加',
      success: (res) => {
        if (!res.confirm) return
        const result = store.addCategory(res.content)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.buildSortList()
        this.setData({
          categoryId: result.category.id,
          categoryName: result.category.name,
          categoryStale: false
        })
        wx.showToast({ title: '分类已添加', icon: 'success' })
      }
    })
  },

  /** 面板里删除分类：账单不会被删，只会变成未分类 */
  onSheetDelete(e) {
    const { id, name } = e.currentTarget.dataset
    const count = store.countBillsByCategory(id)
    const content = count > 0
      ? `「${name}」下有 ${count} 笔账单，删除分类后这些账单会转为「未分类」，账单本身不会被删除。`
      : `「${name}」下没有账单，删除后不可恢复。`

    wx.showModal({
      title: '删除分类？',
      content,
      confirmText: '删除',
      confirmColor: '#e5484d',
      success: (res) => {
        if (!res.confirm) return
        const result = store.removeCategory(id)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.buildSortList()
        // 当前选中的分类被删掉时，清空选择并提示重选
        if (this.data.categoryId === id) {
          this.setData({ categoryId: '', categoryName: '请选择分类', categoryStale: true })
        }
        wx.showToast({ title: result.message, icon: 'none' })
      }
    })
  },

  /* ==================== 金额联动 ==================== */

  onDateChange(e) {
    this.setData({ date: e.detail.value })
  },

  onTotalInput(e) {
    this.setData({ totalInput: e.detail.value })
    this.relink('total')
  },

  /**
   * 切换优惠方式：满减 <-> 折扣
   * ------------------------------------------------------------------
   * 切换时不预填数字（折扣框默认显示 0），但会把已填的金额换算过去：
   *   · 切到折扣：若总价、实付都有值 -> 反算出真实折扣（如 8 表示 8 折）
   *   · 切到满减：若总价、实付都有值 -> 反算出优惠金额
   * 只有确实能算出来才填，避免出现凭空的「8 折」。
   */
  onDiscountTypeChange(e) {
    const type = e.currentTarget.dataset.type === 'rate' ? 'rate' : 'minus'
    if (type === this.data.discountType) return

    const total = money.toCents(this.data.totalInput)
    const paid = money.toCents(this.data.paidInput)
    const patch = { discountType: type }

    if (type === 'rate') {
      // 反算折扣；算不出来就留空，让用户自己填（不会假装是 8 折）
      if (total > 0 && paid > 0) {
        const rate = Math.round((paid / total) * 10 * 100) / 100
        patch.rateInput = rate > 0 && rate <= 10 ? String(rate) : ''
      } else {
        patch.rateInput = ''
      }
    } else {
      if (total > 0) {
        patch.discountInput = money.format(Math.max(0, total - paid))
      } else {
        patch.discountInput = ''
      }
    }

    this.setData(patch)
    this.updatePreview()
  },

  onDiscountInput(e) {
    this.setData({ discountInput: e.detail.value })
    this.relink('discount')
  },

  onRateInput(e) {
    this.setData({ rateInput: e.detail.value })
    this.relink('rate')
  },

  /** 实付也可以手填：填完会反推优惠（满减算金额、折扣算几折） */
  onPaidInput(e) {
    this.setData({ paidInput: e.detail.value })
    this.relink('paid')
  },

  /* ==================== 三向联动 ==================== */

  /** 当前模式下的「优惠字段」名：满减是 discount，折扣是 rate */
  discountField() {
    return this.data.discountType === 'rate' ? 'rate' : 'discount'
  },

  /** 字段是否已填（空字符串视为没填） */
  hasField(field) {
    const d = this.data
    if (field === 'total') return d.totalInput !== ''
    if (field === 'discount') return d.discountInput !== ''
    if (field === 'rate') return d.rateInput !== ''
    return d.paidInput !== ''
  },

  /**
   * 输入联动：任意填两项，自动算出第三项
   * ------------------------------------------------------------------
   * 以「总价」为锚点（最稳定的值），规则如下：
   *   · 改了总价     -> 有优惠就重算实付，没优惠但有实付就重算优惠
   *   · 改了优惠     -> 有总价算实付，没有总价但填了实付就算总价
   *   · 改了实付     -> 有总价算优惠（反推金额或几折），没有总价但有优惠就算总价
   * 这样「改优惠立刻改实付」「改实付反推优惠」都符合直觉，总价不会莫名其妙被改掉。
   * @param {string} edited 刚编辑的字段：total / discount / rate / paid
   */
  relink(edited) {
    const discField = this.discountField()
    let pair = null

    if (edited === 'total') {
      if (this.hasField(discField)) pair = ['total', discField]
      else if (this.hasField('paid')) pair = ['total', 'paid']
    } else if (edited === discField) {
      if (this.hasField('total')) pair = ['total', discField]
      else if (this.hasField('paid')) pair = [discField, 'paid']
    } else {
      if (this.hasField('total')) pair = ['total', 'paid']
      else if (this.hasField(discField)) pair = [discField, 'paid']
    }

    if (!pair || !this.hasField(edited)) {
      this.updatePreview()
      return
    }

    const solved = this.solvePair(pair[0], pair[1])
    if (!solved) {
      this.updatePreview()
      return
    }

    const patch = {}
    patch[`${solved.field}Input`] = solved.text
    this.setData(patch, () => this.updatePreview())
  },

  /**
   * 已知两个金额字段，算出第三个
   * @param {string} a 字段名
   * @param {string} b 字段名
   * @returns {{field:string, text:string}|null}
   */
  solvePair(a, b) {
    const d = this.data
    const has = (name) => a === name || b === name

    if (d.discountType === 'rate') {
      const total = money.toCents(d.totalInput)
      const paid = money.toCents(d.paidInput)
      const rate = parseFloat(d.rateInput) || 0

      if (has('total') && has('rate')) {
        if (rate <= 0 || total <= 0) return null
        return { field: 'paid', text: money.format(Math.round((total * rate) / 10)) }
      }
      if (has('total') && has('paid')) {
        if (total <= 0) return null
        const value = Math.round((paid / total) * 10 * 100) / 100
        return { field: 'rate', text: value > 0 ? String(value) : '' }
      }
      if (has('rate') && has('paid')) {
        if (rate <= 0) return null
        return { field: 'total', text: money.format(Math.round((paid * 10) / rate)) }
      }
      return null
    }

    const total = money.toCents(d.totalInput)
    const discount = money.toCents(d.discountInput)
    const paid = money.toCents(d.paidInput)

    if (has('total') && has('discount')) {
      return { field: 'paid', text: money.format(Math.max(0, total - discount)) }
    }
    if (has('total') && has('paid')) {
      return { field: 'discount', text: money.format(Math.max(0, total - paid)) }
    }
    if (has('discount') && has('paid')) {
      return { field: 'total', text: money.format(discount + paid) }
    }
    return null
  },

  /**
   * 读取当前三个金额（单位：分）
   * 以「总价、实付」输入框为准，优惠金额由两者差值得到，保证保存的数据自洽
   */
  computeAmounts() {
    const totalCents = money.toCents(this.data.totalInput)
    const paidCents = Math.max(0, money.toCents(this.data.paidInput))
    return {
      totalCents,
      discountCents: Math.max(0, totalCents - paidCents),
      paidCents
    }
  },

  /** 底部实时算式预览 */
  updatePreview() {
    const { totalCents, discountCents, paidCents } = this.computeAmounts()
    const text = this.data.discountType === 'rate'
      ? `¥${money.format(totalCents)} × ${this.data.rateInput || 0}折 = ¥${money.format(paidCents)}`
      : `¥${money.format(totalCents)} - ¥${money.format(discountCents)} = ¥${money.format(paidCents)}`
    this.setData({ previewText: text })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  /* ==================== 保存 / 删除 ==================== */

  onSave() {
    const { date, categoryId, discountType } = this.data

    if (!date) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }

    const { totalCents, discountCents, paidCents } = this.computeAmounts()

    if (totalCents <= 0) {
      wx.showToast({ title: '请输入总价', icon: 'none' })
      return
    }
    if (discountCents < 0 || paidCents < 0) {
      wx.showToast({ title: '金额不能为负数', icon: 'none' })
      return
    }
    if (discountCents > totalCents) {
      wx.showToast({ title: '优惠不能大于总价', icon: 'none' })
      return
    }
    if (discountType === 'rate') {
      const rate = Number(this.data.rateInput)
      if (!(rate > 0 && rate < 10.01)) {
        wx.showToast({ title: '请输入 0.1 ~ 10 之间的折扣', icon: 'none' })
        return
      }
    }
    if (!categoryId) {
      wx.showToast({
        title: this.data.categoryStale ? '原分类已删除，请重新选择' : '请选择分类',
        icon: 'none'
      })
      return
    }

    store.upsertBill({
      id: this.data.id || undefined,
      date,
      totalCents,
      discountCents,
      paidCents,
      discountType,
      // 折扣单记下折算比例（如 8 表示 8 折），满减单留空
      discountRate: discountType === 'rate' ? Number(this.data.rateInput) : '',
      categoryId,
      note: (this.data.note || '').trim()
    })

    wx.showToast({ title: this.data.isEdit ? '已保存' : '已记录', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 600)
  },

  onDelete() {
    const { id, date, totalInput } = this.data
    if (!id) return
    wx.showModal({
      title: '删除这笔账单？',
      content: `${date} · ¥${totalInput}\n删除后不可恢复。`,
      confirmText: '删除',
      confirmColor: '#e5484d',
      success: (res) => {
        if (!res.confirm) return
        store.removeBill(id)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 600)
      }
    })
  },

  /** 面板遮罩点击：关闭 */
  onSheetMaskTap() {
    this.closeSheet()
  },

  /** 阻止面板内部点击冒泡到遮罩 */
  noop() {}
})
