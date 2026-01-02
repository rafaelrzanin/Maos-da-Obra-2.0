


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
// NEW: Import ZeModal
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx';

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

// Define the full structure of groupedExpenses
interface GroupedExpenses {
    [category: string]: {
        totalCategoryAmount: number;
        steps: {
            [stepId: string]: ExpenseStepGroup;
        };
        unlinkedExpenses: Expense[];
    };
}

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

const WorkDetail = () => {
    const { id } = ReactRouter.useParams<{ id: string }>();
    const navigate = ReactRouter.useNavigate();
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
    const [uploading, setUploading] = useState<boolean>(false);
    const [reportActiveTab, setReportActiveTab] = useState<ReportSubTab>('CRONOGRAMA');
    
    // Filtro para Materiais no Relatório (mantido separado)
    const [reportMaterialFilterStepId, setReportMaterialFilterStepId] = useState<string>('ALL');
    
    // NOVO: Filtro para Materiais na aba principal
    const [mainMaterialFilterStepId, setMainMaterialFilterStepId] = useState<string>('ALL'); 
    
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
    const [personRole, setPersonRole] = useState(''); // For worker profession or supplier category
    const [personPhone, setPersonPhone] = useState('');
    const [personNotes, setPersonNotes] = useState('');
    const [personEmail, setPersonEmail] = useState('');
    const [personAddress, setPersonAddress] = useState('');
    const [workerDailyRate, setWorkerDailyRate] = useState('');
    const [isPersonSaving, setIsPersonSaving] = useState(false); // NEW: State for person modal loading

    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [viewContract, setViewContract] = useState<Contract | null>(null);

    // NEW: Checklist Modal States
    const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
    const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null); // Checklist being edited
    const [newChecklistItemText, setNewChecklistItemText] = useState(''); // For adding new items
    const [allChecklists, setAllChecklists] = useState<Checklist[]>([]);
    const [selectedChecklistCategory, setSelectedChecklistCategory] = useState<string>('all'); // Filter for Checklist view

    const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string, isConfirming?: boolean }>({ isOpen: false, title: '', message: '', onCancel: () => {} });

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
                const [s, m, e, wk, sp, ph, fl, workStats, checklists] = await Promise.all([
                    dbService.getSteps(w.id),
                    dbService.getMaterials(w.id),
                    dbService.getExpenses(w.id),
                    dbService.getWorkers(w.id),
                    dbService.getSuppliers(w.id),
                    dbService.getPhotos(w.id),
                    dbService.getFiles(w.id),
                    dbService.calculateWorkStats(w.id),
                    dbService.getChecklists(w.id)
                ]);
                setSteps(s ? s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) : []);
                setMaterials(m || []);
                setExpenses(e ? e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : []);
                setWorkers(wk || []);
                setSuppliers(sp || []);
                setPhotos(ph || []);
                setFiles(fl || []);
                setStats(workStats);
                setAllChecklists(checklists || []);
            }
        } catch (error: any) { // Explicitly type error as any to access .message
            console.error("Erro ao carregar detalhes da obra:", error);
            // NEW: Display this error in ZeModal
            setZeModal({
                isOpen: true,
                title: 'Erro ao Carregar Dados da Obra',
                message: `Não foi possível carregar os detalhes da obra. Detalhes: ${error.message || 'Um erro desconhecido ocorreu.'}\nPor favor, verifique sua conexão ou tente novamente.`,
                confirmText: 'Entendido',
                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                type: 'ERROR',
                isConfirming: false
            });
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
                    await load();
                    setZeModal(prev => ({ 
                        ...prev, 
                        isOpen: true, 
                        title: 'Sucesso!', 
                        message: 'Etapa excluída com sucesso.', 
                        confirmText: 'Ok', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: 'SUCCESS',
                        isConfirming: false 
                    }));
                }                       catch (error: any) {
                    console.error("Erro ao deletar etapa:", error);
                    setZeModal(prev => ({
                        ...prev,
                        isOpen: true,
                        title: 'Erro ao Excluir Etapa',
                        message: error.message || 'Não foi possível excluir a etapa. Verifique se há lançamentos financeiros associados a ela ou aos seus materiais.',
                        confirmText: 'Entendido',
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: 'ERROR',
                        isConfirming: false 
                    }));
                } finally {
                    setZeModal(prev => ({ ...prev, isConfirming: false })); 
                }
            },
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
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
            onConfirm: async () => { 
                try {
                    await dbService.deleteExpense(expenseId); 
                    await load(); 
                    setZeModal(prev => ({ 
                        ...prev, 
                        isOpen: true, 
                        title: 'Sucesso!', 
                        message: 'Gasto excluído com sucesso.', 
                        confirmText: 'Ok', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'SUCCESS',
                        isConfirming: false 
                    })); 
                } catch (error: any) {
                    console.error("Erro ao deletar gasto:", error);
                    setZeModal(prev => ({ 
                        ...prev, 
                        isOpen: true, 
                        title: 'Erro!', 
                        message: `Não foi possível remover: ${error.message}`, 
                        confirmText: 'Entendido', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'ERROR',
                        isConfirming: false
                    })); 
                }
            },
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
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
            setWorkerDailyRate(item.dailyRate ? String(item.dailyRate) : '');
            setPersonEmail(item.email || '');
            setPersonAddress(item.address || '');
        } else {
            setPersonId(null); setPersonName(''); setPersonPhone(''); setPersonNotes('');
            setPersonRole(mode === 'WORKER' ? STANDARD_JOB_ROLES[0] : STANDARD_SUPPLIER_CATEGORIES[0]);
            setWorkerDailyRate('');
            setPersonEmail('');
            setPersonAddress('');
        }
        setIsPersonModalOpen(true);
    };

    const handleSavePerson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !work || isPersonSaving) { // Disable if already saving
            console.log("[handleSavePerson] Aborting save: user/work missing or already saving.");
            return;
        }
        
        setIsPersonSaving(true); // Start saving
        console.log("[handleSavePerson] Started saving. isPersonSaving set to true.");

        try {
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
                console.log("[handleSavePerson] Salvando Trabalhador. Payload:", payload, "personId:", personId);
                if (personId) {
                    await dbService.updateWorker({ ...payload, id: personId });
                }                     else {
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
                    email: personEmail || undefined,
                    address: personAddress || undefined
                };
                console.log("[handleSavePerson] Salvando Fornecedor. Payload:", payload, "personId:", personId);
                if (personId) {
                    await dbService.updateSupplier({ ...payload, id: personId });
                }                     else {
                    await dbService.addSupplier(payload);
                }
            }
            
            setIsPersonModalOpen(false); // Close person modal first
            setZeModal(prev => ({
                ...prev,
                isOpen: true, 
                title: 'Sucesso!',
                message: `${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'} salvo com sucesso.`,
                confirmText: 'Ok',
                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                type: 'SUCCESS',
                isConfirming: false 
            }));
            console.log("[handleSavePerson] Person modal closed, success ZeModal shown. Reloading data...");
            await load(); // Reload data after showing success
            console.log("[handleSavePerson] Data reloaded successfully.");

        }           catch (error: any) {
            console.error(`[handleSavePerson] Erro ao salvar ${personMode === 'WORKER' ? 'profissional' : 'fornecedor'}:`, error);
            let userMessage = `Não foi possível salvar o ${personMode === 'WORKER' ? 'profissional' : 'fornecedor'}.`;
            
            if (error.message?.includes("'daily_rate' column of 'workers' in the schema cache")) {
                userMessage += `\n\nParece que a coluna 'daily_rate' está faltando na tabela 'workers' do seu banco de dados Supabase. Por favor, adicione-a.`;
                userMessage += `\n\n**Instrução SQL:** \`\`\`ALTER TABLE workers ADD COLUMN daily_rate NUMERIC NULL DEFAULT 0;\`\`\``;
            } else if (error.message?.includes('permission denied') || error.code === '42501') {
                userMessage += `\n\nVerifique suas permissões de RLS (Row Level Security) no Supabase.`;
            } else {
                userMessage += `\n\nDetalhes: ${error.message || 'Um erro desconhecido ocorreu.'}`;
            }

            setZeModal(prev => ({
                ...prev,
                isOpen: true, 
                title: 'Erro ao Salvar!',
                message: userMessage,
                confirmText: 'Entendido',
                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                type: 'ERROR',
                isConfirming: false 
            }));
            console.log("[handleSavePerson] Error occurred, error ZeModal shown.");

        } finally {
            setIsPersonSaving(false); 
            console.log("[handleSavePerson] Finally block: isPersonSaving set to false.");
        }
    };

    const handleDeletePerson = (pid: string, wid: string, mode: 'WORKER' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true, 
            title: 'Remover?', 
            message: 'Deseja remover esta pessoa?', 
            confirmText: 'Remover', 
            type: 'DANGER',
            onConfirm: async () => { 
                setZeModal(prev => ({ ...prev, isConfirming: true })); 
                console.log(`[handleDeletePerson] Deleting ${mode} ${pid} from work ${wid}.`);
                try {
                    if (mode === 'WORKER') await dbService.deleteWorker(pid, wid); 
                    else await dbService.deleteSupplier(pid, wid); 
                    
                    setZeModal(prev => ({ 
                        ...prev, 
                        isOpen: true, 
                        title: 'Sucesso!', 
                        message: `${mode === 'WORKER' ? 'Profissional' : 'Fornecedor'} removido com sucesso.`, 
                        confirmText: 'Ok', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'SUCCESS',
                        isConfirming: false 
                    }));
                    console.log(`[handleDeletePerson] ${mode} deleted, success ZeModal shown. Reloading data...`);
                    await load(); 
                    console.log(`[handleDeletePerson] Data reloaded.`);

                }                   catch (error: any) {
                    console.error(`Erro ao deletar ${mode === 'WORKER' ? 'profissional' : 'fornecedor'}:`, error);
                    setZeModal(prev => ({ 
                        ...prev, 
                        isOpen: true, 
                        title: 'Erro!', 
                        message: `Não foi possível remover: ${error.message}`, 
                        confirmText: 'Entendido', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'ERROR',
                        isConfirming: false 
                    }));
                    console.log(`[handleDeletePerson] Error occurred, error ZeModal shown.`);

                } finally {
                    setZeModal(prev => ({ ...prev, isConfirming: false })); 
                    console.log("[handleDeletePerson] Finally block: isConfirming reset.");

                }
            },
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
        });
    };

    const handleGenerateWhatsappLink = (phone: string) => {
        const cleanedPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/55${cleanedPhone}`, '_blank');
    };

    useEffect(() => {
        if (!calcArea) { setCalcResult([]); return; }
        const area = Number(calcArea);
        if (calcType === 'PISO') {
            setCalcResult([
                `${Math.ceil(area * 1.15)} m² de Piso`, // 15% de perda
                `${Math.ceil(area * 4)} kg de Argamassa`, // 4kg/m²
                `${Math.ceil(area * 0.15)} kg de Rejunte` // 0.15kg/m²
            ]);
        }
        else if (calcType === 'PAREDE') {
            setCalcResult([
                `${Math.ceil(area * 30)} Tijolos (9x19x19cm)`, // 30 tijolos/m²
                `${Math.ceil(area * 0.02)} m³ de Areia Média`, // 0.02m³/m²
                `${Math.ceil(area * 0.005)} m³ de Cimento` // 0.005m³/m²
            ]);
        }
        else if (calcType === 'PINTURA') {
            setCalcResult([
                `${Math.ceil(area / 5)} L de Tinta (2 demãos, 1 demão/5m²/L)`, // Ex: 5m²/L por demão, 2 demãos = 2.5m²/L total
                `${Math.ceil(area * 0.2)} kg de Massa Corrida` // 0.2kg/m²
            ]);
        }
    }, [calcArea, calcType]);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(steps), "Cronograma");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(materials), "Materiais");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), "Financeiro");
        XLSX.writeFile(wb, `Obra_${work?.name}.xlsx`);
    };

    const handleExportPdf = () => {
        setZeModal(prev => ({
            ...prev,
            isOpen: true,
            title: 'Exportação em PDF',
            message: 'A funcionalidade de exportação para PDF está em desenvolvimento e estará disponível em breve com layouts profissionais!',
            confirmText: 'Entendido',
            type: 'INFO',
            onCancel: () => setZeModal(prev => ({...prev, isOpen: false})),
            isConfirming: false
        }));
    };

    const handleChecklistItemToggle = async (checklistId: string, itemId: string) => {
        const updatedChecklists = allChecklists.map(cl => 
            cl.id === checklistId 
            ? { ...cl, items: cl.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item) }
            : cl
        );
        setAllChecklists(updatedChecklists);
        // Only update the specific checklist if it's the one currently being edited
        if (editingChecklist && editingChecklist.id === checklistId) {
            setEditingChecklist(updatedChecklists.find(cl => cl.id === checklistId) || null);
        }
        const checklistToUpdate = updatedChecklists.find(cl => cl.id === checklistId);
        if (checklistToUpdate) {
            await dbService.updateChecklist(checklistToUpdate);
        }
    };

    const handleAddChecklist = async (category: string) => {
        if (!work) return;
        // Search in CHECKLIST_TEMPLATES (mock data)
        const templateCategory = category === 'Geral' ? 'Geral' : steps.find(s => s.name === category)?.name || 'Geral';
        const existingTemplate = CHECKLIST_TEMPLATES.find(t => t.category === templateCategory);
        
        const newChecklistName = existingTemplate ? existingTemplate.name : `${templateCategory} - Checklist Padrão`;
        const newChecklistItems = existingTemplate ? existingTemplate.items.map(item => ({...item, id: `${Date.now()}-${Math.random()}`})) : [{id: `${Date.now()}-1`, text: 'Novo item', checked: false}];

        const newChecklist: Omit<Checklist, 'id'> = {
            workId: work.id,
            name: newChecklistName,
            category: templateCategory,
            items: newChecklistItems
        };
        const savedChecklist = await dbService.addChecklist(newChecklist);
        await load(); // Reload all checklists, including the newly added one
        setEditingChecklist(savedChecklist); // Set the newly created checklist as the one being edited
        setIsChecklistModalOpen(true); // Open the editing modal
    };

    // NEW: Handle update to checklist name
    const handleUpdateChecklistName = async (newName: string) => {
        if (!editingChecklist || !work) return;
        setEditingChecklist(prev => prev ? { ...prev, name: newName } : null); // Optimistic UI update
        const updated = { ...editingChecklist, name: newName };
        await dbService.updateChecklist(updated);
        await load(); // Reload all to keep state in sync
    };

    // NEW: Handle add new checklist item
    const handleAddChecklistItem = async () => {
        if (!editingChecklist || !newChecklistItemText.trim() || !work) return;
        const newItem = { id: `${Date.now()}-${Math.random()}`, text: newChecklistItemText, checked: false };
        const updatedItems = [...editingChecklist.items, newItem];
        const updatedChecklist = { ...editingChecklist, items: updatedItems };
        setEditingChecklist(updatedChecklist); // Optimistic UI update
        await dbService.updateChecklist(updatedChecklist);
        setNewChecklistItemText(''); // Clear input
        await load(); // Reload all to keep state in sync
    };

    // NEW: Handle delete checklist item
    const handleDeleteChecklistItem = async (itemId: string) => {
        if (!editingChecklist || !work) return;
        setZeModal(prev => ({
            ...prev,
            isOpen: true,
            title: 'Remover Item?',
            message: 'Tem certeza que deseja remover este item da lista?',
            confirmText: 'Remover',
            type: 'DANGER',
            onConfirm: async () => {
                setZeModal(prevConfirm => ({ ...prevConfirm, isConfirming: true }));
                try {
                    const updatedItems = editingChecklist.items.filter(item => item.id !== itemId);
                    const updatedChecklist = { ...editingChecklist, items: updatedItems };
                    setEditingChecklist(updatedChecklist); // Optimistic UI update
                    await dbService.updateChecklist(updatedChecklist);
                    await load(); // Reload all to keep state in sync
                    setZeModal(prevConfirm => ({ ...prevConfirm, isOpen: false }));
                } catch (error: any) {
                    console.error("Erro ao remover item do checklist:", error);
                    setZeModal(prevConfirm => ({
                        ...prevConfirm,
                        isOpen: true,
                        title: 'Erro!',
                        message: `Não foi possível remover o item: ${error.message}`,
                        confirmText: 'Entendido',
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: 'ERROR'
                    }));
                } finally {
                    setZeModal(prevConfirm => ({ ...prevConfirm, isConfirming: false }));
                }
            },
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
        }));
    };

    // NEW: Handle editing checklist (opening modal)
    const handleEditChecklist = (checklist: Checklist) => {
        setEditingChecklist(checklist);
        setIsChecklistModalOpen(true);
    };

    const groupedExpenses = useMemo<GroupedExpenses>(() => {
      const groups: GroupedExpenses = {};

      Object.values(ExpenseCategory).forEach((cat: ExpenseCategory) => { // Explicitly type cat
        groups[cat] = { totalCategoryAmount: 0, steps: {}, unlinkedExpenses: [] };
      });

      expenses.forEach(exp => {
        const category = exp.category as ExpenseCategory; // Type assertion here
        if (!groups[category]) { // Defensive check
            groups[category] = { totalCategoryAmount: 0, steps: {}, unlinkedExpenses: [] };
        }
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

      // FIX: Simplified type assertion for Object.values to avoid potential compiler confusion
      // and explicitly typed the 'group' and 'stepGroup' parameters in forEach callbacks.
      (Object.values(groups) as any[]).forEach((group: { unlinkedExpenses: Expense[], steps: { [key: string]: ExpenseStepGroup } }) => {
        group.unlinkedExpenses.sort((a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime());
        (Object.values(group.steps) as any[]).forEach((stepGroup: ExpenseStepGroup) => {
          stepGroup.expenses.sort((a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
      });
      
      return groups;
    }, [expenses, steps]);


    const todayString = new Date().toISOString().split('T')[0];

    // Refatorado para usar useMemo e garantir segurança contra `work` ser null
    const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
    
    const budgetUsage = useMemo(() => 
        work && work.budgetPlanned > 0 ? (totalSpent / work.