/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue) {
  Vue.use = function (plugin) {
    // 如果插件已经安装过，直接返回Vue
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }
    // additional parameters
    // 获取除了第一个参数的剩余参数，并把Vue放入参数数组的首位
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      // 执行install函数，参数为数组args,首个参数就是Vue
      plugin.install.apply(plugin, args)// 不改变插件的 this（这里的 this 还是指向插件对象本身）
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)// 不改变插件的 this（这里应该是指向window，在浏览器非严格模式下）
    }
    installedPlugins.push(plugin)// 数组和对象一样是引用
    return this
  }
}
