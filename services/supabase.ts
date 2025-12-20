
import { createClient } from '@supabase/supabase-js';

// Helper function to safely get environment variables, checking both import.meta.env and process.env
const safeGetEnv = (key: string): string | undefined => {
  let value: string | undefined;

  // Prioriza import.meta.env para ambientes de cliente (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env[key] === 'string') {
    value = import.meta.env[key];
    console.log(`[Supabase safeGetEnv] Lendo ${key} de import.meta.env. Valor: ${value ? 'CONFIGURADO' : 'UNDEFINED'}`);
    // FIX: Explicitly check for the string "undefined" which can occur if JSON.stringify(undefined) is used.
    if (value && value !== 'undefined') return value;
  } else {
    console.log(`[Supabase safeGetEnv] import.meta.env.${key} não disponível ou não é string.`);
  }
  
  // Fallback para process.env (serverless functions, Node.js)
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    value = process.env[key];
    console.log(`[Supabase safeGetEnv] Lendo ${key} de process.env. Valor: ${value ? 'CONFIGURADO' : 'UNDEFINED'}`);
    // FIX: Explicitly check for the string "undefined".
    if (value && value !== 'undefined') return value;
  } else {
    console.log(`[Supabase safeGetEnv] process.env.${key} não disponível ou não é string.`);
  }

  console.warn(`[Supabase safeGetEnv] Variável de ambiente '${key}' não encontrada em nenhum contexto.`);
  return undefined;
};

const supabaseUrl = safeGetEnv('VITE_SUPABASE_URL');
const supabaseKey = safeGetEnv('VITE_SUPABASE_ANON_KEY');

// Throw an error if environment variables are missing
if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO CRÍTICO: Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configuradas.");
  throw new Error("Configuração do Supabase ausente. Verifique suas variáveis de ambiente.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase CLIENTE INICIALIZADO com sucesso.");
