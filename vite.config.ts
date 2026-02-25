/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('@google/genai')) {
                return 'vendor-genai';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('idb') || id.includes('jszip') || id.includes('react-virtuoso')) {
                return 'vendor-utils';
              }
              return 'vendor'; // Catch-all for other node_modules
            }
          },
        },
      },
    },
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