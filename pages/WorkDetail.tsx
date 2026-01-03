
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
// RESTORED unrequested sub-views to SubView type
type SubView = 'NONE' | 'WORKERS' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST' | 'AICHAT';
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO';

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
  // RESTORED states for workers, suppliers, photos, files, contracts, checklists
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [photos, setPhotos] = useState<WorkPhoto[]>([]);
  const [files, setFiles] = useState<WorkFile[]>([]); // CORRECTED SYNTAX: Removed extra parentheses
  const [contracts, setContracts] = useState<Contract[]>([]); // NEW: Contracts
  const [checklists, setChecklists] = useState<Checklist[]>([]); // NEW: Checklists

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('ETAPAS');
  const [activeSubView, setActiveSubView] = useState<SubView>('NONE'); 
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('CRONOGRAMA'); // NEW: For reports sub-tabs
  
  // States for Material Filter
  const [materialFilterStepId, setMaterialFilterStepId] = useState('all');

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
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false); // NEW: For partial payments
  const [paymentExpenseData, setPaymentExpenseData] = useState<Expense | null>(null); // NEW
  const [paymentAmount, setPaymentAmount] = useState(''); // NEW
  const [paymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]); // NEW - Renamed for clarity in modal, used for form

  // RESTORED states for Worker, Supplier, Photo, File, Checklist modals
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
    setMaterialFilterStepId('all'); // Reset material filter
  };

  const goToSubView = (subView: SubView) => {
    setActiveSubView(subView);
    if (subView === 'REPORTS') {
      setReportSubTab('CRONOGRAMA'); // Default to Cronograma when opening reports
    }
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
    // const stepNamesMap = new Map(steps.map(s => [s.id, s.name])); // Removed as not directly used

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
                            aiContext: `Material ${material.name} essencial para a etapa ${step.name} da obra ${work.name} está em falta. O que fazer para evitar atrasos e qual o risco?`
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
                message: `DICA: O estoque de "${material.name}" para a etapa "${step.name}" está baixo. Avalie a compra para não atrasar a obra! (${material.purchasedQty}/${material.plannedQty} ${material.unit})`,
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

      // RESTORED fetching for all data related to "Ferramentas" tab
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
      // RESTORED setting states for all additional tools data
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
      // NEW: Call dbService.addStep
      const newStep = await dbService.addStep({
        workId, name: newStepName, startDate: newStepStartDate, endDate: newStepEndDate, status: StepStatus.NOT_STARTED, isDelayed: false
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
      // NEW: Call dbService.updateStep
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
      message: 'Tem certeza que deseja excluir esta etapa e todos os materiais associados? Despesas financeiras devem ser excluídas separadamente.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => { // Wrap with async function
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          // NEW: Call dbService.deleteStep
          await dbService.deleteStep(stepId, workId);
          await loadWorkData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          // FIX: Use a state updater or reference the current `zeModal` state to set the new state
          // to correctly close the error modal after user clicks "Entendido".
          setZeModal(currentZeModalState => ({ 
            ...currentZeModalState, 
            isOpen: true, // Ensure modal stays open for error message
            title: 'Erro!',
            message: `Erro ao excluir: ${error.message}`, 
            confirmText: 'Entendido', 
            // On confirm of this error modal, *then* close it
            onConfirm: async () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })),
            onCancel: () => setZeModal(modalStateToClose => ({ ...modalStateToClose, isOpen: false })), // Also close on cancel for error
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

  // NEW: Function to toggle step status from the card
  const handleToggleStepStatus = useCallback(async (step: Step) => {
    let nextStatus: StepStatus;
    if (step.status === StepStatus.NOT_STARTED) {
        nextStatus = StepStatus.IN_PROGRESS;
    } else if (step.status === StepStatus.IN_PROGRESS) {
        nextStatus = StepStatus.COMPLETED;
    } else { // Currently COMPLETED, toggle back to NOT_STARTED
        nextStatus = StepStatus.NOT_STARTED;
    }

    try {
        // NEW: Call dbService.updateStep
        const updatedStep = await dbService.updateStep({ ...step, status: nextStatus });
        if (updatedStep) {
            await loadWorkData(); // Reload all data to ensure consistency and trigger Ze suggestions
            if (updatedStep.status === StepStatus.COMPLETED) {
                handleStepCompletion(updatedStep); // Trigger Zé's next step suggestion
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


  // MATERIALS
  const clearMaterialFormAndCloseModal = () => {
    setShowAddMaterialModal(false);
    setEditMaterialData(null);
    setNewMaterialName('');
    setNewMaterialPlannedQty('');
    setNewMaterialUnit('');
    setNewMaterialCategory('');
    setNewMaterialStepId('');
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
      // NEW: Call dbService.addMaterial
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
      // NEW: Call dbService.updateMaterial
      const updatedMaterial = await dbService.updateMaterial(editMaterialData);
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
      message: 'Tem certeza que deseja excluir este material? Isso não é possível se houver lançamentos financeiros associados a ele.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => {
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          // NEW: Call dbService.deleteMaterial
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
    setNewMaterialCategory(material.category || '');
    setNewMaterialStepId(material.stepId || '');
    setShowAddMaterialModal(true);
  };

  const handleRegisterPurchase = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!purchaseMaterialId || !workId || !user?.id) return;

    const currentMaterial = materials.find(m => m.id === purchaseMaterialId);
    if (!currentMaterial) return;

    const newErrors: Record<string, string> = {};
    if (!purchaseQty || Number(purchaseQty) <= 0) newErrors.purchaseQty = "A quantidade comprada deve ser maior que zero.";
    if (!purchaseCost || Number(purchaseCost) <= 0) newErrors.purchaseCost = "O custo da compra deve ser maior que zero.";
    
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
      // NEW: Call dbService.registerMaterialPurchase
      await dbService.registerMaterialPurchase(
        purchaseMaterialId,
        currentMaterial.name,
        currentMaterial.brand,
        currentMaterial.plannedQty,
        currentMaterial.unit,
        Number(purchaseQty),
        Number(purchaseCost)
      );
      await loadWorkData();
      setShowPurchaseMaterialModal(false);
      setPurchaseQty('');
      setPurchaseCost('');
      setPurchaseMaterialId(null);
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
    setNewExpenseDate(new Date().toISOString().split('T')[0]); // Ensure date is reset correctly
    setNewExpenseStepId('');
  };

  const handleAddExpense = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workId || !user?.id) return;

    const newErrors: Record<string, string> = {};
    if (!newExpenseDescription.trim()) newErrors.newExpenseDescription = "A descrição é obrigatória.";
    if (!newExpenseAmount || Number(newExpenseAmount) <= 0) newErrors.newExpenseAmount = "O valor deve ser maior que zero.";
    if (!newExpenseDate) newErrors.newExpenseDate = "A data é obrigatória.";
    // NEW: Validação para etapa em caso de categoria Material
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
      // NEW: Call dbService.addExpense
      const newExpense = await dbService.addExpense({
        workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount),
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId || undefined,
        paidAmount: newExpenseCategory !== ExpenseCategory.MATERIAL ? Number(newExpenseAmount) : 0, // Assume pago integral se não for material
        totalAgreed: Number(newExpenseAmount)
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
    if (!editExpenseData.amount || Number(editExpenseData.amount) <= 0) newErrors.amount = "O valor total deve ser maior que zero.";
    if (!editExpenseData.date) newErrors.date = "A data é obrigatória.";
    // NEW: Validação para etapa em caso de categoria Material
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
      // NEW: Call dbService.updateExpense
      const updatedExpense = await dbService.updateExpense(editExpenseData);
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
      message: 'Tem certeza que deseja excluir esta despesa? Isso não é possível se for um lançamento automático de material.',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => {
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        try {
          // NEW: Call dbService.deleteExpense
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
    setShowAddExpenseModal(true);
  };

  // NEW: Handle Add Payment
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
      // NEW: Call dbService.addPaymentToExpense
      await dbService.addPaymentToExpense(paymentExpenseData.id, Number(paymentAmount), paymentDate);
      await loadWorkData();
      setShowAddPaymentModal(false);
      setPaymentAmount('');
      setNewPaymentDate(new Date().toISOString().split('T')[0]); // Reset date after payment
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
    setPaymentAmount(''); // Reset amount for new payment
    setNewPaymentDate(new Date().toISOString().split('T')[0]); // Current date
    setShowAddPaymentModal(true);
  };

  // RESTORED Worker, Supplier, Photo, File, Checklist handlers and modals
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
      // NEW: Call dbService.addWorker
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
      // NEW: Call dbService.updateWorker
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
                // NEW: Call dbService.deleteWorker
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
      // NEW: Call dbService.addSupplier
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
      // NEW: Call dbService.updateSupplier
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
                // NEW: Call dbService.deleteSupplier
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

    // TODO: Implement actual image upload to storage (e.g., Supabase Storage)
    // For now, simulate upload and use a placeholder URL.
    setUploadingPhoto(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate upload delay
      const mockPhotoUrl = "https://via.placeholder.com/600x400?text=Obra+Photo";

      // NEW: Call dbService.addPhoto
      const newPhoto = await dbService.addPhoto({
        workId, url: mockPhotoUrl, description: newPhotoDescription, date: new Date().toISOString().split('T')[0], type: newPhotoType
      });
      if (newPhoto) {
        await loadWorkData();
        setShowAddPhotoModal(false);
        setNewPhotoDescription('');
        setNewPhotoFile(null);
      }
    } catch (error) { console.error("Erro ao adicionar foto:", error);
    } finally { setUploadingPhoto(false); }
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
                // NEW: Call dbService.deletePhoto
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

    // TODO: Implement actual file upload to storage (e.g., Supabase Storage)
    // For now, simulate upload and use a placeholder URL.
    setUploadingFile(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate upload delay
      const mockFileUrl = "https://via.placeholder.com/600x400?text=Documento+Obra"; // Placeholder

      // NEW: Call dbService.addFile
      const newFile = await dbService.addFile({
        workId, name: newFileName, category: newFileCategory, url: mockFileUrl, type: newUploadFile.type, date: new Date().toISOString().split('T')[0]
      });
      if (newFile) {
        await loadWorkData();
        setShowAddFileModal(false);
        setNewFileName('');
        setNewUploadFile(null);
      }
    } catch (error) { console.error("Erro ao adicionar arquivo:", error);
    } finally { setUploadingFile(false); }
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
                // NEW: Call dbService.deleteFile
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
      // NEW: Call dbService.addChecklist
      const newChecklist = await dbService.addChecklist(checklistToSave); // Mocked service
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
      // NEW: Call dbService.updateChecklist
      const updatedChecklist = await dbService.updateChecklist(checklistToUpdate); // Mocked service
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
                // NEW: Call dbService.deleteChecklist
                await dbService.deleteChecklist(checklistId); // Mocked service
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


  // --- EXPORT FUNCTIONS (REPORTS) ---
  // These functions depend on workers and suppliers lists which are now loaded.
  const handleExportToExcel = (reportType: ReportSubTab) => {
    if (!work) return;

    let ws_data: any[][] = [];
    let ws_name = "";
    let filename = "";

    if (reportType === 'CRONOGRAMA') {
      ws_name = "Cronograma";
      filename = `Cronograma-${work.name}.xlsx`;
      ws_data = [
        ["Número", "Etapa", "Data Início", "Data Fim", "Status", "Atrasada?"],
        ...steps.map((step, index) => [
          index + 1,
          step.name,
          step.startDate,
          step.endDate,
          // NEW: Use text representation of status
          new Date(step.endDate) < new Date() && step.status !== StepStatus.COMPLETED ? 'Atrasada' : (step.status === StepStatus.COMPLETED ? 'Concluída' : (step.status === StepStatus.IN_PROGRESS ? 'Em Andamento' : 'Pendente')),
          new Date(step.endDate) < new Date() && step.status !== StepStatus.COMPLETED ? 'Sim' : 'Não' // Corrected isDelayed logic
        ])
      ];
    } else if (reportType === 'MATERIAIS') {
      ws_name = "Materiais";
      filename = `Materiais-${work.name}.xlsx`;
      ws_data = [
        ["Etapa", "Nome Material", "Unidade", "Planejado", "Comprado", "Status", "Categoria"],
        ...groupedMaterials.flatMap(group => 
          group.materials.map(material => {
            // isMissing logic for report (same as above for consistency)
            const linkedStep = steps.find(s => s.id === material.stepId);
            const stepStartDate = linkedStep ? new Date(linkedStep.startDate) : new Date(0);
            stepStartDate.setHours(0,0,0,0);
            const today = new Date();
            today.setHours(0,0,0,0);
            const threeDaysFromNow = new Date(today);
            threeDaysFromNow.setDate(today.getDate() + 3);

            const isStepRelevantForMissing = (stepStartDate >= today && stepStartDate <= threeDaysFromNow) || (stepStartDate < today && linkedStep?.status !== StepStatus.COMPLETED);

            const isMissing = material.plannedQty > 0 && material.purchasedQty < material.plannedQty && isStepRelevantForMissing;
            const isPartial = material.purchasedQty > 0 && material.purchasedQty < material.plannedQty && !isMissing; // Partial, but not critical missing
            const isCompleted = material.purchasedQty >= material.plannedQty;
            
            let statusText = 'Pendente';

            if (isMissing) { statusText = 'FALTANDO!'; }
            else if (isCompleted) { statusText = 'Concluído'; }
            else if (isPartial) { statusText = 'Parcial'; }

            return [
              group.stepName,
              material.name,
              material.unit,
              material.plannedQty,
              material.purchasedQty,
              statusText,
              material.category
            ];
          })
        )
      ];
    } else if (reportType === 'FINANCEIRO') {
      ws_name = "Financeiro";
      filename = `Financeiro-${work.name}.xlsx`;
      ws_data = [
        ["Data", "Descrição", "Categoria", "Valor Total", "Valor Pago", "Saldo a Pagar", "Status", "Etapa", "Profissional/Fornecedor"],
        ...expenses.map(expense => {
          const total = expense.totalAgreed || expense.amount;
          const paid = expense.paidAmount || 0;
          const balance = total - paid;
          let statusText = '';
          if (paid === 0) statusText = 'Pendente';
          else if (paid < total) statusText = 'Parcial';
          else if (paid >= total) statusText = 'Concluído';
          if (paid > total) statusText = 'Prejuízo';

          const stepName = steps.find(s => s.id === expense.stepId)?.name || '';
          // Using actual loaded workers and suppliers
          const workerOrSupplier = workers.find(w => w.id === expense.workerId)?.name || suppliers.find(s => s.id === expense.supplierId)?.name || '';

          return [
            expense.date,
            expense.description,
            expense.category,
            expense.amount,
            paid,
            balance,
            statusText,
            stepName,
            workerOrSupplier
          ];
        })
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ws_name);
    XLSX.writeFile(wb, filename);
  };


  // If AuthContext is still loading OR work data is loading, show a simple spinner.
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    );
  }

  // If no work is loaded (e.g., direct access to /work/:id with invalid ID or before data is fetched)
  if (!work) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] text-red-500">
        <p className="text-xl font-bold">Obra não encontrada ou você não tem permissão para acessá-la.</p>
      </div>
    );
  }

  // Calculate stats for reports dashboard
  const totalBudget = work.budgetPlanned;
  const totalSpent = expenses.reduce((sum, exp) => sum + (exp.paidAmount || 0), 0);
  const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const balance = totalBudget - totalSpent;
  // const pendingToPay = totalAmount - totalSpent; // Removed as not directly used in KPI

  // KPIs for Report Cronograma
  const totalStepsCount = steps.length;
  const completedStepsCount = steps.filter(s => s.status === StepStatus.COMPLETED).length;
  const inProgressStepsCount = steps.filter(s => s.status === StepStatus.IN_PROGRESS).length;
  const todayDateString = new Date().toISOString().split('T')[0];
  const delayedStepsCount = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < todayDateString).length;
  // This needs to be 'not started AND not delayed'
  const notStartedStepsCount = steps.filter(s => s.status === StepStatus.NOT_STARTED && new Date(s.endDate) >= new Date(todayDateString)).length;

  // KPIs for Report Materiais
  // const materialsTotal = materials.length; // Removed as not directly used in KPI
  const materialsMissing = materials.filter(m => {
    const linkedStep = steps.find(s => s.id === m.stepId);
    if (!linkedStep) return false; // Must be linked to a step
    const stepStartDate = new Date(linkedStep.startDate);
    stepStartDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    const isUpcomingOrActive = (stepStartDate >= today && stepStartDate <= threeDaysFromNow) || (stepStartDate <= today && linkedStep.status !== StepStatus.COMPLETED);

    return m.purchasedQty < m.plannedQty && isUpcomingOrActive;
  }).length;
  const materialsPartial = materials.filter(m => m.purchasedQty > 0 && m.purchasedQty < m.plannedQty).length;
  const materialsCompleted = materials.filter(m => m.purchasedQty >= m.plannedQty).length;


  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans">
      {/* Active Zé da Obra Suggestion Card */}
      {activeZeSuggestion && (
        <ZeAssistantCard
          suggestion={activeZeSuggestion}
          onDismiss={markSuggestionAsSeen}
          onAction={(callback) => {
            if (callback) callback();
            markSuggestionAsSeen(activeZeSuggestion.tag); // Dismiss after action
          }}
          onGenerateAiMessage={generateAiMessageForSuggestion}
          loadingAi={loadingAiMessage}
        />
      )}

      {/* Header with Work Name and Back Button */}
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button
          onClick={() => {
            if (activeSubView !== 'NONE') {
              setActiveSubView('NONE'); // Go back from sub-view to main tabs
            } else {
              navigate('/'); // Go back to dashboard from main tabs
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
          {/* Main Tabs Navigation */}
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
                  steps.map((step, index) => {
                    const today = new Date().toISOString().split('T')[0];
                    const isDelayed = new Date(step.endDate) < new Date(today) && step.status !== StepStatus.COMPLETED;
                    let stepStatusClass = '';
                    let stepStatusBgClass = '';
                    let statusText = '';
                    let borderClass = 'border-slate-200 dark:border-slate-800';
                    let shadowClass = 'shadow-card-default';

                    if (isDelayed) {
                      stepStatusClass = 'text-red-600 dark:text-red-400';
                      stepStatusBgClass = 'bg-red-500/10';
                      statusText = 'Atrasada';
                      borderClass = 'border-red-500/50 dark:border-red-700/50';
                      shadowClass = 'shadow-lg shadow-red-500/20';
                    } else if (step.status === StepStatus.COMPLETED) {
                      stepStatusClass = 'text-green-600 dark:text-green-400';
                      stepStatusBgClass = 'bg-green-500/10';
                      statusText = 'Concluída';
                      borderClass = 'border-green-500/50 dark:border-green-700/50';
                      shadowClass = 'shadow-lg shadow-green-500/20';
                    } else if (step.status === StepStatus.IN_PROGRESS) {
                      stepStatusClass = 'text-amber-600 dark:text-amber-400'; // Laranja para Em Andamento
                      stepStatusBgClass = 'bg-amber-500/10';
                      statusText = 'Em Andamento';
                      borderClass = 'border-amber-500/50 dark:border-amber-700/50';
                      shadowClass = 'shadow-lg shadow-amber-500/20';
                    } else { // NOT_STARTED (Pendente)
                      stepStatusClass = 'text-slate-500 dark:text-slate-400';
                      stepStatusBgClass = 'bg-slate-200 dark:bg-slate-700/50'; // Cinza para Pendente
                      statusText = 'Pendente';
                    }

                    return (
                      <div 
                        key={step.id} 
                        // Clicking anywhere on the card opens edit modal, but status button has its own action
                        onClick={() => openEditStepModal(step)}
                        className={cx(surface, card, "flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:border-secondary/50", borderClass, shadowClass)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Editar etapa ${step.name}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditStepModal(step); }}
                      >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Etapa {index + 1}</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleStepStatus(step); }}
                                className={cx("text-xs font-bold px-3 py-1 rounded-full hover:brightness-90 active:scale-95 transition-all", stepStatusClass, stepStatusBgClass)}
                                aria-label={`Alterar status da etapa ${step.name}. Status atual: ${statusText}`}
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
                  {steps.map(step => (
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
                        <span className="text-secondary text-sm">Etapa {steps.findIndex(s => s.id === stepGroup.stepId) + 1}:</span> {stepGroup.stepName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stepGroup.materials.map(material => {
                        // isMissing logic: (purchasedQty < plannedQty) AND (step starts in <= 3 days OR step already started and not completed)
                        const linkedStep = steps.find(s => s.id === material.stepId);
                        const stepStartDate = linkedStep ? new Date(linkedStep.startDate) : new Date(0); // Default to past if no step
                        stepStartDate.setHours(0,0,0,0);
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const threeDaysFromNow = new Date(today);
                        threeDaysFromNow.setDate(today.getDate() + 3);

                        const isStepRelevantForMissing = (stepStartDate >= today && stepStartDate <= threeDaysFromNow) || (stepStartDate < today && linkedStep?.status !== StepStatus.COMPLETED);

                        const isMissing = material.plannedQty > 0 && material.purchasedQty < material.plannedQty && isStepRelevantForMissing;
                        const isPartial = material.purchasedQty > 0 && material.purchasedQty < material.plannedQty && !isMissing; // Partial, but not critical missing
                        const isCompleted = material.purchasedQty >= material.plannedQty;
                        const progress = (material.plannedQty > 0) ? (material.purchasedQty / material.plannedQty) * 100 : 0;
                        
                        let materialStatusClass = '';
                        let materialStatusBgClass = '';
                        let statusText = '';
                        let borderClass = 'border-slate-200 dark:border-slate-800';
                        let shadowClass = 'shadow-card-default';

                        if (isMissing) {
                            materialStatusClass = 'text-red-600 dark:text-red-400';
                            materialStatusBgClass = 'bg-red-500/10';
                            statusText = 'FALTANDO!';
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
                        } else { // Pendente (0 purchased)
                            materialStatusClass = 'text-slate-500 dark:text-slate-400';
                            materialStatusBgClass = 'bg-slate-200 dark:bg-slate-700/50'; // Cinza para Pendente
                            statusText = 'Pendente';
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
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Planejado: <span className="text-primary dark:text-white">{material.plannedQty} {material.unit}</span></p>
                                <p className="text-sm font-black text-green-600 dark:text-green-400 flex items-center gap-2">
                                    <i className="fa-solid fa-check-double"></i>
                                    Comprado: {material.purchasedQty} de {material.plannedQty} {material.unit}
                                </p>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                                <div 
                                    className={`h-full rounded-full ${isMissing ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-amber-500'}`} 
                                    style={{ width: `${Math.min(100, progress)}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-right">{progress.toFixed(0)}% comprado</p>

                            <div className="mt-4 flex justify-end gap-2">
                                {(material.purchasedQty < material.plannedQty) && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setPurchaseMaterialId(material.id); setShowPurchaseMaterialModal(true); }} 
                                        className="px-4 py-2 bg-secondary text-white text-xs font-bold rounded-xl hover:bg-secondary-dark transition-colors"
                                        aria-label={`Registrar compra para ${material.name}`}
                                    >
                                        <i className="fa-solid fa-cart-shopping mr-2"></i> Comprar
                                    </button>
                                )}
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

                                if (paid === 0) {
                                    statusText = 'Pendente';
                                    expenseStatusClass = 'text-slate-500 dark:text-slate-400';
                                    expenseStatusBgClass = 'bg-slate-200 dark:bg-slate-700/50'; // Cinza para Pendente
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
                                if (paid > total) { // Excedeu o valor combinado, indicando prejuízo ou erro
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
                                        <div className="flex justify-between items-center text-sm font-bold mb-2">
                                            <span className="text-slate-700 dark:text-slate-300">Total: {formatCurrency(expense.amount)}</span>
                                            <span className="text-green-600 dark:text-green-400">Pago: {formatCurrency(paid)}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 text-right">Saldo a pagar: {formatCurrency(balance)}</p>
                                        
                                        {/* Progress bar for payments */}
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mt-3 mb-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                                            <div 
                                                className={`h-full rounded-full ${paid > total ? 'bg-red-500' : paid >= total ? 'bg-green-500' : 'bg-amber-500'}`} 
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
