import config from '../config'
import { mark, measure } from '../util/perf'
import { extend, mergeOptions, formatComponentName } from '../util'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'

let uid = 0

export function initMixin (Vue) { // 执行initMixin方法会在Vue原型上添加_init方法
  Vue.prototype._init = function (options) {
    const vm = this// Vue实例对象
    // a uid每个实例的唯一id,每次实例化一个Vue实例，实例的_uid值都会++
    vm._uid = uid++
    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }
    // a flag to avoid this being observed
    // 标记自己是Vue实例, 避免自己不会当做data一样被响应式检测
    vm._isVue = true
    // merge options
    // 自己创建的组件只走else
    if (options && options._isComponent) {
      // initInternalComponent(vm, options)
    } else { // vm.constructor 指向了vm构造对象的构造函数
      // 把构造函数上的options(如：directives、components、filters等基本的)
      // 和我们创建组件时传入的配置 options 进行了一个合并
      vm.$options = mergeOptions(
        /**
         * vm.constructor指向vm的构造函数，这里有两种情况:
         * 1:通过Vue函数创建--> function Vue(){}
         * 2: const Sub = Vue.extend();const s = new Sub()--> function Sub() {}
         */
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    vm._renderProxy = vm// 用_renderProxy代理一下自己
    // expose real self
    vm._self = vm
    // 做了一些生命周期的初始化工作，初始化了很多变量，最主要是设置了父子组件的引用关系，也就是设置了 `$parent` 和 `$children`的值
    initLifecycle(vm)
    initEvents(vm)// 注册事件，注意这里注册的不是自己的，而是父组件的。因为很明显父组件的监听器才会注册到孩子身上。
    initRender(vm)// 做一些 render 的准备工作，比如处理父子继承关系等，并没有真的开始 render
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    // `data`, `props`, `computed` 等都是在这里初始化的，常见的面试考点比如`Vue是如何实现数据响应化的` 答案就在这个函数中寻找
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// export function initInternalComponent (vm, options) {
//   const opts = vm.$options = Object.create(vm.constructor.options)
//   // doing this because it's faster than dynamic enumeration.
//   const parentVnode = options._parentVnode
//   opts.parent = options.parent
//   opts._parentVnode = parentVnode

//   const vnodeComponentOptions = parentVnode.componentOptions
//   opts.propsData = vnodeComponentOptions.propsData
//   opts._parentListeners = vnodeComponentOptions.listeners
//   opts._renderChildren = vnodeComponentOptions.children
//   opts._componentTag = vnodeComponentOptions.tag

//   if (options.render) {
//     opts.render = options.render
//     opts.staticRenderFns = options.staticRenderFns
//   }
// }

export function resolveConstructorOptions (Ctor) {
  // 详解https://segmentfault.com/a/1190000014587126
  /**
   * Vue.options 或者 Sub.options(可以查看Vue.extend源码)
   */
  let options = Ctor.options
  // 有super属性，说明Ctor是Vue.extend构建的 Sub 构造函数
  if (Ctor.super) {
    // 获取父类的options
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor) {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
