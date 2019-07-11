/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del, observe } from '../observer/index'
import { ASSET_TYPES } from '../../shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue) {
  // config全局设置config对象里面的参数，而重新设置config对象是不被允许的，警告
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
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue
  /**
   * Vue.options = {
      components: {
        KeepAlive
      },
      directives: Object.create(null),
      filters: Object.create(null),
      _base: Vue
    }
   */
  extend(Vue.options.components, builtInComponents)
  initUse(Vue)// 添加use方法
  initMixin(Vue)// 添加mixin方法
  initExtend(Vue)// 添加extend方法
  initAssetRegisters(Vue)// Vue.component Vue.directive Vue.filter
}
