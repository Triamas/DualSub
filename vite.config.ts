/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Shims process.env.API_KEY for the Google GenAI SDK to work with Vite
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    test: {
      globals: true,
      environment: 'jsdom',
    },
  }
})