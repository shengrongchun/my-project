import { parseHtml } from './parser'
import { init, root } from './helper'

//
export default function parse (template, options) {
  let { start, end, chars, comment, warn } = init(template, options)
  parseHtml(template, {
    expectHTML: options.expectHTML, // true
    isUnaryTag: options.isUnaryTag, // 判断一元标签的函数（不传就是no函数）
    canBeLeftOpenTag: options.canBeLeftOpenTag, // 是否可以省略闭合标签的函数（不传就是no函数）
    shouldKeepComment: options.comments, // 是否保留注释
    outputSourceRange: options.outputSourceRange, // 属性输出代码区间
    warn, // 警告函数
    start,
    end,
    chars,
    comment})
  return root// 返回ast
}
