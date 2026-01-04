
import { GoogleGenAI, Type } from "@google/genai";
import { Work, AIWorkPlan } from "../types.ts"; // NEW: Import Work and AIWorkPlan types

// Helper function to safely get environment variables, checking both process.env and import.meta.env
const safeGetEnv = (key: string): string | undefined => {
  let value: string | undefined;

  // Prioriza import.meta.env para ambientes de cliente (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env[key] === 'string') {
    value = import.meta.env[key];
    // console.log(`[AI safeGetEnv] Lendo ${key} de import.meta.env. Valor: ${value ? 'CONFIGURADO' : 'UNDEFINED'}`); // Desativado para reduzir logs
    // FIX: Explicitly check for the string "undefined" which can occur if JSON.stringify(undefined) is used.
    if (value && value !== 'undefined') return value;
  } else {
    // console.log(`[AI safeGetEnv] import.meta.env.${key} não disponível ou não é string.`); // Desativado para reduzir logs
  }
  
  // Fallback to process.env (serverless functions, Node.js)
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    value = process.env[key];
    // console.log(`[AI safeGetEnv] Lendo ${key} de process.env. Valor: ${value ? 'CONFIGURADO' : 'UNDEFINED'}`); // Desativado para reduzir logs
    // FIX: Explicitly check for the string "undefined".
    if (value && value !== 'undefined') return value;
  } else {
    // console.log(`[AI safeGetEnv] process.env.${key} não disponível ou não é string.`); // Desativado para reduzir logs
  }

  console.warn(`[AI safeGetEnv] Variável de ambiente '${key}' não encontrada em nenhum contexto.`);
  return undefined;
};

// Access API_KEY using the safeGetEnv helper
const apiKey = safeGetEnv('VITE_GOOGLE_API_KEY');

let ai: GoogleGenAI | null = null;

// NEW: Strict check for API key
if (!apiKey) {
  console.error("ERRO CRÍTICO: Google GenAI API Key (VITE_GOOGLE_API_KEY) não está configurada.");
  console.error("Por favor, adicione sua chave de API nas variáveis de ambiente do seu ambiente de deploy (Vercel, etc.) como 'VITE_GOOGLE_API_KEY' ou no seu arquivo .env local.");
} else {
  ai = new GoogleGenAI({ apiKey: apiKey });
  console.log("Google GenAI inicializado com sucesso.");
}

export const aiService = {
  // NEW: Função para chat conversacional (com respostas potencialmente mais longas)
  chat: async (message: string): Promise<string> => {
    if (!ai) {
      // OFFLINE FALLBACK MODE (Existing logic)
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
          // System instruction ajustada para concisão no chat
          systemInstruction: "Seu nome é Zé da Obra. Você é um mestre de obras e engenheiro experiente. Seu objetivo é dar conselhos diretos e incisivos sobre economia, cronograma e segurança na obra, sempre focado em evitar prejuízos. Use linguagem clara, prática e profissional. Responda com no MÁXIMO 100 palavras, a menos que uma explicação mais detalhada seja estritamente necessária para a segurança ou para evitar um grande prejuízo. Seja um parceiro técnico, não um professor. Não use gírias ou informalidades excessivas. Apresente as informações de forma clara e objetiva.",
          maxOutputTokens: 100, // Limita o tamanho da resposta no chat
          thinkingConfig: { thinkingBudget: 0 }, // Desabilita o "pensamento" para respostas rápidas e diretas
        }
      });
      
      return response.text || "Não entendi direito. Pode me explicar melhor o que você precisa na obra?";
    } catch (error) {
      console.error("Erro na IA:", error);
      return "Tive um problema de conexão aqui. Tenta de novo em um minutinho.";
    }
  },

  // NEW: Função para insights curtos e incisivos em contexto de obra
  getWorkInsight: async (context: string): Promise<string> => {
    if (!ai) {
      // OFFLINE FALLBACK MODE for proactive insights
      await new Promise(r => setTimeout(r, 500)); // Shorter delay for proactive
      if (context.includes('material em falta')) return "Material crítico em falta pode parar a obra! Verifique a compra já.";
      if (context.includes('etapa atrasada')) return "Etapa com prazo estourado! Avalie o status para não perder mais tempo e dinheiro.";
      if (context.includes('estoque baixo')) return "Nível de estoque baixo. Reabasteça para manter o ritmo da etapa.";
      if (context.includes('próxima etapa')) return "Próxima etapa chegando. Confirme recursos e equipe para um bom início.";
      if (context.includes('quase concluída')) return "Etapa quase finalizada! Hora de checar a qualidade e planejar o fechamento.";
      return "Estou sem conexão para dar a dica, mas a atenção ao cronograma é sempre crucial.";
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: context,
        config: {
          // System instruction rigorosa para respostas curtas e incisivas
          systemInstruction: "Seu nome é Zé da Obra. Você é um mestre de obras e engenheiro extremamente experiente. \n\n**Seu objetivo:** Fornecer uma **única frase (máximo 20 palavras)**, direta, incisiva e acionável, focada em economia, controle de cronograma ou prevenção de prejuízo. Não divague, vá direto ao ponto como um alerta ou dica essencial.\n\n**Exemplos de tom:**\n- 'Material XYZ em falta para a etapa ABC. Compre agora para evitar atrasos!'\n- 'Etapa X atrasada há 5 dias. Revise o cronograma urgente!'\n- 'Estoque de cimento baixo. Recomendo comprar mais 5 sacos para a próxima semana.'\n- 'Próxima etapa: Fundações. Não pule a impermeabilização do baldrame para evitar umidade futura.'\n- 'Etapa de pintura quase no fim. Faça a vistoria final antes de liberar o pagamento.'",
          maxOutputTokens: 50, // Limita o tamanho da resposta
          thinkingConfig: { thinkingBudget: 0 }, // Desabilita o "pensamento" para respostas rápidas e diretas
        }
      });
      
      const insight = response.text?.trim();
      return insight || "Não consegui gerar uma dica agora. Tente novamente.";
    } catch (error) {
      console.error("Erro na IA ao gerar Work Insight:", error);
      return "Ops! O Zé está com problemas de comunicação. Tente novamente mais tarde.";
    }
  },

  // NEW: Função para gerar um plano de obra estruturado e avaliação de riscos
  generateWorkPlanAndRisk: async (work: Work): Promise<AIWorkPlan> => {
    if (!ai) {
      // OFFLINE FALLBACK MODE
      await new Promise(r => setTimeout(r, 2000));
      return {
        timelineSummary: "Funcionalidade de Planejamento AI offline. Por favor, configure sua chave de API.",
        detailedSteps: [{ name: "Erro: AI Offline", estimatedDurationDays: 0, notes: "Recarregue a página ou configure a chave API." }],
        potentialRisks: [{ description: "Sem conexão com a IA", likelihood: 'high', mitigation: "Verifique a internet e a configuração da chave API." }],
        materialSuggestions: [],
        generalAdvice: "Conecte-se para obter um plano completo!"
      };
    }

    const prompt = `
      Crie um plano de obra detalhado, avaliação de riscos e sugestões de materiais para o seguinte projeto.
      O nome da obra é "${work.name}", localizada em ${work.address || 'local não especificado'}, com área de ${work.area} m².
      A data de início planejada é ${work.startDate}.
      O orçamento planejado é de R$ ${work.budgetPlanned}.
      Possui ${work.floors || 1} pavimento(s), ${work.bedrooms || 0} quarto(s), ${work.bathrooms || 0} banheiro(s), ${work.kitchens || 0} cozinha(s) e ${work.livingRooms || 0} sala(s).
      ${work.hasLeisureArea ? 'Possui área de lazer/piscina.' : 'Não possui área de lazer/piscina.'}
      Notas adicionais: ${work.notes || 'Nenhuma nota adicional.'}

      Considere os dados acima para gerar um plano realista, identificando etapas-chave, durações estimadas, riscos comuns para este tipo de projeto e sugestões de materiais relevantes.
      Apresente a resposta estritamente no formato JSON, conforme o schema fornecido.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", // Modelo para tarefas complexas
        contents: prompt,
        config: {
          systemInstruction: "Você é o Zé da Obra AI, um engenheiro e planejador de obras experiente. Sua tarefa é fornecer um plano de obra completo, incluindo cronograma, riscos e materiais, de forma estruturada e realista para o usuário. Foque na prevenção de problemas e otimização de recursos. A resposta deve ser um JSON válido e seguir o schema estritamente. Evite gírias e seja profissional.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              timelineSummary: { type: Type.STRING, description: 'Um resumo conciso do cronograma geral da obra, incluindo a duração total estimada.' },
              detailedSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: 'Nome da etapa (ex: Fundações, Alvenaria, Elétrica).' },
                    estimatedDurationDays: { type: Type.NUMBER, description: 'Duração estimada em dias para esta etapa.' },
                    notes: { type: Type.STRING, description: 'Breves notas ou dicas importantes para a etapa.' },
                  },
                  required: ['name', 'estimatedDurationDays', 'notes'],
                },
                description: 'Lista detalhada das principais etapas da obra com duração e notas.',
              },
              potentialRisks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING, description: 'Descrição do risco potencial (ex: Atraso na entrega de materiais, Chuvas excessivas).' },
                    likelihood: { type: Type.STRING, enum: ['low', 'medium', 'high'], description: 'Probabilidade de ocorrência do risco.' },
                    mitigation: { type: Type.STRING, description: 'Estratégias para mitigar ou evitar o risco.' },
                  },
                  required: ['description', 'likelihood', 'mitigation'],
                },
                description: 'Lista de riscos potenciais da obra e como mitigá-los.',
              },
              materialSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING, description: 'Nome do material sugerido (ex: Cimento CP-III, Tijolo Cerâmico).' },
                    reason: { type: Type.STRING, description: 'Motivo da sugestão ou benefício.' },
                    priority: { type: Type.STRING, enum: ['low', 'medium', 'high'], description: 'Prioridade da compra/consideração deste material.' },
                  },
                  required: ['item', 'reason', 'priority'],
                },
                description: 'Sugestões de materiais relevantes para o projeto, com foco em qualidade/custo-benefício.',
              },
              generalAdvice: { type: Type.STRING, description: 'Um conselho geral final sobre a gestão da obra.' },
            },
            required: ['timelineSummary', 'detailedSteps', 'potentialRisks', 'materialSuggestions', 'generalAdvice'],
          },
        },
      });

      const jsonStr = response.text?.trim();
      if (!jsonStr) {
        throw new Error("A IA não retornou um plano de obra. Tente novamente.");
      }
      return JSON.parse(jsonStr) as AIWorkPlan;

    } catch (error) {
      console.error("Erro na IA ao gerar plano de obra:", error);
      // Retorna uma estrutura de fallback em caso de erro da IA
      return {
        timelineSummary: "Erro ao gerar plano de obra. Verifique sua conexão e tente novamente.",
        detailedSteps: [{ name: "Erro na Geração", estimatedDurationDays: 0, notes: "Não foi possível obter o plano detalhado." }],
        potentialRisks: [{ description: "Falha na comunicação com a IA", likelihood: 'high', mitigation: "Verifique sua chave de API e conexão de internet." }],
        materialSuggestions: [],
        generalAdvice: "O Zé está com problemas técnicos. Tente mais tarde."
      };
    }
  }
};
