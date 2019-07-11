// 匹配箭头函数或者一般函数
const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/
// 形如()、(a,b)、(a,b);
const fnInvokeRE = /\([^)]*?\);*$/
// a()、a.b()、a[c]()等
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/

/*
events: {
  事件名1: {
    value: '事件体字符串',
    modifiers: {
      prevent: true
      ……
    }
  }
}
*/
export function genHandlers (
  events,
  isNative
) {
  const prefix = isNative ? 'nativeOn:' : 'on:'// 是否当做原生事件处理
  let staticHandlers = ``
  let dynamicHandlers = ``
  for (const name in events) {
    const handlerCode = genHandler(events[name])// 返回事件处理函数体
    if (events[name] && events[name].dynamic) {
      dynamicHandlers += `${name},${handlerCode},`
    } else {
      staticHandlers += `"${name}":${handlerCode},`
    }
  }
  staticHandlers = `{${staticHandlers.slice(0, -1)}}`
  if (dynamicHandlers) {
    return prefix + `_d(${staticHandlers},[${dynamicHandlers.slice(0, -1)}])`
  } else {
    return prefix + staticHandlers
  }
}
// KeyboardEvent.keyCode aliases
const keyCodes = {// 键盘按键
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  'delete': [8, 46]
}
// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
const genGuard = condition => `if(${condition})return null;`

const modifierCode = {
  stop: '$event.stopPropagation();',
  prevent: '$event.preventDefault();',
  self: genGuard(`$event.target !== $event.currentTarget`),
  ctrl: genGuard(`!$event.ctrlKey`),
  shift: genGuard(`!$event.shiftKey`),
  alt: genGuard(`!$event.altKey`),
  meta: genGuard(`!$event.metaKey`),
  left: genGuard(`'button' in $event && $event.button !== 0`),
  middle: genGuard(`'button' in $event && $event.button !== 1`),
  right: genGuard(`'button' in $event && $event.button !== 2`)
}
/**
 * @param {*} handler
 * {
    value: '事件体字符串',
    modifiers: {
      prevent: true
      ……
    }或者多事件[{},{}]
 */
function genHandler (handler) {
  if (!handler) {
    return 'function(){}'
  }

  if (Array.isArray(handler)) {
    return `[${handler.map(handler => genHandler(handler)).join(',')}]`
  }
  // 路径的判断,是不是以对象的方式查找某个方法a.a,a[a],a['a'] ,a["a"],a[a][b]等等
  const isMethodPath = simplePathRE.test(handler.value)
  const isFunctionExpression = fnExpRE.test(handler.value)// 是否是函数表达式 ()=> {}或者function() {}
  // 是否是函数调用的形式如a()、a.b()、a[c]()等
  const isFunctionInvocation = simplePathRE.test(handler.value.replace(fnInvokeRE, ''))

  if (!handler.modifiers) { // 事件没有修饰符
    if (isMethodPath || isFunctionExpression) { // 如果是以对象的形式或者函数表达式
      return handler.value// 本身就是一个执行体直接返回
    }
    /* istanbul ignore if */
    // if (__WEEX__ && handler.params) {
    //   return genWeexHandler(handler.params, handler.value)
    // }
    // 如果是函数调用形式
    return `function($event){${
      isFunctionInvocation ? `return ${handler.value}` : handler.value
    }}` // inline statement
  } else {
    let code = ''
    let genModifierCode = ''// 内置修饰符
    const keys = []// 键盘按键
    for (const key in handler.modifiers) {
      if (modifierCode[key]) { // 如 'if($event.target !== $event.currentTarget)return null;'命中内置的修饰符
        genModifierCode += modifierCode[key]
        // left/right
        if (keyCodes[key]) {
          keys.push(key)
        }
      } else if (key === 'exact') {
        /** .exact 修饰符允许你控制由精确的系统修饰符（'ctrl', 'shift', 'alt', 'meta'）组合触发的事件。
         * <!-- 即使 ctrl 或 Shift 被一同按下时也会触发 -->
          <button @click.ctrl="onClick">A</button>
          <!-- 有且只有 Ctrl 被按下的时候才触发 -->
          <button @click.ctrl.exact="onCtrlClick">A</button>
          <!-- 没有任何系统修饰符被按下的时候才触发 -->
          <button @click.exact="onClick">A</button>
         */
        const modifiers = handler.modifiers
        genModifierCode += genGuard(
          ['ctrl', 'shift', 'alt', 'meta']
            .filter(keyModifier => !modifiers[keyModifier])
            .map(keyModifier => `$event.${keyModifier}Key`)
            .join('||')
        )
      } else {
        keys.push(key)
      }
    }
    if (keys.length) {
      code += genKeyFilter(keys)
    }
    // Make sure modifiers like prevent and stop get executed after key filtering
    if (genModifierCode) {
      code += genModifierCode
    }
    const handlerCode = isMethodPath
      ? `return ${handler.value}($event)`
      : isFunctionExpression
        ? `return (${handler.value})($event)`
        : isFunctionInvocation
          ? `return ${handler.value}`
          : handler.value
    /* istanbul ignore if */
    // if (__WEEX__ && handler.params) {
    //   return genWeexHandler(handler.params, code + handlerCode)
    // }
    return `function($event){${code}${handlerCode}}`
  }
}
function genKeyFilter (keys) {
  return (
    // make sure the key filters only apply to KeyboardEvents
    // #9441: can't use 'keyCode' in $event because Chrome autofill fires fake
    // key events that do not have keyCode property...
    // 键盘事件type是有key字符串
    `if(!$event.type.indexOf('key')&&` +
    `${keys.map(genFilterCode).join('&&')})return null;`
  )
}
// KeyboardEvent.key aliases
const keyNames = {
  // #7880: IE11 and Edge use `Esc` for Escape key name.
  esc: ['Esc', 'Escape'],
  tab: 'Tab',
  enter: 'Enter',
  // #9112: IE11 uses `Spacebar` for Space key name.
  space: [' ', 'Spacebar'],
  // #7806: IE11 uses key names without `Arrow` prefix for arrow keys.
  up: ['Up', 'ArrowUp'],
  left: ['Left', 'ArrowLeft'],
  right: ['Right', 'ArrowRight'],
  down: ['Down', 'ArrowDown'],
  // #9112: IE11 uses `Del` for Delete key name.
  'delete': ['Backspace', 'Delete', 'Del']
}
function genFilterCode (key) {
  const keyVal = parseInt(key, 10)
  if (keyVal) {
    return `$event.keyCode!==${keyVal}`
  }
  const keyCode = keyCodes[key]
  const keyName = keyNames[key]
  return (
    `_k($event.keyCode,` +
    `${JSON.stringify(key)},` +
    `${JSON.stringify(keyCode)},` +
    `$event.key,` +
    `${JSON.stringify(keyName)}` +
    `)`
  )
}
