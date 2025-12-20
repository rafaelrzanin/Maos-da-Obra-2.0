
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx'; 
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, PlanType, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile } from '../types.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx'; // Importa ZeModalProps
import { STANDARD_CHECKLISTS, CONTRACT_TEMPLATES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';
// Removed aiService import as it's no longer used directly in this component

// --- TYPES FOR VIEW STATE ---
type MainTab = 'SCHEDULE' | 'MATERIALS' | 'FINANCIAL' | 'MORE';
// Fix: Removed 'BONUS_IA' and 'BONUS_IA_CHAT' as AI chat is now a dedicated page.
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';
// NEW: State for active tab within the reports section for mobile
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO';

// --- DATE HELPERS ---
const parseDateNoTimezone = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    }
    return dateStr;
};

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    // Fix: Destructure trialDaysRemaining from useAuth to resolve 'hasAiAccess' error.
    const { user, trialDaysRemaining, authLoading } = useAuth(); // Use authLoading
    
    // --- CORE DATA STATE ---
    const [work, setWork] = useState<Work | null>(null);
    const [loading, setLoading] = useState(true);
    const [steps, setSteps] = useState<Step[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const [files, setFiles] = useState<WorkFile[]>([]);
    // Dashboard Stats for Report
    const [stats, setStats] = useState<{ totalSpent: number, progress: number, delayedSteps: number } | null>(null);

    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<MainTab>('SCHEDULE');
    // Fix: Removed 'BONUS_IA' and 'BONUS_IA_CHAT' from SubView.
    const [subView, setSubView] = useState<SubView>('NONE');
    const [uploading, setUploading] = useState(false);
    // NEW: State for active tab within the reports section for mobile
    const [reportActiveTab, setReportActiveTab] = useState<ReportSubTab>('CRONOGRAMA');
    
    // --- AI ACCESS LOGIC ---
    const isVitalicio = user?.plan === PlanType.VITALICIO;
    const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
    const hasAiAccess = isVitalicio || isAiTrialActive;

    // --- PREMIUM TOOLS LOCK ---
    // isPremium is used for non-AI premium tools (Calculators, Contracts, Checklist)
    const isPremium = isVitalicio;

    // --- MODALS STATE ---
    const [stepModalMode, setStepModalMode] = useState<'ADD' | 'EDIT'>('ADD');
    const [isStepModalOpen, setIsStepModalOpen] = useState(false);
    const [currentStepId, setCurrentStepId] = useState<string | null>(null);
    const [stepName, setStepName] = useState('');
    const [stepStart, setStepStart] = useState('');
    const [stepEnd, setStepEnd] = useState('');
    
    // Material Filter (Main Tab)
    const [materialFilterStepId, setMaterialFilterStepId] = useState<string>('ALL');
    
    // Report Filter
    // Removed reportTab and reportMaterialFilterStepId states as they are replaced by fixed columns
    // const [reportTab, setReportTab] = useState<'CRONO'|'MAT'|'FIN'>('CRONO');
    // const [reportMaterialFilterStepId, setReportMaterialFilterStepId] = useState<string>('ALL');


    const [materialModal, setMaterialModal] = useState<{ isOpen: boolean, material: Material | null }>({ isOpen: false, material: null });
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
    const [newMatStepId, setNewMatStepId] = useState(''); // Fix: Declared newMatStepId state
    const [newMatBuyNow, setNewMatBuyNow] = useState(false);
    const [newMatBuyQty, setNewMatBuyQty] = useState('');
    // Fix: Corrected useState hook declaration
    const [newMatBuyCost, setNewMatBuyCost] = useState('');

    // EXPENSE MODAL STATE
    const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean, mode: 'ADD'|'EDIT', id?: string }>({ isOpen: false, mode: 'ADD' });
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expTotalAgreed, setExpTotalAgreed] = useState('');
    const [expCategory, setExpCategory] = useState<string>(ExpenseCategory.LABOR);
    const [expStepId, setExpStepId] = useState('');
    // Fix: Declare expDate state variable
    const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
    // NEW STATE: Tracks the amount already in DB to support cumulative logic
    const [expSavedAmount, setExpSavedAmount] = useState(0);

    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personMode, setPersonMode] = useState<'WORKER'|'SUPPLIER'>('WORKER');
    const [personId, setPersonId] = useState<string | null>(null); 
    const [personName, setPersonName] = useState('');
    const [personRole, setPersonRole] = useState('');
    const [personPhone, setPersonPhone] = useState('');
    const [personNotes, setPersonNotes] = useState('');

    const [viewContract, setViewContract] = useState<{title: string, content: string} | null>(null);
    // Fix: Updated the type of zeModal state to explicitly use ZeModalProps.
    const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string }>({ 
        isOpen: false, 
        title: '', 
        message: '',
        onCancel: () => {}, // Necessário para satisfazer ZeModalProps
    });

    // AI & TOOLS
    // Fix: Removed AI-related states as AI chat is now a dedicated page.
    const [calcType, setCalcType] = useState<'PISO'|'PAREDE'|'PINTURA'>('PISO');
    const [calcArea, setCalcArea] = useState('');
    const [calcResult, setCalcResult] = useState<string[]>([]);
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    // --- LOAD DATA ---
    const load = async () => {
        if (!id || authLoading) return; // Wait for AuthContext to finish loading
        
        const w = await dbService.getWorkById(id);
        setWork(w || null);
        
        if (w) {
            const [s, m, e, wk, sp, ph, fl, workStats] = await Promise.all([ // Added workStats to parallel fetch
                dbService.getSteps(w.id),
                dbService.getMaterials(w.id),
                dbService.getExpenses(w.id),
                dbService.getWorkers(w.userId),
                dbService.getSuppliers(w.userId),
                dbService.getPhotos(w.id),
                dbService.getFiles(w.id),
                dbService.calculateWorkStats(w.id) // Fetch work stats here
            ]);
            
            setSteps(s ? s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) : []);
            setMaterials(m || []);
            setExpenses(e ? e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : []);
            setWorkers(wk || []);
            setSuppliers(sp || []);
            setPhotos(ph || []);
            setFiles(fl || []);
            setStats(workStats); // Set dashboard stats
        }
        setLoading(false);
    };

    // Fix: Re-added authLoading to dependency array as its presence is critical for loading state
    useEffect(() => { load(); }, [id, authLoading]);

    // --- HANDLERS ---

    const handleSaveStep = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !stepName) return;

        if (stepModalMode === 'ADD') {
            // REMOVED CLIENT-SIDE ID GENERATION
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

    const handleAddMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !newMatName) return;
        // REMOVED CLIENT-SIDE ID GENERATION from the mat object
        const mat: Omit<Material, 'id'> = { // Explicitly define type to omit id
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
        // Fix: Reset newMatStepId as well
        setNewMatStepId('');
        await load();
    };

    const handleUpdateMaterial = async (e: React.FormEvent) => {
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
            await load(); // Reload all data after successful update/purchase
        } catch (error: any) {
            console.error("Erro ao salvar material:", error);
            alert(`Falha ao salvar material: ${error.message || "Erro desconhecido."}`);
        }
    };

    const openAddExpense = () => {
        setExpenseModal({ isOpen: true, mode: 'ADD' });
        setExpDesc('');
        setExpAmount('');
        setExpSavedAmount(0); // Reset saved amount for new
        setExpTotalAgreed('');
        setExpCategory(ExpenseCategory.LABOR);
        setExpStepId('');
        // Fix: Set expDate for new expense
        setExpDate(new Date().toISOString().split('T')[0]);
    };

    const openEditExpense = (expense: Expense) => {
        setExpenseModal({ isOpen: true, mode: 'EDIT', id: expense.id });
        setExpDesc(expense.description);
        
        // CUMULATIVE LOGIC:
        // Set input to empty so user adds NEW payment.
        // Save current DB total to expSavedAmount.
        setExpAmount(''); 
        setExpSavedAmount(expense.amount); 
        
        setExpTotalAgreed(expense.totalAgreed ? String(expense.totalAgreed) : '');
        setExpCategory(expense.category);
        setExpStepId(expense.stepId || '');
        // Fix: Set expDate when opening for edit
        setExpDate(expense.date.split('T')[0]);
    };

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !expDesc) return;
        
        const finalStepId = expStepId || undefined;
        const finalTotalAgreed = expTotalAgreed ? Number(expTotalAgreed) : undefined;
        const inputAmount = Number(expAmount) || 0;

        try {
            if (expenseModal.mode === 'ADD') {
                // REMOVED CLIENT-SIDE ID GENERATION
                await dbService.addExpense({
                    workId: work.id,
                    description: expDesc,
                    amount: inputAmount,
                    // Fix: Use expDate from state
                    date: new Date(expDate).toISOString(),
                    category: expCategory,
                    stepId: finalStepId,
                    totalAgreed: finalTotalAgreed
                });
            } else if (expenseModal.mode === 'EDIT' && expenseModal.id) {
                const existing = expenses.find(e => e.id === expenseModal.id);
                if (existing) {
                    // LOGIC: New Total = Old Saved Total + New Input
                    const newTotalAmount = expSavedAmount + inputAmount;

                    await dbService.updateExpense({
                        ...existing,
                        description: expDesc,
                        amount: newTotalAmount,
                        // Fix: Use expDate from state
                        date: new Date(expDate).toISOString(),
                        category: expCategory,
                        stepId: finalStepId,
                        totalAgreed: finalTotalAgreed // Fixed typo here
                    });
                }
            }
            setExpenseModal({ isOpen: false, mode: 'ADD' });
            await load(); // Reload all data after successful save/update
        } catch (error: any) {
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
                    // REMOVED CLIENT-SIDE ID GENERATION
                    await dbService.addPhoto({
                        workId: work.id,
                        url: base64,
                        description: 'Foto da obra',
                        date: new Date().toISOString(),
                        type: 'PROGRESS'
                    });
                } else {
                    // REMOVED CLIENT-SIDE ID GENERATION
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

    const handleSavePerson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work) return;

        const payload = {
            userId: work.userId,
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

    const handleDeletePerson = (id: string, mode: 'WORKER' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true,
            title: mode === 'WORKER' ? 'Excluir Profissional' : 'Excluir Fornecedor',
            message: 'Tem certeza? Essa ação não pode ser desfeita.',
            onConfirm: async () => {
                if (mode === 'WORKER') await dbService.deleteWorker(id);
                else await dbService.deleteSupplier(id);
                await load();
                setZeModal(prev => ({ ...prev, isOpen: false, onCancel: () => {} })); // Reset onCancel when modal closes
            },
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false, onCancel: () => {} })) // Also reset onCancel for cancel action
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
        const wsCrono = XLSX.utils.json_to_sheet(steps.map(s => ({ Etapa: s.name, Inicio: parseDateNoTimezone(s.startDate), Fim: parseDateNoTimezone(s.endDate), Status: s.status })));
        XLSX.utils.book_append_sheet(wb, wsCrono, "Cronograma");
        const wsMat = XLSX.utils.json_to_sheet(materials.map(m => ({ Material: m.name, Qtd: m.plannedQty, Comprado: m.purchasedQty })));
        XLSX.utils.book_append_sheet(wb, wsMat, "Materiais");
        const wsFin = XLSX.utils.json_to_sheet(expenses.map(e => ({ Descrição: e.description, Valor: e.amount, Categoria: e.category, Data: parseDateNoTimezone(e.date), Etapa: steps.find(s => s.id === e.stepId)?.name || 'N/A' })));
        XLSX.utils.book_append_sheet(wb, wsFin, "Financeiro");
        XLSX.writeFile(wb, `Obra_${work?.name}.xlsx`);
    };

    const handlePrintPDF = () => {
        window.print();
    };

    // Removed handleAiAsk as AI chat is now a dedicated page

    // Show loading if AuthContext is still loading OR if local work details are loading
    if (authLoading || loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return null;

    // --- RENDER CONTENT ---

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
                         const today = new Date().toISOString().split('T')[0];
                         const isDelayed = step.endDate < today && !isDone;

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
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Controle de Compras</p>
                            </div>
                            <button onClick={() => setAddMatModal(true)} className="bg-primary text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-primary-light transition-all shadow-lg shadow-primary/30"><i className="fa-solid fa-plus text-lg"></i></button>
                        </div>
                        
                        {/* STEP FILTER DROPDOWN */}
                        <div className="px-2">
                            <select 
                                value={materialFilterStepId}
                                onChange={(e) => setMaterialFilterStepId(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-600 dark:text-slate-300 shadow-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                            >
                                <option value="ALL">Todas as Etapas</option>
                                {steps.map((s, idx) => (
                                    <option key={s.id} value={s.id}>{String(idx+1).padStart(2, '0')}. {s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {filteredSteps.map((step) => {
                        const originalIdx = steps.findIndex(s => s.id === step.id); // For correct numbering
                        const stepMaterials = materials ? materials.filter(m => m.stepId === step.id) : [];
                        
                        if (stepMaterials.length === 0 && materialFilterStepId !== 'ALL') {
                            return <div key={step.id} className="text-center text-slate-400 py-8 italic text-sm">Sem materiais cadastrados nesta etapa.</div>;
                        }
                        if (stepMaterials.length === 0) return null;
                        
                        return (
                            <div key={step.id} className="mb-8 bg-white/50 dark:bg-slate-900/50 rounded-2xl p-2">
                                {/* Stronger Visual Separation for Step Header */}
                                <div className="flex items-center gap-3 mb-4 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border-l-4 border-secondary">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-secondary font-black text-sm flex items-center justify-center">
                                        {String(originalIdx+1).padStart(2,'0')}
                                    </div>
                                    <h3 className="font-bold text-lg text-primary dark:text-white uppercase tracking-tight">{step.name}</h3>
                                </div>

                                <div className="space-y-3 px-1">
                                    {stepMaterials.map(mat => {
                                        const hasPlanned = mat.plannedQty > 0;
                                        const purchased = mat.purchasedQty;
                                        const progress = hasPlanned ? Math.min(100, (purchased / mat.plannedQty) * 100) : 0;
                                        
                                        // Logic for Partial/Complete/Pending
                                        let statusText = 'Pendente';
                                        let statusColor = 'bg-slate-100 text-slate-500';
                                        let barColor = 'bg-slate-200';

                                        if (purchased >= mat.plannedQty) {
                                            statusText = 'Concluído';
                                            statusColor = 'bg-green-100 text-green-700';
                                            barColor = 'bg-green-500';
                                        } else if (purchased > 0) {
                                            statusText = 'Parcial';
                                            statusColor = 'bg-orange-100 text-orange-600';
                                            barColor = 'bg-secondary'; // Orange/Amber
                                        }

                                        return (
                                            <div key={mat.id} onClick={() => { setMaterialModal({isOpen: true, material: mat}); setMatName(mat.name); setMatBrand(mat.brand||''); setMatPlannedQty(String(mat.plannedQty)); setMatUnit(mat.unit); setMatBuyQty(''); setMatBuyCost(''); }} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${statusText === 'Concluído' ? 'border-green-200 dark:border-green-900/30' : 'border-slate-100 dark:border-slate-800'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div><div className="font-bold text-primary dark:text-white text-base leading-tight">{mat.name}</div>{mat.brand && <div className="text-xs text-slate-400 font-bold uppercase mt-0.5">{mat.brand}</div>}</div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColor}`}>{statusText}</span>
                                                </div>
                                                <div className="mt-3 flex items-center gap-3">
                                                    <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${progress}%` }}></div></div>
                                                    <div className="text-xs font-mono font-bold text-slate-500 whitespace-nowrap bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">{mat.purchasedQty}/{mat.plannedQty} {mat.unit}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
             );
        }

        if (activeTab === 'FINANCIAL') {
            return (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2 sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 py-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Fluxo de Caixa</p>
                        </div>
                        <button onClick={openAddExpense} className="bg-green-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-green-700 transition-all shadow-lg shadow-green-600/30"><i className="fa-solid fa-plus text-lg"></i></button>
                    </div>
                    
                    <div className="bg-gradient-premium p-6 rounded-3xl text-white shadow-xl relative overflow-hidden mb-8">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <p className="text-sm opacity-80 font-medium mb-1">Total Gasto na Obra</p>
                        <h3 className="text-4xl font-black mb-4 tracking-tight">R$ {expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                        <div className="flex items-center gap-2 text-xs opacity-70 bg-white/10 w-fit px-3 py-1 rounded-full"><i className="fa-solid fa-wallet"></i> Orçamento: R$ {work.budgetPlanned.toLocaleString('pt-BR')}</div>
                    </div>

                    {/* Grouped Financial Expenses by Step */}
                    {[...steps, { id: 'general', name: 'Despesas Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step, idx) => {
                        const stepExpenses = expenses.filter(e => {
                            if (step.id === 'general') return !e.stepId; // Expenses without stepId
                            return e.stepId === step.id;
                        });

                        if (stepExpenses.length === 0) return null;

                        const isGeneral = step.id === 'general';
                        const stepLabel = isGeneral ? step.name : `${String(idx + 1).padStart(2, '0')} Etapa: ${step.name}`;

                        return (
                            <div key={step.id} className="mb-6">
                                <div className="mb-3 pl-2 flex items-center gap-2">
                                    {!isGeneral && <div className="w-2 h-2 rounded-full bg-secondary"></div>}
                                    <h3 className={`font-bold uppercase tracking-wide ${isGeneral ? 'text-slate-400 text-xs' : 'text-primary dark:text-white text-sm'}`}>{stepLabel}</h3>
                                </div>
                                <div className="space-y-3">
                                    {stepExpenses.map(exp => {
                                        // PARTIAL PAYMENT LOGIC
                                        const isPartial = exp.totalAgreed && exp.totalAgreed > exp.amount;
                                        const progress = isPartial ? (exp.amount / exp.totalAgreed!) * 100 : 100;

                                        return (
                                            <div 
                                                key={exp.id} 
                                                onClick={() => openEditExpense(exp)}
                                                className="relative group bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-secondary/30"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${exp.category === ExpenseCategory.MATERIAL ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            <i className={`fa-solid ${exp.category === ExpenseCategory.MATERIAL ? 'fa-box' : 'fa-helmet-safety'}`}></i>
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-primary dark:text-white text-base leading-tight">{exp.description}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                                {exp.category} • {parseDateNoTimezone(exp.date.split('T')[0])}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {/* MAIN VALUE IS ALWAYS PAID AMOUNT */}
                                                        <span className="font-bold text-primary dark:text-white text-lg whitespace-nowrap">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                                
                                                {/* VISUAL FOR PARTIAL PAYMENTS */}
                                                {isPartial && (
                                                    <div className="mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                                                        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                                                            <span>Pago: R$ {exp.amount.toLocaleString('pt-BR')}</span>
                                                            <span>Total: R$ {exp.totalAgreed?.toLocaleString('pt-BR')}</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-orange-400 rounded-full" style={{width: `${progress}%`}}></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (activeTab === 'MORE') {
            return (
                <div className="space-y-8 animate-in fade-in">
                    <div className="px-2">
                        <h2 className="text-3xl font-black text-primary dark:text-white">Mais Opções</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Central de Controle</p>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Gestão Operacional</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setSubView('TEAM')} className="group p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-sm"><i className="fa-solid fa-helmet-safety"></i></div>
                                    <span className="font-bold text-base text-primary dark:text-white relative z-10">Equipe</span>
                                </button>
                                <button onClick={() => setSubView('SUPPLIERS')} className="group p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-sm"><i className="fa-solid fa-truck-fast"></i></div>
                                    <span className="font-bold text-base text-primary dark:text-white relative z-10">Fornecedores</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Documentação e Mídia</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <button onClick={() => setSubView('REPORTS')} className="group p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-indigo-100 transition-colors"><i className="fa-solid fa-file-lines"></i></div>
                                    <span className="font-bold text-xs text-primary dark:text-white">Relatórios</span>
                                </button>
                                <button onClick={() => setSubView('PHOTOS')} className="group p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-pink-100 transition-colors"><i className="fa-solid fa-camera-retro"></i></div>
                                    <span className="font-bold text-xs text-primary dark:text-white">Fotos</span>
                                </button>
                                <button onClick={() => setSubView('PROJECTS')} className="group p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-teal-100 transition-colors"><i className="fa-solid fa-folder-open"></i></div>
                                    <span className="font-bold text-xs text-primary dark:text-white">Projetos</span>
                                </button>
                            </div>
                        </div>

                        <div className="relative overflow-hidden rounded-[2rem] shadow-xl">
                            <div className="absolute inset-0 bg-gradient-premium"></div>
                            <div className="relative z-10 p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white shadow-lg shadow-secondary/30"><i className="fa-solid fa-crown"></i></div>
                                    <div><h3 className="text-lg font-black text-white uppercase tracking-tight">Área Premium</h3><p className="text-xs text-slate-400 font-medium">Ferramentas Exclusivas</p></div>
                                </div>
                                
                                {/* Zé da Obra AI */}
                                <div onClick={() => navigate('/ai-chat')} className="bg-white/10 hover:bg-white/15 p-4 rounded-2xl border border-white/10 mb-4 cursor-pointer flex items-center gap-4 transition-all backdrop-blur-sm group">
                                    <div className="relative">
                                        <img src={ZE_AVATAR} className={`w-14 h-14 rounded-full border-2 border-secondary bg-slate-800 object-cover ${!hasAiAccess ? 'grayscale opacity-70' : ''}`} onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} alt="Zé da Obra AI" />
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-800 rounded-full"></div>
                                    </div>
                                    <div><h4 className="font-bold text-white text-base group-hover:text-secondary transition-colors">Zé da Obra AI</h4><p className="text-xs text-slate-300">Tire dúvidas técnicas 24h</p></div>
                                    <div className="ml-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-secondary group-hover:text-white transition-all"><i className="fa-solid fa-chevron-right"></i></div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    {['CALCULATORS', 'CONTRACTS', 'CHECKLIST'].map(item => (
                                        <button key={item} onClick={() => setSubView(item as SubView)} disabled={!isPremium} className={`p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 flex flex-col items-center gap-2 text-center transition-colors group ${!isPremium ? 'opacity-70' : ''}`}>
                                            <i className={`fa-solid ${item === 'CALCULATORS' ? 'fa-calculator' : item === 'CONTRACTS' ? 'fa-file-signature' : 'fa-clipboard-check'} text-slate-300 group-hover:text-secondary text-2xl mb-1 transition-colors`}></i>
                                            <span className="text-[10px] font-bold text-white uppercase tracking-wide">{item === 'CALCULATORS' ? 'Calculadoras' : item === 'CONTRACTS' ? 'Contratos' : 'Checklist'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Fix: Consolidated multiple renderSubViewContent definitions into one.
    // This function is now responsible for rendering all sub-views based on the `subView` state.
    const renderSubViewContent = () => {
        const today = new Date().toISOString().split('T')[0]; // Define today once for date comparisons

        switch(subView) {
            case 'TEAM': return (
                <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900 mb-2">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-1">Minha Equipe</h3>
                        <button onClick={() => openPersonModal('WORKER')} className="w-full mt-4 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                            <i className="fa-solid fa-plus"></i> Adicionar Profissional
                        </button>
                    </div>
                    <div className="space-y-3">
                        {workers.length === 0 && <p className="text-center text-slate-400 py-10">Nenhum profissional cadastrado.</p>}
                        {workers.map(w => (
                            <div key={w.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => openPersonModal('WORKER', w)}>
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-xl"><i className="fa-solid fa-helmet-safety"></i></div>
                                    <div><h4 className="font-bold text-primary dark:text-white">{w.name}</h4><p className="text-xs text-slate-500 font-bold">{w.role}</p></div>
                                </div>
                                <div className="flex gap-2">
                                    {w.phone && (
                                        <a 
                                            href={`https://wa.me/55${w.phone.replace(/\D/g, '')}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="w-10 h-10 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-colors flex items-center justify-center"
                                        >
                                            <i className="fa-brands fa-whatsapp text-lg"></i>
                                        </a>
                                    )}
                                    <button onClick={() => handleDeletePerson(w.id, 'WORKER')} className="w-10 h-10 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><i className="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );

            case 'SUPPLIERS': return (
                <div className="space-y-6">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-3xl border border-amber-100 dark:border-amber-900 mb-2">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-1">Fornecedores</h3>
                        <button onClick={() => openPersonModal('SUPPLIER')} className="w-full mt-4 py-4 rounded-2xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2">
                            <i className="fa-solid fa-plus"></i> Adicionar Fornecedor
                        </button>
                    </div>
                    <div className="space-y-3">
                        {suppliers.length === 0 && <p className="text-center text-slate-400 py-10">Nenhum fornecedor cadastrado.</p>}
                        {suppliers.map(s => (
                            <div key={s.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => openPersonModal('SUPPLIER', s)}>
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-xl"><i className="fa-solid fa-store"></i></div>
                                    <div><h4 className="font-bold text-primary dark:text-white">{s.name}</h4><p className="text-xs text-slate-500 font-bold">{s.category}</p></div>
                                </div>
                                <div className="flex gap-2">
                                    {s.phone && (
                                        <a 
                                            href={`https://wa.me/55${s.phone.replace(/\D/g, '')}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="w-10 h-10 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-colors flex items-center justify-center"
                                        >
                                            <i className="fa-brands fa-whatsapp text-lg"></i>
                                        </a>
                                    )}
                                    <button onClick={() => handleDeletePerson(s.id, 'SUPPLIER')} className="w-10 h-10 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><i className="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );

            case 'REPORTS': 
            const workProgressPercentage = stats?.progress || 0; 

            return (
                <div className="space-y-6 animate-in fade-in">
                    {/* Report Dashboard Section */}
                    <div className="bg-gradient-premium rounded-3xl p-6 text-white shadow-xl relative overflow-hidden mb-8">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-black mb-1 text-secondary uppercase tracking-widest">Resumo da Obra</h3>
                            <h2 className="text-3xl font-black text-white leading-tight mb-4">{work.name}</h2>
                            
                            {/* NEW: Make this section stack on mobile (grid-cols-1 md:grid-cols-2) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20">
                                    <p className="text-xs font-bold uppercase text-white/70 mb-1">Total Gasto</p>
                                    <p className="text-2xl font-black">R$ {expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20">
                                    <p className="text-xs font-bold uppercase text-white/70 mb-1">Orçamento Planejado</p>
                                    <p className="text-2xl font-black">R$ {work.budgetPlanned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20 col-span-full"> {/* col-span-full instead of col-span-2 for responsiveness */}
                                     <p className="text-xs font-bold uppercase text-white/70 mb-1">Progresso Geral</p>
                                     <div className="h-3 bg-white/20 rounded-full overflow-hidden mb-2">
                                        <div className="h-full bg-secondary shadow-[0_0_10px_rgba(217,119,6,0.5)]" style={{ width: `${workProgressPercentage}%` }}></div>
                                     </div>
                                     <p className="text-sm font-bold">{workProgressPercentage}% Concluído</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Print/Export Buttons */}
                    <div className="flex justify-end gap-3 mb-6 no-print">
                        <button onClick={handleExportExcel} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
                            <i className="fa-solid fa-file-excel"></i> Exportar Excel
                        </button>
                        <button onClick={handlePrintPDF} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
                            <i className="fa-solid fa-print"></i> Imprimir PDF
                        </button>
                    </div>

                    {/* Report Content - MOBILE TABBED VIEW / DESKTOP 3-COLUMN */}
                    {/* NEW: Mobile Tab Navigation */}
                    <div className="lg:hidden no-print">
                        <div className="flex justify-around mb-4 bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
                            <button onClick={() => setReportActiveTab('CRONOGRAMA')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${reportActiveTab === 'CRONOGRAMA' ? 'bg-secondary text-white' : 'text-slate-500 dark:text-slate-400'}`}>Cronograma</button>
                            <button onClick={() => setReportActiveTab('MATERIAIS')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${reportActiveTab === 'MATERIAIS' ? 'bg-secondary text-white' : 'text-slate-500 dark:text-slate-400'}`}>Materiais</button>
                            <button onClick={() => setReportActiveTab('FINANCEIRO')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${reportActiveTab === 'FINANCEIRO' ? 'bg-secondary text-white' : 'text-slate-500 dark:text-slate-400'}`}>Financeiro</button>
                        </div>
                        
                        {/* Conditionally rendered content for mobile */}
                        {reportActiveTab === 'CRONOGRAMA' && (
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
                        )}

                        {reportActiveTab === 'MATERIAIS' && (
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
                        )}

                        {reportActiveTab === 'FINANCEIRO' && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
                                <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-dollar-sign text-secondary"></i> Financeiro
                                </h3>
                                <div className="space-y-6">
                                    {[...steps, { id: 'general-fin', name: 'Despesas Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step) => {
                                        const groupExpenses = expenses.filter(e => {
                                            if (step.id === 'general-fin') return !e.stepId;
                                            return e.stepId === step.id;
                                        });

                                        if (groupExpenses.length === 0) return null;

                                        const isGeneral = step.id === 'general-fin';
                                        const stepLabel = isGeneral ? step.name : `Etapa: ${step.name}`;

                                        return (
                                            <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                                <h4 className="font-bold text-primary dark:text-white text-sm uppercase tracking-wide mb-3">{stepLabel}</h4>
                                                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                                    {groupExpenses.map(exp => {
                                                        const relatedMaterial = exp.relatedMaterialId ? materials.find(m => m.id === exp.relatedMaterialId) : null;
                                                        const expenseWorker = exp.workerId ? workers.find(w => w.id === exp.workerId) : null;

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
                                                            <li key={exp.id} className="py-3 flex justify-between items-center text-xs">
                                                                <div>
                                                                    <p className="font-bold text-primary dark:text-white">{exp.description}</p>
                                                                <p className="text-slate-500 mt-1 flex items-center gap-2">
                                                                        <span className={`flex items-center gap-1 ${categoryColor}`}><i className={`fa-solid ${categoryIcon}`}></i> {exp.category}</span>
                                                                        <span>• {parseDateNoTimezone(exp.date)}</span>
                                                                        {relatedMaterial && <span className="text-sm font-medium text-slate-400">(Material: {relatedMaterial.name})</span>}
                                                                        {expenseWorker && <span className="text-sm font-medium text-slate-400">(Profissional: {expenseWorker.name})</span>}
                                                                </p>
                                                            </div>
                                                            <span className="font-bold text-primary dark:text-white whitespace-nowrap">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        )}
                    </div>

                    {/* Original Report Content - DESKTOP 3-COLUMN */}
                    <div className="hidden lg:grid grid-cols-3 gap-6 print:grid">

                        {/* Column 1: Cronograma (Schedule) */}
                        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
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

                        {/* Column 2: Materiais (Materials) */}
                        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
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

                        {/* Column 3: Financeiro (Financial) */}
                        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
                            <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-dollar-sign text-secondary"></i> Financeiro
                            </h3>
                            <div className="space-y-6">
                                {[...steps, { id: 'general-fin', name: 'Despesas Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step) => {
                                    const groupExpenses = expenses.filter(e => {
                                        if (step.id === 'general-fin') return !e.stepId;
                                        return e.stepId === step.id;
                                    });

                                    if (groupExpenses.length === 0) return null;

                                    const isGeneral = step.id === 'general-fin';
                                    const stepLabel = isGeneral ? step.name : `Etapa: ${step.name}`;

                                    return (
                                        <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                            <h4 className="font-bold text-primary dark:text-white text-sm uppercase tracking-wide mb-3">{stepLabel}</h4>
                                            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {groupExpenses.map(exp => {
                                                    const relatedMaterial = exp.relatedMaterialId ? materials.find(m => m.id === exp.relatedMaterialId) : null;
                                                    const expenseWorker = exp.workerId ? workers.find(w => w.id === exp.workerId) : null;

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
                                                        <li key={exp.id} className="py-3 flex justify-between items-center text-xs">
                                                            <div>
                                                                <p className="font-bold text-primary dark:text-white">{exp.description}</p>
                                                                <p className="text-slate-500 mt-1 flex items-center gap-2">
                                                                    <span className={`flex items-center gap-1 ${categoryColor}`}><i className={`fa-solid ${categoryIcon}`}></i> {exp.category}</span>
                                                                    <span>• {parseDateNoTimezone(exp.date)}</span>
                                                                    {relatedMaterial && <span className="text-sm font-medium text-slate-400">(Material: {relatedMaterial.name})</span>}
                                                                    {expenseWorker && <span className="text-sm font-medium text-slate-400">(Profissional: {expenseWorker.name})</span>}
                                                                </p>
                                                            </div>
                                                            <span className="font-bold text-primary dark:text-white whitespace-nowrap">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            );

            case 'PHOTOS': return (
                <div className="space-y-6">
                    <label className="block w-full py-8 border-2 border-dashed border-pink-300 bg-pink-50 rounded-2xl cursor-pointer hover:bg-pink-100 transition-all text-center">
                        <i className="fa-solid fa-camera text-2xl text-pink-400 mb-2"></i>
                        <span className="block text-sm font-bold text-pink-600">{uploading ? 'Enviando...' : 'Adicionar Foto'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'PHOTO')} disabled={uploading} />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        {photos.map(p => (
                            <div key={p.id} className="relative group rounded-xl overflow-hidden shadow-sm">
                                <img src={p.url} className="w-full aspect-square object-cover" alt="Obra" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">{parseDateNoTimezone(p.date)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );

            case 'CALCULATORS': return (
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-2">
                        {['PISO', 'PAREDE', 'PINTURA'].map(t => (
                            <button key={t} onClick={() => {setCalcType(t as any); setCalcResult([])}} className={`flex flex-col items-center justify-center py-4 rounded-xl border-2 font-bold text-xs transition-all gap-2 ${calcType === t ? 'border-secondary bg-secondary/10 text-secondary' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'}`}>
                                <i className={`fa-solid ${t === 'PISO' ? 'fa-layer-group' : 'fa-building'} text-xl`}></i>
                                {t}
                            </button>
                        ))}
                    </div>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/20 rounded-full blur-3xl"></div>
                        <h3 className="text-lg font-bold mb-6 text-center uppercase tracking-widest text-secondary">Calculadora de {calcType}</h3>
                        <div className="relative mb-8">
                            <input type="number" value={calcArea} onChange={e => setCalcArea(e.target.value)} placeholder="0" className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-center text-3xl font-black text-white outline-none focus:border-secondary transition-colors" />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 font-bold">m²</span>
                        </div>
                        <div className="space-y-3">
                            {calcResult.length > 0 ? calcResult.map((res, i) => (
                                <div key={i} className="bg-white/10 p-3 rounded-xl flex items-center gap-3 backdrop-blur-sm"><i className="fa-solid fa-check text-green-400"></i> <span className="font-bold text-sm">{res}</span></div>
                            )) : <p className="text-center text-white/30 text-sm">Digite a área para calcular.</p>}
                        </div>
                    </div>
                </div>
            );

            // Fix: Removed BONUS_IA case as AI chat is now handled by a dedicated page.
            case 'CONTRACTS': return (
                <div className="space-y-4">
                    {CONTRACT_TEMPLATES.map(ct => (
                        <button key={ct.id} onClick={() => setViewContract({ title: ct.title, content: ct.contentTemplate })} disabled={!isPremium} className={`group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-secondary/50 cursor-pointer shadow-sm transition-all hover:translate-x-1 ${!isPremium ? 'opacity-70 cursor-not-allowed' : ''}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors"><i className="fa-solid fa-file-contract"></i></div>
                                <div><h4 className="font-bold text-primary dark:text-white">{ct.title}</h4><p className="text-xs text-slate-500">Toque para abrir modelo</p></div>
                            </div>
                        </button>
                    ))}
                </div>
            );

            case 'CHECKLIST': return (
                <div className="space-y-4">
                    {STANDARD_CHECKLISTS.map((cl, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <button onClick={() => setActiveChecklist(activeChecklist === cl.category ? null : cl.category)} disabled={!isPremium} className={`w-full p-5 flex justify-between items-center text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${!isPremium ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                <span className="font-bold text-sm flex items-center gap-3 text-primary dark:text-white"><div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${activeChecklist === cl.category ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'}`}><i className="fa-solid fa-list-check"></i></div>{cl.category}</span>
                                <i className={`fa-solid fa-chevron-down transition-transform text-slate-400 ${activeChecklist === cl.category ? 'rotate-180' : ''}`}></i>
                            </button>
                            {activeChecklist === cl.category && (
                                <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 animate-in slide-in-from-top-2">
                                    {cl.items.map((item, i) => (
                                        <label key={i} className="flex items-start gap-3 py-3 cursor-pointer border-b border-dashed border-slate-200 dark:border-slate-700 last:border-0 hover:bg-white/50 rounded-lg px-2 transition-colors">
                                            <input type="checkbox" className="mt-1 rounded border-slate-300 text-secondary focus:ring-secondary w-5 h-5" />
                                            <span className="text-sm text-slate-600 dark:text-slate-300 leading-tight">{item}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            );

            // PROJECTS reuse
            case 'PROJECTS': return (
                <div className="space-y-6">
                    <label className="block w-full py-8 border-2 border-dashed border-teal-300 bg-teal-50 rounded-2xl cursor-pointer hover:bg-teal-100 transition-all text-center">
                        <i className="fa-solid fa-file-pdf text-2xl text-teal-400 mb-2"></i>
                        <span className="block text-sm font-bold text-teal-600">{uploading ? 'Enviando...' : 'Adicionar PDF/Projeto'}</span>
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'FILE')} disabled={uploading} />
                    </label>
                    <div className="space-y-2">{files.map(f => <div key={f.id} className="p-4 bg-white rounded-xl border flex items-center gap-3"><i className="fa-solid fa-file text-slate-400"></i> <span className="font-bold text-sm truncate flex-1">{f.name}</span><a href={f.url} download={f.name}><i className="fa-solid fa-download text-primary"></i></a></div>)}</div>
                </div>
            );

            default: return null;
        }
    };

    return (
        <div className="max-w-4xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans relative">
            <div className="bg-white dark:bg-slate-900 px-6 pt-6 pb-2 sticky top-0 z-20 shadow-sm border-b border-slate-100 dark:border-slate-800 no-print">
                <div className="flex justify-between items-center mb-1">
                    <button onClick={() => subView !== 'NONE' ? setSubView('NONE') : navigate('/')} className="text-slate-400 hover:text-primary dark:hover:text-white"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                    <h1 className="text-lg font-black text-primary dark:text-white uppercase tracking-tight truncate max-w-[200px]">
                        {subView !== 'NONE' 
                            ? (subView === 'TEAM' ? 'Minha Equipe' : subView === 'SUPPLIERS' ? 'Fornecedores' : subView === 'REPORTS' ? 'Relatórios' : subView === 'PHOTOS' ? 'Fotos' : subView === 'PROJECTS' ? 'Projetos' : subView === 'CALCULATORS' ? 'Calculadoras' : subView === 'CONTRACTS' ? 'Contratos' : subView === 'CHECKLIST' ? 'Checklist' : 'Detalhes')
                            : work.name
                        }
                    </h1>
                    <div className="w-6"></div> 
                </div>
            </div>

            <div className="flex-1 p-4 pb-32 overflow-y-auto">
                {subView !== 'NONE' ? renderSubViewContent() : renderMainTab()}
            </div>

            {/* MAIN NAVIGATION BOTTOM BAR (Only visible on main tabs) */}
            {subView === 'NONE' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-safe z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] no-print">
                    <div className="flex justify-around items-center max-w-4xl mx-auto h-16">
                        <button onClick={() => setActiveTab('SCHEDULE')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'SCHEDULE' ? 'text-secondary' : 'text-slate-400'}`}><i className={`fa-solid fa-calendar-days text-xl ${activeTab === 'SCHEDULE' ? 'scale-110' : ''}`}></i><span className="text-[10px] font-bold uppercase">Cronograma</span></button>
                        <button onClick={() => setActiveTab('MATERIALS')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'MATERIALS' ? 'text-secondary' : 'text-slate-400'}`}><i className={`fa-solid fa-layer-group text-xl ${activeTab === 'MATERIALS' ? 'scale-110' : ''}`}></i><span className="text-[10px] font-bold uppercase">Materiais</span></button>
                        <button onClick={() => setActiveTab('FINANCIAL')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'FINANCIAL' ? 'text-secondary' : 'text-slate-400'}`}><i className={`fa-solid fa-chart-pie text-xl ${activeTab === 'FINANCIAL' ? 'scale-110' : ''}`}></i><span className="text-[10px] font-bold uppercase">Financeiro</span></button>
                        <button onClick={() => setActiveTab('MORE')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'MORE' ? 'text-secondary' : 'text-slate-400'}`}><i className={`fa-solid fa-bars text-xl ${activeTab === 'MORE' ? 'scale-110' : ''}`}></i><span className="text-[10px] font-bold uppercase">Mais</span></button>
                    </div>
                </div>
            )}

            {/* --- ALL MODALS (RENDERED AT ROOT LEVEL) --- */}
            
            {/* ADD/EDIT STEP MODAL */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">{stepModalMode === 'ADD' ? 'Nova Etapa' : 'Editar Etapa'}</h3>
                        <form onSubmit={handleSaveStep} className="space-y-4">
                            <input placeholder="Nome da Etapa" value={stepName} onChange={e => setStepName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Início</label><input type="date" value={stepStart} onChange={e => setStepStart(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required /></div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Fim</label><input type="date" value={stepEnd} onChange={e => setStepEnd(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required /></div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsStepModalOpen(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD MATERIAL MODAL */}
            {addMatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">Novo Material</h3>
                        <form onSubmit={handleAddMaterial} className="space-y-4">
                            <input placeholder="Nome do Material" value={newMatName} onChange={e => setNewMatName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" placeholder="Qtd" value={newMatQty} onChange={e => setNewMatQty(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                                <input placeholder="Unidade (un, m2)" value={newMatUnit} onChange={e => setNewMatUnit(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            </div>
                            <select value={newMatStepId} onChange={e => setNewMatStepId(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <option value="">Sem etapa definida</option>
                                {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            
                            <div className="border-t pt-4 mt-2">
                                <label className="flex items-center gap-2 mb-2 font-bold text-sm"><input type="checkbox" checked={newMatBuyNow} onChange={e => setNewMatBuyNow(e.target.checked)} className="w-4 h-4" /> Já comprei este material</label>
                                {newMatBuyNow && (
                                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                                        <input type="number" placeholder="Qtd Comprada" value={newMatBuyQty} onChange={e => setNewMatBuyQty(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
                                        <input type="number" placeholder="Valor Total (R$)" value={newMatBuyCost} onChange={e => setNewMatBuyCost(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={() => setAddMatModal(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MATERIAL MODAL */}
            {materialModal.isOpen && materialModal.material && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">Editar Material</h3>
                        
                        <form onSubmit={handleUpdateMaterial} className="space-y-6">
                            {/* EDITABLE DEFINITION */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nome do Produto</label>
                                    <input 
                                        value={matName} 
                                        onChange={e => setMatName(e.target.value)} 
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Qtd Plane</label>
                                        <input 
                                            type="number" 
                                            value={matPlannedQty} 
                                            onChange={e => setMatPlannedQty(e.target.value)} 
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Unidade</label>
                                        <input 
                                            value={matUnit} 
                                            onChange={e => setMatUnit(e.target.value)} 
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Marca/Fornecedor (Opcional)</label>
                                    <input 
                                        value={matBrand} 
                                        onChange={e => setMatBrand(e.target.value)} 
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                                    />
                                </div>
                            </div>
                            
                            {/* REGISTER NEW PURCHASE (Optional) */}
                            <div className="border-t pt-6 mt-4">
                                <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Registrar Nova Compra</h4>
                                <p className="text-xs text-slate-400 mb-4">A quantidade já comprada ({materialModal.material.purchasedQty} {materialModal.material.unit}) será atualizada.</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Qtd Comprada AGORA</label>
                                        <input 
                                            type="number" 
                                            placeholder="0" 
                                            value={matBuyQty} 
                                            onChange={e => setMatBuyQty(e.target.value)} 
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Custo Total DESSA Compra (R$)</label>
                                        <input 
                                            type="number" 
                                            placeholder="0.00" 
                                            value={matBuyCost} 
                                            onChange={e => setMatBuyCost(e.target.value)} 
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setMaterialModal({isOpen: false, material: null})} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD/EDIT EXPENSE MODAL */}
            {expenseModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">{expenseModal.mode === 'ADD' ? 'Nova Despesa' : 'Editar Gasto'}</h3>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descrição do Gasto</label>
                                <input placeholder="Ex: Cimento, Diária Pedreiro, Licença" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold" required />
                            </div>
                            
                            {expenseModal.mode === 'EDIT' && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 font-bold">
                                    <p className="mb-1">Valor já pago: <span className="text-primary dark:text-white">R$ {expSavedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                                    <p className="text-orange-500"><i className="fa-solid fa-info-circle mr-1"></i> Digite APENAS o valor do NOVO PAGAMENTO.</p>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{expenseModal.mode === 'ADD' ? 'Valor Total (R$)' : 'Valor do NOVO Pagamento (R$)'}</label>
                                <input type="number" placeholder="0.00" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold" required />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Valor Total ACORDADO (para pagamentos parcelados/adiantados)</label>
                                <input type="number" placeholder="Opcional: Ex: 1000.00" value={expTotalAgreed} onChange={e => setExpTotalAgreed(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold" />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Categoria</label>
                                <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                                    {Object.values(ExpenseCategory).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                    <option value="Serviços">Serviços</option>
                                    <option value="Equipamentos">Equipamentos</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Etapa Relacionada (Opcional)</label>
                                <select value={expStepId} onChange={e => setExpStepId(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                                    <option value="">Nenhuma</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Data do Pagamento</label>
                                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold" required />
                            </div>

                            <div className="flex gap-2 pt-2">
                                {expenseModal.mode === 'EDIT' && (
                                    <button type="button" onClick={handleDeleteExpense} className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center shrink-0"><i className="fa-solid fa-trash"></i></button>
                                )}
                                <button type="button" onClick={() => setExpenseModal({ isOpen: false, mode: 'ADD' })} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD/EDIT PERSON MODAL (Worker/Supplier) */}
            {isPersonModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">
                            {personId ? 'Editar ' : 'Novo '} {personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}
                        </h3>
                        <form onSubmit={handleSavePerson} className="space-y-4">
                            <input placeholder="Nome" value={personName} onChange={e => setPersonName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            
                            {personMode === 'WORKER' && (
                                <select value={personRole} onChange={e => setPersonRole(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    {STANDARD_JOB_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                                </select>
                            )}
                            {personMode === 'SUPPLIER' && (
                                <select value={personRole} onChange={e => setPersonRole(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    {STANDARD_SUPPLIER_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                                </select>
                            )}

                            <input placeholder="Telefone (WhatsApp)" value={personPhone} onChange={e => setPersonPhone(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            <textarea placeholder="Observações (endereço, especialidade, etc.)" value={personNotes} onChange={e => setPersonNotes(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-24"></textarea>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsPersonModalOpen(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Contract Modal */}
            {viewContract && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-primary dark:text-white">{viewContract.title}</h3>
                            <button onClick={() => setViewContract(null)} className="text-slate-400 hover:text-primary dark:hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                            {viewContract.content}
                        </div>
                        <button onClick={() => setViewContract(null)} className="mt-6 w-full py-3 bg-primary text-white font-bold rounded-xl">Fechar</button>
                    </div>
                </div>
            )}

            {/* Generic Confirmation Modal */}
            <ZeModal
                isOpen={zeModal.isOpen}
                title={zeModal.title}
                message={zeModal.message}
                confirmText={zeModal.confirmText || "Confirmar"}
                onConfirm={zeModal.onConfirm || (() => {})} // Garante que onConfirm seja uma função
                onCancel={zeModal.onCancel} // onCancel é obrigatório
                type={zeModal.type === 'WARNING' ? 'INFO' : zeModal.type || 'INFO'} // Garante que o tipo seja reconhecido
            />
        </div>
    );
};

export default WorkDetail;
