
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType, ZeSuggestion } from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
// NEW: Import ZeModal
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx';
// NEW: Import aiService
import { aiService } from '../services/ai.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
type SubView = 'NONE' | 'WORKERS' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST' | 'AICHAT';
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO';

// Define a type for a single step group inside expenses
interface ExpenseStepGroup {
    stepName: string;
    expenses: Expense[];
    totalStepAmount: number;
}

/** =========================
 * UI helpers
 * ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

// Updated to use new shadow classes
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


/** =========================
 * COMPONENTE ZÉ DA OBRA ATIVO
 * ========================= */

interface ZeAssistantCardProps {
  suggestion: ZeSuggestion;
  onDismiss: (tag: string) => void;
  onAction: (callback?: () => void) => void;
  onGenerateAiMessage: (context: string, suggestionId: string) => void;
  loadingAi: boolean;
}

const ZeAssistantCard: React.FC<ZeAssistantCardProps> = ({ suggestion, onDismiss, onAction, onGenerateAiMessage, loadingAi }) => {
  // Removed showDetails state as it's not used now that detailed message is always visible
  
  useEffect(() => {
    // Automatically generate AI message if not already present
    // Only generate if hasAiAccess. This logic is handled by the caller, WorkDetail.tsx.
    if (!suggestion.aiMessage && !loadingAi) {
      onGenerateAiMessage(suggestion.aiContext, suggestion.id);
    }
  }, [suggestion.aiMessage, suggestion.aiContext, suggestion.id, onGenerateAiMessage, loadingAi]);

  const cardClasses = cx(
    surface,
    "rounded-3xl p-4 md:p-5 flex items-start gap-4 mb-6 transition-all duration-300 transform animate-in fade-in slide-in-from-top-4",
    suggestion.type === 'alert' && suggestion.priority === 'critical' && 'border-red-500 ring-1 ring-red-500/20 bg-red-50 dark:bg-red-900/20',
    suggestion.type === 'alert' && suggestion.priority === 'high' && 'border-amber-500 ring-1 ring-amber-500/20 bg-amber-50 dark:bg-amber-900/20',
  );

  const iconClasses = cx(
    "w-12 h-12 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0",
    suggestion.type === 'alert' && suggestion.priority === 'critical' && 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/40',
    suggestion.type === 'alert' && suggestion.priority === 'high' && 'bg-gradient-to-br from-amber-400 to-orange-600 shadow-amber-500/40',
  );
  
  // The icon content is not actually used as the avatar is always Zé's image.
  // const iconContent = suggestion.type === 'alert' ? 
  //   (suggestion.priority === 'critical' ? 'fa-triangle-exclamation text-red-700 dark:text-red-300' : 'fa-exclamation-triangle text-amber-700 dark:text-amber-300') : 
  //   'fa-lightbulb text-secondary';

  return (
    <div className={cardClasses} role={suggestion.type === 'alert' ? "alert" : "status"} aria-live="polite">
      <div className={iconClasses}>
        <img 
          src={ZE_AVATAR} 
          alt="Zé da Obra" 
          className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800"
          onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}
        />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1"> {/* NEW: Wrap title and dismiss button */}
          <div>
            <p className={cx("text-sm font-black uppercase tracking-widest mb-1", suggestion.type === 'alert' ? (suggestion.priority === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400') : 'text-secondary')}>
              {suggestion.type === 'alert' ? 'ALERTA DO ZÉ!' : 'DICA DO ZÉ!'}
            </p>
            <p className="text-primary dark:text-white font-bold text-base leading-tight">{suggestion.message}</p>
          </div>
          {suggestion.dismissible && (
            <button 
              onClick={() => onDismiss(suggestion.tag)} 
              className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-1 -mt-2 -mr-2"
              aria-label="Dispensar sugestão"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          )}
        </div>
        
        {/* Only show AI message if there's an actual AI message generated */}
        {suggestion.aiMessage && (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 shadow-inner border border-slate-100 dark:border-slate-600">
            {loadingAi ? (
              <span className="animate-pulse text-secondary">Zé está pensando...</span>
            ) : (
              // Display the AI message
              <p>{suggestion.aiMessage}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {suggestion.actionText && suggestion.actionCallback && (
            <button 
              onClick={() => onAction(suggestion.actionCallback)} 
              className={cx(
                "px-4 py-2 rounded-xl text-sm font-bold transition-colors",
                suggestion.type === 'alert' ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20' : 'bg-secondary hover:bg-orange-600 text-white shadow-secondary/20'
              )}
              aria-label={suggestion.actionText}
            >
              {suggestion.actionText}
            </button>
          )}
          {/* Removed the dismissible button from here, it's now at the top right */}
        </div>
      </div>
    </div>
  );
};


/** =========================
 * WorkDetail
 * ========================= */
const WorkDetail = () => {
  const { id: workId } = ReactRouter.useParams<{ id: string }>();
  const navigate = ReactRouter.useNavigate();
  // Fix: Destructure `isUserAuthFinished` from `useAuth`
  const { user, isSubscriptionValid, authLoading, isUserAuthFinished, refreshUser, pushSubscriptionStatus } = useAuth(); // NEW: pushSubscriptionStatus

  // AI TRIAL / SUBSCRIPTION CHECK - Moved to appear earlier
  const isAiTrialActive = user?.isTrial && user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date() && user?.plan !== PlanType.VITALICIO;
  const hasAiAccess = user?.plan === PlanType.VITALICIO || isAiTrialActive;
  
  const [work, setWork] = useState<Work | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [photos, setPhotos] = useState<WorkPhoto[]>([]);
  const [files, setFiles] = useState<WorkFile[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]); // NEW: Contracts
  const [checklists, setChecklists] = useState<Checklist[]>([]); // NEW: Checklists

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('ETAPAS');
  const [activeSubView, setActiveSubView] = useState<SubView>('NONE');

  // New item states
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepStartDate, setNewStepStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStepEndDate, setNewStepEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [editStepData, setEditStepData] = useState<Step | null>(null);

  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialPlannedQty, setNewMaterialPlannedQty] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState('');
  const [newMaterialStepId, setNewMaterialStepId] = useState('');
  const [editMaterialData, setEditMaterialData] = useState<Material | null>(null);
  const [showPurchaseMaterialModal, setShowPurchaseMaterialModal] = useState(false);
  const [purchaseMaterialId, setPurchaseMaterialId] = useState<string | null>(null);
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');

  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory | string>(ExpenseCategory.OTHER);
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpenseStepId, setNewExpenseStepId] = useState(''); // Added stepId to expense
  const [editExpenseData, setEditExpenseData] = useState<Expense | null>(null);

  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [newWorkerDailyRate, setNewWorkerDailyRate] = useState('');
  const [newWorkerNotes, setNewWorkerNotes] = useState('');
  const [editWorkerData, setEditWorkerData] = useState<Worker | null>(null);

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');
  const [editSupplierData, setEditSupplierData] = useState<Supplier | null>(null);

  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [newPhotoDescription, setNewPhotoDescription] = useState('');
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoType, setNewPhotoType] = useState<'BEFORE' | 'AFTER' | 'PROGRESS'>('PROGRESS');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState<FileCategory>(FileCategory.GENERAL);
  const [newUploadFile, setNewUploadFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [showAddChecklistModal, setShowAddChecklistModal] = useState(false); // NEW: Checklist modal state
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newChecklistCategory, setNewChecklistCategory] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<string[]>(['']);
  const [editChecklistData, setEditChecklistData] = useState<Checklist | null>(null);

  const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string, isConfirming?: boolean }>({
    isOpen: false, title: '', message: '', onCancel: () => { }, isConfirming: false
  });

  const [activeZeSuggestion, setActiveZeSuggestion] = useState<ZeSuggestion | null>(null); // NEW: State for active Zé suggestion
  const [loadingAiMessage, setLoadingAiMessage] = useState(false); // NEW: Loading state for AI message generation

  const seenSuggestionsRef = React.useRef<Set<string>>(new Set()); // Store seen suggestions for current session
  
  // =======================================================================
  // AUXILIARY FUNCTIONS
  // =======================================================================

  const goToTab = (tab: MainTab) => {
    setActiveTab(tab);
    setActiveSubView('NONE'); // Reset sub-view on main tab change
  };

  const goToSubView = (subView: SubView) => {
    setActiveSubView(subView);
  };

  const getDayDifference = (date1: string, date2: string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateStepProgress = (stepId: string): number => {
    const totalMaterialsForStep = materials.filter(m => m.stepId === stepId);
    if (totalMaterialsForStep.length === 0) return 0;

    const purchasedMaterialsCount = totalMaterialsForStep.filter(m => m.purchasedQty >= m.plannedQty).length;
    return (purchasedMaterialsCount / totalMaterialsForStep.length) * 100;
  };

  const calculateTotalExpenses = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const budgetUsage = useMemo(() =>
    work && work.budgetPlanned > 0 ? (calculateTotalExpenses / work.budgetPlanned) * 100 : 0
  , [work, calculateTotalExpenses]);

  // =======================================================================
  // AI ASSISTANT LOGIC (NEW)
  // =======================================================================

  const getSeenSuggestions = useCallback((): Set<string> => {
    if (!workId || !user?.id) return new Set();
    const stored = sessionStorage.getItem(`ze_suggestions_seen_${user.id}_${workId}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  }, [workId, user]);

  const markSuggestionAsSeen = useCallback((tag: string) => {
    if (!workId || !user?.id) return;
    const currentSeen = getSeenSuggestions();
    currentSeen.add(tag);
    sessionStorage.setItem(`ze_suggestions_seen_${user.id}_${workId}`, JSON.stringify(Array.from(currentSeen)));
    seenSuggestionsRef.current = currentSeen; // Update ref immediately
    setActiveZeSuggestion(null); // Dismiss current suggestion
  }, [workId, user, getSeenSuggestions]);

  const generateZeSuggestion = useCallback(async () => {
    if (!work || !steps.length || !materials.length || !user?.id) return;
    
    console.log("[Zé da Obra] Avaliando contexto para sugestões...");
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0];
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    const seenTags = getSeenSuggestions();
    let currentSuggestions: ZeSuggestion[] = [];

    // Prioridade CRÍTICA (ZeModal)
    for (const step of steps) {
        // ALERTA: Material essencial ausente para etapa ativa/próxima
        if (step.status === StepStatus.IN_PROGRESS || (step.status === StepStatus.NOT_STARTED && new Date(step.startDate) <= threeDaysFromNow)) {
            const materialsForStep = materials.filter(m => m.stepId === step.id);
            for (const material of materialsForStep) {
                if (material.plannedQty > 0 && material.purchasedQty === 0) {
                    const tag = `critical-missing-material-${work.id}-${material.id}-${step.id}-${todayString}`;
                    if (!seenTags.has(tag)) {
                        currentSuggestions.push({
                            id: `ze-sug-${Date.now()}`,
                            type: 'alert',
                            priority: 'critical',
                            message: `ALERTA: Material essencial para a etapa "${step.name}" não foi comprado! A obra pode parar por falta de "${material.name}".`,
                            actionText: "Ver Materiais",
                            actionCallback: () => { goToTab('MATERIAIS'); markSuggestionAsSeen(tag); },
                            dismissible: true, // Allow dismissing even critical on UI, but action is implied
                            tag: tag,
                            aiContext: `Material ${material.name} essencial para a etapa ${step.name} da obra ${work.name} está em falta. O que fazer para evitar atrasos e qual o risco?`
                        });
                        break; // Only one critical material alert per step at a time
                    }
                }
            }
        }

        // ALERTA: Etapa Atrasada e Parada
        if ((step.status === StepStatus.NOT_STARTED || step.status === StepStatus.IN_PROGRESS) && new Date(step.endDate) < today) {
            const tag = `critical-stalled-step-${work.id}-${step.id}-${todayString}`;
            if (!seenTags.has(tag)) {
                currentSuggestions.push({
                    id: `ze-sug-${Date.now()}`,
                    type: 'alert',
                    priority: 'critical',
                    message: `ALERTA: A etapa "${step.name}" da obra "${work.name}" está atrasada e ainda não foi concluída. Por favor, atualize o status ou o prazo.`,
                    actionText: "Editar Etapa",
                    actionCallback: () => { setEditStepData(step); setShowAddStepModal(true); markSuggestionAsSeen(tag); },
                    dismissible: true, // Allow dismissing even critical on UI, but action is implied
                    tag: tag,
                    aiContext: `A etapa ${step.name} da obra ${work.name} está atrasada. Qual o impacto no cronograma e como posso resolver ou atualizar o status?`
                });
            }
        }
    }

    // Se houver alerta crítico, exibe apenas ele via modal
    const criticalAlert = currentSuggestions.find(s => s.priority === 'critical');
    if (criticalAlert) {
      setActiveZeSuggestion(criticalAlert);
      return;
    }
    
    // Sugestões Proativas (ZeAssistantCard)
    currentSuggestions = []; // Limpa para priorizar sugestões não críticas se não houver críticos

    // DICA: Material Próximo de Acabar (menos de 50% comprado do planejado)
    for (const step of steps) {
      if (step.status === StepStatus.IN_PROGRESS) {
        const materialsForStep = materials.filter(m => m.stepId === step.id);
        for (const material of materialsForStep) {
          if (material.plannedQty > 0 && material.purchasedQty > 0 && material.purchasedQty < material.plannedQty * 0.5) {
            const tag = `low-material-${work.id}-${material.id}-${step.id}-${todayString}`;
            if (!seenTags.has(tag)) {
              currentSuggestions.push({
                id: `ze-sug-${Date.now()}`,
                type: 'suggestion',
                priority: 'high',
                message: `DICA: O estoque de "${material.name}" para a etapa "${step.name}" está baixo. Avalie a compra para não atrasar a obra!`,
                actionText: "Ver Materiais",
                actionCallback: () => goToTab('MATERIAIS'),
                dismissible: true,
                tag: tag,
                aiContext: `O material ${material.name} para a etapa ${step.name} da obra ${work.name} está acabando. Qual a melhor forma de reabastecer e se há alternativas?`
              });
              break; // Only one low material suggestion per step at a time
            }
          }
        }
      }
    }

    // DICA: Próxima Etapa a Iniciar (nos próximos 3 dias)
    const upcomingStep = steps.find(s => s.status === StepStatus.NOT_STARTED && new Date(s.startDate) >= today && new Date(s.startDate) <= threeDaysFromNow);
    if (upcomingStep) {
        const tag = `upcoming-step-${work.id}-${upcomingStep.id}-${todayString}`;
        if (!seenTags.has(tag)) {
            currentSuggestions.push({
                id: `ze-sug-${Date.now()}`,
                type: 'suggestion',
                priority: 'medium',
                message: `PREPARE-SE: A etapa "${upcomingStep.name}" começa em breve! Verifique se tudo está pronto.`,
                actionText: "Ver Cronograma",
                actionCallback: () => goToTab('ETAPAS'),
                dismissible: true,
                tag: tag,
                aiContext: `A etapa ${upcomingStep.name} da obra ${work.name} está prestes a começar. Quais são os pontos críticos de atenção antes de iniciar?`
            });
        }
    }

    // DICA: Etapa Quase Finalizada (termina nos próximos 3 dias)
    const finishingStep = steps.find(s => s.status === StepStatus.IN_PROGRESS && new Date(s.endDate) >= today && new Date(s.endDate) <= threeDaysFromNow);
    if (finishingStep) {
        const tag = `finishing-step-${work.id}-${finishingStep.id}-${todayString}`;
        if (!seenTags.has(tag)) {
            currentSuggestions.push({
                id: `ze-sug-${Date.now()}`,
                type: 'suggestion',
                priority: 'medium',
                message: `FIM DA ETAPA: A etapa "${finishingStep.name}" está quase lá! Considere a verificação final e o fechamento.`,
                actionText: "Editar Etapa",
                actionCallback: () => { setEditStepData(finishingStep); setShowAddStepModal(true); },
                dismissible: true,
                tag: tag,
                aiContext: `A etapa ${finishingStep.name} da obra ${work.name} está quase concluída. Como posso fazer a checagem final de qualidade?`
            });
        }
    }

    // Exibe a sugestão de maior prioridade que ainda não foi vista
    if (currentSuggestions.length > 0) {
        currentSuggestions.sort((a, b) => {
            const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        const highestPrioritySuggestion = currentSuggestions[0];
        setActiveZeSuggestion(highestPrioritySuggestion);
    } else {
        setActiveZeSuggestion(null); // No relevant suggestions
    }

  }, [work, steps, materials, user, getSeenSuggestions, markSuggestionAsSeen, hasAiAccess]);

  const generateAiMessageForSuggestion = useCallback(async (context: string, suggestionId: string) => {
    // Only attempt to generate AI message if user has AI access
    if (!hasAiAccess) {
        setActiveZeSuggestion(prev => {
            if (prev?.id === suggestionId) {
                return { ...prev, aiMessage: "Assinatura Vitalícia necessária para insights da IA. Acesse Configurações." };
            }
            return prev;
        });
        return;
    }

    setLoadingAiMessage(true);
    try {
      // NEW: Use aiService.getWorkInsight for short, incisive messages
      const aiResponse = await aiService.getWorkInsight(context);
      setActiveZeSuggestion(prev => {
        if (prev?.id === suggestionId) {
          return { ...prev, aiMessage: aiResponse };
        }
        return prev;
      });
    } catch (error) {
      console.error("Erro ao gerar mensagem da IA para sugestão:", error);
      setActiveZeSuggestion(prev => {
        if (prev?.id === suggestionId) {
          return { ...prev, aiMessage: "Ops! Zé está com problemas de comunicação com a central. Tente novamente mais tarde." };
        }
        return prev;
      });
    } finally {
      setLoadingAiMessage(false);
    }
  }, [hasAiAccess]);


  // Handler para quando o usuário marca uma etapa como COMPLETED
  // Isso pode gerar uma sugestão de "Boas-vindas à próxima etapa"
  const handleStepCompletion = useCallback(async (completedStep: Step) => {
    console.log(`[Zé da Obra] Etapa ${completedStep.name} marcada como concluída.`);
    
    // Tenta encontrar a próxima etapa lógica na sequência original
    const sortedSteps = [...steps].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const completedStepIndex = sortedSteps.findIndex(s => s.id === completedStep.id);
    
    if (completedStepIndex !== -1 && completedStepIndex < sortedSteps.length - 1) {
        const nextLogicalStep = sortedSteps[completedStepIndex + 1];
        if (nextLogicalStep && nextLogicalStep.status === StepStatus.NOT_STARTED) {
            const tag = `new-step-focus-${work?.id}-${nextLogicalStep.id}`;
            const seenTags = getSeenSuggestions();

            if (!seenTags.has(tag)) {
                let aiResponse = "Ótimo! Foco total na próxima. O Zé tá de olho!"; // Default if no AI access
                if (hasAiAccess) {
                    // Generate AI message for this specific context
                    aiResponse = await aiService.getWorkInsight(`A etapa ${nextLogicalStep.name} da obra ${work?.name} acaba de se tornar a próxima a ser focada. Dê uma dica útil para começar bem esta etapa.`);
                }

                setActiveZeSuggestion({
                    id: `ze-sug-${Date.now()}`,
                    type: 'suggestion',
                    priority: 'low',
                    message: `BOA! Etapa "${completedStep.name}" concluída. Agora foco na "${nextLogicalStep.name}"!`,
                    aiMessage: aiResponse,
                    dismissible: true,
                    tag: tag,
                    aiContext: `A etapa ${nextLogicalStep.name} acaba de iniciar. Dê uma dica útil para começar bem.` // Re-use general context
                });
                markSuggestionAsSeen(tag);
                // Removed setTimeout for auto-dismiss, user explicitly dismisses now
            }
        }
    }
  }, [steps, work, getSeenSuggestions, markSuggestionAsSeen, hasAiAccess]);


  // =======================================================================
  // DATA LOADING
  // =======================================================================

  const loadWorkData = useCallback(async () => {
    // Fix: Use `isUserAuthFinished` instead of directly `user?.id` for initial load protection
    if (!isUserAuthFinished || authLoading || !workId || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        navigate('/'); // Redirect if work not found or not owned by user
        return;
      }
      setWork(fetchedWork);

      const [fetchedSteps, fetchedMaterials, fetchedExpenses, fetchedWorkers, fetchedSuppliers, fetchedPhotos, fetchedFiles, fetchedContracts, fetchedChecklists] = await Promise.all([
        dbService.getSteps(workId),
        dbService.getMaterials(workId),
        dbService.getExpenses(workId),
        dbService.getWorkers(workId),
        dbService.getSuppliers(workId),
        dbService.getPhotos(workId),
        dbService.getFiles(workId),
        dbService.getContractTemplates(), // Mocked for now
        dbService.getChecklists(workId), // Mocked for now
      ]);

      setSteps(fetchedSteps);
      setMaterials(fetchedMaterials);
      setExpenses(fetchedExpenses);
      setWorkers(fetchedWorkers);
      setSuppliers(fetchedSuppliers);
      setPhotos(fetchedPhotos);
      setFiles(fetchedFiles);
      setContracts(fetchedContracts);
      setChecklists(fetchedChecklists);

      // Trigger Zé da Obra suggestion generation after data loads
      generateZeSuggestion();

    } catch (error) {
      console.error("Erro ao carregar dados da obra:", error);
      // Optionally show an error message to the user
      navigate('/'); // Fallback to dashboard on error
    } finally {
      setLoading(false);
    }
  }, [workId, user, navigate, generateZeSuggestion, isUserAuthFinished, authLoading]); // Add `isUserAuthFinished` to dependencies

  useEffect(() => {
    // Only load data once auth is finished and user is known
    // Fix: Use `isUserAuthFinished` as the primary guard for initial data load
    if (isUserAuthFinished && !authLoading) {
        loadWorkData();
    }
  }, [isUserAuthFinished, authLoading, loadWorkData]);

  // Trigger Zé suggestion regeneration when relevant data changes
  useEffect(() => {
    if (!loading && work && steps.length > 0 && materials.length > 0) {
      generateZeSuggestion();
    }
  }, [loading, work, steps, materials, expenses, generateZeSuggestion]); // Added expenses to re-evaluate AI suggestions on financial changes

  // =======================================================================
  // UI ACTIONS
  // =======================================================================

  // STEPS
  const handleAddStep = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;
    try {
      const newStep = await dbService.addStep({
        workId, name: newStepName, startDate: newStepStartDate, endDate: newStepEndDate, status: StepStatus.NOT_STARTED, isDelayed: false
      });
      if (newStep) {
        await loadWorkData();
        setShowAddStepModal(false);
        setNewStepName(''); setNewStepStartDate(new Date().toISOString().split('T')[0]); setNewStepEndDate(new Date().toISOString().split('T')[0]);
      }
    } catch (error) { console.error("Erro ao adicionar etapa:", error); }
  };

  const handleEditStep = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editStepData || !workId || !user?.id) return;
    try {
      const updatedStep = await dbService.updateStep(editStepData);
      if (updatedStep) {
        await loadWorkData();
        setShowAddStepModal(false);
        setEditStepData(null);
        // NEW: Check if the step was marked as completed to trigger Zé's next step suggestion
        if (updatedStep.status === StepStatus.COMPLETED) {
            handleStepCompletion(updatedStep);
        }
      }
    } catch (error) { console.error("Erro ao atualizar etapa:", error); }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Etapa?',
      message: 'Tem certeza que deseja excluir esta etapa e todos os materiais associados? Despesas financeiras devem ser excluídas separadamente.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          await dbService.deleteStep(stepId, workId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(prev => ({ ...prev, type: 'ERROR', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal({ ...prev, isOpen: false }) })); // Wrap with async function
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditStepModal = (step: Step) => {
    setEditStepData(step);
    setNewStepName(step.name);
    setNewStepStartDate(step.startDate);
    setNewStepEndDate(step.endDate);
    setShowAddStepModal(true);
  };

  const closeStepModal = () => {
    setShowAddStepModal(false);
    setEditStepData(null);
    setNewStepName(''); setNewStepStartDate(new Date().toISOString().split('T')[0]); setNewStepEndDate(new Date().toISOString().split('T')[0]);
  };

  // MATERIALS
  const handleAddMaterial = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;
    try {
      const newMaterial = await dbService.addMaterial({
        workId, name: newMaterialName, plannedQty: Number(newMaterialPlannedQty), purchasedQty: 0, unit: newMaterialUnit, category: newMaterialCategory, stepId: newMaterialStepId
      });
      if (newMaterial) {
        await loadWorkData();
        setShowAddMaterialModal(false);
        setNewMaterialName(''); setNewMaterialPlannedQty(''); setNewMaterialUnit(''); setNewMaterialCategory(''); setNewMaterialStepId('');
      }
    } catch (error) { console.error("Erro ao adicionar material:", error); }
  };

  const handleEditMaterial = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editMaterialData || !workId || !user?.id) return;
    try {
      const updatedMaterial = await dbService.updateMaterial(editMaterialData);
      if (updatedMaterial) {
        await loadWorkData();
        setShowAddMaterialModal(false);
        setEditMaterialData(null);
      }
    } catch (error) { console.error("Erro ao atualizar material:", error); }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Material?',
      message: 'Tem certeza que deseja excluir este material? Todos os lançamentos financeiros relacionados serão mantidos.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          // Fix: Call deleteMaterial from dbService
          await dbService.deleteMaterial(materialId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(prev => ({ ...prev, type: 'ERROR', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal({ ...prev, isOpen: false }) })); // Wrap with async function
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditMaterialModal = (material: Material) => {
    setEditMaterialData(material);
    setNewMaterialName(material.name);
    setNewMaterialPlannedQty(String(material.plannedQty));
    setNewMaterialUnit(material.unit);
    setNewMaterialCategory(material.category || '');
    setNewMaterialStepId(material.stepId || '');
    setShowAddMaterialModal(true);
  };

  const openPurchaseMaterialModal = (materialId: string) => {
    setPurchaseMaterialId(materialId);
    setShowPurchaseMaterialModal(true);
  };

  const closeMaterialModal = () => {
    setShowAddMaterialModal(false);
    setEditMaterialData(null);
    setNewMaterialName(''); setNewMaterialPlannedQty(''); setNewMaterialUnit(''); setNewMaterialCategory(''); setNewMaterialStepId('');
  };

  const closePurchaseMaterialModal = () => {
    setShowPurchaseMaterialModal(false);
    setPurchaseMaterialId(null);
    setPurchaseQty(''); setPurchaseCost('');
  };

  const handleRegisterPurchase = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!purchaseMaterialId || !user?.id) return;

    const materialToUpdate = materials.find(m => m.id === purchaseMaterialId);
    if (!materialToUpdate) return;

    try {
      await dbService.registerMaterialPurchase(
        purchaseMaterialId,
        materialToUpdate.name,
        materialToUpdate.brand,
        materialToUpdate.plannedQty,
        materialToUpdate.unit,
        Number(purchaseQty),
        Number(purchaseCost)
      );
      await loadWorkData();
      closePurchaseMaterialModal();
    } catch (error) {
      console.error("Erro ao registrar compra:", error);
      // Handle error display
    }
  };


  // EXPENSES
  const handleAddExpense = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;
    try {
      const newExpense = await dbService.addExpense({
        workId, description: newExpenseDescription, amount: Number(newExpenseAmount), date: newExpenseDate, category: newExpenseCategory, stepId: newExpenseStepId
      });
      if (newExpense) {
        await loadWorkData();
        setShowAddExpenseModal(false);
        setNewExpenseDescription(''); setNewExpenseAmount(''); setNewExpenseCategory(ExpenseCategory.OTHER); setNewExpenseDate(new Date().toISOString().split('T')[0]); setNewExpenseStepId('');
      }
    } catch (error) { console.error("Erro ao adicionar despesa:", error); }
  };

  const handleEditExpense = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editExpenseData || !workId || !user?.id) return;
    try {
      const updatedExpense = await dbService.updateExpense(editExpenseData);
      if (updatedExpense) {
        await loadWorkData();
        setShowAddExpenseModal(false);
        setEditExpenseData(null);
      }
    } catch (error) { console.error("Erro ao atualizar despesa:", error); }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Despesa?',
      message: 'Tem certeza que deseja excluir este lançamento financeiro? Esta ação é irreversível.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          await dbService.deleteExpense(expenseId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(prev => ({ ...prev, type: 'ERROR', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal({ ...prev, isOpen: false }) })); // Wrap with async function
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditExpenseModal = (expense: Expense) => {
    setEditExpenseData(expense);
    setNewExpenseDescription(expense.description);
    setNewExpenseAmount(String(expense.amount));
    setNewExpenseCategory(expense.category);
    setNewExpenseDate(expense.date);
    setNewExpenseStepId(expense.stepId || '');
    setShowAddExpenseModal(true);
  };

  const closeExpenseModal = () => {
    setShowAddExpenseModal(false);
    setEditExpenseData(null);
    setNewExpenseDescription(''); setNewExpenseAmount(''); setNewExpenseCategory(ExpenseCategory.OTHER); setNewExpenseDate(new Date().toISOString().split('T')[0]); setNewExpenseStepId('');
  };

  // WORKERS
  const handleAddWorker = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;
    try {
      const newWorker = await dbService.addWorker({
        userId: user.id, workId, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone, dailyRate: Number(newWorkerDailyRate), notes: newWorkerNotes
      });
      if (newWorker) {
        await loadWorkData();
        setShowAddWorkerModal(false);
        setNewWorkerName(''); setNewWorkerRole(''); setNewWorkerPhone(''); setNewWorkerDailyRate(''); setNewWorkerNotes('');
      }
    } catch (error) { console.error("Erro ao adicionar profissional:", error); }
  };

  const handleEditWorker = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editWorkerData || !workId || !user?.id) return;
    try {
      const updatedWorker = await dbService.updateWorker(editWorkerData);
      if (updatedWorker) {
        await loadWorkData();
        setShowAddWorkerModal(false);
        setEditWorkerData(null);
      }
    } catch (error) { console.error("Erro ao atualizar profissional:", error); }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Profissional?',
      message: 'Tem certeza que deseja excluir este profissional? Todos os lançamentos financeiros relacionados serão mantidos.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          await dbService.deleteWorker(workerId, workId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(prev => ({ ...prev, type: 'ERROR', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal({ ...prev, isOpen: false }) })); // Wrap with async function
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditWorkerModal = (worker: Worker) => {
    setEditWorkerData(worker);
    setNewWorkerName(worker.name);
    setNewWorkerRole(worker.role);
    setNewWorkerPhone(worker.phone);
    setNewWorkerDailyRate(String(worker.dailyRate || ''));
    setNewWorkerNotes(worker.notes || '');
    setShowAddWorkerModal(true);
  };

  const closeWorkerModal = () => {
    setShowAddWorkerModal(false);
    setEditWorkerData(null);
    setNewWorkerName(''); setNewWorkerRole(''); setNewWorkerPhone(''); setNewWorkerDailyRate(''); setNewWorkerNotes('');
  };

  // SUPPLIERS
  const handleAddSupplier = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;
    try {
      const newSupplier = await dbService.addSupplier({
        userId: user.id, workId, name: newSupplierName, category: newSupplierCategory, phone: newSupplierPhone, email: newSupplierEmail, address: newSupplierAddress, notes: newSupplierNotes
      });
      if (newSupplier) {
        await loadWorkData();
        setShowAddSupplierModal(false);
        setNewSupplierName(''); setNewSupplierCategory(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setNewSupplierAddress(''); setNewSupplierNotes('');
      }
    } catch (error) { console.error("Erro ao adicionar fornecedor:", error); }
  };

  const handleEditSupplier = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editSupplierData || !workId || !user?.id) return;
    try {
      const updatedSupplier = await dbService.updateSupplier(editSupplierData);
      if (updatedSupplier) {
        await loadWorkData();
        setShowAddSupplierModal(false);
        setEditSupplierData(null);
      }
    } catch (error) { console.error("Erro ao atualizar fornecedor:", error); }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Fornecedor?',
      message: 'Tem certeza que deseja excluir este fornecedor? Todos os lançamentos financeiros relacionados serão mantidos.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          await dbService.deleteSupplier(supplierId, workId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(prev => ({ ...prev, type: 'ERROR', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal({ ...prev, isOpen: false }) })); // Wrap with async function
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditSupplierModal = (supplier: Supplier) => {
    setEditSupplierData(supplier);
    setNewSupplierName(supplier.name);
    setNewSupplierCategory(supplier.category);
    setNewSupplierPhone(supplier.phone);
    setNewSupplierEmail(supplier.email || '');
    setNewSupplierAddress(supplier.address || '');
    setNewSupplierNotes(supplier.notes || '');
    setShowAddSupplierModal(true);
  };

  const closeSupplierModal = () => {
    setShowAddSupplierModal(false);
    setEditSupplierData(null);
    setNewSupplierName(''); setNewSupplierCategory(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setNewSupplierAddress(''); setNewSupplierNotes('');
  };


  // PHOTOS
  const handleAddPhoto = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id || !newPhotoFile) return;
    setUploadingPhoto(true);
    try {
      // In a real app, you'd upload newPhotoFile to storage (e.g., Supabase Storage)
      // and get the URL. For now, simulate.
      await new Promise(r => setTimeout(r, 1500)); // Simulate upload time
      const imageUrl = `https://picsum.photos/800/600?random=${Date.now()}`; // Mock URL

      const newPhoto = await dbService.addPhoto({
        workId, url: imageUrl, description: newPhotoDescription, date: new Date().toISOString().split('T')[0], type: newPhotoType
      });
      if (newPhoto) {
        await loadWorkData();
        setShowAddPhotoModal(false);
        setNewPhotoDescription(''); setNewPhotoFile(null); setNewPhotoType('PROGRESS');
      }
    } catch (error) { console.error("Erro ao adicionar foto:", error); } finally { setUploadingPhoto(false); }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Foto?',
      message: 'Tem certeza que deseja excluir esta foto? Esta ação é irreversível.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          // Fix: Call deletePhoto from dbService
          await dbService.deletePhoto(photoId); 
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(prev => ({ ...prev, type: 'ERROR', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal({ ...prev, isOpen: false }) })); // Wrap with async function
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const closePhotoModal = () => {
    setShowAddPhotoModal(false);
    setNewPhotoDescription(''); setNewPhotoFile(null); setNewPhotoType('PROGRESS');
  };

  // FILES
  const handleAddFile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id || !newUploadFile) return;
    setUploadingFile(true);
    try {
      // In a real app, you'd upload newUploadFile to storage (e.g., Supabase Storage)
      // and get the URL. For now, simulate.
      await new Promise(r => setTimeout(r, 1500)); // Simulate upload time
      const fileUrl = `https://docs.google.com/document/d/${Date.now()}/edit`; // Mock URL
      const fileType = newUploadFile.type || 'application/octet-stream';

      const newFile = await dbService.addFile({
        workId, name: newFileName, category: newFileCategory, url: fileUrl, type: fileType, date: new Date().toISOString().split('T')[0]
      });
      if (newFile) {
        await loadWorkData();
        setShowAddFileModal(false);
        setNewFileName(''); setNewFileCategory(FileCategory.GENERAL); setNewUploadFile(null);
      }
    } catch (error) { console.error("Erro ao adicionar arquivo:", error); } finally { setUploadingFile(false); }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Arquivo?',
      message: 'Tem certeza que deseja excluir este arquivo? Esta ação é irreversível.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          // Fix: Call deleteFile from dbService
          await dbService.deleteFile(fileId); 
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(prev => ({ ...prev, type: 'ERROR', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal({ ...prev, isOpen: false }) })); // Wrap with async function
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const closeFileModal = () => {
    setShowAddFileModal(false);
    setNewFileName(''); setNewFileCategory(FileCategory.GENERAL); setNewUploadFile(null);
  };


  // CHECKLISTS (NEW)
  const handleAddChecklist = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId) return;
    try {
      const newChecklist = await dbService.addChecklist({
        workId,
        name: newChecklistName,
        category: newChecklistCategory,
        items: newChecklistItems.filter(item => item.trim() !== '').map(text => ({ id: Date.now().toString() + Math.random().toString(36).substring(2, 9), text, checked: false }))
      });
      if (newChecklist) {
        await loadWorkData();
        setShowAddChecklistModal(false);
        setNewChecklistName(''); setNewChecklistCategory(''); setNewChecklistItems(['']);
      }
    } catch (error) { console.error("Erro ao adicionar checklist:", error); }
  };

  const handleEditChecklist = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editChecklistData) return;
    try {
      const updatedChecklist = await dbService.updateChecklist({
        ...editChecklistData,
        name: newChecklistName,
        category: newChecklistCategory,
        items: newChecklistItems.filter(item => item.trim() !== '').map((text, idx) => ({ id: editChecklistData.items[idx]?.id || Date.now().toString() + Math.random().toString(36).substring(2, 9), text, checked: editChecklistData.items[idx]?.checked || false }))
      });
      if (updatedChecklist) {
        await loadWorkData();
        setShowAddChecklistModal(false);
        setEditChecklistData(null);
      }
    } catch (error) { console.error("Erro ao atualizar checklist:", error); }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!workId) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Checklist?',
      message: 'Tem certeza que deseja excluir este checklist? Esta ação é irreversível.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          await dbService.deleteChecklist(checklistId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(prev => ({ ...prev, type: 'ERROR', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal({ ...prev, isOpen: false }) })); // Wrap with async function
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openAddChecklistModal = () => {
    setEditChecklistData(null);
    setNewChecklistName('');
    setNewChecklistCategory(activeTab === 'ETAPAS' && steps.length > 0 ? steps.find(s => s.status !== StepStatus.COMPLETED)?.name || '' : '');
    setNewChecklistItems(['']);
    setShowAddChecklistModal(true);
  };

  const openEditChecklistModal = (checklist: Checklist) => {
    setEditChecklistData(checklist);
    setNewChecklistName(checklist.name);
    setNewChecklistCategory(checklist.category);
    setNewChecklistItems(checklist.items.map(item => item.text));
    setShowAddChecklistModal(true);
  };

  const handleChecklistItemChange = (index: number, checked: boolean) => {
    if (editChecklistData) {
      const updatedItems = [...editChecklistData.items];
      updatedItems[index].checked = checked;
      setEditChecklistData({ ...editChecklistData, items: updatedItems });
      // NEW: Update checklist in DB immediately for persistence
      dbService.updateChecklist({ ...editChecklistData, items: updatedItems })
        .then(() => console.log('Checklist item updated in DB'))
        .catch(err => console.error('Error updating checklist item:', err));
    }
  };

  const handleNewChecklistItemTextChange = (index: number, value: string) => {
    const updatedItems = [...newChecklistItems];
    updatedItems[index] = value;
    setNewChecklistItems(updatedItems);
  };

  const addNewChecklistItemField = () => {
    setNewChecklistItems([...newChecklistItems, '']);
  };

  const removeChecklistItemField = (index: number) => {
    setNewChecklistItems(newChecklistItems.filter((_, i) => i !== index));
  };


  // EXCEL / PDF EXPORTS
  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const handleExportSteps = () => {
    const dataToExport = steps.map(s => ({
      ID: s.id,
      Etapa: s.name,
      'Data Início': s.startDate,
      'Data Fim Prevista': s.endDate,
      'Data Real Fim': s.realDate || '',
      Status: s.status,
      Atrasada: s.isDelayed ? 'Sim' : 'Não'
    }));
    exportToExcel(dataToExport, `Cronograma_${work?.name.replace(/\s/g, '_')}`);
  };

  const handleExportMaterials = () => {
    const dataToExport = materials.map(m => ({
      ID: m.id,
      Material: m.name,
      Marca: m.brand || '',
      'Qtd. Planejada': m.plannedQty,
      'Qtd. Comprada': m.purchasedQty,
      Unidade: m.unit,
      Categoria: m.category || '',
      Etapa: steps.find(s => s.id === m.stepId)?.name || 'N/A'
    }));
    exportToExcel(dataToExport, `Materiais_${work?.name.replace(/\s/g, '_')}`);
  };

  const handleExportExpenses = () => {
    const dataToExport = expenses.map(e => ({
      ID: e.id,
      Descrição: e.description,
      Valor: e.amount,
      'Valor Pago': e.paidAmount || e.amount,
      Quantidade: e.quantity || 1,
      Data: e.date,
      Categoria: e.category,
      Etapa: steps.find(s => s.id === e.stepId)?.name || 'N/A',
      Material: materials.find(m => m.id === e.relatedMaterialId)?.name || 'N/A',
      Profissional: workers.find(w => w.id === e.workerId)?.name || 'N/A',
      Fornecedor: suppliers.find(s => s.id === e.supplierId)?.name || 'N/A',
    }));
    exportToExcel(dataToExport, `Financeiro_${work?.name.replace(/\s/g, '_')}`);
  };


  // REPORT CALCULATIONS (Financeiro tab)
  const expensesGroupedByStep = useMemo(() => {
    const grouped: { [key: string]: Expense[] } = {};
    expenses.forEach(expense => {
      const stepName = expense.stepId ? steps.find(s => s.id === expense.stepId)?.name || 'Sem Etapa' : 'Sem Etapa';
      if (!grouped[stepName]) {
        grouped[stepName] = [];
      }
      grouped[stepName].push(expense);
    });

    const result: ExpenseStepGroup[] = Object.keys(grouped).map(stepName => ({
      stepName,
      expenses: grouped[stepName],
      totalStepAmount: grouped[stepName].reduce((sum, e) => sum + e.amount, 0),
    })).sort((a, b) => {
      const aIndex = steps.findIndex(s => s.name === a.stepName);
      const bIndex = steps.findIndex(s => s.name === b.stepName);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return result;
  }, [expenses, steps]);


  if (loading || authLoading || !work) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    );
  }

  // Render the WorkDetail
  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-4 md:px-0 font-sans">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2" aria-label="Voltar para o Dashboard">
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-2xl font-black text-primary dark:text-white">{work.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{work.address}</p>
        </div>
      </div>

      {/* NEW: Zé da Obra Assistant Card */}
      {activeZeSuggestion && (
        <ZeAssistantCard 
          suggestion={activeZeSuggestion} 
          onDismiss={markSuggestionAsSeen} 
          onAction={(callback) => { callback && callback(); markSuggestionAsSeen(activeZeSuggestion.tag); }}
          onGenerateAiMessage={generateAiMessageForSuggestion}
          loadingAi={loadingAiMessage}
        />
      )}

      {/* TABS NAVEGAÇÃO PRINCIPAL */}
      <nav className="flex justify-around items-center bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-8 mx-2 sm:mx-0">
        <button onClick={() => goToTab('ETAPAS')} className={`py-2 px-4 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'ETAPAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-current={activeTab === 'ETAPAS' ? 'page' : undefined}>
          <i className="fa-solid fa-list-check"></i> Etapas
        </button>
        <button onClick={() => goToTab('MATERIAIS')} className={`py-2 px-4 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'MATERIAIS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-current={activeTab === 'MATERIAIS' ? 'page' : undefined}>
          <i className="fa-solid fa-boxes-stacked"></i> Materiais
        </button>
        <button onClick={() => goToTab('FINANCEIRO')} className={`py-2 px-4 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'FINANCEIRO' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-current={activeTab === 'FINANCEIRO' ? 'page' : undefined}>
          <i className="fa-solid fa-dollar-sign"></i> Financeiro
        </button>
        <button onClick={() => goToTab('FERRAMENTAS')} className={`py-2 px-4 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'FERRAMENTAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-current={activeTab === 'FERRAMENTAS' ? 'page' : undefined}>
          <i className="fa-solid fa-toolbox"></i> Ferramentas
        </button>
      </nav>

      {/* CONTEÚDO DAS TABS */}
      {activeTab === 'ETAPAS' && (
        <div className="animate-in fade-in">
          <div className="flex items-center justify-between mb-4 px-2 sm:px-0">
            <h2 className="text-xl font-bold text-primary dark:text-white">Cronograma</h2>
            <button onClick={() => { setEditStepData(null); setShowAddStepModal(true); }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors flex items-center gap-2">
              <i className="fa-solid fa-plus"></i> Nova Etapa
            </button>
          </div>
          {steps.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">Nenhuma etapa cadastrada.</div>
          ) : (
            <div className="space-y-4">
              {steps.map(step => (
                <div key={step.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-