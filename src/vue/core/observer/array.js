/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */
// 自己定义相关数组方法，如果有的方法没有可以直接到Array.prototype上找，但这个就没有劫持效果了
import { def } from '../util/lang'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':// 往数组后放入元素
      case 'unshift':// 往数组前放元素，都会监听这些新放入的元素
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)// splice第三个参数是新增加的元素，如果有，就监听这些元素
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change通知改变
    ob.dep.notify()
    return result
  })
})
