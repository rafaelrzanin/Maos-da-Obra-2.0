
import { createClient } from '@supabase/supabase-js';

// Helper function to safely get environment variables, checking both import.meta.env and process.env
const safeGetEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env[key] === 'string') {
    return import.meta.env[key];
  }
  // Fallback for environments where process.env might be used or polyfilled
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    return process.env[key];
  }
  return undefined;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Throw an error if environment variables are missing
if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO CRÍTICO: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas.");
  throw new Error("Configuração do Supabase ausente. Verifique suas variáveis de ambiente.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase CLIENTE INICIALIZADO com sucesso.");

