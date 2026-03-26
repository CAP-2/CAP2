import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000', // Cổng Backend đang chạy bằng nodemon
                changeOrigin: true,
                rewrite: (path) => path, // Giữ nguyên path '/api/auth/login', '/api/manager/*'
            }
        }
    }
})