
import config from 'core/config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del, observe } from 'core/observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from 'core/components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from 'core/util/index'

export function initGlobalAPI (Vue) {
  // 我们可以通过设置Vue.config.xxx 来全局设置特性。当然你不能去设置config,如 Vue.config = xxx
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {// 官方文档没有说明这些api,所以能不用尽量不用
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = (obj) => {
    observe(obj)
    return obj
  }

  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => { // components、directives、filters初始化空对象
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  extend(Vue.options.components, builtInComponents) // 添加keep-alive组件{ keep-alive: {} }
  initUse(Vue)// 添加use方法
  initMixin(Vue)// 添加mixin方法
  initExtend(Vue)// 添加extend方法
  initAssetRegisters(Vue)// Vue.component Vue.directive Vue.filter
}
