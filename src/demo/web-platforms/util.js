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

// tag是否是pre
export const isPreTag = (tag) => tag === 'pre'

/*
必须使用元素的原生属性来绑定
input,textarea,option,select,progress这些标签的 value 属性都应该使用元素对象的原生的 prop 绑定（
除了 type === 'button' 之外）
 option 标签的 selected 属性应该使用元素对象的原生的 prop 绑定
 input 标签的 checked 属性应该使用元素对象的原生的 prop 绑定
 video 标签的 muted 属性应该使用元素对象的原生的 prop 绑定
*/
const acceptValue = makeMap('input,textarea,option,select,progress')
export const mustUseProp = (tag, type, attr) => {
  return (
    (attr === 'value' && acceptValue(tag) && type !== 'button') ||
    (attr === 'selected' && tag === 'option') ||
    (attr === 'checked' && tag === 'input') ||
    (attr === 'muted' && tag === 'video')
  )
}

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
export const isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
  'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
  'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
)
// 是SVG类型标签或者math标签,获取元素(标签)的命名空间
export function getTagNamespace (tag) {
  if (isSVG(tag)) { // svg类型标签
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  if (tag === 'math') {
    return 'math'
  }
}

export const isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
  'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
  'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
  'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
  's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
  'embed,object,param,source,canvas,script,noscript,del,ins,' +
  'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
  'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
  'output,progress,select,textarea,' +
  'details,dialog,menu,menuitem,summary,' +
  'content,element,shadow,template,blockquote,iframe,tfoot'
)
// 检查给定的标签是否是已经定义的标签
export const isReservedTag = (tag) => {
  return isHTMLTag(tag) || isSVG(tag)
}
export const isUnaryTag = makeMap(// 自闭合标签
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
  'link,meta,param,source,track,wbr'
)
export const canBeLeftOpenTag = makeMap(// 可以省略闭合标签
  'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
)
/**
 * Generate a string containing static keys from compiler modules.
 */
export function genStaticKeys (modules) {
  return modules.reduce((keys, m) => {
    return keys.concat(m.staticKeys || [])
  }, []).join(',')
}
/**
 * Query an element selector if it's not an element already.
 */
export function query (el) {
  if (typeof el === 'string') {
    const selected = document.querySelector(el)
    if (!selected) {
      process.env.NODE_ENV !== 'production' && warn(
        'Cannot find element: ' + el
      )
      return document.createElement('div')
    }
    return selected
  } else {
    return el
  }
}
let generateComponentTrace = () => {} // work around flow check
export function warn (msg, vm) {
  const trace = vm ? generateComponentTrace(vm) : ''
  console.error(`[Vue warn]: ${msg}${trace}`)
}
export const inBrowser = typeof window !== 'undefined'
// these are reserved for web because they are directly compiled away
// during template compilation
export const isReservedAttr = makeMap('style,class')
const unknownElementCache = Object.create(null)
export function isUnknownElement (tag) {
  /* istanbul ignore if */
  if (!inBrowser) {
    return true
  }
  if (isReservedTag(tag)) {
    return false
  }
  tag = tag.toLowerCase()
  /* istanbul ignore if */
  if (unknownElementCache[tag] != null) {
    return unknownElementCache[tag]
  }
  const el = document.createElement(tag)
  if (tag.indexOf('-') > -1) {
    // http://stackoverflow.com/a/28210364/1070244
    return (unknownElementCache[tag] = (
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement
    ))
  } else {
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}
