
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { PlanType } from '../types.ts';
import { LIFETIME_BONUSES } from '../services/standards.ts';

const Settings: React.FC = () => {
  const { user, isSubscriptionValid, isNewAccount, logout } = useAuth();
  const navigate = useNavigate();
  const [showBonusModal, setShowBonusModal] = useState(false);

  const commonFeatures = [
    'Obras Ilimitadas',
    'Cronograma Inteligente',
    'Controle Financeiro Total',
    'Gestão de Equipe/Fornecedores',
    'Relatórios PDF e Excel'
  ];

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

  const plans = [
    {
      id: PlanType.MENSAL,
      name: 'Mensal',
      price: 29.90, 
      period: '/mês',
      savings: null,
    },
    {
      id: PlanType.SEMESTRAL,
      name: 'Semestral',
      price: 97.00, 
      period: '/semestre',
      savings: 'Economia de 46%',
    },
    {
      id: PlanType.VITALICIO,
      name: 'VITALÍCIO',
      price: 247.00, 
      period: 'PAGAMENTO ÚNICO',
      savings: 'OFERTA ESPECIAL',
    }
  ];

  const handleSubscribe = (planId: PlanType) => {
    if (!user) return;
    navigate(`/checkout?plan=${planId}`, {
        state: { plan: planId }
    });
  };

  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto pb-12 pt-4 px-4 font-sans animate-in fade-in">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-black text-primary dark:text-white mb-3 tracking-tight">
            {isSubscriptionValid ? 'Gerenciar Assinatura' : 'Invista na sua Tranquilidade'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
            {isSubscriptionValid 
                ? 'Você já tem acesso às melhores ferramentas de gestão.' 
                : 'Escolha o plano ideal para acabar com o desperdício e a dor de cabeça na sua obra.'}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-center"> {/* Adjusted gap */}
        {plans.map(plan => {
          const isVitalicio = plan.id === PlanType.VITALICIO;
          
          // Estados do Plano
          const isMyOldPlan = !isNewAccount && user.plan === plan.id;
          const isActiveCurrent = isMyOldPlan && user.plan === PlanType.VITALICIO ? true : isMyOldPlan && isSubscriptionValid;
          const isExpiredCurrent = isMyOldPlan && !isSubscriptionValid && user.plan !== PlanType.VITALICIO;

          // LANDING PAGE STYLE FOR VITALICIO
          if (isVitalicio) {
              return (
                <div key={plan.id} className="relative transform lg:scale-110 z-10">
                    {/* Glowing Effect */}
                    <div className="absolute inset-0 bg-gradient-gold blur-2xl opacity-20 rounded-[2.5rem]"></div>
                    
                    <div className="relative bg-slate-900 text-white rounded-[2rem] border-2 border-amber-500/50 p-1 overflow-hidden shadow-2xl dark:shadow-card-dark-subtle shadow-amber-900/50">
                        {/* RIBBON */}
                        <div className="absolute top-0 right-0">
                            <div className="bg-gradient-gold text-white text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-widest shadow-lg">
                                Melhor Escolha
                            </div>
                        </div>

                        <div className="p-6 md:p-8 flex flex-col h-full bg-gradient-to-b from-slate-800 to-slate-900 rounded-[1.8rem]"> {/* Adjusted padding */}
                            <div className="mb-6 text-center">
                                <div className="w-14 h-14 mx-auto bg-gradient-gold rounded-2xl flex items-center justify-center text-white text-2xl shadow-glow mb-3"> {/* Reduced size, mb-4 to mb-3 */}
                                    <i className="fa-solid fa-crown"></i>
                                </div>
                                <h3 className="text-xl font-black text-white uppercase tracking-wide mb-1">{plan.name}</h3> {/* Reduced text-2xl to text-xl */}
                                <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">{plan.period}</p>
                            </div>

                            <div className="text-center mb-6"> {/* Reduced mb-8 to mb-6 */}
                                <div className="flex items-center justify-center gap-1">
                                    <span className="text-sm text-slate-400 font-medium line-through">{formatCurrency(497)}</span>
                                    <span className="text-4xl font-black text-white tracking-tighter">{formatCurrency(plan.price)}</span> {/* Reduced text-5xl to text-4xl */}
                                </div>
                                <p className="text-xs text-slate-400 mt-2">Parcelamento em até 12x no cartão</p>
                            </div>

                            <div className="flex-1 space-y-3 mb-6"> {/* Reduced space-y-4 and mb-8 */}
                                <p className="text-center text-xs font-bold uppercase text-amber-500 tracking-widest mb-2 border-b border-white/10 pb-2">Tudo do mensal + Bônus:</p>
                                <li className="flex items-start text-sm text-slate-200 font-medium">
                                    <i className="fa-solid fa-check-circle mt-0.5 mr-3 text-amber-400 text-lg"></i>
                                    Acesso para SEMPRE (sem mensalidade)
                                </li>
                                <li className="flex items-start text-sm text-slate-200 font-medium">
                                    <i className="fa-solid fa-robot mt-0.5 mr-3 text-amber-400 text-lg"></i>
                                    IA Zé da Obra Ilimitada
                                </li>
                                <li className="flex items-start text-sm text-slate-200 font-medium">
                                    <i className="fa-solid fa-file-contract mt-0.5 mr-3 text-amber-400 text-lg"></i>
                                    Gerador de Contratos & Checklists
                                </li>
                            </div>

                            <button
                                disabled={isActiveCurrent}
                                onClick={() => handleSubscribe(plan.id)}
                                className={`w-full py-4 rounded-xl font-black text-base uppercase tracking-wide shadow-lg transition-all transform active:scale-95 ${ /* Adjusted padding, font size */
                                    isActiveCurrent 
                                    ? 'bg-slate-700 text-slate-400 cursor-default' 
                                    : 'bg-gradient-gold hover:brightness-110 text-white shadow-amber-500/20'
                                }`}
                                aria-label={isActiveCurrent ? 'Plano Vitalício Ativo' : 'Garantir Acesso Vitalício Agora'}
                            >
                                {isActiveCurrent ? 'Plano Ativo' : 'GARANTIR ACESSO AGORA'}
                            </button>
                            {!isActiveCurrent && (
                                <p className="text-center text-[10px] text-slate-500 mt-3 flex items-center justify-center gap-1"> {/* Adjusted margin */}
                                    <i className="fa-solid fa-lock"></i> Compra segura e acesso imediato
                                </p>
                            )}
                        </div>
                    </div>
                </div>
              );
          }

          // STANDARD CARDS
          return (
            <div 
              key={plan.id} 
              className={`relative bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col border transition-all hover:border-slate-300 dark:hover:border-slate-700 ${isActiveCurrent ? 'border-secondary ring-1 ring-secondary' : 'border-slate-200 dark:border-slate-800'} shadow-sm dark:shadow-card-dark-subtle`}
            >
              {isActiveCurrent && (
                <div className="absolute top-0 right-0 bg-secondary text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-2xl tracking-wider uppercase">
                  Seu Plano
                </div>
              )}
              
              {isExpiredCurrent && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-2xl tracking-wider uppercase">
                  Expirado
                </div>
              )}

              <div className="mb-5"> {/* Reduced mb-6 to mb-5 */}
                 <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{plan.name}</h3>
                 <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-primary dark:text-white">{formatCurrency(plan.price)}</span> {/* Reduced text-3xl to text-2xl */}
                    <span className="text-sm text-slate-400">{plan.period}</span>
                 </div>
                 {plan.savings && <span className="inline-block mt-2 text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md">{plan.savings}</span>}
              </div>
              
              <div className="flex-1 mb-6"> {/* Reduced mb-8 to mb-6 */}
                 <ul className="space-y-3"> {/* Reduced space-y-4 to space-y-3 */}
                    {commonFeatures.map((f, i) => (
                    <li key={i} className="flex items-start text-sm text-slate-600 dark:text-slate-300">
                        <i className="fa-solid fa-check mt-0.5 mr-3 text-secondary"></i>
                        {f}
                    </li>
                    ))}
                    <li className="flex items-start text-sm text-slate-400 italic">
                        <i className="fa-solid fa-clock mt-0.5 mr-3 text-slate-300"></i>
                        IA Zé da Obra: Apenas 7 dias
                    </li>
                 </ul>
              </div>

              <button
                disabled={isActiveCurrent}
                onClick={() => handleSubscribe(plan.id)}
                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center border-2 ${ /* Adjusted padding */
                  isActiveCurrent 
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent' 
                    : isExpiredCurrent
                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        : 'bg-white dark:bg-slate-900 text-primary dark:text-white border-primary dark:border-white hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                aria-label={isActiveCurrent ? `Seu plano ${plan.name} está ativo` : isExpiredCurrent ? `Renovar plano ${plan.name}` : `Selecionar plano ${plan.name}`}
              >
                {isActiveCurrent ? 'Seu Plano Ativo' : isExpiredCurrent ? 'Renovar Plano' : 'Selecionar Plano'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Settings;
    