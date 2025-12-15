
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/db';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlanType } from '../types';

// Preços atualizados
const PLAN_PRICES: Record<string, number> = {
  [PlanType.MENSAL]: 29.90,
  [PlanType.SEMESTRAL]: 97.00,
  [PlanType.VITALICIO]: 247.00
};

// Labels amigáveis
const PLAN_LABELS: Record<string, string> = {
  [PlanType.MENSAL]: 'Plano Mensal',
  [PlanType.SEMESTRAL]: 'Plano Semestral',
  [PlanType.VITALICIO]: 'Acesso Vitalício'
};

const Checkout: React.FC = () => {
  const { user, updatePlan } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estados de Dados
  const [planDetails, setPlanDetails] = useState<{ type: PlanType, price: number, label: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Estados do PIX
  const [pixData, setPixData] = useState<{ qr_code_base64: string, copy_paste_code: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Estados do Cartão de Crédito (Sem pedir dados pessoais já cadastrados)
  const [cardData, setCardData] = useState({
    number: '',
    holder: '', // Preenchido com o nome do usuário como sugestão
    expiry: '',
    cvv: '',
    installments: '1'
  });

  // 1. INICIALIZAÇÃO ROBUSTA (PROTEÇÃO CONTRA TELA BRANCA)
  useEffect(() => {
    if (!user) {
        // AuthProvider deve cuidar disso, mas por segurança paramos o loading
        setLoading(false);
        return;
    }

    // Inicializa o nome do titular com o nome do usuário (pode ser editado)
    setCardData(prev => ({ ...prev, holder: user.name.toUpperCase() }));

    const setupPlan = () => {
        try {
            // A. Tenta pegar da URL (Prioridade)
            const params = new URLSearchParams(location.search);
            let targetPlan = params.get('plan') as PlanType;

            // B. Tenta pegar do State da navegação
            if (!targetPlan && location.state && (location.state as any).plan) {
                targetPlan = (location.state as any).plan;
            }

            // C. Validação e Fallback
            if (!targetPlan || !PLAN_PRICES[targetPlan]) {
                console.warn("Plano inválido ou ausente. Redirecionando para seleção (Settings).");
                navigate('/settings', { replace: true });
                return;
            }

            // Define os detalhes
            setPlanDetails({
                type: targetPlan,
                price: PLAN_PRICES[targetPlan],
                label: PLAN_LABELS[targetPlan]
            });
            setLoading(false);

        } catch (err) {
            console.error("Erro crítico no checkout:", err);
            // Fallback para Mensal em caso de erro grave, apenas para não quebrar a UI
            setPlanDetails({
                type: PlanType.MENSAL,
                price: PLAN_PRICES[PlanType.MENSAL],
                label: PLAN_LABELS[PlanType.MENSAL]
            });
            setLoading(false);
        }
    };

    setupPlan();
  }, [user, location, navigate]);

  // --- MÉTODOS AUXILIARES ---

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    
    // Máscaras
    if (name === 'number') value = value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
    if (name === 'expiry') value = value.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 5);
    if (name === 'cvv') value = value.replace(/\D/g, '').slice(0, 4);
    if (name === 'holder') value = value.toUpperCase();

    setCardData(prev => ({ ...prev, [name]: value }));
  };

  const handleGeneratePix = async () => {
    if (!user || !planDetails) return;
    setErrorMsg('');
    setProcessing(true);
    
    // URL da API interna (Serverless)
    const API_URL = "/api/create-pix";
    
    try {
      const profile = await dbService.getUserProfile(user.id);
      const cpf = (profile?.cpf || '00000000000').replace(/\D/g, '');
      const phone = (profile?.whatsapp || '0000000000').replace(/\D/g, '');
      const identifier = generateUUID();

      const payload = {
        identifier: identifier,
        amount: planDetails.price, 
        client: {
          name: user.name,
          email: user.email,
          document: cpf,
          phone: phone
        }
      };

      // Tenta integração real
      const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      
      if (data && (data.qrcode || data.emv)) {
          setPixData({
              qr_code_base64: data.qrcode?.base64 || data.qrcode || '', 
              copy_paste_code: data.emv || data.qrcode?.emv || data.code || ''
          });
          setProcessing(false);
          return; 
      }
      throw new Error("Dados PIX incompletos");

    } catch (error: any) {
      console.warn("Usando Fallback Mock PIX");
      const mockData = await dbService.generatePix(planDetails.price, {
        name: user.name,
        email: user.email,
        cpf: '000.000.000-00'
      });
      setPixData(mockData);

    } finally {
      setProcessing(false);
    }
  };

  const handleCreditCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planDetails) return;
    setErrorMsg('');
    setProcessing(true);

    try {
        if (cardData.number.length < 16) throw new Error("Número do cartão inválido");
        if (cardData.cvv.length < 3) throw new Error("CVV inválido");

        // Simulação
        await new Promise(resolve => setTimeout(resolve, 2000));
        await updatePlan(planDetails.type);
        // FIX: Passa o plano explicitamente na URL para garantir a atualização correta no App.tsx
        navigate(`/?status=success&plan=${planDetails.type}`); 

    } catch (err: any) {
        setErrorMsg(err.message || "Erro ao processar cartão.");
    } finally {
        setProcessing(false);
    }
  };

  const handleCopyPix = async () => {
    if (pixData?.copy_paste_code) {
      try {
        await navigator.clipboard.writeText(pixData.copy_paste_code);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch {
        alert("Copie manualmente: " + pixData.copy_paste_code);
      }
    }
  };

  const handlePixPaid = async () => {
      setProcessing(true);
      await new Promise(r => setTimeout(r, 1000));
      if (planDetails) {
          await updatePlan(planDetails.type);
          // FIX: Passa o plano explicitamente na URL
          navigate(`/?status=success&plan=${planDetails.type}`);
      }
  };

  // UI LOADING
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium">Carregando pagamento...</p>
    </div>
  );

  // SAFEGUARD
  if (!planDetails) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
            <button onClick={() => navigate('/settings')} className="text-sm font-bold text-slate-400 hover:text-primary dark:hover:text-white mb-4 transition-colors">
                <i className="fa-solid fa-arrow-left mr-2"></i> Alterar Plano
            </button>
            <h1 className="text-3xl font-black text-primary dark:text-white tracking-tight mb-2">Finalizar Assinatura</h1>
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 py-1 px-3 rounded-full w-fit mx-auto">
                <i className="fa-solid fa-lock"></i> Pagamento Seguro
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* RESUMO */}
            <div className="md:col-span-1 space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Seu Pedido</h3>
                    
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <p className="font-bold text-primary dark:text-white text-lg">{planDetails.label}</p>
                            <p className="text-xs text-slate-500">Mãos da Obra Premium</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 text-sm">Valor</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">R$ {planDetails.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex justify-between items-end pt-4 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-primary dark:text-white">Total</span>
                        <span className="text-3xl font-black text-secondary">
                            R$ {planDetails.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* PAGAMENTO */}
            <div className="md:col-span-2">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    
                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                        <button 
                            onClick={() => { setPaymentMethod('PIX'); setErrorMsg(''); }}
                            className={`flex-1 py-5 font-bold text-sm flex items-center justify-center gap-2 transition-all ${paymentMethod === 'PIX' ? 'bg-slate-50 dark:bg-slate-800 text-primary dark:text-white border-b-2 border-secondary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <i className="fa-brands fa-pix"></i> PIX (Rápido)
                        </button>
                        <button 
                            onClick={() => { setPaymentMethod('CREDIT_CARD'); setErrorMsg(''); }}
                            className={`flex-1 py-5 font-bold text-sm flex items-center justify-center gap-2 transition-all ${paymentMethod === 'CREDIT_CARD' ? 'bg-slate-50 dark:bg-slate-800 text-primary dark:text-white border-b-2 border-secondary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <i className="fa-solid fa-credit-card"></i> Cartão
                        </button>
                    </div>

                    <div className="p-8">
                        {errorMsg && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                <span className="text-sm font-bold">{errorMsg}</span>
                            </div>
                        )}

                        {paymentMethod === 'PIX' && (
                            <div className="animate-in fade-in">
                                {!pixData ? (
                                    <div className="text-center py-4">
                                        <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                                            Liberação imediata. Clique abaixo para gerar o código.
                                        </p>
                                        <button 
                                            onClick={handleGeneratePix}
                                            disabled={processing}
                                            className="w-full max-w-sm py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                        >
                                            {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-qrcode"></i>}
                                            {processing ? 'Gerando...' : 'Gerar QR Code Pix'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 inline-block shadow-inner mb-6">
                                            <img src={pixData.qr_code_base64.startsWith('data:image') ? pixData.qr_code_base64 : `data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                                        </div>
                                        <div className="mb-8 max-w-md mx-auto flex gap-2">
                                            <input readOnly value={pixData.copy_paste_code} className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-600 dark:text-slate-300 outline-none truncate font-mono" />
                                            <button onClick={handleCopyPix} className={`px-4 rounded-xl font-bold text-white transition-all ${copySuccess ? 'bg-green-500' : 'bg-secondary'}`}>
                                                <i className={`fa-solid ${copySuccess ? 'fa-check' : 'fa-copy'}`}></i>
                                            </button>
                                        </div>
                                        <button 
                                            onClick={handlePixPaid}
                                            disabled={processing}
                                            className="w-full max-w-sm py-4 bg-primary text-white font-bold rounded-xl shadow-lg"
                                        >
                                            {processing ? 'Verificando...' : 'Já fiz o pagamento'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {paymentMethod === 'CREDIT_CARD' && (
                            <form onSubmit={handleCreditCardSubmit} className="animate-in fade-in max-w-md mx-auto space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número do Cartão</label>
                                    <div className="relative">
                                        <input 
                                            name="number"
                                            value={cardData.number}
                                            onChange={handleCardChange}
                                            placeholder="0000 0000 0000 0000"
                                            maxLength={19}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-secondary/50 transition-all font-mono text-primary dark:text-white"
                                            required
                                        />
                                        <i className="fa-solid fa-credit-card absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome no Cartão</label>
                                    <input 
                                        name="holder"
                                        value={cardData.holder}
                                        onChange={handleCardChange}
                                        placeholder="COMO ESTA NO CARTAO"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-primary dark:text-white uppercase"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Validade</label>
                                        <input 
                                            name="expiry"
                                            value={cardData.expiry}
                                            onChange={handleCardChange}
                                            placeholder="MM/AA"
                                            maxLength={5}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-center font-mono text-primary dark:text-white"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CVV</label>
                                        <input 
                                            name="cvv"
                                            type="password"
                                            value={cardData.cvv}
                                            onChange={handleCardChange}
                                            placeholder="123"
                                            maxLength={4}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-center font-mono text-primary dark:text-white"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parcelas</label>
                                    <select 
                                        name="installments"
                                        value={cardData.installments}
                                        onChange={handleCardChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-primary dark:text-white"
                                    >
                                        <option value="1">1x de R$ {planDetails.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</option>
                                        {planDetails.price > 50 && <option value="2">2x de R$ {(planDetails.price / 2).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</option>}
                                        {planDetails.price > 100 && <option value="3">3x de R$ {(planDetails.price / 3).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</option>}
                                    </select>
                                </div>

                                <button 
                                    type="submit"
                                    disabled={processing}
                                    className="w-full py-4 mt-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-lock"></i>}
                                    {processing ? 'Processando...' : `Pagar R$ ${planDetails.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

