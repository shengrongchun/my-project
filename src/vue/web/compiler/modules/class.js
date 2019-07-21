
import { parseText } from '../../../compile/getAst/parser'
import {
  getAndRemoveAttr,
  getBindingAttr,
  baseWarn
} from '../../../compile/getAst/helper'

function transformNode (el, options) {
  const warn = options.warn || baseWarn
  const staticClass = getAndRemoveAttr(el, 'class')// 获取静态class值
  if (process.env.NODE_ENV !== 'production' && staticClass) {
    const res = parseText(staticClass, options.delimiters)
    if (res) { // 非绑定的 class 属性中不能使用字面量表达式
      warn(
        `class="${staticClass}": ` +
        'Interpolation inside attributes has been removed. ' +
        'Use v-bind or the colon shorthand instead. For example, ' +
        'instead of <div class="{{ val }}">, use <div :class="val">.'
      )
    }
  }
  if (staticClass) { // 字符串化设置staticClass
    el.staticClass = JSON.stringify(staticClass)
  }
  const classBinding = getBindingAttr(el, 'class', false /* getStatic第三个参数的作用是在没有动态绑定值得情况下是否获取静态值 */)
  if (classBinding) { // 设置绑定的class值
    el.classBinding = classBinding
  }
}

function genData (el) {
  let data = ''
  if (el.staticClass) {
    data += `staticClass:${el.staticClass},`
  }
  if (el.classBinding) {
    data += `class:${el.classBinding},`
  }
  return data
}

export default {
  staticKeys: ['staticClass'],
  transformNode,
  genData
}
