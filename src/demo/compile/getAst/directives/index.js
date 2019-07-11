
import on from './on'
import bind from './bind'
/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/).
 */
export function noop (a, b, c) {}

export default {
  on,
  bind,
  cloak: noop
}
