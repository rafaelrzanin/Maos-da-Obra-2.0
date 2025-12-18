import { createClient } from "@supabase/supabase-js";

// Variáveis de ambiente expostas pelo Vite (build-time)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação de segurança
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "ERRO CRÍTICO: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas."
  );
  throw new Error(
    "Configuração do Supabase ausente. Verifique suas variáveis de ambiente."
  );
}

// Cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Supabase CLIENTE inicializado com sucesso.");

