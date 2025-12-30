
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
  // NEW: Expose VAPID_PUBLIC_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, and VITE_GOOGLE_API_KEY to client-side
  define: {
    'import.meta.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(process.env.VAPID_PUBLIC_KEY),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    // Corrigido para expor VITE_GOOGLE_API_KEY como import.meta.env, mais idiomático para Vite
    'import.meta.env.VITE_GOOGLE_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_API_KEY), 
  },
});
    