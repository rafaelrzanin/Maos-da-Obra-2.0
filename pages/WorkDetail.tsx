
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
  // FIX: Correct useState initialization for newPhotoType
  const [newPhotoType, setNewPhotoType] = useState<'BEFORE' | 'AFTER' | 'PROGRESS'>('PROGRESS');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  // FIX: Correct useState initialization for newFileCategory
  const [newFileCategory, setNewFileCategory] = useState<FileCategory>(FileCategory.GENERAL);
  const [newUploadFile, setNewUploadFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [showAddChecklistModal, setShowAddChecklistModal] = useState(false); // NEW: Checklist modal state
  const [newChecklistName, setNewChecklistName] = useState('');
  // FIX: Correct useState initialization for newChecklistCategory
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
    // FIX: Correct useState initialization for newChecklistCategory
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
                    <h3 className="font-bold text-primary dark:text-white">{step.name}</h3>
                    <div className="flex items-center gap-2">
                      {step.status === StepStatus.COMPLETED && (
                        <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                          <i className="fa-solid fa-check-circle"></i> Concluída
                        </span>
                      )}
                      {step.isDelayed && step.status !== StepStatus.COMPLETED && (
                        <span className="text-red-600 text-xs font-bold flex items-center gap-1">
                          <i className="fa-solid fa-triangle-exclamation"></i> Atrasada
                        </span>
                      )}
                      {step.status === StepStatus.IN_PROGRESS && !step.isDelayed && (
                        <span className="text-orange-600 text-xs font-bold flex items-center gap-1">
                          <i className="fa-solid fa-hammer"></i> Em Andamento
                        </span>
                      )}
                      {step.status === StepStatus.NOT_STARTED && !step.isDelayed && (
                        <span className="text-slate-500 text-xs font-bold flex items-center gap-1">
                          <i className="fa-solid fa-clock"></i> Pendente
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                    Início: {step.startDate ? new Date(step.startDate).toLocaleDateString('pt-BR') : 'N/A'} - Fim Previsto: {step.endDate ? new Date(step.endDate).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                  {/* Progress Bar for Step Materials */}
                  <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-secondary" style={{ width: `${calculateStepProgress(step.id)}%` }}></div>
                  </div>
                  <p className="text-[10px] text-right text-slate-500 dark:text-slate-400">
                    Materiais: {calculateStepProgress(step.id).toFixed(0)}% comprados
                  </p>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => openEditStepModal(step)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      <i className="fa-solid fa-edit mr-1"></i> Editar
                    </button>
                    <button onClick={() => handleDeleteStep(step.id)} className="px-3 py-1 bg-red-500 text-white rounded-md text-xs font-bold hover:bg-red-600 transition-colors">
                      <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-center mt-6">
            <button onClick={handleExportSteps} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-primary dark:text-white rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
              <i className="fa-solid fa-file-excel"></i> Exportar Cronograma
            </button>
          </div>
        </div>
      )}

      {activeTab === 'MATERIAIS' && (
        <div className="animate-in fade-in">
          <div className="flex items-center justify-between mb-4 px-2 sm:px-0">
            <h2 className="text-xl font-bold text-primary dark:text-white">Materiais</h2>
            <button onClick={() => { setEditMaterialData(null); setShowAddMaterialModal(true); }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors flex items-center gap-2">
              <i className="fa-solid fa-plus"></i> Novo Material
            </button>
          </div>
          {materials.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">Nenhum material cadastrado.</div>
          ) : (
            <div className="space-y-4">
              {materials.map(material => (
                <div key={material.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-primary dark:text-white">{material.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {material.category || 'Geral'}
                      </span>
                      {material.stepId && (
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Etapa: {steps.find(s => s.id === material.stepId)?.name || 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                    Planejado: {material.plannedQty} {material.unit} | Comprado: {material.purchasedQty} {material.unit}
                  </p>
                  <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-secondary" style={{ width: `${Math.min(100, (material.purchasedQty / material.plannedQty) * 100)}%` }}></div>
                  </div>
                  <p className="text-[10px] text-right text-slate-500 dark:text-slate-400">
                    {(material.purchasedQty / material.plannedQty * 100).toFixed(0)}% comprados
                  </p>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => openPurchaseMaterialModal(material.id)} className="px-3 py-1 bg-green-500 text-white rounded-md text-xs font-bold hover:bg-green-600 transition-colors">
                      <i className="fa-solid fa-cash-register mr-1"></i> Comprar
                    </button>
                    <button onClick={() => openEditMaterialModal(material)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      <i className="fa-solid fa-edit mr-1"></i> Editar
                    </button>
                    <button onClick={() => handleDeleteMaterial(material.id)} className="px-3 py-1 bg-red-500 text-white rounded-md text-xs font-bold hover:bg-red-600 transition-colors">
                      <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-center mt-6">
            <button onClick={handleExportMaterials} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-primary dark:text-white rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
              <i className="fa-solid fa-file-excel"></i> Exportar Materiais
            </button>
          </div>
        </div>
      )}

      {activeTab === 'FINANCEIRO' && (
        <div className="animate-in fade-in">
          <div className="flex items-center justify-between mb-4 px-2 sm:px-0">
            <h2 className="text-xl font-bold text-primary dark:text-white">Financeiro</h2>
            <button onClick={() => { setEditExpenseData(null); setShowAddExpenseModal(true); }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors flex items-center gap-2">
              <i className="fa-solid fa-plus"></i> Nova Despesa
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-lg font-bold text-primary dark:text-white">Orçamento Planejado</p>
              <span className="text-lg font-bold text-secondary">{formatCurrency(work.budgetPlanned)}</span>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-lg font-bold text-primary dark:text-white">Gasto Total</p>
              <span className="text-lg font-bold text-red-500">{formatCurrency(calculateTotalExpenses)}</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-4 overflow-hidden">
              <div 
                className={`h-full rounded-full ${budgetUsage > 100 ? 'bg-red-500' : budgetUsage > 80 ? 'bg-orange-500' : 'bg-green-500'}`} 
                style={{ width: `${Math.min(100, budgetUsage)}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-right mt-2">{budgetUsage.toFixed(0)}% do orçamento ({formatCurrency(calculateTotalExpenses)} / {formatCurrency(work.budgetPlanned)})</p>
          </div>

          {expensesGroupedByStep.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">Nenhuma despesa cadastrada.</div>
          ) : (
            <div className="space-y-6">
              {expensesGroupedByStep.map(group => (
                <div key={group.stepName} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-bold text-primary dark:text-white text-md flex items-center gap-2">
                        <i className="fa-solid fa-calendar-alt text-secondary text-sm"></i> {group.stepName}
                    </h3>
                    <span className="font-bold text-lg text-red-500">{formatCurrency(group.totalStepAmount)}</span>
                  </div>
                  <div className="space-y-3">
                    {group.expenses.map(expense => (
                      <div key={expense.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div>
                          <p className="font-semibold text-primary dark:text-white text-sm">{expense.description}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{expense.category} - {new Date(expense.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-red-500 text-sm">{formatCurrency(expense.amount)}</span>
                          <button onClick={() => openEditExpenseModal(expense)} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-1" aria-label="Editar despesa"><i className="fa-solid fa-edit"></i></button>
                          <button onClick={() => handleDeleteExpense(expense.id)} className="text-red-400 hover:text-red-600 transition-colors p-1" aria-label="Excluir despesa"><i className="fa-solid fa-trash-alt"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-center mt-6">
            <button onClick={handleExportExpenses} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-primary dark:text-white rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
              <i className="fa-solid fa-file-excel"></i> Exportar Financeiro
            </button>
          </div>
        </div>
      )}

      {activeTab === 'FERRAMENTAS' && (
        <div className="animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => goToSubView('WORKERS')} className={`p-6 rounded-3xl border-2 transition-all ${activeSubView === 'WORKERS' ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'} flex flex-col items-center gap-4 group`}>
              <div className={`w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl transition-colors ${activeSubView === 'WORKERS' ? 'text-secondary' : 'text-slate-400 group-hover:text-secondary'}`}><i className="fa-solid fa-users"></i></div>
              <h3 className="font-bold text-primary dark:text-white text-lg">Equipe</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Gerencie seus profissionais e contatos.</p>
            </button>
            <button onClick={() => goToSubView('SUPPLIERS')} className={`p-6 rounded-3xl border-2 transition-all ${activeSubView === 'SUPPLIERS' ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'} flex flex-col items-center gap-4 group`}>
              <div className={`w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl transition-colors ${activeSubView === 'SUPPLIERS' ? 'text-secondary' : 'text-slate-400 group-hover:text-secondary'}`}><i className="fa-solid fa-truck"></i></div>
              <h3 className="font-bold text-primary dark:text-white text-lg">Fornecedores</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Organize seus fornecedores e materiais.</p>
            </button>
            <button onClick={() => goToSubView('PHOTOS')} className={`p-6 rounded-3xl border-2 transition-all ${activeSubView === 'PHOTOS' ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'} flex flex-col items-center gap-4 group`}>
              <div className={`w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl transition-colors ${activeSubView === 'PHOTOS' ? 'text-secondary' : 'text-slate-400 group-hover:text-secondary'}`}><i className="fa-solid fa-camera"></i></div>
              <h3 className="font-bold text-primary dark:text-white text-lg">Fotos</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Registre o progresso da sua obra.</p>
            </button>
            <button onClick={() => goToSubView('PROJECTS')} className={`p-6 rounded-3xl border-2 transition-all ${activeSubView === 'PROJECTS' ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'} flex flex-col items-center gap-4 group`}>
              <div className={`w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl transition-colors ${activeSubView === 'PROJECTS' ? 'text-secondary' : 'text-slate-400 group-hover:text-secondary'}`}><i className="fa-solid fa-file-alt"></i></div>
              <h3 className="font-bold text-primary dark:text-white text-lg">Arquivos</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Armazene projetos, notas e documentos.</p>
            </button>
            {/* NEW: Contracts & Checklists */}
            <button onClick={() => goToSubView('CONTRACTS')} className={`p-6 rounded-3xl border-2 transition-all ${activeSubView === 'CONTRACTS' ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'} flex flex-col items-center gap-4 group`}>
              <div className={`w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl transition-colors ${activeSubView === 'CONTRACTS' ? 'text-secondary' : 'text-slate-400 group-hover:text-secondary'}`}><i className="fa-solid fa-file-contract"></i></div>
              <h3 className="font-bold text-primary dark:text-white text-lg">Contratos</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Modelos de contrato para sua equipe e fornecedores.</p>
            </button>
            <button onClick={() => goToSubView('CHECKLIST')} className={`p-6 rounded-3xl border-2 transition-all ${activeSubView === 'CHECKLIST' ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'} flex flex-col items-center gap-4 group`}>
              <div className={`w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl transition-colors ${activeSubView === 'CHECKLIST' ? 'text-secondary' : 'text-slate-400 group-hover:text-secondary'}`}><i className="fa-solid fa-list-check"></i></div>
              <h3 className="font-bold text-primary dark:text-white text-lg">Checklists</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Listas de verificação para cada etapa da obra.</p>
            </button>
          </div>
          <div className="flex justify-center mt-6">
            <button onClick={() => goToSubView('AICHAT')} className={`px-6 py-3 rounded-2xl border-2 transition-all ${activeSubView === 'AICHAT' ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'} flex items-center gap-3 group`}>
                <div className={`w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl transition-colors ${activeSubView === 'AICHAT' ? 'text-secondary' : 'text-slate-400 group-hover:text-secondary'}`}><i className="fa-solid fa-robot"></i></div>
                <div>
                  <h3 className="font-bold text-primary dark:text-white text-lg">Zé da Obra AI</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Seu assistente de IA para dúvidas rápidas.</p>
                </div>
            </button>
          </div>
        </div>
      )}
      
      {/* ======================= SUB-VIEWS ======================= */}
      {activeSubView !== 'NONE' && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-4 px-2 sm:px-0">
            <h2 className="text-xl font-bold text-primary dark:text-white">{activeSubView === 'WORKERS' ? 'Profissionais da Obra' : activeSubView === 'SUPPLIERS' ? 'Fornecedores' : activeSubView === 'PHOTOS' ? 'Fotos da Obra' : activeSubView === 'PROJECTS' ? 'Arquivos da Obra' : activeSubView === 'CONTRACTS' ? 'Modelos de Contrato' : activeSubView === 'CHECKLIST' ? 'Checklists' : activeSubView === 'AICHAT' ? 'Chat com Zé da Obra AI' : ''}</h2>
            <div className="flex gap-2">
              {(activeSubView === 'WORKERS' || activeSubView === 'SUPPLIERS' || activeSubView === 'PHOTOS' || activeSubView === 'PROJECTS' || activeSubView === 'CHECKLIST') && (
                <button onClick={() => { 
                  if (activeSubView === 'WORKERS') setShowAddWorkerModal(true);
                  else if (activeSubView === 'SUPPLIERS') setShowAddSupplierModal(true);
                  else if (activeSubView === 'PHOTOS') setShowAddPhotoModal(true);
                  else if (activeSubView === 'PROJECTS') setShowAddFileModal(true);
                  else if (activeSubView === 'CHECKLIST') openAddChecklistModal(); // NEW
                }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors flex items-center gap-2">
                  <i className="fa-solid fa-plus"></i> Adicionar
                </button>
              )}
              <button onClick={() => setActiveSubView('NONE')} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-primary dark:text-white rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                <i className="fa-solid fa-times"></i> Fechar
              </button>
            </div>
          </div>

          {/* SUBVIEW CONTENT */}
          {activeSubView === 'WORKERS' && (
            <div className="space-y-4">
              {workers.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">Nenhum profissional cadastrado.</div>
              ) : (
                workers.map(worker => (
                  <div key={worker.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-primary dark:text-white">{worker.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{worker.role}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Telefone: {worker.phone}</p>
                    {worker.dailyRate && <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Diária: {formatCurrency(worker.dailyRate)}</p>}
                    {worker.notes && <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-2">{worker.notes}</p>}
                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => openEditWorkerModal(worker)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <i className="fa-solid fa-edit mr-1"></i> Editar
                      </button>
                      <button onClick={() => handleDeleteWorker(worker.id)} className="px-3 py-1 bg-red-500 text-white rounded-md text-xs font-bold hover:bg-red-600 transition-colors">
                        <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSubView === 'SUPPLIERS' && (
            <div className="space-y-4">
              {suppliers.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">Nenhum fornecedor cadastrado.</div>
              ) : (
                suppliers.map(supplier => (
                  <div key={supplier.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-primary dark:text-white">{supplier.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{supplier.category}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Telefone: {supplier.phone}</p>
                    {supplier.email && <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Email: {supplier.email}</p>}
                    {supplier.address && <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">Endereço: {supplier.address}</p>}
                    {supplier.notes && <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-2">{supplier.notes}</p>}
                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => openEditSupplierModal(supplier)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <i className="fa-solid fa-edit mr-1"></i> Editar
                      </button>
                      <button onClick={() => handleDeleteSupplier(supplier.id)} className="px-3 py-1 bg-red-500 text-white rounded-md text-xs font-bold hover:bg-red-600 transition-colors">
                        <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSubView === 'PHOTOS' && (
            <div className="space-y-4">
              {photos.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">Nenhuma foto cadastrada.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map(photo => (
                    <div key={photo.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 overflow-hidden group">
                      <img src={photo.url} alt={photo.description} className="w-full h-40 object-cover" />
                      <div className="p-3">
                        <p className="font-semibold text-primary dark:text-white text-sm">{photo.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(photo.date).toLocaleDateString('pt-BR')} - {photo.type}</p>
                        <div className="flex justify-end mt-3">
                          <button onClick={() => handleDeletePhoto(photo.id)} className="px-3 py-1 bg-red-500 text-white rounded-md text-xs font-bold hover:bg-red-600 transition-colors">
                            <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubView === 'PROJECTS' && (
            <div className="space-y-4">
              {files.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">Nenhum arquivo cadastrado.</div>
              ) : (
                files.map(file => (
                  <div key={file.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-primary dark:text-white text-sm">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{file.category} - {new Date(file.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-secondary text-white rounded-md text-xs font-bold hover:bg-secondary-dark transition-colors">
                        <i className="fa-solid fa-eye mr-1"></i> Ver
                      </a>
                      <button onClick={() => handleDeleteFile(file.id)} className="px-3 py-1 bg-red-500 text-white rounded-md text-xs font-bold hover:bg-red-600 transition-colors">
                        <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSubView === 'CONTRACTS' && ( // NEW: Contracts SubView
            <div className="space-y-4">
              {contracts.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">Nenhum modelo de contrato encontrado.</div>
              ) : (
                contracts.map(contract => (
                  <div key={contract.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-primary dark:text-white text-lg">{contract.title}</h3>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{contract.category}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-h-20 overflow-hidden text-ellipsis line-clamp-3">{contract.contentTemplate.substring(0, 150)}...</p>
                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => alert('Gerar PDF/Preencher: Funcionalidade em breve!')} className="px-3 py-1 bg-secondary text-white rounded-md text-xs font-bold hover:bg-secondary-dark transition-colors">
                        <i className="fa-solid fa-file-pdf mr-1"></i> Gerar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSubView === 'CHECKLIST' && ( // NEW: Checklists SubView
            <div className="space-y-4">
              {checklists.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">Nenhum checklist cadastrado.</div>
              ) : (
                checklists.map(checklist => (
                  <div key={checklist.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-primary dark:text-white text-lg">{checklist.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{checklist.category}</span>
                        <button onClick={() => openEditChecklistModal(checklist)} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-1" aria-label="Editar checklist"><i className="fa-solid fa-edit"></i></button>
                        <button onClick={() => handleDeleteChecklist(checklist.id)} className="text-red-400 hover:text-red-600 transition-colors p-1" aria-label="Excluir checklist"><i className="fa-solid fa-trash-alt"></i></button>
                      </div>
                    </div>
                    <ul className="space-y-2 mt-3">
                      {checklist.items.map((item, index) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => handleChecklistItemChange(index, e.target.checked)}
                            className="form-checkbox h-4 w-4 text-secondary rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:ring-secondary"
                          />
                          <span className={`${item.checked ? 'line-through text-slate-400' : ''}`}>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSubView === 'AICHAT' && ( // NEW: AI Chat SubView
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                Aqui você pode conversar com o Zé da Obra AI para tirar dúvidas rápidas sobre a sua obra.
              </p>
              <button onClick={() => navigate('/ai-chat')} className="mt-4 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-bold hover:bg-secondary-dark transition-colors flex items-center gap-2">
                <i className="fa-solid fa-robot mr-1"></i> Ir para o Chat AI
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {/* Add/Edit Step Modal */}
      {showAddStepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={closeStepModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{editStepData ? 'Editar Etapa' : 'Adicionar Nova Etapa'}</h3>
            <form onSubmit={editStepData ? handleEditStep : handleAddStep} className="space-y-4">
              <div>
                <label htmlFor="stepName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome da Etapa</label>
                <input id="stepName" type="text" value={newStepName} onChange={(e) => setNewStepName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="stepStartDate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Data de Início</label>
                  <input id="stepStartDate" type="date" value={newStepStartDate} onChange={(e) => setNewStepStartDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
                </div>
                <div>
                  <label htmlFor="stepEndDate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Data de Fim Prevista</label>
                  <input id="stepEndDate" type="date" value={newStepEndDate} onChange={(e) => setNewStepEndDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
                </div>
              </div>
              {editStepData && (
                <div>
                  <label htmlFor="stepStatus" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Status</label>
                  <select id="stepStatus" value={editStepData.status} onChange={(e) => setEditStepData({...editStepData, status: e.target.value as StepStatus})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                    {Object.values(StepStatus).map(status => (
                      <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              )}
              <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all">
                {editStepData ? 'Salvar Alterações' : 'Adicionar Etapa'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Material Modal */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={closeMaterialModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{editMaterialData ? 'Editar Material' : 'Adicionar Novo Material'}</h3>
            <form onSubmit={editMaterialData ? handleEditMaterial : handleAddMaterial} className="space-y-4">
              <div>
                <label htmlFor="materialName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome do Material</label>
                <input id="materialName" type="text" value={newMaterialName} onChange={(e) => setNewMaterialName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plannedQty" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Quantidade Planejada</label>
                  <input id="plannedQty" type="number" value={newMaterialPlannedQty} onChange={(e) => setNewMaterialPlannedQty(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
                </div>
                <div>
                  <label htmlFor="materialUnit" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Unidade</label>
                  <input id="materialUnit" type="text" value={newMaterialUnit} onChange={(e) => setNewMaterialUnit(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
                </div>
              </div>
              <div>
                <label htmlFor="materialCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                <input id="materialCategory" type="text" value={newMaterialCategory} onChange={(e) => setNewMaterialCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="materialStep" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Etapa</label>
                <select id="materialStep" value={newMaterialStepId} onChange={(e) => setNewMaterialStepId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                  <option value="">-- Selecione uma Etapa --</option>
                  {steps.map(step => (
                    <option key={step.id} value={step.id}>{step.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all">
                {editMaterialData ? 'Salvar Alterações' : 'Adicionar Material'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Register Material Purchase Modal */}
      {showPurchaseMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={closePurchaseMaterialModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Registrar Compra</h3>
            <form onSubmit={handleRegisterPurchase} className="space-y-4">
              <div>
                <label htmlFor="purchaseQty" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Quantidade Comprada</label>
                <input id="purchaseQty" type="number" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="purchaseCost" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Custo Total (R$)</label>
                <input id="purchaseCost" type="number" step="0.01" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all">
                Registrar Compra
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={closeExpenseModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{editExpenseData ? 'Editar Despesa' : 'Adicionar Nova Despesa'}</h3>
            <form onSubmit={editExpenseData ? handleEditExpense : handleAddExpense} className="space-y-4">
              <div>
                <label htmlFor="expenseDescription" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Descrição</label>
                <input id="expenseDescription" type="text" value={newExpenseDescription} onChange={(e) => setNewExpenseDescription(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="expenseAmount" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Valor (R$)</label>
                <input id="expenseAmount" type="number" step="0.01" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="expenseCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                <select id="expenseCategory" value={newExpenseCategory} onChange={(e) => setNewExpenseCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                  {Object.values(ExpenseCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="expenseDate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Data</label>
                <input id="expenseDate" type="date" value={newExpenseDate} onChange={(e) => setNewExpenseDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="expenseStep" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Etapa (Opcional)</label>
                <select id="expenseStep" value={newExpenseStepId} onChange={(e) => setNewExpenseStepId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                  <option value="">-- Sem Etapa --</option>
                  {steps.map(step => (
                    <option key={step.id} value={step.id}>{step.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all">
                {editExpenseData ? 'Salvar Alterações' : 'Adicionar Despesa'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Worker Modal */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={closeWorkerModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{editWorkerData ? 'Editar Profissional' : 'Adicionar Novo Profissional'}</h3>
            <form onSubmit={editWorkerData ? handleEditWorker : handleAddWorker} className="space-y-4">
              <div>
                <label htmlFor="workerName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome</label>
                <input id="workerName" type="text" value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="workerRole" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Função</label>
                <select id="workerRole" value={newWorkerRole} onChange={(e) => setNewWorkerRole(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                  <option value="">-- Selecione uma Função --</option>
                  {STANDARD_JOB_ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="workerPhone" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Telefone</label>
                <input id="workerPhone" type="text" value={newWorkerPhone} onChange={(e) => setNewWorkerPhone(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="workerDailyRate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Diária (R$)</label>
                <input id="workerDailyRate" type="number" step="0.01" value={newWorkerDailyRate} onChange={(e) => setNewWorkerDailyRate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="workerNotes" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Observações</label>
                <textarea id="workerNotes" value={newWorkerNotes} onChange={(e) => setNewWorkerNotes(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"></textarea>
              </div>
              <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all">
                {editWorkerData ? 'Salvar Alterações' : 'Adicionar Profissional'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={closeSupplierModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{editSupplierData ? 'Editar Fornecedor' : 'Adicionar Novo Fornecedor'}</h3>
            <form onSubmit={editSupplierData ? handleEditSupplier : handleAddSupplier} className="space-y-4">
              <div>
                <label htmlFor="supplierName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome do Fornecedor</label>
                <input id="supplierName" type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="supplierCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                <select id="supplierCategory" value={newSupplierCategory} onChange={(e) => setNewSupplierCategory(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                  <option value="">-- Selecione uma Categoria --</option>
                  {STANDARD_SUPPLIER_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="supplierPhone" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Telefone</label>
                <input id="supplierPhone" type="text" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="supplierEmail" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">E-mail (Opcional)</label>
                <input id="supplierEmail" type="email" value={newSupplierEmail} onChange={(e) => setNewSupplierEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="supplierAddress" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Endereço (Opcional)</label>
                <input id="supplierAddress" type="text" value={newSupplierAddress} onChange={(e) => setNewSupplierAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="supplierNotes" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Observações</label>
                <textarea id="supplierNotes" value={newSupplierNotes} onChange={(e) => setNewSupplierNotes(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"></textarea>
              </div>
              <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all">
                {editSupplierData ? 'Salvar Alterações' : 'Adicionar Fornecedor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Photo Modal */}
      {showAddPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={closePhotoModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Adicionar Nova Foto</h3>
            <form onSubmit={handleAddPhoto} className="space-y-4">
              <div>
                <label htmlFor="photoDescription" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Descrição</label>
                <input id="photoDescription" type="text" value={newPhotoDescription} onChange={(e) => setNewPhotoDescription(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="photoFile" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Arquivo da Foto</label>
                <input id="photoFile" type="file" accept="image/*" onChange={(e) => setNewPhotoFile(e.target.files ? e.target.files[0] : null)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark" />
              </div>
              <div>
                <label htmlFor="photoType" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Tipo</label>
                <select id="photoType" value={newPhotoType} onChange={(e) => setNewPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'PROGRESS')} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                  <option value="PROGRESS">Progresso</option>
                  <option value="BEFORE">Antes</option>
                  <option value="AFTER">Depois</option>
                </select>
              </div>
              <button type="submit" disabled={uploadingPhoto} className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                {uploadingPhoto ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                {uploadingPhoto ? 'Enviando...' : 'Adicionar Foto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add File Modal */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={closeFileModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Adicionar Novo Arquivo</h3>
            <form onSubmit={handleAddFile} className="space-y-4">
              <div>
                <label htmlFor="fileName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome do Arquivo</label>
                <input id="fileName" type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="fileCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                <select id="fileCategory" value={newFileCategory} onChange={(e) => setNewFileCategory(e.target.value as FileCategory)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                  {Object.values(FileCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="uploadFile" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Arquivo</label>
                <input id="uploadFile" type="file" onChange={(e) => setNewUploadFile(e.target.files ? e.target.files[0] : null)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark" />
              </div>
              <button type="submit" disabled={uploadingFile} className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                {uploadingFile ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                {uploadingFile ? 'Enviando...' : 'Adicionar Arquivo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Checklist Modal */}
      {showAddChecklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button onClick={() => setShowAddChecklistModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{editChecklistData ? 'Editar Checklist' : 'Adicionar Novo Checklist'}</h3>
            <form onSubmit={editChecklistData ? handleEditChecklist : handleAddChecklist} className="space-y-4">
              <div>
                <label htmlFor="checklistName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome do Checklist</label>
                <input id="checklistName" type="text" value={newChecklistName} onChange={(e) => setNewChecklistName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" />
              </div>
              <div>
                <label htmlFor="checklistCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria (Etapa)</label>
                <select id="checklistCategory" value={newChecklistCategory} onChange={(e) => setNewChecklistCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all">
                  <option value="">-- Selecione uma Categoria (Etapa) --</option>
                  {steps.map(step => (
                    <option key={step.id} value={step.name}>{step.name}</option>
                  ))}
                  <option value="Geral">Geral</option> {/* Option for general checklists */}
                  <option value="Segurança">Segurança</option> {/* Option for safety checklists */}
                  <option value="Entrega">Entrega</option> {/* Option for delivery checklists */}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Itens do Checklist</label>
                {newChecklistItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleNewChecklistItemTextChange(index, e.target.value)}
                      placeholder={`Item ${index + 1}`}
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white text-sm"
                    />
                    {newChecklistItems.length > 1 && (
                      <button type="button" onClick={() => removeChecklistItemField(index)} className="text-red-500 hover:text-red-600 p-1" aria-label="Remover item"><i className="fa-solid fa-trash-alt"></i></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addNewChecklistItemField} className="mt-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-primary dark:text-white rounded-md text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1">
                  <i className="fa-solid fa-plus"></i> Adicionar Item
                </button>
              </div>
              <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-light text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all">
                {editChecklistData ? 'Salvar Alterações' : 'Adicionar Checklist'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* General Purpose ZeModal (for delete confirmations, errors, etc.) */}
      <ZeModal
        isOpen={zeModal.isOpen}
        title={zeModal.title}
        message={zeModal.message}
        confirmText={zeModal.confirmText}
        cancelText={zeModal.cancelText}
        onConfirm={zeModal.onConfirm}
        onCancel={zeModal.onCancel}
        type={zeModal.type}
        isConfirming={zeModal.isConfirming}
      />
    </div>
  );
};

export default WorkDetail;