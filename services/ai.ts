

import { GoogleGenAI } from "@google/genai";

// Helper function to safely get environment variables, checking both process.env and import.meta.env
const safeGetEnv = (key: string): string | undefined => {
  let value: string | undefined;

  // Prefer process.env first as per GenAI guidelines
  // With Vite's define, process.env.API_KEY will be directly available in the browser.
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    value = process.env[key];
    console.log(`[AI safeGetEnv] Lendo ${key} de process.env. Valor: ${value ? 'CONFIGURADO' : 'UNDEFINED'}`);
    // FIX: Explicitly check for the string "undefined" which can occur if JSON.stringify(undefined) is used.
    if (value && value !== 'undefined') return value;
  } else {
    console.log(`[AI safeGetEnv] process.env.${key} não disponível ou não é string.`);
  }
  
  // Fallback to import.meta.env for Vite client-side environments if necessary
  // (though with 'define' for process.env.API_KEY, this block might become less critical for API_KEY specifically)
  if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env[key] === 'string') {
    value = import.meta.env[key];
    console.log(`[AI safeGetEnv] Lendo ${key} de import.meta.env. Valor: ${value ? 'CONFIGURADO' : 'UNDEFINED'}`);
    // FIX: Explicitly check for the string "undefined".
    if (value && value !== 'undefined') return value;
  } else {
    console.log(`[AI safeGetEnv] import.meta.env.${key} não disponível ou não é string.`);
  }

  console.warn(`[AI safeGetEnv] Variável de ambiente '${key}' não encontrada em nenhum contexto.`);
  return undefined;
};

// Access API_KEY using the safeGetEnv helper
const apiKey = safeGetEnv('API_KEY'); // This will now correctly map to VITE_GOOGLE_API_KEY via vite.config.ts

let ai: GoogleGenAI | null = null;

// NEW: Strict check for API key
if (!apiKey) {
  console.error("ERRO CRÍTICO: Google GenAI API Key (process.env.API_KEY) não está configurada.");
  console.error("Por favor, adicione sua chave de API nas variáveis de ambiente do seu ambiente de deploy (Vercel, etc.) como 'VITE_GOOGLE_API_KEY' ou no seu arquivo .env local.");
  // A mensagem no frontend já indicará a falta, mas o console será mais explícito.
  // Não lançaremos um erro para que o fallback offline possa ser exibido.
} else {
  ai = new GoogleGenAI({ apiKey: apiKey });
  console.log("Google GenAI inicializado com sucesso.");
}

export const aiService = {
  sendMessage: async (message: string): Promise<string> => {
    if (!ai) {
      // OFFLINE FALLBACK MODE
      const lowerMsg = message.toLowerCase();
      
      await new Promise(r => setTimeout(r, 1000)); 

      if (lowerMsg.includes('concreto') || lowerMsg.includes('traço')) {
          return "Para um concreto bom, estrutural (25 Mpa), a medida segura é 1 lata de cimento, 2 de areia e 3 de brita. Não exagere na água pra não enfraquecer.";
      }
      if (lowerMsg.includes('piso') || lowerMsg.includes('cerâmica')) {
          return "O segredo do piso é a base nivelada e a argamassa certa. Use AC-III se for porcelanato ou área externa. E respeite a junta que o fabricante pede na caixa.";
      }
      if (lowerMsg.includes('tinta') || lowerMsg.includes('pintura')) {
          return "Antes de pintar, lixe bem e tire o pó. Se a parede for nova, passe selador. Se for repintura com cor escura, talvez precise de mais demãos.";
      }

      return "Estou sem sinal da central agora (sem chave de API). Por favor, configure sua chave de API para o Zé da Obra AI funcionar. Mas estou aqui, pode conferir suas anotações.";
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: message,
        config: {
          systemInstruction: "Seu nome é Zé da Obra (não Zeca). Você é um mestre de obras e engenheiro extremamente experiente, com décadas de canteiro. \n\nSua Personalidade:\n- Confiável e Técnico: Você sabe o que diz. Não chuta. Cita as normas quando necessário (mas sem ser chato).\n- Parceiro: Você é aquele amigo mais velho que entende tudo de obra. Não use gírias forçadas ('E aí, chefe', 'Beleza, patrão'). Use um tom de respeito e camaradagem.\n- Direto ao Ponto: Responda o que foi perguntado. Se tiver risco de prejuízo ou segurança, avise imediatamente.\n\nExemplo de tom: 'Olha, para essa laje o ideal é usar malha pop 15x15. Se fizer sem, vai trincar tudo depois. O barato sai caro.'\n\nSeu objetivo: Ajudar o usuário a ter uma obra segura, de qualidade e sem desperdício de dinheiro.",
        }
      });
      
      return response.text || "Não entendi direito. Pode me explicar melhor o que você precisa na obra?";
    } catch (error) {
      console.error("Erro na IA:", error);
      return "Tive um problema de conexão aqui. Tenta de novo em um minutinho.";
    }
  }
};
