import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { dbService } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { PlanType } from '../types';

const PLAN_PRICES = {
  [PlanType.MENSAL]: 29.90,
  [PlanType.SEMESTRAL]: 149.90,
  [PlanType.VITALICIO]: 299.90
};

const Checkout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [planDetails, setPlanDetails] = useState<{ type: PlanType, price: number } | null>(null);
  const [pixData, setPixData] = useState<{ qr_code_base64: string, copy_paste_code: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      
      try {
        // Fetch fresh profile to get the plan intent and CPF
        const profile = await dbService.getUserProfile(user.id);
        
        if (!profile || !profile.plan_type) {
          alert("Nenhum plano selecionado. Redirecionando para escolha.");
          navigate('/settings');
          return;
        }

        const price = PLAN_PRICES[profile.plan_type as PlanType];
        setPlanDetails({ type: profile.plan_type as PlanType, price });
      } catch (err) {
        console.error("Erro ao carregar dados do checkout:", err);
        alert("Erro ao carregar pedido.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user, navigate]);

  const handleGeneratePix = async () => {
    if (!user || !planDetails) return;
    
    setProcessing(true);
    try {
      // Fetch profile again to ensure we have the CPF (if it was just added in signup)
      const profile = await dbService.getUserProfile(user.id);
      
      if (!profile.cpf) {
        alert("CPF é necessário para gerar o PIX.");
        // Redirect to profile or open modal (simplifying here)
        return;
      }

      const payload = {
        name: user.name,
        email: user.email,
        cpf: profile.cpf
      };

      const data = await dbService.generatePix(planDetails.price, payload);
      setPixData(data);

    } catch (error) {
      console.error("Erro ao gerar PIX:", error);
      alert("Falha na comunicação com o banco. Tente novamente.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyCode = async () => {
    if (pixData?.copy_paste_code) {
      try {
        await navigator.clipboard.writeText(pixData.copy_paste_code);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        alert("Erro ao copiar. Selecione o texto manualmente.");
      }
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-primary">
      <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
    </div>
  );

  if (!planDetails) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
      
      {/* HEADER */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-gold rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-4 shadow-lg shadow-orange-500/30">
           <i className="fa-brands fa-pix"></i>
        </div>
        <h1 className="text-2xl font-black text-primary dark:text-white tracking-tight">Finalizar Assinatura</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Pagamento seguro via Pix</p>
      </div>

      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        
        {/* SUMMARY CARD */}
        {!pixData ? (
          <div className="p-8">
            <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Resumo do Pedido</p>
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-bold text-primary dark:text-white">Plano {planDetails.type}</h2>
                  <p className="text-xs text-slate-500">Acesso imediato a todas as funções</p>
                </div>
                <p className="text-2xl font-black text-green-600 dark:text-green-400">R$ {planDetails.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <i className="fa-solid fa-check text-green-500"></i>
                <span>Pagamento instantâneo</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <i className="fa-solid fa-check text-green-500"></i>
                <span>Ambiente Seguro</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <i className="fa-solid fa-check text-green-500"></i>
                <span>Liberação automática</span>
              </div>
            </div>

            <button 
              onClick={handleGeneratePix}
              disabled={processing}
              className="w-full mt-8 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait"
            >
              {processing ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Gerando QR Code...
                </>
              ) : (
                <>
                  <i className="fa-brands fa-pix"></i> GERAR PIX
                </>
              )}
            </button>
            
            <button onClick={() => navigate('/settings')} className="w-full mt-4 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest">
              Cancelar / Trocar Plano
            </button>
          </div>
        ) : (
          /* PIX DISPLAY STATE */
          <div className="p-8 text-center animate-in fade-in zoom-in-95">
            <div className="mb-6">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4">Escaneie o QR Code abaixo:</p>
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 inline-block shadow-inner">
                {pixData.qr_code_base64.startsWith('data:image') ? (
                    <img src={pixData.qr_code_base64} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                ) : (
                    <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                )}
              </div>
            </div>

            <div className="mb-8">
              <p className="text-xs font-bold text-slate-400 mb-2">Ou copie o código:</p>
              <div className="flex gap-2">
                <input 
                  readOnly 
                  value={pixData.copy_paste_code} 
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-xs text-slate-600 dark:text-slate-300 outline-none truncate"
                />
                <button 
                  onClick={handleCopyCode}
                  className={`w-12 rounded-xl flex items-center justify-center text-white transition-all ${copySuccess ? 'bg-green-500' : 'bg-secondary'}`}
                >
                  <i className={`fa-solid ${copySuccess ? 'fa-check' : 'fa-copy'}`}></i>
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30 mb-6">
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                <i className="fa-solid fa-clock mr-1"></i> Após pagar, aguarde alguns segundos e clique no botão abaixo para liberar seu acesso.
              </p>
            </div>

            <button 
              onClick={handleReload}
              className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-check-circle"></i> Já realizei o pagamento
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
