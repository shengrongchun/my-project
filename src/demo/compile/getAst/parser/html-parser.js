/* eslint-disable */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */
/**
 * 用来匹配标签的属性(attributes)的
 *  1、使用双引号把值引起来：class="some-class"
    2、使用单引号把值引起来：class='some-class'
    3、不使用引号：class=some-class
    4、单独的属性名：disabled
    匹配结果：
    1、['class="some-class"','class','=','some-class',undefined,undefined]
    2、["class='some-class'",'class','=',undefined,'some-class',undefined]
    3、['class=some-class','class','=',undefined,undefined,'some-class']
    4、['disabled','disabled',undefined,undefined,undefined,undefined]
 */
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 和上一个多了:和@的匹配 :class和@change，vue中绑定写法
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 匹配不包含冒号 (:) 的 XML 名称 如<vue xmlns="http://www.xx.com/xx"></vue>
const unicodeRegExp = /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
// 捕获合法的xml标签名称 如<a:vue xmlns:a="http://www.xx.com/xx"></a:vue>中的a:vue
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// 捕获标签名称和<   如<div>hello bike</div>中的<div
const startTagOpen = new RegExp(`^<${qnameCapture}`)// ['<','div']
// 捕获开始标签的闭合部分如 > 或者 /> 。例子：(<br/>)
const startTagClose = /^\s*(\/?)>/
// ['/div>','div']捕获结束标签
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// 用来匹配文档的 DOCTYPE 标签
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
// 匹配注释节点
const comment = /^<!\--/
// 匹配条件注释节点
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
// 用来检测给定的标签名字是不是纯文本标签
const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
/**
 * #5992 pre,textarea会忽略掉第一个换行符如
 * <pre>
   hello bike</pre> 完全等价于<pre>hello bike</pre>
 * */
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

// 把value中存在的&lt;、&gt;、&quot;、&amp、&#10;、&#9;、&#39替换为decodingMap中对应的值
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g// 匹配 &lt;、&gt;、&quot;、&amp、&#39;
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g// 匹配 &lt;、&gt;、&quot;、&amp、&#10;、&#9;

// 总是返回false
const no = (a, b, c) => false
// 返回的函数参数key,判断是否在str中
function makeMap (str, expectsLowerCase) { // expectsLowerCase 严格小写判断
  const map = Object.create(null)
  const list = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}
// 非段落式标签
const isNonPhrasingTag = makeMap(
  'address,article,aside,base,blockquote,body,caption,col,colgroup,dd,' +
  'details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,' +
  'h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,' +
  'optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,' +
  'title,tr,track'
)

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}
// let canBeLeftOpenTag = makeMap(// 可以省略闭合标签
//   'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
// )
// check whether current browser encodes a char inside attribute values
let div
const inBrowser = typeof window !== 'undefined'
function getShouldDecode (href) {
  div = div || document.createElement('div')
  div.innerHTML = href ? `<a href="\n"/>` : `<div a="\n"/>`
  return div.innerHTML.indexOf('&#10;') > 0
}
// #3663: IE encodes newlines inside attribute values while other browsers don't
// 这是IE上的一个bug, 如果dom节点的属性分多行书写，那么它会把'\n'转义成&#10;
const shouldDecodeNewlines = inBrowser ? getShouldDecode(false) : false
// #6828: chrome encodes content in a[href]
// 在chrome中 href属性会出现这个bug情况
const shouldDecodeNewlinesForHref = inBrowser ? getShouldDecode(true) : false
/**
 *
 * @param {*} html 解析的字符串
 * @param {*} options
 * {
    expectHTML: boolean //是否期望一些行为和浏览器同步如：浏览器的行为：<p><h1></h1></p>转为<p></p><h1></h1><p></p>
    isUnaryTag: function(标签) //判断标签是否为一元标签如<br/>默认会是这些：'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr'
    canBeLeftOpenTag: function(标签) //判断标签是否是自闭合标签 如<p>hello浏览器也会解析为<p>hello</p>
    shouldKeepComment: boolean //是否保持注释输出
    outputSourceRange: boolean //非生产是否输出代码的开始与结束范围
    warn: function //自定义警告函数，没有则不输出警告,
    start: function(tagName, attrs, unary, start, end)//标签名称、属性list[{name,value,start,end},...]、是否为一元标签、开始标签的开始与结束位置,
    end: function(tagName, start, end),
    chars: function(text, start, end),//text文本
    comment: function(text, start, end),//text注释文本
 * }
 */
export default function parseHTML (html, options) {
  const stack = []// 开始标签入栈，遇到结束标签的时候，来从栈顶匹配结束标签。作用是检测html中是否缺少闭合标签
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no// 是否可以省略闭合标签
  let index = 0// 标识着当前字符流的读入位置
  let last, lastTag// 变量 last 存储剩余还未 parse 的 html 字符串，变量 lastTag 则始终存储着位于 stack 栈顶的元素

  // 开启一个 while 循环，循环结束的条件是 html 为空，即 html 被 parse 完毕
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // isPlainTextElement: 'script,style,textarea'
    // 确保即将 parse 的内容不是在纯文本标签里 (script,style,textarea)或者一开始还没有解析的字符串
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')// 左 < 第一次出现的位置
      if (textEnd === 0) { // 第一个字符就是左 <，那么第一个字符是<的有很多情况
        // Comment:
        if (comment.test(html)) { // 如果是注释 <!-- -->(可能)
          
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) { // 一定是
            if (options.shouldKeepComment) { // 如果保留注释
              // 截取注释内容、开始和结束位置执行options.comment方法
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)// 剔除parse过的字符，重置html
            continue // 跳过这次while循环
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) { // 如果是 条件注释节点 <![ ]>(可能)
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) { // 一定是，vue永远不保留条件注释
            advance(conditionalEnd + 2)// 剔除parse过的字符，重置html
            continue// 跳过这次while循环
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) { // 如果是 doctype  <!DOCTYPE >，vue永远不保留<!DOCTYPE >
          advance(doctypeMatch[0].length)// 剔除parse过的字符，重置html
          continue// 跳过这次while循环
        }

        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) { // 如果是结束标签  </div> 捕获的数组是如['</div>','div']
          const curIndex = index
          advance(endTagMatch[0].length)// 剔除parse过的字符，重置html
          parseEndTag(endTagMatch[1], curIndex, index)
          continue// 跳过这次while循环
        }

        // Start tag:
        /**
         * 开始标签到结束如果是这样<div class="hello" v-if="ok">
         * startTagMatch = {
         *  tagName: 'div',
         *  attrs:[
         *   [' class="hello"','class','=','hello',undefined,undefined],
         *   [' v-if="ok"','v-if','=','ok',undefined,undefined]
         *  ],
         *  start: 开始位置,
         *  unarySlash: 是否是一元标签,
         *  end: 结束位置
         * }
         */
        const startTagMatch = parseStartTag()
        if (startTagMatch) { // 如果是开始标签 <div>或者是一个单纯的字符串 <abcd
          handleStartTag(startTagMatch)// 处理startTagMatch
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            // <pre>
            // hello bike</pre> 完全等价于<pre>hello bike</pre>
            advance(1)// 剔除parse过的字符，重置html
          }
          continue// 跳过这次while循环
        }
      }

      let text, rest, next
      if (textEnd >= 0) { // 即使字符串的第一个字符是 < 也不能保证成功匹配以上几种情况，比如字符串 '< 2' ,大于0的情况'0<1<2' 或者 '0<div'
        rest = html.slice(textEnd)// 从 < 开始截取 比如 '0<div'--> '<div'
        // rest为开始<的字符串
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) { // 不匹配上述四种情况说明 rest有可能是 <1<2... 或者 <1<div...
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)// 第二个<的位置
          if (next < 0) break// 没有第二个<直接break跳出循环
          textEnd += next
          rest = html.slice(textEnd)
        }
        // 循环结束，text为不能解析的文本
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) { // 说明整个html都没有 <,直接把整个html都当做文本
        text = html
      }

      if (text) { // 如果有text
        advance(text.length)// html移出text,html变化了
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)// 添加文本
      }
    } else { // 即将 parse 的内容是在纯文本标签里 (script,style,textarea) 如此时的html: abc</textarea><div ...
      let endTagLength = 0// 纯文本标签闭合标签的字符长度
      const stackedTag = lastTag.toLowerCase()
      // 用来匹配纯文本标签的内容以及结束标签
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      // 把abc</textarea>用空字符替换掉，所以rest为<div ...
      const rest = html.replace(reStackedTag, function (all, text, endTag) { // all:abc</textarea>。text:abc。endTag:</textarea>
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) { // 忽略换行符
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length// 读取流位置改变
      html = rest// html变化 html: <div ...
      parseEndTag(stackedTag, index - endTagLength, index)// 添加结束标签
    }

    if (html === last) { // 如果html经过一系列的操作之后没有任何变化，说明html是纯文本
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance (n) { // 重置html
    index += n// 相对于原始字符串，读流位置
    html = html.substring(n)
  }
  // parseStartTag 函数用来 parse 开始标签
  function parseStartTag () {
    const start = html.match(startTagOpen)// ['<div', 'div', ...]
    if (start) { // 匹配成功
      const match = {
        tagName: start[1],
        attrs: [], // 存放开始标签上面定义的属性
        start: index// 字符流读入的位置（相对于原始字符串html）
      }
      advance(start[0].length)// 此时html已经变化，移出了开始标签如'<div'
      let end, attr// end标识是否已经到了结束标签，attr是匹配到的属性数组
      // 如['class="some-class"','class','=','some-class',undefined,undefined]
      // 现在要获取在没有匹配到结束标签之前收集 属性
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        attr.start = index// 属性的读流开始位置（相对于原始字符串html）
        advance(attr[0].length)// html移出属性字符串
        attr.end = index// 属性结束位置（相对于原始字符串html）
        match.attrs.push(attr)// push到math的attrs数组中
      }
      if (end) { // end可能是['/>','/']或者['>',undefined]
        match.unarySlash = end[1]// 是否是一元标签如 <br/>
        advance(end[0].length)
        match.end = index// 开始标签结束位置
        return match
      }
    }
  }
  // handleStartTag 函数用来处理 parseStartTag 的结果
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash// 是否为一元标签

    if (expectHTML) {
      /**
       * 非段落式标签：'address,article,aside,base,blockquote,body,caption,col,colgroup,dd,' +
          'details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,' +
          'h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,' +
          'optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,' +
          'title,tr,track'
       * 如果栈顶元素是p元素，并且此时的tag是非段落式标签，我们知道p标签里面是不能包含非段落式标签的
       浏览器的行为：<p><h1></h1></p>转为<p></p><h1></h1><p></p>
       */
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)// 处理和上述浏览器的行为同步
      }
      /**
       * 如果tagName是自闭合标签并且同时上一个也是闭合标签如<p>hello<p>bike浏览器转为<p>hello</p><p>bike</p>
       */
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)// 与浏览器行为同步
      }
    }
    /* isUnaryTag = makeMap(//自闭合标签例如 <input />
      'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
      'link,meta,param,source,track,wbr')
      如果tagName是上面的一种那可定是一元标签，如果不是也不一定不是一元标签，如vue自定义的<my-component />
      所以（|| !!unarySlash）
    */
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]// [' class="hello"','class','=','hello',undefined,undefined],
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlinesMask = tagName === 'a' && args[1] === 'href'
        ? shouldDecodeNewlinesForHref
        : shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlinesMask)
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    if (!unary) { // 不是一元标签，需要把标签入栈，等到之后的闭合标签的匹配，lastTag始终是栈顶标签
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }

    if (options.start) { // 添加开始标签
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }
  // parseEndTag 函数用来 parse 结束标签
  function parseEndTag (tagName, start, end) {
    // pos 会在后面用于判断 html 字符串是否缺少结束标签
    // lowerCasedTagName 变量用来存储 tagName 的小写版
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) { // 说明，栈中还是有开始标签的，但是匹配结束后，执行了parseEndTag()，没有匹配到结束标签，直接警告，并添加结束标签
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) { // 加结束标签
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
      // pos小于0其实就是-1，说明栈中没有匹配到它的开始标签
    } else if (lowerCasedTagName === 'br') { // 如果结束标签是br就和浏览器行为同步 </br>转为<br>
      if (options.start) { // <br>
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') { // 如果结束标签是p就和浏览器行为同步 </p>转为<p></p>
      if (options.start) { // <p>
        options.start(tagName, [], false, start, end)
      }
      if (options.end) { // </p>
        options.end(tagName, start, end)
      }
    }// 其他情况浏览器直接忽略如</div>等
  }
}
