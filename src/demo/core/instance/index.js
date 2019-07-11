import { initMixin } from './init'
import { stateMixin } from './state'
import { eventsMixin } from './events'
import { renderMixin } from './render'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util'

function Vue (options) { // 原来Vue就是一个构造函数
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)// 添加_init方法，实例化后调用_init方法
stateMixin(Vue)// 添加 $set、$delete、$data、$props、$watch
eventsMixin(Vue)// $on $emit $off $once
lifecycleMixin(Vue)// _update、 $forceUpdate、$destory
renderMixin(Vue)// $nextTick、_update

export default Vue
