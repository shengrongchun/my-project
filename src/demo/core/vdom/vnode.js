
export default class VNode {
  tag;
  data;
  children;
  text;
  elm;
  ns;
  context; // rendered in this component's scope
  key;
  componentOptions;
  componentInstance; // component instance
  parent; // component placeholder node

  // strictly internal
  raw; // contains raw HTML? (server only)
  isStatic; // hoisted static node
  isRootInsert; // necessary for enter transition check
  isComment; // empty comment placeholder?
  isCloned; // is a cloned node?
  isOnce; // is a v-once node?
  asyncFactory; // async component factory function
  asyncMeta;
  isAsyncPlaceholder;
  ssrContext;
  fnContext; // real context vm for functional nodes
  fnOptions; // for SSR caching
  devtoolsMeta; // used to store functional render context for devtools
  fnScopeId; // functional scope id support

  constructor (
    tag,
    data,
    children,
    text,
    elm,
    context,
    componentOptions,
    asyncFactory
  ) {
    this.tag = tag/* 当前节点的标签名 */
    this.data = data/* 当前节点对应的对象，包含了具体的一些数据信息，是一个VNodeData类型，可以参考VNodeData类型中的数据信息 */
    this.children = children/* 当前节点的子节点，是一个数组 */
    this.text = text/* 当前节点的文本 */
    this.elm = elm/* 当前虚拟节点对应的真实dom节点 */
    this.ns = undefined/* 当前节点的名字空间 */
    this.context = context/* 编译作用域 */
    this.fnContext = undefined/* 函数化组件作用域 */
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key /* 节点的key属性，被当作节点的标志，用以优化 */
    this.componentOptions = componentOptions/* 组件的option选项 */
    this.componentInstance = undefined/* 当前节点对应的组件的实例 */
    this.parent = undefined /* 当前节点的父节点 */
    this.raw = false/* 简而言之就是是否为原生HTML或只是普通文本，innerHTML的时候为true，textContent的时候为false */
    this.isStatic = false/* 静态节点标志 */
    this.isRootInsert = true/* 是否作为跟节点插入 */
    this.isComment = false/* 是否为注释节点 */
    this.isCloned = false/* 是否为克隆节点 */
    this.isOnce = false/* 是否有v-once指令 */
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child () {
    return this.componentInstance
  }
}

export const createEmptyVNode = (text = '') => { // 创建空节点
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

export function createTextVNode (val) { // 创建text节点
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
export function cloneVNode (vnode) { // 克隆节点
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true
  return cloned
}
