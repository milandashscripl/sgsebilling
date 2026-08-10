import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': 'http://localhost:5001'
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4175,
    strictPort: false,
    proxy: {
      '/api': 'http://localhost:5001'
    }
  }
});
