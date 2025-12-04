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