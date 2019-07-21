import getAst from './getAst'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { compileToFunctions } from './to-function'

export default function compile (template, options) {
  const ast = getAst(template.trim(), options)
  if (options.optimize !== false) {
    optimize(ast, options)// 优化ast
  }
  const code = generate(ast, options)
  const res = compileToFunctions(template, code, options)
  return {
    ast,
    render: res.render,
    staticRenderFns: res.staticRenderFns
  }
}
