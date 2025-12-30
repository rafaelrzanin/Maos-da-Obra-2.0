
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { ZeModal } from '../components/ZeModal.tsx';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
type SubView = 'NONE' | 'TEAM' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST' | 'AICHAT'; // Changed SUPPLIERS to be part of TEAM, added AICHAT as a subview for bonus cards
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
    // FIX: Re-enforced explicit type to help compiler resolve scope.
    const [uploading, setUploading] = useState<boolean>(false);
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
    const [personEmail, setPersonEmail] = useState(''); // NEW: Email for supplier
    const [personAddress, setPersonAddress] = useState(''); // NEW: Address for supplier
    const [workerDailyRate, setWorkerDailyRate] = useState(''); // NEW: Daily rate for worker

    // NEW: Contract states
    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [viewContract, setViewContract] = useState<Contract | null>(null);

    // NEW: Checklist states
    const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
    const [currentChecklist, setCurrentChecklist] = useState<Checklist | null>(null);
    const [allChecklists, setAllChecklists] = useState<Checklist[]>([] );
    const [selectedChecklistCategory, setSelectedChecklistCategory] = useState<string>('all'); // Filter checklists by step category


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
                const [s, m, e, wk, sp, ph, fl, workStats, checklists] = await Promise.all([ // Added checklists
                    dbService.getSteps(w.id),
                    dbService.getMaterials(w.id),
                    dbService.getExpenses(w.id),
                    dbService.getWorkers(w.id),
                    dbService.getSuppliers(w.id),
                    dbService.getPhotos(w.id),
                    dbService.getFiles(w.id),
                    dbService.calculateWorkStats(w.id),
                    dbService.getChecklists(w.id) // Fetch checklists
                ]);
                setSteps(s ? s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) : []);
                setMaterials(m || []);
                setExpenses(e ? e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : []);
                setWorkers(wk || []);
                setSuppliers(sp || []);
                setPhotos(ph || []);
                setFiles(fl || []);
                setStats(workStats);
                setAllChecklists(checklists || []); // Set all checklists
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
        setExpAmount(''); 
        setExpSavedAmount(expense.paidAmount || expense.amount); 
        setExpTotalAgreed(expense.totalAgreed ? String(expense.totalAgreed) : ''); 
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
                const newPaidAmount = (existing.paidAmount || 0) + inputAmount;
                const newTotalAgreed = expTotalAgreed ? Number(expTotalAgreed) : existing.totalAgreed;

                await dbService.updateExpense({ 
                    ...existing, 
                    description: expDesc, 
                    amount: newPaidAmount, 
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
            setWorkerDailyRate(item.dailyRate ? String(item.dailyRate) : ''); // NEW
            setPersonEmail(item.email || ''); // NEW
            setPersonAddress(item.address || ''); // NEW
        } else {
            setPersonId(null); setPersonName(''); setPersonPhone(''); setPersonNotes('');
            setPersonRole(mode === 'WORKER' ? STANDARD_JOB_ROLES[0] : STANDARD_SUPPLIER_CATEGORIES[0]);
            setWorkerDailyRate(''); // NEW
            setPersonEmail(''); // NEW
            setPersonAddress(''); // NEW
        }
        setIsPersonModalOpen(true);
    };

    const handleSavePerson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !work) return;
        
        if (personMode === 'WORKER') {
            const payload: Omit<Worker, 'id'> = { 
                userId: user.id, 
                workId: work.id, 
                name: personName, 
                role: personRole, 
                phone: personPhone, 
                notes: personNotes,
                dailyRate: Number(workerDailyRate) || undefined
            };
            if (personId) {
                await dbService.updateWorker({ ...payload, id: personId });
            } else {
                await dbService.addWorker(payload);
            }
        } else { // SUPPLIER
            const payload: Omit<Supplier, 'id'> = { 
                userId: user.id, 
                workId: work.id, 
                name: personName, 
                category: personRole, // For supplier, role means category
                phone: personPhone, 
                notes: personNotes,
                email: personEmail || undefined, // NEW
                address: personAddress || undefined // NEW
            };
            if (personId) {
                await dbService.updateSupplier({ ...payload, id: personId });
            } else {
                await dbService.addSupplier(payload);
            }
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

    const handleGenerateWhatsappLink = (phone: string) => {
        const cleanedPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/55${cleanedPhone}`, '_blank');
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

    // NEW: Placeholder for PDF Export (functionality out of scope for UI/UX refactor)
    const handleExportPdf = () => {
        setZeModal({
            isOpen: true,
            title: 'Exportação em PDF',
            message: 'A funcionalidade de exportação para PDF está em desenvolvimento e estará disponível em breve com layouts profissionais!',
            confirmText: 'Entendido',
            type: 'INFO',
            onCancel: () => setZeModal({isOpen: false})
        });
    };

    // NEW: Handle Checklist item toggle
    const handleChecklistItemToggle = async (checklistId: string, itemId: string) => {
        const updatedChecklists = allChecklists.map(cl => 
            cl.id === checklistId 
            ? { ...cl, items: cl.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item) }
            : cl
        );
        setAllChecklists(updatedChecklists);
        // Find the updated checklist and save it
        const checklistToUpdate = updatedChecklists.find(cl => cl.id === checklistId);
        if (checklistToUpdate) {
            await dbService.updateChecklist(checklistToUpdate);
        }
    };

    // NEW: Add New Checklist
    const handleAddChecklist = async (category: string) => {
        if (!work) return;
        const existingTemplate = CHECKLIST_TEMPLATES.find(t => t.category === category && t.workId === 'mock-work-id'); // Find a template
        
        // If no specific template for category, create a generic one
        const newChecklistName = existingTemplate ? existingTemplate.name : `${category} - Checklist Padrão`;
        const newChecklistItems = existingTemplate ? existingTemplate.items.map(item => ({...item, id: `${Date.now()}-${Math.random()}`})) : [{id: `${Date.now()}-1`, text: 'Novo item', checked: false}];

        const newChecklist: Omit<Checklist, 'id'> = {
            workId: work.id,
            name: newChecklistName,
            category: category,
            items: newChecklistItems
        };
        const savedChecklist = await dbService.addChecklist(newChecklist);
        load(); // Reload all checklists
        setCurrentChecklist(savedChecklist);
        setIsChecklistModalOpen(true);
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
            <h3 className="font-bold mb-4 text-primary dark:text-white">Cronograma Detalhado</h3>
            <div className="space-y-4">
                {steps.map(s => {
                    const isDelayed = s.status !== StepStatus.COMPLETED && s.endDate < todayString;
                    let statusColor = 'text-slate-500'; // Gray
                    if (s.status === StepStatus.COMPLETED) statusColor = 'text-green-600';
                    else if (s.status === StepStatus.IN_PROGRESS) statusColor = 'text-orange-600';
                    else if (isDelayed) statusColor = 'text-red-600';

                    return (
                        <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-1">
                                <p className="font-bold text-sm text-primary dark:text-white">{s.name}</p>
                                <span className={`text-xs font-semibold ${statusColor}`}>
                                    {isDelayed ? 'Atrasada' : s.status === StepStatus.COMPLETED ? 'Concluída' : s.status === StepStatus.IN_PROGRESS ? 'Em Andamento' : 'Pendente'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{parseDateNoTimezone(s.startDate)} - {parseDateNoTimezone(s.endDate)}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const RenderMateriaisReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold mb-4 text-primary dark:text-white">Materiais por Etapa</h3>
            {steps.map(step => {
                const stepMats = materials.filter(m => m.stepId === step.id);
                if (stepMats.length === 0) return null;
                return (
                    <div key={step.id} className="mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-black uppercase text-secondary mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">{step.name}</h4>
                        <div className="space-y-2">
                            {stepMats.map(m => {
                                const statusText = m.purchasedQty >= m.plannedQty ? 'Concluído' : m.purchasedQty > 0 ? 'Parcial' : 'Pendente';
                                const statusColor = m.purchasedQty >= m.plannedQty ? 'text-green-600' : m.purchasedQty > 0 ? 'text-orange-600' : 'text-red-500';
                                return (
                                    <div key={m.id} className="flex justify-between items-center text-sm">
                                        <span className="text-primary dark:text-white">• {m.name}</span>
                                        <span className={`font-semibold ${statusColor}`}>{m.purchasedQty}/{m.plannedQty} {m.unit} ({statusText})</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const RenderFinanceiroReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold mb-4 text-primary dark:text-white">Lançamentos Financeiros</h3>
            {Object.values(ExpenseCategory).map(category => {
                const expensesInCategory = Object.values(groupedExpenses[category].steps).flatMap(stepGroup => stepGroup.expenses).concat(groupedExpenses[category].unlinkedExpenses);
                if (expensesInCategory.length === 0) return null;

                return (
                    <div key={category} className="mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-black uppercase text-primary dark:text-white mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                            {category} (Total: {formatCurrency(groupedExpenses[category].totalCategoryAmount)})
                        </h4>
                        <div className="space-y-3">
                            {Object.keys(groupedExpenses[category].steps).filter(stepId => groupedExpenses[category].steps[stepId].expenses.length > 0).map(stepId => {
                                const stepGroup = groupedExpenses[category].steps[stepId];
                                return (
                                    <div key={stepId} className="pl-4 border-l border-slate-300 dark:border-slate-700">
                                        <h5 className="font-bold text-sm text-secondary mb-2">{stepGroup.stepName}</h5>
                                        <div className="space-y-1">
                                            {stepGroup.expenses.map(e => (
                                                <div key={e.id} className="flex justify-between text-xs py-1">
                                                    <span className="text-slate-700 dark:text-slate-300">{e.description}</span>
                                                    <span className="font-bold text-primary dark:text-white">{formatCurrency(e.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {groupedExpenses[category].unlinkedExpenses.length > 0 && (
                                <div className="pl-4 border-l border-slate-300 dark:border-slate-700 mt-3">
                                    <h5 className="font-bold text-sm text-slate-500 mb-2">Sem Etapa Específica</h5>
                                    <div className="space-y-1">
                                        {groupedExpenses[category].unlinkedExpenses.map(e => (
                                            <div key={e.id} className="flex justify-between text-xs py-1">
                                                <span className="text-slate-700 dark:text-slate-300">{e.description}</span>
                                                <span className="font-bold text-primary dark:text-white">{formatCurrency(e.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
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

    const hasLifetimeAccess = user?.plan === PlanType.VITALICIO;

    return (
        // FIX: Wrapped the main content in React.Fragment to ensure a single, explicit root element.
        // This is a benign structural change that can sometimes help compilers with JSX parsing issues.
        <React.Fragment>
            <div className="max-w-4xl mx-auto py-8 px-4 md:px-0 pb-24">
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => subView === 'NONE' ? navigate('/') : setSubView('NONE')} className="text-slate-400 hover:text-primary" aria-label="Voltar"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                    <h1 className="text-2xl font-black text-primary dark:text-white">{work.name}</h1>
                    <div className="w-10"></div>
                </div>

                {subView === 'NONE' ? (
                    <>
                        <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t z-50 flex justify-around p-2 md:static md:bg-slate-100 md:rounded-2xl md:mb-6 shadow-lg md:shadow-none">
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
                                    <button onClick={() => { setStepModalMode('ADD'); setIsStepModalOpen(true); }} className="bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar etapa"><i className="fa-solid fa-plus"></i></button>
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
                                                <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-800 shadow-lg ${stepStatusBgClass} ${stepStatusTextColorClass}`}>
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="font-black text-xl text-primary dark:text-white flex items-center gap-2 pl-0">
                                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${stepStatusBgClass.replace('/10', '/20').replace('bg-', 'bg-').replace('dark:bg-green-900/20', 'dark:bg-green-800').replace('dark:text-green-300', 'dark:text-white')}`}>
                                                                <i className={`fa-solid ${stepStatusIcon} ${stepStatusTextColorClass}`}></i>
                                                            </span>
                                                            <span className="text-primary dark:text-white">{index + 1}. {step.name}</span>
                                                        </h3>
                                                        <span className={`text-sm font-semibold ${stepStatusTextColorClass}`}>
                                                            {isStepDelayed ? 'Atrasada' : step.status === StepStatus.COMPLETED ? 'Concluída' : step.status === StepStatus.IN_PROGRESS ? 'Em Andamento' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-10">{parseDateNoTimezone(step.startDate)} - {parseDateNoTimezone(step.endDate)}</p>
                                                </div>

                                                <div className="space-y-3 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
                                                    {stepMats.length === 0 ? (
                                                        <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum material associado a esta etapa.</p>
                                                    ) : (
                                                        stepMats.map(m => (
                                                            <div key={m.id} onClick={() => { setMaterialModal({isOpen: true, material: m}); setMatName(m.name); setMatBrand(m.brand||''); setMatPlannedQty(String(m.plannedQty)); setMatUnit(m.unit); }} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:shadow-sm transition-shadow">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <p className="font-bold text-sm text-primary dark:text-white">{m.name}</p>
                                                                    <span className="text-xs font-black text-green-600 dark:text-green-400">{m.purchasedQty} {m.unit}</span>
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
                                    {/* Gasto Total Block */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shrink-0 ${budgetStatusColor}`}>
                                            <i className={`fa-solid ${budgetStatusIcon}`}></i>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Gasto Total</p>
                                            <h3 className="text-2xl font-black text-primary dark:text-white">{formatCurrency(totalSpent)}</h3>
                                        </div>
                                    </div>
                                    
                                    {/* Orçamento Planejado Block (moved below Gasto Total) */}
                                    {work.budgetPlanned > 0 && (
                                        <div className="flex justify-between items-center text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                                            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Orçamento Planejado</span>
                                            <span className="text-lg font-black text-primary dark:text-white">{formatCurrency(work.budgetPlanned)}</span>
                                        </div>
                                    )}

                                    {/* Budget Progress Bar */}
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
                                                    <h3 className="font-black text-xl text-primary dark:text-white flex items-center gap-2 pl-0">
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
                                                    const step = steps.find(s => s.id === stepId); 
                                                    if (!step) return null;
                                                    
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
                                                        <div key={stepId} className="mb-4 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
                                                            {/* Step "Chapter" Card for Financeiro */}
                                                            <div className={`bg-white dark:bg-slate-900 rounded-2xl p-3 mb-3 border border-slate-200 dark:border-slate-800 shadow-lg ${stepStatusBgClass} ${stepStatusTextColorClass}`}>
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="font-black text-lg text-primary dark:text-white flex items-center gap-2 pl-0"> 
                                                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${stepStatusBgClass.replace('/10', '/20').replace('bg-', 'bg-').replace('dark:bg-green-900/20', 'dark:bg-green-800').replace('dark:text-green-300', 'dark:text-white')}`}> 
                                                                            <i className={`fa-solid ${stepStatusIcon} ${stepStatusTextColorClass}`}></i>
                                                                        </span>
                                                                        <span className="text-primary dark:text-white">{step.name}</span>
                                                                    </h3>
                                                                    <span className={`text-xs font-semibold ${stepStatusTextColorClass}`}>
                                                                        {formatCurrency(stepGroup.totalStepAmount)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-9">{parseDateNoTimezone(step.startDate)} - {parseDateNoTimezone(step.endDate)}</p>
                                                            </div>

                                                            <div className="space-y-2 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
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
                                                                        <div key={e.id} onClick={() => openEditExpense(e)} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:shadow-sm transition-shadow">
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
                                                    <div className="mb-4 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
                                                        <h4 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 pl-0">
                                                            Gastos Não Associados à Etapa
                                                        </h4>
                                                        <div className="space-y-2 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
                                                            {groupedExpenses[category].unlinkedExpenses.map(e => {
                                                                const isEmpreita = e.totalAgreed && e.totalAgreed > 0;
                                                                let statusText = '';
                                                                let progress = 0;
                                                                let progressBarColor = '';

                                                                if (isEmpreita) {
                                                                    progress = (e.amount / e.totalAgre<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #fff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #0056b3;
        }
        p {
            line-height: 1.6;
        }
        .button {
            display: inline-block;
            background-color: #007bff;
            color: #fff;
            padding: 10px 15px;
            border-radius: 5px;
            text-decoration: none;
            margin-top: 20px;
        }
        .button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to My Simple Page</h1>
        <p>This is a basic HTML page to demonstrate a simple structure and some CSS styling.</p>
        <p>You can add more content here, such as images, lists, or tables, to make it more informative or interactive.</p>
        <a href="#" class="button">Learn More</a>
    </div>
</body>
</html>
