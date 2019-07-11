
/**
 * Cross-platform code generation for component v-model
 */
export function genComponentModel (
  el,
  value,
  modifiers
) {
  const { number, trim } = modifiers || {}

  const baseValueExpression = '$$v'
  let valueExpression = baseValueExpression
  if (trim) {
    valueExpression =
      `(typeof ${baseValueExpression} === 'string'` +
      `? ${baseValueExpression}.trim()` +
      `: ${baseValueExpression})`
  }
  if (number) {
    valueExpression = `_n(${valueExpression})`
  }
  const assignment = genAssignmentCode(value, valueExpression)

  el.model = {
    value: `(${value})`,
    expression: JSON.stringify(value),
    callback: `function (${baseValueExpression}) {${assignment}}`
  }
}

/**
 * Cross-platform codegen helper for generating v-model value assignment code.
 */
export function genAssignmentCode (
  value,
  assignment
) {
  const res = parseModel(value)
  if (res.key === null) {
    return `${value}=${assignment}`
  } else { // 有key值说明是这样形式v-model="a.b" exp: a   key: b
    return `$set(${res.exp}, ${res.key}, ${assignment})`
  }
}

/**
 * Parse a v-model expression into a base path and a final key segment.
 * Handles both dot-path and possible square brackets.
 *
 * Possible cases:
 *
 * - test
 * - test[key]
 * - test[test1[key]]
 * - test["a"][key]
 * - xxx.test[a[a].test1[key]]
 * - test.xxx.a["asa"][test1[key]]
 *
 */

let len, str, chr, index, expressionPos, expressionEndPos

export function parseModel (val) {
  // Fix https://github.com/vuejs/vue/pull/7730
  // allow v-model="obj.val " (trailing whitespace)
  val = val.trim()
  len = val.length

  // 没有 '['或者有‘[’但最后一个字符不是‘]’
  if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
    index = val.lastIndexOf('.')
    if (index > -1) {
      return {
        exp: val.slice(0, index),
        key: '"' + val.slice(index + 1) + '"'
      }
    } else {
      return {
        exp: val,
        key: null
      }
    }
  }
  // val.indexOf('[') >= 0 && val.lastIndexOf(']') >= len - 1
  // v-model="[abc]"或者v-model="a[bc]"
  // 就是获取最外层的 []，把里面的字符都当做key
  str = val
  index = expressionPos = expressionEndPos = 0

  while (!eof()) { // 解析到字符末尾停止
    chr = next()// 每次指向下一个字符
    /* istanbul ignore if */
    if (isStringStart(chr)) { // 如果是 " 或者是 '
      parseString(chr)
    } else if (chr === 0x5B) { // 0x5B-->[
      parseBracket(chr)
    }
  }

  return {
    exp: val.slice(0, expressionPos),
    key: val.slice(expressionPos + 1, expressionEndPos)
  }
}

function next () {
  return str.charCodeAt(++index)
}

function eof () {
  return index >= len
}

function isStringStart (chr) { // 0x22 -> " 0x27 -> '
  return chr === 0x22 || chr === 0x27
}

function parseBracket (chr) {
  let inBracket = 1
  expressionPos = index
  while (!eof()) {
    chr = next()
    if (isStringStart(chr)) {
      parseString(chr)
      continue
    }
    if (chr === 0x5B) inBracket++// 0x5B-->[
    if (chr === 0x5D) inBracket--// 0x5D-->]
    if (inBracket === 0) {
      expressionEndPos = index
      break
    }
  }
}

function parseString (chr) { // 如果是"或者',找到下一个"或者'结束
  const stringQuote = chr
  while (!eof()) {
    chr = next()
    if (chr === stringQuote) {
      break
    }
  }
}
