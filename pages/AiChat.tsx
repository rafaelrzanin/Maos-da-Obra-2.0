

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { aiService } from '../services/ai.ts';
import { PlanType } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

const AiChat: React.FC = () => {
  const { user, trialDaysRemaining } = useAuth();
  const navigate = useNavigate();

  const [aiMessage, setAiMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const isVitalicio = user?.plan === PlanType.VITALICIO;
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const hasAiAccess = isVitalicio || isAiTrialActive;

  useEffect(() => {
    // Clear response when component mounts to start fresh
    setAiResponse('');
  }, []);

  const handleAiAsk = async () => {
    if (!aiMessage.trim()) return;
    if (!hasAiAccess) return; // Should not happen if button is disabled, but for safety

    setAiLoading(true);
    const response = await aiService.sendMessage(aiMessage);
    setAiResponse(response);
    setAiLoading(false);
    setAiMessage('');
  };

  if (!hasAiAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in">
        <div className="w-full max-w-sm bg-gradient-to-br from-slate-900 to-slate-950 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-secondary/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-28 h-28 rounded-full border-4 border-slate-800 p-1 bg-gradient-gold shadow-[0_0_30px_rgba(217,119,6,0.4)] mb-6 transform hover:scale-105 transition-transform duration-500">
              <img src={ZE_AVATAR} className="w-full h-full object-cover rounded-full bg-white" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Zé da Obra <span className="text-secondary">AI</span></h2>
            <div className="h-1 w-12 bg-secondary rounded-full mb-6"></div>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium">Seu engenheiro virtual particular.</p>
            <button onClick={() => navigate('/settings')} className="w-full py-4 bg-gradient-gold text-white font-black rounded-2xl shadow-lg hover:shadow-orange-500/20 hover:scale-105 transition-all flex items-center justify-center gap-3 group-hover:animate-pulse">
              <i className="fa-solid fa-crown"></i> Liberar Acesso Vitalício
            </button>
            <p className="text-center text-[10px] text-slate-500 mt-4 flex items-center justify-center gap-1">
                <i className="fa-solid fa-info-circle"></i> Acesso à IA é exclusivo para assinantes Vitalícios
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[80vh] animate-in fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-primary dark:text-white mb-2 tracking-tight">Zé da Obra <span className="text-secondary">AI</span></h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Seu especialista 24h na palma da mão.</p>
      </div>
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-inner overflow-y-auto mb-4 border border-slate-200 dark:border-slate-800">
        <div className="flex gap-4 mb-6">
          <img src={ZE_AVATAR} className="w-10 h-10 rounded-full border border-slate-200" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} />
          <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-b-xl text-sm shadow-sm">
            <p className="font-bold text-secondary mb-1">Zé da Obra</p>
            <p>Opa! Mestre de obras na área. No que posso te ajudar hoje?</p>
          </div>
        </div>
        {aiResponse && (
          <div className="flex gap-4 mb-6 animate-in fade-in">
            <img src={ZE_AVATAR} className="w-10 h-10 rounded-full border border-slate-200" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} />
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-b-xl text-sm shadow-sm">
              <p className="font-bold text-secondary mb-1">Zé da Obra</p>
              <p className="whitespace-pre-wrap">{aiResponse}</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={aiMessage}
          onChange={(e) => setAiMessage(e.target.value)}
          placeholder="Pergunte ao Zé..."
          className="flex-1 p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-secondary transition-colors"
          disabled={aiLoading}
        />
        <button
          onClick={handleAiAsk}
          disabled={aiLoading || !aiMessage.trim()}
          className="w-14 bg-secondary text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
        </button>
      </div>
    </div>
  );
};

export default AiChat;
