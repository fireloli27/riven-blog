import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Posts from './Posts.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Posts', Posts)
  }
} satisfies Theme
