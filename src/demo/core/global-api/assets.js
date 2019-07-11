/* @flow */

import { ASSET_TYPES } from '../../shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue) {
  /**
   * Create asset registration methods.
   */
  // ASSET_TYPES = [component,directive,filter]
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id,
      definition
    ) {
      if (!definition) { // 没有第二个参数说明是获取注册的[component,directive,filter]的构造器
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)// 非生产环境验证组件名称是否规范
        }
        if (type === 'component' && isPlainObject(definition)) { // 注册组件，传入一个选项对象 (自动调用 Vue.extend继续)
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        // 如果是指令，并且definition是函数类型，把构造器里面的bind和update都设置为此函数
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
