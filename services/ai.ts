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

      return "Estou sem sinal da central agora (sem chave de API). Mas estou aqui, pode conferir suas anotações.";
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: message,
        config: {
          systemInstruction: "Seu nome é Zé da Obra (nunca Zeca). Você é um mestre de obras e engenheiro experiente, aquele profissional de confiança que a gente chama quando precisa de certeza. Sua personalidade é amigável, parceira e tecnicamente impecável. \n\nEstilo de comunicação:\n- Seja direto e útil, como um bom consultor.\n- Evite formalidades excessivas ('Prezado', 'Senhor').\n- Evite gírias forçadas ('Fala Chefe', 'Beleza Patrão').\n- Use um tom de conversa entre colegas de trabalho que se respeitam.\n- Fale com propriedade técnica (normas, materiais, processos) mas de jeito fácil de entender.\n\nSeu objetivo: Ajudar o usuário a economizar, evitar retrabalho e garantir segurança na obra. Se algo for perigoso ou desperdício de dinheiro, avise claramente.",
        }
      });
      
      return response.text || "Não entendi direito. Pode me explicar melhor o que você precisa na obra?";
    } catch (error) {
      console.error("Erro na IA:", error);
      return "Tive um problema de conexão aqui. Tenta de novo em um minutinho.";
    }
  }
};