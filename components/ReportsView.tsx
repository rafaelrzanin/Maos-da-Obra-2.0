
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, type Work, type Step, type Material, type Expense } from '../types.ts';
import { ZeModal } from './ZeModal.tsx';

/** =========================
 * UI helpers
 * ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const surface =
  "bg-white border border-slate-200/90 shadow-card-default ring-1 ring-black/5 " +
  "dark:bg-slate-900/70 dark:border-slate-800 dark:shadow-card-dark-subtle dark:ring-0";

const card = "rounded-3xl p-6 lg:p-8";
const mutedText = "text-slate-500 dark:text-slate-400";

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '--/--';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  }
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

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

const ReportsView = () => {
  const { id: workId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, authLoading, isUserAuthFinished, trialDaysRemaining } = useAuth();

  const [work, setWork] = useState<Work | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAccessModal, setShowAccessModal] = useState(false);

  const isVitalicio = user?.plan === PlanType.VITALICIO;
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const hasAccess = isVitalicio || isAiTrialActive;

  // Memoized calculations for reports
  const totalExpenses = useMemo(() => expenses.reduce((sum, exp) => sum + exp.amount, 0), [expenses]);
  const totalPaidExpenses = useMemo(() => expenses.reduce((sum, exp) => sum + (exp.paidAmount || 0), 0), [expenses]);
  const totalOutstandingExpenses = useMemo(() => totalExpenses - totalPaidExpenses, [totalExpenses, totalPaidExpenses]);
  const budgetBalance = useMemo(() => work ? work.budgetPlanned - totalExpenses : 0, [work, totalExpenses]);

  const materialsOverview = useMemo(() => {
    const planned = materials.reduce((sum, m) => sum + m.plannedQty, 0);
    const purchased = materials.reduce((sum, m) => sum + m.purchasedQty, 0);
    const cost = materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);
    const pending = materials.filter(m => m.purchasedQty < m.plannedQty).length;
    return { planned, purchased, cost, pending };
  }, [materials]);

  const stepsOverview = useMemo(() => {
    const completed = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const inProgress = steps.filter(s => s.status === StepStatus.IN_PROGRESS).length;
    const notStarted = steps.filter(s => s.status === StepStatus.NOT_STARTED).length;
    const delayed = steps.filter(s => s.status !== StepStatus.COMPLETED && new Date(s.endDate) < new Date()).length;
    return { total: steps.length, completed, inProgress, notStarted, delayed };
  }, [steps]);

  const loadReportsData = useCallback(async () => {
    if (!workId || !user?.id) {
      setLoadingReports(false);
      navigate('/');
      return;
    }

    setLoadingReports(true);
    setErrorMsg('');

    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        navigate('/');
        return;
      }
      setWork(fetchedWork);

      if (!hasAccess) {
        setShowAccessModal(true);
        setLoadingReports(false);
        return;
      }

      const [fetchedSteps, fetchedMaterials, fetchedExpenses] = await Promise.all([
        dbService.getSteps(workId),
        dbService.getMaterials(workId),
        dbService.getExpenses(workId),
      ]);

      setSteps(fetchedSteps);
      setMaterials(fetchedMaterials);
      setExpenses(fetchedExpenses);

    } catch (error: any) {
      console.error("Erro ao carregar dados para relatórios:", error);
      setErrorMsg(`Erro ao carregar os dados para os relatórios: ${error.message || 'Erro desconhecido.'}`);
    } finally {
      setLoadingReports(false);
    }
  }, [workId, user, navigate, hasAccess]);

  useEffect(() => {
    if (!isUserAuthFinished || authLoading) return;
    loadReportsData();
  }, [isUserAuthFinished, authLoading, loadReportsData]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = (format: 'PDF' | 'Excel') => {
    console.log(`Exporting ${format} report for work ${work?.name}`);
    alert(`Funcionalidade de exportação para ${format} em desenvolvimento!`);
    // In a real app, this would trigger server-side generation or client-side library like jsPDF/SheetJS
  };

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
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans print:p-0 print:m-0 print:max-w-full">
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0 print:hidden">
        <button
          onClick={() => navigate(`/work/${workId}?tab=FERRAMENTAS`)} // Navigate back to tools tab
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label="Voltar para ferramentas da obra"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">Relatórios da Obra</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Obra: {work?.name || 'Carregando...'}</p>
        </div>
      </div>

      {showAccessModal && (
        <ZeModal
          isOpen={showAccessModal}
          title="Acesso Premium necessário!"
          message="Os Relatórios Completos são uma funcionalidade exclusiva para assinantes Vitalícios ou durante o período de teste. Tenha a visão total da sua obra agora!"
          confirmText="Ver Planos"
          onConfirm={async () => navigate('/settings')}
          onCancel={() => { setShowAccessModal(false); navigate(`/work/${workId}?tab=FERRAMENTAS`); }}
          type="WARNING"
          cancelText="Voltar"
        >
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 shadow-inner border border-slate-100 dark:border-slate-700">
            <p>Seu período de teste pode ter expirado ou você precisa de um plano Vitalício para acessar esta ferramenta.</p>
          </div>
        </ZeModal>
      )}

      {loadingReports && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center animate-in fade-in duration-500">
          <div className="relative mb-8">
            <div className="w-28 h-28 rounded-full border-4 border-slate-800 flex items-center justify-center relative z-10 bg-slate-900">
              <i className="fa-solid fa-chart-line text-4xl text-secondary"></i>
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-t-secondary border-r-secondary border-b-transparent border-l-transparent animate-spin"></div>
          </div>
          <h2 className="text-2xl font-black text-primary dark:text-white mb-2 animate-pulse">
            Preparando seus relatórios...
          </h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Isso pode levar alguns segundos dependendo da quantidade de dados.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-900 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in" role="alert">
          <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
        </div>
      )}

      {!loadingReports && !errorMsg && work && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-end gap-3 mb-6 print:hidden">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
              aria-label="Imprimir relatório"
            >
              <i className="fa-solid fa-print"></i> Imprimir
            </button>
            <button
              onClick={() => handleExport('PDF')}
              className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2"
              aria-label="Exportar para PDF"
            >
              <i className="fa-solid fa-file-pdf"></i> PDF
            </button>
            <button
              onClick={() => handleExport('Excel')}
              className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2"
              aria-label="Exportar para Excel"
            >
              <i className="fa-solid fa-file-excel"></i> Excel
            </button>
          </div>

          {/* Report: Cronograma */}
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Relatório de Cronograma</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-layer-group text-xl text-primary mb-1"></i>
                <p className="text-lg font-black text-primary leading-none">{stepsOverview.total}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Total de Etapas</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-list-check text-xl text-green-500 mb-1"></i>
                <p className="text-lg font-black text-green-600 leading-none">{stepsOverview.completed}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Concluídas</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-hourglass-half text-xl text-amber-500 mb-1"></i>
                <p className="text-lg font-black text-amber-600 leading-none">{stepsOverview.inProgress}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Em Andamento</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-triangle-exclamation text-xl text-red-500 mb-1"></i>
                <p className="text-lg font-black text-red-600 leading-none">{stepsOverview.delayed}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Atrasadas</p>
              </div>
            </div>

            <h3 className="text-lg font-bold text-primary dark:text-white mt-8 mb-3">Detalhes das Etapas</h3>
            <div className="space-y-3">
              {steps.length === 0 ? (
                <p className={mutedText}>Nenhuma etapa cadastrada.</p>
              ) : (
                steps.map(step => (
                  <div key={step.id} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-primary dark:text-white">{step.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}
                        {step.realDate && <span className="ml-2 text-green-600">(Concluído em: {formatDateDisplay(step.realDate)})</span>}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      step.status === StepStatus.COMPLETED ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      step.status === StepStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-400'
                    }`}>
                      {step.isDelayed ? 'ATRASADA' : step.status === StepStatus.COMPLETED ? 'CONCLUÍDA' : step.status === StepStatus.IN_PROGRESS ? 'EM ANDAMENTO' : 'NÃO INICIADA'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Report: Materiais */}
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Relatório de Materiais</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-boxes-stacked text-xl text-primary mb-1"></i>
                <p className="text-lg font-black text-primary leading-none">{materials.length}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Total de Materiais</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-cart-flatbed text-xl text-green-500 mb-1"></i>
                <p className="text-lg font-black text-green-600 leading-none">{materialsOverview.purchased}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Qtd. Comprada</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-hourglass-empty text-xl text-amber-500 mb-1"></i>
                <p className="text-lg font-black text-amber-600 leading-none">{materialsOverview.pending}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Itens Pendentes</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-money-bill-wave text-xl text-primary mb-1"></i>
                <p className="text-lg font-black text-primary leading-none">{formatCurrency(materialsOverview.cost)}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Custo Total</p>
              </div>
            </div>

            <h3 className="text-lg font-bold text-primary dark:text-white mt-8 mb-3">Detalhes dos Materiais</h3>
            <div className="space-y-3">
              {materials.length === 0 ? (
                <p className={mutedText}>Nenhum material cadastrado.</p>
              ) : (
                materials.map(material => (
                  <div key={material.id} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-primary dark:text-white">{material.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {material.brand && `${material.brand} - `}
                        Planejado: {material.plannedQty} {material.unit} / Comprado: {material.purchasedQty} {material.unit}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary dark:text-white">{formatCurrency(material.totalCost || 0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Report: Financeiro */}
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Relatório Financeiro</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Orçamento Planejado</p>
                <h3 className="text-xl font-bold text-primary dark:text-white">{formatCurrency(work.budgetPlanned)}</h3>
              </div>
              <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Gasto Total</p>
                <h3 className={`text-xl font-bold ${totalExpenses > work.budgetPlanned ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(totalExpenses)}</h3>
              </div>
              <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Balanço</p>
                <h3 className={`text-xl font-bold ${budgetBalance < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(budgetBalance)}</h3>
              </div>
            </div>

            <h3 className="text-lg font-bold text-primary dark:text-white mt-8 mb-3">Detalhes das Despesas</h3>
            <div className="space-y-3">
              {expenses.length === 0 ? (
                <p className={mutedText}>Nenhuma despesa cadastrada.</p>
              ) : (
                expenses.map(expense => (
                  <div key={expense.id} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-primary dark:text-white">{expense.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateDisplay(expense.date)} - {expense.category}
                        {expense.stepId && ` (Etapa: ${steps.find(s => s.id === expense.stepId)?.name || 'N/A'})`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary dark:text-white">{formatCurrency(expense.amount)}</p>
                      <p className={`text-xs ${ (expense.paidAmount || 0) >= expense.amount ? 'text-green-600' : 'text-amber-600'}`}>
                        Pago: {formatCurrency(expense.paidAmount || 0)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
    