import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Essencial para o funcionamento correto das rotas (SPA) no Vercel
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Garante que o build limpe a pasta antes de gerar uma nova versão
    emptyOutDir: true,
  },
  // Expõe as variáveis para o lado do cliente
  // Nota: Certifique-se de que estas chaves existam no Environment Variables da Vercel
  define: {
    'import.meta.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(process.env.VITE_VAPID_PUBLIC_KEY || ""),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ""),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ""),
    'import.meta.env.VITE_GOOGLE_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_API_KEY || ""), 
    'import.meta.env.VITE_APP_URL': JSON.stringify(process.env.VITE_APP_URL || 'http://localhost:5173'),
  },
});
