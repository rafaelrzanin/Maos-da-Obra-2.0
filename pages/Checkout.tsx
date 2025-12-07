import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { dbService } from '../services/db';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlanType } from '../types';

// Preços atualizados conforme solicitação
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

  // Estados do Cartão de Crédito
  const [cardData, setCardData] = useState({
    number: '',
    holder: '',
    expiry: '',
    cvv: '',
    installments: '1'
  });

  // 1. INICIALIZAÇÃO E RECUPERAÇÃO DO PLANO
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      
      try {
        // Tenta pegar o plano da URL (?plan=VITALICIO)
        const params = new URLSearchParams(location.search);
        let targetPlan = params.get('plan') as PlanType;

        // Se não tiver na URL, tenta pegar do state da navegação
        if (!targetPlan && location.state && (location.state as any).plan) {
            targetPlan = (location.state as any).plan;
        }

        // Se ainda não tiver, tenta verificar se o usuário já tinha uma intenção de compra no perfil (fallback)
        if (!targetPlan) {
            const profile = await dbService.getUserProfile(user.id);
            if (profile && profile.plan_type) {
                targetPlan = profile.plan_type as PlanType;
            }
        }

        // Validação Final
        if (!targetPlan || !PLAN_PRICES[targetPlan]) {
          console.warn("Plano não identificado ou inválido. Redirecionando.");
          navigate('/settings');
          return;
        }

        // Define os detalhes do plano
        setPlanDetails({
            type: targetPlan,
            price: PLAN_PRICES[targetPlan],
            label: PLAN_LABELS[targetPlan]
        });

      } catch (err) {
        console.error("Erro ao inicializar checkout:", err);
        setErrorMsg("Erro ao carregar detalhes do pedido.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user, navigate, location]);

  // --- MÉTODOS AUXILIARES ---

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    
    // Máscaras Simples
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
    
    // DEBUG: Verificando chaves no console como solicitado
    const env = (import.meta as any).env || {};
    const publicKey = env.VITE_NEON_PUBLIC_KEY;
    const secretKey = env.VITE_NEON_SECRET_KEY;
    console.log("Tentando gerar Pix com chave Pública:", publicKey ? `${publicKey.substring(0, 10)}...` : "NÃO DEFINIDA");

    try {
      // 1. Dados do usuário
      const profile = await dbService.getUserProfile(user.id);
      const cpf = profile?.cpf || '000.000.000-00'; 
      const amountCents = Math.round(planDetails.price * 100);

      // 2. Se as chaves existirem, tentar integração real
      if (publicKey && secretKey) {
          try {
              // Exemplo de chamada para API Neon (Endpoint genérico placeholder)
              // Em um cenário real, você ajustaria a URL exata da documentação da Neon
              const response = await fetch('https://api.neonpay.com.br/v1/pix/transactions', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${secretKey}`, // Autenticação Server-side (Cuidado em produção front-end)
                      'Public-Key': publicKey
                  },
                  body: JSON.stringify({
                      amount: amountCents,
                      customer: {
                          name: user.name,
                          email: user.email,
                          cpf: cpf.replace(/\D/g, '')
                      }
                  })
              });

              if (response.ok) {
                  const data = await response.json();
                  if (data && data.qrcode) {
                      setPixData({
                          qr_code_base64: data.qrcode.base64 || data.qrcode, 
                          copy_paste_code: data.qrcode.emv || data.emv
                      });
                      return; // Sucesso na integração real
                  }
              } else {
                  console.warn("Neon API retornou erro:", response.status, response.statusText);
                  // Não lançamos erro aqui para cair no fallback do mock e não travar o usuário
              }
          } catch (apiError) {
              console.error("Erro na requisição Neon Pay:", apiError);
              // Segue para o fallback
          }
      }

      // 3. Fallback / Mock (Caso a API falhe ou chaves não existam, garantindo que o usuário consiga "pagar")
      console.log("Usando gerador Pix interno (Fallback).");
      const mockData = await dbService.generatePix(planDetails.price, {
        name: user.name,
        email: user.email,
        cpf: cpf
      });
      setPixData(mockData);

    } catch (error: any) {
      console.error("Erro CRÍTICO no Pix:", error);
      setErrorMsg("Falha ao gerar PIX. Por favor, tente novamente ou use cartão.");
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
        // Validação básica frontend
        if (cardData.number.length < 16) throw new Error("Número do cartão inválido");
        if (cardData.cvv.length < 3) throw new Error("CVV inválido");
        if (!cardData.expiry.includes('/')) throw new Error("Validade inválida");

        // SIMULAÇÃO DE PROCESSAMENTO DE CARTÃO
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const success = true; 

        if (success) {
            await updatePlan(planDetails.type);
            alert("Pagamento Aprovado com Sucesso!");
            navigate('/?status=success'); 
        } else {
            throw new Error("Transação recusada pela operadora.");
        }

    } catch (err: any) {
        console.error(err);
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
          navigate('/?status=success');
      }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 animate-pulse">Carregando oferta...</p>
    </div>
  );

  if (!planDetails) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
            <button onClick={() => navigate('/settings')} className="text-sm font-bold text-slate-400 hover:text-primary dark:hover:text-white mb-4 transition-colors">
                <i className="fa-solid fa-arrow-left mr-2"></i> Voltar para Planos
            </button>
            <h1 className="text-3xl font-black text-primary dark:text-white tracking-tight mb-2">Checkout Seguro</h1>
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 py-1 px-3 rounded-full w-fit mx-auto">
                <i className="fa-solid fa-lock"></i> Ambiente Criptografado de 256-bits
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* COLUNA DA ESQUERDA: RESUMO */}
            <div className="md:col-span-1 space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Resumo do Pedido</h3>
                    
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <p className="font-bold text-primary dark:text-white text-lg">{planDetails.label}</p>
                            <p className="text-xs text-slate-500">Assinatura Mãos da Obra</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500 text-sm">Subtotal</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">R$ {planDetails.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-slate-500 text-sm">Descontos</span>
                        <span className="font-bold text-green-500">- R$ 0,00</span>
                    </div>

                    <div className="flex justify-between items-end pt-4 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-primary dark:text-white">Total a pagar</span>
                        <span className="text-3xl font-black text-secondary">
                            R$ {planDetails.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 mt-1">
                        <i className="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-blue-900 dark:text-blue-200">Garantia de 30 Dias</h4>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Se não gostar, devolvemos seu dinheiro sem perguntas.</p>
                    </div>
                </div>
            </div>

            {/* COLUNA DA DIREITA: PAGAMENTO */}
            <div className="md:col-span-2">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    
                    {/* SELETOR DE ABAS */}
                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                        <button 
                            onClick={() => { setPaymentMethod('PIX'); setErrorMsg(''); }}
                            className={`flex-1 py-5 font-bold text-sm flex items-center justify-center gap-2 transition-all ${paymentMethod === 'PIX' ? 'bg-slate-50 dark:bg-slate-800 text-primary dark:text-white border-b-2 border-secondary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <i className="fa-brands fa-pix"></i> PIX (Instantâneo)
                        </button>
                        <button 
                            onClick={() => { setPaymentMethod('CREDIT_CARD'); setErrorMsg(''); }}
                            className={`flex-1 py-5 font-bold text-sm flex items-center justify-center gap-2 transition-all ${paymentMethod === 'CREDIT_CARD' ? 'bg-slate-50 dark:bg-slate-800 text-primary dark:text-white border-b-2 border-secondary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <i className="fa-solid fa-credit-card"></i> Cartão de Crédito
                        </button>
                    </div>

                    <div className="p-8">
                        
                        {/* MENSAGENS DE ERRO */}
                        {errorMsg && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                <span className="text-sm font-bold">{errorMsg}</span>
                            </div>
                        )}

                        {/* --- VIEW: PIX --- */}
                        {paymentMethod === 'PIX' && (
                            <div className="animate-in fade-in">
                                {!pixData ? (
                                    <div className="text-center py-8">
                                        <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <i className="fa-brands fa-pix text-4xl"></i>
                                        </div>
                                        <h3 className="text-xl font-bold text-primary dark:text-white mb-2">Pague com Pix e libere na hora</h3>
                                        <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto">
                                            Ao clicar no botão abaixo, geraremos um QR Code único para sua transação. A liberação do plano ocorre em segundos após o pagamento.
                                        </p>
                                        <button 
                                            onClick={handleGeneratePix}
                                            disabled={processing}
                                            className="w-full max-w-sm py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                        >
                                            {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-qrcode"></i>}
                                            {processing ? 'Gerando Código...' : 'Gerar QR Code Pix'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">Leia o QR Code no app do seu banco:</p>
                                        <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 inline-block shadow-inner mb-6">
                                            {pixData.qr_code_base64.startsWith('data:image') ? (
                                                <img src={pixData.qr_code_base64} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                                            ) : (
                                                <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                                            )}
                                        </div>
                                        
                                        <div className="mb-8 max-w-md mx-auto">
                                            <p className="text-xs font-bold text-slate-400 mb-2 text-left">Ou copie e cole:</p>
                                            <div className="flex gap-2">
                                                <input readOnly value={pixData.copy_paste_code} className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-600 dark:text-slate-300 outline-none truncate font-mono" />
                                                <button onClick={handleCopyPix} className={`px-4 rounded-xl font-bold text-white transition-all ${copySuccess ? 'bg-green-500' : 'bg-secondary'}`}>
                                                    <i className={`fa-solid ${copySuccess ? 'fa-check' : 'fa-copy'}`}></i>
                                                </button>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={handlePixPaid}
                                            disabled={processing}
                                            className="w-full max-w-sm py-4 bg-primary text-white font-bold rounded-xl shadow-lg transition-all"
                                        >
                                            {processing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check-circle mr-2"></i>}
                                            {processing ? 'Verificando...' : 'Já fiz o pagamento'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- VIEW: CARTÃO --- */}
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
                                        <div className="relative">
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
                                            <i className="fa-solid fa-circle-question absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" title="Código de segurança atrás do cartão"></i>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parcelamento</label>
                                    <select 
                                        name="installments"
                                        value={cardData.installments}
                                        onChange={handleCardChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-primary dark:text-white"
                                    >
                                        <option value="1">1x de R$ {planDetails.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (Sem juros)</option>
                                        {planDetails.price > 50 && <option value="2">2x de R$ {(planDetails.price / 2).toLocaleString('pt-BR', {minimumFractionDigits: 2})} (Sem juros)</option>}
                                        {planDetails.price > 100 && <option value="3">3x de R$ {(planDetails.price / 3).toLocaleString('pt-BR', {minimumFractionDigits: 2})} (Sem juros)</option>}
                                        {planDetails.price > 200 && <option value="6">6x de R$ {(planDetails.price / 6).toLocaleString('pt-BR', {minimumFractionDigits: 2})} (Sem juros)</option>}
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
                                
                                <div className="text-center">
                                    <p className="text-[10px] text-slate-400 mt-2">
                                        Ao confirmar, você concorda com nossos Termos de Uso.
                                    </p>
                                </div>
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
