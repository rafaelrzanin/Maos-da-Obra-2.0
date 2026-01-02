

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
                    setZeModal({ 
                        isOpen: true, 
                        title: 'Sucesso!', 
                        message: 'Etapa excluída com sucesso.', 
                        confirmText: 'Ok', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: 'SUCCESS',
                        isConfirming: false 
                    });
                }                       catch (error: any) {
                    console.error("Erro ao deletar etapa:", error);
                    setZeModal({
                        isOpen: true,
                        title: 'Erro ao Excluir Etapa',
                        message: error.message || 'Não foi possível excluir a etapa. Verifique se há lançamentos financeiros associados a ela ou aos seus materiais.',
                        confirmText: 'Entendido',
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: 'ERROR',
                        isConfirming: false 
                    });
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
                    setZeModal({ 
                        isOpen: true, 
                        title: 'Sucesso!', 
                        message: 'Gasto excluído com sucesso.', 
                        confirmText: 'Ok', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'SUCCESS',
                        isConfirming: false 
                    }); 
                } catch (error: any) {
                    console.error("Erro ao deletar gasto:", error);
                    setZeModal({ 
                        isOpen: true, 
                        title: 'Erro!', 
                        message: `Não foi possível remover: ${error.message}`, 
                        confirmText: 'Entendido', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'ERROR',
                        isConfirming: false
                    }); 
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
            setZeModal({
                isOpen: true, 
                title: 'Sucesso!',
                message: `${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'} salvo com sucesso.`,
                confirmText: 'Ok',
                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                type: 'SUCCESS',
                isConfirming: false 
            });
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

            setZeModal({
                isOpen: true, 
                title: 'Erro ao Salvar!',
                message: userMessage,
                confirmText: 'Entendido',
                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                type: 'ERROR',
                isConfirming: false 
            });
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
                    
                    setZeModal({ 
                        isOpen: true, 
                        title: 'Sucesso!', 
                        message: `${mode === 'WORKER' ? 'Profissional' : 'Fornecedor'} removido com sucesso.`, 
                        confirmText: 'Ok', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'SUCCESS',
                        isConfirming: false 
                    });
                    console.log(`[handleDeletePerson] ${mode} deleted, success ZeModal shown. Reloading data...`);
                    await load(); 
                    console.log(`[handleDeletePerson] Data reloaded.`);

                }                   catch (error: any) {
                    console.error(`Erro ao deletar ${mode === 'WORKER' ? 'profissional' : 'fornecedor'}:`, error);
                    setZeModal({ 
                        isOpen: true, 
                        title: 'Erro!', 
                        message: `Não foi possível remover: ${error.message}`, 
                        confirmText: 'Entendido', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'ERROR',
                        isConfirming: false 
                    });
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
        setZeModal({
            isOpen: true,
            title: 'Exportação em PDF',
            message: 'A funcionalidade de exportação para PDF está em desenvolvimento e estará disponível em breve com layouts profissionais!',
            confirmText: 'Entendido',
            type: 'INFO',
            onCancel: () => setZeModal(prev => ({...prev, isOpen: false})),
            isConfirming: false
        });
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
        setZeModal({
            isOpen: true,
            title: 'Remover Item?',
            message: 'Tem certeza que deseja remover este item da lista?',
            confirmText: 'Remover',
            type: 'DANGER',
            onConfirm: async () => {
                setZeModal(prev => ({ ...prev, isConfirming: true }));
                try {
                    const updatedItems = editingChecklist.items.filter(item => item.id !== itemId);
                    const updatedChecklist = { ...editingChecklist, items: updatedItems };
                    setEditingChecklist(updatedChecklist); // Optimistic UI update
                    await dbService.updateChecklist(updatedChecklist);
                    await load(); // Reload all to keep state in sync
                    setZeModal(prev => ({ ...prev, isOpen: false }));
                } catch (error: any) {
                    console.error("Erro ao remover item do checklist:", error);
                    setZeModal({
                        isOpen: true,
                        title: 'Erro!',
                        message: `Não foi possível remover o item: ${error.message}`,
                        confirmText: 'Entendido',
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: 'ERROR'
                    });
                } finally {
                    setZeModal(prev => ({ ...prev, isConfirming: false }));
                }
            },
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
        });
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
        work && work.budgetPlanned > 0 ? (totalSpent / work.budgetPlanned) * 100 : 0, 
        [work, totalSpent]
    );
    
    const budgetRemaining = useMemo(() => 
        work && work.budgetPlanned > 0 ? Math.max(0, work.budgetPlanned - totalSpent) : 0, 
        [work, totalSpent]
    );

    const { budgetStatusColor, budgetStatusAccent, budgetStatusIcon } = useMemo(() => {
        let color = 'bg-green-500';
        let accent = 'border-green-500 ring-1 ring-green-200';
        let icon = 'fa-check-circle';

        if (work && work.budgetPlanned > 0) {
            if (budgetUsage > 100) {
                color = 'bg-red-500';
                accent = 'border-red-500 ring-1 ring-red-200';
                icon = 'fa-triangle-exclamation';
            } else if (budgetUsage > 80) {
                color = 'bg-orange-500';
                accent = 'border-orange-500 ring-1 ring-orange-200';
                icon = 'fa-exclamation-circle';
            }
        }
        return { budgetStatusColor: color, budgetStatusAccent: accent, budgetStatusIcon: icon };
    }, [work, budgetUsage]);


    const hasLifetimeAccess = user?.plan === PlanType.VITALICIO;
    // const hasAiAccess = hasLifetimeAccess || (user?.isTrial && (trialDaysRemaining !== null && trialDaysRemaining > 0)); // This logic moved to AiChat itself for conditional rendering


    // Helper para renderizar a lista de materiais na aba principal
    const renderMainMaterialList = () => {
        const hasUnlinkedMaterials = materials.some(m => !m.stepId);
        
        // Filtra as etapas que devem ser exibidas
        const filteredSteps = steps.filter(step => 
            mainMaterialFilterStepId === 'ALL' || 
            step.id === mainMaterialFilterStepId
        );

        const renderedContent: JSX.Element[] = [];

        // Condição de "nenhum material encontrado" mais abrangente
        if (
            (filteredSteps.length === 0 && !hasUnlinkedMaterials && mainMaterialFilterStepId === 'ALL') || 
            (mainMaterialFilterStepId === 'UNLINKED' && !hasUnlinkedMaterials) || 
            (mainMaterialFilterStepId !== 'ALL' && mainMaterialFilterStepId !== 'UNLINKED' && 
             !materials.some(m => m.stepId === mainMaterialFilterStepId)) 
        ) {
            return (
                <p className="text-center text-slate-400 py-8 italic text-sm mx-2 sm:mx-0">
                    Nenhum material encontrado para o filtro selecionado.
                </p>
            );
        }

        // Renderiza materiais vinculados a etapas específicas
        filteredSteps.forEach((step, index) => {
            const stepMats = materials.filter(m => m.stepId === step.id);
            // Se o filtro for por etapa específica e não houver materiais para ela, não renderiza o bloco da etapa
            if (stepMats.length === 0 && mainMaterialFilterStepId !== 'ALL') return; 

            const isStepDelayed = step.status !== StepStatus.COMPLETED && new Date(step.endDate) < new Date(todayString);
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

            renderedContent.push(
                <div key={step.id} className="mb-6 first:mt-0 mt-8 mx-2 sm:mx-0">
                    <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-card-dark-subtle ${stepStatusBgClass} ${stepStatusTextColorClass}`}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-xl text-primary dark:text-white flex items-center gap-2 pl-0">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${stepStatusBgClass.replace('/10', '/20').replace('bg-', 'bg-').replace('dark:bg-green-900/20', 'dark:bg-green-800').replace('dark:text-green-300', 'dark:text-white')}`}>
                                    <i className={`fa-solid ${stepStatusIcon} ${stepStatusTextColorClass}`}></i>
                                </span>
                                <span className="text-primary dark:text-white">{index + 1}. {step.name}</span>
                            </h3>
                            <span className={`text-sm font-semibold ${stepStatusTextColorClass}`}>
                                {isStepDelayed ? 'Atrasada' : (step.status === StepStatus.COMPLETED ? 'Concluída' : (step.status === StepStatus.IN_PROGRESS ? 'Em Andamento' : 'Pendente'))}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-9">{parseDateNoTimezone(step.startDate)} - {parseDateNoTimezone(step.endDate)}</p>
                    </div>

                    <div className="space-y-3 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
                        {stepMats.length === 0 ? (
                            <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum material associado a esta etapa.</p>
                        ) : (
                            stepMats.map(m => (
                                <div key={m.id} onClick={() => { setMaterialModal({isOpen: true, material: m}); setMatName(m.name); setMatBrand(m.brand||''); setMatPlannedQty(String(m.plannedQty)); setMatUnit(m.unit); }} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-card-dark-subtle cursor-pointer hover:shadow-sm transition-shadow">
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
        });

        // Renderiza materiais sem etapa específica quando "ALL" ou "UNLINKED" é selecionado
        if ((mainMaterialFilterStepId === 'ALL' || mainMaterialFilterStepId === 'UNLINKED') && hasUnlinkedMaterials) {
            renderedContent.push(
                <div key="unlinked-materials" className="mb-6 first:mt-0 mt-8 mx-2 sm:mx-0">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-card-dark-subtle bg-slate-300/10 text-slate-500 dark:text-slate-400">
                        <h3 className="font-black text-xl text-primary dark:text-white flex items-center gap-2 pl-0">
                            <span className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-slate-300/20 text-slate-500 dark:text-slate-400">
                                <i className="fa-solid fa-tag"></i>
                            </span>
                            <span className="text-primary dark:text-white">Materiais Sem Etapa Associada</span>
                        </h3>
                    </div>
                    <div className="space-y-3 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
                        {materials.filter(m => !m.stepId).map(m => (
                            <div key={m.id} onClick={() => { setMaterialModal({isOpen: true, material: m}); setMatName(m.name); setMatBrand(m.brand||''); setMatPlannedQty(String(m.plannedQty)); setMatUnit(m.unit); }} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-card-dark-subtle cursor-pointer hover:shadow-sm transition-shadow">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="font-bold text-sm text-primary dark:text-white">{m.name}</p>
                                    <span className="text-xs font-black text-green-600 dark:text-green-400">{m.purchasedQty} {m.unit}</span>
                                </div>
                                <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-secondary" style={{ width: `${(m.purchasedQty/m.plannedQty)*100}%` }}></div>
                                </div>
                                <p className="text-[10px] text-right text-slate-500 dark:text-slate-400 mt-1">Planejado: {m.plannedQty} {m.unit}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return renderedContent;
    };

    if (authLoading || !isUserAuthFinished || loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return <div className="text-center py-10">Obra não encontrada.</div>;

    // Fix: Changed React.FC to a direct functional component with implicit return type
    // to avoid "Cannot find namespace 'JSX'" when tsconfig.json is not changed.
    const RenderCronogramaReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md dark:shadow-card-dark-subtle animate-in fade-in">
            <h3 className="font-bold text-xl text-primary dark:text-white mb-6">Cronograma Detalhado</h3>
            <div className="space-y-4">
                {steps.length === 0 ? (
                    <p className="text-center text-slate-400 py-4 italic text-sm">Nenhuma etapa cadastrada para esta obra.</p>
                ) : (
                    steps.map(s => {
                        const isDelayed = s.status !== StepStatus.COMPLETED && new Date(s.endDate) < new Date(todayString);
                        let statusColorClass = 'bg-slate-500'; // Default gray
                        let statusText = 'Pendente';
                        if (s.status === StepStatus.COMPLETED) { statusColorClass = 'bg-green-500'; statusText = 'Concluída'; }
                        else if (s.status === StepStatus.IN_PROGRESS) { statusColorClass = 'bg-orange-500'; statusText = 'Em Andamento'; }
                        else if (isDelayed) { statusColorClass = 'bg-red-500'; statusText = 'Atrasada'; }

                        return (
                            <div key={s.id} className="mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-4 shadow-sm">
                                <div className={`w-3 h-16 rounded-full ${statusColorClass} shrink-0`}></div>
                                <div className="flex-1">
                                    <p className="font-bold text-primary dark:text-white text-base mb-1">{s.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{parseDateNoTimezone(s.startDate)} - {parseDateNoTimezone(s.endDate)}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${statusColorClass}`}>{statusText}</span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    // Fix: Changed React.FC to a direct functional component with implicit return type
    // to avoid "Cannot find namespace 'JSX'" when tsconfig.json is not changed.
    const RenderMateriaisReport = () => {
        const filteredMaterials = reportMaterialFilterStepId === 'ALL'
            ? materials
            : materials.filter(m => m.stepId === reportMaterialFilterStepId);

        return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md dark:shadow-card-dark-subtle animate-in fade-in">
                <h3 className="font-bold text-xl text-primary dark:text-white mb-4">Materiais por Etapa</h3>
                
                <div className="mb-6">
                    <label htmlFor="report-material-step-filter" className="block text-sm font-medium text-primary dark:text-white mb-2">Filtrar por Etapa:</label>
                    <select
                        id="report-material-step-filter"
                        value={reportMaterialFilterStepId}
                        onChange={(e) => setReportMaterialFilterStepId(e.target.value)}
                        className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors"
                        aria-label="Filtrar materiais do relatório por etapa"
                    >
                        <option value="ALL">Todas as Etapas</option>
                        {steps.map(step => (
                            <option key={step.id} value={step.id}>{step.name}</option>
                        ))}
                    </select>
                </div>

                {filteredMaterials.length === 0 ? (
                    <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum material encontrado para o filtro selecionado.</p>
                ) : (
                    <div className="space-y-4">
                        {filteredMaterials.map(m => (
                            <div key={m.id} className="mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-4 shadow-sm">
                                <div className="flex-1">
                                    <p className="font-bold text-primary dark:text-white text-base mb-1">{m.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Planejado: {m.plannedQty} {m.unit} | Comprado: {m.purchasedQty} {m.unit}</p>
                                    {m.stepId && <p className="text-[10px] text-slate-400 mt-1">Etapa: {steps.find(s => s.id === m.stepId)?.name || 'N/A'}</p>}
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${m.purchasedQty < m.plannedQty ? 'bg-red-500' : 'bg-green-500'}`}>
                                    {m.purchasedQty < m.plannedQty ? 'Pendente' : 'Completo'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // FIX: Changed React.FC to a direct functional component with implicit return type
    // to avoid "Cannot find namespace 'JSX'" when tsconfig.json is not changed.
    const RenderFinanceiroReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md dark:shadow-card-dark-subtle animate-in fade-in">
            <h3 className="font-bold text-xl text-primary dark:text-white mb-6">Relatório Financeiro Detalhado</h3>
            
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Total Gasto:</p>
                    <p className="text-2xl font-black text-primary dark:text-white">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Orçamento Planejado:</p>
                    <p className="text-2xl font-black text-primary dark:text-white">{formatCurrency(work?.budgetPlanned)}</p>
                </div>
            </div>

            <div className="mb-8">
                <h4 className="font-bold text-lg text-primary dark:text-white mb-4">Gastos por Categoria:</h4>
                <div className="space-y-4">
                    {Object.entries(groupedExpenses).map(([category, data]) => (
                        <div key={category} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-bold text-primary dark:text-white text-base">{category}</p>
                                <p className="font-bold text-secondary text-base">{formatCurrency(data.totalCategoryAmount)}</p>
                            </div>
                            {/* Renderizar despesas não vinculadas primeiro */}
                            {data.unlinkedExpenses.length > 0 && (
                                <div className="mt-2 pl-4 border-l-2 border-slate-100 dark:border-slate-700">
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Sem Etapa Específica:</p>
                                    <ul className="space-y-1">
                                        {data.unlinkedExpenses.map(exp => (
                                            <li key={exp.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                                                <span>{exp.description}</span>
                                                <span>{formatCurrency(exp.amount)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {/* Renderizar despesas por etapa */}
                            {Object.values(data.steps).map(stepGroup => (
                                <div key={stepGroup.stepName} className="mt-4 pl-4 border-l-2 border-slate-100 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Etapa: {stepGroup.stepName}</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(stepGroup.totalStepAmount)}</p>
                                    </div>
                                    <ul className="space-y-1">
                                        {stepGroup.expenses.map(exp => (
                                            <li key={exp.id} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                                                <span>{exp.description}</span>
                                                <span>{formatCurrency(exp.amount)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
    // END OF FINANCEIRO REPORT

    return (
        <div className="max-w-4xl mx-auto pb-12 pt-6 px-2 sm:px-4 md:px-0 font-sans">
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => navigate('/')} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2" aria-label="Voltar para o Dashboard">
                    <i className="fa-solid fa-arrow-left text-xl"></i>
                </button>
                <h1 className="text-2xl font-black text-primary dark:text-white text-center flex-1">{work.name}</h1>
                <div className="w-8"></div> {/* Placeholder */}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Detalhes da Obra</p>
                        <h2 className="text-2xl font-black text-primary dark:text-white leading-tight">Progresso & Orçamento</h2>
                    </div>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-primary/10 text-primary dark:bg-slate-800 dark:text-white">
                        <i className="fa-solid fa-calendar"></i> {parseDateNoTimezone(work.startDate)}
                    </span>
                </div>
                
                {/* Visual Budget Overview */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full grid place-items-center text-xl text-white shrink-0 ${budgetStatusColor} ${budgetStatusAccent}`}>
                        <i className={`fa-solid ${budgetStatusIcon}`}></i>
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Status do Orçamento</p>
                        <p className="text-lg font-black text-primary dark:text-white leading-none mb-1">{formatCurrency(budgetRemaining)} restantes</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">de {formatCurrency(work.budgetPlanned)} planejado ({budgetUsage.toFixed(0)}% utilizado)</p>
                    </div>
                </div>

                {/* Main Tabs */}
                <nav className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-nowrap mb-6">
                    {(['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'] as MainTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSubView('NONE'); }}
                            className={`py-3 px-4 -mb-px border-b-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                                activeTab === tab
                                    ? 'border-secondary text-secondary'
                                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white'
                            }`}
                            aria-selected={activeTab === tab}
                            role="tab"
                        >
                            {tab}
                        </button>
                    ))}
                </nav>

                {/* Tab Content */}
                <div>
                    {activeTab === 'ETAPAS' && (
                        <div className="animate-in fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-primary dark:text-white">Cronograma</h3>
                                <button onClick={() => { setIsStepModalOpen(true); setStepModalMode('ADD'); setStepName(''); setStepStart(new Date().toISOString().split('T')[0]); setStepEnd(new Date().toISOString().split('T')[0]); }} className="px-4 py-2 bg-secondary text-white font-bold rounded-xl text-sm hover:bg-secondary-dark transition-colors" aria-label="Adicionar nova etapa">
                                    <i className="fa-solid fa-plus mr-2"></i> Nova Etapa
                                </button>
                            </div>
                            <div className="space-y-4">
                                {steps.length === 0 ? (
                                    <p className="text-center text-slate-400 py-4 italic text-sm">Nenhuma etapa cadastrada. Adicione uma nova etapa para começar!</p>
                                ) : (
                                    steps.map((step, index) => {
                                        const isDelayed = step.status !== StepStatus.COMPLETED && new Date(step.endDate) < new Date(todayString);
                                        const statusColor = step.status === StepStatus.COMPLETED ? 'bg-green-500' : (step.status === StepStatus.IN_PROGRESS ? 'bg-orange-500' : (isDelayed ? 'bg-red-500' : 'bg-slate-500'));
                                        const statusText = step.status === StepStatus.COMPLETED ? 'Concluída' : (step.status === StepStatus.IN_PROGRESS ? 'Em Andamento' : (isDelayed ? 'Atrasada' : 'Pendente'));
                                        const statusIcon = step.status === StepStatus.COMPLETED ? 'fa-check-circle' : (step.status === StepStatus.IN_PROGRESS ? 'fa-hammer' : (isDelayed ? 'fa-triangle-exclamation' : 'fa-clock'));

                                        return (
                                            <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4">
                                                <div className={`w-10 h-10 rounded-full ${statusColor} text-white flex items-center justify-center text-lg shrink-0`}>
                                                    <i className={`fa-solid ${statusIcon}`}></i>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <p className="font-bold text-primary dark:text-white text-base">{index + 1}. {step.name}</p>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${statusColor}`}>{statusText}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Início: {parseDateNoTimezone(step.startDate)} | Fim: {parseDateNoTimezone(step.endDate)}</p>
                                                    <div className="flex gap-2 mt-3">
                                                        <button onClick={() => handleStepStatusClick(step)} className="px-3 py-1 bg-primary/10 text-primary dark:bg-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-primary/20 dark:hover:bg-slate-600 transition-colors" aria-label={`Alterar status da etapa ${step.name}`}>
                                                            Status
                                                        </button>
                                                        <button onClick={() => { setIsStepModalOpen(true); setStepModalMode('EDIT'); setStepName(step.name); setStepStart(step.startDate); setStepEnd(step.endDate); setCurrentStepId(step.id); }} className="px-3 py-1 bg-primary/10 text-primary dark:bg-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-primary/20 dark:hover:bg-slate-600 transition-colors" aria-label={`Editar etapa ${step.name}`}>
                                                            Editar
                                                        </button>
                                                        <button onClick={() => handleDeleteStep(step.id)} className="px-3 py-1 bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-300 text-xs font-bold rounded-lg hover:bg-red-500/20 dark:hover:bg-red-800 transition-colors" aria-label={`Excluir etapa ${step.name}`}>
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'MATERIAIS' && (
                        <div className="animate-in fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-primary dark:text-white">Lista de Materiais</h3>
                                <button onClick={() => setAddMatModal(true)} className="px-4 py-2 bg-secondary text-white font-bold rounded-xl text-sm hover:bg-secondary-dark transition-colors" aria-label="Adicionar novo material">
                                    <i className="fa-solid fa-plus mr-2"></i> Novo Material
                                </button>
                            </div>
                            <div className="mb-6">
                                <label htmlFor="material-step-filter" className="block text-sm font-medium text-primary dark:text-white mb-2">Filtrar por Etapa:</label>
                                <select
                                    id="material-step-filter"
                                    value={mainMaterialFilterStepId}
                                    onChange={(e) => setMainMaterialFilterStepId(e.target.value)}
                                    className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors"
                                    aria-label="Filtrar materiais por etapa"
                                >
                                    <option value="ALL">Todos os Materiais</option>
                                    <option value="UNLINKED">Materiais Sem Etapa</option>
                                    {steps.map(step => (
                                        <option key={step.id} value={step.id}>{step.name}</option>
                                    ))}
                                </select>
                            </div>
                            {renderMainMaterialList()}
                        </div>
                    )}

                    {activeTab === 'FINANCEIRO' && (
                        <div className="animate-in fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-primary dark:text-white">Gastos e Receitas</h3>
                                <button onClick={openAddExpense} className="px-4 py-2 bg-secondary text-white font-bold rounded-xl text-sm hover:bg-secondary-dark transition-colors" aria-label="Adicionar nova despesa">
                                    <i className="fa-solid fa-plus mr-2"></i> Nova Despesa
                                </button>
                            </div>
                            <div className="space-y-4">
                                {expenses.length === 0 ? (
                                    <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum gasto registrado. Adicione o primeiro!</p>
                                ) : (
                                    expenses.map(expense => (
                                        <div key={expense.id} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-primary dark:text-white text-base">{expense.description}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {parseDateNoTimezone(expense.date)} | {expense.category}
                                                    {expense.stepId && ` | Etapa: ${steps.find(s => s.id === expense.stepId)?.name || 'N/A'}`}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <p className="font-bold text-red-500 dark:text-red-400 text-lg leading-none">{formatCurrency(expense.amount)}</p>
                                                <div className="flex gap-2">
                                                    <button onClick={() => openEditExpense(expense)} className="px-3 py-1 bg-primary/10 text-primary dark:bg-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-primary/20 dark:hover:bg-slate-600 transition-colors" aria-label={`Editar despesa ${expense.description}`}>
                                                        Editar
                                                    </button>
                                                    <button onClick={() => handleDeleteExpense(expense.id)} className="px-3 py-1 bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-300 text-xs font-bold rounded-lg hover:bg-red-500/20 dark:hover:bg-red-800 transition-colors" aria-label={`Excluir despesa ${expense.description}`}>
                                                        Excluir
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'FERRAMENTAS' && (
                        <div className="animate-in fade-in">
                            {subView === 'NONE' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button onClick={() => setSubView('WORKERS')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow" aria-label="Gerenciar Profissionais">
                                        <div className="w-16 h-16 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-3xl"><i className="fa-solid fa-hard-hat"></i></div>
                                        <p className="font-bold text-lg text-primary dark:text-white">Profissionais</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Cadastre sua equipe da obra.</p>
                                    </button>
                                    <button onClick={() => setSubView('SUPPLIERS')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow" aria-label="Gerenciar Fornecedores">
                                        <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-3xl"><i className="fa-solid fa-truck"></i></div>
                                        <p className="font-bold text-lg text-primary dark:text-white">Fornecedores</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Controle seus parceiros de materiais.</p>
                                    </button>
                                    <button onClick={() => setSubView('REPORTS')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow" aria-label="Gerar Relatórios">
                                        <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-3xl"><i className="fa-solid fa-chart-line"></i></div>
                                        <p className="font-bold text-lg text-primary dark:text-white">Relatórios</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Acompanhe o desempenho da obra.</p>
                                    </button>
                                    <button onClick={() => setSubView('PHOTOS')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow" aria-label="Gerenciar Fotos da Obra">
                                        <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center text-3xl"><i className="fa-solid fa-camera"></i></div>
                                        <p className="font-bold text-lg text-primary dark:text-white">Fotos da Obra</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Registre o antes e depois com fotos.</p>
                                    </button>
                                    <button onClick={() => setSubView('PROJECTS')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow" aria-label="Gerenciar Projetos e Documentos">
                                        <div className="w-16 h-16 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center text-3xl"><i className="fa-solid fa-file-alt"></i></div>
                                        <p className="font-bold text-lg text-primary dark:text-white">Projetos & Docs</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Mantenha seus arquivos organizados.</p>
                                    </button>
                                    <button onClick={() => { if(hasLifetimeAccess) setSubView('CONTRACTS'); else setZeModal({ isOpen: true, title: 'Recurso Premium!', message: 'O Gerador de Contratos é uma funcionalidade exclusiva do Plano Vitalício. Libere acesso ilimitado a todas as ferramentas!', confirmText: 'Entendido', onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'WARNING' }); }} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow group" aria-label="Gerador de Contratos">
                                        <div className={`w-16 h-16 rounded-full ${hasLifetimeAccess ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-300/10 text-slate-400'} flex items-center justify-center text-3xl`}>
                                            <i className="fa-solid fa-file-contract"></i>
                                            {!hasLifetimeAccess && <span className="absolute top-1 right-1 bg-amber-500 text-white text-xs px-2 py-1 rounded-full animate-bounce">PRO</span>}
                                        </div>
                                        <p className={`font-bold text-lg ${hasLifetimeAccess ? 'text-primary dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Contratos</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Gere contratos e recibos para sua equipe.</p>
                                    </button>
                                    <button onClick={() => { if(hasLifetimeAccess) setSubView('CHECKLIST'); else setZeModal({ isOpen: true, title: 'Recurso Premium!', message: 'Os Checklists Inteligentes são uma funcionalidade exclusiva do Plano Vitalício. Libere acesso ilimitado a todas as ferramentas!', confirmText: 'Entendido', onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'WARNING' }); }} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow group" aria-label="Checklists Inteligentes">
                                        <div className={`w-16 h-16 rounded-full ${hasLifetimeAccess ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-300/10 text-slate-400'} flex items-center justify-center text-3xl`}>
                                            <i className="fa-solid fa-list-check"></i>
                                            {!hasLifetimeAccess && <span className="absolute top-1 right-1 bg-amber-500 text-white text-xs px-2 py-1 rounded-full animate-bounce">PRO</span>}
                                        </div>
                                        <p className={`font-bold text-lg ${hasLifetimeAccess ? 'text-primary dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Checklists</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Listas de verificação para cada etapa da obra.</p>
                                    </button>
                                    <button onClick={() => { if(hasLifetimeAccess) setSubView('CALCULATORS'); else setZeModal({ isOpen: true, title: 'Recurso Premium!', message: 'As Calculadoras Inteligentes são uma funcionalidade exclusiva do Plano Vitalício. Libere acesso ilimitado a todas as ferramentas!', confirmText: 'Entendido', onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), type: 'WARNING' }); }} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow group" aria-label="Calculadoras Inteligentes">
                                        <div className={`w-16 h-16 rounded-full ${hasLifetimeAccess ? 'bg-cyan-500/10 text-cyan-600' : 'bg-slate-300/10 text-slate-400'} flex items-center justify-center text-3xl`}>
                                            <i className="fa-solid fa-calculator"></i>
                                            {!hasLifetimeAccess && <span className="absolute top-1 right-1 bg-amber-500 text-white text-xs px-2 py-1 rounded-full animate-bounce">PRO</span>}
                                        </div>
                                        <p className={`font-bold text-lg ${hasLifetimeAccess ? 'text-primary dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Calculadoras</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Calcule materiais de forma rápida e precisa.</p>
                                    </button>
                                    <button onClick={() => setSubView('AICHAT')} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:shadow-md transition-shadow group" aria-label="Acessar Zé da Obra AI">
                                        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center text-3xl"><i className="fa-solid fa-robot"></i></div>
                                        <p className="font-bold text-lg text-primary dark:text-white">Zé da Obra AI</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Seu engenheiro virtual particular.</p>
                                    </button>
                                </div>
                            )}

                            {subView !== 'NONE' && (
                                <button onClick={() => setSubView('NONE')} className="mb-6 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Voltar para ferramentas">
                                    <i className="fa-solid fa-arrow-left mr-2"></i> Voltar
                                </button>
                            )}

                            {subView === 'WORKERS' && (
                                <div className="animate-in fade-in">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-bold text-primary dark:text-white">Profissionais</h3>
                                        <button onClick={() => openPersonModal('WORKER')} className="px-4 py-2 bg-secondary text-white font-bold rounded-xl text-sm hover:bg-secondary-dark transition-colors" aria-label="Adicionar novo profissional">
                                            <i className="fa-solid fa-plus mr-2"></i> Novo Profissional
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {workers.length === 0 ? (
                                            <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum profissional cadastrado.</p>
                                        ) : (
                                            workers.map(worker => (
                                                <div key={worker.id} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-primary dark:text-white text-base">{worker.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{worker.role} | {worker.phone}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleGenerateWhatsappLink(worker.phone)} className="px-3 py-1 bg-green-500/10 text-green-600 dark:bg-green-900/20 dark:text-green-300 text-xs font-bold rounded-lg hover:bg-green-500/20 dark:hover:bg-green-800 transition-colors" aria-label={`Enviar mensagem para ${worker.name} no WhatsApp`}>
                                                            <i className="fa-brands fa-whatsapp"></i>
                                                        </button>
                                                        <button onClick={() => openPersonModal('WORKER', worker)} className="px-3 py-1 bg-primary/10 text-primary dark:bg-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-primary/20 dark:hover:bg-slate-600 transition-colors" aria-label={`Editar profissional ${worker.name}`}>
                                                            Editar
                                                        </button>
                                                        <button onClick={() => handleDeletePerson(worker.id, work.id, 'WORKER')} className="px-3 py-1 bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-300 text-xs font-bold rounded-lg hover:bg-red-500/20 dark:hover:bg-red-800 transition-colors" aria-label={`Excluir profissional ${worker.name}`}>
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {subView === 'SUPPLIERS' && (
                                <div className="animate-in fade-in">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-bold text-primary dark:text-white">Fornecedores</h3>
                                        <button onClick={() => openPersonModal('SUPPLIER')} className="px-4 py-2 bg-secondary text-white font-bold rounded-xl text-sm hover:bg-secondary-dark transition-colors" aria-label="Adicionar novo fornecedor">
                                            <i className="fa-solid fa-plus mr-2"></i> Novo Fornecedor
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {suppliers.length === 0 ? (
                                            <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum fornecedor cadastrado.</p>
                                        ) : (
                                            suppliers.map(supplier => (
                                                <div key={supplier.id} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-primary dark:text-white text-base">{supplier.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{supplier.category} | {supplier.phone}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleGenerateWhatsappLink(supplier.phone)} className="px-3 py-1 bg-green-500/10 text-green-600 dark:bg-green-900/20 dark:text-green-300 text-xs font-bold rounded-lg hover:bg-green-500/20 dark:hover:bg-green-800 transition-colors" aria-label={`Enviar mensagem para ${supplier.name} no WhatsApp`}>
                                                            <i className="fa-brands fa-whatsapp"></i>
                                                        </button>
                                                        <button onClick={() => openPersonModal('SUPPLIER', supplier)} className="px-3 py-1 bg-primary/10 text-primary dark:bg-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-primary/20 dark:hover:bg-slate-600 transition-colors" aria-label={`Editar fornecedor ${supplier.name}`}>
                                                            Editar
                                                        </button>
                                                        <button onClick={() => handleDeletePerson(supplier.id, work.id, 'SUPPLIER')} className="px-3 py-1 bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-300 text-xs font-bold rounded-lg hover:bg-red-500/20 dark:hover:bg-red-800 transition-colors" aria-label={`Excluir fornecedor ${supplier.name}`}>
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {subView === 'REPORTS' && (
                                <div className="animate-in fade-in">
                                    <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Gerar Relatórios</h3>
                                    <div className="flex space-x-2 mb-6">
                                        {(['CRONOGRAMA', 'MATERIAIS', 'FINANCEIRO'] as ReportSubTab[]).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setReportActiveTab(tab)}
                                                className={`py-2 px-4 rounded-xl text-sm font-bold transition-colors ${
                                                    reportActiveTab === tab
                                                        ? 'bg-secondary text-white shadow-md'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                                aria-selected={reportActiveTab === tab}
                                                role="tab"
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-4 mb-6">
                                        <button onClick={handleExportExcel} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2" aria-label="Exportar para Excel">
                                            <i className="fa-solid fa-file-excel"></i> Exportar Excel
                                        </button>
                                        <button onClick={handleExportPdf} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2" aria-label="Exportar para PDF">
                                            <i className="fa-solid fa-file-pdf"></i> Exportar PDF
                                        </button>
                                    </div>
                                    
                                    {reportActiveTab === 'CRONOGRAMA' && <RenderCronogramaReport />}
                                    {reportActiveTab === 'MATERIAIS' && <RenderMateriaisReport />}
                                    {reportActiveTab === 'FINANCEIRO' && <RenderFinanceiroReport />}
                                </div>
                            )}

                            {subView === 'PHOTOS' && (
                                <div className="animate-in fade-in">
                                    <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Fotos da Obra</h3>
                                    <label htmlFor="upload-photo" className="w-full flex items-center justify-center py-4 bg-primary/10 text-primary dark:bg-slate-800 dark:text-white font-bold rounded-xl shadow-sm hover:bg-primary/20 dark:hover:bg-slate-700 transition-colors cursor-pointer mb-6" aria-label="Adicionar nova foto">
                                        {uploading ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-plus mr-2"></i>}
                                        {uploading ? 'Enviando...' : 'Adicionar Nova Foto'}
                                        <input id="upload-photo" type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'PHOTO')} className="hidden" disabled={uploading} />
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {photos.length === 0 ? (
                                            <p className="col-span-full text-center text-slate-400 py-4 italic text-sm">Nenhuma foto adicionada.</p>
                                        ) : (
                                            photos.map(photo => (
                                                <div key={photo.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                                    <img src={photo.url} alt={photo.description} className="w-full h-40 object-cover" />
                                                    <div className="p-3">
                                                        <p className="font-bold text-primary dark:text-white text-sm">{photo.description}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{parseDateNoTimezone(photo.date)}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {subView === 'PROJECTS' && (
                                <div className="animate-in fade-in">
                                    <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Projetos & Documentos</h3>
                                    <label htmlFor="upload-file" className="w-full flex items-center justify-center py-4 bg-primary/10 text-primary dark:bg-slate-800 dark:text-white font-bold rounded-xl shadow-sm hover:bg-primary/20 dark:hover:bg-slate-700 transition-colors cursor-pointer mb-6" aria-label="Adicionar novo arquivo">
                                        {uploading ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-plus mr-2"></i>}
                                        {uploading ? 'Enviando...' : 'Adicionar Novo Arquivo'}
                                        <input id="upload-file" type="file" onChange={(e) => handleFileUpload(e, 'FILE')} className="hidden" disabled={uploading} />
                                    </label>
                                    <div className="space-y-4">
                                        {files.length === 0 ? (
                                            <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum arquivo adicionado.</p>
                                        ) : (
                                            files.map(file => (
                                                <a href={file.url} target="_blank" rel="noopener noreferrer" key={file.id} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-lg shrink-0">
                                                        <i className="fa-solid fa-file-alt"></i>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-primary dark:text-white text-base">{file.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{file.category} | {parseDateNoTimezone(file.date)}</p>
                                                    </div>
                                                    <i className="fa-solid fa-download text-slate-400"></i>
                                                </a>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {subView === 'CONTRACTS' && (
                                <div className="animate-in fade-in">
                                    <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Gerador de Contratos</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Selecione um modelo para preencher e gerar seu contrato ou recibo.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {CONTRACT_TEMPLATES.map(contract => (
                                            <button key={contract.id} onClick={() => { setViewContract(contract); setIsContractModalOpen(true); }} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                                                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg shrink-0">
                                                    <i className="fa-solid fa-file-contract"></i>
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className="font-bold text-primary dark:text-white text-base">{contract.title}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{contract.category}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {subView === 'CHECKLIST' && (
                                <div className="animate-in fade-in">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-bold text-primary dark:text-white">Checklists da Obra</h3>
                                        <button onClick={() => handleAddChecklist('Geral')} className="px-4 py-2 bg-secondary text-white font-bold rounded-xl text-sm hover:bg-secondary-dark transition-colors" aria-label="Adicionar novo checklist">
                                            <i className="fa-solid fa-plus mr-2"></i> Novo Checklist
                                        </button>
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Crie e gerencie listas de verificação para as etapas da sua obra.</p>
                                    
                                    <div className="mb-6">
                                        <label htmlFor="checklist-category-filter" className="block text-sm font-medium text-primary dark:text-white mb-2">Filtrar por Etapa/Categoria:</label>
                                        <select
                                            id="checklist-category-filter"
                                            value={selectedChecklistCategory}
                                            onChange={(e) => setSelectedChecklistCategory(e.target.value)}
                                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors"
                                            aria-label="Filtrar checklists por categoria"
                                        >
                                            <option value="all">Todas as Categorias</option>
                                            <option value="Geral">Geral</option>
                                            <option value="Segurança">Segurança</option>
                                            <option value="Entrega">Entrega</option>
                                            {steps.map(step => (
                                                <option key={step.id} value={step.name}>{step.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-4">
                                        {(allChecklists.length === 0 || 
                                          (selectedChecklistCategory !== 'all' && 
                                           !allChecklists.some(cl => cl.workId === work.id && cl.category === selectedChecklistCategory))) ? (
                                            <p className="text-center text-slate-400 py-4 italic text-sm">Nenhum checklist encontrado para esta obra ou filtro.</p>
                                        ) : (
                                            allChecklists
                                                .filter(cl => cl.workId === work.id && (selectedChecklistCategory === 'all' || cl.category === selectedChecklistCategory))
                                                .map(checklist => (
                                                    <div key={checklist.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <h4 className="font-bold text-primary dark:text-white text-base flex items-center gap-2">
                                                                <i className="fa-solid fa-list-check text-secondary"></i> {checklist.name}
                                                            </h4>
                                                            <button onClick={() => handleEditChecklist(checklist)} className="px-3 py-1 bg-primary/10 text-primary dark:bg-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-primary/20 dark:hover:bg-slate-600 transition-colors" aria-label={`Editar checklist ${checklist.name}`}>
                                                                Editar
                                                            </button>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {checklist.items.map(item => (
                                                                <li key={item.id} className="flex items-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.checked}
                                                                        onChange={() => handleChecklistItemToggle(checklist.id, item.id)}
                                                                        className="h-4 w-4 text-secondary rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:ring-secondary mr-2"
                                                                        aria-label={`Marcar ${item.text}`}
                                                                    />
                                                                    <span className={`text-sm ${item.checked ? 'line-through text-slate-400 dark:text-slate-600' : 'text-primary dark:text-white'}`}>
                                                                        {item.text}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {subView === 'CALCULATORS' && (
                                <div className="animate-in fade-in">
                                    <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Calculadoras Rápidas</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Estime quantidades de materiais para pisos, paredes e pintura.</p>

                                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                                        <div className="flex space-x-2 mb-4">
                                            {(['PISO', 'PAREDE', 'PINTURA'] as ('PISO'|'PAREDE'|'PINTURA')[])
                                                .map(calc => (
                                                    <button
                                                        key={calc}
                                                        onClick={() => { setCalcType(calc); setCalcResult([]); }}
                                                        className={`py-2 px-4 rounded-xl text-sm font-bold transition-colors ${
                                                            calcType === calc
                                                                ? 'bg-secondary text-white shadow-md'
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                        }`}
                                                        aria-selected={calcType === calc}
                                                        role="tab"
                                                    >
                                                        {calc}
                                                    </button>
                                                ))}
                                        </div>
                                        <div>
                                            <label htmlFor="calc-area" className="block text-sm font-medium text-primary dark:text-white mb-2">Área (m²):</label>
                                            <input
                                                id="calc-area"
                                                type="number"
                                                value={calcArea}
                                                onChange={(e) => setCalcArea(e.target.value)}
                                                placeholder="Ex: 25.5"
                                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors"
                                                aria-label="Área em metros quadrados para cálculo"
                                            />
                                        </div>

                                        {calcResult.length > 0 && (
                                            <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <p className="text-sm font-bold text-primary dark:text-white mb-2">Resultado Estimado:</p>
                                                <ul className="space-y-1">
                                                    {calcResult.map((res, i) => (
                                                        <li key={i} className="text-sm text-slate-700 dark:text-slate-300">
                                                            <i className="fa-solid fa-check-circle mr-2 text-green-500"></i> {res}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {subView === 'AICHAT' && (
                                <div className="animate-in fade-in">
                                    <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Zé da Obra AI</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Converse com seu engenheiro virtual para tirar dúvidas e obter dicas inteligentes para sua obra.</p>
                                    <button onClick={() => navigate('/ai-chat')} className="w-full py-3 bg-secondary text-white font-bold rounded-xl shadow-lg hover:bg-secondary-dark transition-colors flex items-center justify-center gap-2" aria-label="Abrir chat com Zé da Obra AI">
                                        <i className="fa-solid fa-robot mr-2"></i> Abrir Chat com o Zé
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Step Modal */}
            <ZeModal
                isOpen={isStepModalOpen}
                title={stepModalMode === 'ADD' ? 'Adicionar Etapa' : 'Editar Etapa'}
                message="" // Message will be rendered by form inputs
                onCancel={() => setIsStepModalOpen(false)}
                confirmText={stepModalMode === 'ADD' ? 'Adicionar' : 'Salvar'}
                onConfirm={() => {}} // Handled by form onSubmit
                type="INFO"
            >
                <form onSubmit={handleSaveStep} className="space-y-4">
                    <div>
                        <label htmlFor="step-name" className="block text-sm font-medium text-primary dark:text-white mb-2">Nome da Etapa:</label>
                        <input id="step-name" type="text" value={stepName} onChange={(e) => setStepName(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Nome da etapa" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="step-start" className="block text-sm font-medium text-primary dark:text-white mb-2">Data Início:</label>
                            <input id="step-start" type="date" value={stepStart} onChange={(e) => setStepStart(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Data de início da etapa" />
                        </div>
                        <div>
                            <label htmlFor="step-end" className="block text-sm font-medium text-primary dark:text-white mb-2">Data Fim:</label>
                            <input id="step-end" type="date" value={stepEnd} onChange={(e) => setStepEnd(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Data de término da etapa" />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors" aria-label={stepModalMode === 'ADD' ? 'Adicionar etapa' : 'Salvar etapa'}>
                        {stepModalMode === 'ADD' ? 'Adicionar' : 'Salvar'}
                    </button>
                </form>
            </ZeModal>

            {/* Material Modal (Add/Edit) */}
            <ZeModal
                isOpen={addMatModal || materialModal.isOpen}
                title={addMatModal ? 'Adicionar Material' : 'Detalhes do Material'}
                message=""
                onCancel={() => { setAddMatModal(false); setMaterialModal({isOpen: false, material: null}); }}
                confirmText={addMatModal ? 'Adicionar' : 'Salvar'}
                onConfirm={() => {}} // Handled by form onSubmit
                type="INFO"
            >
                <form onSubmit={addMatModal ? handleAddMaterial : handleUpdateMaterial} className="space-y-4">
                    <div>
                        <label htmlFor="mat-name" className="block text-sm font-medium text-primary dark:text-white mb-2">Nome do Material:</label>
                        <input id="mat-name" type="text" value={addMatModal ? newMatName : matName} onChange={(e) => addMatModal ? setNewMatName(e.target.value) : setMatName(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Nome do material" />
                    </div>
                    <div>
                        <label htmlFor="mat-brand" className="block text-sm font-medium text-primary dark:text-white mb-2">Marca (Opcional):</label>
                        <input id="mat-brand" type="text" value={addMatModal ? newMatBrand : matBrand} onChange={(e) => addMatModal ? setNewMatBrand(e.target.value) : setMatBrand(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Marca do material (opcional)" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="mat-qty" className="block text-sm font-medium text-primary dark:text-white mb-2">Qtd. Planejada:</label>
                            <input id="mat-qty" type="number" value={addMatModal ? newMatQty : matPlannedQty} onChange={(e) => addMatModal ? setNewMatQty(e.target.value) : setMatPlannedQty(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Quantidade planejada" />
                        </div>
                        <div>
                            <label htmlFor="mat-unit" className="block text-sm font-medium text-primary dark:text-white mb-2">Unidade:</label>
                            <input id="mat-unit" type="text" value={addMatModal ? newMatUnit : matUnit} onChange={(e) => addMatModal ? setNewMatUnit(e.target.value) : setMatUnit(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Unidade de medida" />
                        </div>
                    </div>
                    {addMatModal && (
                        <div>
                            <label htmlFor="mat-step" className="block text-sm font-medium text-primary dark:text-white mb-2">Vincular à Etapa (Opcional):</label>
                            <select id="mat-step" value={newMatStepId} onChange={(e) => setNewMatStepId(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Vincular material à etapa (opcional)">
                                <option value="">Nenhuma Etapa</option>
                                {steps.map(step => (
                                    <option key={step.id} value={step.id}>{step.name}</option>
                                ))}
                            </select>
                            <div className="flex items-center mt-4">
                                <input id="buy-now-checkbox" type="checkbox" checked={newMatBuyNow} onChange={(e) => setNewMatBuyNow(e.target.checked)} className="h-4 w-4 text-secondary rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:ring-secondary mr-2" aria-label="Registrar compra agora" />
                                <label htmlFor="buy-now-checkbox" className="text-sm font-medium text-primary dark:text-white">Registrar compra agora?</label>
                            </div>
                            {newMatBuyNow && (
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label htmlFor="new-mat-buy-qty" className="block text-sm font-medium text-primary dark:text-white mb-2">Qtd. Comprada:</label>
                                        <input id="new-mat-buy-qty" type="number" value={newMatBuyQty} onChange={(e) => setNewMatBuyQty(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Quantidade comprada" />
                                    </div>
                                    <div>
                                        <label htmlFor="new-mat-buy-cost" className="block text-sm font-medium text-primary dark:text-white mb-2">Custo Total (R$):</label>
                                        <input id="new-mat-buy-cost" type="number" value={newMatBuyCost} onChange={(e) => setNewMatBuyCost(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Custo total da compra" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {!addMatModal && materialModal.material && (
                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="font-bold text-primary dark:text-white text-base mb-2">Registrar Nova Compra:</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="mat-buy-qty" className="block text-sm font-medium text-primary dark:text-white mb-2">Qtd. Comprada:</label>
                                    <input id="mat-buy-qty" type="number" value={matBuyQty} onChange={(e) => setMatBuyQty(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Quantidade comprada (adicionar)" />
                                </div>
                                <div>
                                    <label htmlFor="mat-buy-cost" className="block text-sm font-medium text-primary dark:text-white mb-2">Custo Total (R$):</label>
                                    <input id="mat-buy-cost" type="number" value={matBuyCost} onChange={(e) => setMatBuyCost(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Custo total da nova compra" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Atual: {materialModal.material.purchasedQty} {materialModal.material.unit} comprados de {materialModal.material.plannedQty} {materialModal.material.unit} planejados.</p>
                        </div>
                    )}
                    <button type="submit" className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors" aria-label={addMatModal ? 'Adicionar material' : 'Salvar material'}>
                        {addMatModal ? 'Adicionar Material' : 'Salvar Alterações'}
                    </button>
                    {!addMatModal && (
                        <button onClick={() => {}} className="w-full py-3 mt-2 bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-300 font-bold rounded-xl hover:bg-red-500/20 dark:hover:bg-red-800 transition-colors" aria-label="Excluir material">
                            Excluir Material
                        </button>
                    )}
                </form>
            </ZeModal>

            {/* Expense Modal (Add/Edit) */}
            <ZeModal
                isOpen={expenseModal.isOpen}
                title={expenseModal.mode === 'ADD' ? 'Adicionar Despesa' : `Editar Despesa (Total Pago: ${formatCurrency(expSavedAmount)})`}
                message=""
                onCancel={() => setExpenseModal(prev => ({ ...prev, isOpen: false }))}
                confirmText={expenseModal.mode === 'ADD' ? 'Adicionar' : 'Salvar'}
                onConfirm={() => {}} // Handled by form onSubmit
                type="INFO"
            >
                <form onSubmit={handleSaveExpense} className="space-y-4">
                    <div>
                        <label htmlFor="exp-desc" className="block text-sm font-medium text-primary dark:text-white mb-2">Descrição:</label>
                        <input id="exp-desc" type="text" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Descrição da despesa" />
                    </div>
                    {expenseModal.mode === 'ADD' && (
                        <div>
                            <label htmlFor="exp-amount" className="block text-sm font-medium text-primary dark:text-white mb-2">Valor (R$):</label>
                            <input id="exp-amount" type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Valor da despesa" />
                        </div>
                    )}
                    {expenseModal.mode === 'EDIT' && (
                        <div>
                            <label htmlFor="exp-amount-add" className="block text-sm font-medium text-primary dark:text-white mb-2">Adicionar Novo Pagamento (R$):</label>
                            <input id="exp-amount-add" type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Adicionar novo pagamento" />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total já pago: {formatCurrency(expSavedAmount)}</p>
                        </div>
                    )}
                    <div>
                        <label htmlFor="exp-total-agreed" className="block text-sm font-medium text-primary dark:text-white mb-2">Valor Total Acordado (Opcional - R$):</label>
                        <input id="exp-total-agreed" type="number" value={expTotalAgreed} onChange={(e) => setExpTotalAgreed(e.target.value)} placeholder="0.00" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Valor total acordado (opcional)" />
                    </div>
                    <div>
                        <label htmlFor="exp-category" className="block text-sm font-medium text-primary dark:text-white mb-2">Categoria:</label>
                        <select id="exp-category" value={expCategory} onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Categoria da despesa">
                            {Object.values(ExpenseCategory).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="exp-step" className="block text-sm font-medium text-primary dark:text-white mb-2">Vincular à Etapa (Opcional):</label>
                        <select id="exp-step" value={expStepId} onChange={(e) => setExpStepId(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Vincular despesa à etapa (opcional)">
                            <option value="">Nenhuma Etapa</option>
                            {steps.map(step => (
                                <option key={step.id} value={step.id}>{step.name}</option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors" aria-label={expenseModal.mode === 'ADD' ? 'Adicionar despesa' : 'Salvar despesa'}>
                        {expenseModal.mode === 'ADD' ? 'Adicionar Despesa' : 'Salvar Pagamento'}
                    </button>
                    {expenseModal.mode === 'EDIT' && (
                        <button onClick={() => handleDeleteExpense(expenseModal.id!)} className="w-full py-3 mt-2 bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-300 font-bold rounded-xl hover:bg-red-500/20 dark:hover:bg-red-800 transition-colors" aria-label="Excluir despesa">
                            Excluir Despesa
                        </button>
                    )}
                </form>
            </ZeModal>

            {/* Person Modal (Worker/Supplier) */}
            <ZeModal
                isOpen={isPersonModalOpen}
                title={personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}
                message=""
                onCancel={() => setIsPersonModalOpen(false)}
                confirmText="Salvar"
                onConfirm={() => {}} // Handled by form onSubmit
                isConfirming={isPersonSaving} // Pass loading state to modal
                type="INFO"
            >
                <form onSubmit={handleSavePerson} className="space-y-4">
                    <div>
                        <label htmlFor="person-name" className="block text-sm font-medium text-primary dark:text-white mb-2">Nome:</label>
                        <input id="person-name" type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Nome da pessoa" />
                    </div>
                    <div>
                        <label htmlFor="person-role" className="block text-sm font-medium text-primary dark:text-white mb-2">{personMode === 'WORKER' ? 'Função:' : 'Categoria:'}</label>
                        <select id="person-role" value={personRole} onChange={(e) => setPersonRole(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label={personMode === 'WORKER' ? 'Função do profissional' : 'Categoria do fornecedor'}>
                            {personMode === 'WORKER' ? (
                                STANDARD_JOB_ROLES.map(role => <option key={role} value={role}>{role}</option>)
                            ) : (
                                STANDARD_SUPPLIER_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)
                            )}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="person-phone" className="block text-sm font-medium text-primary dark:text-white mb-2">Telefone:</label>
                        <input id="person-phone" type="text" value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" required aria-label="Telefone da pessoa" />
                    </div>
                    {personMode === 'WORKER' && (
                        <div>
                            <label htmlFor="worker-daily-rate" className="block text-sm font-medium text-primary dark:text-white mb-2">Diária (R$):</label>
                            <input id="worker-daily-rate" type="number" value={workerDailyRate} onChange={(e) => setWorkerDailyRate(e.target.value)} placeholder="0.00" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Valor da diária do profissional" />
                        </div>
                    )}
                    {personMode === 'SUPPLIER' && (
                        <>
                            <div>
                                <label htmlFor="supplier-email" className="block text-sm font-medium text-primary dark:text-white mb-2">E-mail (Opcional):</label>
                                <input id="supplier-email" type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="E-mail do fornecedor (opcional)" />
                            </div>
                            <div>
                                <label htmlFor="supplier-address" className="block text-sm font-medium text-primary dark:text-white mb-2">Endereço (Opcional):</label>
                                <input id="supplier-address" type="text" value={personAddress} onChange={(e) => setPersonAddress(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Endereço do fornecedor (opcional)" />
                            </div>
                        </>
                    )}
                    <div>
                        <label htmlFor="person-notes" className="block text-sm font-medium text-primary dark:text-white mb-2">Notas (Opcional):</label>
                        <textarea id="person-notes" value={personNotes} onChange={(e) => setPersonNotes(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white min-h-[80px]" aria-label="Notas sobre a pessoa (opcional)"></textarea>
                    </div>
                    <button type="submit" className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center justify-center gap-2" disabled={isPersonSaving} aria-label="Salvar">
                        {isPersonSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>} Salvar
                    </button>
                </form>
            </ZeModal>

            {/* Contract View Modal */}
            <ZeModal
                isOpen={isContractModalOpen}
                title={viewContract?.title || 'Contrato'}
                message="" // Content will be rendered by the textarea
                onCancel={() => { setIsContractModalOpen(false); setViewContract(null); }}
                confirmText="Fechar"
                onConfirm={() => { setIsContractModalOpen(false); setViewContract(null); }}
                type="INFO"
            >
                {viewContract && (
                    <div className="relative">
                        <textarea
                            readOnly
                            value={viewContract.contentTemplate}
                            className="w-full h-96 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white font-mono text-xs resize-none leading-relaxed"
                            aria-label="Conteúdo do contrato"
                        ></textarea>
                        <button
                            onClick={() => navigator.clipboard.writeText(viewContract.contentTemplate)}
                            className="absolute top-2 right-2 p-2 bg-primary/10 text-primary dark:bg-slate-700 dark:text-white rounded-lg text-sm hover:bg-primary/20 dark:hover:bg-slate-600 transition-colors"
                            aria-label="Copiar contrato para a área de transferência"
                        >
                            <i className="fa-solid fa-copy"></i>
                        </button>
                    </div>
                )}
            </ZeModal>

            {/* Global ZeModal for confirmations/errors */}
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

            {/* Checklist Edit Modal */}
            <ZeModal
                isOpen={isChecklistModalOpen}
                title={editingChecklist ? `Editar Checklist: ${editingChecklist.name}` : 'Detalhes do Checklist'}
                message=""
                onCancel={() => { setIsChecklistModalOpen(false); setEditingChecklist(null); setNewChecklistItemText(''); }}
                confirmText="Fechar"
                onConfirm={() => { setIsChecklistModalOpen(false); setEditingChecklist(null); setNewChecklistItemText(''); }}
                type="INFO"
            >
                {editingChecklist && (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="checklist-name-edit" className="block text-sm font-medium text-primary dark:text-white mb-2">Nome do Checklist:</label>
                            <input id="checklist-name-edit" type="text" value={editingChecklist.name} onChange={(e) => handleUpdateChecklistName(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white" aria-label="Nome do checklist" />
                        </div>
                        <h4 className="font-bold text-primary dark:text-white text-base">Itens:</h4>
                        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {editingChecklist.items.length === 0 ? (
                                <p className="text-center text-slate-400 py-2 italic text-sm">Nenhum item neste checklist.</p>
                            ) : (
                                editingChecklist.items.map(item => (
                                    <li key={item.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                                        <label className="flex items-center flex-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={() => handleChecklistItemToggle(editingChecklist.id, item.id)}
                                                className="h-4 w-4 text-secondary rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:ring-secondary mr-2"
                                                aria-label={`Marcar ${item.text}`}
                                            />
                                            <span className={`text-sm ${item.checked ? 'line-through text-slate-400 dark:text-slate-600' : 'text-primary dark:text-white'}`}>
                                                {item.text}
                                            </span>
                                        </label>
                                        <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full" aria-label={`Remover item ${item.text}`}>
                                            <i className="fa-solid fa-trash-alt"></i>
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                        <div className="flex gap-2 mt-4">
                            <input
                                type="text"
                                value={newChecklistItemText}
                                onChange={(e) => setNewChecklistItemText(e.target.value)}
                                placeholder="Novo item do checklist"
                                className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-primary dark:text-white"
                                aria-label="Adicionar novo item ao checklist"
                            />
                            <button onClick={handleAddChecklistItem} className="px-4 py-2 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors" aria-label="Adicionar item">
                                <i className="fa-solid fa-plus"></i>
                            </button>
                        </div>
                    </div>
                )}
            </ZeModal>

        </div>
    );
};

export default WorkDetail;