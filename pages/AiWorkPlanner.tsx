
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { aiService } from '../services/ai.ts';
import { Work, AIWorkPlan, PlanType } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';
import { ZeModal } from '../components/ZeModal.tsx';

/** =========================
 * UI helpers
 * ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const surface =
  "bg-white border border-slate-200/90 shadow-card-default ring-1 ring-black/5 " +
  "dark:bg-slate-900/70 dark:border-slate-800 dark:shadow-card-dark-subtle dark:ring-0";

const card = "rounded-3xl p-6 lg:p-8";

const AiWorkPlanner = () => {
  const { id: workId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, authLoading, isUserAuthFinished, trialDaysRemaining } = useAuth();

  const [work, setWork] = useState<Work | null>(null);
  const [aiPlan, setAiPlan] = useState<AIWorkPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAiAccessModal, setShowAiAccessModal] = useState(false);
  const [showGenerationErrorModal, setShowGenerationErrorModal] = useState(false); // NEW: State for generation errors

  const isVitalicio = user?.plan === PlanType.VITALICIO;
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const hasAiAccess = isVitalicio || isAiTrialActive;

  // Function to determine risk class
  const getRiskClass = (likelihood: 'low' | 'medium' | 'high') => {
    switch (likelihood) {
      case 'low':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'medium':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'high':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default:
        return 'bg-slate-200 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400';
    }
  };

  const generatePlan = useCallback(async () => {
    if (!work || !hasAiAccess) return;

    setLoadingPlan(true);
    setErrorMsg('');
    setAiPlan(null);

    try {
      const plan = await aiService.generateWorkPlanAndRisk(work);
      setAiPlan(plan);
    } catch (error: any) {
      console.error("Erro ao gerar plano da IA:", error);
      setErrorMsg(`Não foi possível gerar o plano inteligente: ${error.message || 'Erro desconhecido.'}`);
      setShowGenerationErrorModal(true); // Show modal for generation errors
    } finally {
      setLoadingPlan(false);
    }
  }, [work, hasAiAccess]);

  useEffect(() => {
    if (!isUserAuthFinished || authLoading) return;

    const loadWorkAndPlan = async () => {
      if (!workId || !user?.id) {
        navigate('/');
        return;
      }

      setLoadingPlan(true);
      setErrorMsg('');

      try {
        const fetchedWork = await dbService.getWorkById(workId);
        if (!fetchedWork || fetchedWork.userId !== user.id) {
          navigate('/'); // Redirect if work not found or not owned
          return;
        }
        setWork(fetchedWork);

        if (!hasAiAccess) {
          setShowAiAccessModal(true);
          setLoadingPlan(false);
          return;
        }

        await generatePlan(); // Generate plan immediately if access is valid

      } catch (error: any) {
        console.error("Erro ao carregar dados da obra ou plano AI:", error);
        setErrorMsg(`Erro ao carregar dados da obra: ${error.message || 'Erro desconhecido.'}`);
        setShowGenerationErrorModal(true); // Show modal for initial load errors
        setLoadingPlan(false);
      }
    };

    loadWorkAndPlan();
  }, [workId, user, navigate, isUserAuthFinished, authLoading, hasAiAccess, generatePlan]);

  if (authLoading || !isUserAuthFinished) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    );
  }

  if (!user) {
    return null; // Should be handled by Layout redirect
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans">
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button
          onClick={() => navigate(`/work/${workId}`)}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label="Voltar para detalhes da obra"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">Planejamento Inteligente <span className="text-secondary">AI</span></h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Obra: {work?.name || 'Carregando...'}</p>
        </div>
      </div>

      {showAiAccessModal && (
        <ZeModal
          isOpen={showAiAccessModal}
          title="Acesso Premium necessário!"
          message="O Planejamento Inteligente AI é uma funcionalidade exclusiva para assinantes Vitalícios ou durante o período de teste. Melhore sua gestão de obras agora!"
          confirmText="Ver Planos"
          onConfirm={async (_e?: React.FormEvent) => navigate('/settings')}
          onCancel={async (_e?: React.FormEvent) => { setShowAiAccessModal(false); navigate(`/work/${workId}`); }}
          type="WARNING"
          cancelText="Voltar"
        >
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 shadow-inner border border-slate-100 dark:border-slate-700">
            <p>Seu período de teste pode ter expirado ou você precisa de um plano Vitalício para acessar esta ferramenta.</p>
          </div>
        </ZeModal>
      )}

      {showGenerationErrorModal && (
        <ZeModal
          isOpen={showGenerationErrorModal}
          title="Erro ao Gerar Plano"
          message={errorMsg || "Não foi possível gerar o plano inteligente. Tente novamente mais tarde ou verifique sua conexão."}
          confirmText="Tentar Novamente"
          onConfirm={async (_e?: React.FormEvent) => { setShowGenerationErrorModal(false); await generatePlan(); }}
          onCancel={async (_e?: React.FormEvent) => { setShowGenerationErrorModal(false); navigate(`/work/${workId}`); }}
          type="ERROR"
          cancelText="Voltar para Obra"
        />
      )}

      {loadingPlan && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center animate-in fade-in duration-500">
          <div className="relative mb-8">
            <div className="w-28 h-28 rounded-full border-4 border-slate-800 flex items-center justify-center relative z-10 bg-slate-900">
              <img src={ZE_AVATAR} className="w-20 h-20 rounded-full border-2 border-slate-700 object-cover" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} alt="Zé da Obra Avatar" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-t-secondary border-r-secondary border-b-transparent border-l-transparent animate-spin"></div>
          </div>
          <h2 className="text-2xl font-black text-primary dark:text-white mb-2 animate-pulse">
            Zé da Obra AI está elaborando seu plano...
          </h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Isso pode levar alguns segundos.
          </p>
        </div>
      )}

      {/* NEW: Removed direct errorMsg display here, as it's handled by showGenerationErrorModal */}
      {/* errorMsg && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-900 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in" role="alert">
          <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
        </div>
      )*/}

      {aiPlan && !loadingPlan && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* General Advice */}
          {aiPlan.generalAdvice && (
            <div className={cx(surface, "p-4 md:p-5 flex items-start gap-4 mb-6 transition-all duration-300 transform animate-in fade-in slide-in-from-top-4")} role="status">
                <div className="w-12 h-12 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0">
                    <img 
                    src={ZE_AVATAR} 
                    alt="Zé da Obra" 
                    className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800"
                    onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}
                    />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-black uppercase tracking-widest mb-1 text-secondary">Conselho do Zé!</p>
                    <p className="text-primary dark:text-white font-bold text-base leading-tight">{aiPlan.generalAdvice}</p>
                </div>
            </div>
          )}

          {/* Timeline Summary */}
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Resumo do Cronograma</h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{aiPlan.timelineSummary}</p>
          </div>

          {/* Detailed Steps */}
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Etapas Detalhadas</h2>
            <div className="space-y-4">
              {aiPlan.detailedSteps.map((step, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <h3 className="font-bold text-primary dark:text-white text-lg mb-1">{step.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Duração estimada: {step.estimatedDurationDays} dias</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{step.notes}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Potential Risks */}
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Riscos Potenciais</h2>
            <div className="space-y-4">
              {aiPlan.potentialRisks.map((risk, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-primary dark:text-white text-lg">{risk.description}</h3>
                    <span className={cx("px-3 py-1 rounded-full text-xs font-bold", getRiskClass(risk.likelihood))}>
                      {risk.likelihood === 'low' ? 'Baixa' : risk.likelihood === 'medium' ? 'Média' : 'Alta'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Mitigação: {risk.mitigation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Material Suggestions */}
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Sugestões de Materiais</h2>
            <div className="space-y-4">
              {aiPlan.materialSuggestions.map((material, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-primary dark:text-white text-lg">{material.item}</h3>
                    <span className={cx("px-3 py-1 rounded-full text-xs font-bold", getRiskClass(material.priority))}>
                      {material.priority === 'low' ? 'Baixa' : material.priority === 'medium' ? 'Média' : 'Alta'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{material.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={generatePlan}
              disabled={loadingPlan}
              className="px-8 py-4 bg-secondary text-white font-bold rounded-2xl shadow-lg hover:bg-secondary-dark transition-all flex items-center justify-center gap-3 mx-auto"
              aria-label="Gerar um novo plano de obra"
            >
              {loadingPlan ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-arrows-rotate"></i>}
              {loadingPlan ? 'Gerando...' : 'Gerar Novo Plano'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiWorkPlanner;
