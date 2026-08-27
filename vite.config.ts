import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, './src/engine'),
      '@data': path.resolve(__dirname, './src/data'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
