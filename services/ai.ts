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
      // Simula respostas técnicas para evitar que o app quebre sem a chave
      const lowerMsg = message.toLowerCase();
      
      await new Promise(r => setTimeout(r, 1000)); // Delay para parecer real

      if (lowerMsg.includes('concreto') || lowerMsg.includes('traço')) {
          return "Para concreto estrutural fck 25 Mpa, recomendo o traço 1:2:3 (1 parte de cimento, 2 de areia média, 3 de brita 1) com fator água/cimento controlado (aprox 0.55). Certifique-se da cura úmida por pelo menos 7 dias.";
      }
      if (lowerMsg.includes('piso') || lowerMsg.includes('cerâmica')) {
          return "Para assentamento, verifique o nível do contrapiso. Utilize argamassa AC-III para porcelanatos ou áreas externas para garantir aderência química. Respeite sempre a junta de dilatação indicada pelo fabricante.";
      }
      if (lowerMsg.includes('tinta') || lowerMsg.includes('pintura')) {
          return "A preparação da superfície é crítica. Lixe, limpe o pó e aplique fundo preparador ou selador antes da tinta. Para áreas externas, utilize tinta acrílica emborrachada ou standard de boa procedência para maior durabilidade.";
      }

      return "No momento estou sem conexão com a base de dados (API Key não configurada). Por favor, verifique a configuração para que eu possa fornecer suporte técnico completo.";
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: message,
        config: {
          systemInstruction: "Você é o Zeca da Obra, um engenheiro civil e mestre de obras com vasta experiência técnica. Sua comunicação é direta, precisa e profissional. Você domina normas técnicas (ABNT), propriedades dos materiais e gestão de projetos. Evite gírias excessivas. Seu objetivo é fornecer orientações técnicas, seguras e eficientes, focando na qualidade e durabilidade da construção, além da viabilidade econômica. Responda de forma concisa e fundamentada.",
        }
      });
      
      return response.text || "Poderia reformular a pergunta? Preciso de mais detalhes técnicos para responder adequadamente.";
    } catch (error) {
      console.error("Erro na IA:", error);
      return "Houve uma interrupção na conexão. Por favor, tente novamente em instantes.";
    }
  }
};