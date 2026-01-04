
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType, ZeSuggestion, AIWorkPlan } from '../types.ts'; // NEW: Import AIWorkPlan
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
// NEW: Import ZeModal
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx';
// NEW: Import aiService
import { aiService } from '../services/ai.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
// RESTORED unrequested sub-views to SubView type, REMOVED 'REPORTS'
type SubView = 'NONE' | 'WORKERS' | 'SUPPLIERS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST' | 'AICHAT' | 'AIPLANNER'; // NEW: Added AIPLANNER
// REMOVED ReportSubTab type

// Define a type for a single step group inside expenses
interface ExpenseStepGroup {
    stepName: string;
    expenses: Expense[];
    totalStepAmount: number;
}

// Define a type for material groups (for Material tab and Reports)
interface MaterialStepGroup {
  stepName: string;
  stepId: string;
  materials: Material[];
}


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
  
  // Conditionally generate AI message only if there's no existing aiMessage
  useEffect(() => {
    if (suggestion.aiContext && !suggestion.aiMessage && !loadingAi) {
      onGenerateAiMessage(suggestion.aiContext, suggestion.id);
    }
  }, [suggestion.aiContext, suggestion.aiMessage, suggestion.id, onGenerateAiMessage, loadingAi]);

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
        <div className="flex justify-between items-start mb-1">
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
        
        {suggestion.aiMessage && (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 shadow-inner border border-slate-100 dark:border-slate-600">
            {loadingAi ? (
              <span className="animate-pulse text-secondary">Zé está pensando...</span>
            ) : (
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
  const { user, isSubscriptionValid, authLoading, isUserAuthFinished, refreshUser, pushSubscriptionStatus, trialDaysRemaining } = useAuth(); // NEW: trialDaysRemaining
  
  // NEW: Calculate AI access
  const isVitalicio = user?.plan === PlanType.VITALICIO;
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const hasAiAccess = isVitalicio || isAiTrialActive;
  
  const [work, setWork] = useState<Work | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [photos, setPhotos] = useState<WorkPhoto[]>([]);
  const [files, setFiles] = useState<WorkFile[]>([]); 
  const [contracts, setContracts] = useState<Contract[]>([]); 
  const [checklists, setChecklists] = useState<Checklist[]>([]); 

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('ETAPAS');
  const [activeSubView, setActiveSubView] = useState<SubView>('NONE'); 
  
  // REMOVED reportSubTab state

  // States for Material Filter
  const [materialFilterStepId, setMaterialFilterStepId] = useState('all');

  // New item states
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepStartDate, setNewStepStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStepEndDate, setNewStepEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [editStepData, setEditStepData] = useState<Step | null>(null);
  // State for drag and drop
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);


  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialPlannedQty, setNewMaterialPlannedQty] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState('');
  const [newMaterialStepId, setNewMaterialStepId] = useState('');
  const [editMaterialData, setEditMaterialData] = useState<Material | null>(null);
  // REMOVED: showPurchaseMaterialModal, purchaseMaterialId, purchaseQty, purchaseCost
  // NEW: States for material purchase within the edit modal
  const [currentPurchaseQty, setCurrentPurchaseQty] = useState('');
  const [currentPurchaseCost, setCurrentPurchaseCost] = useState('');


  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory | string>(ExpenseCategory.OTHER);
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpenseStepId, setNewExpenseStepId] = useState(''); 
  // NEW: States for worker and supplier linking in expense modal
  const [newExpenseWorkerId, setNewExpenseWorkerId] = useState('');
  const [newExpenseSupplierId, setNewExpenseSupplierId] = useState('');
  const [editExpenseData, setEditExpenseData] = useState<Expense | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false); 
  const [paymentExpenseData, setPaymentExpenseData] = useState<Expense | null>(null); 
  const [paymentAmount, setPaymentAmount] = useState(''); 
  const [paymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]); 

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
  const [uploadingPhoto, setLoadingPhoto] = useState(false); // Renamed to avoid conflict

  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState<FileCategory>(FileCategory.GENERAL);
  const [newUploadFile, setNewUploadFile] = useState<File | null>(null);
  const [uploadingFile, setLoadingFile] = useState(false); // Renamed to avoid conflict

  const [showAddChecklistModal, setShowAddChecklistModal] = useState(false); 
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newChecklistCategory, setNewChecklistCategory] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<string[]>(['']);
  const [editChecklistData, setEditChecklistData] = useState<Checklist | null>(null);

  const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string, isConfirming?: boolean }>({
    isOpen: false, title: '', message: '', onCancel: () => { }, isConfirming: false
  });

  const [activeZeSuggestion, setActiveZeSuggestion] = useState<ZeSuggestion | null>(null); 
  const [loadingAiMessage, setLoadingAiMessage] = useState(false); 

  const seenSuggestionsRef = React.useRef<Set<string>>(new Set()); 
  
  // =======================================================================
  // AUXILIARY FUNCTIONS
  // =======================================================================

  const goToTab = (tab: MainTab) => {
    setActiveTab(tab);
    setActiveSubView('NONE'); 
    setMaterialFilterStepId('all'); 
  };

  const goToSubView = (subView: SubView) => {
    setActiveSubView(subView);
    // REMOVED logic for setting reportSubTab
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

  // NEW: Grouped and filtered materials for UI
  const groupedMaterials = useMemo<MaterialStepGroup[]>(() => {
    // Filter materials by selected step if not 'all'
    const filteredMaterials = materialFilterStepId === 'all'
      ? materials
      : materials.filter(m => m.stepId === materialFilterStepId);

    const groups: { [key: string]: Material[] } = {};
    const stepOrder: string[] = [];

    // Group materials by step, preserving step order
    steps.forEach(step => {
      const materialsForStep = filteredMaterials.filter(m => m.stepId === step.id);
      if (materialsForStep.length > 0) {
        groups[step.id] = materialsForStep.sort((a, b) => a.name.localeCompare(b.name));
        stepOrder.push(step.id);
      }
    });

    return stepOrder.map(stepId => ({
      stepName: steps.find(s => s.id === stepId)?.name || 'Sem Etapa',
      stepId: stepId,
      materials: groups[stepId] || [],
    }));
  }, [materials, steps, materialFilterStepId]);

  // NEW: Grouped expenses for UI (by step)
  const groupedExpensesByStep = useMemo<ExpenseStepGroup[]>(() => {
    const groups: { [key: string]: Expense[] } = {};
    // Group all expenses first
    expenses.forEach(expense => {
      const stepKey = expense.stepId || 'no_step'; // Group by stepId or 'no_step'
      if (!groups[stepKey]) {
        groups[stepKey] = [];
      }
      groups[stepKey].push(expense);
    });

    // Create sorted array of groups
    const expenseGroups: ExpenseStepGroup[] = [];
    // const stepNamesMap = new Map(steps.map(s => [s.id, s.name])); 

    // Add expenses linked to steps, in step order
    steps.forEach(step => {
      if (groups[step.id]) {
        expenseGroups.push({
          stepName: step.name,
          expenses: groups[step.id].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          totalStepAmount: groups[step.id].reduce((sum, exp) => sum + exp.amount, 0)
        });
        delete groups[step.id]; // Remove from groups to avoid re-adding
      }
    });

    // Add expenses not linked to any step
    if (groups['no_step']) {
      expenseGroups.push({
        stepName: 'Outros Lançamentos',
        expenses: groups['no_step'].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        totalStepAmount: groups['no_step'].reduce((sum, exp) => sum + exp.amount, 0)
      });
    }

    return expenseGroups;
  }, [expenses, steps]);


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
    seenSuggestionsRef.current = currentSeen; 
    setActiveZeSuggestion(null); // Dismiss active suggestion immediately
  }, [workId, user, getSeenSuggestions]);

  const generateZeSuggestion = useCallback(async () => {
    if (!work || !steps.length || !materials.length || !user?.id) {
        setActiveZeSuggestion(null);
        return;
    }
    
    console.log("[Zé da Obra] Avaliando contexto para sugestões...");
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to local midnight
    const todayString = today.toISOString().split('T')[0];
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    const seenTags = getSeenSuggestions();
    let currentSuggestions: ZeSuggestion[] = [];

    // Prioridade CRÍTICA (ZeModal)
    for (const step of steps) {
        // ALERTA: Material essencial ausente para etapa ativa/próxima
        // Rule: 3 dias antes do início da etapa: Se material não estiver completo → status FALTANDO
        const stepStartDateObj = new Date(step.startDate);
        stepStartDateObj.setHours(0, 0, 0, 0);

        const isStepImminentOrActive = (step.status === StepStatus.IN_PROGRESS || (step.status === StepStatus.NOT_STARTED && stepStartDateObj <= threeDaysFromNow));

        if (isStepImminentOrActive) {
            const materialsForStep = materials.filter(m => m.stepId === step.id);
            for (const material of materialsForStep) {
                if (material.plannedQty > 0 && material.purchasedQty < material.plannedQty) { // Material not fully purchased
                    const tag = `critical-missing-material-${work.id}-${material.id}-${step.id}-${todayString}`;
                    if (!seenTags.has(tag)) {
                        currentSuggestions.push({
                            id: `ze-sug-${Date.now()}`,
                            type: 'alert',
                            priority: 'critical',
                            message: `ALERTA: Material essencial para a etapa "${step.name}" não foi comprado! A obra pode parar por falta de "${material.name}". (${material.purchasedQty}/${material.plannedQty} ${material.unit})`,
                            actionText: "Ver Materiais",
                            actionCallback: () => { goToTab('MATERIAIS'); markSuggestionAsSeen(tag); },
                            dismissible: true, // Allow dismissing even critical on UI, but action is implied
                            tag: tag,
                            aiContext: `O material ${material.name} (quantidade planejada: ${material.plannedQty} ${material.unit}, comprado: ${material.purchasedQty} ${material.unit}) é essencial para a etapa ${step.name} da obra ${work.name}. A etapa começa em ${step.startDate}. O que devo fazer para evitar atrasos e qual o risco atual?`
                        });
                        break; // Only one critical material alert per step at a time to avoid spam
                    }
                }
            }
        }

        // ALERTA: Etapa Atrasada e Parada
        const stepEndDateObj = new Date(step.endDate);
        stepEndDateObj.setHours(0, 0, 0, 0);
        if ((step.status === StepStatus.NOT_STARTED || step.status === StepStatus.IN_PROGRESS) && stepEndDateObj < today) {
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
                    aiContext: `A etapa ${step.name} da obra ${work.name} (início: ${step.startDate}, fim: ${step.endDate}) está atrasada. Qual o impacto no cronograma geral e como posso resolver ou atualizar o status?`
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
                message: `DICA: O estoque de "${material.name}" para a etapa "${step.name}" está baixo. Avalie a compra para não atrasar a obra! (${material.purchasedQty}/${material.plannedQty} ${material.unit})`,
                actionText: "Ver Materiais",
                actionCallback: () => { goToTab('MATERIAIS'); markSuggestionAsSeen(tag); },
                dismissible: true,
                tag: tag,
                aiContext: `O material ${material.name} (quantidade planejada: ${material.plannedQty} ${material.unit}, comprado: ${material.purchasedQty} ${material.unit}) para a etapa ${step.name} da obra ${work.name} está acabando. Qual a melhor forma de reabastecer e se há alternativas mais econômicas ou rápidas?`
              });
              // Não quebra, para que mais de uma sugestão de baixo estoque possa aparecer por vez
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
                actionCallback: () => { goToTab('ETAPAS'); markSuggestionAsSeen(tag); },
                dismissible: true,
                tag: tag,
                aiContext: `A etapa ${upcomingStep.name} da obra ${work.name} (início: ${upcomingStep.startDate}) está prestes a começar. Quais são os pontos críticos de atenção, documentos ou materiais para verificar antes de iniciar?`
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
                actionCallback: () => { setEditStepData(finishingStep); setShowAddStepModal(true); markSuggestionAsSeen(tag); },
                dismissible: true,
                tag: tag,
                aiContext: `A etapa ${finishingStep.name} da obra ${work.name} (fim: ${finishingStep.endDate}) está quase concluída. Como posso fazer a checagem final de qualidade e quais os próximos passos de fechamento ou transição?`
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
    const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex); // Sort by orderIndex
    const completedStepIndex = sortedSteps.findIndex(s => s.id === completedStep.id);
    
    if (completedStepIndex !== -1 && completedStepIndex < sortedSteps.length - 1) {
        const nextLogicalStep = sortedSteps[completedStepIndex + 1];
        if (nextLogicalStep && nextLogicalStep.status === StepStatus.NOT_STARTED) {
            const tag = `new-step-focus-${work?.id}-${nextLogicalStep.id}`;
            const seenTags = getSeenSuggestions();

            if (!seenTags.has(tag)) {
                let aiMessageContent = "Ótimo! Foco total na próxima. O Zé tá de olho!"; // Default if no AI access
                if (hasAiAccess) {
                    // Generate AI message for this specific context
                    aiMessageContent = await aiService.getWorkInsight(`A etapa ${nextLogicalStep.name} da obra ${work?.name} acaba de se tornar a próxima a ser focada (início: ${nextLogicalStep.startDate}). Dê uma dica útil e incisiva para começar bem esta etapa, focando em otimização ou prevenção de problemas.`);
                }

                setActiveZeSuggestion({
                    id: `ze-sug-${Date.now()}`,
                    type: 'suggestion',
                    priority: 'low',
                    message: `BOA! Etapa "${completedStep.name}" concluída. Agora foco na "${nextLogicalStep.name}"!`,
                    aiMessage: aiMessageContent,
                    dismissible: true,
                    tag: tag,
                    aiContext: `A etapa ${nextLogicalStep.name} da obra ${work?.name} acaba de ser liberada. Dê uma dica útil para começar bem esta etapa.` // Re-use general context
                });
                markSuggestionAsSeen(tag);
            }
        }
    }
  }, [steps, work, getSeenSuggestions, markSuggestionAsSeen, hasAiAccess]);


  // =======================================================================
  // DATA LOADING
  // =======================================================================

  const loadWorkData = useCallback(async () => {
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
        dbService.getContractTemplates(),
        dbService.getChecklists(workId),
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

      // Trigger suggestion generation after all data is loaded
      generateZeSuggestion();

    } catch (error) {
      console.error("Erro ao carregar dados da obra:", error);
      navigate('/'); // Fallback to dashboard on error
    } finally {
      setLoading(false);
    }
  }, [workId, user, navigate, generateZeSuggestion, isUserAuthFinished, authLoading]);

  useEffect(() => {
    if (isUserAuthFinished && !authLoading) {
        loadWorkData();
    }
  }, [isUserAuthFinished, authLoading, loadWorkData]);

  // If a suggestion is dismissed or actioned, refresh suggestions.
  // This might be redundant with loadWorkData(), but explicitly calling it ensures reactive updates.
  useEffect(() => {
    if (activeZeSuggestion === null && !loading) {
      generateZeSuggestion();
    }
  }, [activeZeSuggestion, loading, generateZeSuggestion]);


  // =======================================================================
  // UI ACTIONS
  // =======================================================================

  // STEPS
  const handleAddStep = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!newStepName.trim()) newErrors.newStepName = "O nome da etapa é obrigatório.";
    if (!newStepStartDate) newErrors.newStepStartDate = "A data de início é obrigatória.";
    if (!newStepEndDate) newErrors.newStepEndDate = "A data final é obrigatória.";
    if (new Date(newStepStartDate) > new Date(newStepEndDate)) newErrors.newStepEndDate = "A data final não pode ser antes da data de início.";

    if (Object.keys(newErrors).length > 0) {
        setZeModal({
            isOpen: true,
            title: "Erro de Validação",
            message: Object.values(newErrors).join('\n'),
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
        return;
    }

    try {
      // Fix: Removed 'isDelayed: false' as it's handled by dbService.addStep internally.
      const newStep = await dbService.addStep({
        workId, name: newStepName, startDate: newStepStartDate, endDate: newStepEndDate, status: StepStatus.NOT_STARTED
      });
      if (newStep) {
        await loadWorkData();
        setShowAddStepModal(false);
        setNewStepName(''); setNewStepStartDate(new Date().toISOString().split('T')[0]); setNewStepEndDate(new Date().toISOString().split('T')[0]);
      }
    } catch (error: any) { 
        console.error("Erro ao adicionar etapa:", error);
        setZeModal({
            isOpen: true,
            title: "Erro ao Adicionar Etapa",
            message: `Não foi possível adicionar a etapa: ${error.message || 'Erro desconhecido.'}`,
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
    }
  };

  const handleEditStep = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editStepData || !workId || !user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!editStepData.name.trim()) newErrors.name = "O nome da etapa é obrigatório.";
    if (!editStepData.startDate) newErrors.startDate = "A data de início é obrigatória.";
    if (!editStepData.endDate) newErrors.endDate = "A data final é obrigatória.";
    if (new Date(editStepData.startDate) > new Date(editStepData.endDate)) newErrors.endDate = "A data final não pode ser antes da data de início.";

    if (Object.keys(newErrors).length > 0) {
        setZeModal({
            isOpen: true,
            title: "Erro de Validação",
            message: Object.values(newErrors).join('\n'),
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
        return;
    }

    try {
      const updatedStep = await dbService.updateStep(editStepData);
      if (updatedStep) {
        await loadWorkData();
        setShowAddStepModal(false);
        setEditStepData(null);
        if (updatedStep.status === StepStatus.COMPLETED) {
            handleStepCompletion(updatedStep);
        }
      }
    } catch (error: any) { 
        console.error("Erro ao atualizar etapa:", error);
        setZeModal({
            isOpen: true,
            title: "Erro ao Atualizar Etapa",
            message: `Não foi possível atualizar a etapa: ${error.message || 'Erro desconhecido.'}`,
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Etapa?',
      message: 'Tem certeza que deseja excluir esta etapa? Isso irá remover também os materiais e despesas associadas a ela.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => {
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          await dbService.deleteStep(stepId, workId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(currentZeModalState => ({ 
            ...currentZeModalState, 
            isOpen: true,
            title: 'Erro!',
            message: `Erro ao excluir: ${error.message}`, 
            confirmText: 'Entendido', 
            onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })),
            onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })),
            type: 'ERROR' 
          }));
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditStepModal = (step: Step) => {
    setEditStepData({ ...step });
    setNewStepName(step.name);
    setNewStepStartDate(step.startDate);
    setNewStepEndDate(step.endDate);
    setShowAddStepModal(true);
  };

  const handleToggleStepStatus = useCallback(async (step: Step) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const isDelayed = (step.status === StepStatus.NOT_STARTED || step.status === StepStatus.IN_PROGRESS) && new Date(step.endDate) < today;

    if (isDelayed || step.status === StepStatus.COMPLETED) {
        // If delayed or already completed, the button is not clickable (disabled).
        // This ensures the "Pendente -> Parcial -> Concluído" cycle is respected and not reverted.
        return; 
    }

    let nextStatus: StepStatus;
    if (step.status === StepStatus.NOT_STARTED) {
        nextStatus = StepStatus.IN_PROGRESS;
    } else if (step.status === StepStatus.IN_PROGRESS) {
        nextStatus = StepStatus.COMPLETED;
    } else { // Should not happen for a clickable button due to checks above
        console.warn(`Attempted to toggle status for step ${step.name} with unsupported status: ${step.status}`);
        return;
    }

    try {
        const updatedStep = await dbService.updateStep({ ...step, status: nextStatus });
        if (updatedStep) {
            await loadWorkData();
            if (updatedStep.status === StepStatus.COMPLETED) {
                handleStepCompletion(updatedStep);
            }
        }
    } catch (error: any) {
        console.error("Erro ao atualizar status da etapa:", error);
        setZeModal({
            isOpen: true,
            title: "Erro ao Atualizar Status",
            message: `Não foi possível atualizar o status da etapa: ${error.message || 'Erro desconhecido.'}`,
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
    }
}, [loadWorkData, handleStepCompletion]);

  // DRAG AND DROP HANDLERS FOR STEPS
  const handleDragStart = (e: React.DragEvent, stepId: string) => {
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = 'move';
    // Optional: Add a class for visual feedback during drag
    e.currentTarget.classList.add('opacity-50'); 
  };

  const handleDragOver = (e: React.DragEvent, stepId: string) => {
    e.preventDefault(); // Necessary to allow drop
    if (draggedStepId !== stepId) {
      setDragOverStepId(stepId);
    }
  };

  const handleDragLeave = () => {
    setDragOverStepId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    if (!draggedStepId || draggedStepId === targetStepId || !workId) return;

    const draggedIndex = steps.findIndex(s => s.id === draggedStepId);
    const targetIndex = steps.findIndex(s => s.id === targetStepId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newStepsOrder = [...steps];
    const [removed] = newStepsOrder.splice(draggedIndex, 1);
    newStepsOrder.splice(targetIndex, 0, removed);

    // Update orderIndex for all affected steps
    const updates = newStepsOrder.map((step, index) => ({
      ...step,
      orderIndex: index + 1 // Start order from 1
    }));

    setSteps(updates); // Optimistic UI update

    // Persist changes to the database
    try {
      await Promise.all(updates.map(step => dbService.updateStep(step)));
      console.log("Steps reordered and updated in DB.");
    } catch (error: any) {
      console.error("Failed to update step order in DB:", error);
      // Revert UI if DB update fails (or refetch to resync)
      await loadWorkData(); 
      setZeModal({
        isOpen: true,
        title: "Erro ao Reordenar",
        message: `Não foi possível salvar a nova ordem das etapas: ${error.message || 'Erro desconhecido.'}`,
        confirmText: "Entendido",
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
        type: 'ERROR'
      });
    } finally {
      setDraggedStepId(null);
      setDragOverStepId(null);
      // Remove temporary drag class from all elements
      e.currentTarget.classList.remove('opacity-50');
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedStepId(null);
    setDragOverStepId(null);
    e.currentTarget.classList.remove('opacity-50');
  };


  // MATERIALS
  const clearMaterialFormAndCloseModal = () => {
    setShowAddMaterialModal(false);
    setEditMaterialData(null);
    setNewMaterialName('');
    setNewMaterialPlannedQty('');
    setNewMaterialUnit('');
    setNewMaterialCategory('');
    setNewMaterialStepId('');
    // Clear purchase-related states
    setCurrentPurchaseQty('');
    setCurrentPurchaseCost('');
  };

  const handleAddMaterial = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!newMaterialName.trim()) newErrors.newMaterialName = "O nome do material é obrigatório.";
    if (!newMaterialPlannedQty || Number(newMaterialPlannedQty) <= 0) newErrors.newMaterialPlannedQty = "A quantidade planejada deve ser maior que zero.";
    if (!newMaterialUnit.trim()) newErrors.newMaterialUnit = "A unidade é obrigatória.";
    if (!newMaterialStepId.trim()) newErrors.newMaterialStepId = "O material deve estar vinculado a uma etapa.";

    if (Object.keys(newErrors).length > 0) {
        setZeModal({
            isOpen: true,
            title: "Erro de Validação",
            message: Object.values(newErrors).join('\n'),
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
        return;
    }

    try {
      const newMaterial = await dbService.addMaterial({
        workId, name: newMaterialName, brand: undefined, plannedQty: Number(newMaterialPlannedQty), purchasedQty: 0, unit: newMaterialUnit, stepId: newMaterialStepId, category: newMaterialCategory
      });
      if (newMaterial) {
        await loadWorkData();
        clearMaterialFormAndCloseModal();
      }
    } catch (error: any) { 
        console.error("Erro ao adicionar material:", error);
        setZeModal({
            isOpen: true,
            title: "Erro ao Adicionar Material",
            message: `Não foi possível adicionar o material: ${error.message || 'Erro desconhecido.'}`,
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
    }
  };

  const handleEditMaterial = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editMaterialData || !workId || !user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!editMaterialData.name.trim()) newErrors.name = "O nome do material é obrigatório.";
    if (!editMaterialData.plannedQty || Number(editMaterialData.plannedQty) <= 0) newErrors.plannedQty = "A quantidade planejada deve ser maior que zero.";
    if (!editMaterialData.unit.trim()) newErrors.unit = "A unidade é obrigatória.";
    if (!editMaterialData.stepId.trim()) newErrors.stepId = "O material deve estar vinculado a uma etapa.";

    if (Object.keys(newErrors).length > 0) {
        setZeModal({
            isOpen: true,
            title: "Erro de Validação",
            message: Object.values(newErrors).join('\n'),
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
        return;
    }

    try {
      // Only update editable fields, purchasedQty and totalCost are updated by registerMaterialPurchase
      const updatedMaterial = await dbService.updateMaterial({
        ...editMaterialData,
        name: editMaterialData.name,
        brand: editMaterialData.brand,
        plannedQty: editMaterialData.plannedQty,
        unit: editMaterialData.unit,
        stepId: editMaterialData.stepId,
        category: editMaterialData.category,
      });
      if (updatedMaterial) {
        await loadWorkData();
        clearMaterialFormAndCloseModal();
      }
    } catch (error: any) { 
        console.error("Erro ao atualizar material:", error);
        setZeModal({
            isOpen: true,
            title: "Erro ao Atualizar Material",
            message: `Não foi possível atualizar o material: ${error.message || 'Erro desconhecido.'}`,
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Material?',
      message: 'Tem certeza que deseja excluir este material? Isso irá remover também os lançamentos financeiros correspondentes.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => {
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          await dbService.deleteMaterial(materialId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(currentZeModalState => ({
            ...currentZeModalState,
            isOpen: true,
            title: 'Erro!',
            message: `Erro ao excluir material: ${error.message}`,
            confirmText: 'Entendido',
            onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })),
            onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })),
            type: 'ERROR'
          }));
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditMaterialModal = (material: Material) => {
    setEditMaterialData({ ...material });
    setNewMaterialName(material.name);
    setNewMaterialPlannedQty(material.plannedQty.toString());
    setNewMaterialUnit(material.unit);
    setNewMaterialCategory(material.category || ''); // Default to empty string for category
    setNewMaterialStepId(material.stepId || ''); // Default to empty string for stepId
    setCurrentPurchaseQty(''); // Reset purchase fields when opening modal
    setCurrentPurchaseCost('');
    setShowAddMaterialModal(true);
  };

  // NEW: handleInternalRegisterPurchase (replaces old handleRegisterPurchase)
  const handleInternalRegisterPurchase = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editMaterialData || !workId || !user?.id) return;

    const currentMaterial = materials.find(m => m.id === editMaterialData.id);
    if (!currentMaterial) return;

    const newErrors: Record<string, string> = {};
    if (!currentPurchaseQty || Number(currentPurchaseQty) <= 0) newErrors.currentPurchaseQty = "A quantidade comprada deve ser maior que zero.";
    if (!currentPurchaseCost || Number(currentPurchaseCost) <= 0) newErrors.currentPurchaseCost = "O custo da compra deve ser maior que zero.";
    
    if (Object.keys(newErrors).length > 0) {
        setZeModal({
            isOpen: true,
            title: "Erro de Validação",
            message: Object.values(newErrors).join('\n'),
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
        return;
    }

    try {
      await dbService.registerMaterialPurchase(
        currentMaterial.id,
        currentMaterial.name,
        currentMaterial.brand,
        currentMaterial.plannedQty,
        currentMaterial.unit,
        Number(currentPurchaseQty),
        Number(currentPurchaseCost)
      );
      await loadWorkData();
      // Keep modal open, just clear purchase fields and show success? Or close?
      // For now, close and reload for simplicity.
      clearMaterialFormAndCloseModal(); 
      // If we wanted to keep modal open, we'd only clear purchase fields and update editMaterialData with new purchasedQty/totalCost
    } catch (error: any) { 
        console.error("Erro ao registrar compra:", error);
        setZeModal({
            isOpen: true,
            title: "Erro ao Registrar Compra",
            message: `Não foi possível registrar o pagamento: ${error.message || 'Erro desconhecido.'}`,
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
    }
  };


  // EXPENSES
  const clearExpenseFormAndCloseModal = () => {
    setShowAddExpenseModal(false);
    setEditExpenseData(null);
    setNewExpenseDescription('');
    setNewExpenseAmount('');
    setNewExpenseCategory(ExpenseCategory.OTHER);
    setNewExpenseDate(new Date().toISOString().split('T')[0]);
    setNewExpenseStepId('');
    setNewExpenseWorkerId(''); // Clear worker ID
    setNewExpenseSupplierId(''); // Clear supplier ID
  };

  const handleAddExpense = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!newExpenseDescription.trim()) newErrors.newExpenseDescription = "A descrição é obrigatória.";
    // Modificação da validação: permite 0, mas impede negativos ou vazio
    if (newExpenseAmount.trim() === '' || Number(newExpenseAmount) < 0) {
      newErrors.newExpenseAmount = "O valor combinado não pode ser negativo ou vazio.";
    }
    if (!newExpenseDate) newErrors.newExpenseDate = "A data é obrigatória.";
    if (newExpenseCategory === ExpenseCategory.MATERIAL && !newExpenseStepId) newErrors.newExpenseStepId = "Selecione a etapa para o material.";

    if (Object.keys(newErrors).length > 0) {
        setZeModal({
            isOpen: true,
            title: "Erro de Validação",
            message: Object.values(newErrors).join('\n'),
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
        return;
    }

    try {
      const newExpense = await dbService.addExpense({
        workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount),
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId || undefined,
        paidAmount: newExpenseCategory !== ExpenseCategory.MATERIAL ? Number(newExpenseAmount) : 0,
        totalAgreed: Number(newExpenseAmount),
        workerId: newExpenseWorkerId || undefined, // Add workerId
        supplierId: newExpenseSupplierId || undefined, // Add supplierId
      });
      if (newExpense) {
        await loadWorkData();
        clearExpenseFormAndCloseModal();
      }
    } catch (error: any) { 
        console.error("Erro ao adicionar despesa:", error);
        setZeModal({
            isOpen: true,
            title: "Erro ao Adicionar Despesa",
            message: `Não foi possível adicionar a despesa: ${error.message || 'Erro desconhecido.'}`,
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
    }
  };

  const handleEditExpense = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editExpenseData || !workId || !user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!editExpenseData.description.trim()) newErrors.description = "A descrição é obrigatória.";
    // Modificação da validação: permite 0, mas impede negativos ou vazio
    if (String(editExpenseData.amount).trim() === '' || Number(editExpenseData.amount) < 0) {
        newErrors.amount = "O valor combinado não pode ser negativo ou vazio.";
    }
    if (!editExpenseData.date) newErrors.date = "A data é obrigatória.";
    if (editExpenseData.category === ExpenseCategory.MATERIAL && !editExpenseData.stepId) newErrors.stepId = "Selecione a etapa para o material.";

    if (Object.keys(newErrors).length > 0) {
        setZeModal({
            isOpen: true,
            title: "Erro de Validação",
            message: Object.values(newErrors).join('\n'),
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
        return;
    }

    try {
      const updatedExpense = await dbService.updateExpense({
        ...editExpenseData,
        workerId: newExpenseWorkerId || undefined, // Update workerId
        supplierId: newExpenseSupplierId || undefined, // Update supplierId
      });
      if (updatedExpense) {
        await loadWorkData();
        clearExpenseFormAndCloseModal();
      }
    } catch (error: any) { 
        console.error("Erro ao atualizar despesa:", error);
        setZeModal({
            isOpen: true,
            title: "Erro ao Atualizar Despesa",
            message: `Não foi possível atualizar a despesa: ${error.message || 'Erro desconhecido.'}`,
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
        });
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
      isOpen: true,
      title: 'Excluir Despesa?',
      message: 'Tem certeza que deseja excluir esta despesa? Se ela estiver vinculada a um material, a quantidade comprada do material será ajustada.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => {
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          await dbService.deleteExpense(expenseId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          setZeModal(currentZeModalState => ({
            ...currentZeModalState,
            isOpen: true,
            title: 'Erro!',
            message: `Erro ao excluir despesa: ${error.message}`,
            confirmText: 'Entendido',
            onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })),
            onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })),
            type: 'ERROR'
          }));
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditExpenseModal = (expense: Expense) => {
    setEditExpenseData({ ...expense });
    setNewExpenseDescription(expense.description);
    setNewExpenseAmount(expense.amount.toString());
    setNewExpenseCategory(expense.category);
    setNewExpenseDate(expense.date);
    setNewExpenseStepId(expense.stepId || '');
    setNewExpenseWorkerId(expense.workerId || ''); // Set worker ID
    setNewExpenseSupplierId(expense.supplierId || ''); // Set supplier ID
    setShowAddExpenseModal(true);
  };

  const handleAddPayment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!paymentExpenseData || !paymentAmount || Number(paymentAmount) <= 0) {
      setZeModal({
        isOpen: true,
        title: "Erro de Validação",
        message: "O valor do pagamento deve ser maior que zero.",
        confirmText: "Entendido",
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
        type: 'ERROR'
      });
      return;
    }

    try {
      await dbService.addPaymentToExpense(paymentExpenseData.id, Number(paymentAmount), paymentDate);
      await loadWorkData();
      setShowAddPaymentModal(false);
      setPaymentAmount('');
      setNewPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentExpenseData(null);
    } catch (error: any) {
      console.error("Erro ao registrar pagamento:", error);
      setZeModal({
        isOpen: true,
        title: "Erro ao Registrar Pagamento",
        message: `Não foi possível registrar o pagamento: ${error.message || 'Erro desconhecido.'}`,
        confirmText: "Entendido",
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
        type: 'ERROR'
      });
    }
  };

  const handleOpenAddPaymentModal = (expense: Expense) => {
    setPaymentExpenseData(expense);
    setPaymentAmount('');
    setNewPaymentDate(new Date().toISOString().split('T')[0]);
    setShowAddPaymentModal(true);
  };

  // WORKERS
  const clearWorkerFormAndCloseModal = () => {
    setShowAddWorkerModal(false);
    setEditWorkerData(null);
    setNewWorkerName('');
    setNewWorkerRole('');
    setNewWorkerPhone('');
    setNewWorkerDailyRate('');
    setNewWorkerNotes('');
  };

  const handleAddWorker = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;
    const newErrors: Record<string, string> = {};
    if (!newWorkerName.trim()) newErrors.newWorkerName = "O nome é obrigatório.";
    if (!newWorkerRole.trim()) newErrors.newWorkerRole = "O papel é obrigatório.";
    if (Object.keys(newErrors).length > 0) {
        setZeModal({ isOpen: true, title: "Erro de Validação", message: Object.values(newErrors).join('\n'), confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
        return;
    }
    try {
      const newWorker = await dbService.addWorker({
        userId: user.id, workId, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone, dailyRate: Number(newWorkerDailyRate) || undefined, notes: newWorkerNotes
      });
      if (newWorker) {
        await loadWorkData();
        clearWorkerFormAndCloseModal();
      }
    } catch (error: any) { 
        console.error("Erro ao adicionar profissional:", error);
        setZeModal({ isOpen: true, title: "Erro ao Adicionar Profissional", message: `Não foi possível adicionar: ${error.message || 'Erro desconhecido.'}`, confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
    }
  };

  const handleEditWorker = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editWorkerData || !workId || !user?.id) return;
    const newErrors: Record<string, string> = {};
    if (!editWorkerData.name.trim()) newErrors.name = "O nome é obrigatório.";
    if (!editWorkerData.role.trim()) newErrors.role = "O papel é obrigatório.";
    if (Object.keys(newErrors).length > 0) {
        setZeModal({ isOpen: true, title: "Erro de Validação", message: Object.values(newErrors).join('\n'), confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
        return;
    }
    try {
      const updatedWorker = await dbService.updateWorker(editWorkerData);
      if (updatedWorker) {
        await loadWorkData();
        clearWorkerFormAndCloseModal();
      }
    } catch (error: any) { 
        console.error("Erro ao atualizar profissional:", error);
        setZeModal({ isOpen: true, title: "Erro ao Atualizar Profissional", message: `Não foi possível atualizar: ${error.message || 'Erro desconhecido.'}`, confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
        isOpen: true,
        title: 'Excluir Profissional?',
        message: 'Tem certeza que deseja excluir este profissional?',
        confirmText: 'Sim, Excluir',
        cancelText: 'Cancelar',
        type: 'DANGER',
        onConfirm: async () => {
            setZeModal(prev => ({ ...prev, isConfirming: true }));
            try {
                await dbService.deleteWorker(workerId, workId);
                await loadWorkData();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            } catch (error: any) {
                setZeModal(currentZeModalState => ({ ...currentZeModalState, isOpen: true, title: 'Erro!', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), type: 'ERROR' }));
            } finally {
                setZeModal(prev => ({ ...prev, isConfirming: false }));
            }
        },
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditWorkerModal = (worker: Worker) => {
    setEditWorkerData({ ...worker });
    setNewWorkerName(worker.name);
    setNewWorkerRole(worker.role);
    setNewWorkerPhone(worker.phone);
    setNewWorkerDailyRate(worker.dailyRate?.toString() || '');
    setNewWorkerNotes(worker.notes || '');
    setShowAddWorkerModal(true);
  };

  // SUPPLIERS
  const clearSupplierFormAndCloseModal = () => {
    setShowAddSupplierModal(false);
    setEditSupplierData(null);
    setNewSupplierName('');
    setNewSupplierCategory('');
    setNewSupplierPhone('');
    setNewSupplierEmail('');
    setNewSupplierAddress('');
    setNewSupplierNotes('');
  };

  const handleAddSupplier = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;
    const newErrors: Record<string, string> = {};
    if (!newSupplierName.trim()) newErrors.newSupplierName = "O nome é obrigatório.";
    if (!newSupplierCategory.trim()) newErrors.newSupplierCategory = "A categoria é obrigatória.";
    if (Object.keys(newErrors).length > 0) {
        setZeModal({ isOpen: true, title: "Erro de Validação", message: Object.values(newErrors).join('\n'), confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
        return;
    }
    try {
      const newSupplier = await dbService.addSupplier({
        userId: user.id, workId, name: newSupplierName, category: newSupplierCategory, phone: newSupplierPhone, email: newSupplierEmail, address: newSupplierAddress, notes: newSupplierNotes
      });
      if (newSupplier) {
        await loadWorkData();
        clearSupplierFormAndCloseModal();
      }
    } catch (error: any) { 
        console.error("Erro ao adicionar fornecedor:", error);
        setZeModal({ isOpen: true, title: "Erro ao Adicionar Fornecedor", message: `Não foi possível adicionar: ${error.message || 'Erro desconhecido.'}`, confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
    }
  };

  const handleEditSupplier = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editSupplierData || !workId || !user?.id) return;
    const newErrors: Record<string, string> = {};
    if (!editSupplierData.name.trim()) newErrors.name = "O nome é obrigatório.";
    if (!editSupplierData.category.trim()) newErrors.category = "A categoria é obrigatória.";
    if (Object.keys(newErrors).length > 0) {
        setZeModal({ isOpen: true, title: "Erro de Validação", message: Object.values(newErrors).join('\n'), confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
        return;
    }
    try {
      const updatedSupplier = await dbService.updateSupplier(editSupplierData);
      if (updatedSupplier) {
        await loadWorkData();
        clearSupplierFormAndCloseModal();
      }
    } catch (error: any) { 
        console.error("Erro ao atualizar fornecedor:", error);
        setZeModal({ isOpen: true, title: "Erro ao Atualizar Fornecedor", message: `Não foi possível atualizar: ${error.message || 'Erro desconhecido.'}`, confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
        isOpen: true,
        title: 'Excluir Fornecedor?',
        message: 'Tem certeza que deseja excluir este fornecedor?',
        confirmText: 'Sim, Excluir',
        cancelText: 'Cancelar',
        type: 'DANGER',
        onConfirm: async () => {
            setZeModal(prev => ({ ...prev, isConfirming: true }));
            try {
                await dbService.deleteSupplier(supplierId, workId);
                await loadWorkData();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            } catch (error: any) {
                setZeModal(currentZeModalState => ({ ...currentZeModalState, isOpen: true, title: 'Erro!', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), type: 'ERROR' }));
            } finally {
                setZeModal(prev => ({ ...prev, isConfirming: false }));
            }
        },
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditSupplierModal = (supplier: Supplier) => {
    setEditSupplierData({ ...supplier });
    setNewSupplierName(supplier.name);
    setNewSupplierCategory(supplier.category);
    setNewSupplierPhone(supplier.phone);
    setNewSupplierEmail(supplier.email || '');
    setNewSupplierAddress(supplier.address || '');
    setNewSupplierNotes(supplier.notes || '');
    setShowAddSupplierModal(true);
  };

  // PHOTOS
  const handleAddPhoto = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id || !newPhotoFile) return;

    setLoadingPhoto(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate upload delay
      const mockPhotoUrl = "https://via.placeholder.com/600x400?text=Obra+Photo";

      const newPhoto = await dbService.addPhoto({
        workId, url: mockPhotoUrl, description: newPhotoDescription, date: new Date().toISOString().split('T')[0], type: newPhotoType
      });
      if (newPhoto) {
        await loadWorkData();
        setShowAddPhotoModal(false);
        setNewPhotoDescription('');
        setNewPhotoFile(null);
      }
    } catch (error: any) { 
        console.error("Erro ao adicionar foto:", error);
        setZeModal({ isOpen: true, title: "Erro ao Adicionar Foto", message: `Não foi possível adicionar: ${error.message || 'Erro desconhecido.'}`, confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
    } finally { setLoadingPhoto(false); }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
        isOpen: true,
        title: 'Excluir Foto?',
        message: 'Tem certeza que deseja excluir esta foto?',
        confirmText: 'Sim, Excluir',
        cancelText: 'Cancelar',
        type: 'DANGER',
        onConfirm: async () => {
            setZeModal(prev => ({ ...prev, isConfirming: true }));
            try {
                await dbService.deletePhoto(photoId);
                await loadWorkData();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            } catch (error: any) {
                setZeModal(currentZeModalState => ({ ...currentZeModalState, isOpen: true, title: 'Erro!', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), type: 'ERROR' }));
            } finally {
                setZeModal(prev => ({ ...prev, isConfirming: false }));
            }
        },
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };


  // FILES
  const handleAddFile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id || !newUploadFile) return;

    setLoadingFile(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate upload delay
      const mockFileUrl = "https://via.placeholder.com/600x400?text=Documento+Obra"; // Placeholder

      const newFile = await dbService.addFile({
        workId, name: newFileName, category: newFileCategory, url: mockFileUrl, type: newUploadFile.type, date: new Date().toISOString().split('T')[0]
      });
      if (newFile) {
        await loadWorkData();
        setShowAddFileModal(false);
        setNewFileName('');
        setNewUploadFile(null);
      }
    } catch (error: any) { 
        console.error("Erro ao adicionar arquivo:", error);
        setZeModal({ isOpen: true, title: "Erro ao Adicionar Arquivo", message: `Não foi possível adicionar: ${error.message || 'Erro desconhecido.'}`, confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
    } finally { setLoadingFile(false); }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
        isOpen: true,
        title: 'Excluir Arquivo?',
        message: 'Tem certeza que deseja excluir este arquivo?',
        confirmText: 'Sim, Excluir',
        cancelText: 'Cancelar',
        type: 'DANGER',
        onConfirm: async () => {
            setZeModal(prev => ({ ...prev, isConfirming: true }));
            try {
                await dbService.deleteFile(fileId);
                await loadWorkData();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            } catch (error: any) {
                setZeModal(currentZeModalState => ({ ...currentZeModalState, isOpen: true, title: 'Erro!', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), type: 'ERROR' }));
            } finally {
                setZeModal(prev => ({ ...prev, isConfirming: false }));
            }
        },
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  // CHECKLISTS
  const clearChecklistFormAndCloseModal = () => {
    setShowAddChecklistModal(false);
    setEditChecklistData(null);
    setNewChecklistName('');
    setNewChecklistCategory('');
    setNewChecklistItems(['']);
  };

  const handleAddChecklist = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!newChecklistName.trim()) newErrors.newChecklistName = "O nome da checklist é obrigatório.";
    if (!newChecklistCategory.trim()) newErrors.newChecklistCategory = "A categoria é obrigatória.";
    if (newChecklistItems.every(item => !item.trim())) newErrors.newChecklistItems = "Adicione ao menos um item à checklist.";
    
    if (Object.keys(newErrors).length > 0) {
        setZeModal({ isOpen: true, title: "Erro de Validação", message: Object.values(newErrors).join('\n'), confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
        return;
    }

    try {
      const checklistToSave: Omit<Checklist, 'id'> = {
        workId,
        name: newChecklistName,
        category: newChecklistCategory,
        items: newChecklistItems.filter(item => item.trim() !== '').map(text => ({ id: crypto.randomUUID(), text, checked: false }))
      };
      const newChecklist = await dbService.addChecklist(checklistToSave); 
      if (newChecklist) {
        await loadWorkData();
        clearChecklistFormAndCloseModal();
      }
    } catch (error: any) {
      console.error("Erro ao adicionar checklist:", error);
      setZeModal({ isOpen: true, title: "Erro ao Adicionar Checklist", message: `Não foi possível adicionar: ${error.message || 'Erro desconhecido.'}`, confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
    }
  };

  const handleEditChecklist = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editChecklistData || !workId || !user?.id) return;
    
    const newErrors: Record<string, string> = {};
    if (!editChecklistData.name.trim()) newErrors.name = "O nome da checklist é obrigatório.";
    if (!editChecklistData.category.trim()) newErrors.category = "A categoria é obrigatória.";
    if (editChecklistData.items.every(item => !item.text.trim())) newErrors.items = "Adicione ao menos um item à checklist.";

    if (Object.keys(newErrors).length > 0) {
        setZeModal({ isOpen: true, title: "Erro de Validação", message: Object.values(newErrors).join('\n'), confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
        return;
    }

    try {
      const checklistToUpdate: Checklist = {
        ...editChecklistData,
        items: editChecklistData.items.filter(item => item.text.trim() !== '')
      };
      const updatedChecklist = await dbService.updateChecklist(checklistToUpdate); 
      if (updatedChecklist) {
        await loadWorkData();
        clearChecklistFormAndCloseModal();
      }
    } catch (error: any) {
      console.error("Erro ao atualizar checklist:", error);
      setZeModal({ isOpen: true, title: "Erro ao Atualizar Checklist", message: `Não foi possível atualizar: ${error.message || 'Erro desconhecido.'}`, confirmText: "Entendido", onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'ERROR' });
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!workId || !user?.id) return;
    setZeModal({
        isOpen: true,
        title: 'Excluir Checklist?',
        message: 'Tem certeza que deseja excluir esta checklist?',
        confirmText: 'Sim, Excluir',
        cancelText: 'Cancelar',
        type: 'DANGER',
        onConfirm: async () => {
            setZeModal(prev => ({ ...prev, isConfirming: true }));
            try {
                await dbService.deleteChecklist(checklistId); 
                await loadWorkData();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            } catch (error: any) {
                setZeModal(currentZeModalState => ({ ...currentZeModalState, isOpen: true, title: 'Erro!', message: `Erro ao excluir: ${error.message}`, confirmText: 'Entendido', onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), type: 'ERROR' }));
            } finally {
                setZeModal(prev => ({ ...prev, isConfirming: false }));
            }
        },
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openEditChecklistModal = (checklist: Checklist) => {
    setEditChecklistData({ ...checklist });
    setNewChecklistName(checklist.name);
    setNewChecklistCategory(checklist.category);
    setNewChecklistItems(checklist.items.map(item => item.text));
    setShowAddChecklistModal(true);
  };


  // --- EXPORT FUNCTIONS (REPORTS) - REMOVIDO ---
  // The handleExportToExcel and related report logic are removed as per the prompt.

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] text-red-500">
        <p className="text-xl font-bold">Obra não encontrada ou você não tem permissão para acessá-la.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans">
      {activeZeSuggestion && (
        <ZeAssistantCard
          suggestion={activeZeSuggestion}
          onDismiss={markSuggestionAsSeen}
          onAction={(callback) => {
            if (callback) callback();
            markSuggestionAsSeen(activeZeSuggestion.tag);
          }}
          onGenerateAiMessage={generateAiMessageForSuggestion}
          loadingAi={loadingAiMessage}
        />
      )}

      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button
          onClick={() => {
            if (activeSubView !== 'NONE') {
              setActiveSubView('NONE');
            } else {
              navigate('/');
            }
          }}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label="Voltar"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">{work.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Gestão Completa da sua obra</p>
        </div>
      </div>

      {activeSubView === 'NONE' && (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 flex justify-around items-center mb-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
            <button onClick={() => goToTab('ETAPAS')} className={`flex-1 py-3 px-2 text-center text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${activeTab === 'ETAPAS' ? 'bg-primary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-pressed={activeTab === 'ETAPAS'} aria-label="Aba Etapas">
              <i className="fa-solid fa-list-check"></i> <span className="hidden sm:inline">Etapas</span>
            </button>
            <button onClick={() => goToTab('MATERIAIS')} className={`flex-1 py-3 px-2 text-center text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${activeTab === 'MATERIAIS' ? 'bg-primary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-pressed={activeTab === 'MATERIAIS'} aria-label="Aba Materiais">
              <i className="fa-solid fa-boxes-stacked"></i> <span className="hidden sm:inline">Materiais</span>
            </button>
            <button onClick={() => goToTab('FINANCEIRO')} className={`flex-1 py-3 px-2 text-center text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${activeTab === 'FINANCEIRO' ? 'bg-primary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-pressed={activeTab === 'FINANCEIRO'} aria-label="Aba Financeiro">
              <i className="fa-solid fa-dollar-sign"></i> <span className="hidden sm:inline">Financeiro</span>
            </button>
            <button onClick={() => goToTab('FERRAMENTAS')} className={`flex-1 py-3 px-2 text-center text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${activeTab === 'FERRAMENTAS' ? 'bg-primary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} aria-pressed={activeTab === 'FERRAMENTAS'} aria-label="Aba Ferramentas">
              <i className="fa-solid fa-screwdriver-wrench"></i> <span className="hidden sm:inline">Ferramentas</span>
            </button>
          </div>

          {/* Tab Content: ETAPAS */}
          {activeTab === 'ETAPAS' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center px-2 sm:px-0">
                <h2 className="text-xl font-black text-primary dark:text-white">Cronograma da Obra</h2>
                <button onClick={() => setShowAddStepModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Adicionar nova etapa">
                  <i className="fa-solid fa-plus-circle"></i> Nova Etapa
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {steps.length === 0 ? (
                  <div className="col-span-full text-center text-slate-400 py-8 italic">Nenhuma etapa cadastrada ainda.</div>
                ) : (
                  // Sort steps by orderIndex for display
                  steps.sort((a, b) => a.orderIndex - b.orderIndex).map((step, index) => {
                    const today = new Date();
                    today.setHours(0,0,0,0); // Normalize to local midnight
                    const isDelayed = (step.status === StepStatus.NOT_STARTED || step.status === StepStatus.IN_PROGRESS) && new Date(step.endDate) < today;
                    let stepStatusClass = '';
                    let stepStatusBgClass = '';
                    let statusText = '';
                    let borderClass = 'border-slate-200 dark:border-slate-800';
                    let shadowClass = 'shadow-card-default';

                    // NEW: Combined status logic
                    const isCompleted = step.status === StepStatus.COMPLETED;
                    const isInProgress = step.status === StepStatus.IN_PROGRESS;
                    const isNotStarted = step.status === StepStatus.NOT_STARTED;

                    if (isDelayed) {
                      stepStatusClass = 'text-red-600 dark:text-red-400';
                      stepStatusBgClass = 'bg-red-500/10';
                      statusText = 'Atrasada';
                      borderClass = 'border-red-500/50 dark:border-red-700/50';
                      shadowClass = 'shadow-lg shadow-red-500/20';
                    } else if (isCompleted) {
                      stepStatusClass = 'text-green-600 dark:text-green-400';
                      stepStatusBgClass = 'bg-green-500/10';
                      statusText = 'Concluída';
                      borderClass = 'border-green-500/50 dark:border-green-700/50';
                      shadowClass = 'shadow-lg shadow-green-500/20';
                    } else if (isInProgress) {
                      stepStatusClass = 'text-amber-600 dark:text-amber-400';
                      stepStatusBgClass = 'bg-amber-500/10';
                      statusText = 'Parcial';
                      borderClass = 'border-amber-500/50 dark:border-amber-700/50';
                      shadowClass = 'shadow-lg shadow-amber-500/20';
                    } else if (isNotStarted) { // NOT_STARTED (Pendente)
                      stepStatusClass = 'text-slate-500 dark:text-slate-400';
                      stepStatusBgClass = 'bg-slate-200 dark:bg-slate-700/50';
                      statusText = 'Pendente';
                      // No specific shadow for Pendente, uses default card-default
                    } else { // Fallback for any other unexpected status
                        stepStatusClass = 'text-slate-500 dark:text-slate-400';
                        stepStatusBgClass = 'bg-slate-200 dark:bg-slate-700/50';
                        statusText = 'Desconhecido';
                    }

                    // Determine if the current step is being dragged over
                    const isDragOver = dragOverStepId === step.id && draggedStepId !== step.id;
                    const dragOverClass = isDragOver ? 'border-dashed border-secondary-darker transform scale-[1.02] bg-slate-50 dark:bg-slate-800' : '';

                    // Disable button if delayed OR completed, as per cycle rule
                    const isStatusButtonDisabled = isDelayed || isCompleted;

                    return (
                      <div 
                        key={step.id} 
                        // Drag and Drop attributes
                        draggable
                        onDragStart={(e) => handleDragStart(e, step.id)}
                        onDragOver={(e) => handleDragOver(e, step.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, step.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openEditStepModal(step)}
                        className={cx(surface, card, "flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:border-secondary/50", borderClass, shadowClass, dragOverClass)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Editar etapa ${step.name}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditStepModal(step); }}
                      >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Etapa {step.orderIndex}</span> {/* Display orderIndex */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleStepStatus(step); }}
                                className={cx("text-xs font-bold px-3 py-1 rounded-full transition-all", stepStatusClass, stepStatusBgClass, isStatusButtonDisabled ? 'cursor-not-allowed opacity-70' : 'hover:brightness-90 active:scale-95')}
                                aria-label={`Alterar status da etapa ${step.name}. Status atual: ${statusText}`}
                                disabled={isStatusButtonDisabled}
                            >
                                {statusText}
                            </button>
                        </div>
                        <h3 className="text-xl font-black text-primary dark:text-white leading-tight mb-2">{step.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                          <span><i className="fa-regular fa-calendar-alt mr-2"></i>{formatDateDisplay(step.startDate)}</span>
                          <span>-</span>
                          <span>{formatDateDisplay(step.endDate)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab Content: MATERIAIS */}
          {activeTab === 'MATERIAIS' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center px-2 sm:px-0">
                <h2 className="text-xl font-black text-primary dark:text-white">Materiais da Obra</h2>
                <button onClick={() => setShowAddMaterialModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Adicionar novo material">
                  <i className="fa-solid fa-plus-circle"></i> Novo Material
                </button>
              </div>

              {/* Material Filter by Step */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                <label htmlFor="material-filter-step" className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Filtrar por Etapa:</label>
                <select
                  id="material-filter-step"
                  value={materialFilterStepId}
                  onChange={(e) => setMaterialFilterStepId(e.target.value)}
                  className="w-full px-4 py-2 text-base border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-xl focus:outline-none focus:ring-secondary focus:border-secondary transition-colors cursor-pointer"
                  aria-label="Filtrar materiais por etapa"
                >
                  <option value="all">Todas as Etapas</option>
                  {steps.sort((a,b) => a.orderIndex - b.orderIndex).map(step => ( // Sort steps for filter too
                    <option key={step.id} value={step.id}>{step.name}</option>
                  ))}
                </select>
              </div>

              {groupedMaterials.length === 0 ? (
                <div className="text-center text-slate-400 py-8 italic">Nenhum material cadastrado ou corresponde ao filtro.</div>
              ) : (
                groupedMaterials.map(stepGroup => (
                  <div key={stepGroup.stepId} className="mb-6 last:mb-0">
                    <h3 className="text-lg font-black text-primary dark:text-white mb-3 px-2 sm:px-0 flex items-center gap-2">
                        <span className="text-secondary text-sm">Etapa {steps.find(s => s.id === stepGroup.stepId)?.orderIndex}:</span> {stepGroup.stepName} {/* Display orderIndex */}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stepGroup.materials.map(material => {
                        const linkedStep = steps.find(s => s.id === material.stepId);
                        const stepStartDate = linkedStep ? new Date(linkedStep.startDate) : new Date(0);
                        stepStartDate.setHours(0,0,0,0);
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const threeDaysFromNow = new Date(today);
                        threeDaysFromNow.setDate(today.getDate() + 3);

                        // REGRA: Um material vira ATRASADO automaticamente quando: Faltam 3 dias para o início da etapa E ele ainda não foi totalmente comprado
                        const isDelayedMaterial = material.plannedQty > 0 && material.purchasedQty < material.plannedQty && 
                                                  (stepStartDate >= today && stepStartDate <= threeDaysFromNow);
                        
                        const isPartial = material.purchasedQty > 0 && material.purchasedQty < material.plannedQty && !isDelayedMaterial;
                        const isCompleted = material.purchasedQty >= material.plannedQty;
                        const progress = (material.plannedQty > 0) ? (material.purchasedQty / material.plannedQty) * 100 : 0;
                        
                        let materialStatusClass = '';
                        let materialStatusBgClass = '';
                        let statusText = '';
                        let borderClass = 'border-slate-200 dark:border-slate-800';
                        let shadowClass = 'shadow-card-default';

                        if (isDelayedMaterial) {
                            materialStatusClass = 'text-red-600 dark:text-red-400';
                            materialStatusBgClass = 'bg-red-500/10';
                            statusText = 'ATRASADO!';
                            borderClass = 'border-red-500/50 dark:border-red-700/50';
                            shadowClass = 'shadow-lg shadow-red-500/20';
                        } else if (isCompleted) {
                            materialStatusClass = 'text-green-600 dark:text-green-400';
                            materialStatusBgClass = 'bg-green-500/10';
                            statusText = 'Concluído';
                            borderClass = 'border-green-500/50 dark:border-green-700/50';
                            shadowClass = 'shadow-lg shadow-green-500/20';
                        } else if (isPartial) {
                            materialStatusClass = 'text-amber-600 dark:text-amber-400';
                            materialStatusBgClass = 'bg-amber-500/10';
                            statusText = 'Parcial';
                            borderClass = 'border-amber-500/50 dark:border-amber-700/50';
                            shadowClass = 'shadow-lg shadow-amber-500/20';
                        } else { // Pendente (0 purchased) and not delayed
                            materialStatusClass = 'text-slate-500 dark:text-slate-400';
                            materialStatusBgClass = 'bg-slate-200 dark:bg-slate-700/50';
                            statusText = 'Pendente';
                            // No specific shadow for Pendente, uses default card-default
                        }
                        
                        return (
                          <div 
                            key={material.id} 
                            onClick={() => openEditMaterialModal(material)}
                            className={cx(surface, card, "flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:border-secondary/50", borderClass, shadowClass)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Editar material ${material.name}`}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditMaterialModal(material); }}
                          >
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="text-xl font-black text-primary dark:text-white leading-tight">{material.name}</h3>
                              <span className={cx("text-xs font-bold px-3 py-1 rounded-full", materialStatusClass, materialStatusBgClass)}>
                                {statusText}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{material.brand || 'Marca não informada'}</p>
                            
                            {/* Tripé de controle de material */}
                            <div className="mb-4">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Sugerida: <span className="text-primary dark:text-white">{material.plannedQty} {material.unit}</span></p> {/* CORREÇÃO: "Planejado:" para "Sugerida:" */}
                                <p className="text-sm font-black text-green-600 dark:text-green-400 flex items-center gap-2">
                                    <i className="fa-solid fa-check-double"></i>
                                    Comprado: {material.purchasedQty} de {material.plannedQty} {material.unit}
                                </p>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                                <div 
                                    className={`h-full rounded-full ${isDelayedMaterial ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-amber-500'}`} 
                                    style={{ width: `${Math.min(100, progress)}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-right">{progress.toFixed(0)}% comprado</p>

                            <div className="mt-4 flex justify-end gap-2">
                                {/* REMOVIDO: Botão "Comprar" separado */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteMaterial(material.id); }} 
                                    className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
                                    aria-label={`Excluir material ${material.name}`}
                                >
                                    <i className="fa-solid fa-trash-alt"></i>
                                </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab Content: FINANCEIRO */}
          {activeTab === 'FINANCEIRO' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center px-2 sm:px-0">
                <h2 className="text-xl font-black text-primary dark:text-white">Controle Financeiro</h2>
                <button onClick={() => setShowAddExpenseModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Adicionar nova despesa">
                  <i className="fa-solid fa-plus-circle"></i> Nova Despesa
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedExpensesByStep.length === 0 ? (
                    <div className="col-span-full text-center text-slate-400 py-8 italic">Nenhuma despesa cadastrada ainda.</div>
                ) : (
                    groupedExpensesByStep.map(stepGroup => (
                        <React.Fragment key={stepGroup.stepName}>
                            <h3 className="col-span-full text-lg font-black text-primary dark:text-white mb-2 px-2 sm:px-0 flex items-center gap-2">
                                <span className="text-secondary text-sm">Etapa:</span> {stepGroup.stepName}
                                <span className="ml-auto text-base text-slate-500 dark:text-slate-400">Total: {formatCurrency(stepGroup.totalStepAmount)}</span>
                            </h3>
                            {stepGroup.expenses.map(expense => {
                                const total = expense.totalAgreed || expense.amount;
                                const paid = expense.paidAmount || 0;
                                const balance = total - paid;

                                let statusText = '';
                                let expenseStatusClass = '';
                                let expenseStatusBgClass = '';
                                let borderClass = 'border-slate-200 dark:border-slate-800';
                                let shadowClass = 'shadow-card-default';

                                if (paid === 0 && total === 0) { // If total is 0, it's considered concluded
                                    statusText = 'Concluído';
                                    expenseStatusClass = 'text-green-600 dark:text-green-400';
                                    expenseStatusBgClass = 'bg-green-500/10';
                                    borderClass = 'border-green-500/50 dark:border-green-700/50';
                                    shadowClass = 'shadow-lg shadow-green-500/20';
                                } else if (paid === 0 && total > 0) {
                                    statusText = 'Pendente';
                                    expenseStatusClass = 'text-slate-500 dark:text-slate-400';
                                    expenseStatusBgClass = 'bg-slate-200 dark:bg-slate-700/50';
                                } else if (paid < total) {
                                    statusText = 'Parcial';
                                    expenseStatusClass = 'text-amber-600 dark:text-amber-400';
                                    expenseStatusBgClass = 'bg-amber-500/10';
                                    borderClass = 'border-amber-500/50 dark:border-amber-700/50';
                                    shadowClass = 'shadow-lg shadow-amber-500/20';
                                } else if (paid >= total) {
                                    statusText = 'Concluído';
                                    expenseStatusClass = 'text-green-600 dark:text-green-400';
                                    expenseStatusBgClass = 'bg-green-500/10';
                                    borderClass = 'border-green-500/50 dark:border-green-700/50';
                                    shadowClass = 'shadow-lg shadow-green-500/20';
                                }
                                if (paid > total && total > 0) { // Excedeu o valor combinado, indicando prejuízo ou erro
                                    statusText = 'Prejuízo';
                                    expenseStatusClass = 'text-red-600 dark:text-red-400';
                                    expenseStatusBgClass = 'bg-red-500/10';
                                    borderClass = 'border-red-500/50 dark:border-red-700/50';
                                    shadowClass = 'shadow-lg shadow-red-500/20';
                                }

                                const progress = total > 0 ? (paid / total) * 100 : 0;

                                return (
                                    <div 
                                        key={expense.id}
                                        onClick={() => openEditExpenseModal(expense)}
                                        className={cx(surface, card, "flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:border-secondary/50", borderClass, shadowClass)}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Editar despesa ${expense.description}`}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditExpenseModal(expense); }}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-xl font-black text-primary dark:text-white leading-tight">{expense.description}</h3>
                                            <span className={cx("text-xs font-bold px-3 py-1 rounded-full", expenseStatusClass, expenseStatusBgClass)}>
                                                {statusText}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{expense.category}</p>
                                        {/* Display linked worker/supplier if available */}
                                        {expense.workerId && <p className="text-xs text-slate-500 dark:text-slate-400">Profissional: {workers.find(w => w.id === expense.workerId)?.name}</p>}
                                        {expense.supplierId && <p className="text-xs text-slate-500 dark:text-slate-400">Fornecedor: {suppliers.find(s => s.id === expense.supplierId)?.name}</p>}
                                        <div className="flex justify-between items-center text-sm font-bold mb-2">
                                            <span className="text-slate-700 dark:text-slate-300">Total: {formatCurrency(total)}</span>
                                            <span className="text-green-600 dark:text-green-400">Pago: {formatCurrency(paid)}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 text-right">Saldo a pagar: {formatCurrency(balance)}</p>
                                        
                                        {/* Progress bar for payments */}
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mt-3 mb-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                                            <div 
                                                className={`h-full rounded-full ${paid > total && total > 0 ? 'bg-red-500' : paid >= total ? 'bg-green-500' : 'bg-amber-500'}`} 
                                                style={{ width: `${Math.min(100, progress)}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 text-right">{progress.toFixed(0)}% pago</p>

                                        <div className="mt-4 flex justify-end gap-2">
                                            {expense.category !== ExpenseCategory.MATERIAL && paid < total && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenAddPaymentModal(expense); }} 
                                                    className="px-4 py-2 bg-secondary text-white text-xs font-bold rounded-xl hover:bg-secondary-dark transition-colors"
                                                    aria-label={`Registrar pagamento para ${expense.description}`}
                                                >
                                                    <i className="fa-solid fa-money-bill-wave mr-2"></i> Pagar
                                                </button>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteExpense(expense.id); }} 
                                                className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
                                                    aria-label={`Excluir despesa ${expense.description}`}
                                                >
                                                <i className="fa-solid fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))
                )}
              </div>
            </div>
          )}

          {/* Tab Content: FERRAMENTAS - RESTORED TO ORIGINAL FLAT LIST */}
          {activeTab === 'FERRAMENTAS' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-xl font-black text-primary dark:text-white px-2 sm:px-0">Ferramentas de Gestão</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button 
                  onClick={() => goToSubView('WORKERS')} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Gerenciar Profissionais"
                >
                  <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-hard-hat"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Profissionais</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Organize sua equipe.</p>
                </button>
                <button 
                  onClick={() => goToSubView('SUPPLIERS')} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Gerenciar Fornecedores"
                >
                  <div className="w-12 h-12 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-truck-fast"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Fornecedores</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Controle seus parceiros.</p>
                </button>
                <button 
                  onClick={() => goToSubView('PHOTOS')} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Ver Fotos da Obra"
                >
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-camera"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Fotos da Obra</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Acompanhe o progresso visual.</p>
                </button>
                <button 
                  onClick={() => goToSubView('PROJECTS')} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Gerenciar Projetos e Documentos"
                >
                  <div className="w-12 h-12 bg-purple-500/10 text-purple-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-file-alt"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Projetos & Docs</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Centralize seus arquivos.</p>
                </button>
                <button 
                  onClick={() => goToSubView('CHECKLIST')} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Acessar Checklists Inteligentes"
                >
                  <div className="w-12 h-12 bg-teal-500/10 text-teal-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-clipboard-check"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Checklists</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Não esqueça de nada.</p>
                </button>
                <button 
                  onClick={() => goToSubView('CONTRACTS')} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Gerador de Contratos"
                >
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-file-signature"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Contratos</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Modelos prontos e personalizáveis.</p>
                </button>
                <button 
                  onClick={() => goToSubView('CALCULATORS')} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Acessar Calculadoras"
                >
                  <div className="w-12 h-12 bg-cyan-500/10 text-cyan-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-calculator"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Calculadoras</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Calcule materiais e mais.</p>
                </button>
                <button 
                  onClick={() => goToSubView('AICHAT')} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Converse com Zé da Obra AI"
                >
                  <div className="w-12 h-12 bg-violet-500/10 text-violet-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-robot"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Zé da Obra AI</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Seu especialista sempre à mão.</p>
                </button>
                {/* NEW: AI Work Planner Button */}
                <button 
                  onClick={() => navigate(`/work/${workId}/ai-planner`)} 
                  className={cx(surface, "rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:scale-[1.02] hover:border-secondary/50")}
                  aria-label="Planejamento Inteligente com IA"
                >
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-brain"></i></div>
                  <h3 className="font-bold text-primary dark:text-white">Planejamento Inteligente AI</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">O Zé da Obra te ajuda a planejar.</p>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sub-View: WORKERS */}
      {activeSubView === 'WORKERS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2 sm:px-0">
            <h2 className="text-xl font-black text-primary dark:text-white">Profissionais da Obra</h2>
            <button onClick={() => setShowAddWorkerModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Adicionar novo profissional">
              <i className="fa-solid fa-plus-circle"></i> Novo Profissional
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workers.length === 0 ? (
              <div className="col-span-full text-center text-slate-400 py-8 italic">Nenhum profissional cadastrado ainda.</div>
            ) : (
              workers.map(worker => (
                <div key={worker.id} onClick={() => openEditWorkerModal(worker)} className={cx(surface, card, "flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:border-secondary/50")} role="button" tabIndex={0} aria-label={`Editar profissional ${worker.name}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditWorkerModal(worker); }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-black text-primary dark:text-white leading-tight">{worker.name}</h3>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-secondary/10 text-secondary">{worker.role}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Tel: {worker.phone || 'Não informado'}</p>
                  {worker.dailyRate && <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Diária: {formatCurrency(worker.dailyRate)}</p>}
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{worker.notes || 'Sem anotações.'}</p>
                  <div className="mt-4 flex justify-end">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteWorker(worker.id); }} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors" aria-label={`Excluir profissional ${worker.name}`}>
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sub-View: SUPPLIERS */}
      {activeSubView === 'SUPPLIERS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2 sm:px-0">
            <h2 className="text-xl font-black text-primary dark:text-white">Fornecedores</h2>
            <button onClick={() => setShowAddSupplierModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Adicionar novo fornecedor">
              <i className="fa-solid fa-plus-circle"></i> Novo Fornecedor
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliers.length === 0 ? (
              <div className="col-span-full text-center text-slate-400 py-8 italic">Nenhum fornecedor cadastrado ainda.</div>
            ) : (
              suppliers.map(supplier => (
                <div key={supplier.id} onClick={() => openEditSupplierModal(supplier)} className={cx(surface, card, "flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:border-secondary/50")} role="button" tabIndex={0} aria-label={`Editar fornecedor ${supplier.name}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditSupplierModal(supplier); }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-black text-primary dark:text-white leading-tight">{supplier.name}</h3>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-500/10 text-green-600">{supplier.category}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Tel: {supplier.phone || 'Não informado'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{supplier.notes || 'Sem anotações.'}</p>
                  <div className="mt-4 flex justify-end">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(supplier.id); }} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors" aria-label={`Excluir fornecedor ${supplier.name}`}>
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sub-View: PHOTOS */}
      {activeSubView === 'PHOTOS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2 sm:px-0">
            <h2 className="text-xl font-black text-primary dark:text-white">Fotos da Obra</h2>
            <button onClick={() => setShowAddPhotoModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Adicionar nova foto">
              <i className="fa-solid fa-plus-circle"></i> Nova Foto
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {photos.length === 0 ? (
              <div className="col-span-full text-center text-slate-400 py-8 italic">Nenhuma foto cadastrada ainda.</div>
            ) : (
              photos.map(photo => (
                <div key={photo.id} className={cx(surface, card, "flex flex-col")} role="figure">
                  <img src={photo.url} alt={photo.description} className="w-full h-48 object-cover rounded-xl mb-3" />
                  <h3 className="text-lg font-bold text-primary dark:text-white mb-1">{photo.description}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateDisplay(photo.date)} - {photo.type}</p>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => handleDeletePhoto(photo.id)} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors" aria-label={`Excluir foto ${photo.description}`}>
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sub-View: PROJECTS (Files) */}
      {activeSubView === 'PROJECTS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2 sm:px-0">
            <h2 className="text-xl font-black text-primary dark:text-white">Projetos & Documentos</h2>
            <button onClick={() => setShowAddFileModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Adicionar novo arquivo">
              <i className="fa-solid fa-plus-circle"></i> Novo Arquivo
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.length === 0 ? (
              <div className="col-span-full text-center text-slate-400 py-8 italic">Nenhum arquivo cadastrado ainda.</div>
            ) : (
              files.map(file => (
                <div key={file.id} className={cx(surface, card, "flex flex-col")} role="document">
                  <h3 className="text-lg font-bold text-primary dark:text-white mb-1">{file.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{file.category}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateDisplay(file.date)}</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-light transition-colors" aria-label={`Ver arquivo ${file.name}`}>
                      <i className="fa-solid fa-eye"></i>
                    </a>
                    <button onClick={() => handleDeleteFile(file.id)} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors" aria-label={`Excluir arquivo ${file.name}`}>
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sub-View: CHECKLIST */}
      {activeSubView === 'CHECKLIST' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2 sm:px-0">
            <h2 className="text-xl font-black text-primary dark:text-white">Checklists Inteligentes</h2>
            <button onClick={() => setShowAddChecklistModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Adicionar nova checklist">
              <i className="fa-solid fa-plus-circle"></i> Nova Checklist
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checklists.length === 0 ? (
              <div className="col-span-full text-center text-slate-400 py-8 italic">Nenhuma checklist cadastrada ainda.</div>
            ) : (
              checklists.map(checklist => (
                <div key={checklist.id} onClick={() => openEditChecklistModal(checklist)} className={cx(surface, card, "flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:border-secondary/50")} role="button" tabIndex={0} aria-label={`Editar checklist ${checklist.name}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditChecklistModal(checklist); }} >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-black text-primary dark:text-white leading-tight">{checklist.name}</h3>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-500/10 text-teal-600">{checklist.category}</span>
                  </div>
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    {checklist.items.slice(0, 3).map(item => (
                      <li key={item.id} className="flex items-center gap-2">
                        <input type="checkbox" checked={item.checked} readOnly className="form-checkbox h-4 w-4 text-secondary rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700" aria-label={`Item de checklist: ${item.text}`} />
                        <span className={item.checked ? 'line-through text-slate-400' : ''}>{item.text}</span>
                      </li>
                    ))}
                    {checklist.items.length > 3 && <li className="text-xs text-slate-500 italic">+ {checklist.items.length - 3} mais itens...</li>}
                  </ul>
                  <div className="mt-4 flex justify-end">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteChecklist(checklist.id); }} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors" aria-label={`Excluir checklist ${checklist.name}`}>
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sub-View: CONTRACTS */}
      {activeSubView === 'CONTRACTS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2 sm:px-0">
            <h2 className="text-xl font-black text-primary dark:text-white">Gerador de Contratos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contracts.length === 0 ? (
              <div className="col-span-full text-center text-slate-400 py-8 italic">Nenhum modelo de contrato encontrado.</div>
            ) : (
              contracts.map(contract => (
                <div key={contract.id} className={cx(surface, card, "flex flex-col")} role="article">
                  <h3 className="text-lg font-bold text-primary dark:text-white mb-1">{contract.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{contract.category}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{contract.contentTemplate.substring(0, 150)}...</p>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => alert("Funcionalidade de edição de contrato em breve!")} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-light transition-colors" aria-label={`Gerar contrato ${contract.title}`}>
                      <i className="fa-solid fa-file-pdf"></i> Gerar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sub-View: CALCULATORS */}
      {activeSubView === 'CALCULATORS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2 sm:px-0">
            <h2 className="text-xl font-black text-primary dark:text-white">Calculadoras</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cx(surface, card, "flex flex-col")} role="article">
              <h3 className="text-lg font-bold text-primary dark:text-white mb-1">Calculadora de Materiais Básicos</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Calcule cimento, areia, brita, tijolos e mais.</p>
              <div className="mt-4 flex justify-end">
                <button onClick={() => alert("Calculadora em breve!")} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-light transition-colors" aria-label="Acessar calculadora de materiais">
                  Acessar <i className="fa-solid fa-arrow-right ml-2"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sub-View: AICHAT */}
      {activeSubView === 'AICHAT' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center px-2 sm:px-0">
            <h2 className="text-xl font-black text-primary dark:text-white">Zé da Obra AI</h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mb-6">
            Converse com seu assistente inteligente para tirar dúvidas sobre sua obra.
          </p>
          <div className={cx(surface, card, "flex flex-col items-center justify-center text-center")}>
            <div className="w-12 h-12 bg-violet-500/10 text-violet-600 rounded-xl flex items-center justify-center text-xl mb-2"><i className="fa-solid fa-robot"></i></div>
            <h3 className="font-bold text-primary dark:text-white">Chat com Zé AI</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Acesse a página dedicada para o chat completo.</p>
            <button 
              onClick={() => navigate('/ai-chat')}
              className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center gap-2"
              aria-label="Ir para o Chat com Zé da Obra AI"
            >
              <i className="fa-solid fa-arrow-right"></i> Ir para o Chat
            </button>
          </div>
        </div>
      )}

      {/* Modals for Add/Edit */}

      {/* Add/Edit Step Modal */}
      {showAddStepModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={() => setShowAddStepModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">{editStepData ? 'Editar Etapa' : 'Nova Etapa'}</h2>
            <form onSubmit={editStepData ? handleEditStep : handleAddStep} className="space-y-4">
              <div>
                <label htmlFor="stepName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Etapa</label>
                <input id="stepName" type="text" value={editStepData ? editStepData.name : newStepName} onChange={(e) => editStepData ? setEditStepData({ ...editStepData, name: e.target.value }) : setNewStepName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Nome da Etapa" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="stepStartDate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data de Início</label>
                  <input id="stepStartDate" type="date" value={editStepData ? editStepData.startDate : newStepStartDate} onChange={(e) => editStepData ? setEditStepData({ ...editStepData, startDate: e.target.value }) : setNewStepStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Data de Início da Etapa" />
                </div>
                <div>
                  <label htmlFor="stepEndDate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data Final</label>
                  <input id="stepEndDate" type="date" value={editStepData ? editStepData.endDate : newStepEndDate} onChange={(e) => editStepData ? setEditStepData({ ...editStepData, endDate: e.target.value }) : setNewStepEndDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Data Final da Etapa" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-save"></i> {editStepData ? 'Salvar Alterações' : 'Adicionar Etapa'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Material Modal (now also handles purchase) */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={clearMaterialFormAndCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">{editMaterialData ? 'Editar Material' : 'Novo Material'}</h2>
            <form onSubmit={editMaterialData ? handleEditMaterial : handleAddMaterial} className="space-y-4">
              <div>
                <label htmlFor="materialName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Material</label>
                <input id="materialName" type="text" value={editMaterialData ? editMaterialData.name : newMaterialName} onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, name: e.target.value }) : setNewMaterialName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Nome do Material" />
              </div>
              <div>
                <label htmlFor="materialPlannedQty" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Quantidade Sugerida</label>
                <input id="materialPlannedQty" type="number" value={editMaterialData ? editMaterialData.plannedQty.toString() : newMaterialPlannedQty} onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, plannedQty: Number(e.target.value) }) : setNewMaterialPlannedQty(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Quantidade Sugerida" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="materialUnit" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
                  <input id="materialUnit" type="text" value={editMaterialData ? editMaterialData.unit : newMaterialUnit} onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, unit: e.target.value }) : setNewMaterialUnit(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Unidade do Material" />
                </div>
                <div>
                  <label htmlFor="materialCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                  <input id="materialCategory" type="text" value={editMaterialData ? editMaterialData.category || '' : newMaterialCategory} onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, category: e.target.value }) : setNewMaterialCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Categoria do Material" />
                </div>
              </div>
              <div>
                <label htmlFor="materialStepId" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Vincular à Etapa</label>
                <select id="materialStepId" value={editMaterialData ? editMaterialData.stepId || '' : newMaterialStepId} onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, stepId: e.target.value || '' }) : setNewMaterialStepId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Vincular material à etapa">
                    <option value="">Selecione uma etapa</option>
                    {steps.sort((a,b) => a.orderIndex - b.orderIndex).map(step => (
                      <option key={step.id} value={step.id}>{step.name}</option>
                    ))}
                  </select>
              </div>
              <button type="submit" className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-save"></i> {editMaterialData ? 'Salvar Alterações' : 'Adicionar Material'}
              </button>
            </form>
            {editMaterialData && (
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xl font-black text-primary dark:text-white mb-4">Registrar Compra</h3>
                    <form onSubmit={handleInternalRegisterPurchase} className="space-y-4">
                        <div>
                            <label htmlFor="currentPurchaseQty" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Quantidade Comprada</label>
                            <input id="currentPurchaseQty" type="number" value={currentPurchaseQty} onChange={(e) => setCurrentPurchaseQty(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Quantidade de material comprada" />
                        </div>
                        <div>
                            <label htmlFor="currentPurchaseCost" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Custo Total da Compra (R$)</label>
                            <input id="currentPurchaseCost" type="number" step="0.01" value={currentPurchaseCost} onChange={(e) => setCurrentPurchaseCost(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Custo total da compra" />
                        </div>
                        <button type="submit" className="w-full py-4 bg-secondary hover:bg-secondary-dark text-white font-bold rounded-xl shadow-lg shadow-secondary/20 transition-all flex items-center justify-center gap-2">
                            <i className="fa-solid fa-receipt"></i> Registrar Compra
                        </button>
                    </form>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={clearExpenseFormAndCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">{editExpenseData ? 'Editar Despesa' : 'Nova Despesa'}</h2>
            <form onSubmit={editExpenseData ? handleEditExpense : handleAddExpense} className="space-y-4">
              <div>
                <label htmlFor="expenseDescription" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <input id="expenseDescription" type="text" value={editExpenseData ? editExpenseData.description : newExpenseDescription} onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, description: e.target.value }) : setNewExpenseDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Descrição da despesa" />
              </div>
              <div>
                <label htmlFor="expenseAmount" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Combinado (R$)</label>
                <input id="expenseAmount" type="number" step="0.01" value={editExpenseData ? editExpenseData.amount.toString() : newExpenseAmount} onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, amount: Number(e.target.value) }) : setNewExpenseAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Valor combinado da despesa" />
              </div>
              <div>
                <label htmlFor="expenseCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                <select id="expenseCategory" value={editExpenseData ? editExpenseData.category : newExpenseCategory} onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, category: e.target.value as ExpenseCategory | string }) : setNewExpenseCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Categoria da despesa">
                  {Object.values(ExpenseCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {/* Add more custom categories if needed */}
                  <option value="Serviços Gerais">Serviços Gerais</option>
                  <option value="Equipamentos">Equipamentos</option>
                  <option value="Transporte">Transporte</option>
                </select>
              </div>
              <div>
                <label htmlFor="expenseDate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data</label>
                <input id="expenseDate" type="date" value={editExpenseData ? editExpenseData.date : newExpenseDate} onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, date: e.target.value }) : setNewExpenseDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Data da despesa" />
              </div>
              <div>
                <label htmlFor="expenseStepId" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Vincular à Etapa</label>
                <select id="expenseStepId" value={editExpenseData ? editExpenseData.stepId || '' : newExpenseStepId} onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, stepId: e.target.value || undefined }) : setNewExpenseStepId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Vincular despesa à etapa">
                    <option value="">Nenhuma etapa</option>
                    {steps.sort((a,b) => a.orderIndex - b.orderIndex).map(step => (
                      <option key={step.id} value={step.id}>{step.name}</option>
                    ))}
                  </select>
              </div>
              <div>
                <label htmlFor="expenseWorkerId" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Vincular Profissional</label>
                <select id="expenseWorkerId" value={editExpenseData ? editExpenseData.workerId || '' : newExpenseWorkerId} onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, workerId: e.target.value || undefined }) : setNewExpenseWorkerId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Vincular despesa a um profissional">
                    <option value="">Nenhum profissional</option>
                    {workers.map(worker => (
                      <option key={worker.id} value={worker.id}>{worker.name} ({worker.role})</option>
                    ))}
                  </select>
              </div>
              <div>
                <label htmlFor="expenseSupplierId" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Vincular Fornecedor</label>
                <select id="expenseSupplierId" value={editExpenseData ? editExpenseData.supplierId || '' : newExpenseSupplierId} onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, supplierId: e.target.value || undefined }) : setNewExpenseSupplierId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Vincular despesa a um fornecedor">
                    <option value="">Nenhum fornecedor</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.category})</option>
                    ))}
                  </select>
              </div>
              <button type="submit" className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-save"></i> {editExpenseData ? 'Salvar Alterações' : 'Adicionar Despesa'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPaymentModal && paymentExpenseData && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={() => setShowAddPaymentModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">Registrar Pagamento</h2>
            <p className="text-slate-700 dark:text-slate-300 mb-4">Despesa: <span className="font-bold">{paymentExpenseData.description}</span></p>
            <p className="text-slate-700 dark:text-slate-300 mb-4">Saldo a pagar: <span className="font-bold">{formatCurrency((paymentExpenseData.totalAgreed || paymentExpenseData.amount) - (paymentExpenseData.paidAmount || 0))}</span></p>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label htmlFor="paymentAmount" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Valor do Pagamento (R$)</label>
                <input id="paymentAmount" type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Valor do pagamento a ser registrado" />
              </div>
              <div>
                <label htmlFor="paymentDate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data do Pagamento</label>
                <input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setNewPaymentDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Data do pagamento" />
              </div>
              <button type="submit" className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-money-bill-transfer"></i> Registrar Pagamento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Worker Modal */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={clearWorkerFormAndCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">{editWorkerData ? 'Editar Profissional' : 'Novo Profissional'}</h2>
            <form onSubmit={editWorkerData ? handleEditWorker : handleAddWorker} className="space-y-4">
              <div>
                <label htmlFor="workerName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                <input id="workerName" type="text" value={editWorkerData ? editWorkerData.name : newWorkerName} onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, name: e.target.value }) : setNewWorkerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Nome do profissional" />
              </div>
              <div>
                <label htmlFor="workerRole" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Função</label>
                <select id="workerRole" value={editWorkerData ? editWorkerData.role : newWorkerRole} onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, role: e.target.value }) : setNewWorkerRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Função do profissional">
                  <option value="">Selecione a função</option>
                  {STANDARD_JOB_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="workerPhone" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                <input id="workerPhone" type="text" value={editWorkerData ? editWorkerData.phone : newWorkerPhone} onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, phone: e.target.value }) : setNewWorkerPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Telefone do profissional" />
              </div>
              <div>
                <label htmlFor="workerDailyRate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Diária (R$)</label>
                <input id="workerDailyRate" type="number" step="0.01" value={editWorkerData ? editWorkerData.dailyRate?.toString() || '' : newWorkerDailyRate} onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, dailyRate: Number(e.target.value) }) : setNewWorkerDailyRate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Valor da diária do profissional" />
              </div>
              <div>
                <label htmlFor="workerNotes" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Anotações</label>
                {/* Corrected typo: editExpertData -> editWorkerData */}
                <textarea id="workerNotes" value={editWorkerData ? editWorkerData.notes || '' : newWorkerNotes} onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, notes: e.target.value }) : setNewWorkerNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" rows={3} aria-label="Anotações sobre o profissional"></textarea>
              </div>
              <button type="submit" className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-save"></i> {editWorkerData ? 'Salvar Alterações' : 'Adicionar Profissional'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={clearSupplierFormAndCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">{editSupplierData ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
            <form onSubmit={editSupplierData ? handleEditSupplier : handleAddSupplier} className="space-y-4">
              <div>
                <label htmlFor="supplierName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                <input id="supplierName" type="text" value={editSupplierData ? editSupplierData.name : newSupplierName} onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, name: e.target.value }) : setNewSupplierName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Nome do fornecedor" />
              </div>
              <div>
                <label htmlFor="supplierCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                <select id="supplierCategory" value={editSupplierData ? editSupplierData.category : newSupplierCategory} onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, category: e.target.value }) : setNewSupplierCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Categoria do fornecedor">
                  <option value="">Selecione a categoria</option>
                  {STANDARD_SUPPLIER_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="supplierPhone" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                <input id="supplierPhone" type="text" value={editSupplierData ? editSupplierData.phone : newSupplierPhone} onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, phone: e.target.value }) : setNewSupplierPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Telefone do fornecedor" />
              </div>
              <div>
                <label htmlFor="supplierEmail" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                <input id="supplierEmail" type="email" value={editSupplierData ? editSupplierData.email || '' : newSupplierEmail} onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, email: e.target.value }) : setNewSupplierEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="E-mail do fornecedor" />
              </div>
              <div>
                <label htmlFor="supplierAddress" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Endereço</label>
                <input id="supplierAddress" type="text" value={editSupplierData ? editSupplierData.address || '' : newSupplierAddress} onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, address: e.target.value }) : setNewSupplierAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Endereço do fornecedor" />
              </div>
              <div>
                <label htmlFor="supplierNotes" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Anotações</label>
                <textarea id="supplierNotes" value={editSupplierData ? editSupplierData.notes || '' : newSupplierNotes} onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, notes: e.target.value }) : setNewSupplierNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" rows={3} aria-label="Anotações sobre o fornecedor"></textarea>
              </div>
              <button type="submit" className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-save"></i> {editSupplierData ? 'Salvar Alterações' : 'Adicionar Fornecedor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Photo Modal */}
      {showAddPhotoModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={() => setShowAddPhotoModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">Nova Foto da Obra</h2>
            <form onSubmit={handleAddPhoto} className="space-y-4">
              <div>
                <label htmlFor="photoDescription" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <input id="photoDescription" type="text" value={newPhotoDescription} onChange={(e) => setNewPhotoDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Descrição da foto" />
              </div>
              <div>
                <label htmlFor="photoFile" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Arquivo da Imagem</label>
                <input id="photoFile" type="file" onChange={(e) => e.target.files && setNewPhotoFile(e.target.files[0])}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark" required aria-label="Selecionar arquivo de imagem" />
              </div>
              <div>
                <label htmlFor="photoType" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                <select id="photoType" value={newPhotoType} onChange={(e) => setNewPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'PROGRESS')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Tipo de foto">
                  <option value="PROGRESS">Progresso</option>
                  <option value="BEFORE">Antes</option>
                  <option value="AFTER">Depois</option>
                </select>
              </div>
              <button type="submit" disabled={uploadingPhoto} className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                {uploadingPhoto ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                {uploadingPhoto ? 'Enviando...' : 'Adicionar Foto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add File Modal */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={() => setShowAddFileModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">Novo Arquivo / Documento</h2>
            <form onSubmit={handleAddFile} className="space-y-4">
              <div>
                <label htmlFor="fileName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Arquivo</label>
                <input id="fileName" type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Nome do arquivo" />
              </div>
              <div>
                <label htmlFor="fileCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                <select id="fileCategory" value={newFileCategory} onChange={(e) => setNewFileCategory(e.target.value as FileCategory)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" aria-label="Categoria do arquivo">
                  {Object.values(FileCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="uploadFile" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Arquivo</label>
                <input id="uploadFile" type="file" onChange={(e) => e.target.files && setNewUploadFile(e.target.files[0])}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark" required aria-label="Selecionar arquivo para upload" />
              </div>
              <button type="submit" disabled={uploadingFile} className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                {uploadingFile ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                {uploadingFile ? 'Enviando...' : 'Adicionar Arquivo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Checklist Modal */}
      {showAddChecklistModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-white/20 relative">
            <button onClick={clearChecklistFormAndCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h2 className="text-xl font-black text-primary dark:text-white mb-6">{editChecklistData ? 'Editar Checklist' : 'Nova Checklist'}</h2>
            <form onSubmit={editChecklistData ? handleEditChecklist : handleAddChecklist} className="space-y-4">
              <div>
                <label htmlFor="checklistName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Checklist</label>
                <input id="checklistName" type="text" value={editChecklistData ? editChecklistData.name : newChecklistName} onChange={(e) => editChecklistData ? setEditChecklistData({ ...editChecklistData, name: e.target.value }) : setNewChecklistName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Nome da checklist" />
              </div>
              <div>
                <label htmlFor="checklistCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria (Etapa)</label>
                <select id="checklistCategory" value={editChecklistData ? editChecklistData.category : newChecklistCategory} onChange={(e) => editChecklistData ? setEditChecklistData({ ...editChecklistData, category: e.target.value }) : setNewChecklistCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" required aria-label="Categoria da checklist (etapa)">
                  <option value="">Selecione uma categoria/etapa</option>
                  {steps.sort((a,b) => a.orderIndex - b.orderIndex).map(step => ( // Sort steps for category too
                    <option key={step.id} value={step.name}>{step.name}</option> // Use step name as category for linking
                  ))}
                  {/* Additional general categories if needed */}
                  <option value="Geral">Geral</option>
                  <option value="Segurança">Segurança</option>
                  <option value="Entrega">Entrega</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Itens da Checklist</label>
                {editChecklistData ? (
                  editChecklistData.items.map((item, index) => (
                    <div key={item.id} className="flex gap-2 mb-2">
                      <input type="text" value={item.text} onChange={(e) => setEditChecklistData(prev => prev ? ({ ...prev, items: prev.items.map(i => i.id === item.id ? { ...i, text: e.target.value } : i) }) : null)}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" placeholder="Novo item" aria-label={`Item ${index + 1} da checklist`} />
                      <button type="button" onClick={() => setEditChecklistData(prev => prev ? ({ ...prev, items: prev.items.filter(i => i.id !== item.id) }) : null)}
                        className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-700 transition-colors" aria-label={`Remover item ${index + 1}`}><i className="fa-solid fa-trash-alt"></i></button>
                    </div>
                  ))
                ) : (
                  newChecklistItems.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input type="text" value={item} onChange={(e) => setNewChecklistItems(prev => prev.map((val, idx) => idx === index ? e.target.value : val))}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all" placeholder="Novo item" aria-label={`Item ${index + 1} da checklist`} />
                      <button type="button" onClick={() => setNewChecklistItems(prev => prev.filter((_, idx) => idx !== index))}
                        className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-700 transition-colors" aria-label={`Remover item ${index + 1}`}><i className="fa-solid fa-trash-alt"></i></button>
                    </div>
                  ))
                )}
                <button type="button" onClick={() => editChecklistData ? setEditChecklistData(prev => prev ? ({ ...prev, items: [...prev.items, { id: crypto.randomUUID(), text: '', checked: false }] }) : null) : setNewChecklistItems(prev => [...prev, ''])}
                  className="w-full py-3 mt-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Adicionar outro item"><i className="fa-solid fa-plus mr-2"></i> Adicionar Item</button>
              </div>
              <button type="submit" className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-save"></i> {editChecklistData ? 'Salvar Alterações' : 'Adicionar Checklist'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ZeModal - Common for all confirmations/errors */}
      <ZeModal
        isOpen={zeModal.isOpen}
        title={zeModal.title}
        message={zeModal.message}
        confirmText={zeModal.confirmText}
        cancelText={zeModal.cancelText}
        type={zeModal.type}
        onConfirm={zeModal.onConfirm}
        onCancel={zeModal.onCancel}
        isConfirming={zeModal.isConfirming}
      />
    </div>
  );
};

export default WorkDetail;
