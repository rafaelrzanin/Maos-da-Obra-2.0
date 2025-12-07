import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Changed from './' to '/' for proper SPA routing with BrowserRouter
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
