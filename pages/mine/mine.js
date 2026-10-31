/**
 * 我的
 * ------------------------------------------------------------------
 * 包含三块：
 *   1. 签到：每天 +1 积分，连续每满 7 天额外送 1 天会员（积分/会员权益暂定）
 *   2. 日历：每天日期下面用大红小字显示当天优惠总额，点日期进入当日账单
 *   3. 主题色：内置几种常见配色，选中后整站换色
 */
const store = require('../../utils/store')
const money = require('../../utils/money')
const dateUtil = require('../../utils/date')
const themeUtil = require('../../utils/theme')
const checkin = require('../../utils/checkin')

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    themeKey: 'green',
    themes: themeUtil.THEMES,

    /* 签到 */
    points: 0,
    streak: 0,
    checkedToday: false,
    memberLeft: 0,
    nextRewardDays: 7,

    /* 日历 */
    year: 0,
    month: 0,       // 1-12
    monthLabel: '',
    weekLabels: WEEK_LABELS,
    cells: [],      // 日历格子（含月初空白）
    monthDiscountText: '0.00'
  },

  onShow() {
    this.setData({ themeKey: themeUtil.getTheme().key })
    this.loadCheckin()
    if (!this.data.year) {
      const today = dateUtil.today().split('-')
      this.setData({ year: Number(today[0]), month: Number(today[1]) })
    }
    this.buildCalendar()
  },

  /* ==================== 签到 ==================== */

  loadCheckin() {
    const state = checkin.getState()
    this.setData({
      points: state.points,
      streak: state.streak,
      checkedToday: checkin.isCheckedToday(),
      memberLeft: checkin.memberLeftDays(state),
      nextRewardDays: checkin.daysToNextReward(state)
    })
  },

  onCheckIn() {
    const result = checkin.checkIn()
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadCheckin()
    wx.showModal({
      title: result.gainedMemberDays > 0 ? '连续 7 天，额外奖励会员' : '签到成功',
      content: result.gainedMemberDays > 0
        ? `+1 积分，连续签到 ${result.state.streak} 天，额外获得 1 天会员。`
        : `+1 积分，连续签到 ${result.state.streak} 天，累计 ${result.state.points} 积分。积分与会员权益正在筹备中，先攒着。`,
      showCancel: false,
      confirmText: '好的'
    })
  },

  /* ==================== 日历 ==================== */

  /** 上一个 / 下一个月 */
  onPrevMonth() {
    let { year, month } = this.data
    month -= 1
    if (month < 1) { month = 12; year -= 1 }
    this.setData({ year, month })
    this.buildCalendar()
  },

  onNextMonth() {
    let { year, month } = this.data
    month += 1
    if (month > 12) { month = 1; year += 1 }
    this.setData({ year, month })
    this.buildCalendar()
  },

  /**
   * 生成当月日历：先补月初空白格，再逐天算出当天优惠合计
   * 优惠金额用「大红」小两号字显示在日期数字下方
   */
  buildCalendar() {
    const { year, month } = this.data
    if (!year || !month) return

    const firstDay = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const leading = firstDay.getDay() // 0=周日

    // 当月每天的优惠合计（分）
    const discountMap = {}
    let monthDiscountCents = 0
    store.getBills().forEach((bill) => {
      const parts = String(bill.date || '').split('-')
      if (Number(parts[0]) !== year || Number(parts[1]) !== month) return
      const day = Number(parts[2])
      const cents = bill.discountCents || 0
      discountMap[day] = (discountMap[day] || 0) + cents
      monthDiscountCents += cents
    })

    const todayStr = dateUtil.today()
    const cells = []
    for (let i = 0; i < leading; i += 1) {
      cells.push({ key: `blank_${i}`, blank: true })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const cents = discountMap[day] || 0
      cells.push({
        key: date,
        blank: false,
        day,
        date,
        isToday: date === todayStr,
        discountText: cents > 0 ? money.format(cents) : '',
        hasDiscount: cents > 0
      })
    }

    this.setData({
      cells,
      monthLabel: `${year} 年 ${month} 月`,
      monthDiscountText: money.format(monthDiscountCents)
    })
  },

  /** 点日历某天 -> 当日账单 */
  onDayTap(e) {
    const { date } = e.currentTarget.dataset
    if (!date) return
    wx.navigateTo({ url: `/pages/day/day?date=${date}` })
  },

  /* ==================== 主题色 ==================== */

  onThemeSelect(e) {
    const key = e.currentTarget.dataset.key
    const theme = themeUtil.setTheme(key)
    this.setData({ themeKey: theme.key })
    wx.showToast({ title: `已切换为${theme.name}`, icon: 'none' })
  }
})
