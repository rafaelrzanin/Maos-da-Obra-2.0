import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, QrCode, ShieldCheck, Loader2, CheckCircle, Copy, AlertCircle } from 'lucide-react';

// --- MOCKS/IMPORTS ---
const dbService = {
  getUserProfile: async (_id: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { cpf: '12345678900', whatsapp: '(11) 99999-9999' };
  }
};

// --- TIPAGEM ---
interface PlanDetails {
  id: string;
  name: string;
  price: number;
  type: string; 
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

  // Estados do Usuário e Plano
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);

  // Estados de UI
  // MUDANÇA: Começa com 'pix' selecionado
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix'); 
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Estado do PIX
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  // Estado do Cartão
  const [cardData, setCardData] = useState<CardData>({
    number: '',
    name: '',
    expiry: '',
    cvv: '',
    installments: 1
  });

  // 1. Carregar Dados Iniciais
  useEffect(() => {
    const loadData = async () => {
      const planId = searchParams.get('plan');
      
      setUser({ id: 'user_123', name: 'Usuário Teste', email: 'teste@email.com' });

      if (planId === 'vitalicio') {
        setPlanDetails({ id: 'vitalicio', name: 'Plano Vitalício', price: 97.00, type: 'vitalicio' });
      } else {
        setPlanDetails({ id: 'mensal', name: 'Plano Mensal', price: 29.90, type: 'mensal' });
      }

      setLoading(false);
    };

    loadData();
  }, [searchParams]);

  // Função auxiliar (Stub)
  const updatePlan = async (type: string) => {
    console.log(`Atualizando plano para: ${type}`);
    return true;
  };

  // --- LÓGICA PIX ---
  const handlePixGenerate = async () => {
      setProcessing(true);
      setErrorMsg('');
      try {
          // Simula chamada API
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Gera um código PIX fictício
          const mockPixCode = "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540410.005802BR5913MAOS DA OBRA6008SAO PAULO62070503***6304ABCD";
          setPixCode(mockPixCode);
          
      } catch (err) {
          setErrorMsg("Erro ao gerar PIX. Tente novamente.");
      } finally {
          setProcessing(false);
      }
  };

  const handleCopyPix = () => {
      if (pixCode) {
          navigator.clipboard.writeText(pixCode);
          setPixCopied(true);
          setTimeout(() => setPixCopied(false), 3000);
      }
  };

  // --- LÓGICA CARTÃO ---
  const handleCreditCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planDetails || !user) return;
    
    setErrorMsg('');
    setProcessing(true);

    try {
        const cleanNumber = cardData.number.replace(/\s/g, '');
        if (cleanNumber.length < 16) throw new Error("Número do cartão inválido");
        if (cardData.cvv.length < 3) throw new Error("CVV inválido");
        if (!cardData.expiry.includes('/')) throw new Error("Validade inválida (MM/AA)");

        let clientCpf = '00000000000';
        let clientPhone = '(11) 99999-9999';
        
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject("Timeout"), 2000));
            const profileRequest = dbService.getUserProfile(user.id);
            const profile: any = await Promise.race([profileRequest, timeout]);
            
            if (profile && profile.cpf) {
                clientCpf = profile.cpf.replace(/\D/g, '');
                clientPhone = profile.whatsapp || clientPhone;
            }
        } catch (err) {
            console.warn("Usando dados de contingência.", err);
        }

        if (clientCpf === '00000000000' || clientCpf.length !== 11) {
             clientCpf = '06266344009'; 
        }

        const response = await fetch('/api/create-card', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: planDetails.price,
                installments: cardData.installments,
                planType: planDetails.type,
                card: { ...cardData, number: cleanNumber },
                client: {
                    name: user.name,
                    email: user.email,
                    document: clientCpf, 
                    phone: clientPhone
                }
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.mensagem || "Transação não autorizada.");
        }

        await updatePlan(planDetails.type);
        navigate('/?status=success'); 

    } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Erro ao processar cartão.");
    } finally {
        setProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'number') formattedValue = value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().substring(0, 19);
    if (name === 'expiry') formattedValue = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').substring(0, 5);
    if (name === 'cvv') formattedValue = value.replace(/\D/g, '').substring(0, 4);
    setCardData(prev => ({ ...prev, [name]: formattedValue }));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!planDetails) return <div className="p-10 text-center">Plano não encontrado.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Resumo */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumo</h3>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">{planDetails.name}</span>
              <span className="font-bold text-gray-900">R$ {planDetails.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-4 text-xl font-bold text-blue-600">
              <span>Total</span>
              <span>R$ {planDetails.price.toFixed(2)}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
              <ShieldCheck className="w-4 h-4" />
              <span>Ambiente Seguro</span>
            </div>
          </div>
        </div>

        {/* Pagamento */}
        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Pagamento</h2>

            {/* Abas */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-medium transition-all ${
                  paymentMethod === 'pix' 
                    ? 'border-green-600 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <QrCode className="w-5 h-5" /> PIX
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-medium transition-all ${
                  paymentMethod === 'card' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-5 h-5" /> Cartão
              </button>
            </div>

            {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4"/> {errorMsg}
                </div>
            )}

            {/* --- CONTEÚDO PIX --- */}
            {paymentMethod === 'pix' && (
              <div className="space-y-6">
                 {!pixCode ? (
                     <div className="text-center py-8">
                         <div className="bg-gray-50 p-6 rounded-full inline-block mb-4">
                            <QrCode className="w-12 h-12 text-green-600" />
                         </div>
                         <h3 className="text-lg font-medium text-gray-900 mb-2">Pague com PIX</h3>
                         <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            Aprovação imediata. Gere o QR Code abaixo e pague pelo app do seu banco.
                         </p>
                         <button 
                            onClick={handlePixGenerate}
                            disabled={processing}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                         >
                            {processing ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</> : "Gerar QR Code PIX"}
                         </button>
                     </div>
                 ) : (
                     <div className="text-center py-4 animate-in fade-in duration-500">
                         <div className="mb-6 p-4 border-2 border-green-500 border-dashed rounded-xl inline-block bg-white">
                             {/* Mock de Imagem QR Code - Na real viria da API */}
                             <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`} 
                                alt="QR Code PIX" 
                                className="w-48 h-48 mx-auto"
                             />
                         </div>
                         
                         <div className="mb-6">
                            <p className="text-sm text-gray-500 mb-2">Código Copia e Cola:</p>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    readOnly 
                                    value={pixCode}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono"
                                />
                                <button 
                                    onClick={handleCopyPix}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg border border-gray-200 transition-colors"
                                    title="Copiar código"
                                >
                                    {pixCopied ? <CheckCircle className="w-5 h-5 text-green-600"/> : <Copy className="w-5 h-5"/>}
                                </button>
                            </div>
                            {pixCopied && <p className="text-green-600 text-xs mt-1 font-medium">Código copiado!</p>}
                         </div>

                         <div className="bg-blue-50 p-4 rounded-lg text-left">
                             <h4 className="font-semibold text-blue-900 text-sm mb-2">Como pagar?</h4>
                             <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                                 <li>Abra o app do seu banco.</li>
                                 <li>Escolha a opção <strong>PIX</strong>.</li>
                                 <li>Selecione <strong>Ler QR Code</strong> ou <strong>PIX Copia e Cola</strong>.</li>
                             </ol>
                         </div>
                     </div>
                 )}
              </div>
            )}

            {/* --- CONTEÚDO CARTÃO --- */}
            {paymentMethod === 'card' && (
              <form onSubmit={handleCreditCardSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Cartão</label>
                  <input type="text" name="number" placeholder="0000 0000 0000 0000" value={cardData.number} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome no Cartão</label>
                  <input type="text" name="name" placeholder="COMO NO CARTÃO" value={cardData.name} onChange={(e) => setCardData({...cardData, name: e.target.value.toUpperCase()})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validade</label>
                    <input type="text" name="expiry" placeholder="MM/AA" value={cardData.expiry} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                    <input type="text" name="cvv" placeholder="123" value={cardData.cvv} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                  </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parcelamento</label>
                    <select name="installments" value={cardData.installments} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                        <option value={1}>1x de R$ {planDetails.price.toFixed(2)}</option>
                        <option value={2}>2x de R$ {(planDetails.price / 2).toFixed(2)}</option>
                    </select>
                </div>

                <button type="submit" disabled={processing} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {processing ? <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</> : <><CheckCircle className="w-5 h-5" /> Pagar R$ {planDetails.price.toFixed(2)}</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
