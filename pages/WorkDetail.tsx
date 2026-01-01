
import React, { useState, useEffect, useCallback, useMemo, type FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { ZeModal } from '../components/ZeModal.tsx';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
// NEW: Explicitly import FC type
// Fix: Combine `FC` type import with the main `React` import to ensure `React` namespace is correctly handled.

// --- TYPES FOR VIEW STATE ---
type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
type SubView = 'NONE' | 'WORKERS' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST' | 'AICHAT';
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
                    // FIX: Ensure success modal is explicitly opened with isOpen: true and not confirming
                    setZeModal({ 
                        isOpen: true, // MUST be true to show the modal
                        title: 'Sucesso!', 
                        message: 'Etapa excluída com sucesso.', 
                        confirmText: 'Ok', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: 'SUCCESS',
                        isConfirming: false // Not confirming anymore
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
                        isConfirming: false // Not confirming anymore
                    });
                } finally {
                    setZeModal(prev => ({ ...prev, isConfirming: false })); // Reset confirming state
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
                        isOpen: true, // MUST be true
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
                isOpen: true, // MUST be true
                title: 'Sucesso!',
                message: `${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'} salvo com sucesso.`,
                confirmText: 'Ok',
                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), // Keep previous logic to use prev state if needed for other properties
                type: 'SUCCESS',
                isConfirming: false // Ensure it's not confirming
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
                isOpen: true, // MUST be true
                title: 'Erro ao Salvar!',
                message: userMessage,
                confirmText: 'Entendido',
                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), // Keep previous logic
                type: 'ERROR',
                isConfirming: false // Ensure it's not confirming
            });
            console.log("[handleSavePerson] Error occurred, error ZeModal shown.");

        } finally {
            setIsPersonSaving(false); // End saving
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
                setZeModal(prev => ({ ...prev, isConfirming: true })); // Indicate action is confirming
                console.log(`[handleDeletePerson] Deleting ${mode} ${pid} from work ${wid}.`);
                try {
                    if (mode === 'WORKER') await dbService.deleteWorker(pid, wid); 
                    else await dbService.deleteSupplier(pid, wid); 
                    
                    // FIX: Ensure success modal is explicitly opened with isOpen: true and not confirming
                    setZeModal({ 
                        isOpen: true, // MUST be true
                        title: 'Sucesso!', 
                        message: `${mode === 'WORKER' ? 'Profissional' : 'Fornecedor'} removido com sucesso.`, 
                        confirmText: 'Ok', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'SUCCESS',
                        isConfirming: false // Not confirming anymore
                    });
                    console.log(`[handleDeletePerson] ${mode} deleted, success ZeModal shown. Reloading data...`);
                    await load(); // Reload after success message is shown
                    console.log(`[handleDeletePerson] Data reloaded.`);

                }                   catch (error: any) {
                    console.error(`Erro ao deletar ${mode === 'WORKER' ? 'profissional' : 'fornecedor'}:`, error);
                    setZeModal({ 
                        isOpen: true, // MUST be true
                        title: 'Erro!', 
                        message: `Não foi possível remover: ${error.message}`, 
                        confirmText: 'Entendido', 
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })), 
                        type: 'ERROR',
                        isConfirming: false // Not confirming anymore
                    });
                    console.log(`[handleDeletePerson] Error occurred, error ZeModal shown.`);

                } finally {
                    setZeModal(prev => ({ ...prev, isConfirming: false })); // Reset confirming state
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
            isConfirming: false // Ensure not confirming
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
        const updatedItems = editingChecklist.items.filter(item => item.id !== itemId);
        const updatedChecklist = { ...editingChecklist, items: updatedItems };
        setEditingChecklist(updatedChecklist); // Optimistic UI update
        await dbService.updateChecklist(updatedChecklist);
        await load(); // Reload all to keep state in sync
    };

    // NEW: Handle editing checklist (opening modal)
    const handleEditChecklist = (checklist: Checklist) => {
        setEditingChecklist(checklist);
        setIsChecklistModalOpen(true);
    };

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

      Object.values(groups).forEach(group => {
        group.unlinkedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        Object.values(group.steps).forEach(stepGroup => {
          stepGroup.expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
            (filteredSteps.length === 0 && !hasUnlinkedMaterials && mainMaterialFilterStepId === 'ALL') || // Não há etapas nem materiais sem etapa, e filtro é "TODOS"
            (mainMaterialFilterStepId === 'UNLINKED' && !hasUnlinkedMaterials) || // Filtro por sem etapa, mas não há materiais sem etapa
            (mainMaterialFilterStepId !== 'ALL' && mainMaterialFilterStepId !== 'UNLINKED' && 
             !materials.some(m => m.stepId === mainMaterialFilterStepId)) // Filtro por etapa específica, mas não há materiais para ela
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
    // FIM Helper para renderizar a lista de materiais

    if (authLoading || !isUserAuthFinished || loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return <div className="text-center py-10">Obra não encontrada.</div>;

    // Add explicit React.FC type to functional components
    const RenderCronogramaReport: React.FC = () => (
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

    // Add explicit React.FC type to functional components
    const RenderMateriaisReport: React.FC = () => {
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
                    <p className="text-center text-slate-400 py-8 italic text-sm">Nenhum material encontrado para o filtro selecionado.</p>
                ) : (
                    steps
                        .filter(step => reportMaterialFilterStepId === 'ALL' || step.id === reportMaterialFilterStepId)
                        .map(step => {
                            const stepMats = filteredMaterials.filter(m => m.stepId === step.id);
                            if (stepMats.length === 0) return null; // Only render step if it has filtered materials
                            return (
                                <div key={step.id} className="mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm last:mb-0">
                                    <h4 className="font-black uppercase text-secondary mb-3 border-b border-slate-200 dark:border-slate-700 pb-2 text-base">{step.name}</h4>
                                    <div className="space-y-3">
                                        {stepMats.map(m => {
                                            const statusText = m.purchasedQty >= m.plannedQty ? 'Concluído' : m.purchasedQty > 0 ? 'Parcial' : 'Pendente';
                                            const statusColor = m.purchasedQty >= m.plannedQty ? 'text-green-600' : m.purchasedQty > 0 ? 'text-orange-600' : 'text-red-500';
                                            const progress = (m.purchasedQty / m.plannedQty) * 100;
                                            return (
                                                <div key={m.id} className="flex flex-col text-sm bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-primary dark:text-white">{m.name} {m.brand && `(${m.brand})`}</span>
                                                        <span className={`font-semibold ${statusColor}`}>{statusText}</span>
                                                    </div>
                                                    <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
                                                        <div className="h-full bg-secondary" style={{ width: `${Math.min(100, progress)}%` }}></div>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 text-right">{m.purchasedQty}/{m.plannedQty} {m.unit}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                )}
            </div>
        );
    };


    // Add explicit React.FC type to functional components
    const RenderFinanceiroReport: React.FC = () => (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md dark:shadow-card-dark-subtle animate-in fade-in">
            <h3 className="font-bold text-xl text-primary dark:text-white mb-6">Lançamentos Financeiros</h3>
            {Object.values(ExpenseCategory).map(category => {
                const expensesInCategory = Object.values(groupedExpenses[category].steps).flatMap(stepGroup => stepGroup.expenses).concat(groupedExpenses[category].unlinkedExpenses);
                if (expensesInCategory.length === 0) return null;

                return (
                    <div key={category} className="mb-8 bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm last:mb-0">
                        <h4 className="font-black uppercase text-primary dark:text-white mb-4 border-b border-slate-200 dark:border-slate-700 pb-3 text-lg">
                            {category} <span className="text-secondary">({formatCurrency(groupedExpenses[category].totalCategoryAmount)})</span>
                        </h4>
                        <div className="space-y-4">
                            {Object.keys(groupedExpenses[category].steps).filter(stepId => groupedExpenses[category].steps[stepId].expenses.length > 0).map(stepId => {
                                const stepGroup = groupedExpenses[category].steps[stepId];
                                return (
                                    <div key={stepId} className="pl-4 border-l-4 border-secondary/20 dark:border-secondary/30">
                                        <h5 className="font-bold text-base text-primary dark:text-white mb-2">{stepGroup.stepName} <span className="text-slate-500 dark:text-slate-400 text-sm">({formatCurrency(stepGroup.totalStepAmount)})</span></h5>
                                        <div className="space-y-2">
                                            {stepGroup.expenses.map(e => (
                                                <div key={e.id} className="flex justify-between text-sm py-1 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-700">
                                                    <span className="text-slate-700 dark:text-slate-300">{e.description}</span>
                                                    <span className="font-bold text-primary dark:text-white">{formatCurrency(e.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {groupedExpenses[category].unlinkedExpenses.length > 0 && (
                                <div className="pl-4 border-l-4 border-slate-300 dark:border-slate-600 mt-6">
                                    <h5 className="font-bold text-base text-slate-500 dark:text-slate-400 mb-2">Sem Etapa Específica</h5>
                                    <div className="space-y-2">
                                        {groupedExpenses[category].unlinkedExpenses.map(e => (
                                            <div key={e.id} className="flex justify-between text-sm py-1 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-700">
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


    if (authLoading || !isUserAuthFinished || loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return <div className="text-center py-10">Obra não encontrada.</div>;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 md:px-0 pb-24">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => subView === 'NONE' ? navigate('/') : setSubView('NONE')} className="text-slate-400 hover:text-primary" aria-label="Voltar"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                <h1 className="text-2xl font-black text-primary dark:text-white">{work.name}</h1>
                <div className="w-10"></div>
            </div>

            {subView === 'NONE' ? (
                <>
                    <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t z-50 flex justify-around p-2 md:static md:bg-slate-100 md:rounded-2xl md:mb-6 shadow-lg md:shadow-none dark:shadow-card-dark-subtle">
                        {(['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'] as MainTab[]).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center flex-1 py-2 text-[10px] font-bold md:text-sm md:rounded-xl transition-colors ${activeTab === tab ? 'text-secondary md:bg-white md:shadow-sm' : 'text-slate-400 hover:text-primary dark:hover:text-white'}`} aria-label={`Abrir aba ${tab}`}>
                                <i className={`fa-solid ${tab === 'ETAPAS' ? 'fa-calendar' : tab === 'MATERIAIS' ? 'fa-box' : tab === 'FINANCEIRO' ? 'fa-dollar-sign' : 'fa-wrench'} text-lg mb-1`}></i> {/* Changed tools icon */}
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
                                        <div key={s.id} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border flex items-center gap-4 shadow-sm dark:shadow-card-dark-subtle ${isDelayed ? 'border-red-500 ring-1 ring-red-200' : 'border-slate-200 dark:border-slate-800'}`}>
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

                            {/* NOVO: Filtro para Materiais na aba principal */}
                            <div className="mb-6 mx-2 sm:mx-0">
                                <label htmlFor="main-material-step-filter" className="block text-sm font-medium text-primary dark:text-white mb-2">Filtrar por Etapa:</label>
                                <select
                                    id="main-material-step-filter"
                                    value={mainMaterialFilterStepId}
                                    onChange={(e) => setMainMaterialFilterStepId(e.target.value)}
                                    className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors"
                                    aria-label="Filtrar materiais por etapa"
                                >
                                    <option value="ALL">Todas as Etapas</option>
                                    {steps.map(step => (
                                        <option key={step.id} value={step.id}>{step.name}</option>
                                    ))}
                                    {materials.some(m => !m.stepId) && <option value="UNLINKED">Sem Etapa Associada</option>}
                                </select>
                            </div>
                            {/* FIM NOVO FILTRO */}

                            {renderMainMaterialList()} {/* Chama o helper para renderizar a lista de materiais */}
                        </div>
                    )}

                    {activeTab === 'FINANCEIRO' && (
                        <div className="space-y-6 animate-in fade-in">
                            {/* Budget Summary Card */}
                            <div className={`bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-lg dark:shadow-card-dark-subtle border ${budgetStatusAccent}`}>
                                {/* Gasto Total Block */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shrink-0 ${budgetStatusIcon}`}>
                                        <i className={`fa-solid ${budgetStatusIcon}`}></i>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Gasto Total</p>
                                        <h3 className="text-2xl font-black text-primary dark:text-white">{formatCurrency(totalSpent)}</h3>
                                    </div>
                                </div>
                                
                                {/* Orçamento Planejado Block (moved below Gasto Total) */}
                                {work.budgetPlanned > 0 && (
                                    <div className="flex justify-between items-center text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                                        <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Orçamento Planejado</span>
                                        <span className="text-lg font-black text-primary dark:text-white">{formatCurrency(work.budgetPlanned)}</span>
                                    </div>
                                )}

                                {/* Budget Progress Bar */}
                                {work.budgetPlanned > 0 && (
                                    <div className="mt-3">
                                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
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
                                    </div>
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
                                    if (expensesInCategory.length === 0) return null;

                                    return (
                                        <div key={category} className="mb-6 first:mt-0 mt-8">
                                            {/* Category "Root" Card */}
                                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-card-dark-subtle">
                                                <h3 className="font-black text-xl text-primary dark:text-white flex items-center gap-2 pl-0">
                                                    <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary dark:bg-secondary-dark/20 dark:text-secondary-light flex items-center justify-center text-base">
                                                        {category === ExpenseCategory.MATERIAL ? <i className="fa-solid fa-box"></i> :
                                                        category === ExpenseCategory.LABOR ? <i className="fa-solid fa-hard-hat"></i> :
                                                        category === ExpenseCategory.PERMITS ? <i className="fa-solid fa-file-invoice-dollar"></i> : 
                                                        <i className="fa-solid fa-ellipsis"></i>}
                                                    </span>
                                                    <span className="text-primary dark:text-white">{category}</span>
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-10">Total: {formatCurrency(groupedExpenses[category].totalCategoryAmount)}</p>
                                            </div>

                                            {/* Expenses linked to steps */}
                                            {Object.keys(groupedExpenses[category].steps)
                                                .filter(stepId => groupedExpenses[category].steps[stepId].expenses.length > 0)
                                                .map(stepId => {
                                                const stepGroup = groupedExpenses[category].steps[stepId];
                                                const step = steps.find(s => s.id === stepId); 
                                                if (!step) return null;
                                                
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

                                                return (
                                                    <div key={stepId} className="mb-4 pl-3 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                                                        {/* Step "Chapter" Card for Financeiro */}
                                                        <div className={`bg-white dark:bg-slate-900 rounded-2xl p-2 mb-3 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-card-dark-subtle ${stepStatusBgClass} ${stepStatusTextColorClass}`}>
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
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-8">{parseDateNoTimezone(step.startDate)} - {parseDateNoTimezone(step.endDate)}</p>
                                                        </div>

                                                        <div className="space-y-2 pl-3 border-l-2 border-slate-100 dark:border-slate-800 ml-3">
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
                                                                    <div key={e.id} onClick={() => openEditExpense(e)} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-card-dark-subtle cursor-pointer hover:shadow-sm transition-shadow">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <p className="font-bold text-sm text-primary dark:text-white">{e.description}</p>
                                                                            <p className="font-black text-sm text-primary dark:text-white">{formatCurrency(e.amount)}</p>
                                                                        </div>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{parseDateNoTimezone(e.date)}</p>
                                                                        {isEmpreita && (
                                                                            <div className="mt-2">
                                                                                <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
                                                                                    <div className="h-full" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: progressBarColor }}></div>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                                                                        <span>{statusText}</span>
                                                                                        <span>{formatCurrency(e.amount)} / {formatCurrency(e.totalAgreed)}</span>
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

                                                {/* Unlinked expenses within this category */}
                                                {groupedExpenses[category].unlinkedExpenses.length > 0 && (
                                                    <div className="mb-4 pl-3 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                                                        <h4 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 pl-0">
                                                            Gastos Não Associados à Etapa
                                                        </h4>
                                                        <div className="space-y-2 pl-3 border-l-2 border-slate-100 dark:border-slate-800 ml-3">
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
                                                                    <div key={e.id} onClick={() => openEditExpense(e)} className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-card-dark-subtle cursor-pointer hover:shadow-sm transition-shadow">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <p className="font-bold text-sm text-primary dark:text-white">{e.description}</p>
                                                                            <p className="font-black text-sm text-primary dark:text-white">{formatCurrency(e.amount)}</p>
                                                                        </div>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{parseDateNoTimezone(e.date)}</p>
                                                                        {isEmpreita && (
                                                                            <div className="mt-2">
                                                                                <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
                                                                                    <div className="h-full" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: progressBarColor }}></div>
                                                                                </div>
                                                                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                                                                        <span>{statusText}</span>
                                                                                        <span>{formatCurrency(e.amount)} / {formatCurrency(e.totalAgreed)}</span>
                                                                                    </div>
                                                                                </div>
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
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
                            {/* Bloco 1: Equipe */}
                            <button onClick={() => setSubView('WORKERS')} className="p-4 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Gerenciar Equipe">
                                <i className="fa-solid fa-users text-xl mb-1 text-primary dark:text-white"></i> {/* Adjusted for dark mode */}
                                <span className="font-bold text-primary dark:text-white text-xs">Equipe</span>
                            </button>

                            {/* Bloco 2: Fornecedores */}
                            <button onClick={() => setSubView('SUPPLIERS')} className="p-4 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Gerenciar Fornecedores">
                                <i className="fa-solid fa-truck-field text-xl mb-1 text-primary dark:text-white"></i> {/* Adjusted for dark mode */}
                                <span className="font-bold text-primary dark:text-white text-xs">Fornecedores</span>
                            </button>

                            {/* Bloco 3: Relatórios */}
                            <button onClick={() => setSubView('REPORTS')} className="p-4 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Gerar Relatórios">
                                <i className="fa-solid fa-file-contract text-xl mb-1 text-primary dark:text-white"></i> {/* Adjusted for dark mode */}
                                <span className="font-bold text-primary dark:text-white text-xs">Relatórios</span>
                            </button>
                            
                            {/* Bloco 4: Fotos */}
                            <button onClick={() => setSubView('PHOTOS')} className="p-4 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Ver Fotos da Obra">
                                <i className="fa-solid fa-camera text-xl mb-1 text-primary dark:text-white"></i> {/* Adjusted for dark mode */}
                                <span className="font-bold text-primary dark:text-white text-xs">Fotos</span>
                            </button>

                            {/* Bloco 5: Arquivos & Projetos */}
                            <button onClick={() => setSubView('PROJECTS')} className="p-4 bg-white dark:bg-slate-900 rounded-3xl flex flex-col items-center shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow" aria-label="Gerenciar Arquivos">
                                <i className="fa-solid fa-folder text-xl mb-1 text-primary dark:text-white"></i> {/* Adjusted for dark mode */}
                                <span className="font-bold text-primary dark:text-white text-xs">Arquivos</span>
                            </button>

                            {/* --- BÔNUS VITALÍCIO - GRANDE CARD CONSOLIDADO --- */}
                            <div className={`relative col-span-full rounded-3xl shadow-lg border dark:shadow-card-dark-subtle p-6 md:p-8 flex flex-col justify-between 
                                ${hasLifetimeAccess ? 'bg-gradient-to-br from-primary-darker to-primary-dark border-secondary/50' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                {!hasLifetimeAccess && (
                                    <div className="absolute inset-0 bg-black/70 rounded-3xl flex flex-col items-center justify-center z-10 p-4 text-center">
                                        <i className="fa-solid fa-lock text-white text-5xl mb-4 opacity-80"></i>
                                        <p className="font-black text-xl text-white mb-2">Exclusivo Plano Vitalício</p>
                                        <button onClick={() => navigate('/settings')} className="mt-4 px-6 py-3 bg-gradient-gold text-white font-black rounded-xl shadow-lg hover:brightness-110 transition-all" aria-label="Liberar Plano Vitalício">
                                            Liberar Acesso Vitalício
                                        </button>
                                    </div>
                                )}
                                <div className={`${!hasLifetimeAccess ? 'opacity-30 pointer-events-none' : ''}`}>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-14 h-14 rounded-full bg-secondary text-white flex items-center justify-center text-2xl shrink-0 shadow-lg">
                                            <i className="fa-solid fa-crown"></i>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Bônus Vitalícios</h2>
                                            <p className="text-amber-200 text-sm font-medium">Desbloqueie ferramentas premium para sua obra.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Bônus: Contratos */}
                                        <button onClick={() => setSubView('CONTRACTS')} className="p-4 rounded-2xl border-2 border-slate-700 bg-gradient-to-br from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 transition-all flex flex-col items-center text-center shadow-md text-white">
                                            <i className="fa-solid fa-file-contract text-2xl mb-2"></i>
                                            <span className="font-black text-sm">Contratos</span>
                                            <span className="text-[10px] text-amber-100 mt-1">Modelos profissionais</span>
                                        </button>
                                        {/* Bônus: Calculadoras */}
                                        <button onClick={() => setIsCalculatorModalOpen(true)} className="p-4 rounded-2xl border-2 border-slate-700 bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 transition-all flex flex-col items-center text-center shadow-md text-white">
                                            <i className="fa-solid fa-calculator text-2xl mb-2"></i>
                                            <span className="font-black text-sm">Calculadoras</span>
                                            <span className="text-[10px] text-green-100 mt-1">Piso, parede, pintura</span>
                                        </button>
                                        {/* Bônus: Checklist da Obra */}
                                        <button onClick={() => setSubView('CHECKLIST')} className="p-4 rounded-2xl border-2 border-slate-700 bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 transition-all flex flex-col items-center text-center shadow-md text-white">
                                            <i className="fa-solid fa-list-check text-2xl mb-2"></i>
                                            <span className="font-black text-sm">Checklist da Obra</span>
                                            <span className="text-[10px] text-purple-100 mt-1">Nada será esquecido</span>
                                        </button>
                                        {/* Bônus: IA da Obra */}
                                        <button onClick={() => navigate('/ai-chat')} className="p-4 rounded-2xl border-2 border-slate-700 bg-gradient-to-br from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 transition-all flex flex-col items-center text-center shadow-md text-white">
                                            <i className="fa-solid fa-robot text-2xl mb-2"></i>
                                            <span className="font-black text-sm">Zé da Obra AI</span>
                                            <span className="text-[10px] text-cyan-100 mt-1">Seu especialista 24h</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-in slide-in-from-right-4">
                    <button onClick={() => setSubView('NONE')} className="mb-6 text-primary font-bold flex items-center gap-2 hover:opacity-80" aria-label="Voltar para Ferramentas"><i className="fa-solid fa-arrow-left text-xl"></i> Voltar</button>
                    
                    {/* --- SUBVIEW: WORKERS (Equipe Separada) --- */}
                    {subView === 'WORKERS' && (
                        <div className="space-y-8">
                            {/* Equipe Section */}
                            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-primary dark:text-white">Equipe de Profissionais</h2>
                                    <button onClick={() => openPersonModal('WORKER')} className="bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar profissional"><i className="fa-solid fa-plus"></i></button>
                                </div>
                                {workers.length === 0 ? (
                                    <p className="text-center text-slate-400 py-8 italic text-sm">Nenhum profissional cadastrado. Adicione sua equipe!</p>
                                ) : (
                                    <div className="space-y-4">
                                        {workers.map(w => (
                                            <div key={w.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-xs dark:shadow-card-dark-subtle">
                                                <div>
                                                    <p className="font-bold text-primary dark:text-white">{w.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{w.role} {w.dailyRate && w.dailyRate > 0 ? `• ${formatCurrency(w.dailyRate)}/dia` : ''}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {w.phone && (
                                                        <button onClick={() => handleGenerateWhatsappLink(w.phone)} className="w-8 h-8 rounded-full bg-green-500/10 text-green-600 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-500/20 transition-colors flex items-center justify-center" aria-label={`Contatar ${w.name} via WhatsApp`}>
                                                            <i className="fa-brands fa-whatsapp text-lg"></i>
                                                        </button>
                                                    )}
                                                    <button onClick={() => openPersonModal('WORKER', w)} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center" aria-label="Editar profissional"><i className="fa-solid fa-pencil text-sm"></i></button>
                                                    <button onClick={() => handleDeletePerson(w.id, w.workId, 'WORKER')} className="w-8 h-8 rounded-full bg-red-500/10 text-red-600 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-500/20 transition-colors flex items-center justify-center" aria-label="Remover profissional"><i className="fa-solid fa-trash text-sm"></i></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- SUBVIEW: SUPPLIERS (Fornecedores Separados) --- */}
                    {subView === 'SUPPLIERS' && (
                        <div className="space-y-8">
                             <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-primary dark:text-white">Fornecedores</h2>
                                    <button onClick={() => openPersonModal('SUPPLIER')} className="bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-light transition-colors" aria-label="Adicionar fornecedor"><i className="fa-solid fa-plus"></i></button>
                                </div>
                                {suppliers.length === 0 ? (
                                    <p className="text-center text-slate-400 py-8 italic text-sm">Nenhum fornecedor cadastrado. Adicione seus parceiros!</p>
                                ) : (
                                    <div className="space-y-4">
                                        {suppliers.map(s => (
                                            <div key={s.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-xs dark:shadow-card-dark-subtle">
                                                <div>
                                                    <p className="font-bold text-primary dark:text-white">{s.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.category} {s.phone ? `• ${s.phone}` : ''}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {s.phone && (
                                                        <button onClick={() => handleGenerateWhatsappLink(s.phone)} className="w-8 h-8 rounded-full bg-green-500/10 text-green-600 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-500/20 transition-colors flex items-center justify-center" aria-label={`Contatar ${s.name} via WhatsApp`}>
                                                            <i className="fa-brands fa-whatsapp text-lg"></i>
                                                        </button>
                                                    )}
                                                    <button onClick={() => openPersonModal('SUPPLIER', s)} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center" aria-label="Editar fornecedor"><i className="fa-solid fa-pencil text-sm"></i></button>
                                                    <button onClick={() => handleDeletePerson(s.id, s.workId, 'SUPPLIER')} className="w-8 h-8 rounded-full bg-red-500/10 text-red-600 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-500/20 transition-colors flex items-center justify-center" aria-label="Remover fornecedor"><i className="fa-solid fa-trash text-sm"></i></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* --- SUBVIEW: REPORTS (Abas) --- */}
                    {subView === 'REPORTS' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Relatórios da Obra</h2>
                            
                            {/* Tabs for Reports */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-6 flex justify-around">
                                {(['CRONOGRAMA', 'MATERIAIS', 'FINANCEIRO'] as ReportSubTab[]).map(tab => (
                                    <button 
                                        key={tab} 
                                        onClick={() => setReportActiveTab(tab)} 
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${reportActiveTab === tab ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                        aria-label={`Ver relatório de ${tab}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* MOVIDO: Botões de Exportação aqui */}
                            <div className="grid grid-cols-2 gap-4 mt-6 mb-8"> {/* Adicionado mb-8 para espaçamento */}
                                <button onClick={handleExportExcel} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-colors" aria-label="Exportar para Excel"><i className="fa-solid fa-file-excel mr-2"></i> Exportar Excel</button>
                                <button onClick={handleExportPdf} className="w-full py-4 bg-red-600 text-white rounded-xl font-bold shadow-lg hover:bg-red-700 transition-colors" aria-label="Exportar para PDF"><i className="fa-solid fa-file-pdf mr-2"></i> Exportar PDF</button>
                            </div>
                            {/* FIM MOVED: Botões de Exportação */}

                            {/* Report Content based on active tab */}
                            {reportActiveTab === 'CRONOGRAMA' && <RenderCronogramaReport />}
                            {reportActiveTab === 'MATERIAIS' && <RenderMateriaisReport />}
                            {reportActiveTab === 'FINANCEIRO' && <RenderFinanceiroReport />}
                        </div>
                    )}
                    
                    {/* --- SUBVIEW: PHOTOS (com estado vazio aprimorado) --- */}
                    {subView === 'PHOTOS' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Fotos da Obra</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-secondary transition-colors cursor-pointer text-center p-4">
                                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'PHOTO')} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Adicionar foto" />
                                    {uploading ? (
                                        <i className="fa-solid fa-circle-notch fa-spin text-slate-400 text-2xl mb-2"></i>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-camera-retro text-slate-400 text-3xl mb-2"></i>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">Clique para adicionar fotos</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">JPG, PNG</p>
                                        </>
                                    )}
                                </div>
                                {photos.length === 0 ? (
                                    <div className="col-span-full text-center text-slate-400 py-8 italic text-sm">
                                        <i className="fa-solid fa-camera-retro text-4xl mb-4 opacity-50"></i>
                                        <p>Nenhuma foto adicionada ainda.</p>
                                        <p className="text-xs mt-2">Documente o progresso e os detalhes da sua obra!</p>
                                    </div>
                                ) : (
                                    photos.map(p => (
                                        <div key={p.id} className="relative group aspect-square">
                                            <img src={p.url} className="aspect-square object-cover rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-card-dark-subtle" alt={p.description} />
                                            <button 
                                                onClick={() => { /* Implement delete photo logic here */ }} 
                                                className="absolute top-2 right-2 p-2 bg-red-500/70 text-white rounded-full hover:bg-red-600 transition-opacity opacity-0 group-hover:opacity-100"
                                                aria-label="Excluir foto"
                                            >
                                                <i className="fa-solid fa-trash text-xs"></i>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- SUBVIEW: PROJECTS (com estado vazio aprimorado) --- */}
                    {subView === 'PROJECTS' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Documentos e Projetos</h2>
                            <div className="relative p-6 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-secondary transition-colors cursor-pointer text-center">
                                <input type="file" onChange={e => handleFileUpload(e, 'FILE')} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Adicionar arquivo" />
                                {uploading ? (
                                    <i className="fa-solid fa-circle-notch fa-spin text-slate-400 text-2xl mb-2"></i>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-file-arrow-up text-slate-400 text-3xl mb-2"></i>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">Clique para adicionar documentos</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">PDF, DWG, DOC, JPG, etc.</p>
                                    </>
                                )}
                            </div>
                            {files.length === 0 ? (
                                <div className="text-center text-slate-400 py-8 italic text-sm">
                                    <i className="fa-solid fa-folder-open text-4xl mb-4 opacity-50"></i>
                                    <p>Nenhum documento ou projeto adicionado ainda.</p>
                                    <p className="text-xs mt-2">Mantenha tudo organizado e acessível!</p>
                                    </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {files.map(f => (
                                        <a href={f.url} target="_blank" rel="noopener noreferrer" key={f.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-sm dark:shadow-card-dark-subtle hover:shadow-md transition-shadow">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xl shrink-0">
                                                <i className={`fa-solid ${f.type.includes('image') ? 'fa-image' : f.type.includes('pdf') ? 'fa-file-pdf' : f.type.includes('cad') ? 'fa-file-code' : 'fa-file'}`}></i>
                                            </div>
                                            <div>
                                                <p className="font-bold text-primary dark:text-white text-sm leading-tight">{f.name}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{f.category}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* --- SUBVIEW: CONTRACTS --- */}
                    {subView === 'CONTRACTS' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Modelos de Contratos</h2>
                            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mb-6">
                                Utilize nossos modelos prontos para formalizar acordos de mão de obra e serviços.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {CONTRACT_TEMPLATES.map(contract => (
                                    <button 
                                        key={contract.id} 
                                        onClick={() => { setViewContract(contract); setIsContractModalOpen(true); }}
                                        className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm dark:shadow-card-dark-subtle hover:shadow-md transition-shadow text-left"
                                        aria-label={`Ver modelo de contrato: ${contract.title}`}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center text-xl shrink-0">
                                            {contract.category === 'Mão de Obra' ? <i className="fa-solid fa-hard-hat"></i> : <i className="fa-solid fa-file-alt"></i>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-primary dark:text-white text-base leading-tight">{contract.title}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{contract.category}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- SUBVIEW: CHECKLIST --- */}
                    {subView === 'CHECKLIST' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-4">Checklists da Obra</h2>
                            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mb-6">
                                Verifique cada detalhe para garantir a qualidade e evitar esquecimentos.
                            </p>

                            <div className="mb-6">
                                <label htmlFor="checklist-category-filter" className="block text-sm font-medium text-primary dark:text-white mb-2">Filtrar por Categoria:</label>
                                <select
                                    id="checklist-category-filter"
                                    value={selectedChecklistCategory}
                                    onChange={(e) => setSelectedChecklistCategory(e.target.value)}
                                    className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-primary dark:text-white focus:ring-secondary focus:border-secondary outline-none transition-colors"
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleAddChecklist('Geral')} // Default to 'Geral' or use selected category
                                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center shadow-sm dark:shadow-card-dark-subtle hover:shadow-md transition-shadow text-center text-primary dark:text-white hover:text-secondary"
                                    aria-label="Criar novo checklist"
                                >
                                    <i className="fa-solid fa-plus-circle text-2xl mb-2"></i>
                                    <span className="font-bold text-sm">Criar Novo Checklist</span>
                                </button>
                                {allChecklists.filter(cl => 
                                    selectedChecklistCategory === 'all' || cl.category === selectedChecklistCategory
                                ).map(checklist => (
                                    <button 
                                        key={checklist.id} 
                                        onClick={() => handleEditChecklist(checklist)}
                                        className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-start gap-2 shadow-sm dark:shadow-card-dark-subtle hover:shadow-md transition-shadow text-left"
                                        aria-label={`Editar checklist: ${checklist.name}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-list-check text-xl text-secondary"></i>
                                            <p className="font-bold text-primary dark:text-white text-base leading-tight">{checklist.name}</p>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Categoria: {checklist.category}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{checklist.items.filter(item => item.checked).length} / {checklist.items.length} itens concluídos</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}


                </div>
            )}

            {/* Modal para Adicionar/Editar Etapa */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setIsStepModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary" aria-label="Fechar"><i className="fa-solid fa-xmark text-xl"></i></button>
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{stepModalMode === 'ADD' ? 'Adicionar Nova Etapa' : 'Editar Etapa'}</h3>
                        <form onSubmit={handleSaveStep} className="space-y-4">
                            <div>
                                <label htmlFor="step-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Etapa</label>
                                <input id="step-name" type="text" value={stepName} onChange={(e) => setStepName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="step-start" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Início</label>
                                <input id="step-start" type="date" value={stepStart} onChange={(e) => setStepStart(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="step-end" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data Fim</label>
                                <input id="step-end" type="date" value={stepEnd} onChange={(e) => setStepEnd(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors">{stepModalMode === 'ADD' ? 'Adicionar' : 'Salvar'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Adicionar Material */}
            {addMatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setAddMatModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary" aria-label="Fechar"><i className="fa-solid fa-xmark text-xl"></i></button>
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Adicionar Novo Material</h3>
                        <form onSubmit={handleAddMaterial} className="space-y-4">
                            <div>
                                <label htmlFor="new-mat-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                                <input id="new-mat-name" type="text" value={newMatName} onChange={(e) => setNewMatName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="new-mat-brand" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca (Opcional)</label>
                                <input id="new-mat-brand" type="text" value={newMatBrand} onChange={(e) => setNewMatBrand(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="new-mat-qty" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd Planejada</label>
                                    <input id="new-mat-qty" type="number" value={newMatQty} onChange={(e) => setNewMatQty(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                                <div>
                                    <label htmlFor="new-mat-unit" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
                                    <input id="new-mat-unit" type="text" value={newMatUnit} onChange={(e) => setNewMatUnit(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="new-mat-step" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Etapa Associada (Opcional)</label>
                                <select id="new-mat-step" value={newMatStepId} onChange={(e) => setNewMatStepId(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    <option value="">Nenhuma</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input id="new-mat-buy-now" type="checkbox" checked={newMatBuyNow} onChange={(e) => setNewMatBuyNow(e.target.checked)} className="form-checkbox" />
                                <label htmlFor="new-mat-buy-now" className="text-sm text-slate-700 dark:text-slate-300">Já comprado?</label>
                            </div>
                            {newMatBuyNow && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                    <div>
                                        <label htmlFor="new-mat-buy-qty" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd Comprada</label>
                                        <input id="new-mat-buy-qty" type="number" value={newMatBuyQty} onChange={(e) => setNewMatBuyQty(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                    </div>
                                    <div>
                                        <label htmlFor="new-mat-buy-cost" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custo Total</label>
                                        <input id="new-mat-buy-cost" type="number" value={newMatBuyCost} onChange={(e) => setNewMatBuyCost(e.target.value)} placeholder="0.00" className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                    </div>
                                </div>
                            )}
                            <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors">Adicionar Material</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Editar Material */}
            {materialModal.isOpen && materialModal.material && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setMaterialModal({isOpen: false, material: null})} className="absolute top-4 right-4 text-slate-400 hover:text-primary" aria-label="Fechar"><i className="fa-solid fa-xmark text-xl"></i></button>
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Detalhes do Material</h3>
                        <form onSubmit={handleUpdateMaterial} className="space-y-4">
                            <div>
                                <label htmlFor="mat-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                                <input id="mat-name" type="text" value={matName} onChange={(e) => setMatName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="mat-brand" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca (Opcional)</label>
                                <input id="mat-brand" type="text" value={matBrand} onChange={(e) => setMatBrand(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="mat-planned-qty" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd Planejada</label>
                                    <input id="mat-planned-qty" type="number" value={matPlannedQty} onChange={(e) => setMatPlannedQty(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                                <div>
                                    <label htmlFor="mat-unit" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
                                    <input id="mat-unit" type="text" value={matUnit} onChange={(e) => setMatUnit(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="mat-purchased-qty" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd Comprada</label>
                                    <input id="mat-purchased-qty" type="number" value={materialModal.material.purchasedQty} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500" disabled />
                                </div>
                                <div>
                                    <label htmlFor="mat-buy-cost" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adicionar Custo (Opcional)</label>
                                    <input id="mat-buy-cost" type="number" value={matBuyCost} onChange={(e) => setMatBuyCost(e.target.value)} placeholder="0.00" className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                                </div>
                            </div>
                            <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors">Salvar Alterações</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Adicionar/Editar Despesa */}
            {expenseModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setExpenseModal(prev => ({ ...prev, isOpen: false }))} className="absolute top-4 right-4 text-slate-400 hover:text-primary" aria-label="Fechar"><i className="fa-solid fa-xmark text-xl"></i></button>
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{expenseModal.mode === 'ADD' ? 'Adicionar Novo Gasto' : 'Atualizar Gasto'}</h3>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            <div>
                                <label htmlFor="exp-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                                <input id="exp-desc" type="text" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="exp-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                                <select id="exp-category" value={expCategory} onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="exp-step" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Etapa Associada (Opcional)</label>
                                <select id="exp-step" value={expStepId} onChange={(e) => setExpStepId(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    <option value="">Nenhuma</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            {expenseModal.mode === 'EDIT' && (
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total já pago: {formatCurrency(expSavedAmount)}</p>
                            )}
                            <div>
                                <label htmlFor="exp-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{expenseModal.mode === 'ADD' ? 'Valor' : 'Adicionar Valor ao Total'}</label>
                                <input id="exp-amount" type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="exp-total-agreed" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor Total Combinado (Empreita/Opcional)</label>
                                <input id="exp-total-agreed" type="number" value={expTotalAgreed} onChange={(e) => setExpTotalAgreed(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                            </div>
                            <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors">{expenseModal.mode === 'ADD' ? 'Adicionar Gasto' : 'Atualizar Gasto'}</button>
                            {expenseModal.mode === 'EDIT' && expenseModal.id && (
                                <button type="button" onClick={() => handleDeleteExpense(expenseModal.id!)} className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors mt-2">Excluir Gasto</button>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* Modal para Adicionar/Editar Pessoa (Trabalhador/Fornecedor) */}
            {isPersonModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setIsPersonModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary" aria-label="Fechar"><i className="fa-solid fa-xmark text-xl"></i></button>
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{personId ? `Editar ${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}` : `Adicionar ${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}`}</h3>
                        <form onSubmit={handleSavePerson} className="space-y-4">
                            <div>
                                <label htmlFor="person-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                                <input id="person-name" type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label htmlFor="person-role" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{personMode === 'WORKER' ? 'Função' : 'Categoria'}</label>
                                <select id="person-role" value={personRole} onChange={(e) => setPersonRole(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    {(personMode === 'WORKER' ? STANDARD_JOB_ROLES : STANDARD_SUPPLIER_CATEGORIES).map(role => <option key={role} value={role}>{role}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="person-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone (WhatsApp)</label>
                                <input id="person-phone" type="text" value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            {personMode === 'WORKER' && (
                                <div>
                                    <label htmlFor="worker-daily-rate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Diária (R$)</label>
                                    <input id="worker-daily-rate" type="number" value={workerDailyRate} onChange={(e) => setWorkerDailyRate(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                                </div>
                            )}
                            {personMode === 'SUPPLIER' && (
                                <>
                                    <div>
                                        <label htmlFor="person-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail (Opcional)</label>
                                        <input id="person-email" type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                                    </div>
                                    <div>
                                        <label htmlFor="person-address" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço (Opcional)</label>
                                        <input id="person-address" type="text" value={personAddress} onChange={(e) => setPersonAddress(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                                    </div>
                                </>
                            )}
                            <div>
                                <label htmlFor="person-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações (Opcional)</label>
                                <textarea id="person-notes" value={personNotes} onChange={(e) => setPersonNotes(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"></textarea>
                            </div>
                            <button type="submit" disabled={isPersonSaving} className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2">
                                {isPersonSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
                                {personId ? 'Salvar Alterações' : 'Adicionar'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Calculadoras */}
            {isCalculatorModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setIsCalculatorModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary" aria-label="Fechar"><i className="fa-solid fa-xmark text-xl"></i></button>
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Calculadoras Rápidas</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="calc-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Cálculo</label>
                                <select id="calc-type" value={calcType} onChange={(e) => setCalcType(e.target.value as 'PISO'|'PAREDE'|'PINTURA')} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    <option value="PISO">Piso/Revestimento</option>
                                    <option value="PAREDE">Parede (Tijolos)</option>
                                    <option value="PINTURA">Pintura</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="calc-area" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Área (m²)</label>
                                <input id="calc-area" type="number" value={calcArea} onChange={(e) => setCalcArea(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="Ex: 20" />
                            </div>
                            {calcResult.length > 0 && (
                                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in">
                                    <p className="font-bold text-primary dark:text-white mb-2">Estimativa de Materiais:</p>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                        {calcResult.map((res, i) => <li key={i}>{res}</li>)}
                                    </ul>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                                        <i className="fa-solid fa-info-circle mr-1"></i> Valores aproximados. Sempre consulte um profissional.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de visualização de Contrato */}
            {isContractModalOpen && viewContract && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl h-[90vh] flex flex-col p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setIsContractModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary" aria-label="Fechar"><i className="fa-solid fa-xmark text-xl"></i></button>
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-2">{viewContract.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Categoria: {viewContract.category}</p>
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                            {viewContract.contentTemplate}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => { navigator.clipboard.writeText(viewContract.contentTemplate); alert('Conteúdo copiado!'); }} className="px-5 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors" aria-label="Copiar conteúdo do contrato">
                                <i className="fa-solid fa-copy mr-2"></i> Copiar Conteúdo
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal de Checklist */}
            {isChecklistModalOpen && editingChecklist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
                        <button onClick={() => setIsChecklistModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-primary" aria-label="Fechar"><i className="fa-solid fa-xmark text-xl"></i></button>
                        
                        <div className="flex items-center justify-between mb-4">
                            <input 
                                type="text"
                                value={editingChecklist.name}
                                onChange={(e) => handleUpdateChecklistName(e.target.value)}
                                className="text-xl font-bold text-primary dark:text-white bg-transparent border-b-2 border-transparent focus:border-secondary-light outline-none transition-colors"
                                aria-label="Nome do Checklist"
                            />
                            <button 
                                onClick={() => { 
                                    if (window.confirm('Tem certeza que deseja excluir este checklist?')) {
                                        dbService.deleteChecklist(editingChecklist.id);
                                        setIsChecklistModalOpen(false);
                                        load();
                                    }
                                }} 
                                className="text-red-400 hover:text-red-600 transition-colors p-2"
                                aria-label="Excluir checklist"
                            >
                                <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Categoria: {editingChecklist.category}</p>

                        <div className="space-y-3 max-h-[50vh] overflow-y-auto mb-6">
                            {editingChecklist.items.map(item => (
                                <div key={item.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <input 
                                        type="checkbox" 
                                        checked={item.checked} 
                                        onChange={() => handleChecklistItemToggle(editingChecklist.id, item.id)} 
                                        className="form-checkbox text-secondary rounded focus:ring-secondary"
                                        aria-label={`Marcar item ${item.text} como ${item.checked ? 'não concluído' : 'concluído'}`}
                                    />
                                    <span className={`flex-1 text-sm ${item.checked ? 'line-through text-slate-400 dark:text-slate-600' : 'text-primary dark:text-white'}`}>
                                        {item.text}
                                    </span>
                                    <button 
                                        onClick={() => handleDeleteChecklistItem(item.id)}
                                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                                        aria-label={`Excluir item ${item.text}`}
                                    >
                                        <i className="fa-solid fa-xmark text-sm"></i>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={newChecklistItemText}
                                onChange={(e) => setNewChecklistItemText(e.target.value)}
                                placeholder="Novo item do checklist..."
                                className="flex-1 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                                aria-label="Adicionar novo item ao checklist"
                            />
                            <button 
                                onClick={handleAddChecklistItem}
                                className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
                                aria-label="Adicionar item"
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* ZeModal para confirmações e alertas */}
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
