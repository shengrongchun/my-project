import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from './util/index'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

// 初始化全局api
initGlobalAPI(Vue)

// 添加常量，是否服务端渲染
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})
Vue.version = '__VERSION__'

export default Vue
