// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
// import Vue from 'vue'
// import App from './App'
// import router from './router'
import Vue from 'web/entry-runtime-with-compiler'

Vue.config.productionTip = false
const template = `
<div class="app">
  <input v-model="show" />
  <div v-show="show">{{depa}} {{depb}}</div>
  <div v-show="!show">{{depc}} {{depd}}</div>
  {{depe}}
</div>
`
/* eslint-disable no-new */
new Vue({
  el: '#appId',
  template,
  data () {
    return {
      show: true,
      depa: 'a',
      depb: 'b',
      depc: 'c',
      depd: 'd',
      depe: 'e'
    }
  },
  mounted () {
    console.log('mounted')
  },
  updated () {
    console.log('updated')
  },
  created () {
    // this.$watch('hello.a', (newV, oldV) => {
    //   this.hello.a = 'change'
    // }, {sync: false})
    setTimeout(() => {
      this.show = !this.show
    }, 3000)
    this.$nextTick(() => {
      console.log('nextTick')
    })
  }
})
// .$mount('#app')//同时有el:'#app'和$mount('#app')第二次挂载是更新

// function def (obj, key, val, enumerable) {
//   Object.defineProperty(obj, key, {
//     value: val,
//     enumerable: !!enumerable, // 默认不传就是不可枚举
//     writable: true,
//     configurable: true
//   })
// }
// function isObject (obj) {
//   return obj !== null && typeof obj === 'object'
// }
// function defineReactive (obj, key, val) {
// // 方法返回 指定对象上一个自有属性对应的属性描述符
//   const property = Object.getOwnPropertyDescriptor(obj, key)
//   if (property && property.configurable === false) { // 不能设置，无法劫持
//     return
//   }
//   const getter = property && property.get
//   const setter = property && property.set
//   if (!getter) {
//     val = obj[key]// 没有第三个参数val,所以直接获取
//   }
//   // 深度观测val
//   let childOb// __ob__
//   Object.defineProperty(obj, key, {
//     enumerable: true,
//     configurable: true,
//     get () {
//       console.log('get', key)
//       const value = getter ? getter.call(obj) : val
//       childOb = observe(value)
//       return value
//     },
//     set (newVal) {
//       console.log('set', key)
//       if (getter && !setter) return
//       if (setter) {
//         setter.call(obj, newVal)
//       } else {
//         val = newVal
//       }
//       childOb = observe(newVal)// 观测新赋值
//     }
//   })
// }
// class Observer {
//   value;
//   constructor (value) { // value是数组或者对象
//     this.value = value
//     def(value, '__ob__', this)
//     this.walk(value)
//   }
//   walk (obj) {
//     const keys = Object.keys(obj)
//     for (let i = 0; i < keys.length; i++) {
//       defineReactive(obj, keys[i])
//     }
//   }
// }
// function observe (value) {
//   if (!isObject(value)) { // 不会对基本数据类型或者vnode节点观测
//     return
//   }
//   // 数组或者对象
//   let ob// 当一个对象被观测后会定义__ob__属性 = {value, dep, vmCount}
//   if (value.__ob__) {
//     ob = value.__ob__
//   } else {
//     ob = new Observer(value)
//   }
//   return ob
// }
// //
// var data = {
//   a: {b: 123},
//   c: 456
// }
// var eVal = {bb: 333}
// Object.defineProperty(data, 'e', {
//   enumerable: true,
//   configurable: true,
//   get () {
//     console.log('error get')
//     return eVal
//   },
//   set (newVal) {
//     console.log('error set')
//     eVal = newVal
//   }
// })
// observe(data)
// // data.e = 123
// // console.log(data.e)
