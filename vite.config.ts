import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRUCIAL: Permite que o app rode em subpastas ou hospedagem compartilhada sem servidor Node
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});