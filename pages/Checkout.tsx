
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlanType } from '../types.ts';

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
  const { user, updatePlan, authLoading } = useAuth();
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
    holder: '',
    expiry: '',
    cvv: '',
    installments: '1'
  });

  // Helper para formatar valores monetários
  const formatCurrency = (value: number | string | undefined): string => {
    if (value === undefined || value === null || isNaN(Number(value))) {
      return 'R$ 0,00';
    }
    return Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // 1. INICIALIZAÇÃO ROBUSTA (PROTEÇÃO CONTRA TELA BRANCA)
  useEffect(() => {
    if (authLoading) {
        return;
    }

    if (!user) {
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
  }, [user, location, navigate, authLoading]);

  // --- MÉTODOS AUXILIARES ---

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // FIX: Complete the handleCardChange function which was truncated.
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    
    // Máscaras
    if (name === 'number') value = value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
    if (name === 'expiry') value = value.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 5);
    if (name === 'cvv') value = value.replace(/\D/g, '').slice(0, 4);
    // Complete the function by updating the state for the changed field.
    setCardData(prev => ({ ...prev, [name]: value }));
  };

  // --- RENDERING ---

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    );
  }

  if (!user || !planDetails) {
    return (
      <div className="text-center text-red-500 py-10">
        Ocorreu um erro ao carregar os dados de usuário ou plano. Por favor, retorne à página de Configurações.
      </div>
    );
  }

  const handleCopyPix = () => {
    if (pixData) {
      navigator.clipboard.writeText(pixData.copy_paste_code);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleSimulatePayment = async () => {
    setProcessing(true);
    setErrorMsg('');
    try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
        // On success, redirect to settings with success status
        navigate(`/settings?status=success&plan=${planDetails.type}`, { replace: true });
    } catch (err: any) {
        setErrorMsg(err.message || "Erro ao processar pagamento.");
    } finally {
        setProcessing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-12 pt-4 px-4 font-sans animate-in fade-in">
      <h1 className="text-3xl font-black text-primary dark:text-white mb-6 text-center tracking-tight">Finalizar Pedido</h1>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mx-auto mb-8">
        Quase lá! Escolha seu método de pagamento para ativar seu {planDetails.label}.
      </p>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-900 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in" role="alert">
          <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
        </div>
      )}

      {/* DETALHES DO PEDIDO */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
        <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Seu Pedido</h2>
        <div className="flex justify-between items-center text-lg font-bold mb-2">
          <span className="text-slate-700 dark:text-slate-300">{planDetails.label}</span>
          <span className="text-primary dark:text-white">{formatCurrency(planDetails.price)}</span>
        </div>
        <div className="flex justify-between items-center text-2xl font-black pt-4 border-t border-slate-200 dark:border-slate-800">
          <span className="text-primary dark:text-white">Total</span>
          <span className="text-secondary">{formatCurrency(planDetails.price)}</span>
        </div>
      </div>

      {/* SELEÇÃO DO MÉTODO DE PAGAMENTO */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
        <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Forma de Pagamento</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setPaymentMethod('PIX')}
            className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${paymentMethod === 'PIX' ? 'border-secondary bg-secondary/5' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-secondary/50'}`}
            aria-pressed={paymentMethod === 'PIX'}
            aria-label="Pagar com PIX"
          >
            <i className="fa-brands fa-pix text-3xl mb-2 text-green-500"></i>
            <span className="text-sm font-bold text-primary dark:text-white">PIX</span>
          </button>
          <button
            onClick={() => setPaymentMethod('CREDIT_CARD')}
            className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${paymentMethod === 'CREDIT_CARD' ? 'border-secondary bg-secondary/5' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-secondary/50'}`}
            aria-pressed={paymentMethod === 'CREDIT_CARD'}
            aria-label="Pagar com Cartão de Crédito"
          >
            <i className="fa-regular fa-credit-card text-3xl mb-2 text-blue-500"></i>
            <span className="text-sm font-bold text-primary dark:text-white">Cartão</span>
          </button>
        </div>
      </div>

      {/* DETALHES DO PAGAMENTO (PIX) */}
      {paymentMethod === 'PIX' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mb-8 animate-in fade-in">
          <h2 className="text-xl font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
            <i className="fa-brands fa-pix text-green-500"></i> Pagar com PIX
          </h2>
          {pixData ? (
            <div className="text-center">
              <p className="text-slate-700 dark:text-slate-300 mb-4">Escaneie o QR Code ou copie o código Pix:</p>
              <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 mx-auto mb-4 border border-slate-200 dark:border-slate-700 rounded-lg" />
              <div className="relative mb-4">
                <input
                  type="text"
                  readOnly
                  value={pixData.copy_paste_code}
                  className="w-full p-3 pr-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white text-sm"
                  aria-label="Código Pix Copia e Cola"
                />
                <button
                  onClick={handleCopyPix}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-secondary text-white hover:bg-secondary-dark text-xs font-bold"
                  aria-label={copySuccess ? 'Código Pix copiado' : 'Copiar código Pix'}
                >
                  {copySuccess ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Após o pagamento, seu plano será ativado em poucos minutos automaticamente.</p>
              <button
                onClick={handleSimulatePayment} // Simula o clique em "Já paguei" para fins de teste
                disabled={processing}
                className="w-full py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                aria-label="Ativar plano após pagamento via Pix"
              >
                {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Já Paguei! Ativar Plano'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSimulatePayment} // Simula a geração do PIX
              disabled={processing}
              className="w-full py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              aria-label="Gerar QR Code Pix para pagamento"
            >
              {processing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Gerar PIX para Pagar'}
            </button>
          )}
        </div>
      )}

      {/* DETALHES DO PAGAMENTO (CARTÃO DE CRÉDITO) */}
      {paymentMethod === 'CREDIT_CARD' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mb-8 animate-in fade-in">
          <h2 className="text-xl font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
            <i className="fa-regular fa-credit-card text-blue-500"></i> Pagar com Cartão de Crédito
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            Em desenvolvimento. Para testar, use o método PIX.
          </p>
          <form onSubmit={handleSimulatePayment} className="space-y-4"> {/* Using handleSimulatePayment for now */}
            <div>
              <label htmlFor="card-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número do Cartão</label>
              <input
                id="card-number"
                type="text"
                name="number"
                value={cardData.number}
                onChange={handleCardChange}
                maxLength={19}
                placeholder="XXXX XXXX XXXX XXXX"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                disabled={true} // Disable while in development
                aria-label="Número do Cartão de Crédito"
              />
            </div>
            <div>
              <label htmlFor="card-holder" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome no Cartão</label>
              <input
                id="card-holder"
                type="text"
                name="holder"
                value={cardData.holder}
                onChange={handleCardChange}
                placeholder="NOME COMPLETO"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                disabled={true} // Disable while in development
                aria-label="Nome completo no cartão"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="card-expiry" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Validade</label>
                <input
                  id="card-expiry"
                  type="text"
                  name="expiry"
                  value={cardData.expiry}
                  onChange={handleCardChange}
                  maxLength={5}
                  placeholder="MM/AA"
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                  disabled={true} // Disable while in development
                  aria-label="Data de validade do cartão"
                />
              </div>
              <div>
                <label htmlFor="card-cvv" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CVV</label>
                <input
                  id="card-cvv"
                  type="text"
                  name="cvv"
                  value={cardData.cvv}
                  onChange={handleCardChange}
                  maxLength={4}
                  placeholder="XXX"
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                  disabled={true} // Disable while in development
                  aria-label="Código de segurança do cartão"
                />
              </div>
            </div>
            <div>
              <label htmlFor="card-installments" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parcelas</label>
              <select
                id="card-installments"
                name="installments"
                value={cardData.installments}
                onChange={handleCardChange}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                disabled={true} // Disable while in development
                aria-label="Número de parcelas"
              >
                <option value="1">1x de {formatCurrency(planDetails.price)}</option>
                {/* Add more installment options here if needed, calculating price */}
              </select>
            </div>
            <button
              type="submit"
              disabled={true} // Always disabled as a placeholder
              className="w-full py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              aria-label="Pagar com Cartão de Crédito (funcionalidade em breve)"
            >
              Pagar com Cartão (Em Breve)
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Checkout;
