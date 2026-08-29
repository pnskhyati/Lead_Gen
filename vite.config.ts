import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:4000',
            changeOrigin: true,
            timeout: 180000,
            proxyTimeout: 180000,
          },
          '/auth': {
            target: 'http://localhost:4000',
            changeOrigin: true,
          },
          '/media': {
            target: 'http://localhost:4000',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        // Legacy shims (AI now goes through /api → Vertex on the backend)
        'process.env.API_KEY': JSON.stringify(env.VERTEX_API_KEY || env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
