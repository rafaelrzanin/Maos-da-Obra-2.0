import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts';
import { 
  StepStatus, 
  FileCategory, 
  ExpenseCategory, 
  ExpenseStatus, 
  type Work, 
  type Worker, 
  type Supplier, 
  type Material, 
  type Step, 
  type Expense, 
  type WorkPhoto, 
  type WorkFile, 
  type Contract, 
  type Checklist, 
  PlanType 
} from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES } from '../services/standards.ts';
import { ZeModal, type ZeModalProps } from '../components/ZeModal.tsx';

// --- TYPES FOR VIEW STATE ---
export type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
type SubView = 'NONE' | 'WORKERS' | 'SUPPLIERS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST' | 'AICHAT' | 'REPORTS' | 'AIPLANNER';

interface ExpenseStepGroup {
    stepName: string;
    expenses: Expense[];
    totalStepAmount: number;
}

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

const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return '--/--';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
        return dateStr;
    }
};

const formatCurrency = (value: number | string | undefined): string => {
    const amount = Number(value || 0);
    return amount.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
};

interface StatusDetails {
    statusText: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    shadowClass: string;
    icon: string;
}

const getEntityStatusDetails = (
    entityType: 'step' | 'material' | 'expense',
    entity: Step | Material | Expense,
    allSteps: Step[]
): StatusDetails => {
    let statusText = 'Pendente';
    let bgColor = 'bg-slate-400';
    let textColor = 'text-slate-700';
    let borderColor = 'border-slate-200';
    let shadowClass = 'shadow-slate-400/20';
    let icon = 'fa-hourglass-start';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (entityType === 'step') {
        const step = entity as Step;
        switch (step.status) {
            case StepStatus.COMPLETED:
                statusText = 'Concluído'; bgColor = 'bg-green-500'; textColor = 'text-green-600'; borderColor = 'border-green-400'; icon = 'fa-check';
                break;
            case StepStatus.IN_PROGRESS:
                statusText = 'Em Andamento'; bgColor = 'bg-amber-500'; textColor = 'text-amber-600'; borderColor = 'border-amber-400'; icon = 'fa-hourglass-half';
                break;
            case StepStatus.DELAYED:
                statusText = 'Atrasado'; bgColor = 'bg-red-500'; textColor = 'text-red-600'; borderColor = 'border-red-400'; icon = 'fa-exclamation-triangle';
                break;
        }
    } else if (entityType === 'material') {
        const material = entity as Material;
        const progress = material.plannedQty > 0 ? (material.purchasedQty / material.plannedQty) : 0;
        if (progress >= 1) {
            statusText = 'Concluído'; bgColor = 'bg-green-500'; icon = 'fa-check';
        } else if (progress > 0) {
            statusText = 'Parcial'; bgColor = 'bg-amber-500'; icon = 'fa-hourglass-half';
        }
    } else if (entityType === 'expense') {
        const expense = entity as Expense;
        switch (expense.status) {
            case ExpenseStatus.COMPLETED:
                statusText = 'Pago'; bgColor = 'bg-green-500'; icon = 'fa-check';
                break;
            case ExpenseStatus.PARTIAL:
                statusText = 'Parcial'; bgColor = 'bg-amber-500'; icon = 'fa-hourglass-half';
                break;
            case ExpenseStatus.OVERPAID:
                statusText = 'Prejuízo'; bgColor = 'bg-red-600'; icon = 'fa-sack-xmark';
                break;
        }
    }

    return { statusText, bgColor, textColor, borderColor, shadowClass, icon };
};

// --- COMPONENTES AUXILIARES ---

const ToolCard: React.FC<any> = ({ icon, title, description, onClick, isLocked, requiresVitalicio }) => (
    <button
        onClick={onClick}
        disabled={isLocked}
        className={cx(surface, "p-5 rounded-2xl flex flex-col items-center text-center gap-3 relative group", isLocked && "opacity-60 cursor-not-allowed")}
    >
        {isLocked && (
            <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center z-10">
                <i className="fa-solid fa-lock text-white text-2xl"></i>
            </div>
        )}
        <div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xl shrink-0">
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <h3 className="font-bold text-primary dark:text-white leading-tight">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        {requiresVitalicio && (
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-auto">
                <i className="fa-solid fa-crown mr-1"></i> Acesso Vitalício
            </span>
        )}
    </button>
);

const ToolSubViewHeader: React.FC<any> = ({ title, onBack, onAdd }) => (
    <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-primary transition-colors p-2 -ml-2">
                <i className="fa-solid fa-arrow-left text-xl"></i>
            </button>
            <h2 className="text-2xl font-black text-primary dark:text-white">{title}</h2>
        </div>
        {onAdd && (
            <button onClick={onAdd} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl flex items-center gap-2">
                <i className="fa-solid fa-plus"></i> Novo
            </button>
        )}
    </div>
);

// --- COMPONENTE PRINCIPAL ---

export interface WorkDetailProps { activeTab: MainTab; onTabChange: (tab: MainTab) => void; }

const WorkDetail: React.FC<WorkDetailProps> = ({ activeTab, onTabChange }) => {
    const { id: workId } = ReactRouter.useParams<{ id: string }>();
    const navigate = ReactRouter.useNavigate();
    const { user, authLoading, isUserAuthFinished, trialDaysRemaining } = useAuth();
    const [searchParams] = ReactRouter.useSearchParams();

    const isVitalicio = user?.plan === PlanType.VITALICIO;
    const hasAiAccess = isVitalicio || (user?.isTrial && (trialDaysRemaining ?? 0) > 0);

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
    const [activeSubView, setActiveSubView] = useState<SubView>('NONE');
    const [materialFilterStepId, setMaterialFilterStepId] = useState('all');

    // Modal States
    const [showAddStepModal, setShowAddStepModal] = useState(false);
    const [newStepName, setNewStepName] = useState('');
    const [newStepStartDate, setNewStepStartDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
    const [newStepEndDate, setNewStepEndDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
    const [newEstimatedDurationDays, setNewEstimatedDurationDays] = useState('');
    const [editStepData, setEditStepData] = useState<Step | null>(null);
    const [isUpdatingStepStatus, setIsUpdatingStepStatus] = useState(false);
    const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
    const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

    const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
    const [newMaterialName, setNewMaterialName] = useState('');
    const [newMaterialBrand, setNewMaterialBrand] = useState('');
    const [newMaterialPlannedQty, setNewMaterialPlannedQty] = useState('');
    const [newMaterialUnit, setNewMaterialUnit] = useState('');
    const [newMaterialCategory, setNewMaterialCategory] = useState('');
    const [newMaterialStepId, setNewMaterialStepId] = useState('');
    const [editMaterialData, setEditMaterialData] = useState<Material | null>(null);
    const [purchaseQtyInput, setPurchaseQtyInput] = useState('');
    const [purchaseCostInput, setPurchaseCostInput] = useState('');

    const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
    const [newExpenseDescription, setNewExpenseDescription] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory | string>(ExpenseCategory.OTHER);
    const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
    const [newExpenseStepId, setNewExpenseStepId] = useState('');
    const [newExpenseWorkerId, setNewExpenseWorkerId] = useState('');
    const [newExpenseSupplierId, setNewExpenseSupplierId] = useState('');
    const [newExpenseTotalAgreed, setNewExpenseTotalAgreed] = useState('');
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
    const [uploadingPhoto, setLoadingPhoto] = useState(false);

    const [showAddFileModal, setShowAddFileModal] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [newFileCategory, setNewFileCategory] = useState<FileCategory>(FileCategory.GENERAL);
    const [newUploadFile, setNewUploadFile] = useState<File | null>(null);
    const [loadingFile, setLoadingFile] = useState(false);

    const [showAddChecklistModal, setShowAddChecklistModal] = useState(false);
    const [newChecklistName, setNewChecklistName] = useState('');
    const [newChecklistCategory, setNewChecklistCategory] = useState('');
    const [newChecklistItems, setNewChecklistItems] = useState<string[]>(['']);
    const [editChecklistData, setEditChecklistData] = useState<Checklist | null>(null);

    const [showContractContentModal, setShowContractContentModal] = useState(false);
    const [selectedContractContent, setSelectedContractContent] = useState('');
    const [selectedContractTitle, setSelectedContractTitle] = useState('');
    const [copyContractSuccess, setCopyContractSuccess] = useState(false);

    const [zeModal, setZeModal] = useState<ZeModalProps & { isOpen: boolean }>({
        isOpen: false, title: '', message: '', onCancel: () => { }
    });

    // --- LOGICA DE DADOS ---

    const goToTab = useCallback((tab: MainTab) => {
        onTabChange(tab);
        setActiveSubView('NONE');
        navigate(`/work/${workId}?tab=${tab}`, { replace: true });
    }, [workId, navigate, onTabChange]);

    const goToSubView = useCallback((subView: SubView) => setActiveSubView(subView), []);

    const calculateTotalExpenses = useMemo(() => {
        return expenses.filter(e => e.category !== ExpenseCategory.MATERIAL).reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    }, [expenses]);

    const totalOutstandingExpenses = useMemo(() => {
        return expenses.reduce((sum, e) => {
            const agreed = e.totalAgreed || e.amount;
            return sum + Math.max(0, agreed - (e.paidAmount || 0));
        }, 0);
    }, [expenses]);

    const groupedMaterials = useMemo<MaterialStepGroup[]>(() => {
        const filtered = materialFilterStepId === 'all' ? materials : materials.filter(m => m.stepId === materialFilterStepId);
        const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
        return sortedSteps.map(step => ({
            stepName: `${step.orderIndex}. ${step.name}`,
            stepId: step.id,
            materials: filtered.filter(m => m.stepId === step.id)
        })).filter(g => g.materials.length > 0);
    }, [materials, steps, materialFilterStepId]);

    const groupedExpensesByStep = useMemo<ExpenseStepGroup[]>(() => {
        const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
        const groups = sortedSteps.map(step => ({
            stepName: `${step.orderIndex}. ${step.name}`,
            expenses: expenses.filter(e => e.stepId === step.id),
            totalStepAmount: expenses.filter(e => e.stepId === step.id).reduce((sum, e) => sum + e.amount, 0)
        }));
        const noStep = expenses.filter(e => !e.stepId);
        if (noStep.length > 0) {
            groups.push({ stepName: 'Sem Etapa', expenses: noStep, totalStepAmount: noStep.reduce((sum, e) => sum + e.amount, 0) });
        }
        return groups.filter(g => g.expenses.length > 0);
    }, [expenses, steps]);

    const loadWorkData = useCallback(async () => {
        if (!workId || !user?.id) return;
        setLoading(true);
        try {
            const fetchedWork = await dbService.getWorkById(workId);
            if (!fetchedWork) { navigate('/'); return; }
            setWork(fetchedWork);
            const [s, e, w, sup, p, f, c, ch] = await Promise.all([
                dbService.getSteps(workId), dbService.getExpenses(workId),
                dbService.getWorkers(workId), dbService.getSuppliers(workId),
                dbService.getPhotos(workId), dbService.getFiles(workId),
                dbService.getContractTemplates(), dbService.getChecklists(workId)
            ]);
            setSteps(s); setExpenses(e); setWorkers(w); setSuppliers(sup); setPhotos(p); setFiles(f); setContracts(c); setChecklists(ch);
            const m = await dbService.getMaterials(workId);
            setMaterials(m);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [workId, user, navigate]);

    useEffect(() => {
        if (!authLoading && isUserAuthFinished) loadWorkData();
    }, [authLoading, isUserAuthFinished, loadWorkData]);

    // --- HANDLERS ---

    const handleStepStatusChange = async (step: Step) => {
        if (isUpdatingStepStatus) return;
        setIsUpdatingStepStatus(true);
        const newRealDate = step.status === StepStatus.COMPLETED ? null : new Date().toISOString().split('T')[0];
        try {
            await dbService.updateStep({ ...step, realDate: newRealDate });
            await loadWorkData();
        } catch (e) {
            console.error(e);
        } finally {
            setIsUpdatingStepStatus(false);
        }
    };

    const handleAddStep = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.addStep({ workId: workId!, name: newStepName, startDate: newStepStartDate, endDate: newStepEndDate, realDate: null });
            setShowAddStepModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleEditStep = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.updateStep({ ...editStepData!, name: newStepName, startDate: newStepStartDate, endDate: newStepEndDate });
            setEditStepData(null); setShowAddStepModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleDeleteStep = async (id: string) => {
        try { await dbService.deleteStep(id, workId!); loadWorkData(); } catch (err) { console.error(err); }
    };

    const handleAddMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.addMaterial(user!.id, { workId: workId!, name: newMaterialName, brand: newMaterialBrand, plannedQty: Number(newMaterialPlannedQty), purchasedQty: 0, unit: newMaterialUnit, category: newMaterialCategory, stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId });
            setShowAddMaterialModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleEditMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.updateMaterial({ ...editMaterialData!, name: newMaterialName, brand: newMaterialBrand, plannedQty: Number(newMaterialPlannedQty), unit: newMaterialUnit, category: newMaterialCategory, stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId });
            if (Number(purchaseQtyInput) > 0) {
                await dbService.registerMaterialPurchase(editMaterialData!.id, newMaterialName, newMaterialBrand, Number(newMaterialPlannedQty), newMaterialUnit, Number(purchaseQtyInput), Number(purchaseCostInput));
            }
            setEditMaterialData(null); setShowAddMaterialModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleDeleteMaterial = async (id: string) => {
        try { await dbService.deleteMaterial(id); loadWorkData(); } catch (err) { console.error(err); }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.addExpense({ workId: workId!, description: newExpenseDescription, amount: Number(newExpenseAmount), quantity: 1, date: newExpenseDate, category: newExpenseCategory as ExpenseCategory, stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId, workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId, supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId, totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : undefined });
            setShowAddExpenseModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleEditExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.updateExpense({ ...editExpenseData!, description: newExpenseDescription, amount: Number(newExpenseAmount), date: newExpenseDate, category: newExpenseCategory as ExpenseCategory, stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId, workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId, supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId, totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : undefined });
            setEditExpenseData(null); setShowAddExpenseModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleDeleteExpense = async (id: string) => {
        try { await dbService.deleteExpense(id); loadWorkData(); } catch (err) { console.error(err); }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.addPaymentToExpense(paymentExpenseData!.id, Number(paymentAmount), paymentDate);
            setShowAddPaymentModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleAddWorker = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.addWorker({ workId: workId!, userId: user!.id, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone, dailyRate: Number(newWorkerDailyRate), notes: newWorkerNotes });
            setShowAddWorkerModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleEditWorker = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.updateWorker({ ...editWorkerData!, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone, dailyRate: Number(newWorkerDailyRate), notes: newWorkerNotes });
            setEditWorkerData(null); setShowAddWorkerModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleDeleteWorker = async (id: string) => {
        try { await dbService.deleteWorker(id, workId!); loadWorkData(); } catch (err) { console.error(err); }
    };

    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.addSupplier({ workId: workId!, userId: user!.id, name: newSupplierName, category: newSupplierCategory, phone: newSupplierPhone, email: newSupplierEmail, address: newSupplierAddress, notes: newSupplierNotes });
            setShowAddSupplierModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleEditSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.updateSupplier({ ...editSupplierData!, name: newSupplierName, category: newSupplierCategory, phone: newSupplierPhone, email: newSupplierEmail, address: newSupplierAddress, notes: newSupplierNotes });
            setEditSupplierData(null); setShowAddSupplierModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleDeleteSupplier = async (id: string) => {
        try { await dbService.deleteSupplier(id, workId!); loadWorkData(); } catch (err) { console.error(err); }
    };

    const handleAddPhoto = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPhotoFile) return;
        setLoadingPhoto(true);
        try {
            const path = `${user!.id}/${workId}/photos/${Date.now()}`;
            await supabase.storage.from('work_media').upload(path, newPhotoFile);
            const { data } = supabase.storage.from('work_media').getPublicUrl(path);
            await dbService.addPhoto({ workId: workId!, url: data.publicUrl, description: newPhotoDescription, date: new Date().toISOString().split('T')[0], type: newPhotoType });
            setShowAddPhotoModal(false); loadWorkData();
        } catch (err) { console.error(err); } finally { setLoadingPhoto(false); }
    };

    const handleDeletePhoto = async (photo: WorkPhoto) => {
        try {
            const path = photo.url.split('work_media/')[1];
            await supabase.storage.from('work_media').remove([path]);
            await dbService.deletePhoto(photo.id); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleAddFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUploadFile) return;
        setLoadingFile(true);
        try {
            const path = `${user!.id}/${workId}/files/${Date.now()}`;
            await supabase.storage.from('work_files').upload(path, newUploadFile);
            const { data } = supabase.storage.from('work_files').getPublicUrl(path);
            await dbService.addFile({ workId: workId!, name: newFileName || newUploadFile.name, category: newFileCategory, url: data.publicUrl, type: newUploadFile.type, date: new Date().toISOString().split('T')[0] });
            setShowAddFileModal(false); loadWorkData();
        } catch (err) { console.error(err); } finally { setLoadingFile(false); }
    };

    const handleDeleteFile = async (file: WorkFile) => {
        try {
            const path = file.url.split('work_files/')[1];
            await supabase.storage.from('work_files').remove([path]);
            await dbService.deleteFile(file.id); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleAddChecklist = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const items = newChecklistItems.filter(i => i.trim()).map(t => ({ id: crypto.randomUUID(), text: t, checked: false }));
            await dbService.addChecklist({ workId: workId!, name: newChecklistName, category: newChecklistCategory, items });
            setShowAddChecklistModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleEditChecklist = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const items = newChecklistItems.filter(i => i.trim()).map((t, idx) => ({ id: editChecklistData?.items[idx]?.id || crypto.randomUUID(), text: t, checked: editChecklistData?.items[idx]?.checked || false }));
            await dbService.updateChecklist({ ...editChecklistData!, name: newChecklistName, category: newChecklistCategory, items });
            setEditChecklistData(null); setShowAddChecklistModal(false); loadWorkData();
        } catch (err) { console.error(err); }
    };

    const handleToggleChecklistItem = async (clId: string, itemId: string) => {
        const cl = checklists.find(c => c.id === clId);
        if (!cl) return;
        const items = cl.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i);
        await dbService.updateChecklist({ ...cl, items }); loadWorkData();
    };

    const handleDeleteChecklist = async (id: string) => {
        try { await dbService.deleteChecklist(id); loadWorkData(); } catch (err) { console.error(err); }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => { 
        const step = steps.find(s => s.id === id);
        if (step?.startDate) return;
        setDraggedStepId(id); 
    };
    
    const handleDragOver = (e: React.DragEvent, id: string) => { 
        e.preventDefault(); 
        const target = steps.find(s => s.id === id);
        if (target?.startDate) return;
        setDragOverStepId(id); 
    };
    
    const handleDragLeave = () => setDragOverStepId(null);

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedStepId || draggedStepId === targetId) return;
        const newOrder = [...steps];
        const oldIdx = newOrder.findIndex(s => s.id === draggedStepId);
        const newIdx = newOrder.findIndex(s => s.id === targetId);
        const [moved] = newOrder.splice(oldIdx, 1);
        newOrder.splice(newIdx, 0, moved);
        const updated = newOrder.map((s, i) => ({ ...s, orderIndex: i + 1 }));
        setSteps(updated);
        try { await Promise.all(updated.map(s => dbService.updateStep(s))); } catch (err) { console.error(err); }
        setDraggedStepId(null); setDragOverStepId(null);
    };

    // --- RENDERIZACAO DE TELAS ---

    const renderSubView = () => {
        switch (activeSubView) {
            case 'WORKERS':
                return (
                    <>
                        <ToolSubViewHeader title="Profissionais" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddWorkerModal(true)} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {workers.map(w => (
                                <div key={w.id} className={cx(surface, "p-4 rounded-2xl flex justify-between items-center")}>
                                    <div><p className="font-bold">{w.name}</p><p className="text-sm text-slate-500">{w.role}</p></div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditWorkerData(w); setNewWorkerName(w.name); setNewWorkerRole(w.role); setNewWorkerPhone(w.phone); setNewWorkerDailyRate(String(w.dailyRate)); setShowAddWorkerModal(true); }} className="text-blue-500"><i className="fa-solid fa-edit"></i></button>
                                        <button onClick={() => handleDeleteWorker(w.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'SUPPLIERS':
                return (
                    <>
                        <ToolSubViewHeader title="Fornecedores" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddSupplierModal(true)} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {suppliers.map(s => (
                                <div key={s.id} className={cx(surface, "p-4 rounded-2xl flex justify-between items-center")}>
                                    <div><p className="font-bold">{s.name}</p><p className="text-sm text-slate-500">{s.category}</p></div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditSupplierData(s); setNewSupplierName(s.name); setNewSupplierCategory(s.category); setNewSupplierPhone(s.phone); setShowAddSupplierModal(true); }} className="text-blue-500"><i className="fa-solid fa-edit"></i></button>
                                        <button onClick={() => handleDeleteSupplier(s.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'PHOTOS':
                return (
                    <>
                        <ToolSubViewHeader title="Fotos" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddPhotoModal(true)} />
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {photos.map(p => (
                                <div key={p.id} className="relative group rounded-xl overflow-hidden shadow-lg">
                                    <img src={p.url} className="w-full h-40 object-cover" alt="" />
                                    <button onClick={() => handleDeletePhoto(p)} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100"><i className="fa-solid fa-trash"></i></button>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'PROJECTS':
                return (
                    <>
                        <ToolSubViewHeader title="Documentos" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddFileModal(true)} />
                        <div className="space-y-4">
                            {files.map(f => (
                                <div key={f.id} className={cx(surface, "p-4 rounded-2xl flex justify-between items-center")}>
                                    <div><p className="font-bold">{f.name}</p><p className="text-sm text-slate-500">{f.category}</p></div>
                                    <div className="flex gap-4">
                                        <a href={f.url} target="_blank" rel="noreferrer" className="text-secondary"><i className="fa-solid fa-download"></i></a>
                                        <button onClick={() => handleDeleteFile(f)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'CONTRACTS':
                return (
                    <>
                        <ToolSubViewHeader title="Contratos" onBack={() => goToSubView('NONE')} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {contracts.map(c => (
                                <div key={c.id} className={cx(surface, "p-4 rounded-2xl")}>
                                    <p className="font-bold mb-2">{c.title}</p>
                                    <button onClick={() => { setSelectedContractTitle(c.title); setSelectedContractContent(c.contentTemplate); setShowContractContentModal(true); }} className="text-secondary text-sm">Visualizar Modelo</button>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'CHECKLIST':
                return (
                    <>
                        <ToolSubViewHeader title="Checklists" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddChecklistModal(true)} />
                        <div className="space-y-6">
                            {checklists.map(cl => (
                                <div key={cl.id} className={cx(surface, "p-5 rounded-2xl")}>
                                    <div className="flex justify-between mb-4">
                                        <h3 className="font-bold text-lg">{cl.name}</h3>
                                        <button onClick={() => handleDeleteChecklist(cl.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {cl.items.map(item => (
                                            <label key={item.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                                <input type="checkbox" checked={item.checked} onChange={() => handleToggleChecklistItem(cl.id, item.id)} className="w-5 h-5 rounded border-slate-300 text-secondary" />
                                                <span className={cx(item.checked && "line-through text-slate-400")}>{item.text}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                );
            case 'NONE':
            default:
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <ToolCard icon="fa-users-gear" title="Profissionais" description="Equipe e mão de obra." onClick={() => goToSubView('WORKERS')} />
                        <ToolCard icon="fa-truck-field" title="Fornecedores" description="Organize seus contatos." onClick={() => goToSubView('SUPPLIERS')} />
                        <ToolCard icon="fa-images" title="Galeria" description="Fotos e progresso." onClick={() => goToSubView('PHOTOS')} />
                        <ToolCard icon="fa-file-lines" title="Documentos" description="Plantas e projetos." onClick={() => goToSubView('PROJECTS')} />
                        <ToolCard icon="fa-file-contract" title="Contratos" description="Gerador de modelos." onClick={() => goToSubView('CONTRACTS')} isLocked={!isVitalicio} requiresVitalicio />
                        <ToolCard icon="fa-list-check" title="Checklists" description="Etapas de conferência." onClick={() => goToSubView('CHECKLIST')} isLocked={!isVitalicio} requiresVitalicio />
                        <ToolCard icon="fa-robot" title="Zé da Obra AI" description="Consultoria inteligente." onClick={() => navigate('/ai-chat')} isLocked={!hasAiAccess} requiresVitalicio />
                        <ToolCard icon="fa-chart-line" title="Relatórios" description="Análise de dados." onClick={() => navigate(`/work/${workId}/reports`)} isLocked={!isVitalicio} requiresVitalicio />
                        <ToolCard icon="fa-clipboard-list" title="Planejador AI" description="Cronograma inteligente." onClick={() => navigate(`/work/${workId}/ai-planner`)} isLocked={!hasAiAccess} requiresVitalicio />
                    </div>
                );
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-24 pt-4 px-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/')} className="text-slate-400 hover:text-primary transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                <div>
                    <h1 className="text-2xl font-black text-primary dark:text-white leading-tight">{work.name}</h1>
                    <p className="text-sm text-slate-500">{work.address}</p>
                </div>
            </div>

            {/* Tabs (Hidden on mobile - handled by BottomNavBar) */}
            <div className="hidden md:flex bg-white dark:bg-slate-900 rounded-2xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
                {(['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'] as MainTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => goToTab(tab)}
                        className={cx("flex-1 py-2 rounded-xl text-xs font-bold transition-all", activeTab === tab ? "bg-secondary text-white shadow-md" : "text-slate-500 hover:bg-slate-50")}
                    >
                        {tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className={cx(surface, card, "animate-in fade-in")}>
                {activeTab === 'ETAPAS' && (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Cronograma</h2>
                            <button onClick={() => setShowAddStepModal(true)} className="text-secondary font-bold text-sm"><i className="fa-solid fa-plus mr-1"></i> Nova Etapa</button>
                        </div>
                        <div className="space-y-4">
                            {steps.map(step => {
                                const details = getEntityStatusDetails('step', step, steps);
                                return (
                                    <div
                                        key={step.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, step.id)}
                                        onDragOver={(e) => handleDragOver(e, step.id)}
                                        onDrop={(e) => handleDrop(e, step.id)}
                                        className={cx(surface, "p-4 rounded-2xl flex items-center gap-4", dragOverStepId === step.id && "border-secondary border-2")}
                                    >
                                        <button onClick={() => handleStepStatusChange(step)} className={cx("w-10 h-10 rounded-full text-white shrink-0", details.bgColor)}><i className={`fa-solid ${details.icon}`}></i></button>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold truncate">{step.name}</p>
                                            <p className="text-xs text-slate-500">{formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditStepData(step); setNewStepName(step.name); setNewStepStartDate(step.startDate); setNewStepEndDate(step.endDate); setShowAddStepModal(true); }} className="text-slate-400 p-2"><i className="fa-solid fa-edit"></i></button>
                                            <button 
                                                onClick={() => setZeModal({
                                                    isOpen: true,
                                                    title: "Excluir Etapa",
                                                    message: `Deseja realmente excluir "${step.name}"?`,
                                                    confirmText: "Excluir",
                                                    onConfirm: () => handleDeleteStep(step.id),
                                                    onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
                                                })} 
                                                className="text-red-400 p-2"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {activeTab === 'MATERIAIS' && (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <select value={materialFilterStepId} onChange={e => setMaterialFilterStepId(e.target.value)} className="bg-transparent font-bold text-primary outline-none">
                                <option value="all">Todos os Materiais</option>
                                {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <button onClick={() => setShowAddMaterialModal(true)} className="text-secondary font-bold text-sm"><i className="fa-solid fa-plus mr-1"></i> Adicionar</button>
                        </div>
                        {groupedMaterials.map(group => (
                            <div key={group.stepId} className="mb-6">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">{group.stepName}</h3>
                                <div className="space-y-3">
                                    {group.materials.map(m => (
                                        <div key={m.id} onClick={() => { setEditMaterialData(m); setNewMaterialName(m.name); setNewMaterialPlannedQty(String(m.plannedQty)); setNewMaterialUnit(m.unit); setShowAddMaterialModal(true); }} className={cx(surface, "p-4 rounded-2xl flex justify-between items-center cursor-pointer hover:border-secondary transition-colors")}>
                                            <div><p className="font-bold">{m.name}</p><p className="text-xs text-slate-500">{m.purchasedQty} / {m.plannedQty} {m.unit}</p></div>
                                            <div className="w-24 bg-slate-100 rounded-full h-1.5"><div className="bg-secondary h-full rounded-full" style={{ width: `${Math.min(100, (m.purchasedQty / m.plannedQty) * 100)}%` }}></div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {activeTab === 'FINANCEIRO' && (
                    <>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Planejado</p>
                                <p className="font-black text-primary">{formatCurrency(work.budgetPlanned)}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gasto Atual</p>
                                <p className="font-black text-secondary">{formatCurrency(calculateTotalExpenses)}</p>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Despesas</h2>
                            <button onClick={() => setShowAddExpenseModal(true)} className="text-secondary font-bold text-sm">Adicionar Gasto</button>
                        </div>
                        <div className="space-y-6">
                            {groupedExpensesByStep.map(group => (
                                <div key={group.stepName}>
                                    <h3 className="text-xs font-black text-slate-400 uppercase mb-3">{group.stepName}</h3>
                                    {group.expenses.map(exp => (
                                        <div key={exp.id} className={cx(surface, "p-4 rounded-2xl flex justify-between mb-2")}>
                                            <div><p className="font-bold">{exp.description}</p><p className="text-xs text-slate-500">{formatDateDisplay(exp.date)}</p></div>
                                            <div className="text-right">
                                                <p className="font-black">{formatCurrency(exp.amount)}</p>
                                                <button onClick={() => { setPaymentExpenseData(exp); setPaymentAmount(String(exp.amount - (exp.paidAmount || 0))); setShowAddPaymentModal(true); }} className="text-[10px] font-bold text-secondary uppercase">Pagar</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {activeTab === 'FERRAMENTAS' && renderSubView()}
            </div>

            {/* Modals Implementation */}
            {showAddStepModal && (
                <ZeModal isOpen title="Etapa" confirmText="Salvar" onConfirm={editStepData ? handleEditStep : handleAddStep} onCancel={() => setShowAddStepModal(false)}>
                    <div className="space-y-4">
                        <input type="text" value={newStepName} onChange={e => setNewStepName(e.target.value)} placeholder="Nome" className="w-full p-3 rounded-xl border dark:bg-slate-800" />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={newStepStartDate || ''} onChange={e => setNewStepStartDate(e.target.value)} className="p-3 rounded-xl border dark:bg-slate-800" />
                            <input type="date" value={newStepEndDate || ''} onChange={e => setNewStepEndDate(e.target.value)} className="p-3 rounded-xl border dark:bg-slate-800" />
                        </div>
                    </div>
                </ZeModal>
            )}

            {showAddExpenseModal && (
                <ZeModal isOpen title="Novo Gasto" confirmText="Adicionar" onConfirm={editExpenseData ? handleEditExpense : handleAddExpense} onCancel={() => setShowAddExpenseModal(false)}>
                    <div className="space-y-4">
                        <input type="text" value={newExpenseDescription} onChange={e => setNewExpenseDescription(e.target.value)} placeholder="Descrição" className="w-full p-3 rounded-xl border dark:bg-slate-800" />
                        <input type="number" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} placeholder="Valor" className="w-full p-3 rounded-xl border dark:bg-slate-800" />
                        <input type="date" value={newExpenseDate} onChange={e => setNewExpenseDate(e.target.value)} className="w-full p-3 rounded-xl border dark:bg-slate-800" />
                    </div>
                </ZeModal>
            )}

            {showAddPaymentModal && (
                <ZeModal isOpen title="Registrar Pagamento" confirmText="Pagar" onConfirm={handleAddPayment} onCancel={() => setShowAddPaymentModal(false)}>
                    <div className="space-y-4">
                        <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full p-3 rounded-xl border dark:bg-slate-800" />
                        <input type="date" value={paymentDate} onChange={e => setNewPaymentDate(e.target.value)} className="w-full p-3 rounded-xl border dark:bg-slate-800" />
                    </div>
                </ZeModal>
            )}
        </div>
    );
};

const WorkStatus = { COMPLETED: 'COMPLETED' };

export default WorkDetail;
