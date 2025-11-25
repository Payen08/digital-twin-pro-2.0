import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    // 开发用绝对路径，GitHub Pages 用仓库路径
    base: isDev ? '/' : '/digital-twin-pro-2.0/',
    
    plugins: [react()],
    
    server: {
      port: 1080,
      open: true
    }
  }
})