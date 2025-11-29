import { GoogleGenAI } from "@google/genai";

const env = (import.meta as any).env || {};

// --- CONFIGURAÇÃO DA CHAVE ---
// Se você não conseguir configurar o .env ou Vercel, 
// pode colar sua chave diretamente dentro das aspas abaixo para testar:
const MANUAL_API_KEY = ""; 

const apiKey = env.VITE_GOOGLE_API_KEY || MANUAL_API_KEY;

let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const aiService = {
  sendMessage: async (message: string): Promise<string> => {
    if (!ai) {
      console.error("API Key do Google não encontrada.");
      return "Opa, chefe! Estou sem minha chave de acesso (API Key). \n\nPara eu funcionar, você precisa:\n1. Criar uma chave no Google AI Studio.\n2. Colocar no Vercel com o nome VITE_GOOGLE_API_KEY.\n3. Ou colar direto no arquivo 'services/ai.ts' onde diz MANUAL_API_KEY.";
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
      return "A obra tá sem sinal, chefe! Tive um problema para conectar com o Google. Verifique se sua chave API está ativa e correta.";
    }
  }
};