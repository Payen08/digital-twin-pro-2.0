import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    // 开发用绝对路径，打包用相对路径
    base: isDev ? '/' : './',
    
    plugins: [react()],
    
    server: {
      port: 1080,
      open: true
    }
  }
})