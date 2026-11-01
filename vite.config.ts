import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '127.0.0.1',
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
    plugins: [react(), tailwindcss(), basicSsl()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VERTEX_API_KEY || env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@legacy': path.resolve(__dirname, 'src/legacy'),
      },
    },
  };
});
