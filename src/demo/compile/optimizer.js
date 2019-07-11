import { makeMap, isBuiltInTag, cached, no } from './getAst/helper'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
// 标记静态节点，在patch阶段可以完全跳过
/**
 * 一个node要是静态节点必须是自己本身是静态的，而且其子节点都要是静态的
 * 一个node是静态根除了满足上面所说的，还要满足自己有子节点，而且不能只是一个文本节点
 */
export function optimize (root, options) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root)// 检测其与其子节点的静态性
  // second pass: mark static roots.
  markStaticRoots(root, false)// 检测是否是静态根
}

function genStaticKeys (keys) {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
    (keys ? ',' + keys : '')
  )
}

function markStatic (node) {
  node.static = isStatic(node)// 判断自己本身是不是静态
  if (node.type === 1) { // 如果是标签还要判断一下children
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) { // 一旦子节点中有非静态节点，则父节点就为非静态节点
        node.static = false
      }
    }
    if (node.ifConditions) { // 如果有v-if,v-else等，则要判断可能替换的v-else的node的静态性
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

function markStaticRoots (node, isInFor) {
  if (node.type === 1) {
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    // 并不是静态特性的元素都会当做静态树处理，毕竟处理静态树是有代价的，所以子集只有一个并且是文本这样的简单静态树就不把他当做静态树
    // 如 <div>我是静态文本</div>
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

function isStatic (node) {
  if (node.type === 2) { // expression肯定不是静态
    return false
  }
  if (node.type === 3) { // text是静态
    return true
  }
  return !!(node.pre || (// 自己定义v-pre指令（slot定义的v-pre指令不会被标志）v-pre环境下定义的v-if,v-for等都不会标志
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in （slot,component）
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)// 所有的属性都是静态的 注意：template标签会有slotScope属性，所以其不是静态节点
  ))
}

function isDirectChildOfTemplateFor (node) {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
