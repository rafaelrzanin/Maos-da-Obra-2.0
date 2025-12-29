import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx'; // FIX: Corrected import syntax
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, PlanType, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile } from '../types.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx';
import { STANDARD_CHECKLISTS, CONTRACT_TEMPLATES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'SCHEDULE' | 'MATERIALS' | 'FINANCIAL' | 'MORE';
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO'; // Keep for reports view

// --- DATE HELPERS ---
const parseDateNoTimezone = (dateStr: string) => {
    if (!dateStr) return '--/--';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    }
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch (e) {
        return dateStr;
    }
};

// --- RENDER FUNCTIONS FOR REPORT SECTIONS (REUSABLE) ---
// These are kept as separate render functions for the REPORTS subView
interface ReportProps {
    steps: Step[];
    materials: Material[];
    expenses: Expense[];
    workers: Worker[];
    suppliers: Supplier[];
    work: Work;
    today: string; // ISO string 'YYYY-MM-DD'
    parseDateNoTimezone: (dateStr: string) => string;
}

const RenderCronogramaReport: React.FC<ReportProps> = ({ steps, today, parseDateNoTimezone }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
        <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-calendar-days text-secondary"></i> Cronograma
        </h3>
        <div className="space-y-4">
            {steps.map((s, idx) => {
                const isDone = s.status === StepStatus.COMPLETED;
                const isInProgress = s.status === StepStatus.IN_PROGRESS;
                const isDelayed = s.endDate < today && !isDone;

                let bgColorClass = 'bg-slate-50 dark:bg-slate-800';
                let textColorClass = 'text-slate-600 dark:text-slate-300';
                let iconClass = 'fa-clock';
                let iconColor = 'text-slate-400';

                if (isDone) {
                    bgColorClass = 'bg-green-50 dark:bg-green-900/10';
                    textColorClass = 'text-green-700 dark:text-green-400';
                    iconClass = 'fa-check-circle';
                    iconColor = 'text-green-600';
                } else if (isDelayed) {
                    bgColorClass = 'bg-red-50 dark:bg-red-900/10';
                    textColorClass = 'text-red-700 dark:text-red-400';
                    iconClass = 'fa-triangle-exclamation';
                    iconColor = 'text-red-600';
                } else if (isInProgress) {
                    bgColorClass = 'bg-orange-50 dark:bg-orange-900/10';
                    textColorClass = 'text-orange-700 dark:text-orange-400';
                    iconClass = 'fa-hammer';
                    iconColor = 'text-orange-600';
                }
                
                return (
                    <div key={s.id} className={`p-3 rounded-xl border ${bgColorClass} border-slate-200 dark:border-slate-700`}>
                        <div className="flex items-center gap-3 mb-2">
                            <i className={`fa-solid ${iconClass} ${iconColor} text-lg`}></i>
                            <p className={`font-bold text-sm ${textColorClass}`}>{String(idx + 1).padStart(2, '0')}. {s.name}</p>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Início: {parseDateNoTimezone(s.startDate)}</span>
                            <span>Fim: {parseDateNoTimezone(s.endDate)}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const RenderMateriaisReport: React.FC<ReportProps> = ({ steps, materials, parseDateNoTimezone }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
        <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-boxes-stacked text-secondary"></i> Materiais
        </h3>
        <div className="space-y-6">
            {[...steps, { id: 'general-mat', name: 'Materiais Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step) => {
                const groupMaterials = materials.filter(m => {
                    if (step.id === 'general-mat') return !m.stepId;
                    return m.stepId === step.id;
                });

                if (groupMaterials.length === 0) return null;

                const isGeneral = step.id === 'general-mat';
                const stepLabel = isGeneral ? step.name : `Etapa: ${step.name}`;

                return (
                    <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <h4 className="font-bold text-primary dark:text-white text-sm uppercase tracking-wide mb-3">{stepLabel}</h4>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                            {groupMaterials.map(m => {
                                const isFullyPurchased = m.purchasedQty >= m.plannedQty;
                                const itemStatusClass = isFullyPurchased ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
                                const itemIconClass = isFullyPurchased ? 'fa-check-circle' : 'fa-circle-exclamation';

                                return (
                                    <li key={m.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs">
                                        <p className="font-bold text-primary dark:text-white mb-1 sm:mb-0">{m.name} {m.brand && <span className="text-slate-500 font-normal">({m.brand})</span>}</p>
                                        <div className="flex items-center gap-2 font-mono text-right">
                                            <span className="text-slate-700 dark:text-slate-300">Sug.: {m.plannedQty} {m.unit}</span>
                                            <span className={`font-bold ${itemStatusClass} flex items-center gap-1`}>
                                                <i className={`fa-solid ${itemIconClass}`}></i> Compr.: {m.purchasedQty} {m.unit}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}
        </div>
    </div>
);

const RenderFinanceiroReport: React.FC<ReportProps> = ({ steps, expenses, materials, workers, suppliers, parseDateNoTimezone }) => { 
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
            <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2"><i className="fa-solid fa-dollar-sign text-secondary"></i> Financeiro</h3>
            <div className="space-y-6">
                {[...steps, { id: 'general-fin', name: 'Despesas Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step) => {
                    const groupExpenses = expenses.filter(e => {
                        if (step.id === 'general-fin') return !e.stepId;
                        return e.stepId === step.id;
                    });

                    if (groupExpenses.length === 0) return null;

                    const isGeneral = step.id === 'general-fin';
                    const stepLabel = isGeneral ? step.name : `Etapa: ${step.name}`;

                    return ( // This `return` is for the `step` map
                        <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-primary dark:text-white text-sm uppercase tracking-wide mb-3">{stepLabel}</h4>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                {groupExpenses.map(exp => {
                                    const relatedMaterial = exp.relatedMaterialId ? materials.find(m => m.id === exp.relatedMaterialId) : null;
                                    const expenseWorker = exp.workerId ? workers.find(w => w.id === exp.workerId) : null;
                                    const expenseSupplier = exp.supplierId ? suppliers.find(s => s.id === exp.supplierId) : null; // NEW

                                    let categoryIcon = 'fa-tag';
                                    let categoryColor = 'text-slate-500';
                                    if (exp.category === ExpenseCategory.MATERIAL) {
                                        categoryIcon = 'fa-box';
                                        categoryColor = 'text-amber-600';
                                    } else if (exp.category === ExpenseCategory.LABOR) {
                                        categoryIcon = 'fa-helmet-safety';
                                        categoryColor = 'text-blue-600';
                                    }

                                    return (
                                        <li key={exp.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs">
                                            <div>
                                                <p className="font-bold text-primary dark:text-white">{exp.description}</p>
                                                <p className="text-slate-500 mt-1 flex items-center gap-2">
                                                    <span className={`flex items-center gap-1 ${categoryColor}`}><i className={`fa-solid ${categoryIcon}`}></i> {exp.category}</span>
                                                    <span>• {parseDateNoTimezone(exp.date)}</span>
                                                    {relatedMaterial && <span className="text-sm font-medium text-slate-400">(Material: {relatedMaterial.name})</span>}
                                                    {expenseWorker && <span className="text-sm font-medium text-slate-400">(Profissional: {expenseWorker.name})</span>}
                                                    {expenseSupplier && <span className="text-sm font-medium text-slate-400">(Fornecedor: {expenseSupplier.name})</span>}
                                                </p> {/* FIX: Missing closing </p> tag here. Added it. */}
                                            </div>
                                        <span className="font-bold text-primary dark:text-white whitespace-nowrap">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div> 
                ); // Closing div for the step item.
            })}
        </div>
    );
};


const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, authLoading, isUserAuthFinished } = useAuth(); 
    
    // --- CORE DATA STATE ---
    const [work, setWork] = useState<Work | null>(null); // FIX: Initialize with null
    const [loading, setLoading] = useState(true);
    const [steps, setSteps] = useState<Step[]>([]); // FIX: Initialize with empty array
    const [materials, setMaterials] = useState<Material[]>([]); // FIX: Initialize with empty array
    const [expenses, setExpenses] = useState<Expense[]>([]); // FIX: Initialize with empty array
    const [workers, setWorkers] = useState<Worker[]>([]); // FIX: Initialize with empty array
    const [suppliers, setSuppliers] = useState<Supplier[]>([]); // FIX: Initialize with empty array
    const [photos, setPhotos] = useState<WorkPhoto[]>([]); // FIX: Initialize with empty array
    const [files, setFiles] = useState<WorkFile[]>([]); // FIX: Initialize with empty array
    // Dashboard Stats for Report
    const [stats, setStats] = useState<{ totalSpent: number, progress: number, delayedSteps: number } | null>(null); // FIX: Initialize with null

    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<MainTab>('SCHEDULE');
    const [subView, setSubView] = useState<SubView>('NONE'); 
    const [uploading, setUploading] = useState(false); // FIX: Renamed state from `loading` to `uploading` to avoid conflict
    const [reportActiveTab, setReportActiveTab] = useState<ReportSubTab>('CRONOGRAMA'); 
    
    // Material Filter (Main Tab)
    const [materialFilterStepId, setMaterialFilterStepId] = useState<string>('ALL');
    
    // Step Modals & Forms
    const [isStepModalOpen, setIsStepModalOpen] = useState(false);
    const [stepModalMode, setStepModalMode] = useState<'ADD' | 'EDIT'>('ADD');
    const [currentStepId, setCurrentStepId] = useState<string | null>(null);
    const [stepName, setStepName] = useState('');
    const [stepStart, setStepStart] = useState(new Date().toISOString().split('T')[0]);
    const [stepEnd, setStepEnd] = useState(new Date().toISOString().split('T')[0]);

    // Material Modals & Forms
    const [materialModal, setMaterialModal] = useState<{ isOpen: boolean, material: Material | null }>({ isOpen: false, material: null }); // FIX: Corrected initial state
    const [matName, setMatName] = useState('');
    const [matBrand, setMatBrand] = useState('');
    const [matPlannedQty, setMatPlannedQty] = useState('');
    const [matUnit, setMatUnit] = useState('');
    const [matBuyQty, setMatBuyQty] = useState('');
    const [matBuyCost, setMatBuyCost] = useState('');

    const [addMatModal, setAddMatModal] = useState(false);
    const [newMatName, setNewMatName] = useState('');
    const [newMatBrand, setNewMatBrand] = useState('');
    const [newMatQty, setNewMatQty] = useState('');
    const [newMatUnit, setNewMatUnit] = useState('un');
    const [newMatStepId, setNewMatStepId] = useState('');
    const [newMatBuyNow, setNewMatBuyNow] = useState(false);
    const [newMatBuyQty, setNewMatBuyQty] = useState('');
    const [newMatBuyCost, setNewMatBuyCost] = useState('');

    // EXPENSE MODAL STATE
    const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean, mode: 'ADD'|'EDIT', id?: string }>({ isOpen: false, mode: 'ADD' }); // FIX: Corrected initial state
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expTotalAgreed, setExpTotalAgreed] = useState('');
    const [expCategory, setExpCategory] = useState<string>(ExpenseCategory.LABOR);
    const [expStepId, setExpStepId] = useState('');
    const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
    // NEW STATE: Tracks the amount already in DB to support cumulative logic
    const [expSavedAmount, setExpSavedAmount] = useState(0);

    // PEOPLE MODAL STATE
    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personMode, setPersonMode] = useState<'WORKER'|'SUPPLIER'>('WORKER');
    const [personId, setPersonId] = useState<string | null>(null); 
    const [personName, setPersonName] = useState('');
    const [personRole, setPersonRole] = useState('');
    const [personPhone, setPersonPhone] = useState('');
    const [personNotes, setPersonNotes] = useState('');

    // CONTRACTS/CHECKLISTS MODAL STATE
    const [viewContract, setViewContract] = useState<{title: string, content: string} | null>(null); // FIX: Initialize with null
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    // GENERAL MODAL
    const [zeModal, setZeModal] = useState<ZeModalProps>({ 
        isOpen: false, 
        title: '', 
        message: '',
        onCancel: () => {}, 
    });

    // CALCULATOR STATES (now in a modal)
    const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false); // Using isCalculatorModalOpen state
    const [calcType, setCalcType] = useState<'PISO'|'PAREDE'|'PINTURA'>('PISO');
    const [calcArea, setCalcArea] = useState('');
    const [calcResult, setCalcResult] = useState<string[]>([]); // FIX: Initialize with empty array

    // Define today once for date comparisons
    const today = new Date().toISOString().split('T')[0];

    // Derived state for premium access
    const isPremium = user?.plan === PlanType.VITALICIO; // FIX: Access PlanType from imported enum

    // --- LOAD DATA ---
    const load = useCallback(async () => {
        // Only proceed if initial auth check is done AND id is available
        if (!id || !isUserAuthFinished) return;
        
        // Use authLoading from context to gate initial page load
        if (authLoading) return; // Wait for AuthContext to finish loading

        setLoading(true);
        const w = await dbService.getWorkById(id);
        setWork(w); // FIX: set work directly, it's already null | Work
        
        if (w) {
            const [s, m, e, wk, sp, ph, fl, workStats] = await Promise.all([ // Added workStats to parallel fetch
                dbService.getSteps(w.id),
                dbService.getMaterials(w.id),
                dbService.getExpenses(w.id),
                dbService.getWorkers(w.id),
                dbService.getSuppliers(w.id),
                dbService.getPhotos(w.id),
                dbService.getFiles(w.id),
                dbService.calculateWorkStats(w.id)
            ]);
            
            setSteps(s ? s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) : []);
            setMaterials(m || []);
            setExpenses(e ? e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : []);
            setWorkers(wk || []);
            setSuppliers(sp || []);
            setPhotos(ph || []);
            setFiles(fl || []);
            setStats(workStats);
        }
        setLoading(false);
    }, [id, authLoading, isUserAuthFinished]); // Dependencies for useCallback

    useEffect(() => { load(); }, [load]);

    // --- HANDLERS ---

    const handleSaveStep = async (e: React.FormEvent) => { // FIX: Added 'e' parameter type
        e.preventDefault();
        if (!work || !stepName) return;

        if (stepModalMode === 'ADD') {
            await dbService.addStep({
                workId: work.id,
                name: stepName,
                startDate: stepStart,
                endDate: stepEnd,
                status: StepStatus.NOT_STARTED,
                isDelayed: false
            });
        } else if (stepModalMode === 'EDIT' && currentStepId) {
            const existing = steps.find(s => s.id === currentStepId);
            if (existing) {
                await dbService.updateStep({
                    ...existing,
                    name: stepName,
                    startDate: stepStart,
                    endDate: stepEnd
                });
            }
        }
        setIsStepModalOpen(false);
        setStepName('');
        setStepStart(new Date().toISOString().split('T')[0]);
        setStepEnd(new Date().toISOString().split('T')[0]);
        await load();
    };

    const handleStepStatusClick = async (step: Step) => {
        let newStatus = StepStatus.NOT_STARTED;
        if (step.status === StepStatus.NOT_STARTED) newStatus = StepStatus.IN_PROGRESS;
        else if (step.status === StepStatus.IN_PROGRESS) newStatus = StepStatus.COMPLETED;
        else newStatus = StepStatus.NOT_STARTED;

        await dbService.updateStep({ ...step, status: newStatus });
        await load();
    };

    const handleAddMaterial = async (e: React.FormEvent) => { // FIX: Added 'e' parameter type
        e.preventDefault();
        if (!work || !newMatName) return;
        const mat: Omit<Material, 'id'> = {
            workId: work.id,
            name: newMatName,
            brand: newMatBrand,
            plannedQty: Number(newMatQty),
            purchasedQty: 0,
            unit: newMatUnit,
            stepId: newMatStepId || undefined
        };
        
        await dbService.addMaterial(mat, newMatBuyNow ? {
            qty: Number(newMatBuyQty),
            cost: Number(newMatBuyCost),
            date: new Date().toISOString()
        } : undefined);
        
        setAddMatModal(false);
        setNewMatName(''); setNewMatBrand(''); setNewMatQty(''); setNewMatBuyNow(false);
        setNewMatStepId(''); setNewMatBuyQty(''); setNewMatBuyCost(''); // Reset all fields
        await load();
    };

    const handleUpdateMaterial = async (e: React.FormEvent) => { // FIX: Added 'e' parameter type
        e.preventDefault();
        if (!materialModal.material) return;
        
        const hasPurchase = matBuyQty && Number(matBuyQty) > 0;

        try {
            // 1. Update Definition
            const updatedMaterial = {
                ...materialModal.material,
                name: matName,
                brand: matBrand,
                plannedQty: Number(matPlannedQty),
                unit: matUnit
            };
            await dbService.updateMaterial(updatedMaterial);

            // 2. Register Purchase (if applicable)
            if (hasPurchase) {
                await dbService.registerMaterialPurchase(
                    materialModal.material.id,
                    matName,
                    matBrand,
                    Number(matPlannedQty),
                    matUnit,
                    Number(matBuyQty),
                    Number(matBuyCost)
                );
            }

            setMaterialModal({ isOpen: false, material: null });
            await load();
        } catch (error: any) { // FIX: Added error type annotation
            console.error("Erro ao salvar material:", error);
            alert(`Falha ao salvar material: ${error.message || "Erro desconhecido."}`);
        }
    };

    const openAddExpense = () => {
        setExpenseModal({ isOpen: true, mode: 'ADD' });
        setExpDesc('');
        setExpAmount('');
        setExpSavedAmount(0);
        setExpTotalAgreed('');
        setExpCategory(ExpenseCategory.LABOR);
        setExpStepId('');
        setExpDate(new Date().toISOString().split('T')[0]);
    };

    const openEditExpense = (expense: Expense) => {
        setExpenseModal({ isOpen: true, mode: 'EDIT', id: expense.id });
        setExpDesc(expense.description);
        setExpAmount(''); 
        setExpSavedAmount(expense.amount); 
        setExpTotalAgreed(expense.totalAgreed ? String(expense.totalAgreed) : '');
        setExpCategory(expense.category);
        setExpStepId(expense.stepId || '');
        setExpDate(expense.date.split('T')[0]);
    };

    const handleSaveExpense = async (e: React.FormEvent) => { // FIX: Added 'e' parameter type
        e.preventDefault();
        if (!work || !expDesc) return;
        
        const finalStepId = expStepId || undefined;
        const finalTotalAgreed = expTotalAgreed ? Number(expTotalAgreed) : undefined;
        const inputAmount = Number(expAmount) || 0;

        try {
            if (expenseModal.mode === 'ADD') {
                await dbService.addExpense({
                    workId: work.id,
                    description: expDesc,
                    amount: inputAmount,
                    paidAmount: inputAmount, // Ensure paidAmount is set on add
                    quantity: 1, // Default quantity
                    date: new Date(expDate).toISOString(),
                    category: expCategory,
                    stepId: finalStepId,
                    totalAgreed: finalTotalAgreed 
                });
            } else if (expenseModal.mode === 'EDIT' && expenseModal.id) {
                const existingExpense = expenses.find(exp => exp.id === expenseModal.id);
                if (existingExpense) {
                    const newTotalAmount = expSavedAmount + inputAmount;

                    await dbService.updateExpense({
                        ...existingExpense,
                        description: expDesc,
                        amount: newTotalAmount,
                        paidAmount: newTotalAmount, // Ensure paidAmount is updated
                        date: new Date(expDate).toISOString(),
                        category: expCategory,
                        stepId: finalStepId,
                        totalAgreed: finalTotalAgreed
                    });
                }
            }
            setExpenseModal({ isOpen: false, mode: 'ADD' });
            await load();
        } catch (error: any) { // FIX: Added error type annotation
            console.error("Erro ao salvar despesa:", error);
            alert(`Falha ao salvar despesa: ${error.message || "Erro desconhecido."}`);
        }
    };

    const handleDeleteExpense = async () => {
        if (expenseModal.id) {
            if (window.confirm("Tem certeza que deseja excluir este gasto?")) {
                await dbService.deleteExpense(expenseModal.id);
                setExpenseModal({ isOpen: false, mode: 'ADD' });
                await load();
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'PHOTO' | 'FILE') => {
        if (e.target.files && e.target.files[0] && work) {
            setUploading(true);
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                await new Promise(r => setTimeout(r, 800));
                
                if (type === 'PHOTO') {
                    await dbService.addPhoto({
                        workId: work.id,
                        url: base64,
                        description: 'Foto da obra',
                        date: new Date().toISOString(),
                        type: 'PROGRESS'
                    });
                } else {
                    await dbService.addFile({
                        workId: work.id,
                        name: file.name,
                        category: FileCategory.GENERAL,
                        url: base64,
                        type: file.type,
                        date: new Date().toISOString()
                    });
                }
                setUploading(false);
                await load();
            };
            reader.readAsDataURL(file);
        }
    };

    const openPersonModal = (mode: 'WORKER' | 'SUPPLIER', item?: Worker | Supplier) => {
        if (!user || !work) {
            console.error("Usuário ou Obra não disponíveis para abrir modal de pessoa.");
            return;
        }

        setPersonMode(mode);
        if (item) {
            setPersonId(item.id);
            setPersonName(item.name);
            setPersonPhone(item.phone);
            setPersonNotes(item.notes || '');
            if (mode === 'WORKER') setPersonRole((item as Worker).role);
            else setPersonRole((item as Supplier).category);
        } else {
            setPersonId(null);
            setPersonName('');
            setPersonPhone('');
            setPersonNotes('');
            setPersonRole(mode === 'WORKER' ? STANDARD_JOB_ROLES[0] : STANDARD_SUPPLIER_CATEGORIES[0]);
        }
        setIsPersonModalOpen(true);
    };

    const handleSavePerson = async (e: React.FormEvent) => { // FIX: Added 'e' parameter type
        e.preventDefault();
        if (!user || !work) {
            console.error("Usuário ou Obra não disponíveis para salvar pessoa.");
            return;
        }

        const payload = {
            userId: user.id,
            workId: work.id,
            name: personName,
            phone: personPhone,
            notes: personNotes
        };

        if (personId) {
            if (personMode === 'WORKER') await dbService.updateWorker({ ...payload, id: personId, role: personRole });
            else await dbService.updateSupplier({ ...payload, id: personId, category: personRole });
        } else {
            if (personMode === 'WORKER') await dbService.addWorker({ ...payload, role: personRole });
            else await dbService.addSupplier({ ...payload, category: personRole });
        }
        
        await load();
        setIsPersonModalOpen(false);
    };

    const handleDeletePerson = (idToDelete: string, workId: string, mode: 'WORKER' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true,
            title: mode === 'WORKER' ? 'Excluir Profissional' : 'Excluir Fornecedor',
            message: 'Tem certeza? Essa ação não pode ser desfeita. O profissional/fornecedor será removido APENAS desta obra.',
            confirmText: 'Sim, Excluir', 
            cancelText: 'Cancelar', 
            type: 'DANGER',
            onConfirm: async () => {
                if (mode === 'WORKER') await dbService.deleteWorker(idToDelete, workId);
                else await dbService.deleteSupplier(idToDelete, workId);
                await load();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            },
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
        });
    };

    // CALCULATORS
    useEffect(() => {
        if (!calcArea) { setCalcResult([]); return; }
        const area = Number(calcArea);
        if (calcType === 'PISO') {
            const piso = Math.ceil(area * 1.15); 
            const argamassa = Math.ceil(area * 4); 
            const rejunte = Math.ceil(area * 0.3); 
            setCalcResult([`${piso} m² de Piso (com quebra)`, `${argamassa} kg de Argamassa AC-II/III`, `${rejunte} kg de Rejunte`]);
        } else if (calcType === 'PAREDE') {
            const tijolos = Math.ceil(area * 30); 
            const cimento = Math.ceil(area * 5); 
            setCalcResult([`${tijolos} Blocos/Tijolos`, `~${Math.ceil(cimento/50)} Sacos de Cimento`]);
        } else if (calcType === 'PINTURA') {
            const litros = Math.ceil(area / 10);
            setCalcResult([`${litros * 2} Litros de Tinta (2 demãos)`, `${Math.ceil(area/30)} L de Selador`]);
        }
    }, [calcArea, calcType]);

    // EXPORT EXCEL
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        // Cronograma Sheet
        const wsCrono = XLSX.utils.json_to_sheet(steps.map(s => ({
            'Nome da Etapa': s.name,
            'Início Planejado': parseDateNoTimezone(s.startDate),
            'Fim Planejado': parseDateNoTimezone(s.endDate),
            'Status Atual': s.status
        })));
        XLSX.utils.book_append_sheet(wb, wsCrono, "Cronograma");

        // Materiais Sheet
        const wsMat = XLSX.utils.json_to_sheet(materials.map(m => ({
            'Nome do Material': m.name,
            'Marca': m.brand || 'N/A',
            'Qtd. Planejada': m.plannedQty,
            'Unidade': m.unit,
            'Qtd. Comprada': m.purchasedQty,
            'Status Compra': m.purchasedQty >= m.plannedQty ? 'Completa' : 'Pendente'
        })));
        XLSX.utils.book_append_sheet(wb, wsMat, "Materiais");

        // Financeiro Sheet
        const wsFin = XLSX.utils.json_to_sheet(expenses.map(e => {
            const stepName = steps.find(s => s.id === e.stepId)?.name || 'N/A';
            const workerOrSupplierName = (workers.find(w => w.id === e.workerId)?.name || suppliers.find(s => s.id === e.supplierId)?.name || 'N/A');
            const totalAgreedValue = e.totalAgreed || e.amount;
            const saldoAPagar = totalAgreedValue - e.amount;

            return {
                'Descrição': e.description,
                'Valor Lançado': Number(e.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                'Total Acordado': Number(totalAgreedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                'Diferença (Saldo)': Number(saldoAPagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                'Categoria': e.category,
                'Data': parseDateNoTimezone(e.date),
                'Etapa Associada': stepName,
                'Profissional/Fornecedor': workerOrSupplierName
            };
        }));
        XLSX.utils.book_append_sheet(wb, wsFin, "Financeiro");

        XLSX.writeFile(wb, `Obra_${work?.name}.xlsx`);
    };

    const handlePrintPDF = () => {
        window.print();
    };

    // Show loading if AuthContext is still loading OR if initial auth check is not done OR if local work details are loading
    if (authLoading || !isUserAuthFinished || loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return <div className="text-center text-xl text-red-500 py-10">Obra não encontrada.</div>;


    // --- RENDER MAIN TAB CONTENT ---
    const renderMainTab = () => {
        if (activeTab === 'SCHEDULE') {
            return (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Cronograma</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Etapas da Obra</p>
                        </div>
                        <button onClick={() => { setStepModalMode('ADD'); setStepName(''); setStepStart(new Date().toISOString().split('T')[0]); setStepEnd(new Date().toISOString().split('T')[0]); setIsStepModalOpen(true); }} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                    </div>
                    {steps.map((step, idx) => {
                         const stepNum = String(idx + 1).padStart(2, '0');
                         const isDone = step.status === StepStatus.COMPLETED;
                         const isInProgress = step.status === StepStatus.IN_PROGRESS;
                         
                         // Determine Delay (Late) status
                         const todayDate = new Date().toISOString().split('T')[0]; 
                         const isDelayed = step.endDate < todayDate && !isDone;

                         let statusBadgeClass = 'bg-slate-100 text-slate-500';
                         let statusText = 'Pendente';
                         let cardBorderClass = 'border-slate-100 dark:border-slate-800';
                         let iconColor = 'border-slate-200 text-slate-300';
                         let iconClass = 'fa-play';

                         if (isDone) {
                             statusBadgeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                             statusText = 'Concluído';
                             cardBorderClass = 'border-green-200 dark:border-green-900/30';
                             iconColor = 'bg-green-500 border-green-500 text-white';
                             iconClass = 'fa-check';
                         } else if (isDelayed) {
                             // Red style for delayed items
                             statusBadgeClass = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
                             statusText = 'Atrasado';
                             cardBorderClass = 'border-red-200 dark:border-red-900/30';
                             iconColor = 'bg-red-500 border-red-500 text-white animate-pulse';
                             iconClass = 'fa-triangle-exclamation';
                         } else if (isInProgress) {
                             statusBadgeClass = 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
                             statusText = 'Em Andamento';
                             iconColor = 'bg-secondary border-secondary text-white';
                             iconClass = 'fa-hammer';
                         }

                         return (
                            <div key={step.id} className={`group bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md relative overflow-hidden ${cardBorderClass}`}>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleStepStatusClick(step)} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${iconColor}`}>
                                        <i className={`fa-solid ${iconClass}`}></i>
                                    </button>
                                    <div className="flex-1 cursor-pointer" onClick={() => { setStepModalMode('EDIT'); setCurrentStepId(step.id); setStepName(step.name); setStepStart(step.startDate.split('T')[0]); setStepEnd(step.endDate.split('T')[0]); setIsStepModalOpen(true); }}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold text-slate-400">ETAPA {stepNum}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusBadgeClass}`}>{statusText}</span>
                                                </div>
                                                <h3 className={`font-bold text-lg leading-tight ${isDone ? 'text-slate-400 line-through' : 'text-primary dark:text-white'}`}>{step.name}</h3>
                                            </div>
                                            <div className="text-slate-300 hover:text-secondary p-1"><i className="fa-solid fa-pen-to-square"></i></div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                <i className="fa-regular fa-calendar"></i> {parseDateNoTimezone(step.startDate)}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                <i className="fa-solid fa-flag-checkered"></i> {parseDateNoTimezone(step.endDate)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         );
                    })}
                </div>
            );
        }

        if (activeTab === 'MATERIALS') {
             // Filter Logic
             const filteredSteps = materialFilterStepId === 'ALL' 
                ? steps 
                : steps.filter(s => s.id === materialFilterStepId);

             return (
                <div className="space-y-6 animate-in fade-in">
                    <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950 pb-2">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white">Materiais</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestão de Compras</p>
                            </div>
                            <div className="flex gap-2 items-center">
                                <select value={materialFilterStepId} onChange={e => setMaterialFilterStepId(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm px-3 py-2 text-primary dark:text-white focus:ring-secondary focus:border-secondary transition-all">
                                    <option value="ALL">Todas as Etapas</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <button onClick={() => setAddMatModal(true)} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                            </div>
                        </div>
                    </div>
                    
                    {filteredSteps.map((step) => {
                        const stepMaterials = materials.filter(m => m.stepId === step.id);
                        if (stepMaterials.length === 0) return null; // Only render step section if it has materials

                        return (
                            <div key={step.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                    <h3 className="font-bold text-primary dark:text-white text-base uppercase tracking-wide">Etapa: {step.name}</h3>
                                </div>
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {stepMaterials.map(material => {
                                        const isFullyPurchased = material.purchasedQty >= material.plannedQty;
                                        const remainingQty = material.plannedQty - material.purchasedQty;
                                        const statusColor = isFullyPurchased ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
                                        const statusIcon = isFullyPurchased ? 'fa-check-circle' : 'fa-triangle-exclamation';

                                        return (
                                            <li key={material.id} onClick={() => { setMaterialModal({isOpen: true, material: material}); setMatName(material.name); setMatBrand(material.brand || ''); setMatPlannedQty(String(material.plannedQty)); setMatUnit(material.unit); }} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                                <div className={`w-9 h-9 rounded-full ${isFullyPurchased ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'} flex items-center justify-center shrink-0`}>
                                                        <i className={`fa-solid ${statusIcon} ${statusColor}`}></i>
                                                    </div>
                                                <div>
                                                    <p className="font-bold text-primary dark:text-white leading-tight">{material.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{material.brand || 'Marca não informada'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-primary dark:text-white">{material.purchasedQty} / {material.plannedQty} {material.unit}</p>
                                                    <p className={`text-xs ${statusColor}`}>{isFullyPurchased ? 'Compra Concluída' : `${remainingQty} ${material.unit} pendentes`}</p>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                    {materials.filter(m => !m.stepId).length > 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                <h3 className="font-bold text-primary dark:text-white text-base uppercase tracking-wide">Materiais Gerais / Sem Etapa</h3>
                            </div>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {materials.filter(m => !m.stepId).map(material => {
                                    const isFullyPurchased = material.purchasedQty >= material.plannedQty;
                                    const remainingQty = material.plannedQty - material.purchasedQty;
                                    const statusColor = isFullyPurchased ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
                                    const statusIcon = isFullyPurchased ? 'fa-check-circle' : 'fa-triangle-exclamation';

                                    return (
                                        <li key={material.id} onClick={() => { setMaterialModal({isOpen: true, material: material}); setMatName(material.name); setMatBrand(material.brand || ''); setMatPlannedQty(String(material.plannedQty)); setMatUnit(material.unit); }} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                            <div className={`w-9 h-9 rounded-full ${isFullyPurchased ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'} flex items-center justify-center shrink-0`}>
                                                    <i className={`fa-solid ${statusIcon} ${statusColor}`}></i>
                                            </div>
                                            <div>
                                                <p className="font-bold text-primary dark:text-white leading-tight">{material.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{material.brand || 'Marca não informada'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-primary dark:text-white">{material.purchasedQty} / {material.plannedQty} {material.unit}</p>
                                                <p className={`text-xs ${statusColor}`}>{isFullyPurchased ? 'Compra Concluída' : `${remainingQty} ${material.unit} pendentes`}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'FINANCIAL') {
            const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

            return (
                <div className="space-y-6 animate-in fade-in">
                     <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950 pb-2">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestão de Gastos</p>
                            </div>
                            <button onClick={openAddExpense} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                        </div>
                     </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">Orçamento Planejado</p>
                        <p className="text-3xl font-black text-primary dark:text-white">R$ {work.budgetPlanned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <div className="flex justify-between items-center mt-4">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Gasto</p>
                                <p className="text-xl font-bold text-red-600 dark:text-red-400">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Restante</p>
                                <p className={`text-xl font-bold ${work.budgetPlanned - totalExpenses < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    R$ {(work.budgetPlanned - totalExpenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {expenses.map(expense => {
                                const stepName = steps.find(s => s.id === expense.stepId)?.name || 'Geral';
                                const workerOrSupplierName = (workers.find(w => w.id === expense.workerId)?.name || suppliers.find(s => s.id === expense.supplierId)?.name || 'Não associado');

                                return (
                                    <li key={expense.id} onClick={() => openEditExpense(expense)} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                        <div className="flex items-center gap-3 mb-2 md:mb-0">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                <i className="fa-solid fa-dollar-sign text-slate-500"></i>
                                            </div>
                                            <div>
                                                <p className="font-bold text-primary dark:text-white leading-tight">{expense.description}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {expense.category} • {parseDateNoTimezone(expense.date)} • Etapa: {stepName}
                                                </p>
                                                {workerOrSupplierName !== 'Não associado' && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        Associado a: {workerOrSupplierName}
                                                    </p>
                                                )}
                                            </div>
                                        </div> {/* FIX: Added missing closing div tag here. */}
                                        <span className="font-bold text-primary dark:text-white whitespace-nowrap">R$ {Number(expense.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            );
        }

        if (activeTab === 'MORE') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-4 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Mais Ferramentas</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Recursos Adicionais</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={() => setSubView('TEAM')} className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-secondary transition-colors">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-users text-xl"></i>
                            </div>
                            <div>
                                <p className="font-bold text-primary dark:text-white text-lg leading-tight">Equipe</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Gerencie profissionais e mão de obra.</p>
                            </div>
                            <i className="fa-solid fa-arrow-right ml-auto text-slate-400 group-hover:text-secondary transition-colors"></i>
                        </button>
                        <button onClick={() => setSubView('SUPPLIERS')} className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-secondary transition-colors">
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-truck-fast text-xl"></i>
                            </div>
                            <div>
                                <p className="font-bold text-primary dark:text-white text-lg leading-tight">Fornecedores</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Mantenha seus contatos e orçamentos organizados.</p>
                            </div>
                            <i className="fa-solid fa-arrow-right ml-auto text-slate-400 group-hover:text-secondary transition-colors"></i>
                        </button>
                        <button onClick={() => setSubView('REPORTS')} className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-secondary transition-colors">
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-chart-pie text-xl"></i>
                            </div>
                            <div>
                                <p className="font-bold text-primary dark:text-white text-lg leading-tight">Relatórios</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Visão geral e exportação de dados da obra.</p>
                            </div>
                            <i className="fa-solid fa-arrow-right ml-auto text-slate-400 group-hover:text-secondary transition-colors"></i>
                        </button>
                        <button onClick={() => setSubView('PHOTOS')} className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-secondary transition-colors">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-camera text-xl"></i>
                            </div>
                            <div>
                                <p className="font-bold text-primary dark:text-white text-lg leading-tight">Fotos</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Registre o antes, durante e depois da sua obra.</p>
                            </div>
                            <i className="fa-solid fa-arrow-right ml-auto text-slate-400 group-hover:text-secondary transition-colors"></i>
                        </button>
                        <button onClick={() => setSubView('PROJECTS')} className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-secondary transition-colors">
                            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/20 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-file-alt text-xl"></i>
                            </div>
                            <div>
                                <p className="font-bold text-primary dark:text-white text-lg leading-tight">Projetos & Docs</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Armazene plantas, licenças e outros documentos.</p>
                            </div>
                            <i className="fa-solid fa-arrow-right ml-auto text-slate-400 group-hover:text-secondary transition-colors"></i>
                        </button>
                        <button onClick={() => isPremium ? setSubView('CALCULATORS') : setZeModal({isOpen: true, title: "Acesso Restrito", message: "Calculadoras avançadas estão disponíveis apenas no Plano Vitalício.", confirmText: "Entendido", onConfirm: () => setZeModal(prev => ({...prev, isOpen: false})), onCancel: () => setZeModal(prev => ({...prev, isOpen: false}))})} className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-premium transition-colors">
                            <div className="w-12 h-12 rounded-full bg-premium-light/30 dark:bg-premium-dark text-premium flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-calculator text-xl"></i>
                            </div>
                            <div>
                                <p className="font-bold text-primary dark:text-white text-lg leading-tight">Calculadoras <span className="text-[10px] text-premium-dark bg-premium-light/20 px-2 py-0.5 rounded-full ml-1 font-black uppercase">Vitalício</span></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Ferramentas para dimensionamento e orçamento rápido.</p>
                            </div>
                            <i className="fa-solid fa-lock ml-auto text-premium transition-colors"></i>
                        </button>
                        <button onClick={() => isPremium ? setSubView('CONTRACTS') : setZeModal({isOpen: true, title: "Acesso Restrito", message: "Modelos de contratos estão disponíveis apenas no Plano Vitalício.", confirmText: "Entendido", onConfirm: () => setZeModal(prev => ({...prev, isOpen: false})), onCancel: () => setZeModal(prev => ({...prev, isOpen: false}))})} className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-premium transition-colors">
                            <div className="w-12 h-12 rounded-full bg-premium-light/30 dark:bg-premium-dark text-premium flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-file-contract text-xl"></i>
                            </div>
                            <div>
                                <p className="font-bold text-primary dark:text-white text-lg leading-tight">Contratos <span className="text-[10px] text-premium-dark bg-premium-light/20 px-2 py-0.5 rounded-full ml-1 font-black uppercase">Vitalício</span></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Modelos prontos para sua equipe e fornecedores.</p>
                            </div>
                            <i className="fa-solid fa-lock ml-auto text-premium transition-colors"></i>
                        </button>
                        <button onClick={() => isPremium ? setSubView('CHECKLIST') : setZeModal({isOpen: true, title: "Acesso Restrito", message: "Checklists de qualidade estão disponíveis apenas no Plano Vitalício.", confirmText: "Entendido", onConfirm: () => setZeModal(prev => ({...prev, isOpen: false})), onCancel: () => setZeModal(prev => ({...prev, isOpen: false}))})} className="group flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-premium transition-colors">
                            <div className="w-12 h-12 rounded-full bg-premium-light/30 dark:bg-premium-dark text-premium flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <i className="fa-solid fa-list-check text-xl"></i>
                            </div>
                            <div>
                                <p className="font-bold text-primary dark:text-white text-lg leading-tight">Checklists <span className="text-[10px] text-premium-dark bg-premium-light/20 px-2 py-0.5 rounded-full ml-1 font-black uppercase">Vitalício</span></p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Verifique cada etapa com listas detalhadas.</p>
                            </div>
                            <i className="fa-solid fa-lock ml-auto text-premium transition-colors"></i>
                        </button>
                    </div>
                </div>
            );
        }
        return null;
    };

    // --- RENDER SUB VIEWS (TEAM, SUPPLIERS, REPORTS, PHOTOS, PROJECTS, CALCULATORS, CONTRACTS, CHECKLIST) ---
    const renderSubView = () => {
        if (!work) return null; // Ensure work data is available

        // Reset subView to NONE when clicking on a main tab
        const handleBackToMore = () => setSubView('NONE');

        switch (subView) {
            case 'TEAM':
                return (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleBackToMore} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                            <h2 className="text-2xl font-black text-primary dark:text-white flex-1 text-center">Equipe</h2>
                            <button onClick={() => openPersonModal('WORKER')} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                        </div>
                        <div className="space-y-4">
                            {workers.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-8">Nenhum profissional cadastrado.</p>}
                            {workers.map(worker => (
                                <div key={worker.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-primary dark:text-white">{worker.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{worker.role} • {worker.phone}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openPersonModal('WORKER', worker)} className="text-slate-400 hover:text-secondary"><i className="fa-solid fa-pen-to-square"></i></button>
                                        <button onClick={() => handleDeletePerson(worker.id, work.id, 'WORKER')} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash-alt"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'SUPPLIERS':
                return (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleBackToMore} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                            <h2 className="text-2xl font-black text-primary dark:text-white flex-1 text-center">Fornecedores</h2>
                            <button onClick={() => openPersonModal('SUPPLIER')} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                        </div>
                        <div className="space-y-4">
                            {suppliers.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-8">Nenhum fornecedor cadastrado.</p>}
                            {suppliers.map(supplier => (
                                <div key={supplier.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-primary dark:text-white">{supplier.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{supplier.category} • {supplier.phone}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openPersonModal('SUPPLIER', supplier)} className="text-slate-400 hover:text-secondary"><i className="fa-solid fa-pen-to-square"></i></button>
                                        <button onClick={() => handleDeletePerson(supplier.id, work.id, 'SUPPLIER')} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash-alt"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'REPORTS':
                return (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6 print:hidden">
                            <button onClick={handleBackToMore} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                            <h2 className="text-2xl font-black text-primary dark:text-white flex-1 text-center">Relatórios</h2>
                            <div className="flex gap-2">
                                <button onClick={handleExportExcel} className="bg-green-600 text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-file-excel"></i></button>
                                <button onClick={handlePrintPDF} className="bg-red-600 text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-file-pdf"></i></button>
                            </div>
                        </div>

                        {/* Title for print */}
                        <div className="hidden print:block text-center mb-8">
                            <h1 className="text-3xl font-black text-slate-900">Relatórios da Obra: {work.name}</h1>
                            <p className="text-lg text-slate-600">Período: {parseDateNoTimezone(work.startDate)} - {parseDateNoTimezone(work.endDate)}</p>
                            <p className="text-sm text-slate-500">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                        </div>

                        {stats && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3 print:gap-2">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center print:border print:p-2 print:rounded-lg">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1 print:text-[10px]">Progresso</p>
                                    <p className="text-3xl font-black text-secondary print:text-xl">{stats.progress}%</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center print:border print:p-2 print:rounded-lg">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1 print:text-[10px]">Orçamento</p>
                                    <p className="text-3xl font-black text-primary dark:text-white print:text-xl">R$ {work.budgetPlanned.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center print:border print:p-2 print:rounded-lg">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1 print:text-[10px]">Gasto Total</p>
                                    <p className="text-3xl font-black text-red-600 dark:text-red-400 print:text-xl">R$ {stats.totalSpent.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-6 print:hidden">
                            <button onClick={() => setReportActiveTab('CRONOGRAMA')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${reportActiveTab === 'CRONOGRAMA' ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                                Cronograma
                            </button>
                            <button onClick={() => setReportActiveTab('MATERIAIS')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${reportActiveTab === 'MATERIAIS' ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                                Materiais
                            </button>
                            <button onClick={() => setReportActiveTab('FINANCEIRO')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${reportActiveTab === 'FINANCEIRO' ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                                Financeiro
                            </button>
                        </div>

                        {reportActiveTab === 'CRONOGRAMA' && <RenderCronogramaReport steps={steps} materials={materials} expenses={expenses} workers={workers} suppliers={suppliers} work={work} today={today} parseDateNoTimezone={parseDateNoTimezone} />}
                        <div className="hidden print:block"><RenderCronogramaReport steps={steps} materials={materials} expenses={expenses} workers={workers} suppliers={suppliers} work={work} today={today} parseDateNoTimezone={parseDateNoTimezone} /></div> 
                        {reportActiveTab === 'MATERIAIS' && <RenderMateriaisReport steps={steps} materials={materials} expenses={expenses} workers={workers} suppliers={suppliers} work={work} today={today} parseDateNoTimezone={parseDateNoTimezone} />}
                        <div className="hidden print:block"><RenderMateriaisReport steps={steps} materials={materials} expenses={expenses} workers={workers} suppliers={suppliers} work={work} today={today} parseDateNoTimezone={parseDateNoTimezone} /></div> 
                        {reportActiveTab === 'FINANCEIRO' && <RenderFinanceiroReport steps={steps} materials={materials} expenses={expenses} workers={workers} suppliers={suppliers} work={work} today={today} parseDateNoTimezone={parseDateNoTimezone} />}
                        <div className="hidden print:block"><RenderFinanceiroReport steps={steps} materials={materials} expenses={expenses} workers={workers} suppliers={suppliers} work={work} today={today} parseDateNoTimezone={parseDateNoTimezone} /></div> 

                    </div>
                );
            case 'PHOTOS':
                return (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleBackToMore} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                            <h2 className="text-2xl font-black text-primary dark:text-white flex-1 text-center">Fotos da Obra</h2>
                            <label htmlFor="photo-upload" className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform cursor-pointer">
                                {uploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                                <input id="photo-upload" type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFileUpload(e, 'PHOTO')} />
                            </label>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {photos.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 col-span-full py-8">Nenhuma foto adicionada.</p>}
                            {photos.map(photo => (
                                <div key={photo.id} className="relative group overflow-hidden rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                                    <img src={photo.url} alt={photo.description} className="w-full h-48 object-cover transition-transform group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                        {photo.description} - {parseDateNoTimezone(photo.date)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'PROJECTS':
                return (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleBackToMore} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                            <h2 className="text-2xl font-black text-primary dark:text-white flex-1 text-center">Projetos & Docs</h2>
                            <label htmlFor="file-upload" className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform cursor-pointer">
                                {uploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                                <input id="file-upload" type="file" className="hidden" disabled={uploading} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFileUpload(e, 'FILE')} />
                            </label>
                        </div>
                        <div className="space-y-4">
                            {files.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-8">Nenhum arquivo adicionado.</p>}
                            {files.map(file => (
                                <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:border-secondary transition-colors group">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 group-hover:text-secondary">
                                        <i className="fa-solid fa-file-alt text-xl"></i>
                                    </div>
                                    <div>
                                        <p className="font-bold text-primary dark:text-white">{file.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{file.category} • {parseDateNoTimezone(file.date)}</p>
                                    </div>
                                    <i className="fa-solid fa-download ml-auto text-slate-400 group-hover:text-secondary"></i>
                                </a>
                            ))}
                        </div>
                    </div>
                );
            case 'CALCULATORS':
                return (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleBackToMore} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                            <h2 className="text-2xl font-black text-primary dark:text-white flex-1 text-center">Calculadoras</h2>
                            <div className="w-10"></div>{/* Placeholder to balance layout */}
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-around items-center mb-6 bg-slate-50 dark:bg-slate-800 rounded-xl p-2">
                                <button onClick={() => setCalcType('PISO')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${calcType === 'PISO' ? 'bg-secondary text-white shadow' : 'text-slate-500'}`}>Piso</button>
                                <button onClick={() => setCalcType('PAREDE')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${calcType === 'PAREDE' ? 'bg-secondary text-white shadow' : 'text-slate-500'}`}>Parede</button>
                                <button onClick={() => setCalcType('PINTURA')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${calcType === 'PINTURA' ? 'bg-secondary text-white shadow' : 'text-slate-500'}`}>Pintura</button>
                            </div>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Área em m²</label>
                                <input type="number" value={calcArea} onChange={e => setCalcArea(e.target.value)} placeholder="Ex: 15.5" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            {calcResult.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                    <h3 className="font-bold text-primary dark:text-white mb-2">Resultado:</h3>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                        {calcResult.map((res, idx) => <li key={idx}>{res}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'CONTRACTS':
                return (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleBackToMore} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                            <h2 className="text-2xl font-black text-primary dark:text-white flex-1 text-center">Contratos</h2>
                            <div className="w-10"></div>
                        </div>
                        <div className="space-y-4">
                            {CONTRACT_TEMPLATES.map(template => (
                                <button key={template.id} onClick={() => setViewContract({title: template.title, content: template.contentTemplate})} className="group bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:border-secondary transition-colors w-full text-left">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 group-hover:text-secondary">
                                        <i className="fa-solid fa-file-contract text-xl"></i>
                                    </div>
                                    <div>
                                        <p className="font-bold text-primary dark:text-white">{template.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{template.description}</p>
                                    </div>
                                    <i className="fa-solid fa-arrow-right ml-auto text-slate-400 group-hover:text-secondary"></i>
                                </button>
                            ))}
                        </div>
                        {viewContract && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                        <h3 className="text-xl font-bold text-primary dark:text-white">{viewContract.title}</h3>
                                        <button onClick={() => setViewContract(null)} className="text-slate-400 hover:text-primary dark:hover:text-white text-xl"><i className="fa-solid fa-xmark"></i></button>
                                    </div>
                                    <div className="flex-1 p-6 overflow-y-auto text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                        {viewContract.content}
                                    </div>
                                    <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                                        <button onClick={() => navigator.clipboard.writeText(viewContract.content).then(() => alert('Contrato copiado!')).catch(err => console.error(err))} className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors">Copiar Contrato</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'CHECKLIST':
                return (
                    <div className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={handleBackToMore} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                            <h2 className="text-2xl font-black text-primary dark:text-white flex-1 text-center">Checklists</h2>
                            <div className="w-10"></div>
                        </div>
                        <div className="space-y-4">
                            {STANDARD_CHECKLISTS.map(checklist => (
                                <button key={checklist.category} onClick={() => setActiveChecklist(checklist.category)} className="group bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:border-secondary transition-colors w-full text-left">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 group-hover:text-secondary">
                                        <i className="fa-solid fa-list-check text-xl"></i>
                                    </div>
                                    <div>
                                        <p className="font-bold text-primary dark:text-white">{checklist.category}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{checklist.items.length} itens</p>
                                    </div>
                                    <i className="fa-solid fa-arrow-right ml-auto text-slate-400 group-hover:text-secondary"></i>
                                </button>
                            ))}
                        </div>
                        {activeChecklist && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                        <h3 className="text-xl font-bold text-primary dark:text-white">{activeChecklist}</h3>
                                        <button onClick={() => setActiveChecklist(null)} className="text-slate-400 hover:text-primary dark:hover:text-white text-xl"><i className="fa-solid fa-xmark"></i></button>
                                    </div>
                                    <div className="flex-1 p-6 overflow-y-auto">
                                        {STANDARD_CHECKLISTS.find(c => c.category === activeChecklist)?.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                                                <input type="checkbox" id={`check-item-${idx}`} className="form-checkbox h-5 w-5 text-secondary rounded border-slate-300 focus:ring-secondary" />
                                                <label htmlFor={`check-item-${idx}`} className="text-sm text-primary dark:text-white flex-1">{item}</label>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                                        <button onClick={() => setActiveChecklist(null)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-primary dark:text-white font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Fechar</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'NONE':
                return renderMainTab();
            default:
                return null;
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-12 pt-4 px-4">
            <div className="flex items-center justify-between mb-8 print:hidden">
                <button onClick={() => navigate('/')} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                <div className="flex-1 text-center">
                    <h1 className="text-2xl font-black text-primary dark:text-white leading-tight">{work.name}</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{work.address}</p>
                </div>
                <div className="w-6"></div> 
            </div>

            <div className="print:hidden">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-6">
                    <button onClick={() => { setActiveTab('SCHEDULE'); setSubView('NONE'); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'SCHEDULE' ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                        Cronograma
                    </button>
                    <button onClick={() => { setActiveTab('MATERIALS'); setSubView('NONE'); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'MATERIALS' ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                        Materiais
                    </button>
                    <button onClick={() => { setActiveTab('FINANCIAL'); setSubView('NONE'); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'FINANCIAL' ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                        Financeiro
                    </button>
                    <button onClick={() => { setActiveTab('MORE'); setSubView('NONE'); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'MORE' ? 'bg-white dark:bg-slate-900 text-primary dark:text-white shadow' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                        Mais
                    </button>
                </div>
            </div>
            
            {subView === 'NONE' ? renderMainTab() : renderSubView()}

            {/* Step Modal */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{stepModalMode === 'ADD' ? 'Adicionar Etapa' : 'Editar Etapa'}</h3>
                        <form onSubmit={handleSaveStep} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Etapa</label>
                                <input type="text" value={stepName} onChange={e => setStepName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                                    <input type="date" value={stepStart} onChange={e => setStepStart(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                                    <input type="date" value={stepEnd} onChange={e => setStepEnd(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setIsStepModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-primary dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Material Modal */}
            {addMatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Adicionar Material</h3>
                        <form onSubmit={handleAddMaterial} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Material</label>
                                <input type="text" value={newMatName} onChange={e => setNewMatName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Marca (Opcional)</label>
                                <input type="text" value={newMatBrand} onChange={e => setNewMatBrand(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. Planejada</label>
                                    <input type="number" value={newMatQty} onChange={e => setNewMatQty(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade</label>
                                    <input type="text" value={newMatUnit} onChange={e => setNewMatUnit(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Associar à Etapa (Opcional)</label>
                                <select value={newMatStepId} onChange={e => setNewMatStepId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all">
                                    <option value="">Nenhuma</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="buy-now" checked={newMatBuyNow} onChange={e => setNewMatBuyNow(e.target.checked)} className="form-checkbox h-5 w-5 text-secondary rounded border-slate-300 focus:ring-secondary" />
                                <label htmlFor="buy-now" className="text-sm text-primary dark:text-white">Registrar compra agora?</label>
                            </div>
                            {newMatBuyNow && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. Comprada Agora</label>
                                        <input type="number" value={newMatBuyQty} onChange={e => setNewMatBuyQty(e.target.value)} required={newMatBuyNow} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Total da Compra (R$)</label>
                                        <input type="number" value={newMatBuyCost} onChange={e => setNewMatBuyCost(e.target.value)} required={newMatBuyNow} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setAddMatModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-primary dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors">Adicionar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Material Detail/Update Modal */}
            {materialModal.isOpen && materialModal.material && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Editar Material</h3>
                        <form onSubmit={handleUpdateMaterial} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Material</label>
                                <input type="text" value={matName} onChange={e => setMatName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Marca (Opcional)</label>
                                <input type="text" value={matBrand} onChange={e => setMatBrand(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. Planejada</label>
                                    <input type="number" value={matPlannedQty} onChange={e => setMatPlannedQty(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade</label>
                                    <input type="text" value={matUnit} onChange={e => setMatUnit(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Registrar Nova Compra</h4>
                                <div className="p-3 mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                                    <i className="fa-solid fa-info-circle mr-2"></i>
                                    Qtd. Comprada Atual: {materialModal.material.purchasedQty} {materialModal.material.unit}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. Comprada Agora</label>
                                        <input type="number" value={matBuyQty} onChange={e => setMatBuyQty(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Total da Compra (R$)</label>
                                        <input type="number" value={matBuyCost} onChange={e => setMatBuyCost(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setMaterialModal({isOpen: false, material: null})} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-primary dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Fechar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Expense Modal (Add/Edit) */}
            {expenseModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{expenseModal.mode === 'ADD' ? 'Adicionar Gasto' : 'Editar Gasto'}</h3>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                                <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            {expenseModal.mode === 'EDIT' && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                                    <i className="fa-solid fa-info-circle mr-2"></i>
                                    Valor já lançado: R$ {expSavedAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor a Lançar (R$)</label>
                                <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} required={expenseModal.mode === 'ADD'} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total Acordado (R$ - Opcional)</label>
                                <input type="number" value={expTotalAgreed} onChange={e => setExpTotalAgreed(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                                <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all">
                                    {Object.values(ExpenseCategory).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Associar à Etapa (Opcional)</label>
                                <select value={expStepId} onChange={e => setExpStepId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all">
                                    <option value="">Nenhuma</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div className="flex gap-3 mt-6">
                                {expenseModal.mode === 'EDIT' && (
                                    <button type="button" onClick={handleDeleteExpense} className="flex-1 py-3 rounded-xl bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors">Excluir</button>
                                )}
                                <button type="button" onClick={() => setExpenseModal({isOpen: false, mode: 'ADD'})} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-primary dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Person Modal (Worker/Supplier) */}
            {isPersonModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{personId ? 'Editar ' : 'Adicionar '}{personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}</h3>
                        <form onSubmit={handleSavePerson} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                                <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{personMode === 'WORKER' ? 'Função' : 'Categoria'}</label>
                                <select value={personRole} onChange={e => setPersonRole(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all">
                                    {(personMode === 'WORKER' ? STANDARD_JOB_ROLES : STANDARD_SUPPLIER_CATEGORIES).map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                                <input type="text" value={personPhone} onChange={e => setPersonPhone(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações (Opcional)</label>
                                <textarea value={personNotes} onChange={e => setPersonNotes(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all"></textarea>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setIsPersonModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-primary dark:text-white font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <ZeModal {...zeModal} />
        </div>
    );
};

export default WorkDetail;