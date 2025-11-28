import { GoogleGenAI } from "@google/genai";

const env = (import.meta as any).env || {};
const apiKey = env.VITE_GOOGLE_API_KEY;

let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const aiService = {
  sendMessage: async (message: string): Promise<string> => {
    if (!ai) {
      return "Opa, chefe! Para eu funcionar, preciso que você configure a chave de API (VITE_GOOGLE_API_KEY) no seu projeto.";
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