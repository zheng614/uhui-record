/**
 * 筛选条组件
 * 全部 / 本月 / 上月 / 自定义起止日期
 * 组件内部只维护展示状态，真正的持久化由父页面处理（change 事件）。
 */
const dateUtil = require('../../utils/date')
const filterUtil = require('../../utils/filter')

Component({
  properties: {
    // 外部传入的筛选条件（父页面从 Storage 读取）
    value: {
      type: Object,
      value: { type: 'all', start: '', end: '' },
      observer(next) {
        if (!next || typeof next !== 'object') return
        const filter = Object.assign({}, filterUtil.DEFAULT_FILTER, next)
        this.setData({ filter })
      }
    }
  },

  data: {
    chips: [
      { key: 'all', text: '全部' },
      { key: 'thisMonth', text: '本月' },
      { key: 'lastMonth', text: '上月' },
      { key: 'custom', text: '自定义' }
    ],
    filter: { type: 'all', start: '', end: '' },
    today: dateUtil.today()
  },

  lifetimes: {
    // 首次挂载时同步一次外部传入的条件，避免初始 observer 未触发导致状态不一致
    attached() {
      const fromProp = this.properties.value || {}
      if (fromProp && typeof fromProp === 'object' && fromProp.type) {
        this.setData({ filter: Object.assign({}, filterUtil.DEFAULT_FILTER, fromProp) })
      }
    }
  },

  methods: {
    /** 点击快捷筛选 */
    onChipTap(e) {
      const key = e.currentTarget.dataset.key
      const next = Object.assign({}, this.data.filter, { type: key })

      // 首次切到「自定义」时给一个合理的默认区间（本月 1 日 ~ 今天）
      if (key === 'custom') {
        const range = dateUtil.monthRange(0)
        next.start = this.data.filter.start || range.start
        next.end = this.data.filter.end || dateUtil.today()
      }

      this.setData({ filter: next })
      this.emit()
    },

    /** 修改开始日期 */
    onStartChange(e) {
      const next = Object.assign({}, this.data.filter, { start: e.detail.value })
      if (next.end && next.start > next.end) {
        next.end = next.start
      }
      this.setData({ filter: next })
      this.emit()
    },

    /** 修改结束日期 */
    onEndChange(e) {
      const next = Object.assign({}, this.data.filter, { end: e.detail.value })
      if (next.start && next.end < next.start) {
        next.start = next.end
      }
      this.setData({ filter: next })
      this.emit()
    },

    emit() {
      this.triggerEvent('change', { filter: Object.assign({}, this.data.filter) })
    }
  }
})
