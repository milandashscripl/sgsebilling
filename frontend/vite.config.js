import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5177,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5013'
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4175,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5013'
    }
  }
});
