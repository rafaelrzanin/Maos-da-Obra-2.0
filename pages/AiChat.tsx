
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
// Removed: import { aiService } from '../services/ai'; // CRITICAL: REMOVED AI SERVICE IMPORT
import { PlanType, Work, Step, Material, Expense, StepStatus, ExpenseCategory, ExpenseStatus } from '../types.ts'; // NEW: Import Work, Step, Material, Expense types
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';
import { dbService } from '../services/db.ts'; // NEW: Import dbService

// CRITICAL FIX: Local mockAiService to entirely replace aiService in the browser
const mockAiService = {
  chat: async (message: string, workContext?: string): Promise<string> => {
    console.warn("MOCK AI SERVICE: chat called in browser. AI is disabled.");
    await new Promise(r => setTimeout(r, 1000)); // Simulate loading
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('concreto') || lowerMsg.includes('traço')) {
        return "Para um concreto bom, estrutural (25 Mpa), a medida segura é 1 lata de cimento, 2 de areia e 3 de brita. Não exagere na água pra não enfraquecer.";
    }
    if (lowerMsg.includes('piso') || lowerMsg.includes('cerâmica')) {
        return "O segredo do piso é a base nivelada e a argamassa certa. Use AC-III se for porcelanato ou área externa. E respeite a junta que o fabricante pede na caixa.";
    }
    if (lowerMsg.includes('tinta') || lowerMsg.includes('pintura')) {
        return "Antes de pintar, lixe bem e tire o pó. Se a parede for nova, passe selador. Se for repintura com cor escura, talvez precise de mais demãos.";
    }
    if (workContext && workContext.includes('CONTEXTO DA OBRA')) {
        return "O Zé está em modo offline no momento para analisar o contexto da obra. Por favor, configure sua chave de API ou acesse um plano Vitalício para usar a IA.";
    }

    return "A IA do Zé da Obra está offline no momento. Por favor, acesse um plano Vitalício para usar esta funcionalidade. Mas estou aqui, pode conferir suas anotações.";
  },
  getWorkInsight: async (context: string): Promise<string> => {
    console.warn("MOCK AI SERVICE: getWorkInsight called in browser. AI is disabled.");
    await new Promise(r => setTimeout(r, 500)); // Simulate loading
    if (context.includes('material em falta')) return "Material crítico em falta pode parar a obra! Verifique a compra já.";
    if (context.includes('etapa atrasada')) return "Etapa com prazo estourado! Avalie o status para não perder mais tempo e dinheiro.";
    if (context.includes('estoque baixo')) return "Nível de estoque baixo. Reabasteça para manter o ritmo da etapa.";
    if (context.includes('próxima etapa')) return "Próxima etapa chegando. Confirme recursos e equipe para um bom início.";
    if (context.includes('quase concluída')) return "Etapa quase finalizada! Hora de checar a qualidade e planejar o fechamento.";
    return "Estou sem conexão para dar a dica, mas a atenção ao cronograma é sempre crucial.";
  },
  generateWorkPlanAndRisk: async (work: Work): Promise<any> => { // Returns any to match expected object
    console.warn("MOCK AI SERVICE: generateWorkPlanAndRisk called in browser. AI is disabled.");
    await new Promise(r => setTimeout(r, 2000));
    return {
      workId: work.id,
      generalAdvice: "A IA está offline. Não foi possível gerar um plano detalhado. Verifique suas anotações e contatos para gerenciar a obra.",
      timelineSummary: "Plano offline. Organize suas etapas manualmente.",
      detailedSteps: [{ orderIndex: 1, name: "Fase 1: Preparação (OFFLINE)", estimatedDurationDays: 10, notes: "Defina seus materiais manualmente enquanto a IA está offline." }],
      potentialRisks: [{ description: "Risco de atraso devido a IA offline.", likelihood: "high", mitigation: "A IA está offline." }],
      materialSuggestions: [{ item: "Cimento (OFFLINE)", priority: "medium", reason: "Sempre essencial, mas a IA não pode sugerir agora." }],
    };
  }
};


interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

const AiChat = () => {
  const { user, trialDaysRemaining, authLoading } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [aiMessage, setAiMessage] = useState(''); // User's typed input OR final transcribed speech
  const [aiLoading, setAiLoading] = useState(false);

  // State for Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState(''); // Text from SpeechRecognition during active listening
  const recognitionRef = useRef<any>(null); // Use any for SpeechRecognition to avoid global type issues
  const latestRecognizedTextRef = useRef(''); // NEW: Ref to store latest recognizedText

  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // CRITICAL FIX: hasAiAccess will always be false in the browser for actual AI calls
  // The UI will still show "Vitalicio" if user has that plan, but the AI API calls won't function.
  const isVitalicio = user?.plan === PlanType.VITALICIO;
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const hasAiAccess = isVitalicio || isAiTrialActive; // This still drives the UI lock/unlock, but AI calls are mocked

  const [errorMsg, setErrorMsg] = useState(''); // For local errors like speech recognition

  // NEW: Work context states
  const [currentWork, setCurrentWork] = useState<Work | null>(null);
  const [workSteps, setWorkSteps] = useState<Step[]>([]);
  const [workMaterials, setWorkMaterials] = useState<Material[]>([]);
  const [workExpenses, setWorkExpenses] = useState<Expense[]>([]);
  const [loadingWorkContext, setLoadingWorkContext] = useState(false); // NEW: Loading state for work context


  // NEW: Update this ref whenever recognizedText changes
  useEffect(() => {
      latestRecognizedTextRef.current = recognizedText;
  }, [recognizedText]);

  // Initialize SpeechRecognition once
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Keep listening for continuous speech
      recognition.interimResults = true; // Get interim results
      recognition.lang = 'pt-BR'; // Set language to Brazilian Portuguese

      recognition.onresult = (event: any /* SpeechRecognitionEvent */) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        // Always update recognizedText with the latest interim or final part
        setRecognizedText(finalTranscript + interimTranscript); // Accumulate recognized text
      };

      recognition.onend = () => {
        console.log("Speech Recognition ended.");
        // Use the ref to get the LATEST recognizedText
        if (latestRecognizedTextRef.current.trim()) {
            setAiMessage(latestRecognizedTextRef.current.trim());
        }
        setIsListening(false); // Ensure listening state is false
        setRecognizedText(''); // Clear recognized text
      };

      recognition.onerror = (event: any /* SpeechRecognitionErrorEvent */) => {
        console.error('Speech recognition error:', event.error);
        setErrorMsg('Erro na gravação de voz. Tente novamente.');
        setIsListening(false);
        setRecognizedText('');
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('Speech Recognition API not supported in this browser.');
      // Optionally disable microphone button or show a message
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []); // CRITICAL FIX: Empty dependency array


  // NEW: Effect to load work context
  useEffect(() => {
    const loadContext = async () => {
      // Only load if user is authenticated and has AI access, and authLoading is false (stable auth state)
      if (!user?.id || !hasAiAccess || authLoading) { 
        setLoadingWorkContext(false);
        return;
      }

      setLoadingWorkContext(true);
      const lastSelectedWorkId = localStorage.getItem('lastSelectedWorkId');
      
      if (lastSelectedWorkId) {
        try {
          const workData = await dbService.getWorkById(lastSelectedWorkId);
          if (workData && workData.userId === user.id) { // Ensure work belongs to user
            setCurrentWork(workData);
            const stepsData = await dbService.getSteps(lastSelectedWorkId);
            setWorkSteps(stepsData);
            const materialsData = await dbService.getMaterials(lastSelectedWorkId);
            setWorkMaterials(materialsData);
            const expensesData = await dbService.getExpenses(lastSelectedWorkId);
            setWorkExpenses(expensesData);
            console.log("[AiChat] Work context loaded for:", workData.name);
          } else {
            setCurrentWork(null);
            setWorkSteps([]);
            setWorkMaterials([]);
            setWorkExpenses([]);
            console.log("[AiChat] Last selected work not found or not owned. No work context.");
          }
        } catch (err) {
          console.error("[AiChat] Error loading work context:", err);
          setCurrentWork(null);
          setWorkSteps([]);
          setWorkMaterials([]);
          setWorkExpenses([]);
        }
      } else {
        setCurrentWork(null);
        setWorkSteps([]);
        setWorkMaterials([]);
        setWorkExpenses([]);
        console.log("[AiChat] No last selected work in localStorage. No work context.");
      }
      setLoadingWorkContext(false);
    };

    if (!authLoading && user && hasAiAccess) { // Only load context if user is logged in AND has AI access AND auth is not loading
        loadContext();
    }
  }, [user, hasAiAccess, authLoading]); // Re-run if user/access/authLoading changes


  // Add initial AI welcome message
  useEffect(() => {
    // Only show welcome message if AI access is granted, no messages yet, auth is finished and work context is loaded (or confirmed absent)
    if (hasAiAccess && messages.length === 0 && !authLoading && !loadingWorkContext) {
      setMessages([{ id: 'ai-welcome', sender: 'ai', text: 'Opa! Mestre de obras na área. No que posso te ajudar hoje?' }]);
    }
  }, [hasAiAccess, messages.length, authLoading, loadingWorkContext]); // Add loadingWorkContext as dependency


  // Scroll to bottom of chat messages whenever messages update
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);


  // NEW: Helper to build work context for AI
  const buildWorkContext = useCallback(() => {
    if (!currentWork) {
      return "Nenhum contexto de obra disponível.";
    }

    let context = `CONTEXTO DA OBRA (baseado na obra "${currentWork.name}" - Status: ${currentWork.status}):\n`;

    // CRONOGRAMA
    const totalSteps = workSteps.length;
    const completedSteps = workSteps.filter(s => s.status === StepStatus.COMPLETED).length;
    const inProgressSteps = workSteps.filter(s => s.status === StepStatus.IN_PROGRESS).length;
    const delayedSteps = workSteps.filter(s => s.status === StepStatus.DELAYED).length;
    const pendingSteps = workSteps.filter(s => s.status === StepStatus.PENDING).length;

    context += `\nCRONOGRAMA:\n`;
    context += `  Total de Etapas: ${totalSteps}\n`;
    context += `  Concluídas: ${completedSteps}\n`;
    context += `  Em Andamento: ${inProgressSteps}\n`;
    context += `  Atrasadas: ${delayedSteps}\n`;
    context += `  Pendentes: ${pendingSteps}\n`;

    const nextUpcomingSteps = workSteps.filter(s => s.status === StepStatus.PENDING).slice(0, 3);
    if (nextUpcomingSteps.length > 0) {
      context += `  Próximas Etapas Pendentes: ${nextUpcomingSteps.map(s => s.name).join(', ')}\n`;
    }
    const currentlyDelayedSteps = workSteps.filter(s => s.status === StepStatus.DELAYED);
    if (currentlyDelayedSteps.length > 0) {
      context += `  Etapas Atualmente Atrasadas: ${currentlyDelayedSteps.map(s => s.name).join(', ')}\n`;
    }


    // MATERIAIS
    const totalPlannedMaterials = workMaterials.reduce((sum, m) => sum + m.plannedQty, 0);
    const totalPurchasedMaterials = workMaterials.reduce((sum, m) => sum + m.purchasedQty, 0);
    const pendingMaterials = workMaterials.filter(m => m.plannedQty > 0 && m.purchasedQty < m.plannedQty);
    const materialShortages = pendingMaterials.filter(m => m.plannedQty > 0 && (m.purchasedQty / m.plannedQty) < 0.5); // Less than 50% purchased

    context += `\nMATERIAIS:\n`;
    context += `  Total Planejado: ${totalPlannedMaterials}\n`;
    context += `  Total Comprado: ${totalPurchasedMaterials}\n`;
    context += `  Materiais Pendentes (quant): ${pendingMaterials.length}\n`;
    if (materialShortages.length > 0) {
      context += `  Materiais com Grave Escassez: ${materialShortages.map(m => m.name).join(', ')}\n`;
    }


    // FINANCEIRO
    const totalBudget = currentWork.budgetPlanned;
    const totalExpensesAmount = workExpenses.reduce((sum, e) => sum + e.amount, 0); // Total planned amount for all expenses
    const totalPaidExpenses = workExpenses.reduce((sum, e) => sum + (e.paidAmount || 0), 0); // Total paid amount (all expenses)
    
    // Sum only non-material expenses for primary budget tracking
    const nonMaterialExpenses = workExpenses.filter(e => e.category !== ExpenseCategory.MATERIAL);
    const nonMaterialPaid = nonMaterialExpenses.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    
    const outstandingExpenses = nonMaterialExpenses.reduce((sum, e) => {
        const agreed = e.totalAgreed !== undefined && e.totalAgreed !== null ? e.totalAgreed : e.amount;
        const paid = e.paidAmount || 0;
        return sum + Math.max(0, agreed - paid);
    }, 0);

    const overpaidExpenses = workExpenses.filter(e => e.status === ExpenseStatus.OVERPAID);

    context += `\nFINANCEIRO:\n`;
    context += `  Orçamento Planejado: R$${totalBudget.toFixed(2)}\n`;
    context += `  Gastos Totais Registrados (Previsto): R$${totalExpensesAmount.toFixed(2)}\n`;
    context += `  Valor Efetivamente Pago (excluindo despesas de material, para análise de orçamento principal): R$${nonMaterialPaid.toFixed(2)}\n`;
    context += `  A Pagar (não-materiais): R$${outstandingExpenses.toFixed(2)}\n`;
    if (overpaidExpenses.length > 0) {
      context += `  Despesas com Excedente (Prejuízo): R$${overpaidExpenses.reduce((sum, e) => sum + ((e.paidAmount || 0) - (e.totalAgreed !== undefined && e.totalAgreed !== null ? e.totalAgreed : e.amount)), 0).toFixed(2)}\n`;
    }

    return context;
  }, [currentWork, workSteps, workMaterials, workExpenses]);


  const handleAiAsk = async (e?: React.FormEvent) => {
    e?.preventDefault(); // Only prevent default if event object exists
    const textToSend = aiMessage.trim(); // Always use aiMessage state

    if (!textToSend || !hasAiAccess || aiLoading) return;

    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: textToSend };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setAiLoading(true);
    setAiMessage(''); // Clear input after sending
    setRecognizedText(''); // Clear recognized text too
    setErrorMsg(''); // Clear any previous errors

    // NEW: Build and send work context along with the message
    let fullPrompt = textToSend;
    if (currentWork) {
      const workContext = buildWorkContext();
      fullPrompt = `${workContext}\n\nPERGUNTA DO USUÁRIO:\n${textToSend}`;
    } else {
      fullPrompt = `Nenhum contexto de obra disponível. PERGUNTA DO USUÁRIO:\n${textToSend}`; // Inform AI if no work context
    }

    try {
      // CRITICAL FIX: Use mockAiService here
      const response = await mockAiService.chat(fullPrompt, currentWork ? buildWorkContext() : undefined); 
      const aiResponse: Message = { id: (Date.now() + 1).toString(), sender: 'ai', text: response };
      setMessages(prevMessages => [...prevMessages, aiResponse]);
    } catch (error) {
      console.error("Error sending message to AI:", error);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), sender: 'ai', text: 'Tive um problema de conexão aqui. Tenta de novo em um minutinho.' };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
        setErrorMsg('API de reconhecimento de voz não suportada.');
        return;
    }

    if (isListening) {
      recognitionRef.current.stop(); // This will trigger onend
    } else {
      setAiMessage(''); // Clear any existing text before starting
      setRecognizedText(''); // Clear previous recognized text
      recognitionRef.current.start();
      setIsListening(true);
      setErrorMsg(''); // Clear error when starting new input
      console.log("Speech Recognition started.");
    }
  };

  // NEW: Include loadingWorkContext in the overall loading check
  if (authLoading || loadingWorkContext) return (
    <div className="flex items-center justify-center min-h-[70vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
    </div>
  );

  if (!hasAiAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in">
        <div className="w-full max-w-sm bg-gradient-to-br from-slate-900 to-slate-950 rounded-[2.5rem] p-8 shadow-2xl dark:shadow-card-dark-subtle relative overflow-hidden border border-slate-800 group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-secondary/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-28 h-28 rounded-full border-4 border-slate-800 p-1 bg-gradient-gold shadow-[0_0_30px_rgba(217,119,6,0.4)] mb-6 transform hover:scale-105 transition-transform duration-500">
              <img src={ZE_AVATAR} className="w-full h-full object-cover rounded-full bg-white" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} alt="Zé da Obra AI" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Zé da Obra <span className="text-secondary">AI</span></h2>
            <div className="h-1 w-12 bg-secondary rounded-full mb-6"></div>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium">Seu engenheiro virtual particular.</p>
            <button onClick={() => navigate('/settings')} className="w-full py-4 bg-gradient-gold text-white font-black rounded-2xl shadow-lg hover:shadow-orange-500/20 hover:scale-105 transition-all flex items-center justify-center gap-3 group-hover:animate-pulse">
              <i className="fa-solid fa-crown"></i> Liberar Acesso Vitalício
            </button>
            <p className="text-center text-[10px] text-slate-500 dark:text-slate-400 mt-4 flex items-center justify-center gap-1">
                <i className="fa-solid fa-info-circle"></i> Acesso à IA é exclusivo para assinantes Vitalícios ou em período de trial.
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
        {currentWork && (
          <p className="text-xs text-slate-400 mt-2">Contexto da obra atual: <span className="font-bold">{currentWork.name}</span></p>
        )}
        {!currentWork && (
          <p className="text-xs text-red-400 mt-2"><i className="fa-solid fa-exclamation-triangle mr-1"></i>Nenhuma obra selecionada. O Zé não terá contexto sobre sua obra. Selecione uma no Dashboard.</p>
        )}
      </div>
      
      {/* Chat Messages Area */}
      <div ref={chatMessagesRef} className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-inner overflow-y-auto mb-4 border border-slate-200 dark:border-slate-800">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 mb-6 animate-in fade-in ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === 'ai' && (
              <img src={ZE_AVATAR} className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} alt="Zé da Obra Avatar" />
            )}
            <div className={`p-3 rounded-2xl max-w-[80%] ${
              msg.sender === 'ai' 
                ? 'bg-slate-100 dark:bg-slate-800 rounded-tl-none text-slate-700 dark:text-slate-300 shadow-sm dark:shadow-card-dark-subtle' 
                : 'bg-primary text-white rounded-tr-none shadow-md'
            }`}>
              {msg.sender === 'ai' && <p className="font-bold text-secondary mb-1">Zé da Obra</p>}
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {aiLoading && (
          <div className="flex gap-4 mb-6">
            <img src={ZE_AVATAR} className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} alt="Zé da Obra Avatar" />
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-b-xl text-sm shadow-sm dark:shadow-card-dark-subtle flex items-center">
              <span className="animate-pulse text-secondary">Digitando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleAiAsk} className="flex gap-2">
        <input
          value={isListening ? (recognizedText || 'Ouvindo...') : aiMessage}
          onChange={(e) => setAiMessage(e.target.value)}
          placeholder={isListening ? 'Ouvindo...' : 'Pergunte ao Zé...'}
          className="flex-1 p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-secondary transition-colors text-primary dark:text-white"
          disabled={aiLoading} // Disable typing only while AI is loading, allow typing during listening
          aria-label="Caixa de texto para perguntar ao Zé da Obra ou transcrição de voz"
        />
        {/* Toggle button for voice input */}
        <button
          type="button" // Important: type="button" to prevent form submission
          onClick={toggleListening}
          disabled={aiLoading || !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)}
          className={`w-14 text-white rounded-xl flex items-center justify-center shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse-mic' : 'bg-secondary hover:bg-orange-600'}
          `}
          aria-label={isListening ? 'Parar gravação de voz' : 'Iniciar gravação de voz'}
        >
          {
            isListening ? (
              <i className="fa-solid fa-microphone-slash"></i>
            ) : (
              <i className="fa-solid fa-microphone"></i>
            )
          }
        </button>
        {/* NEW: Send Button - Always present */}
        <button
          type="submit"
          disabled={aiLoading || !aiMessage.trim()} // Disable if AI is loading or input is empty, NOT by isListening
          className={`w-14 text-white rounded-xl flex items-center justify-center shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            ${(!aiMessage.trim() || aiLoading) ? 'bg-slate-400 dark:bg-slate-700' : 'bg-primary hover:bg-primary-light'}
          `}
          aria-label="Enviar mensagem"
        >
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </form>
      {errorMsg && (
        <p className="text-red-500 text-sm mt-2 text-center" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
};

export default AiChat;
