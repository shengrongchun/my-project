
/**
 * Expand input[v-model] with dyanmic type bindings into v-if-else chains
 * Turn this:
 *   <input v-model="data[type]" :type="type">
 * into this:
 *   <input v-if="type === 'checkbox'" type="checkbox" v-model="data[type]">
 *   <input v-else-if="type === 'radio'" type="radio" v-model="data[type]">
 *   <input v-else :type="type" v-model="data[type]">
 */
/**
 *为什么要处理input标签而且还必须定义v-model,并且type还要是绑定值？
 因为type是[checkbox,radio]的input标签是通过checked值来判断是否选中，而其他类型都是value
 所以对于v-model指令而言需要做相应的处理，比如添加属性和事件都不一样
 checkbox: 属性：checked，事件： change
 radio: 属性：checked，事件： change(与checkbox会有所不同)
 其他：属性：value，事件：change或者input或者blur等
 */
import {
  addRawAttr,
  getBindingAttr,
  getAndRemoveAttr,
  processFor,
  processElement,
  addIfCondition,
  createASTElement
} from '../../../compile/getAst/helper'

function preTransformNode (el, options) {
  if (el.tag === 'input') { // 可以看出这里是对input标签的v-model的处理
    const map = el.attrsMap
    if (!map['v-model']) {
      return
    }

    let typeBinding
    if (map[':type'] || map['v-bind:type']) { // 获取绑定type值
      typeBinding = getBindingAttr(el, 'type')
    }
    // 如果此时typeBinding是undefined,在未定义非绑定type的前提下并不能保证就没有绑定type值，这种写法v-bind="{ type: inputType }"我们也认为其绑定了
    if (!map.type && !typeBinding && map['v-bind']) {
      typeBinding = `(${map['v-bind']}).type`
    }

    if (typeBinding) { // 是input标签 有定义v-model并且type是绑定值
      const ifCondition = getAndRemoveAttr(el, 'v-if', true)
      const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``
      const hasElse = getAndRemoveAttr(el, 'v-else', true) != null
      const elseIfCondition = getAndRemoveAttr(el, 'v-else-if', true)
      // 1. checkbox
      const branch0 = cloneASTElement(el)
      // process for on the main node
      // processIf(branch0)// 由于上面已经处理过，无需再处理
      // processOnce(branch0)// v-once指令是只渲染一次，而这里的情况是无效的，不可能约定其只渲染一次
      processFor(branch0)
      addRawAttr(branch0, 'type', 'checkbox')
      processElement(branch0, options)
      branch0.processed = true // prevent it from double-processed（已经解析过）
      branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
      addIfCondition(branch0, {
        exp: branch0.if,
        block: branch0
      })
      // 2. add radio else-if condition
      const branch1 = cloneASTElement(el)
      /**
       * 将克隆出来的元素描述对象中的 v-for 属性移除掉，因为在复选按钮中已经使用 processFor 处理过了 v-for 指令，
       * 由于它们本是互斥的，其本质上等价于是同一个元素，只是根据不同的条件渲染不同的标签罢了，所以 v-for 指令处理一次就够了。
       */
      getAndRemoveAttr(branch1, 'v-for', true)
      addRawAttr(branch1, 'type', 'radio')
      processElement(branch1, options)
      addIfCondition(branch0, {
        exp: `(${typeBinding})==='radio'` + ifConditionExtra,
        block: branch1
      })
      // 3. other
      const branch2 = cloneASTElement(el)
      getAndRemoveAttr(branch2, 'v-for', true)
      addRawAttr(branch2, ':type', typeBinding)
      processElement(branch2, options)
      addIfCondition(branch0, {
        exp: ifCondition,
        block: branch2
      })
      if (hasElse) {
        branch0.else = true
      } else if (elseIfCondition) {
        branch0.elseif = elseIfCondition
      }
      return branch0
    }
  }
}

function cloneASTElement (el) { // 数组的 slice 方法复刻出一个新的 el.attrList 数组
  return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

export default {
  preTransformNode
}
