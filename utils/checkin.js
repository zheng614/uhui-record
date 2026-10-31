/**
 * 签到 / 积分 / 会员（暂定积分、会员权益，仅做记录与展示）
 * ------------------------------------------------------------------
 * 规则（按需求）：
 *   · 每天签到 +1 积分，连续两天就有 2 积分，依此类推；
 *   · 连续签到每满 7 天，额外送 1 天会员；
 *   · 断签（昨天没签）会重新累计连续天数，但历史积分不清零。
 *
 * 数据结构：
 *   { points, streak, lastDate:'YYYY-MM-DD', memberDays, memberExpire:'YYYY-MM-DD',
 *     history: ['YYYY-MM-DD', ...] }
 * memberExpire 为会员到期日（含当天），没有会员时为空串。
 */

const CHECKIN_KEY = 'uhui_checkin_v1'

const DAY_MS = 24 * 60 * 60 * 1000

/** 本地时区的 YYYY-MM-DD（避免用 toISOString 因时区错位） */
function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayStr() {
  return fmt(new Date())
}

/** 在某个 YYYY-MM-DD 上加减天数 */
function shiftDate(dateStr, days) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  date.setDate(date.getDate() + days)
  return fmt(date)
}

function getState() {
  const saved = wx.getStorageSync(CHECKIN_KEY)
  const state = saved && typeof saved === 'object' ? saved : {}
  return {
    points: Number(state.points) || 0,
    streak: Number(state.streak) || 0,
    lastDate: state.lastDate || '',
    memberDays: Number(state.memberDays) || 0,
    memberExpire: state.memberExpire || '',
    history: Array.isArray(state.history) ? state.history : []
  }
}

function saveState(state) {
  wx.setStorageSync(CHECKIN_KEY, state)
  return state
}

/** 今天是否已经签到过 */
function isCheckedToday() {
  return getState().lastDate === todayStr()
}

/**
 * 执行签到
 * @returns {{ok:boolean, message:string, state:object, gainedPoints:number, gainedMemberDays:number}}
 */
function checkIn() {
  const state = getState()
  const today = todayStr()

  if (state.lastDate === today) {
    return { ok: false, message: '今天已经签到过了', state, gainedPoints: 0, gainedMemberDays: 0 }
  }

  // 昨天签过 -> 连续天数 +1；否则从 1 重新开始
  const continued = state.lastDate === shiftDate(today, -1)
  state.streak = continued ? state.streak + 1 : 1
  state.lastDate = today
  state.points += 1
  state.history = state.history.concat(today).slice(-400)

  let gainedMemberDays = 0
  if (state.streak > 0 && state.streak % 7 === 0) {
    gainedMemberDays = 1
    state.memberDays += 1
    // 会员到期日：从今天（或原到期日，取较晚者）往后顺延一天
    const base = state.memberExpire && state.memberExpire > today ? state.memberExpire : today
    state.memberExpire = shiftDate(base, 1)
  }

  saveState(state)
  return {
    ok: true,
    message: gainedMemberDays > 0 ? `签到成功 +1 积分，连续 ${state.streak} 天，额外 +1 天会员` : '签到成功 +1 积分',
    state,
    gainedPoints: 1,
    gainedMemberDays
  }
}

/** 会员是否在有效期内 */
function isMember(state) {
  const s = state || getState()
  return !!s.memberExpire && s.memberExpire >= todayStr()
}

/** 会员剩余天数（含今天） */
function memberLeftDays(state) {
  const s = state || getState()
  if (!s.memberExpire || s.memberExpire < todayStr()) return 0
  const [y1, m1, d1] = s.memberExpire.split('-').map(Number)
  const [y2, m2, d2] = todayStr().split('-').map(Number)
  const end = new Date(y1, m1 - 1, d1).getTime()
  const start = new Date(y2, m2 - 1, d2).getTime()
  return Math.max(0, Math.round((end - start) / DAY_MS) + 1)
}

/** 距离下一次会员奖励还差几天（连续 7 天一轮） */
function daysToNextReward(state) {
  const s = state || getState()
  const streak = s.lastDate === todayStr() ? s.streak : s.lastDate === shiftDate(todayStr(), -1) ? s.streak : 0
  const mod = streak % 7
  return mod === 0 ? (streak === 0 ? 7 : 7) : 7 - mod
}

module.exports = {
  CHECKIN_KEY,
  todayStr,
  shiftDate,
  getState,
  saveState,
  isCheckedToday,
  checkIn,
  isMember,
  memberLeftDays,
  daysToNextReward
}
