import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CreditCard, QrCode, ShieldCheck, Loader2, CheckCircle, 
  Copy, HardHat, Check, Lock, ChevronDown
} from 'lucide-react';

// --- TIPAGEM ---
interface PlanDetails {
  id: string;
  name: string;
  price: number;
  type: string;
  period: string;
}

interface CardData {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  installments: number;
}

export default function Checkout() {
  const [searchParams, setSearchParams] = useSearchParams(); // Agora usamos setSearchParams para trocar URL se precisar
  const navigate = useNavigate();

  // Estados
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix'); 
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Pix & Cartão
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [cardData, setCardData] = useState<CardData>({
    number: '', name: '', expiry: '', cvv: '', installments: 1
  });

  // 1. Carregar Dados e Lógica de Preço
  // Função extraída para poder ser chamada ao trocar de plano manualmente
  const definePlan = (planId: string | null) => {
    if (planId === 'semestral') {
        setPlanDetails({ 
            id: 'semestral', name: 'Plano Semestral', price: 97.00, type: 'semestral', period: '6 meses'
        });
    } else if (planId === 'vitalicio') {
        setPlanDetails({ 
            id: 'vitalicio', name: 'Acesso Vitalício', price: 197.00, type: 'vitalicio', period: 'Acesso Único'
        });
    } else {
        // Default
        setPlanDetails({ 
            id: 'mensal', name: 'Plano Mensal', price: 29.90, type: 'mensal', period: 'Mensal'
        });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const planId = searchParams.get('plan');
      console.log("Plano recebido na URL:", planId); // Debug
      
      setUser({ id: 'user_123', name: 'Usuário', email: 'usuario@email.com' });
      definePlan(planId);
      setLoading(false);
    };

    loadData();
  }, [searchParams]);

  // Handler para troca manual de plano no UI
  const handlePlanSwitch = (newPlan: string) => {
      setSearchParams({ plan: newPlan }); // Atualiza URL
      definePlan(newPlan); // Atualiza Estado Local
  };

  const updatePlan = async (type: string) => {
    console.log("Processando upgrade para:", type);
    return true;
  };

  // --- HANDLERS DE PAGAMENTO ---
  const handlePixGenerate = async () => {
      setProcessing(true);
      setErrorMsg('');
      try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const mockPixCode = "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540410.005802BR5913MAOS DA OBRA6008SAO PAULO62070503***6304ABCD";
          setPixCode(mockPixCode);
      } catch (err) { setErrorMsg("Erro ao gerar PIX."); } 
      finally { setProcessing(false); }
  };

  const handleCopyPix = () => {
      if (pixCode) {
          navigator.clipboard.writeText(pixCode);
          setPixCopied(true);
          setTimeout(() => setPixCopied(false), 3000);
      }
  };

  const handleCreditCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planDetails || !user) return;
    setErrorMsg('');
    setProcessing(true);

    try {
        const cleanNumber = cardData.number.replace(/\s/g, '');
        if (cleanNumber.length < 16) throw new Error("Número do cartão inválido");
        if (cardData.cvv.length < 3) throw new Error("CVV inválido");

        await new Promise(resolve => setTimeout(resolve, 2000));
        await updatePlan(planDetails.type);
        navigate('/?status=success'); 

    } catch (err: any) {
        setErrorMsg(err.message || "Erro ao processar.");
    } finally {
        setProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let v = value;
    if (name === 'number') v = v.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().substring(0, 19);
    if (name === 'expiry') v = v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').substring(0, 5);
    if (name === 'cvv') v = v.replace(/\D/g, '').substring(0, 4);
    setCardData(prev => ({ ...prev, [name]: v }));
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172134]">
        <Loader2 className="h-10 w-10 animate-spin text-[#bc5a08]" />
    </div>
  );
  
  if (!planDetails) return <div className="fixed inset-0 z-50 bg-[#172134] text-white p-10">Plano não encontrado.</div>;

  return (
    // FIX DE LAYOUT: "fixed inset-0 z-50 overflow-y-auto" força tela cheia sobrepondo tudo
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#172134] font-sans selection:bg-[#bc5a08] selection:text-white">
      
      {/* Background Decorativo */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#bc5a08]/10 blur-[100px]"></div>
      </div>

      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-5 gap-8">
            
            {/* ESQUERDA: BRANDING & RESUMO */}
            <div className="lg:col-span-2 flex flex-col justify-center space-y-8 lg:pr-8">
                {/* LOGO */}
                <div className="flex items-center gap-4">
                    <div 
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transform rotate-6"
                        style={{ backgroundColor: '#bc5a08', boxShadow: '0 10px 25px -5px rgba(188, 90, 8, 0.4)' }}
                    >
                        <HardHat className="text-white w-8 h-8 transform -rotate-6" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight leading-none">Mãos da Obra</h1>
                        <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">Checkout Seguro</span>
                    </div>
                </div>

                {/* INFO DO PLANO COM SELETOR MANUAL (CORREÇÃO DO PROBLEMA DO 97/29) */}
                <div className="space-y-4">
                    <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Você está assinando:</h2>
                    
                    {/* Botões para troca rápida de plano caso o link esteja errado */}
                    <div className="flex gap-2 mb-4">
                        <button 
                            onClick={() => handlePlanSwitch('mensal')}
                            className={`px-3 py-1 text-xs rounded-full border transition-all ${planDetails.id === 'mensal' ? 'bg-[#bc5a08] border-[#bc5a08] text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                        >
                            Mensal
                        </button>
                        <button 
                            onClick={() => handlePlanSwitch('semestral')}
                            className={`px-3 py-1 text-xs rounded-full border transition-all ${planDetails.id === 'semestral' ? 'bg-[#bc5a08] border-[#bc5a08] text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                        >
                            Semestral
                        </button>
                        <button 
                            onClick={() => handlePlanSwitch('vitalicio')}
                            className={`px-3 py-1 text-xs rounded-full border transition-all ${planDetails.id === 'vitalicio' ? 'bg-[#bc5a08] border-[#bc5a08] text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                        >
                            Vitalício
                        </button>
                    </div>

                    <div className="text-4xl font-bold text-white tracking-tight">{planDetails.name}</div>
                    <div className="text-3xl font-bold flex items-baseline gap-1" style={{ color: '#bc5a08' }}>
                        R$ {planDetails.price.toFixed(2)}
                        <span className="text-sm font-normal text-gray-400">/{planDetails.period}</span>
                    </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/20 text-green-500"><Check size={14} strokeWidth={3} /></div>
                        <span className="text-gray-300">Acesso completo ao App</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/20 text-green-500"><Check size={14} strokeWidth={3} /></div>
                        <span className="text-gray-300">Sem limite de obras</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/20 text-green-500"><Check size={14} strokeWidth={3} /></div>
                        <span className="text-gray-300">Suporte VIP</span>
                    </div>
                </div>
            </div>

            {/* DIREITA: FORMULÁRIO */}
            <div className="lg:col-span-3">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
                
                {/* Abas */}
                <div className="flex bg-[#0f1623] p-1 rounded-xl mb-8 border border-white/5">
                    <button onClick={() => setPaymentMethod('pix')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${paymentMethod === 'pix' ? 'bg-[#172134] text-white shadow-lg border border-gray-700' : 'text-gray-400 hover:text-white'}`}>
                        <QrCode size={18} /> PIX
                    </button>
                    <button onClick={() => setPaymentMethod('card')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${paymentMethod === 'card' ? 'bg-[#172134] text-white shadow-lg border border-gray-700' : 'text-gray-400 hover:text-white'}`}>
                        <CreditCard size={18} /> Cartão
                    </button>
                </div>

                {errorMsg && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">{errorMsg}</div>}

                {/* PIX */}
                {paymentMethod === 'pix' && (
                    <div className="text-center py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {!pixCode ? (
                            <div className="space-y-6">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#bc5a08]/10 text-[#bc5a08] mb-2"><QrCode size={40} /></div>
                                <div>
                                    <h3 className="text-white font-bold text-xl mb-2">Pague com PIX</h3>
                                    <p className="text-gray-400 text-sm max-w-xs mx-auto">Liberação imediata.</p>
                                </div>
                                <button onClick={handlePixGenerate} disabled={processing} className="w-full text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-orange-900/20 flex justify-center items-center gap-2 active:scale-[0.98] transition-transform" style={{ backgroundColor: '#bc5a08' }}>
                                    {processing ? <Loader2 className="animate-spin" /> : "Gerar QR Code"}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`} alt="QR Code" className="w-48 h-48" />
                                </div>
                                <div className="bg-[#0f1623] p-4 rounded-xl border border-white/5 text-left flex gap-2">
                                    <input readOnly value={pixCode} className="w-full bg-transparent border-none text-gray-300 text-xs font-mono p-0 truncate outline-none" />
                                    <button onClick={handleCopyPix} className="text-[#bc5a08] hover:text-white transition-colors">{pixCopied ? <CheckCircle size={20} /> : <Copy size={20} />}</button>
                                </div>
                                <p className="text-green-400 text-xs flex items-center justify-center gap-1"><Loader2 size={12} className="animate-spin" /> Aguardando pagamento...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* CARTÃO */}
                {paymentMethod === 'card' && (
                    <form onSubmit={handleCreditCardSubmit} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase ml-1">Número do Cartão</label>
                            <div className="relative">
                                <input type="text" name="number" placeholder="0000 0000 0000 0000" value={cardData.number} onChange={handleInputChange} className="w-full bg-[#0f1623] border border-gray-700 text-white px-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none pl-12 transition-all placeholder:text-gray-600" required />
                                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase ml-1">Nome Completo</label>
                            <input type="text" name="name" placeholder="Como no cartão" value={cardData.name} onChange={(e) => setCardData({...cardData, name: e.target.value.toUpperCase()})} className="w-full bg-[#0f1623] border border-gray-700 text-white px-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600" required />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase ml-1">Validade</label>
                                <input type="text" name="expiry" placeholder="MM/AA" value={cardData.expiry} onChange={handleInputChange} className="w-full bg-[#0f1623] border border-gray-700 text-white px-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none text-center placeholder:text-gray-600" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase ml-1">CVV</label>
                                <div className="relative">
                                    <input type="text" name="cvv" placeholder="123" value={cardData.cvv} onChange={handleInputChange} className="w-full bg-[#0f1623] border border-gray-700 text-white px-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none text-center placeholder:text-gray-600" required />
                                    <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase ml-1">Parcelamento</label>
                            <div className="relative">
                                <select name="installments" value={cardData.installments} onChange={handleInputChange} className="w-full bg-[#0f1623] border border-gray-700 text-white px-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none appearance-none cursor-pointer">
                                    <option value={1}>1x de R$ {planDetails.price.toFixed(2)} (Sem juros)</option>
                                    <option value={2}>2x de R$ {(planDetails.price / 2).toFixed(2)}</option>
                                    <option value={3}>3x de R$ {(planDetails.price / 3).toFixed(2)}</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                            </div>
                        </div>

                        <button type="submit" disabled={processing} className="w-full mt-4 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-orange-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50" style={{ backgroundColor: '#bc5a08' }}>
                            {processing ? <><Loader2 className="animate-spin" /> Processando...</> : `Pagar R$ ${planDetails.price.toFixed(2)}`}
                        </button>
                        
                        <div className="text-center pt-2">
                            <span className="text-xs text-gray-500 flex items-center justify-center gap-1"><Lock size={12} /> Ambiente seguro e criptografado</span>
                        </div>
                    </form>
                )}
            </div>
            </div>
        </div>
      </div>
    </div>
  );
}
