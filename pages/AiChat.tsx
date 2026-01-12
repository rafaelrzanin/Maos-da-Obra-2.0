
import { GoogleGenAI, Type } from "@google/genai";
import { Work, AIWorkPlan } from "../types.ts";

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
  chat: async (message: string, workContext?: string): Promise<string> => { // MODIFIED signature: added workContext
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
      // MODIFIED: contents now accepts the full message, which might already contain the context
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: message, // Message already contains workContext if available
        config: {
          systemInstruction: `Você é o Zé da Obra, um mestre de obras e engenheiro experiente e prático. Seu papel é ajudar o usuário a entender a obra.
            Você entende de obra de verdade, já acompanhou várias obras e sabe explicar para quem não entende nada, de forma simples, direta e humana.
            Você não usa linguagem acadêmica, jargão técnico pesado, estereótipos de pedreiro ou engenheiro, nem termos complicados sem explicar.

            Sempre explique: o "porquê", as consequências práticas e de forma simples.

            Você entende a sequência lógica de uma obra, a importância do cronograma, a dependência entre etapas, o impacto de atraso em etapas, a relação entre cronograma e materiais, e a relação entre compras e financeiro.

            ${workContext ? `**INSTRUÇÃO CRÍTICA:** Um CONTEXTO DA OBRA foi fornecido no início da sua conversa. Use SOMENTE as informações contidas nesse CONTEXTO para analisar o andamento, materiais e financeiro da obra.
            Se o CONTEXTO DA OBRA for fornecido, mas for insuficiente para responder à pergunta específica, diga ao usuário que você precisa de mais detalhes sobre o que ele REGISTROU no aplicativo.
            Não tente adivinhar ou presumir informações que não estão explicitamente no CONTEXTO.

            Com base no CONTEXTO DA OBRA fornecido, você pode:
            - Analisar andamento: "Pelo que está registrado no cronograma, o progresso é X%..."
            - Identificar atrasos: "Com base nas datas do cronograma, a etapa Y parece estar atrasada."
            - Apontar gargalos: "O que chama atenção no contexto é a escassez de material Z, que pode atrasar a etapa W."
            - Sugerir atenção em etapas críticas: "Recomendo dar uma olhada na etapa A, ela é crucial para o próximo bloco de trabalho."
            Sempre com tom calmo, construtivo e sem alarmismo.
            ` : `**INSTRUÇÃO CRÍTICA:** Nenhum CONTEXTO DA OBRA foi fornecido. Se o usuário perguntar sobre o andamento, status ou evolução da obra, você DEVE dizer que precisa de mais informações sobre qual obra ele quer falar ou pedir para ele registrar mais dados no aplicativo para que você possa analisar. Não tente analisar se não há contexto.
            `}
            Nunca invente análises ou presuma dados inexistentes. Se faltarem informações, diga que "ainda faltam informações para avaliar isso melhor" ou "com mais registros no app, consigo te ajudar melhor" e incentive o registro de dados.

            Seu objetivo final é fazer o usuário sentir que a obra está sendo acompanhada, que alguém entende o que está acontecendo e que o app evolui junto com a obra, e que você é um aliado real.
            Responda com no MÁXIMO 200 palavras, a menos que uma explicação mais detalhada seja estritamente necessária para a segurança ou para evitar um grande prejuízo.`,
          maxOutputTokens: 200, // Limita o tamanho da resposta no chat
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
  // Adaptei para ser mais conciso e adequado para notificações
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
          // System instruction ajustada para respostas curtas e incisivas para notificações
          systemInstruction: `Você é o Zé da Obra. Você é um mestre de obras e engenheiro experiente. 
            Seu objetivo: Fornecer uma **única frase (máximo 25 palavras)**, direta, incisiva e acionável, focada em economia, controle de cronograma ou prevenção de prejuízo. Não divague, vá direto ao ponto como um alerta ou dica essencial para ser usada em uma notificação.
            Seja um parceiro técnico, não um professor. Não use gírias ou informalidades excessivas. Apresente as informações de forma clara e objetiva.`,
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

  // NEW: Função para gerar um plano de obra detalhado e análise de risco (Re-adicionada)
  generateWorkPlanAndRisk: async (work: Work): Promise<AIWorkPlan> => {
    if (!ai) {
      // OFFLINE FALLBACK MODE for plan generation
      await new Promise(r => setTimeout(r, 2000));
      return {
        workId: work.id,
        generalAdvice: "A IA está offline. Não foi possível gerar um plano detalhado. Verifique suas anotações e contatos para gerenciar a obra.",
        timelineSummary: "Plano offline. Organize suas etapas manualmente.",
        detailedSteps: [{ orderIndex: 1, name: "Fase 1: Preparação", estimatedDurationDays: 10, notes: "Defina seus materiais." }],
        potentialRisks: [{ description: "Risco de atraso.", likelihood: "high", mitigation: "A IA está offline." }],
        materialSuggestions: [{ item: "Cimento", priority: "medium", reason: "Sempre essencial." }],
      };
    }

    try {
      const prompt = `Você é o Zé da Obra AI, um mestre de obras experiente e engenheiro. Gere um plano de obra detalhado e inteligente para o projeto "${work.name}" localizado em "${work.address}".
        O orçamento planejado é de R$${work.budgetPlanned}, com área de ${work.area}m².
        Detalhes da construção: ${work.floors} pavimento(s), ${work.bedrooms} quarto(s), ${work.bathrooms} banheiro(s), ${work.kitchens} cozinha(s).
        Início da obra: ${work.startDate}.
        
        Gere um JSON com as seguintes seções, seguindo estritamente o formato AIWorkPlan e focando em um cronograma LÓGICO, NUMÉRICO e GENERALIZADO por etapas, sem detalhar por cômodos (ex: não crie 'Banheiro 1', use 'Instalações Hidráulicas'):

        1. "generalAdvice": Um conselho geral, incisivo e profissional, como um mestre de obras daria, focado em economia e eficiência. (1 frase)
        2. "timelineSummary": Um resumo conciso da duração e dos marcos principais da obra, considerando os detalhes fornecidos. (2-3 frases)
        3. "detailedSteps": Uma lista de 5-8 etapas macro da obra, em ordem LÓGICA e NUMÉRICA. Para cada etapa, inclua:
           - "orderIndex": Número da etapa (1, 2, 3...).
           - "name": Nome da etapa generalizada (ex: "Fundações", "Instalações Hidráulicas", "Acabamentos Internos"). NÃO detalhe por cômodos (ex: "Hidráulica do Banheiro 1" é PROIBIDO).
           - "estimatedDurationDays": Duração estimada em dias, considerando a complexidade da obra (área, número de pavimentos, banheiros, cozinhas, etc.).
           - "notes": Uma dica prática ou observação importante para essa etapa, relacionada à economia, segurança ou qualidade, e que reflita a complexidade dos detalhes da obra (ex: para "Instalações Hidráulicas", mencionar a complexidade devido aos X banheiros e Y cozinhas).
        4. "potentialRisks": 2-3 riscos potenciais relevantes para a obra, com "description", "likelihood" ('low', 'medium', 'high'), e "mitigation" (como evitar/resolver).
        5. "materialSuggestions": 2-3 sugestões de materiais chave, com "item", "priority" ('low', 'medium', 'high'), e "reason" (por que é importante).
        
        O JSON deve ser formatado estritamente como o tipo AIWorkPlan:
        interface AIWorkPlan {
          workId: string;
          generalAdvice: string;
          timelineSummary: string;
          detailedSteps: {
            orderIndex?: number; 
            name: string;
            estimatedDurationDays: number;
            notes: string;
          }[];
          potentialRisks: {
            description: string;
            likelihood: 'low' | 'medium' | 'high';
            mitigation: string;
          }[];
          materialSuggestions: {
            item: string;
            priority: 'low' | 'medium' | 'high';
            reason: string;
          }[];
        }
        Certifique-se de que o workId seja '${work.id}'.
        Apresente SOMENTE o JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", // Usar modelo mais capaz para planos complexos
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: { // NEW: Define the schema for structured JSON output
            type: Type.OBJECT,
            properties: {
              workId: { type: Type.STRING },
              generalAdvice: { type: Type.STRING },
              timelineSummary: { type: Type.STRING },
              detailedSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    orderIndex: { type: Type.NUMBER },
                    name: { type: Type.STRING },
                    estimatedDurationDays: { type: Type.NUMBER },
                    notes: { type: Type.STRING },
                  },
                  required: ['name', 'estimatedDurationDays', 'notes'],
                },
              },
              potentialRisks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    likelihood: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                    mitigation: { type: Type.STRING },
                  },
                  required: ['description', 'likelihood', 'mitigation'],
                },
              },
              materialSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                    reason: { type: Type.STRING },
                  },
                  required: ['item', 'priority', 'reason'],
                },
              },
            },
            required: ['workId', 'generalAdvice', 'timelineSummary', 'detailedSteps', 'potentialRisks', 'materialSuggestions'],
          },
          temperature: 0.7,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 100 }, // Permitir mais "pensamento" para planos complexos
        }
      });
      
      const jsonStr = response.text?.trim();
      if (!jsonStr) throw new Error("A IA não retornou um plano válido.");

      const parsedPlan: AIWorkPlan = JSON.parse(jsonStr);
      // Ensure workId is correctly set as per current work (override if AI gets it wrong)
      parsedPlan.workId = work.id; 
      return parsedPlan;

    } catch (error) {
      console.error("Erro na IA ao gerar plano de obra:", error);
      throw new Error(`Falha na comunicação com a IA: ${error.message || 'Erro desconhecido.'}`);
    }
  }
};
