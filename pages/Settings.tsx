import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { PlanType } from '../types';
import { LIFETIME_BONUSES } from '../services/standards';

const Settings: React.FC = () => {
  const { user, isSubscriptionValid } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  const [showBonusModal, setShowBonusModal] = useState(false);

  const fullAccessFeatures = [
    'Sem limites de obra',
    'Cronograma inteligente',
    'Controle de todos os gastos',
    'Calculadoras de material',
    'Contratos e Checklists',
    'Tudo liberado para você'
  ];

  const plans = [
    {
      id: PlanType.MENSAL,
      name: 'Mensal',
      price: 'R$ 29,90',
      period: '/mês',
      color: 'bg-primary',
      highlight: false,
      savings: null
    },
    {
      id: PlanType.SEMESTRAL,
      name: 'Semestral',
      price: 'R$ 149,90',
      period: '/semestre',
      color: 'bg-primary-light',
      highlight: true,
      savings: 'Economia de 17%'
    },
    {
      id: PlanType.VITALICIO,
      name: 'Vitalício',
      price: 'R$ 299,90',
      period: 'pague uma vez só',
      color: 'bg-premium',
      highlight: true,
      savings: 'O mais vantajoso'
    }
  ];

  const handleSubscribe = (planId: PlanType) => {
    if (!user) return;
    
    // Navegação interna para a página de Checkout com State
    navigate(`/checkout?plan=${planId}`, {
        state: {
            plan: planId
        }
    });
  };

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto pb-12 pt-4 px-4">
      {/* Show Header only if valid, or a different header if locked (controlled in App.tsx layout mainly, but text here helps) */}
      <h1 className="text-3xl font-bold text-text-main dark:text-white mb-2">
          {isSubscriptionValid ? 'Minha Assinatura' : 'Escolha seu Plano'}
      </h1>
      <p className="text-text-body dark:text-slate-400 mb-10">
          {isSubscriptionValid 
            ? 'Gerencie seu plano atual.' 
            : 'Para começar a usar o Mãos da Obra, ative uma assinatura.'}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => {
          const isCurrentPlanType = user.plan === plan.id;
          const isVitalicio = plan.id === PlanType.VITALICIO;
          const isLoading = loadingPlan === plan.id;
          
          // Logic for Button State:
          // 1. If it's the current plan type AND subscription is valid => "Current Plan" (Disabled)
          // 2. If it's the current plan type BUT subscription is INVALID (Expired) => "Renew" (Enabled)
          // 3. Otherwise => "Subscribe" (Enabled)
          
          const isActiveCurrent = isCurrentPlanType && isSubscriptionValid;
          const isExpiredCurrent = isCurrentPlanType && !isSubscriptionValid;

          return (
            <div 
              key={plan.id} 
              className={`relative bg-white dark:bg-slate-900 rounded-3xl p-8 flex flex-col border transition-all hover:shadow-xl ${
                isVitalicio ? 'border-premium shadow-lg shadow-premium/10' : 'border-slate-200 dark:border-slate-800 shadow-sm'
              } ${isActiveCurrent ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900' : ''}`}
            >
              {isActiveCurrent && (
                <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-2xl tracking-wider uppercase">
                  Ativo
                </div>
              )}
              
              {isExpiredCurrent && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-2xl tracking-wider uppercase">
                  Expirado
                </div>
              )}

              {plan.savings && !isCurrentPlanType && (
                 <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 ${isVitalicio ? 'bg-premium' : 'bg-success'} text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-sm`}>
                   {plan.savings}
                 </div>
              )}

              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 ${plan.color}`}>
                 <i className={`fa-solid ${isVitalicio ? 'fa-crown' : 'fa-calendar-check'} text-xl`}></i>
              </div>

              <h3 className="text-lg font-bold text-text-main dark:text-white uppercase tracking-wide mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                 <span className="text-3xl font-bold text-text-main dark:text-white">{plan.price}</span>
                 <span className="text-sm text-text-muted dark:text-slate-400">{plan.period.replace('/', '')}</span>
              </div>
              <p className="text-text-muted dark:text-slate-500 text-xs mb-8">
                  Sem taxas extras. Acesso imediato.
              </p>
              
              <div className="flex-1 mb-8">
                 <ul className="space-y-4">
                    {fullAccessFeatures.map((f, i) => (
                    <li key={i} className="flex items-start text-sm text-text-body dark:text-slate-300">
                        <i className={`fa-solid fa-check mt-0.5 mr-3 ${isVitalicio ? 'text-premium' : 'text-success'}`}></i>
                        {f}
                    </li>
                    ))}
                    {isVitalicio && (
                        <li className="flex items-start text-sm text-premium font-bold cursor-pointer hover:underline" onClick={() => setShowBonusModal(true)}>
                            <i className="fa-solid fa-gift mt-0.5 mr-3"></i>
                            + 4 Bônus Exclusivos (Ver)
                        </li>
                    )}
                 </ul>
              </div>

              <button
                disabled={isActiveCurrent || isLoading || loadingPlan !== null}
                onClick={() => handleSubscribe(plan.id)}
                className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center ${
                  isActiveCurrent 
                    ? 'bg-surface dark:bg-slate-800 text-text-muted dark:text-slate-400 cursor-default border border-slate-200 dark:border-slate-700' 
                    : isExpiredCurrent
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                        : isVitalicio 
                            ? 'bg-premium hover:bg-purple-800 text-white shadow-lg shadow-premium/30'
                            : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20'
                } ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                    Processando...
                  </>
                ) : isActiveCurrent ? (
                  'Plano Ativo'
                ) : isExpiredCurrent ? (
                  'Renovar Agora'
                ) : (
                  'Quero este plano'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* MODAL DE BONUS VITALICIO */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
                <div className="bg-premium p-6 text-center">
                    <i className="fa-solid fa-crown text-4xl text-white mb-2"></i>
                    <h3 className="text-xl font-bold text-white">Bônus do Plano Vitalício</h3>
                    <p className="text-purple-100 text-sm">Presentes extras para quem decide economizar de verdade.</p>
                </div>
                <div className="p-6">
                    <div className="space-y-4">
                        {LIFETIME_BONUSES.map((bonus, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-premium flex items-center justify-center shrink-0">
                                    <i className={`fa-solid ${bonus.icon}`}></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-text-main dark:text-white text-sm">{bonus.title}</h4>
                                    <p className="text-xs text-text-muted dark:text-slate-400">{bonus.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => setShowBonusModal(false)}
                        className="mt-6 w-full py-3 bg-slate-100 dark:bg-slate-800 text-text-main dark:text-white font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Entendi, que legal!
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
