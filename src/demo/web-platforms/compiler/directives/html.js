
import { addProp } from '../../../compile/getAst/helper'

export default function html (el, dir) {
  if (dir.value) {
    addProp(el, 'innerHTML', `_s(${dir.value})`)
  }
}
