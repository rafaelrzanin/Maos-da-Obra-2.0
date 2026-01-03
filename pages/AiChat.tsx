
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { aiService } from '../services/ai.ts';
import { PlanType } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

const AiChat = () => {
  const { user, trialDaysRemaining, authLoading } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [aiMessage, setAiMessage] = useState(''); // User's typed input OR transcribed speech
  const [aiLoading, setAiLoading] = useState(false);

  // NEW: State for Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState(''); // Text from SpeechRecognition during active listening
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const chatMessagesRef = useRef<HTMLDivElement>(null);

  const isVitalicio = user?.plan === PlanType.VITALICIO;
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const hasAiAccess = isVitalicio || isAiTrialActive;

  // Initialize SpeechRecognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      // Fix: Cast event types to any to resolve TypeScript errors.
      // This is a workaround because SpeechRecognitionEvent and SpeechRecognitionErrorEvent
      // are not recognized, likely due to tsconfig.json not including 'dom' library types
      // or other configuration issues, and we cannot modify tsconfig.json or add d.ts files.
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Stop after each utterance
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
        setRecognizedText(interimTranscript); // Show interim results
        if (finalTranscript) {
          setAiMessage(finalTranscript); // Set final text to input field
          // Auto-send if there's a final transcript
          if (!aiLoading) { // Avoid double sending if AI is already busy
            handleAiAsk(null, finalTranscript); // Pass finalTranscript explicitly
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setRecognizedText('');
        console.log("Speech Recognition ended.");
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
  }, [aiLoading]); // Only re-initialize if aiLoading changes (e.g. to ensure no conflicts)


  // Add initial AI welcome message
  useEffect(() => {
    if (hasAiAccess && messages.length === 0 && !authLoading) {
      setMessages([{ id: 'ai-welcome', sender: 'ai', text: 'Opa! Mestre de obras na área. No que posso te ajudar hoje?' }]);
    }
  }, [hasAiAccess, messages.length, authLoading]);

  // Scroll to bottom of chat messages whenever messages update
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const [errorMsg, setErrorMsg] = useState(''); // NEW: For local errors like speech recognition

  // handleAiAsk now accepts an optional text parameter for transcribed speech
  const handleAiAsk = async (e?: React.FormEvent, transcribedText?: string) => {
    e?.preventDefault(); // Only prevent default if event object exists
    const textToSend = transcribedText?.trim() || aiMessage.trim();

    if (!textToSend || !hasAiAccess || aiLoading) return;

    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: textToSend };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setAiLoading(true);
    setAiMessage(''); // Clear input/recognized text immediately
    setErrorMsg(''); // Clear any previous errors

    try {
      const response = await aiService.chat(userMessage.text);
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
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      // Clear current AI message before starting to listen
      setAiMessage(''); 
      setRecognizedText('');
      recognitionRef.current?.start();
      setIsListening(true);
      setErrorMsg(''); // Clear error when starting new input
      console.log("Speech Recognition started.");
    }
  };

  if (authLoading) return (
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
          value={isListening ? recognizedText || 'Ouvindo...' : aiMessage}
          onChange={(e) => setAiMessage(e.target.value)}
          placeholder={isListening ? 'Ouvindo...' : 'Pergunte ao Zé...'}
          className="flex-1 p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-secondary transition-colors text-primary dark:text-white"
          disabled={aiLoading || isListening} // Disable typing while listening or AI is loading
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
          {isListening ? <i className="fa-solid fa-microphone-slash"></i> : <i className="fa-solid fa-microphone"></i>}
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
