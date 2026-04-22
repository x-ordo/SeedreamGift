import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:5140';
const isAnalyze = process.env.ANALYZE === 'true';

export default defineConfig({
  plugins: [
    react(),
    ...(isAnalyze ? [visualizer({ filename: 'dist/stats.html', open: true, gzipSize: true, brotliSize: true })] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['@tanstack/react-query', 'react', 'react-dom'],
  },
  server: {
    proxy: {
      // 개발 중 API 요청을 NestJS 서버로 포워딩
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@tanstack/react-query'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-layer': ['@tanstack/react-query', 'axios'],
          'state': ['zustand'],
          'animation': ['motion'],
        },
      },
    },
    target: 'es2022',
    minify: 'esbuild',
  },
});
