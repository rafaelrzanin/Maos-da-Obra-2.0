import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Work, AIWorkPlan } from "../types.ts";

// Helper function to safely get environment variables
const safeGetEnv = (key: string): string | undefined => {
  let value: string | undefined;
  if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env[key] === 'string') {
    value = import.meta.env[key];
    if (value && value !== 'undefined') return value;
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    value = process.env[key];
    if (value && value !== 'undefined') return value;
  }
  console.warn(`[AI safeGetEnv] Variável de ambiente '${key}' não encontrada.`);
  return undefined;
};

const apiKey = safeGetEnv('VITE_GOOGLE_API_KEY');
let ai: GoogleGenAI | null = null;

if (!apiKey) {
  console.error("ERRO CRÍTICO: Google GenAI API Key não configurada.");
} else {
  ai = new GoogleGenAI(apiKey);
}

export const aiService = {
  chat: async (message: string, workContext?: string): Promise<string> => {
    if (!ai) {
      const lowerMsg = message.toLowerCase();
      await new Promise(r => setTimeout(r, 1000)); 
      if (lowerMsg.includes('concreto')) return "Para um concreto bom, estrutural (25 Mpa), a medida segura é 1 lata de cimento, 2 de areia e 3 de brita.";
      return "Estou sem sinal da central agora (sem chave de API).";
    }

    try {
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const systemInstruction = `Você é o Zé da Obra... ${workContext ? `Contexto: ${workContext}` : ''}`;
      const response = await model.generateContent(message);
      return response.response.text();
    } catch (error) {
      console.error("Erro na IA:", error);
      return "Tive um problema de conexão aqui.";
    }
  },

  getWorkInsight: async (context: string): Promise<string> => {
    if (!ai) return "A atenção ao cronograma é sempre crucial.";
    try {
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const response = await model.generateContent(context);
      return response.response.text().trim();
    } catch { return "Erro ao gerar dica."; }
  },

  generateWorkPlanAndRisk: async (work: Work): Promise<AIWorkPlan> => {
    if (!ai) throw new Error("IA Offline");
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`Gere um plano de obra JSON para ${work.name}`);
    return JSON.parse(result.response.text());
  }
};

/**
 * COMPONENTE VISUAL AIChat
 * Necessário para o App.tsx importar como padrão
 */
const AiChat: React.FC = () => {
  const [messages, setMessages] = useState<{role: 'user' | 'ze', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    const res = await aiService.chat(msg);
    setMessages(prev => [...prev, { role: 'ze', text: res }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-screen p-4 max-w-2xl mx-auto">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="flex gap-2">
        <input className="flex-1 border p-2 rounded" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
        <button onClick={handleSend} className="bg-green-600 text-white px-4 py-2 rounded">Enviar</button>
      </div>
    </div>
  );
};

// EXPORTAÇÃO QUE RESOLVE O ERRO DO VERCEL
export default AiChat;
