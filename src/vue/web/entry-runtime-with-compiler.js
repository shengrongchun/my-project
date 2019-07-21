import Vue from './runtime/index'
import compiled from './compiler'
import { query, warn } from './util'
import { cached } from 'shared/util'
//
window.__WEEX__ = false// 非weex平台
//
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})
const mount = Vue.prototype.$mount// 缓存$mount方法并不是下面的方法 platforms/web/runtime/index.js
Vue.prototype.$mount = function (el, hydrating) { // hydrating服务端渲染相关，可以不用管
  el = el && query(el)
  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) { // body or html
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {
      const { render, staticRenderFns } = compiled(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns// staticRenderFns是为了优化，提取那些后期不用去更新的节点
    }
  }
  return mount.call(this, el, hydrating)
}
/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el) {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compiled

export default Vue
