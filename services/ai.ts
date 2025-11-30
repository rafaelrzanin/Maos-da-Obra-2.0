import { GoogleGenAI } from "@google/genai";

const env = (import.meta as any).env || {};
const apiKey = env.VITE_GOOGLE_API_KEY;

// Campo para chave manual se não configurar no .env
// Exemplo: const MANUAL_KEY = "AIza...";
const MANUAL_KEY = "";

let ai: GoogleGenAI | null = null;
const effectiveKey = apiKey || MANUAL_KEY;

if (effectiveKey) {
  ai = new GoogleGenAI({ apiKey: effectiveKey });
}

export const aiService = {
  sendMessage: async (message: string): Promise<string> => {
    if (!ai) {
      // OFFLINE FALLBACK MODE
      // Simula respostas úteis para evitar que o app quebre sem a chave
      const lowerMsg = message.toLowerCase();
      
      await new Promise(r => setTimeout(r, 1000)); // Delay para parecer real

      if (lowerMsg.includes('concreto') || lowerMsg.includes('traço')) {
          return "Opa Chefe! Sem internet aqui na obra (API Key não configurada), mas anota o traço padrão pra concreto forte: 1 saco de cimento, 4 latas de areia, 6 latas de brita e 1 lata e meia de água. Fica show!";
      }
      if (lowerMsg.includes('piso') || lowerMsg.includes('cerâmica')) {
          return "Patrão, pra piso, lembra de conferir o nível antes! E usa argamassa AC-III se for porcelanato grande ou área externa, beleza?";
      }
      if (lowerMsg.includes('tinta') || lowerMsg.includes('pintura')) {
          return "Pra pintura render, lixa bem a parede antes, chefe. Se tiver mofo, passa água sanitária antes de tudo.";
      }

      return "Chefe, tô meio sem sinal (API Key do Google não configurada). Mas tô aqui! Configura a chave lá no Vercel que eu fico 100%. Enquanto isso, vai tocando a obra aí que eu torço daqui!";
    }

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
      return "A obra tá sem sinal, chefe! Tive um problema para conectar. Tenta de novo daqui a pouco.";
    }
  }
};