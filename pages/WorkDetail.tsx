
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile } from '../types.ts';
import { ZeModal } from '../components/ZeModal.tsx';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO';

// --- DATE HELPERS ---
const parseDateNoTimezone = (dateStr: string) => {
    if (!dateStr) return '--/--';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    }
    return dateStr;
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

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, authLoading, isUserAuthFinished, isSubscriptionValid } = useAuth();
    
    const [work, setWork] = useState<Work | null>(null);
    const [loading, setLoading] = useState(true);
    const [steps, setSteps] = useState<Step[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const [files, setFiles] = useState<WorkFile[]>([]);
    const [, setStats] = useState<any>(null);

    const [activeTab, setActiveTab] = useState<MainTab>('ETAPAS');
    const [subView, setSubView] = useState<SubView>('NONE');
    const [uploading, setUploading] = useState(false);
    const [reportActiveTab, setReportActiveTab] = useState<ReportSubTab>('CRONOGRAMA');
    
    const [materialFilterStepId, setMaterialFilterStepId] = useState<string>('ALL');
    
    const [materialModal, setMaterialModal] = useState<{ isOpen: boolean, material: Material | null }>({ isOpen: false, material: null });
    const [matName, setMatName] = useState('');
    const [matBrand, setMatBrand] = useState('');
    const [matPlannedQty, setMatPlannedQty] = useState('');
    const [matUnit, setMatUnit] = useState('');
    const [matBuyQty, setMatBuyQty] = useState('');
    const [matBuyCost, setMatBuyCost] = useState(''); // Keep this for editing existing materials

    const [addMatModal, setAddMatModal] = useState(false);
    const [newMatName, setNewMatName] = useState('');
    const [newMatBrand, setNewMatBrand] = useState('');
    const [newMatQty, setNewMatQty] = useState('');
    const [newMatUnit, setNewMatUnit] = useState('un');
    const [newMatStepId, setNewMatStepId] = useState('');
    const [newMatBuyNow, setNewMatBuyNow] = useState(false);
    const [newMatBuyQty, setNewMatBuyQty] = useState('');
    const [newMatBuyCost, setNewMatBuyCost] = useState(''); // Corrected name for new material purchases

    const [isStepModalOpen, setIsStepModalOpen] = useState(false);
    const [stepModalMode, setStepModalMode] = useState<'ADD' | 'EDIT'>('ADD');
    const [stepName, setStepName] = useState('');
    // FIX: Correctly initialize stepStart and stepEnd with useState
    const [stepStart, setStepStart] = useState(new Date().toISOString().split('T')[0]);
    const [stepEnd, setStepEnd] = useState(new Date().toISOString().split('T')[0]);
    const [currentStepId, setCurrentStepId] = useState<string | null>(null);

    const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean, mode: 'ADD'|'EDIT', id?: string }>({ isOpen: false, mode: 'ADD' });
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expTotalAgreed, setExpTotalAgreed] = useState('');
    const [expCategory, setExpCategory] = useState<ExpenseCategory>(ExpenseCategory.LABOR);
    const [expStepId, setExpStepId] = useState('');
    const [expSavedAmount, setExpSavedAmount] = useState(0);

    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personMode, setPersonMode] = useState<'WORKER'|'SUPPLIER'>('WORKER');
    const [personId, setPersonId] = useState<string | null>(null); 
    const [personName, setPersonName] = useState('');
    const [personRole, setPersonRole] = useState('');
    const [personPhone, setPersonPhone] = useState('');
    const [personNotes, setPersonNotes] = useState('');

    const [viewContract, setViewContract] = useState<{title: string, content: string} | null>(null);
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    const [zeModal, setZeModal] = useState<any>({ isOpen: false, title: '', message: '' });

    const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
    const [calcType, setCalcType] = useState<'PISO'|'PAREDE'|'PINTURA'>('PISO');
    const [calcArea, setCalcArea] = useState('');
    const [calcResult, setCalcResult] = useState<string[]>([]);

    const load = useCallback(async () => {
        if (!id || !isUserAuthFinished || authLoading) return;
        setLoading(true);
        try {
            const w = await dbService.getWorkById(id);
            setWork(w || null);
            if (w) {
                const [s, m, e, wk, sp, ph, fl, workStats] = await Promise.all([
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
        } catch (error) {
            console.error("Erro ao carregar detalhes da obra:", error);
        } finally {
            setLoading(false);
        }
    }, [id, authLoading, isUserAuthFinished]);

    useEffect(() => { load(); }, [load]);

    const handleSaveStep = async (e: React.FormEvent) => {
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
                await dbService.updateStep({ ...existing, name: stepName, startDate: stepStart, endDate: stepEnd });
            }
        }
        setIsStepModalOpen(false);
        load();
    };

    const handleStepStatusClick = async (step: Step) => {
        let newStatus = step.status === StepStatus.NOT_STARTED ? StepStatus.IN_PROGRESS : 
                        step.status === StepStatus.IN_PROGRESS ? StepStatus.COMPLETED : StepStatus.NOT_STARTED;
        await dbService.updateStep({ ...step, status: newStatus });
        load();
    };

    const handleDeleteStep = async (stepId: string) => {
        if (!work) return; 
        setZeModal({
            isOpen: true,
            title: 'Excluir Etapa?',
            message: 'Tem certeza que deseja excluir esta etapa?',
            confirmText: 'Excluir',
            type: 'DANGER',
            onConfirm: async () => {
                try {
                    await dbService.deleteStep(stepId, work.id);
                    load();
                    setZeModal({ isOpen: false });
                } catch (error: any) {
                    console.error("Erro ao deletar etapa:", error);
                    setZeModal({
                        isOpen: true,
                        title: 'Erro ao Excluir Etapa',
                        message: error.message || 'Não foi possível excluir a etapa. Verifique se há lançamentos financeiros associados a ela ou aos seus materiais.',
                        confirmText: 'Entendido',
                        onCancel: () => setZeModal({ isOpen: false }),
                        type: 'ERROR'
                    });
                }
            },
            onCancel: () => setZeModal({ isOpen: false })
        });
    };

    const handleAddMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !newMatName) return;
        await dbService.addMaterial({
            workId: work.id,
            name: newMatName,
            brand: newMatBrand,
            plannedQty: Number(newMatQty),
            purchasedQty: 0,
            unit: newMatUnit,
            stepId: newMatStepId || undefined
        }, newMatBuyNow ? { qty: Number(newMatBuyQty), cost: Number(newMatBuyCost), date: new Date().toISOString() } : undefined);
        setAddMatModal(false);
        load();
    };

    const handleUpdateMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!materialModal.material) return;
        try {
            await dbService.updateMaterial({
                ...materialModal.material,
                name: matName,
                brand: matBrand,
                plannedQty: Number(matPlannedQty),
                unit: matUnit
            });
            if (matBuyQty && Number(matBuyQty) > 0) {
                await dbService.registerMaterialPurchase(materialModal.material.id, matName, matBrand, Number(matPlannedQty), matUnit, Number(matBuyQty), Number(matBuyCost));
            }
            setMaterialModal({ isOpen: false, material: null });
            load();
        } catch (error) {
            console.error(error);
        }
    };

    const openAddExpense = () => {
        setExpenseModal({ isOpen: true, mode: 'ADD' });
        setExpDesc(''); setExpAmount(''); setExpSavedAmount(0); setExpTotalAgreed(''); setExpCategory(ExpenseCategory.LABOR); setExpStepId('');
    };

    const openEditExpense = (expense: Expense) => {
        setExpenseModal({ isOpen: true, mode: 'EDIT', id: expense.id });
        setExpDesc(expense.description); 
        // No EDIT mode, expAmount should reflect the *next* payment, not the total paid so far
        setExpAmount(''); 
        setExpSavedAmount(expense.paidAmount || expense.amount); 
        setExpTotalAgreed(expense.totalAgreed ? String(expense.totalAgreed) : ''); 
        // Fix: Cast expense.category to ExpenseCategory to match the state type.
        setExpCategory(expense.category as ExpenseCategory); 
        setExpStepId(expense.stepId || '');
    };

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !expDesc) return;
        const inputAmount = Number(expAmount) || 0;
        if (expenseModal.mode === 'ADD') {
            await dbService.addExpense({
                workId: work.id,
                description: expDesc,
                amount: inputAmount,
                paidAmount: inputAmount,
                quantity: 1,
                date: new Date().toISOString(),
                category: expCategory,
                stepId: expStepId || undefined,
                totalAgreed: expTotalAgreed ? Number(expTotalAgreed) : undefined
            });
        } else if (expenseModal.mode === 'EDIT' && expenseModal.id) {
            const existing = expenses.find(ex => ex.id === expenseModal.id);
            if (existing) {
                // For editing, if totalAgreed exists, we assume `amount` is `paidAmount`
                const newPaidAmount = (existing.paidAmount || 0) + inputAmount;
                const newTotalAgreed = expTotalAgreed ? Number(expTotalAgreed) : existing.totalAgreed;

                await dbService.updateExpense({ 
                    ...existing, 
                    description: expDesc, 
                    amount: newPaidAmount, // Amount field now represents total paid
                    paidAmount: newPaidAmount, 
                    category: expCategory, 
                    stepId: expStepId || undefined, 
                    totalAgreed: newTotalAgreed 
                });
            }
        }
        setExpenseModal({ isOpen: false, mode: 'ADD' });
        load();
    };

    const handleDeleteExpense = async (expenseId: string) => {
        setZeModal({
            isOpen: true, title: 'Excluir Gasto?', message: 'Deseja excluir este registro?', confirmText: 'Excluir', type: 'DANGER',
            onConfirm: async () => { await dbService.deleteExpense(expenseId); load(); setZeModal({ isOpen: false }); },
            onCancel: () => setZeModal({ isOpen: false })
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'PHOTO' | 'FILE') => {
        if (e.target.files && e.target.files[0] && work) {
            setUploading(true);
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                if (type === 'PHOTO') {
                    await dbService.addPhoto({ workId: work.id, url: base64, description: 'Foto da obra', date: new Date().toISOString(), type: 'PROGRESS' });
                } else {
                    await dbService.addFile({ workId: work.id, name: file.name, category: FileCategory.GENERAL, url: base64, type: file.type, date: new Date().toISOString() });
                }
                setUploading(false);
                load();
            };
            reader.readAsDataURL(file);
        }
    };

    const openPersonModal = (mode: 'WORKER' | 'SUPPLIER', item?: any) => {
        setPersonMode(mode);
        if (item) {
            setPersonId(item.id); setPersonName(item.name); setPersonPhone(item.phone); setPersonNotes(item.notes || '');
            setPersonRole(mode === 'WORKER' ? item.role : item.category);
        } else {
            setPersonId(null); setPersonName(''); setPersonPhone(''); setPersonNotes('');
            setPersonRole(mode === 'WORKER' ? STANDARD_JOB_ROLES[0] : STANDARD_SUPPLIER_CATEGORIES[0]);
        }
        setIsPersonModalOpen(true);
    };

    const handleSavePerson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !work) return;
        const payload: any = { userId: user.id, workId: work.id, name: personName, phone: personPhone, notes: personNotes };
        if (personId) {
            if (personMode === 'WORKER') await dbService.updateWorker({ ...payload, id: personId, role: personRole });
            else await dbService.updateSupplier({ ...payload, id: personId, category: personRole });
        } else {
            if (personMode === 'WORKER') await dbService.addWorker({ ...payload, role: personRole });
            else await dbService.addSupplier({ ...payload, category: personRole });
        }
        setIsPersonModalOpen(false);
        load();
    };

    const handleDeletePerson = (pid: string, wid: string, mode: 'WORKER' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true, title: 'Remover?', message: 'Deseja remover esta pessoa?', confirmText: 'Remover', type: 'DANGER',
            onConfirm: async () => { 
                if (mode === 'WORKER') await dbService.deleteWorker(pid, wid); 
                else await dbService.deleteSupplier(pid, wid); 
                load(); setZeModal({ isOpen: false }); 
            },
            onCancel: () => setZeModal({ isOpen: false })
        });
    };

    useEffect(() => {
        if (!calcArea) { setCalcResult([]); return; }
        const area = Number(calcArea);
        if (calcType === 'PISO') setCalcResult([`${Math.ceil(area * 1.15)} m² de Piso`, `${Math.ceil(area * 4)} kg de Argamassa`]);
        else if (calcType === 'PAREDE') setCalcResult([`${Math.ceil(area * 30)} Tijolos`]);
        else if (calcType === 'PINTURA') setCalcResult([`${Math.ceil(area / 5)} L de Tinta`]);
    }, [calcArea, calcType]);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(steps), "Cronograma");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(materials), "Materiais");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), "Financeiro");
        XLSX.writeFile(wb, `Obra_${work?.name}.xlsx`);
    };

    // New: Grouped Expenses logic for rendering
    const groupedExpenses = useMemo(() => {
      const groups: {
        [category: string]: {
          totalCategoryAmount: number;
          steps: {
            [stepId: string]: {
              stepName: string;
              expenses: Expense[];
              totalStepAmount: number;
            };
          };
          unlinkedExpenses: Expense[];
        };
      } = {};

      Object.values(ExpenseCategory).forEach(cat => {
        groups[cat] = { totalCategoryAmount: 0, steps: {}, unlinkedExpenses: [] };
      });

      expenses.forEach(exp => {
        const category = exp.category as ExpenseCategory;
        groups[category].totalCategoryAmount += exp.amount;

        if (exp.stepId) {
          const step = steps.find(s => s.id === exp.stepId);
          const stepName = step ? step.name : 'Etapa Desconhecida';
          if (!groups[category].steps[exp.stepId]) {
            groups[category].steps[exp.stepId] = { stepName, expenses: [], totalStepAmount: 0 };
          }
          groups[category].steps[exp.stepId].expenses.push(exp);
          groups[category].steps[exp.stepId].totalStepAmount += exp.amount;
        } else {
          groups[category].unlinkedExpenses.push(exp);
        }
      });

      // Sort expenses within each step/unlinked by date
      Object.values(groups).forEach(group => {
        group.unlinkedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        Object.values(group.steps).forEach(stepGroup => {
          stepGroup.expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
      });
      
      return groups;
    }, [expenses, steps]);


    if (authLoading || !isUserAuthFinished || loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return <div className="text-center py-10">Obra não encontrada.</div>;

    const RenderCronogramaReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold mb-4">Cronograma</h3>
            <div className="space-y-4">
                {steps.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border">
                        <p className="font-bold text-sm">{s.name}</p>
                        <p className="text-xs text-slate-500">{parseDateNoTimezone(s.startDate)} - {parseDateNoTimezone(s.endDate)}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const RenderMateriaisReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold mb-4">Materiais</h3>
            {steps.map(step => {
                const stepMats = materials.filter(m => m.stepId === step.id);
                if (stepMats.length === 0) return null;
                return (
                    <div key={step.id} className="mb-4">
                        <h4 className="text-xs font-bold uppercase text-secondary mb-2">{step.name}</h4>
                        {stepMats.map(m => <p key={m.id} className="text-sm">• {m.name}: {m.purchasedQty}/{m.plannedQty} {m.unit}</p>)}
                    </div>
                );
            })}
        </div>
    );

    const RenderFinanceiroReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold mb-4">Financeiro</h3>
            {expenses.map(e => (
                <div key={e.id} className="flex justify-between text-sm py-2 border-b">
                    <span>{e.description}</span>
                    <span className="font-bold">{formatCurrency(e.amount)}</span>
                </div>
            ))}
        </div>
    );

    const todayString = new Date().toISOString().split('T')[0];

    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const budgetUsage = work.budgetPlanned > 0 ? (totalSpent / work.budgetPlanned) * 100 : 0;
    const budgetRemaining = work.budgetPlanned > 0 ? Math.max(0, work.budgetPlanned - totalSpent) : 0;

    let budgetStatusColor = 'bg-green-500';
    let budgetStatusAccent = 'border-green-500 ring-1 ring-green-200';
    let budgetStatusIcon = 'fa-check-circle';
    if (budgetUsage > 100) {
        budgetStatusColor = 'bg-red-500';
        budgetStatusAccent = 'border-red-500 ring-1 ring-red-200';
        budgetStatusIcon = 'fa-triangle-exclamation';
    } else if (budgetUsage > 80) {
        budgetStatusColor = 'bg-orange-500';
        budgetStatusAccent = 'border-orange-500 ring-1 ring-orange-200';
        budgetStatusIcon = 'fa-exclamation-circle';
    }


    return (
        <div className="max-w-4xl mx-auto py-8 px-4 md:px-0 pb-24">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => subView === 'NONE' ? navigate('/') : setSubView('NONE')} className="text-slate-400 hover:text-primary" aria-label="Voltar"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                <h1 className="text-2xl font-black text-primary dark:text-white">{work.name}</h1>
                <div className="w-10"></div>
            </div>

            {subView === 'NONE' ? (
                <>
                    <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t z-50 flex justify-around p-2 md:static md:bg-slate-100 md:rounded-2xl md:mb-6 shadow-lg md:shadow-none"> {/* Added shadow-lg for better visual separation on mobile */}
                        {(['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'] as MainTab[]).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center flex-1 py-2 text-[10px] font-bold md:text-sm md:rounded-xl transition-colors ${activeTab === tab ? 'text-secondary md:bg-white md:shadow-sm' : 'text-slate-400 hover:text-primary dark:hover:text-white'}`} aria-label={`Abrir aba ${tab}`}>
                                <i className={`fa-solid ${tab === 'ETAPAS' ? 'fa-calendar' : tab === 'MATERIAIS' ? 'fa-box' : tab === 'FINANCEIRO' ? 'fa-dollar-sign' : 'fa-ellipsis'} text-lg mb-1`}></i>
                                {tab}
                            </button>
                        ))}
                    </nav>

                    {activeTab === 'ETAPAS' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="flex justify-between items-center px-2">
                                <h2 className="text-xl font-bold text-primary dark:text-white">Cronograma</h2>
                                <button onClick={() => { setStepModalMode('ADD'); setIsStepModalOpen(true); }} className="bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar etapa"><i className="fa-solid fa-plus"></i></button> {/* Rounded-xl, shadow */}
                            </div>
                            {steps.length === 0 ? (
                                <p className="text-center text-slate-400 py-8 italic text-sm">Nenhuma etapa cadastrada. Adicione para começar!</p>
                            ) : (
                                steps.map((s, index) => {
                                    const isDelayed = s.status !== StepStatus.COMPLETED && s.endDate < todayString;
                                    return (
                                        <div key={s.id} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${isDelayed ? 'border-red-500 ring-1 ring-red-200' : 'border-slate-200 dark:border-slate-800'}`}>
                                            <button 
                                                onClick={() => handleStepStatusClick(s)} 
                                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-white transition-colors duration-200
                                                    ${s.status === StepStatus.COMPLETED ? 'bg-green-500 border-green-500' : 
                                                      s.status === StepStatus.IN_PROGRESS ? 'bg-orange-500 border-orange-500' : 
                                                      'bg-slate-300 border-slate-300 hover:bg-slate-400 hover:border-slate-400'}`}
                                                aria-label={`Mudar status da etapa ${s.name}`}
                                            >
                                                <i className="fa-solid fa-check"></i>
                                            </button>
                                            <div className="flex-1 cursor-pointer" onClick={() => { setStepModalMode('EDIT'); setCurrentStepId(s.id); setStepName(s.name); setStepStart(s.startDate); setStepEnd(s.endDate); setIsStepModalOpen(true); }} aria-label={`Editar etapa ${s.name}`}>
                                                <p className="font-bold text-primary dark:text-white">{index + 1}. {s.name} {isDelayed && <span className="ml-2 text-xs font-semibold text-red-500">Atrasada!</span>}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{parseDateNoTimezone(s.startDate)} - {parseDateNoTimezone(s.endDate)}</p>
                                            </div>
                                            <button onClick={() => handleDeleteStep(s.id)} className="text-red-400 hover:text-red-600 transition-colors p-2" aria-label={`Excluir etapa ${s.name}`}><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'MATERIAIS' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="flex justify-between items-center px-2">
                                <h2 className="text-xl font-bold text-primary dark:text-white">Materiais</h2>
                                <button onClick={() => setAddMatModal(true)} className="bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar material"><i className="fa-solid fa-plus"></i></button>
                            </div>
                            {steps.length === 0 && materials.length === 0 ? (
                                <p className="text-center text-slate-400 py-8 italic text-sm">Nenhuma etapa ou material cadastrado.</p>
                            ) : (
                                steps.map((step, index) => {
                                    const stepMats = materials.filter(m => m.stepId === step.id);
                                    // Always show the step header even if no materials for it, as it's part of the plan/structure.
                                    
                                    // Determine status for step card header in Materials section
                                    const isStepDelayed = step.status !== StepStatus.COMPLETED && step.endDate < todayString;
                                    const stepStatusBgClass = 
                                        step.status === StepStatus.COMPLETED ? 'bg-green-500/10' : 
                                        step.status === StepStatus.IN_PROGRESS ? 'bg-orange-500/10' : 
                                        isStepDelayed ? 'bg-red-500/10' : 
                                        'bg-slate-300/10';
                                    const stepStatusTextColorClass =
                                        step.status === StepStatus.COMPLETED ? 'text-green-600 dark:text-green-300' :
                                        step.status === StepStatus.IN_PROGRESS ? 'text-orange-600 dark:text-orange-300' :
                                        isStepDelayed ? 'text-red-600 dark:text-red-300' :
                                        'text-slate-500 dark:text-slate-400';
                                    const stepStatusIcon = 
                                        step.status === StepStatus.COMPLETED ? 'fa-check-circle' :
                                        step.status === StepStatus.IN_PROGRESS ? 'fa-hammer' :
                                        isStepDelayed ? 'fa-triangle-exclamation' :
                                        'fa-clock';

                                    return (
                                        <div key={step.id} className="mb-6 first:mt-0 mt-8">
                                            {/* Step "Chapter" Card for Materials */}
                                            <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-800 shadow-lg ${stepStatusBgClass} ${stepStatusTextColorClass}`}>
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-black text-xl text-primary dark:text-white flex items-center gap-2">
                                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${stepStatusBgClass.replace('/10', '/20').replace('bg-', 'bg-').replace('dark:bg-green-900/20', 'dark:bg-green-800').replace('dark:text-green-300', 'dark:text-white')}`}> {/* Use a darker shade for the icon background */}
                                                            <i className={`fa-solid ${stepStatusIcon} ${stepStatusTextColorClass}`}></i>
                                                        </span>
                                                        <span className="text-primary dark:text-white">{index + 1}. {step.name}</span>
                                                    </h3>
                                                    <span className={`text-sm font-semibold ${stepStatusTextColorClass}`}>
                                                        {isStepDelayed ? 'Atrasada' : step.status === StepStatus.COMPLETED ? 'Concluída' : step.status === StepStatus.IN_PROGRESS ? 'Em Andamento' : 'Pendente'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-12">{parseDateNoTimezone(step.startDate)} - {parseDateNoTimezone(step.endDate)}</p>
                                            </div>

                                            {/* Materials for this step */}
                                            <div className="space-y-3 pl-4 border-l-2 border-slate-100 dark:border-slate-800 ml-4"> {/* Indent materials */}
                                                {stepMats.length === 0 ? (
                                                    <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum material associado a esta etapa.</p>
                                                ) : (
                                                    stepMats.map(m => (
                                                        <div key={m.id} onClick={() => { setMaterialModal({isOpen: true, material: m}); setMatName(m.name); setMatBrand(m.brand||''); setMatPlannedQty(String(m.plannedQty)); setMatUnit(m.unit); }} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:shadow-sm transition-shadow">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <p className="font-bold text-sm text-primary dark:text-white">{m.name}</p>
                                                                <span className="text-xs font-black text-green-600 dark:text-green-400">{m.purchasedQty} {m.unit}</span> {/* Purchased Qty in green */}
                                                            </div>
                                                            <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div className="h-full bg-secondary" style={{ width: `${(m.purchasedQty/m.plannedQty)*100}%` }}></div>
                                                            </div>
                                                            <p className="text-[10px] text-right text-slate-500 dark:text-slate-400 mt-1">Planejado: {m.plannedQty} {m.unit}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'FINANCEIRO' && (
                        <div className="space-y-6 animate-in fade-in">
                            {/* Budget Summary Card */}
                            <div className={`bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-lg border ${budgetStatusAccent}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shrink-0 ${budgetStatusColor}`}>
                                            <i className={`fa-solid ${budgetStatusIcon}`}></i>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Gasto Total</p>
                                            <h3 className="text-2xl font-black text-primary dark:text-white">{formatCurrency(totalSpent)}</h3>
                                        </div>
                                    </div>
                                    {work.budgetPlanned > 0 && (
                                        <div className="text-right">
                                            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Orçamento Planejado</p>
                                            <p className="text-lg font-black text-primary dark:text-white">{formatCurrency(work.budgetPlanned)}</p>
                                        </div>
                                    )}
                                </div>
                                {work.budgetPlanned > 0 && (
                                    <>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-3 mb-1">
                                            <div className="h-full" style={{ width: `${Math.min(100, budgetUsage)}%`, backgroundColor: budgetStatusColor }}></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <span>{Math.round(budgetUsage)}% Usado</span>
                                            {budgetUsage > 100 ? (
                                                <span className="text-red-500">Excedido em {formatCurrency(Math.abs(budgetRemaining))}</span>
                                            ) : (
                                                <span>Restante: {formatCurrency(budgetRemaining)}</span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex justify-between items-center px-2 pt-4">
                                <h2 className="text-xl font-bold text-primary dark:text-white">Lançamentos</h2>
                                <button onClick={openAddExpense} className="bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar novo gasto"><i className="fa-solid fa-plus"></i></button>
                            </div>
                            
                            {expenses.length === 0 ? (
                                <p className="text-center text-slate-400 py-8 italic text-sm">Nenhum gasto registrado.</p>
                            ) : (
                                Object.values(ExpenseCategory).map(category => {
                                    const expensesInCategory = Object.values(groupedExpenses[category].steps).flatMap(stepGroup => stepGroup.expenses).concat(groupedExpenses[category].unlinkedExpenses);
                                    if (expensesInCategory.length === 0) return null; // Only show category if it has expenses

                                    return (
                                        <div key={category} className="mb-6 first:mt-0 mt-8">
                                            {/* Category "Root" Card */}
                                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-800 shadow-lg">
                                                <h3 className="font-black text-xl text-primary dark:text-white flex items-center gap-2">
                                                    <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary dark:bg-secondary-dark/20 dark:text-secondary-light flex items-center justify-center text-base">
                                                        {category === ExpenseCategory.MATERIAL ? <i className="fa-solid fa-box"></i> :
                                                        category === ExpenseCategory.LABOR ? <i className="fa-solid fa-hard-hat"></i> :
                                                        category === ExpenseCategory.PERMITS ? <i className="fa-solid fa-file-invoice-dollar"></i> : 
                                                        <i className="fa-solid fa-ellipsis"></i>}
                                                    </span>
                                                    <span className="text-primary dark:text-white">{category}</span>
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-12">Total: {formatCurrency(groupedExpenses[category].totalCategoryAmount)}</p>
                                            </div>

                                            {/* Expenses linked to steps */}
                                            {Object.keys(groupedExpenses[category].steps)
                                                .filter(stepId => groupedExpenses[category].steps[stepId].expenses.length > 0) // Only show step card if it has expenses
                                                .map(stepId => {
                                                const stepGroup = groupedExpenses[category].steps[stepId];
                                                const step = steps.find(s => s.id === stepId); // Get actual step object
                                                if (!step) return null; // Should not happen if data is consistent
                                                
                                                // Determine status for step card header
                                                const isStepDelayed = step.status !== StepStatus.COMPLETED && step.endDate < todayString;
                                                const stepStatusBgClass = 
                                                    step.status === StepStatus.COMPLETED ? 'bg-green-500/10' : 
                                                    step.status === StepStatus.IN_PROGRESS ? 'bg-orange-500/10' : 
                                                    isStepDelayed ? 'bg-red-500/10' : 
                                                    'bg-slate-300/10';
                                                const stepStatusTextColorClass =
                                                    step.status === StepStatus.COMPLETED ? 'text-green-600 dark:text-green-300' :
                                                    step.status === StepStatus.IN_PROGRESS ? 'text-orange-600 dark:text-orange-300' :
                                                    isStepDelayed ? 'text-red-600 dark:text-red-300' :
                                                    'text-slate-500 dark:text-slate-400';
                                                const stepStatusIcon = 
                                                    step.status === StepStatus.COMPLETED ? 'fa-check-circle' :
                                                    step.status === StepStatus.IN_PROGRESS ? 'fa-hammer' : // Using hammer for in-progress work
                                                    isStepDelayed ? 'fa-triangle-exclamation' :
                                                    'fa-clock';

                                                return (
                                                    <div key={stepId} className="mb-4">
                                                        {/* Step "Chapter" Card for Financeiro */}
                                                        <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-800 shadow-lg ${stepStatusBgClass} ${stepStatusTextColorClass} pl-8 ml-4`}> {/* Indented step card itself */}
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="font-black text-xl text-primary dark:text-white flex items-center gap-2">
                                                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${stepStatusBgClass.replace('/10', '/20').replace('bg-', 'bg-').replace('dark:bg-green-900/20', 'dark:bg-green-800').replace('dark:text-green-300', 'dark:text-white')}`}> 
                                                                        <i className={`fa-solid ${stepStatusIcon} ${stepStatusTextColorClass}`}></i>
                                                                    </span>
                                                                    <span className="text-primary dark:text-white">{step.name}</span>
                                                                </h3>
                                                                <span className={`text-sm font-semibold ${stepStatusTextColorClass}`}>
                                                                    {formatCurrency(stepGroup.totalStepAmount)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-12">{parseDateNoTimezone(step.startDate)} - {parseDateNoTimezone(step.endDate)}</p>
                                                        </div>

                                                        <div className="space-y-3 pl-12 border-l-2 border-slate-100 dark:border-slate-800 ml-8"> {/* Further indent individual expenses */}
                                                            {stepGroup.expenses.map(e => {
                                                                const isEmpreita = e.totalAgreed && e.totalAgreed > 0;
                                                                let statusText = '';
                                                                let progress = 0;
                                                                let progressBarColor = '';

                                                                if (isEmpreita) {
                                                                    progress = (e.amount / e.totalAgreed!) * 100;
                                                                    if (progress >= 100) { statusText = 'Concluído'; progressBarColor = 'bg-green-500'; }
                                                                    else if (e.amount > 0) { statusText = 'Parcial'; progressBarColor = 'bg-orange-500'; }
                                                                    else { statusText = 'Pendente'; progressBarColor = 'bg-slate-300'; }
                                                                }

                                                                return (
                                                                    <div key={e.id} onClick={() => openEditExpense(e)} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:shadow-sm transition-shadow">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <p className="font-bold text-sm text-primary dark:text-white">{e.description}</p>
                                                                            <p className="font-black text-sm text-primary dark:text-white">{formatCurrency(e.amount)}</p>
                                                                        </div>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{parseDateNoTimezone(e.date)}</p>
                                                                        {isEmpreita && (
                                                                            <>
                                                                                <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2 mb-1">
                                                                                    <div className="h-full" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: progressBarColor }}></div>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                                                                    <span>{statusText}</span>
                                                                                    <span>{formatCurrency(e.amount)} / {formatCurrency(e.totalAgreed)}</span>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Unlinked expenses within this category */}
                                            {groupedExpenses[category].unlinkedExpenses.length > 0 && (
                                                <div className="mb-4">
                                                    <h4 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 pl-8 ml-4"> {/* Indented header */}
                                                        Gastos Não Associados à Etapa
                                                    </h4>
                                                    <div className="space-y-3 pl-12 border-l-2 border-slate-100 dark:border-slate-800 ml-8"> {/* Further indent individual expenses */}
                                                        {groupedExpenses[category].unlinkedExpenses.map(e => {
                                                            const isEmpreita = e.totalAgreed && e.totalAgreed > 0;
                                                            let statusText = '';
                                                            let progress = 0;
                                                            let progressBarColor = '';

                                                            if (isEmpreita) {
                                                                progress = (e.amount / e.totalAgreed!) * 100;
                                                                if (progress >= 100) { statusText = 'Concluído'; progressBarColor = 'bg-green-500'; }
                                                                else if (e.amount > 0) { statusText = 'Parcial'; progressBarColor = 'bg-orange-500'; }
                                                                else { statusText = 'Pendente'; progressBarColor = 'bg-slate-300'; }
                                                            }

                                                            return (
                                                                <div key={e.id} onClick={() => openEditExpense(e)} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:shadow-sm transition-shadow">
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <p className="font-bold text-sm text-primary dark:text-white">{e.description}</p>
                                                                        <p className="font-black text-sm text-primary dark:text-white">{formatCurrency(e.amount)}</p>
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{parseDateNoTimezone(e.date)}</p>
                                                                    {isEmpreita && (
                                                                        <>
                                                                            <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2 mb-1">
                                                                                <div className="h-full" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: progressBarColor }}></div>
                                                                            </div>
                                                                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                                                                <span>{statusText}</span>
                                                                                <span>{formatCurrency(e.amount)} / {formatCurrency(e.totalAgreed)}</span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'FERRAMENTAS' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                            <button onClick={() => setSubView('TEAM')} className="p-6 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Gerenciar Equipe">
                                <i className="fa-solid fa-users text-2xl mb-2 text-secondary"></i>
                                <span className="font-bold text-primary dark:text-white text-sm">Equipe</span>
                            </button>
                            <button onClick={() => setSubView('PHOTOS')} className="p-6 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Ver Fotos da Obra">
                                <i className="fa-solid fa-camera text-2xl mb-2 text-secondary"></i>
                                <span className="font-bold text-primary dark:text-white text-sm">Fotos</span>
                            </button>
                            <button onClick={() => setSubView('REPORTS')} className="p-6 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Gerar Relatórios">
                                <i className="fa-solid fa-file-pdf text-2xl mb-2 text-secondary"></i>
                                <span className="font-bold text-primary dark:text-white text-sm">Relatórios</span>
                            </button>
                            <button onClick={() => setSubView('PROJECTS')} className="p-6 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Gerenciar Arquivos">
                                <i className="fa-solid fa-folder text-2xl mb-2 text-secondary"></i>
                                <span className="font-bold text-primary dark:text-white text-sm">Arquivos</span>
                            </button>
                            {!isSubscriptionValid && (
                                <button onClick={() => navigate('/settings')} className="col-span-2 p-6 bg-gradient-gold text-white rounded-3xl font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-amber-500/30 hover:scale-[1.02] transition-all" aria-label="Liberar Acesso Vitalício">
                                    <i className="fa-solid fa-crown"></i> Liberar Acesso Vitalício
                                </button>
                            )}
                            <button onClick={() => setIsCalculatorModalOpen(true)} className="p-6 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Abrir Calculadoras">
                                <i className="fa-solid fa-calculator text-2xl mb-2 text-secondary"></i>
                                <span className="font-bold text-primary dark:text-white text-sm">Calculadoras</span>
                            </button>
                            <button onClick={() => setSubView('CONTRACTS')} className="p-6 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Gerar Contratos">
                                <i className="fa-solid fa-file-contract text-2xl mb-2 text-secondary"></i>
                                <span className="font-bold text-primary dark:text-white text-sm">Contratos</span>
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-in slide-in-from-right-4">
                    <button onClick={() => setSubView('NONE')} className="mb-6 text-secondary font-bold flex items-center gap-2 hover:opacity-80" aria-label="Voltar para Ferramentas"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
                    {subView === 'TEAM' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-primary dark:text-white">Equipe</h2>
                                <button onClick={() => openPersonModal('WORKER')} className="bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar profissional"><i className="fa-solid fa-plus"></i></button>
                            </div>
                            {workers.length === 0 ? (
                                <p className="text-center text-slate-400 py-8 italic text-sm">Nenhum profissional cadastrado.</p>
                            ) : (
                                workers.map(w => (
                                    <div key={w.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
                                        <div>
                                            <p className="font-bold text-primary dark:text-white">{w.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{w.role} • {w.phone}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openPersonModal('WORKER', w)} className="text-slate-400 hover:text-secondary transition-colors p-2" aria-label="Editar profissional"><i className="fa-solid fa-pencil"></i></button>
                                            <button onClick={() => handleDeletePerson(w.id, w.workId, 'WORKER')} className="text-red-400 hover:text-red-600 transition-colors p-2" aria-label="Remover profissional"><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <h2 className="text-xl font-bold text-primary dark:text-white">Fornecedores</h2>
                                <button onClick={() => openPersonModal('SUPPLIER')} className="bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar fornecedor"><i className="fa-solid fa-plus"></i></button>
                            </div>
                            {suppliers.length === 0 ? (
                                <p className="text-center text-slate-400 py-8 italic text-sm">Nenhum fornecedor cadastrado.</p>
                            ) : (
                                suppliers.map(s => (
                                    <div key={s.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
                                        <div>
                                            <p className="font-bold text-primary dark:text-white">{s.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{s.category} • {s.phone}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openPersonModal('SUPPLIER', s)} className="text-slate-400 hover:text-secondary transition-colors p-2" aria-label="Editar fornecedor"><i className="fa-solid fa-pencil"></i></button>
                                            <button onClick={() => handleDeletePerson(s.id, s.workId, 'SUPPLIER')} className="text-red-400 hover:text-red-600 transition-colors p-2" aria-label="Remover fornecedor"><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    {subView === 'REPORTS' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Relatórios da Obra</h2>
                            <RenderCronogramaReport />
                            <RenderMateriaisReport />
                            <RenderFinanceiroReport />
                            <button onClick={handleExportExcel} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-colors" aria-label="Exportar para Excel"><i className="fa-solid fa-file-excel mr-2"></i> Exportar Excel</button>
                        </div>
                    )}
                    {subView === 'PHOTOS' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Fotos da Obra</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-secondary transition-colors cursor-pointer">
                                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'PHOTO')} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Adicionar foto" />
                                    {uploading ? (
                                        <i className="fa-solid fa-circle-notch fa-spin text-slate-400 text-2xl"></i>
                                    ) : (
                                        <i className="fa-solid fa-plus text-slate-400 text-2xl"></i>
                                    )}
                                </div>
                                {photos.length === 0 ? (
                                    <div className="col-span-2 text-center text-slate-400 py-8 italic text-sm">Nenhuma foto adicionada.</div>
                                ) : (
                                    photos.map(p => <img key={p.id} src={p.url} className="aspect-square object-cover rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm" alt={p.description} />)
                                )}
                            </div>
                        </div>
                    )}
                    {subView === 'PROJECTS' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Documentos e Projetos</h2>
                            <div className="relative p-6 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-secondary transition-colors cursor-pointer">
                                <input type="file" onChange={e => handleFileUpload(e, 'FILE')} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Adicionar arquivo" />
                                {uploading ? (
                                    <i className="fa-solid fa-circle-notch fa-spin text-slate-400 text-2xl mb-2"></i>
                                ) : (
                                    <i className="fa-solid fa-file-arrow-up text-slate-400 text-2xl mb-2"></i>
                                )}
                                <p className="text-sm text-slate-500 dark:text-slate-400">Arraste e solte ou clique para adicionar arquivos</p>
                            </div>
                            {files.length === 0 ? (
                                <p className="text-center text-slate-400 py-8 italic text-sm">Nenhum arquivo adicionado.</p>
                            ) : (
                                <div className="space-y-3">
                                    {files.map(f => (
                                        <a href={f.url} target="_blank" rel="noopener noreferrer" key={f.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                            <i className="fa-solid fa-file-alt text-lg text-secondary"></i>
                                            <div className="flex-1">
                                                <p className="font-bold text-primary dark:text-white text-sm">{f.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{f.category} • {parseDateNoTimezone(f.date)}</p>
                                            </div>
                                            <i className="fa-solid fa-download text-slate-400"></i>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modals Simplificados para Funcionalidade */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-xl text-primary dark:text-white mb-4">{stepModalMode === 'ADD' ? 'Adicionar Nova Etapa' : 'Editar Etapa'}</h3>
                        <form onSubmit={handleSaveStep} className="space-y-4">
                            <input value={stepName} onChange={e => setStepName(e.target.value)} placeholder="Nome da Etapa" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Nome da Etapa" />
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="stepStartDate">Início:</label>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="stepEndDate">Fim:</label>
                                <input id="stepStartDate" type="date" value={stepStart} onChange={e => setStepStart(e.target.value)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Data de Início da Etapa" />
                                <input id="stepEndDate" type="date" value={stepEnd} onChange={e => setStepEnd(e.target.value)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Data de Fim da Etapa" />
                            </div>
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-light transition-colors" aria-label="Salvar etapa">Salvar</button>
                            <button type="button" onClick={() => setIsStepModalOpen(false)} className="w-full py-2 text-slate-500 font-medium hover:text-primary dark:hover:text-white transition-colors" aria-label="Cancelar edição/criação de etapa">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Modal de Adicionar Material */}
            {addMatModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-xl text-primary dark:text-white mb-4">Adicionar Material</h3>
                        <form onSubmit={handleAddMaterial} className="space-y-4">
                            {/* Bloco 1 - Identidade */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-3">
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Identidade do Material</label>
                                <input value={newMatName} onChange={e => setNewMatName(e.target.value)} placeholder="Nome do Material" className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Nome do Material" />
                                <input value={newMatBrand} onChange={e => setNewMatBrand(e.target.value)} placeholder="Marca (opcional)" className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Marca do Material" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="number" value={newMatQty} onChange={e => setNewMatQty(e.target.value)} placeholder="Qtd. Planejada" className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Quantidade Planejada" />
                                    <input value={newMatUnit} onChange={e => setNewMatUnit(e.target.value)} placeholder="Unidade (ex: m², un, kg)" className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Unidade do Material" />
                                </div>
                                <select value={newMatStepId} onChange={e => setNewMatStepId(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Associar à Etapa">
                                    <option value="">Sem Etapa Específica</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            
                            {/* Bloco 3 - Lançamento Atual (compra agora) */}
                            <label className="flex items-center gap-2 text-sm text-primary dark:text-white font-medium cursor-pointer">
                                <input type="checkbox" checked={newMatBuyNow} onChange={e => setNewMatBuyNow(e.target.checked)} className="form-checkbox h-4 w-4 text-secondary rounded border-slate-300 dark:border-slate-700 focus:ring-secondary transition-colors" aria-label="Lançar compra agora" />
                                Lançar compra agora?
                            </label>
                            {newMatBuyNow && (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <input type="number" value={newMatBuyQty} onChange={e => setNewMatBuyQty(e.target.value)} placeholder="Qtd. Comprada" className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Quantidade Comprada Agora" />
                                    <input type="number" value={newMatBuyCost} onChange={e => setNewMatBuyCost(e.target.value)} placeholder={formatCurrency(0).replace('R$', '')} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Custo Total da Compra" />
                                </div>
                            )}
                            {/* Bloco 4 - Ação */}
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar Material">Adicionar Material</button>
                            <button type="button" onClick={() => setAddMatModal(false)} className="w-full py-2 text-slate-500 font-medium hover:text-primary dark:hover:text-white transition-colors" aria-label="Cancelar">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Edição de Material */}
            {materialModal.isOpen && materialModal.material && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-xl text-primary dark:text-white mb-4">Editar Material</h3>
                        <form onSubmit={handleUpdateMaterial} className="space-y-4">
                             {/* Bloco 1 - Identidade */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-3">
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Identidade do Material</label>
                                <input value={matName} onChange={e => setMatName(e.target.value)} placeholder="Nome do Material" className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Nome do Material" />
                                <input value={matBrand} onChange={e => setMatBrand(e.target.value)} placeholder="Marca (opcional)" className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Marca do Material" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="number" value={matPlannedQty} onChange={e => setMatPlannedQty(e.target.value)} placeholder="Qtd. Planejada" className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Quantidade Planejada" />
                                    <input value={matUnit} onChange={e => setMatUnit(e.target.value)} placeholder="Unidade (ex: m², un, kg)" className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Unidade do Material" />
                                </div>
                            </div>
                            {/* Bloco 2 - Total/Acumulado */}
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-900 text-green-800 dark:text-green-200 font-bold flex justify-between items-center text-lg">
                                <span>Comprado:</span>
                                <span>{materialModal.material.purchasedQty} {materialModal.material.unit}</span>
                            </div>
                            {/* Bloco 3 - Lançamento Atual (nova compra) */}
                            <h4 className="font-bold text-lg text-primary dark:text-white mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">Registrar Nova Compra</h4>
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                <input type="number" value={matBuyQty} onChange={e => setMatBuyQty(e.target.value)} placeholder="Qtd. Comprada Agora" className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Quantidade comprada agora" />
                                <input type="number" value={matBuyCost} onChange={e => setMatBuyCost(e.target.value)} placeholder={formatCurrency(0).replace('R$', '')} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Custo total da nova compra" />
                            </div>
                            {/* Bloco 4 - Ação */}
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-light transition-colors" aria-label="Salvar e Registrar Compra">Salvar e Registrar Compra</button>
                            <button type="button" onClick={() => setMaterialModal({isOpen: false, material: null})} className="w-full py-2 text-slate-500 font-medium hover:text-primary dark:hover:text-white transition-colors" aria-label="Cancelar">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Adicionar/Editar Despesa */}
            {expenseModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-xl text-primary dark:text-white mb-4">{expenseModal.mode === 'ADD' ? 'Adicionar Novo Gasto' : 'Registrar Pagamento/Editar Gasto'}</h3>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            {/* Bloco 1 - Identidade */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-3">
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Identidade do Gasto</label>
                                <input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Descrição do Gasto (ex: Pedreiro, Cimento)" className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Descrição do Gasto" />
                                <select value={expCategory} onChange={e => setExpCategory(e.target.value as ExpenseCategory)} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Categoria do Gasto">
                                    {Object.values(ExpenseCategory).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <select value={expStepId} onChange={e => setExpStepId(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Associar à Etapa">
                                    <option value="">Associar à Etapa (Opcional)</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            
                            {/* Bloco 2 - Total/Acumulado (se EDITANDO) */}
                            {expenseModal.mode === 'EDIT' && (
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-900 text-green-800 dark:text-green-200 font-bold flex justify-between items-center text-lg">
                                    <span>Total Pago:</span>
                                    <span>{formatCurrency(expSavedAmount)}</span>
                                </div>
                            )}
                            
                            {/* Bloco 3 - Lançamento Atual */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-3">
                                {expCategory === ExpenseCategory.LABOR && expenseModal.mode === 'ADD' && (
                                    <input type="number" value={expTotalAgreed} onChange={e => setExpTotalAgreed(e.target.value)} placeholder="Preço Combinado (Total da Empreita)" className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Preço Combinado (Total da Empreita)" />
                                )}
                                <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder={expenseModal.mode === 'ADD' ? formatCurrency(0).replace('R$', '') : 'Valor Pago Agora'} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label={expenseModal.mode === 'ADD' ? 'Valor Total do Gasto' : 'Valor Pago Agora'} />
                            </div>

                            {/* Bloco 4 - Ação */}
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-light transition-colors" aria-label="Salvar Gasto">Salvar Gasto</button>
                            <button type="button" onClick={() => setExpenseModal({isOpen: false, mode: 'ADD'})} className="w-full py-2 text-slate-500 font-medium hover:text-primary dark:hover:text-white transition-colors" aria-label="Cancelar">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Adicionar/Editar Pessoa (Trabalhador/Fornecedor) */}
            {isPersonModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-xl text-primary dark:text-white mb-4">{personId ? `Editar ${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}` : `Adicionar Novo ${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}`}</h3>
                        <form onSubmit={handleSavePerson} className="space-y-4">
                            {/* Bloco 1 - Identidade */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-3">
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Dados Básicos</label>
                                <input value={personName} onChange={e => setPersonName(e.target.value)} placeholder={`Nome do ${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}`} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label={`Nome do ${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}`} />
                                <input value={personPhone} onChange={e => setPersonPhone(e.target.value)} placeholder="Telefone (WhatsApp)" className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" required aria-label="Telefone (WhatsApp)" />
                                <select value={personRole} onChange={e => setPersonRole(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label={personMode === 'WORKER' ? 'Função do Profissional' : 'Categoria do Fornecedor'}>
                                    {personMode === 'WORKER' ? (
                                        STANDARD_JOB_ROLES.map(role => <option key={role} value={role}>{role}</option>)
                                    ) : (
                                        STANDARD_SUPPLIER_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)
                                    )}
                                </select>
                            </div>
                            {/* Bloco 3 - Observações (opcional) */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Observações</label>
                                <textarea value={personNotes} onChange={e => setPersonNotes(e.target.value)} placeholder="Observações (opcional)" rows={3} className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors resize-none" aria-label="Observações"></textarea>
                            </div>
                            {/* Bloco 4 - Ação */}
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-light transition-colors" aria-label="Salvar">Salvar</button>
                            <button type="button" onClick={() => setIsPersonModalOpen(false)} className="w-full py-2 text-slate-500 font-medium hover:text-primary dark:hover:text-white transition-colors" aria-label="Cancelar">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}

            <ZeModal isOpen={zeModal.isOpen} title={zeModal.title} message={zeModal.message} confirmText={zeModal.confirmText} onConfirm={zeModal.onConfirm} onCancel={() => setZeModal({isOpen: false})} type={zeModal.type} isConfirming={zeModal.isConfirming} />
            
            {isCalculatorModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-xl text-primary dark:text-white mb-4">Calculadora</h3>
                        <select value={calcType} onChange={e => setCalcType(e.target.value as any)} className="w-full p-3 mb-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors" aria-label="Tipo de Cálculo">
                            <option value="PISO">Piso/Revestimento</option>
                            <option value="PAREDE">Tijolos/Blocos</option>
                            <option value="PINTURA">Tinta</option>
                        </select>
                        <input type="number" value={calcArea} onChange={e => setCalcArea(e.target.value)} placeholder="Área em m²" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors mb-4" aria-label="Área em metros quadrados" />
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                            {calcResult.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 italic">Insira a área para calcular.</p>
                            ) : (
                                calcResult.map((r, i) => <p key={i} className="text-sm font-bold text-primary dark:text-white">• {r}</p>)
                            )}
                        </div>
                        <button onClick={() => setIsCalculatorModalOpen(false)} className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-primary-light transition-colors" aria-label="Fechar calculadora">Fechar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkDetail;
