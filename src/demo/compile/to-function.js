
function createFunction (code, errors) {
  try {
    /* eslint-disable */
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return () => {}
  }
}

const cache = Object.create(null)

export const compileToFunctions = (template, code, options) => {
  // check cache
  const key = options.delimiters
    ? String(options.delimiters) + template
    : template
  if (cache[key]) {
    return cache[key]
  }
  //
  // turn code into functions
  const res = {}
  const fnGenErrors = []
  res.render = createFunction(code.render, fnGenErrors)
  res.staticRenderFns = code.staticRenderFns.map(code => {
    return createFunction(code, fnGenErrors)
  })
  //
  return (cache[key] = res)
}
