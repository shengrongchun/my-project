
import { addProp } from '../../../compile/getAst/helper'

export default function text (el, dir) {
  if (dir.value) {
    addProp(el, 'textContent', `_s(${dir.value})`)
  }
}
