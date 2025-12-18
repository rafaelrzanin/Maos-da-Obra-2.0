
import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (!supabaseUrl || !supabaseKey) {
  console.warn("ATENÇÃO: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas. Supabase está DESATIVADO.");
} else {
  console.log("Supabase CLIENTE INICIALIZADO com sucesso.");
}
