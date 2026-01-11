
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx'; // Keep XLSX import for Excel export functionality
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, type Work, type Step, type Material, type Expense, ExpenseStatus } from '../types.ts';
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

const formatDateDisplay = (dateStr: string | null) => {
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

const getExpenseStatusDetails = (
  expense: Expense
): { statusText: string; bgColor: string; textColor: string; icon: string } => {
  let statusText = '';
  let bgColor = 'bg-slate-400';
  let textColor = 'text-white';
  let icon = 'fa-hourglass-start';

  switch (expense.status) {
    case ExpenseStatus.COMPLETED:
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      icon = 'fa-check';
      break;
    case ExpenseStatus.PARTIAL:
      statusText = 'Parcial';
      bgColor = 'bg-amber-500';
      icon = 'fa-hourglass-half';
      break;
    case ExpenseStatus.PENDING:
      statusText = 'Pendente';
      bgColor = 'bg-slate-500';
      icon = 'fa-hourglass-start';
      break;
    case ExpenseStatus.OVERPAID:
      statusText = 'Prejuízo';
      bgColor = 'bg-red-500';
      icon = 'fa-sack-xmark';
      break;
    default:
      statusText = 'Desconhecido';
      bgColor = 'bg-slate-500';
      icon = 'fa-question';
      break;
  }
  return { statusText, bgColor, textColor, icon };
};

const getStepStatusDetails = (
  step: Step
): { statusText: string; bgColor: string; textColor: string; icon: string } => {
  let statusText = '';
  let bgColor = 'bg-slate-400';
  let textColor = 'text-white';
  let icon = 'fa-hourglass-start';

  switch (step.status) {
    case StepStatus.COMPLETED:
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      icon = 'fa-check';
      break;
    case StepStatus.IN_PROGRESS:
      statusText = 'Em Andamento';
      bgColor = 'bg-amber-500';
      icon = 'fa-hourglass-half';
      break;
    case StepStatus.DELAYED:
      statusText = 'Atrasado';
      bgColor = 'bg-red-500';
      icon = 'fa-exclamation-triangle';
      break;
    case StepStatus.PENDING:
    default:
      statusText = 'Pendente';
      bgColor = 'bg-slate-500';
      icon = 'fa-hourglass-start';
      break;
  }
  return { statusText, bgColor, textColor, icon };
};


/** =========================
 * ReportsView Component
 * ========================= */

// Export the component with a named export as per App.tsx's lazy import
export const ReportsView: React.FC = () => {
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
  const [showErrorModal, setShowErrorModal] = useState(false);

  const [activeReportTab, setActiveReportTab] = useState<'summary' | 'steps' | 'materials' | 'expenses'>('summary');

  const isVitalicio = user?.plan === PlanType.VITALICIO;
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const hasAiAccess = isVitalicio || isAiTrialActive;

  const loadReportData = useCallback(async () => {
    if (!workId || !user?.id) {
      setLoadingReports(false);
      return;
    }

    setLoadingReports(true);
    setErrorMsg('');

    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        navigate('/'); // Redirect if work not found or not owned
        return;
      }
      setWork(fetchedWork);

      if (!hasAiAccess) {
        setShowAccessModal(true);
        setLoadingReports(false);
        return;
      }

      const [fetchedSteps, fetchedMaterials, fetchedExpenses] = await Promise.all([
        dbService.getSteps(workId),
        dbService.getMaterials(workId),
        dbService.getExpenses(workId),
      ]);

      setSteps(fetchedSteps.sort((a, b) => a.orderIndex - b.orderIndex));
      setMaterials(fetchedMaterials);
      setExpenses(fetchedExpenses);

    } catch (error: any) {
      console.error("Erro ao carregar dados para relatórios:", error);
      setErrorMsg(`Não foi possível carregar os dados para os relatórios: ${error.message || 'Erro desconhecido.'}`);
      setShowErrorModal(true);
    } finally {
      setLoadingReports(false);
    }
  }, [workId, user, navigate, hasAiAccess]);

  useEffect(() => {
    if (!isUserAuthFinished || authLoading) return;
    loadReportData();
  }, [loadReportData, isUserAuthFinished, authLoading]);

  // Calculations for Summary
  const summaryData = useMemo(() => {
    const totalStepsCount = steps.length;
    const completedStepsCount = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const inProgressStepsCount = steps.filter(s => s.status === StepStatus.IN_PROGRESS).length;
    const delayedStepsCount = steps.filter(s => s.status === StepStatus.DELAYED).length;

    const totalPlannedMaterials = materials.reduce((sum, m) => sum + m.plannedQty, 0);
    const totalPurchasedMaterials = materials.reduce((sum, m) => sum + m.purchasedQty, 0);
    const pendingMaterialsCount = materials.filter(m => m.purchasedQty < m.plannedQty).length;
    const totalMaterialCost = materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaidExpenses = expenses.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    const totalOutstandingExpenses = expenses.reduce((sum, e) => sum + ((e.totalAgreed || e.amount) - (e.paidAmount || 0)), 0);

    const overallProgress = totalStepsCount > 0 ? (completedStepsCount / totalStepsCount) * 100 : 0;
    const budgetUsage = work && work.budgetPlanned > 0 ? (totalPaidExpenses / work.budgetPlanned) * 100 : 0;

    return {
      overallProgress,
      totalStepsCount,
      completedStepsCount,
      inProgressStepsCount,
      delayedStepsCount,
      pendingMaterialsCount,
      totalMaterialCost,
      totalExpensesAmount,
      totalPaidExpenses,
      totalOutstandingExpenses,
      budgetUsage,
      budgetPlanned: work?.budgetPlanned || 0,
    };
  }, [work, steps, materials, expenses]);

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

  // Handle loading and access checks
  if (loadingReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-primary dark:text-white animate-in fade-in">
        <i className="fa-solid fa-chart-pie fa-spin text-4xl mb-4 text-secondary"></i>
        <p className="text-xl font-bold">Gerando relatórios...</p>
      </div>
    );
  }

  if (showAccessModal) {
    return (
      <ZeModal
        isOpen={showAccessModal}
        title="Acesso Premium necessário!"
        message="Os Relatórios Detalhados são uma funcionalidade exclusiva para assinantes Vitalícios ou durante o período de teste. Melhore sua gestão de obras agora!"
        confirmText="Ver Planos"
        onConfirm={async (_e?: React.FormEvent) => navigate('/settings')}
        onCancel={async (_e?: React.FormEvent) => { setShowAccessModal(false); navigate(`/work/${workId}`); }}
        type="WARNING"
        cancelText="Voltar"
      >
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 shadow-inner border border-slate-100 dark:border-slate-700">
          <p>Seu período de teste pode ter expirado ou você precisa de um plano Vitalício para acessar esta ferramenta.</p>
        </div>
      </ZeModal>
    );
  }

  if (showErrorModal) {
    return (
      <ZeModal
        isOpen={showErrorModal}
        title="Erro ao Carregar Relatórios"
        message={errorMsg || "Não foi possível carregar os relatórios. Tente novamente mais tarde."}
        confirmText="Tentar Novamente"
        onConfirm={async (_e?: React.FormEvent) => { setShowErrorModal(false); await loadReportData(); }}
        onCancel={async (_e?: React.FormEvent) => { setShowErrorModal(false); navigate(`/work/${workId}`); }}
        type="ERROR"
        cancelText="Voltar para Obra"
      />
    );
  }

  if (!work) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in">
        <i className="fa-solid fa-exclamation-circle text-6xl text-red-500 mb-4"></i>
        <h2 className="text-2xl font-black text-primary dark:text-white mb-2">Obra não encontrada!</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
          Parece que esta obra não existe ou você não tem permissão para acessá-la.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors"
          aria-label="Voltar ao Dashboard"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  // Functions to handle exports
  const exportToExcel = (data: any[], fileName: string, sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const generatePdf = (title: string, content: string) => {
    // This is a placeholder for actual PDF generation logic.
    // In a real app, you might use a library like jsPDF or send to a serverless function.
    alert(`Gerando PDF para: ${title}\nConteúdo (simplificado):\n${content.substring(0, 200)}...`);
    console.log(`Simulating PDF generation for: ${title}`, content);
  };

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
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">Relatórios da Obra</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Obra: {work.name}</p>
        </div>
      </div>

      <div className="flex justify-around bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveReportTab('summary')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeReportTab === 'summary' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Resumo
        </button>
        <button
          onClick={() => setActiveReportTab('steps')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeReportTab === 'steps' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Cronograma
        </button>
        <button
          onClick={() => setActiveReportTab('materials')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeReportTab === 'materials' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Materiais
        </button>
        <button
          onClick={() => setActiveReportTab('expenses')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeReportTab === 'expenses' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Financeiro
        </button>
      </div>

      {activeReportTab === 'summary' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Resumo Geral da Obra</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Progresso Geral</p>
                <p className="text-2xl font-bold text-secondary">{summaryData.overallProgress.toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Etapas Concluídas</p>
                <p className="text-2xl font-bold text-green-500">{summaryData.completedStepsCount}/{summaryData.totalStepsCount}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Materiais Pendentes</p>
                <p className="text-2xl font-bold text-amber-500">{summaryData.pendingMaterialsCount}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Gasto Total</p>
                <p className={`text-2xl font-bold ${summaryData.totalPaidExpenses > summaryData.budgetPlanned ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(summaryData.totalPaidExpenses)}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => generatePdf('Resumo Geral da Obra', JSON.stringify(summaryData, null, 2))}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-primary dark:text-white text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                aria-label="Exportar resumo para PDF"
              >
                <i className="fa-solid fa-file-pdf"></i> PDF
              </button>
              <button
                onClick={() => exportToExcel([summaryData], `Resumo_Obra_${work.name}`, 'Resumo')}
                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-bold rounded-xl hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex items-center gap-2"
                aria-label="Exportar resumo para Excel"
              >
                <i className="fa-solid fa-file-excel"></i> Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeReportTab === 'steps' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Relatório de Cronograma</h2>
            {steps.length === 0 ? (
              <p className="text-center text-slate-400 py-10 italic">Nenhuma etapa cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {steps.map(step => {
                  const statusDetails = getStepStatusDetails(step);
                  return (
                    <div key={step.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-primary dark:text-white text-base">{step.orderIndex}. {step.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Início: {formatDateDisplay(step.startDate)} - Término Previsto: {formatDateDisplay(step.endDate)}</p>
                      </div>
                      <span className={cx(
                        "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                        statusDetails.bgColor,
                        statusDetails.textColor
                      )}>
                        <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => generatePdf('Relatório de Cronograma', JSON.stringify(steps, null, 2))}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-primary dark:text-white text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                aria-label="Exportar cronograma para PDF"
              >
                <i className="fa-solid fa-file-pdf"></i> PDF
              </button>
              <button
                onClick={() => exportToExcel(steps.map(s => ({ ...s, status: s.status, startDate: formatDateDisplay(s.startDate), endDate: formatDateDisplay(s.endDate) })), `Cronograma_Obra_${work.name}`, 'Cronograma')}
                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-bold rounded-xl hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex items-center gap-2"
                aria-label="Exportar cronograma para Excel"
              >
                <i className="fa-solid fa-file-excel"></i> Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeReportTab === 'materials' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Relatório de Materiais</h2>
            {materials.length === 0 ? (
              <p className="text-center text-slate-400 py-10 italic">Nenhum material cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {materials.map(material => (
                  <div key={material.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <h3 className="font-bold text-primary dark:text-white text-base">{material.name} ({material.brand || 's/marca'})</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Planejado: {material.plannedQty} {material.unit} | Comprado: {material.purchasedQty} {material.unit} | Custo: {formatCurrency(material.totalCost || 0)}
                    </p>
                    {material.stepId && (
                      <p className="text-xs text-slate-400">Etapa: {steps.find(s => s.id === material.stepId)?.name || 'N/A'}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => generatePdf('Relatório de Materiais', JSON.stringify(materials, null, 2))}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-primary dark:text-white text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                aria-label="Exportar materiais para PDF"
              >
                <i className="fa-solid fa-file-pdf"></i> PDF
              </button>
              <button
                onClick={() => exportToExcel(materials.map(m => ({ ...m, totalCost: formatCurrency(m.totalCost || 0) })), `Materiais_Obra_${work.name}`, 'Materiais')}
                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-bold rounded-xl hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex items-center gap-2"
                aria-label="Exportar materiais para Excel"
              >
                <i className="fa-solid fa-file-excel"></i> Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeReportTab === 'expenses' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className={cx(surface, card)}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Relatório Financeiro</h2>
            {expenses.length === 0 ? (
              <p className="text-center text-slate-400 py-10 italic">Nenhuma despesa cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {expenses.map(expense => {
                  const statusDetails = getExpenseStatusDetails(expense);
                  const agreedAmount = expense.totalAgreed !== undefined && expense.totalAgreed !== null ? expense.totalAgreed : expense.amount;
                  return (
                    <div key={expense.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-primary dark:text-white text-base">{expense.description}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Previsto: {formatCurrency(expense.amount)} | Combinado: {formatCurrency(agreedAmount)} | Pago: {formatCurrency(expense.paidAmount || 0)}
                        </p>
                        <p className="text-xs text-slate-400">Data: {formatDateDisplay(expense.date)} | Categoria: {expense.category}</p>
                      </div>
                      <span className={cx(
                        "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                        statusDetails.bgColor,
                        statusDetails.textColor
                      )}>
                        <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => generatePdf('Relatório Financeiro', JSON.stringify(expenses, null, 2))}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-primary dark:text-white text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                aria-label="Exportar financeiro para PDF"
              >
                <i className="fa-solid fa-file-pdf"></i> PDF
              </button>
              <button
                onClick={() => exportToExcel(expenses.map(e => ({
                    ...e,
                    amount: formatCurrency(e.amount),
                    paidAmount: formatCurrency(e.paidAmount || 0),
                    totalAgreed: formatCurrency(e.totalAgreed),
                    date: formatDateDisplay(e.date)
                })), `Financeiro_Obra_${work.name}`, 'Financeiro')}
                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-bold rounded-xl hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex items-center gap-2"
                aria-label="Exportar financeiro para Excel"
              >
                <i className="fa-solid fa-file-excel"></i> Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
