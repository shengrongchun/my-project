
import he from 'he'
import { parseText, parseFilters } from './parser'
import { genAssignmentCode } from './directives/model'
// eslint-disable-next-line
const inWeex = typeof WXEnvironment !== 'undefined' && !!WXEnvironment.platform
const inBrowser = typeof window !== 'undefined'
const UA = inBrowser && window.navigator.userAgent.toLowerCase()
const isIE = UA && /msie|trident/.test(UA)
const isEdge = UA && UA.indexOf('edge/') > 0
//
export let warn // 警告函数
let platformIsPreTag // 判断是否为pre标签函数
let platformMustUseProp // // 用来检测一个属性在标签中是否要使用元素对象原生的 prop 进行绑定的函数
let platformGetTagNamespace // 获取元素的命名空间
let maybeComponent // 此tag可能是个组件
let delimiters // 不传，默认{{}}这样使用。传数组['${','}']改变
let transforms
let preTransforms
let postTransforms
let preserveWhitespace
let whitespaceOption
let outputSourceRange
//
const stack = []
export let root // 返回的ast
let currentParent // 存放父节点
let inVPre = false // 是否处于v-pre的环境下，因为这样的环境下面的字符串都不需要解析了
let inPre = false // 是否处于pre的环境下，因为这样的环境下面的字符串都不需要解析了
// init
export function init (template, options) {
  warn = options.warn || baseWarn
  platformIsPreTag = options.isPreTag || no
  platformMustUseProp = options.mustUseProp || no
  platformGetTagNamespace = options.getTagNamespace || no
  const isReservedTag = options.isReservedTag || no // 判断是否已经被html定义的标签函数
  maybeComponent = (el) => !!el.component || !isReservedTag(el.tag)// 如果el上有定义component标识或者非html定义的标签，那么有可能是组件标签
  delimiters = options.delimiters
  preserveWhitespace = options.preserveWhitespace !== false// 是否保留空格,只要不等于false,就是保留空格
  whitespaceOption = options.whitespace
  outputSourceRange = options.outputSourceRange// 是否在element(ast)上设置代码的start和end的位置

  transforms = pluckModuleFunction(options.modules, 'transformNode')// 把modules中所有transformNode收集到数组中
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  // start主要是对element属性的相关处理
  function start (tagName, attrs, unary, start, end) {
    // 处理IE svg的bug 关于attrs
    let element = handleIeSvgBug(tagName, attrs)
    // 处理attrs的name,如果是动态的，发出警告（不允许属性也设置绑定）
    handleRawAttrsName(element, attrs, start, end)
    // 添加禁止标签标志如style、script
    handleIsForbiddenTag(element, tagName)
    // 前置处理：这里vue是对input标签type类型是动态绑定的时候的v-model的处理
    for (let i = 0; i < preTransforms.length; i++) {
      element = preTransforms[i](element, options) || element
    }
    // 判断是否是v-pre或者是pre环境下，会影响attrs的处理
    handleVpreAndPre(element)// v-pre
    if (inVPre) { // v-pre环境下
      processRawAttrs(element)// 在这样的环境下，属性全部当做原始属性处理
    } else if (!element.processed) { // processed标识当前元素是否已经被解析了（前置处理中element可能处理过）
      // structural directives
      processFor(element)// 对v-for指令的处理
      processIf(element)// 对v-if,v-else,v-els-if指令的处理,v-else,v-els-if的装入放在closeElement里面
      processOnce(element)// 对v-once指令的处理
      // processElement(element, options)之所以这个处理方法放在了closeElement是因为其里面用到了el.children
    }
    if (!root) {
      root = element// 整个过程这里只会赋值一次，所以root是根元素对象
      if (process.env.NODE_ENV !== 'production') {
        checkRootConstraints(root)// 非生产环境需要对root元素对象做检查,有问题发出警告
      }
    }
    /**
       * 每个ast对象都会有一个parent父级指向，我们把currentParent当做父级，设置父级是在closeElement方法中element.parent = currentParent。
       * 如果解析标签不是一元标签，把此解析标签赋值给父级标志currentParent = element并且入栈stack.push(element)。等到闭合标签的时候执行
       * end方法，重置currentParent = stack[stack.length - 2]，然后执行closeElement。似乎currentParent = element这步没什么用，其实不是
       * 如果是一元标签，他的父级就是上一个非一元标签，正好之前赋值了currentParent = element，如果一元标签直接closeElement(element)
       */
    if (!unary) { // 不是一元标签
      currentParent = element
      stack.push(element)// 入栈，然后再end的时候，stack[stack.length - 1]自己，然后stack[stack.length - 2]是parent
    } else {
      /**
       * 一元标签，currentParent就是父类,其没有结束标签所以应该直接end()
       * 但目前已经知道currentParent就是父类，所以直接closeElement()就行
       */
      closeElement(element, options)
    }
  }
  function end (tagName, start, end) {
    const element = stack[stack.length - 1]
    // pop stack
    stack.length -= 1
    currentParent = stack[stack.length - 1]
    if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
      element.end = end
    }
    closeElement(element, options)
  }
  function chars (text, start, end) { // text为空字符串不会执行chars方法
    if (!currentParent) {
      /**
         * 试想一下有文本节点，但是文本节点没有父节点，什么情况下会是这样？
         * 1.模板中只有文本节点 <template>我是文本节点</template>
         * 2.文本节点在根元素的外面 <template>
                                  <div>根元素内的文本节点</div>根元素外的文本节点
                                 </template>
         */
      if (process.env.NODE_ENV !== 'production') {
        if (text === template) { // 模板中只有文本节点
          warnOnce(
            'Component template requires a root element, rather than just text.',
            { start }
          )
        } else if ((text = text.trim())) { // 文本节点在根元素的外面,文本节点将会忽略
          warnOnce(
            `text "${text}" outside root element will be ignored.`,
            { start }
          )
        }
      }
      return
    }
    /**
       * 只有当 <textarea> 标签没有真实文本内容时才存在这个 bug
       * 因为在ie环境下获取template：<div id="box">
                                    <textarea placeholder="some placeholder"></textarea>
                                  </div>
        会得到如：<div id="box">
                  <textarea placeholder="some placeholder">some placeholder</textarea>
                </div>
      /* istanbul ignore if */
    if (isIE && currentParent.tag === 'textarea' && currentParent.attrsMap.placeholder === text) { return }
    const children = currentParent.children
    if (inPre || text.trim()) { // pre环境下或者text非空白。注意text.trim()不改变text
      /**
       * 我们通常会使用 <pre> 标签展示源码，所以通常会书写 html 实体，假如不对如上 html 实体进行解码，
       * 那么最终展示在页面上的内容就是字符串 '&lt;div&gt;我是一个DIV&lt;/div&gt;' 而非 '<div>我是一个DIV</div>'，
       * 这是因为 Vue 在创建文本节点时使用的是 document.createTextNode 函数，这不同于将如上模板直接交给浏览器解析并渲染，
       * 所以需要解码后将字符串 '<div>我是一个DIV</div>' 作为一个文本节点创建才行
       * script或者style标签环境下不解码，直接输出text
       */
      text = isTextTag(currentParent) ? text : decodeHTMLCached(text)
    } else if (!children.length) { // 非pre环境，空白符，而且是开始标签第一个空白符（!children.length）
      // 把空白符设置为空字符串,如<span> </span> --> <span></span>
      text = ''
    } else if (whitespaceOption) { // 非pre环境，空白符（如果有对空白符特殊的处理）
      if (whitespaceOption === 'condense') { // condense模式的处理
        // in condense mode, remove the whitespace node if it contains
        // line break, otherwise condense to a single space
        // 匹配换行
        const lineBreakRE = /[\r\n]/
        text = lineBreakRE.test(text) ? '' : ' '
      } else { // 非condense模式都设置为一个空格
        text = ' '
      }
    } else { // 非pre环境，空白符（在whitespaceOption为false的情况下，判断preserveWhitespace是否保留空白）
      text = preserveWhitespace ? ' ' : ''
    }
    if (text) { // text.trim()后非空白符
      if (whitespaceOption === 'condense') {
        // condense consecutive whitespaces into single space
        // 空白
        const whitespaceRE = /\s+/g
        text = text.replace(whitespaceRE, ' ')// 空白用单一空格替代
      }
      let res
      let child
      if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) { // 非pre环境，非空格，有res,说明text中有{{}}
        child = {
          type: 2, // 非普通文本
          expression: res.expression,
          tokens: res.tokens,
          text
        }
      } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') { // 普通文本
        child = {
          type: 3, // 纯文本
          text
        }
      }
      if (child) {
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          child.start = start
          child.end = end
        }
        children.push(child)
      }
    }
  }
  function comment (text, start, end) {
    // adding anyting as a sibling to the root node is forbidden
    // comments should still be allowed, but ignored
    if (currentParent) {
      const child = {
        type: 3,
        text,
        isComment: true
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        child.start = start
        child.end = end
      }
      currentParent.children.push(child)
    }
  }
  //
  return {start, end, chars, comment, warn}
}
/**
 * 以下是辅助方法
 */
// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el) { // 文本标签
  return el.tag === 'script' || el.tag === 'style'
}
// decodeHTMLCached 函数在后面将被用于对纯文本的解码，如果不进行解码，那么用户将无法使用字符实体编写字符
// 由于字符实体 &#x26; 代表的字符为 &。所以字符串 &#x26; 经过解码后将变为字符 &
const decodeHTMLCached = cached(he.decode)
// eslint-disable-next-line
export function baseWarn (msg, range) {
  console.error(`[Vue compiler]: ${msg}`)
}
/**
 * Mix properties into target object.
 */
export function extend (to, _from) {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}
// 返回false函数
export const no = (a, b, c) => false
/* 把模块中每个对象中key的值放入一个新的数组中返回
 filter是过滤掉数组中undefined 如[transformNode,transformNode,undefined]-->[transformNode,transformNode]
*/
export function pluckModuleFunction (modules, key) {
  return modules
    ? modules.map(m => m[key]).filter(_ => _)
    : []
}
/**
 * 为啥需要ns(命名空间)?因为要解决IE上svg类型标签的一个bug
 * 如 <svg类型标签 xmlns:hello="http://www.hellobike.com"></svg类型标签>会被IE渲染为
 * <svg类型标签 xmlns:NS1="" NS1:xmlns:hello="http://www.hellobike.com"></svg类型标签>
 * 多出来了'xmlns:NS1="" NS1:'应该把它替换为''。我们需要知道这是一个svg类型标签或者包含在svg类型标签里的标签才会对其处理。
 * 而svg类型标签我们通过platformGetTagNamespace方法返回'svg'来判断
 *  */
/* ie环境svg命名空间会把
 <svg xmlns:feature="http://www.openplans.org/topp"></svg>渲染为
 <svg xmlns:NS1="" NS1:xmlns:feature="http://www.openplans.org/topp"></svg>
 标签中多了 'xmlns:NS1="" NS1:' 这段字符串
*/
function handleIeSvgBug (tag, attrs) {
  const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)
  // handle IE svg bug
  /* istanbul ignore if */
  if (isIE && ns === 'svg') { // 如果是ie环境，svg类型标签处理bug
    attrs = guardIESVGBug(attrs)
  }
  let element = createASTElement(tag, attrs, currentParent)
  if (ns) { // 加上命名空间标识
    element.ns = ns
  }
  return element
}
//
const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}
// 创建AST元素
export function createASTElement (tag, attrs, parent) {
  return {
    type: 1, // 1:标签 2: 有表达式文本 3: 纯文本
    tag,
    attrsList: attrs, // 属性列表
    attrsMap: makeAttrsMap(attrs), // 属性转成key value的map形式
    rawAttrsMap: {}, // 原生属性
    parent, // 父类
    children: []// 子类
  }
}
function makeAttrsMap (attrs) {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
        map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name, attrs[i])
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}
/**
 *无效属性(不合规定的属性规则)
 */
// eslint-disable-next-line
const invalidAttributeRE = /[\s"'<>\/=]/
function handleRawAttrsName (element, attrs, start, end) {
  if (process.env.NODE_ENV !== 'production') {
    //
    if (outputSourceRange) {
      element.start = start
      element.end = end
      element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => {
        cumulated[attr.name] = attr
        return cumulated
      }, {})
    }
    attrs.forEach(attr => {
      if (invalidAttributeRE.test(attr.name)) {
        warn(
          `Invalid dynamic argument expression: attribute names cannot contain ` +
            `spaces, quotes, <, >, / or =.`,
          {
            start: attr.start + attr.name.indexOf(`[`),
            end: attr.start + attr.name.length
          }
        )
      }
    })
  }
}
/**
 * 如果是禁止标签并且在非服务端渲染，添加forbidden标志，发出警告
 * 详情请看isForbiddenTag方法
 */
function handleIsForbiddenTag (element, tag) {
  if (isForbiddenTag(element) && !isServerRendering()) {
    element.forbidden = true
    process.env.NODE_ENV !== 'production' && warn(
      'Templates should only be responsible for mapping the state to the ' +
        'UI. Avoid placing tags with side-effects in your templates, such as ' +
        `<${tag}>` + ', as they will not be parsed.',
      { start: element.start }
    )
  }
}
/* 判断是否是禁止标签，vue的html是渲染UI的，不希望html中会出现一些副作用的代码如js,css
所以标签style和script是禁止的。但vue中定义如下是允许的。所以script type="text/x-template"并不是当做禁止标签
<script type="text/x-template">
  <p>Hello bike</p>
</script>
*/
function isForbiddenTag (el) {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}
// this needs to be lazy-evaled because vue may be required before
// vue-server-renderer can set VUE_ENV
let _isServer
const isServerRendering = () => {
  // global，nodejs的属性，当在nodejs中引入vue的时候会设置global['process'].env.VUE_ENV === 'server'
  if (_isServer === undefined) {
    /* istanbul ignore if */
    if (!inBrowser && !inWeex && typeof global !== 'undefined') {
      // detect presence of vue-server-renderer and avoid
      // Webpack shimming the process
      _isServer = global['process'] && global['process'].env.VUE_ENV === 'server'
    } else {
      _isServer = false
    }
  }
  return _isServer
}
/**
 *
 */
function handleVpreAndPre (element) {
  if (!inVPre) { // 目前不处于v-pre环境下
    processPre(element)// 判断element是否有v-pre属性
    if (element.pre) { // v-pre环境下
      inVPre = true// 设置标志v-pre环境下
    }
  }
  if (platformIsPreTag(element.tag)) { // tag为pre
    inPre = true// 处于pre环境
  }
}
/**
 * 删掉el的v-pre属性，并设置el.pre = true
 */
function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true// 说明el中是有v-pre属性
  }
}
// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
/**
 * 删除el元素对象中attrsList中属性名字为name的属性。removeFromMap为true会删除 el.attrsMap中属性名字为name的属性
 * 返回值是 el.attrsMap[name]
 */
export function getAndRemoveAttr (el, name, removeFromMap) {
  let val
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  return val
}
/**
   * 处理原生属性，把属性的value处理成原生属性的值需要字符串化
   * 原生属性他的值value,必然就是字符串类型如value="abc",abc就是字符串值，不会去找this.abc
   * 原生属性放在el.attrs中
   */
function processRawAttrs (el) {
  const list = el.attrsList
  const len = list.length
  if (len) {
    const attrs = el.attrs = new Array(len)
    for (let i = 0; i < len; i++) {
      attrs[i] = {
        name: list[i].name,
        value: JSON.stringify(list[i].value)// value值应始终是字符串类型
      }
      if (list[i].start != null) {
        attrs[i].start = list[i].start
        attrs[i].end = list[i].end
      }
    }
  } else if (!el.pre) {
    /* 自己没有任何属性len=0，并且自己也没有v-pre属性，但自己处于v-pre环境下，所以自己是个纯元素对象如下面的span
          <div v-pre>
            <span></span>
          </div>
          */
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}
/**
 * 对v-for指令的处理
 */
export function processFor (el) {
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    const res = parseFor(exp)
    if (res) { // {for,alias,iterator1,iterator2}
      extend(el, res)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(
        `Invalid v-for expression: ${exp}`,
        el.rawAttrsMap['v-for']
      )
    }
  }
}
/**
 * 捕获 in 或者 of前后的字符串如'obj of list'-->["obj in list", "obj", "list"]
 */
const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
// 匹配左右括号 （）
const stripParensRE = /^\(|\)$/g
/**
  * 捕获'(obj,index) in list'-->[",index) in list","index) in list"]
  */
// eslint-disable-next-line
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
/**
 * return {for: list, alias: obj,iterator1: key,iterator2: index}
 */
function parseFor (exp) { // 如果exp:(obj,key,index) in list
  const inMatch = exp.match(forAliasRE)// ["(obj,key,index) in list", "(obj,key,index)", "list"]
  if (!inMatch) return
  const res = {}
  res.for = inMatch[2].trim()// list
  const alias = inMatch[1].trim().replace(stripParensRE, '')// obj,key,index
  const iteratorMatch = alias.match(forIteratorRE)// [",key,index", "key", "index"]
  if (iteratorMatch) {
    res.alias = alias.replace(forIteratorRE, '').trim()// obj
    res.iterator1 = iteratorMatch[1].trim()// key
    if (iteratorMatch[2]) {
      res.iterator2 = iteratorMatch[2].trim()// index
    }
  } else {
    res.alias = alias
  }
  return res
}
/**
 *处理v-if,v-else,v-else-if
 */
function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    // 可以看到与 v-if 指令的判断条件不同，这里是将属性值与 null 作比较，这说明使用 v-else 指令时即使不写属性值
    // 那么也会当做使用了 v-else 指令，很显然 v-else 指令根本就不需要属性值。
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) { // elseif值为 elseif的属性值
      el.elseif = elseif
    }
  }
}
// 加入ifConditions
export function addIfCondition (el, condition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}
// v-once属性标识
function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) { // 为null说明 没有v-once属性
    el.once = true
  }
}
/**
 * 根元素需要杜绝任何情况会变成多个元素出来
 * 如含有v-for、slot、template
*/
function checkRootConstraints (el) {
  if (el.tag === 'slot' || el.tag === 'template') {
    warnOnce(
      `Cannot use <${el.tag}> as component root element because it may ` +
          'contain multiple nodes.',
      { start: el.start }
    )
  }
  if (el.attrsMap.hasOwnProperty('v-for')) {
    warnOnce(
      'Cannot use v-for on stateful component root element because ' +
          'it renders multiple elements.',
      el.rawAttrsMap['v-for']
    )
  }
}
// 此函数只会执行一次
let warned = false
function warnOnce (msg, range) {
  if (!warned) {
    warned = true
    warn(msg, range)
  }
}
/**
 * 闭合标签的处理
 */
function closeElement (element, options) { // 闭合标签
  trimEndingWhitespace(element)// 删除元素孩子节点里面空白节点
  if (!inVPre && !element.processed) { // 如果在非v-pre环境下并且element未被解析过
    element = processElement(element, options)
  }
  // tree management
  if (!stack.length && element !== root) { // 栈为空，并且element不等于root,说明root与element是平级的关系
    // allow root elements with v-if, v-else-if and v-else
    if (root.if && (element.elseif || element.else)) {
      if (process.env.NODE_ENV !== 'production') {
        checkRootConstraints(element)
      }
      addIfCondition(root, {
        exp: element.elseif,
        block: element
      })
    } else if (process.env.NODE_ENV !== 'production') { // 以上条件不满足，这时候就会出现多个根元素
      warnOnce(
        `Component template should contain exactly one root element. ` +
          `If you are using v-if on multiple elements, ` +
          `use v-else-if to chain them instead.`,
        { start: element.start }
      )
    }
  }
  // 处理v-else-if、v-else、slotScope的装入
  if (currentParent && !element.forbidden) { // 有父级并且不是禁止标签
    // 如果一个标签使用 v-else-if 或 v-else 指令，那么该元素的描述对象实际上会被添加到
    // 对应的 v-if 元素描述对象的 ifConditions 数组中，而非作为一个独立的子节点
    if (element.elseif || element.else) {
      processIfConditions(element, currentParent)
    } else {
      // 对于使用了 slot-scope 特性的元素来讲它们将被添加到父级元素描述对象的 scopedSlots 对象下
      // 按说是不需要push到currentParent.children中的，但如果element有v-if,为了下一个元素 v-else(-if)可以寻找到v-if
      // 在之后的代码中会清除掉有slotScope的元素
      if (element.slotScope) {
        // scoped slot
        // keep it in the children list so that v-else(-if) conditions can
        // find it as the prev node.
        const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
      }
      currentParent.children.push(element)// 把自己装入父级的children
      element.parent = currentParent// 设置父级
    }
  }

  // 以下是情理和初始化工作
  // final children cleanup
  // filter out scoped slots清除掉children有slotScope的元素
  element.children = element.children.filter(c => !c.slotScope)
  // remove trailing whitespace node again
  trimEndingWhitespace(element)

  // check pre state，结束标签，初始化pre环境
  if (element.pre) {
    inVPre = false
  }
  if (platformIsPreTag(element.tag)) {
    inPre = false
  }
  // apply post-transforms,现在并未做任何处理，保留以后用
  for (let i = 0; i < postTransforms.length; i++) {
    postTransforms[i](element, options)
  }
}
function trimEndingWhitespace (el) {
  // remove trailing whitespace node
  if (!inPre) {
    let lastNode
    while (
      (lastNode = el.children[el.children.length - 1]) &&
        lastNode.type === 3 &&
        lastNode.text === ' '
    ) { // 纯空格文本
      el.children.pop()
    }
  }
}
export function processElement (element, options) {
  processKey(element)// 处理key
  // determine whether this is a plain element after
  // removing structural attributes是否为纯元素对象
  element.plain = (
    !element.key &&
      !element.scopedSlots &&
      !element.attrsList.length
  )
  processRef(element)// 处理ref
  processSlotContent(element)// slot,slot-scope,scope
  processSlotOutlet(element)// <slot/>
  processComponent(element) // is
  for (let i = 0; i < transforms.length; i++) { // 对class和style的处理
    element = transforms[i](element, options) || element
  }
  processAttrs(element)
  return element
}
function processKey (el) { // 处理key
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (process.env.NODE_ENV !== 'production') {
      if (el.tag === 'template') {
        warn(
          `<template> cannot be keyed. Place the key on real elements instead.`,
          getRawBindingAttr(el, 'key')
        )
      }
      if (el.for) {
        const iterator = el.iterator2 || el.iterator1
        const parent = el.parent
        if (iterator && iterator === exp && parent && parent.tag === 'transition-group') {
          warn(
            `Do not use v-for index as key on <transition-group> children, ` +
              `this is the same as not using keys.`,
            getRawBindingAttr(el, 'key'),
            true /* tip */
          )
        }
      }
    }
    el.key = exp
  }
}
/**
   * 获取属性绑定值，优先获取动态(v-bind、:)绑定值，如果没有定义，则通过判断getStatic
   * 是否获取静态值
   * @param {*} getStatic 是否静态获取key的值,注意，只有明确定义getStatic为false,才不会获取静态值（如果动态值为null的话）
   */
export function getBindingAttr (el, name, getStatic) { // getStatic没有是undefined
  const dynamicValue =
          getAndRemoveAttr(el, ':' + name) ||
          getAndRemoveAttr(el, 'v-bind:' + name)
  if (dynamicValue != null) {
    return parseFilters(dynamicValue)// 绑定值得话会处理filters
  } else if (getStatic !== false) {
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      return JSON.stringify(staticValue)// 注意new Function(字符串)
    }
  }
}
// 获取原始属性值
function getRawBindingAttr (el, name) {
  return el.rawAttrsMap[':' + name] ||
      el.rawAttrsMap['v-bind:' + name] ||
      el.rawAttrsMap[name]
}
function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    el.refInFor = checkInFor(el)// 判断是否在v-for环境下
  }
}
function checkInFor (el) {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}
const slotRE = /^v-slot(:|$)|^#/
export const emptySlotScopeToken = `_empty_`
// handle content being passed to a component as slot,
// e.g. <template slot="xxx">, <div slot-scope="xxx">
function processSlotContent (el) { // slotScope作用域
  let slotScope// scope和slot-scope作用域都是不支持动态绑定，感觉没什么必要
  if (el.tag === 'template') {
    slotScope = getAndRemoveAttr(el, 'scope')
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && slotScope) {
      warn(
        `the "scope" attribute for scoped slots have been deprecated and ` +
        `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
        `can also be used on plain elements in addition to <template> to ` +
        `denote scoped slots.`,
        el.rawAttrsMap['scope'],
        true
      )
    }
    el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
  } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
      /**
       * <div slot-scope="props" v-for="item of props.list"></div>
       * 现在这个props到底是子组件传来的还是父组件实例上定义的呢？一般情况下是子组件传来的，因为slot-scope
       * 的优先级高，但v-for的优先级更高，所以这里props.list是父组件实例上定义的，为了不产生歧义，这里给出警告
       * <template slot-scope="props">
          <div v-for="item of props.list"></div>
        </template>这样写，props就是子组件传来的了
       */
      warn(
        `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
        `(v-for takes higher priority). Use a wrapper <template> for the ` +
        `scoped slot to make it clearer.`,
        el.rawAttrsMap['slot-scope'],
        true
      )
    }
    el.slotScope = slotScope
  }

  // slot="xxx"
  const slotTarget = getBindingAttr(el, 'slot')
  if (slotTarget) {
    el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget// slot的具名
    el.slotTargetDynamic = !!(el.attrsMap[':slot'] || el.attrsMap['v-bind:slot'])// 是否是绑定值
    // preserve slot as an attribute for native shadow DOM compat
    // only for non-scoped slots.
    if (el.tag !== 'template' && !el.slotScope) { // 保留原生 slot 属性
      addAttr(el, 'slot', slotTarget, getRawBindingAttr(el, 'slot'))
    }
  }

  // 2.6 v-slot
  if (process.env.NEW_SLOT_SYNTAX) {
    if (el.tag === 'template') {
      // v-slot on <template>
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE)
      if (slotBinding) {
        if (process.env.NODE_ENV !== 'production') {
          if (el.slotTarget || el.slotScope) {
            warn(
              `Unexpected mixed usage of different slot syntaxes.`,
              el
            )
          }
          if (el.parent && !maybeComponent(el.parent)) {
            warn(
              `<template v-slot> can only appear at the root level inside ` +
              `the receiving the component`,
              el
            )
          }
        }
        const { name, dynamic } = getSlotName(slotBinding)
        el.slotTarget = name
        el.slotTargetDynamic = dynamic
        el.slotScope = slotBinding.value || emptySlotScopeToken // force it into a scoped slot for perf
      }
    } else {
      // v-slot on component, denotes default slot
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE)
      if (slotBinding) {
        if (process.env.NODE_ENV !== 'production') {
          if (!maybeComponent(el)) {
            warn(
              `v-slot can only be used on components or <template>.`,
              slotBinding
            )
          }
          if (el.slotScope || el.slotTarget) {
            warn(
              `Unexpected mixed usage of different slot syntaxes.`,
              el
            )
          }
          if (el.scopedSlots) {
            warn(
              `To avoid scope ambiguity, the default slot should also use ` +
              `<template> syntax when there are other named slots.`,
              slotBinding
            )
          }
        }
        // add the component's children to its default slot
        const slots = el.scopedSlots || (el.scopedSlots = {})
        const { name, dynamic } = getSlotName(slotBinding)
        const slotContainer = slots[name] = createASTElement('template', [], el)
        slotContainer.slotTarget = name
        slotContainer.slotTargetDynamic = dynamic
        slotContainer.children = el.children.filter((c) => {
          if (!c.slotScope) {
            c.parent = slotContainer
            return true
          }
        })
        slotContainer.slotScope = slotBinding.value || emptySlotScopeToken
        // remove children as they are returned from scopedSlots now
        el.children = []
        // mark el non-plain so data gets generated
        el.plain = false
      }
    }
  }
}
function addAttr (el, name, value, range, dynamic) {
  const attrs = dynamic
    ? (el.dynamicAttrs || (el.dynamicAttrs = []))
    : (el.attrs || (el.attrs = []))
  attrs.push(rangeSetItem({ name, value, dynamic }, range))
  el.plain = false
}
// range: {start,end}
function rangeSetItem (item, range) {
  if (range) {
    if (range.start != null) {
      item.start = range.start
    }
    if (range.end != null) {
      item.end = range.end
    }
  }
  return item
}
// handle <slot/> outlets
function processSlotOutlet (el) {
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name')
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`,
        getRawBindingAttr(el, 'key')
      )
    }
  }
}
function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}
/**
 * 它用来匹配以字符 v- 或 @ 或 : 开头的字符串，主要作用是检测标签属性名是否是指令。
 * 所以通过这个正则我们可以知道，在 vue 中所有以 v- 开头的属性都被认为是指令，
 * 另外 @ 字符是 v-on 的缩写，: 字符是 v-bind 的缩写
 */
const dirRE = process.env.VBIND_PROP_SHORTHAND
  ? /^v-|^@|^:|^\./
  : /^v-|^@|^:/
// 解析修饰符的click.stop-->.stop
const modifierRE = /\.[^.\]]+(?=[^\]]*$)/g
const propBindRE = /^\./
// 匹配以以字符 : 或字符串 v-bind: 开头的字符串，主要用来检测一个标签的属性是否是绑定(v-bind)。
const bindRE = /^:|^\.|^v-bind:/
// 匹配左右中括号 []
const dynamicArgRE = /^\[.*\]$/
// 匹配以字符 @ 或 v-on: 开头的字符串，主要作用是检测标签属性名是否是监听事件的指令。
const onRE = /^@|^v-on:/
// 捕获指令上的参数或者修饰符 v-on:click.stop-->[":click.stop", "click.stop"]
const argRE = /:(.*)$/
function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, syncGen, isDynamic
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name// 属性名称如 v-bind:xxx
    value = list[i].value// 属性值
    if (dirRE.test(name)) { // 是指令
      // mark element as dynamic
      el.hasBindings = true
      // modifiers获取修饰符,注意：replace不会改变name的
      modifiers = parseModifiers(name.replace(dirRE, ''))
      // support .foo shorthand syntax for the .prop modifier
      if (process.env.VBIND_PROP_SHORTHAND && propBindRE.test(name)) {
        (modifiers || (modifiers = {})).prop = true
        name = `.` + name.slice(1).replace(modifierRE, '')
      } else if (modifiers) {
        name = name.replace(modifierRE, '')// 移除指令修饰符
      }
      if (bindRE.test(name)) { // v-bind 如果一个指令以 v-bind: 或 : 开头
        name = name.replace(bindRE, '')// 属性名称
        value = parseFilters(value)// 解析过滤器，重新赋值value
        isDynamic = dynamicArgRE.test(name)// 如果name存在左右中括号[]则name是动态绑定的
        if (isDynamic) {
          name = name.slice(1, -1)// 去除[] slice是截取子字符串，不包含end
        }
        if (
          process.env.NODE_ENV !== 'production' &&
          value.trim().length === 0
        ) {
          warn(
            `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`
          )
        }
        if (modifiers) { // 有修饰符
          if (modifiers.prop && !isDynamic) {
            name = camelize(name)// 驼峰化
            if (name === 'innerHtml') name = 'innerHTML'
          }
          if (modifiers.camel && !isDynamic) {
            name = camelize(name)// 如果有定义驼峰修饰符，也要驼峰化
          }
          /**
           * 使用sync修饰符：<child :some-prop.sync="value" />等价于
           * <child :some-prop="value" @update:someProp="handleEvent" />
           * handleEvent (val) {
              this.value = val
            }
            在child中定义this.$emit('update:someProp',val);就可以了
           */
          if (modifiers.sync) {
            syncGen = genAssignmentCode(value, `$event`)
            if (!isDynamic) {
              addHandler(
                el,
                `update:${camelize(name)}`,
                syncGen, // 事件发生的回调函数
                null,
                false,
                warn,
                list[i]// 属性对象
              )
              if (hyphenate(name) !== camelize(name)) {
                addHandler(
                  el,
                  `update:${hyphenate(name)}`,
                  syncGen,
                  null,
                  false,
                  warn,
                  list[i]
                )
              }
            } else {
              // handler w/ dynamic event name
              addHandler(
                el,
                `"update:"+(${name})`,
                syncGen,
                null,
                false,
                warn,
                list[i],
                true // dynamic
              )
            }
          }
        }
        if ((modifiers && modifiers.prop) || (
          /** 或者不是is绑定的组件(如果是is,在渲染阶段会替换掉el.tag，
          影响mustUseProp的判断)并且是
           * input,textarea,option,select,progress 这些标签的 value 属性都应该使用元素对象的原生的 prop 绑定（除了 type === 'button' 之外）
              option 标签的 selected 属性应该使用元素对象的原生的 prop 绑定
              input 标签的 checked 属性应该使用元素对象的原生的 prop 绑定
              video 标签的 muted 属性应该使用元素对象的原生的 prop 绑定
           */
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          addProp(el, name, value, list[i], isDynamic)// el.props =[] 存放原生原生DOM对象的属性
        } else {
          addAttr(el, name, value, list[i], isDynamic)// el.attrs =[] 存放属性
        }
      } else if (onRE.test(name)) { // v-on @
        name = name.replace(onRE, '')// 获取监听事件属性
        isDynamic = dynamicArgRE.test(name)// 是否动态绑定属性名称 有[]
        if (isDynamic) {
          name = name.slice(1, -1)// 处理属性名称
        }
        addHandler(el, name, value, modifiers, false, warn, list[i], isDynamic)
      } else { // normal directives
        name = name.replace(dirRE, '')
        // parse arg
        const argMatch = name.match(argRE)// 匹配指令参数 如v-custom:arg-->[:arg, arg]
        let arg = argMatch && argMatch[1]
        isDynamic = false
        if (arg) {
          name = name.slice(0, -(arg.length + 1))// name是指令名称
          if (dynamicArgRE.test(arg)) {
            arg = arg.slice(1, -1)// 去掉 []
            isDynamic = true
          }
        }
        addDirective(el, name, rawName, value, arg, isDynamic, modifiers, list[i])
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else { // 非指令属性
      // literal attribute
      if (process.env.NODE_ENV !== 'production') {
        const res = parseText(value, delimiters)
        if (res) {
          warn(// 属性中的插值会被移除{{}},请使用绑定属性替代
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.',
            list[i]
          )
        }
      }
      // 加入el.attrs数组中，应该把属性对应的值当做一个纯字符串对待
      addAttr(el, name, JSON.stringify(value), list[i])
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      /**
       * 实际上元素描述对象的 el.attrs 数组中所存储的任何属性都会在由虚拟DOM创建真实DOM的过程中使用 setAttribute 方法将属性添加到真实DOM元素上，
       * 而在火狐浏览器中存在无法通过DOM元素的 setAttribute 方法为 video 标签添加 muted 属性的问题，所以如上代码就是为了解决该问题的，
       * 其方案是如果一个属性的名字是 muted 并且该标签满足 platformMustUseProp 函数(video 标签满足)，则会额外调用 addProp
       * 函数将属性添加到元素描述对象的 el.props 数组中。为什么这么做呢？这是因为元素描述对象的 el.props
       * 数组中所存储的任何属性都会在由虚拟DOM创建真实DOM的过程中直接使用真实DOM对象添加，也就是说对于 <video> 标签的 muted 属性
       * 的添加方式为：videoEl.muted = true。
       */
      if (!el.component &&
          name === 'muted' &&
          platformMustUseProp(el.tag, el.attrsMap.type, name)) {
        addProp(el, name, 'true', list[i])
      }
    }
  }
}
// 如:xxx.a.b=>return {a:true,b:true}
function parseModifiers (name) {
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}
/**
 * Camelize a hyphen-delimited string. a-b --> aB
 */
const camelizeRE = /-(\w)/g
export const camelize = cached((str) => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})
export function cached (fn) {
  const cache = Object.create(null)
  return function cachedFn (str) {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }
}
//
const emptyObject = Object.freeze({})
export function addHandler (el, name, value, modifiers, important, warn, range, dynamic) {
  modifiers = modifiers || emptyObject
  // warn prevent and passive modifier
  /* istanbul ignore if */
  if (
    process.env.NODE_ENV !== 'production' && warn &&
    modifiers.prevent && modifiers.passive
  ) { // 提示开发者 passive 修饰符不能和 prevent 修饰符一起使用，这是因为在事件监听中 passive 选项参数就是用来告诉浏览器该事件监听函数是不会阻止默认行为的
    warn(
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.',
      range
    )
  }

  // normalize click.right and click.middle since they don't actually fire
  // this is technically browser-specific, but at least for now browsers are
  // the only target envs that have right/middle clicks.
  /**
   * 规范化“右击”事件和点击鼠标中间按钮的事件
   */
  if (modifiers.right) { // 模仿右击事件
    if (dynamic) {
      name = `(${name})==='click'?'contextmenu':(${name})`
    } else if (name === 'click') {
      name = 'contextmenu'
      delete modifiers.right
    }
  } else if (modifiers.middle) { // 模仿鼠标mouseup事件
    if (dynamic) {
      name = `(${name})==='click'?'mouseup':(${name})`
    } else if (name === 'click') {
      name = 'mouseup'
    }
  }

  // check capture modifier
  if (modifiers.capture) {
    delete modifiers.capture
    name = prependModifierMarker('!', name, dynamic)
  }
  if (modifiers.once) {
    delete modifiers.once
    name = prependModifierMarker('~', name, dynamic)
  }
  /* istanbul ignore if */
  if (modifiers.passive) {
    delete modifiers.passive
    name = prependModifierMarker('&', name, dynamic)
  }

  let events
  if (modifiers.native) {
    delete modifiers.native
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    events = el.events || (el.events = {})
  }

  const newHandler = rangeSetItem({ value: value.trim(), dynamic }, range)
  if (modifiers !== emptyObject) {
    newHandler.modifiers = modifiers
  }

  const handlers = events[name]
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    events[name] = newHandler
  }
  // 如果一个标签存在事件侦听,就不可能是纯对象
  el.plain = false
}
function prependModifierMarker (symbol, name, dynamic) {
  return dynamic
    ? `_p(${name},"${symbol}")`
    : symbol + name // mark the event as captured
}
/**
 * Hyphenate a camelCase string.
 */
const hyphenateRE = /\B([A-Z])/g
const hyphenate = cached((str) => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})
export function addProp (el, name, value, range, dynamic) {
  (el.props || (el.props = [])).push(rangeSetItem({ name, value, dynamic }, range))
  el.plain = false
}
function addDirective (el, name, rawName, value, arg, isDynamicArg, modifiers, range) {
  (el.directives || (el.directives = [])).push(rangeSetItem({
    name,
    rawName,
    value,
    arg,
    isDynamicArg,
    modifiers
  }, range))
  el.plain = false
}
/** 不允许这样写
 *<div v-for="item of list">
  <input v-model="item" />
  </div>
 */
function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`,
        el.rawAttrsMap['v-model']
      )
    }
    _el = _el.parent
  }
}
function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)// 寻找el的前一个元素
  if (prev && prev.if) { // 前一个元素如果有v-if，就应该把el.elseif放入前一个元素的IfCondition里面
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') { // 如果没有v-if，警告
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`,
      el.rawAttrsMap[el.elseif ? 'v-else-if' : 'v-else']
    )
  }
}
function findPrevElement (children) {
  let i = children.length
  while (i--) { // el此时还未放入children中，所以children里最后一个元素(type===1)就是el的前一个元素
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`,
          children[i]
        )
      }
      children.pop()
    }
  }
}
// add a raw attr (use this in preTransforms)
export function addRawAttr (el, name, value, range) {
  el.attrsMap[name] = value
  el.attrsList.push(rangeSetItem({ name, value }, range))
}
/* color: red; background: url(www.xxx.com?a=1&amp;copy=3)
--> {
  color: red,
  background: url(www.xxx.com?a=1&amp;copy=3)
} */

export const parseStyleText = cached(function (cssText) {
  const res = {}
  // 正则表达式 /a(?!b)/用来匹配后面没有跟字符 'b' 的字符 'a'
  const listDelimiter = /;(?![^(]*\))/g
  const propertyDelimiter = /:(.+)/
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      const tmp = item.split(propertyDelimiter)
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  return res
})
function getAndRemoveAttrByRegex (el, name) {
  const list = el.attrsList
  for (let i = 0, l = list.length; i < l; i++) {
    const attr = list[i]
    if (name.test(attr.name)) {
      list.splice(i, 1)
      return attr
    }
  }
}
function getSlotName (binding) {
  let name = binding.name.replace(slotRE, '')
  if (!name) {
    if (binding.name[0] !== '#') {
      name = 'default'
    } else if (process.env.NODE_ENV !== 'production') {
      warn(
        `v-slot shorthand syntax requires a slot name.`,
        binding
      )
    }
  }
  return dynamicArgRE.test(name)
    // dynamic [name]
    ? { name: name.slice(1, -1), dynamic: true }
    // static name
    : { name: `"${name}"`, dynamic: false }
}
/**
 * Check if a tag is a built-in tag.
 */
export const isBuiltInTag = makeMap('slot,component', true)
// 返回的函数参数key,判断是否在str中
export function makeMap (str, expectsLowerCase) { // expectsLowerCase 严格小写判断
  const map = Object.create(null)
  const list = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}
