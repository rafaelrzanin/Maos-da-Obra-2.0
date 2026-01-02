

import React, { useState } from 'react';
import * as ReactRouter from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { PlanType } from '../types.ts';
import { LIFETIME_BONUSES } from '../services/standards.ts';

const Settings = () => {
  const { user, isSubscriptionValid, isNewAccount, logout } = useAuth();
  const navigate = ReactRouter.useNavigate();
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
                                <h3 className="text-xl font-black text-white uppercase tracking-wide mb-1">{plan.name}</h3> {/* Reduced text-2xl to