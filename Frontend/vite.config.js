import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                // Phải trùng với PORT trong Backend (server.js: process.env.PORT || 3000)
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path, // Giữ nguyên path '/api/auth/login', '/api/manager/*'
            }
        }
    }
})