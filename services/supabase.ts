
import { createClient } from '@supabase/supabase-js';

// Helper function to safely get environment variables, checking both import.meta.env and process.env
const safeGetEnv = (key: string): string | undefined => {
  const vEnv = (typeof import.meta !== "undefined" ? (import.meta as any).env : undefined) as
    | Record<string, unknown>
    | undefined;

  if (vEnv && typeof vEnv[key] === "string") {
    return vEnv[key] as string;
  }

  const pEnv = (typeof process !== "undefined" ? (process as any).env : undefined) as
    | Record<string, unknown>
    | undefined;

  if (pEnv && typeof pEnv[key] === "string") {
    return pEnv[key] as string;
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

