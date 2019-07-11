import modules from './modules/index'
import directives from './directives/index'
import {
  isPreTag,
  mustUseProp,
  getTagNamespace,
  isReservedTag,
  isUnaryTag,
  canBeLeftOpenTag,
  genStaticKeys
} from '../util'

export const baseOptions = {
  expectHTML: true,
  modules, // 前置、中置、后置处理（不同平台处理）
  directives, // v-model,v-text,v-html
  isPreTag, // 检查给定的标签是否是 pre 标签
  isUnaryTag, // 是否自闭合标签（一元标签）例如 <input />
  mustUseProp, // 用来检测一个属性在标签中是否要使用元素对象原生的 prop 进行绑定
  canBeLeftOpenTag, // 比如 p 标签是一个双标签，你需要这样使用 <p>Some content</p>，但是你依然可以省略闭合标签，直接这样写：<p>Some content，且浏览器会自动补全
  isReservedTag, // 检查给定的标签是否是保留的标签
  getTagNamespace, // 获取元素的命名空间
  staticKeys: genStaticKeys(modules) // 根据modules生成静态键字符串
  // optimize: true, // 优化ast  只要不明确定义optimize: false默认都会优化ast
}
