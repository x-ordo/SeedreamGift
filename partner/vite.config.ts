import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:5140';

export default defineConfig({
  base: '/wow_partner_portal/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['@tanstack/react-query', 'react', 'react-dom'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-layer': ['@tanstack/react-query', 'axios'],
          'state': ['zustand'],
        },
      },
    },
    target: 'es2022',
    minify: 'esbuild',
  },
});
