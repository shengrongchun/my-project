
import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'// 数组劫持方法
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isObject,
  isPlainObject,
  isServerRendering
} from '../util/index'
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve = true

export function toggleObserving (value) { // 设置是否观测对象
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */

export class Observer {
  value;
  dep;
  vmCount; // number of vms that have this object as root $data

  constructor (value) { // value是数组或者对象，this为new Observer的实例
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0// 默认观测的对象vmCount=0（根data观测后vmCount++）
    def(value, '__ob__', this)// 被观测过的对象都会有__ob__属性= {value,dep,vmCount}
    if (Array.isArray(value)) { // 劫持数组方法并且对数组的每一项进行监听walk
      if (hasProto) { // 浏览器是否支持直接使用__proto__（隐式原型）
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target, src, keys) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value, asRootData) { // value:对象，asRootData标识是否是根data
  if (!isObject(value) || value instanceof VNode) { // 不会对基本数据类型或者vnode节点观测
    return
  }
  // 数组或者对象
  let ob// 当一个对象被观测后会定义__ob__属性 = {value, dep, vmCount}
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&// shouldObserve为true才会观测对象，隐藏的话就是可以自定义设置此属性，不能观测对象
    !isServerRendering() &&// 必须是非服务端渲染
    (Array.isArray(value) || isPlainObject(value)) &&// 必须是数组或纯对象
    Object.isExtensible(value) &&// 对象要可扩展，->可以增加新属性
    !value._isVue// 不能是vue实例
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.reactive
 * 开始对一个对象上的key进行响应式处理
 */
export function defineReactive (
  obj,
  key,
  val,
  customSetter, // 自定义的set函数
  shallow// 是否是浅观测，也就是说是否要响应子类
) {
  const dep = new Dep()
  // 方法返回 指定对象上一个自有属性对应的属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) { // 不能设置，无法劫持
    return
  }

  // cater for pre-defined getter/setters 缓存直接在Object.defineProperty中处理
  // 不影响原先定义的set/get方法
  const getter = property && property.get
  const setter = property && property.set
  // https://github.com/HcySunYang/vue-design/issues/113
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]// 没有第三个参数val,所以直接获取
  }
  // shallow没有明确定义为true都是要深度观测val
  let childOb = !shallow && observe(val)// __ob__
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */// 新旧值相等或者NAN
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return// (本来定义get没有定义set只能获取值不能设置值，所以直接return,顺应原本的设置)
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)// 观测新赋值
      dep.notify()
    }
  })
}

/**
 * Vue.prototype.$set -->vm.$set--> set
 target: 在target上设置值。key:设置值得key。val: 设置值得value
 注：target如果在data中定义（target.__ob__为true）则$set方法可以使没有在target中定义的key设置为响应式
 否则就是普通的设置值
 */
export function set (target, key, val) {
  // isUndef是判断target是不是等于undefined或者null。
  // isPrimitive是判断target的数据类型是不是string、number、symbol、boolean中的一种
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) { // target类型错误会发出警告
    warn(`Cannot set reactive property on undefined, null, or primitive value:${target}`)
  }
  // 如果target是数组类型并且key是有效数组index（target如果在data中定义则响应式否则简单设置值）
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)// 直接执行vue重写的数组方法splice（target在data中定义的情况下）,当然会响应式
    return val
  }
  // 对象
  // （target如果在data中定义则响应式否则简单设置值）
  // 这里为啥不使用hasOwnProperty而用in,请看https://github.com/vuejs/vue/issues/6845
  // key在target上或者target原型上，但不包括（Object.prototype）说明如果key在原型上，这个target不能是
  // 对象创建的如var target = {} 或者 var target = new Object()。而是通过函数或者类创建的
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = target.__ob__// target是否在data中定义
  if (target._isVue || (ob && ob.vmCount)) { // 如果是vue实例或者target是data(根data),发出警告
    // 如Vue.set(data, 'someProperty', 'someVal')
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) { // target未在data中定义，则简单设置值
    target[key] = val
    return val
  }
  // 以下几行是target在data中定义过，但key未在target中定义的情况的处理
  defineReactive(ob.value, key, val)// 定义响应式属性
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.注释可以看$set
 */
export function del (target, key) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target).__ob__// target是否在data中定义
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) { // target 不是响应的
    return
  }
  ob.dep.notify()// 触发更新
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
