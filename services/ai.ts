import { GoogleGenAI } from "@google/genai";

const env = (import.meta as any).env || {};

// --- CONFIGURAÇÃO DA CHAVE ---
// Se você não conseguir configurar o .env ou Vercel, 
// pode colar sua chave diretamente dentro das aspas abaixo para testar:
const MANUAL_API_KEY = ""; 

const apiKey = env.VITE_GOOGLE_API_KEY || MANUAL_API_KEY;

let ai: GoogleGenAI | null = null;

if (apiKey && apiKey.length > 10) { // Check simples se a chave parece válida
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error("Erro ao iniciar IA:", e);
  }
}

export const aiService = {
  sendMessage: async (message: string): Promise<string> => {
    // 1. MODO OFFLINE (Se não tiver chave, responde mockado para não dar erro)
    if (!ai) {
      console.warn("ZE DA OBRA: Modo Offline (Sem API Key)");
      
      // Simulação de inteligência para o usuário não ficar travado
      const lowerMsg = message.toLowerCase();
      
      await new Promise(r => setTimeout(r, 1000)); // Simula tempo de pensar

      if (lowerMsg.includes('olá') || lowerMsg.includes('oi') || lowerMsg.includes('bom dia')) {
          return "Fala, chefe! Tô na área. Como estou no 'Modo Offline' (sem a Chave de API configurada), sei pouca coisa, mas tô aqui!";
      }
      if (lowerMsg.includes('cimento') || lowerMsg.includes('concreto') || lowerMsg.includes('traço')) {
          return "No traço padrão pra concreto forte, a gente usa: 1 lata de cimento, 2 de areia e 3 de pedra. E cuidado com a água, hein!";
      }
      if (lowerMsg.includes('piso') || lowerMsg.includes('revestimento') || lowerMsg.includes('azulejo')) {
          return "Pra piso, a regra de ouro é comprar 10% a 15% a mais pra cobrir os recortes e quebras. Melhor sobrar do que faltar!";
      }
      if (lowerMsg.includes('tinta') || lowerMsg.includes('pintura')) {
          return "Na pintura, o segredo é o lixamento e a limpeza antes da tinta. Se a parede tiver pó, a tinta descasca depois. E forre bem o chão!";
      }
      if (lowerMsg.includes('telhado') || lowerMsg.includes('telha')) {
          return "Telhado tem que ter caimento certo. Se for telha cerâmica, pelo menos 30% de inclinação, senão volta água quando chove vento.";
      }

      return "Chefe, como estou sem a minha 'memória completa' (API Key do Google não configurada), só sei responder sobre o básico da obra.\n\nPara eu ficar inteligente de verdade, você precisa configurar a chave VITE_GOOGLE_API_KEY no Vercel.";
    }

    // 2. MODO ONLINE (Com Inteligência Real)
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: message,
        config: {
          systemInstruction: "Você é o Zé da Obra, um mestre de obras experiente, prático, honesto e bem humorado. Você ajuda donos de obra com dicas de economia, materiais e processos construtivos. Use linguagem coloquial brasileira, chame o usuário de 'Chefe' ou 'Patrão'. Seja direto, evite termos muito técnicos sem explicação e sempre tente dar uma dica de economia no final. Responda em parágrafos curtos.",
        }
      });
      
      return response.text || "Ixi, chefe. Me deu um branco aqui. Pode perguntar de novo?";
    } catch (error) {
      console.error("Erro na IA:", error);
      return "A obra tá sem sinal, chefe! Tive um problema para conectar com o Google. (Verifique a API Key no console)";
    }
  }
};