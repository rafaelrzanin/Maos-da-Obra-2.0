
import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

// Throw an error if environment variables are missing
if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO CRÍTICO: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas.");
  throw new Error("Configuração do Supabase ausente. Verifique suas variáveis de ambiente.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase CLIENTE INICIALIZADO com sucesso.");

