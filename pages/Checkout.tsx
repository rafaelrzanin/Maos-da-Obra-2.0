import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CreditCard, QrCode, ShieldCheck, Loader2, CheckCircle, 
  Copy, Smartphone, Zap, Star, LayoutDashboard 
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
  const [searchParams] = useSearchParams();
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
  useEffect(() => {
    const loadData = async () => {
      const planId = searchParams.get('plan'); // ex: 'semestral', 'mensal', 'vitalicio'
      
      setUser({ id: 'user_123', name: 'Usuário', email: 'usuario@email.com' });

      // LÓGICA DE PREÇOS
      if (planId === 'semestral') {
        setPlanDetails({ 
            id: 'semestral', 
            name: 'Plano Semestral', 
            price: 97.00, 
            type: 'semestral',
            period: '6 meses'
        });
      } else if (planId === 'vitalicio') {
        setPlanDetails({ 
            id: 'vitalicio', 
            name: 'Acesso Vitalício', 
            price: 197.00, 
            type: 'vitalicio',
            period: 'Acesso Único'
        });
      } else {
        // Default para Mensal
        setPlanDetails({ 
            id: 'mensal', 
            name: 'Plano Mensal', 
            price: 29.90, 
            type: 'mensal',
            period: 'Mensal'
        });
      }

      setLoading(false);
    };

    loadData();
  }, [searchParams]);

  const updatePlan = async (type: string) => {
    console.log(`Atualizando plano para: ${type}`);
    return true;
  };

  // --- HANDLERS ---
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

        // Simula processamento com sucesso
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Se tudo der certo:
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

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-950"><Loader2 className="h-10 w-10 animate-spin text-yellow-500" /></div>;
  if (!planDetails) return <div className="text-white text-center p-10 bg-slate-950">Plano não encontrado.</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Header Minimalista */}
      <div className="max-w-6xl mx-auto mb-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <LayoutDashboard className="text-slate-900 w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">Mãos da Obra <span className="text-yellow-500">Premium</span></h1>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA DA ESQUERDA: BENEFÍCIOS (Visual Premium) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            {/* Efeito de brilho no fundo */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Você escolheu</h2>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold text-white">{planDetails.name}</span>
            </div>
            
            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-yellow-500"><Zap size={16} /></div>
                    <span>Acesso Imediato ao App</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-yellow-500"><Smartphone size={16} /></div>
                    <span>Sem anúncios e ilimitado</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-yellow-500"><Star size={16} /></div>
                    <span>Suporte Prioritário</span>
                </div>
            </div>

            <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                <span className="text-slate-400">Total a pagar:</span>
                <span className="text-2xl font-bold text-yellow-400">R$ {planDetails.price.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            Pagamento Processado com Criptografia SSL
          </div>
        </div>

        {/* COLUNA DA DIREITA: CHECKOUT FORM */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            
            {/* Seletor de Método */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                    onClick={() => setPaymentMethod('pix')}
                    className={`flex items-center justify-center gap-2 py-4 rounded-xl border transition-all duration-200 ${
                        paymentMethod === 'pix' 
                        ? 'bg-green-500/10 border-green-500 text-green-400 font-semibold' 
                        : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-750 hover:text-white'
                    }`}
                >
                    <QrCode className="w-5 h-5" /> PIX
                </button>
                <button
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center justify-center gap-2 py-4 rounded-xl border transition-all duration-200 ${
                        paymentMethod === 'card' 
                        ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400 font-semibold' 
                        : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-750 hover:text-white'
                    }`}
                >
                    <CreditCard className="w-5 h-5" /> Cartão
                </button>
            </div>

            {errorMsg && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
                    {errorMsg}
                </div>
            )}

            {/* CONTEÚDO PIX */}
            {paymentMethod === 'pix' && (
                <div className="text-center animate-in fade-in zoom-in duration-300">
                    {!pixCode ? (
                        <div className="py-8">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                                <QrCode size={32} />
                            </div>
                            <h3 className="text-white font-medium text-lg mb-2">Liberação Instantânea</h3>
                            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                                O QR Code expira em 30 minutos. Após o pagamento, seu acesso será liberado automaticamente.
                            </p>
                            <button 
                                onClick={handlePixGenerate}
                                disabled={processing}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-900/20 flex justify-center items-center gap-2"
                            >
                                {processing ? <Loader2 className="animate-spin" /> : "Gerar Pagamento PIX"}
                            </button>
                        </div>
                    ) : (
                        <div className="py-4 space-y-6">
                            <div className="bg-white p-4 rounded-xl inline-block">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`} 
                                    alt="QR Code" 
                                    className="w-48 h-48 opacity-90"
                                />
                            </div>
                            
                            <div className="max-w-md mx-auto">
                                <label className="text-xs text-slate-400 mb-2 block text-left">Pix Copia e Cola</label>
                                <div className="flex gap-2">
                                    <input 
                                        readOnly 
                                        value={pixCode}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-300 font-mono focus:outline-none"
                                    />
                                    <button 
                                        onClick={handleCopyPix}
                                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-lg border border-slate-700 transition-colors"
                                    >
                                        {pixCopied ? <CheckCircle className="text-green-500" /> : <Copy />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CONTEÚDO CARTÃO */}
            {paymentMethod === 'card' && (
                <form onSubmit={handleCreditCardSubmit} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Número do Cartão</label>
                        <input type="text" name="number" placeholder="0000 0000 0000 0000" value={cardData.number} onChange={handleInputChange} 
                        className="w-full bg-slate-950 border border-slate-800 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all placeholder:text-slate-600" required />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Nome Completo</label>
                        <input type="text" name="name" placeholder="Impresso no cartão" value={cardData.name} onChange={(e) => setCardData({...cardData, name: e.target.value.toUpperCase()})} 
                        className="w-full bg-slate-950 border border-slate-800 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all placeholder:text-slate-600" required />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Validade</label>
                            <input type="text" name="expiry" placeholder="MM/AA" value={cardData.expiry} onChange={handleInputChange} 
                            className="w-full bg-slate-950 border border-slate-800 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all placeholder:text-slate-600" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">CVV</label>
                            <input type="text" name="cvv" placeholder="123" value={cardData.cvv} onChange={handleInputChange} 
                            className="w-full bg-slate-950 border border-slate-800 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all placeholder:text-slate-600" required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Parcelamento</label>
                        <select name="installments" value={cardData.installments} onChange={handleInputChange} 
                        className="w-full bg-slate-950 border border-slate-800 text-white px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all">
                            <option value={1}>1x de R$ {planDetails.price.toFixed(2)} (Sem juros)</option>
                            <option value={2}>2x de R$ {(planDetails.price / 2).toFixed(2)}</option>
                            <option value={3}>3x de R$ {(planDetails.price / 3).toFixed(2)}</option>
                        </select>
                    </div>

                    <button type="submit" disabled={processing} 
                    className="w-full mt-4 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-4 rounded-xl transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]">
                        {processing ? <><Loader2 className="animate-spin" /> Processando...</> : `Confirmar Pagamento de R$ ${planDetails.price.toFixed(2)}`}
                    </button>
                </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
