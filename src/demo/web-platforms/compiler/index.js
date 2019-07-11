import compile from '../../compile'
import { baseOptions } from './option'
import { extend } from '../../compile/getAst/helper'

const compiled = (template, options, vm) => {
  const finalOptions = Object.create(baseOptions)
  //
  if (options) {
  // merge custom modules
    if (options.modules) {
      finalOptions.modules = (baseOptions.modules || []).concat(options.modules)
    }
    // merge custom directives
    if (options.directives) {
      finalOptions.directives = extend(
        Object.create(baseOptions.directives || null),
        options.directives
      )
    }
    // copy other options
    for (const key in options) {
      if (key !== 'modules' && key !== 'directives') {
        finalOptions[key] = options[key]
      }
    }
  }
  return compile(template.trim(), finalOptions)
}
export default compiled
