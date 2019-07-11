/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */
// 自己定义相关数组方法，如果有的方法没有可以直接到Array.prototype上找，但这个就没有劫持效果了
import { def } from '../util/index'

// 创建对象，对象的原型是数组的原型，所以继承了数组的原型方法
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
  const original = arrayProto[method]// 原始数组原型方法
  // def: 在arrayMethods对象上定义method方法值为mutator函数
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)// 执行原始原型上相应的方法，最后返回这个结果
    // 以下是额外的劫持处理操作
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
    // 新添加的元素需要添加响应式
    if (inserted) ob.observeArray(inserted)
    // notify change通知改变视图
    ob.dep.notify()
    return result
  })
})
