/**
 * 合计卡片组件
 * 展示「总价 / 优惠 / 实付」三项合计，所有数字加粗。
 */
const money = require('../../utils/money')

Component({
  properties: {
    // { count, totalCents, discountCents, paidCents }
    summary: {
      type: Object,
      value: { count: 0, totalCents: 0, discountCents: 0, paidCents: 0 },
      observer(next) {
        const data = next || {}
        this.setData({
          totalText: money.format(data.totalCents || 0),
          discountText: money.format(data.discountCents || 0),
          paidText: money.format(data.paidCents || 0),
          count: data.count || 0
        })
      }
    },
    // 右上角说明文字，例如「本月」
    caption: {
      type: String,
      value: ''
    }
  },

  data: {
    totalText: '0.00',
    discountText: '0.00',
    paidText: '0.00',
    count: 0
  },

  lifetimes: {
    attached() {
      const data = this.properties.summary || {}
      this.setData({
        totalText: money.format(data.totalCents || 0),
        discountText: money.format(data.discountCents || 0),
        paidText: money.format(data.paidCents || 0),
        count: data.count || 0
      })
    }
  }
})
