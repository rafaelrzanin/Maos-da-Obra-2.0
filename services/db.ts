import { PlanType, ExpenseCategory, StepStatus, FileCategory, type User, type Work, type Step, type Material, type Expense, type Worker, type Supplier, type WorkPhoto, type WorkFile, type DBNotification, type PushSubscriptionInfo, type Contract, type Checklist, type ChecklistItem, type FinancialHistoryEntry, InstallmentStatus, ExpenseStatus } from '../types.ts';
import { WORK_TEMPLATES, FULL_MATERIAL_PACKAGES, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from './standards.ts';
import { supabase } from './supabase.ts';

// --- CACHE SYSTEM (IN-MEMORY) ---
const CACHE_TTL = 60000;
const _dashboardCache: {
    works: { data: Work[], timestamp: number } | null;
    stats: Record<string, { data: any, timestamp: number }>;
    summary: Record<string, { data: any, timestamp: number }>;
    notifications: { data: DBNotification[], timestamp: number } | null;
    steps: Record<string, { data: Step[], timestamp: number }>;
    materials: Record<string, { data: Material[], timestamp: number }>;
    expenses: Record<string, { data: Expense[], timestamp: number }>;
    workers: Record<string, { data: Worker[], timestamp: number }>;
    suppliers: Record<string, { data: Supplier[], timestamp: number }>;
    photos: Record<string, { data: WorkPhoto[], timestamp: number }>;
    files: Record<string, { data: WorkFile[], timestamp: number }>;
    contracts: { data: Contract[], timestamp: number } | null;
    checklists: Record<string, { data: Checklist[], timestamp: number }>;
    pushSubscriptions: Record<string, { data: PushSubscriptionInfo[], timestamp: number }>;
    financialHistory: Record<string, { data: FinancialHistoryEntry[], timestamp: number }>;
} = {
    works: null,
    stats: {},
    summary: {},
    notifications: null,
    steps: {},
    materials: {},
    expenses: {},
    workers: {},
    suppliers: {},
    photos: {},
    files: {},
    contracts: null,
    checklists: {},
    pushSubscriptions: {},
    financialHistory: {},
};

// --- HELPERS ---
const mapProfileFromSupabase = (data: any): User => ({
    id: data.id,
    name: data.name || 'Usuário',
    email: data.email || '',
    whatsapp: data.whatsapp,
    cpf: data.cpf,
    plan: data.plan as PlanType,
    subscriptionExpiresAt: data.subscription_expires_at,
    isTrial: data.is_trial || false
});

const parseWorkFromDB = (data: any): Work => ({
    id: data.id,
    userId: data.user_id,
    name: data.name,
    address: data.address,
    budgetPlanned: Number(data.budget_planned || 0),
    startDate: data.start_date,
    endDate: data.end_date,
    area: Number(data.area),
    status: data.status,
    notes: data.notes || '',
    floors: Number(data.floors || 1),
    bedrooms: Number(data.bedrooms || 0),
    bathrooms: Number(data.bathrooms || 0),
    kitchens: Number(data.kitchens || 0),
    livingRooms: Number(data.living_rooms || 0),
    hasLeisureArea: data.has_leisure_area || false
});

const _calculateStepStatus = (dbStep: any): StepStatus => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dbStep.real_date) return StepStatus.COMPLETED;
    if (!dbStep.start_date) return StepStatus.NOT_STARTED;
    const stepEndDate = new Date(dbStep.end_date);
    stepEndDate.setHours(0, 0, 0, 0);
    if (today.getTime() > stepEndDate.getTime()) return StepStatus.DELAYED;
    return StepStatus.IN_PROGRESS;
};

const parseStepFromDB = (data: any): Step => {
    const parsedStep: Step = {
        id: data.id,
        workId: data.work_id,
        name: data.name,
        startDate: data.start_date,
        endDate: data.end_date,
        realDate: data.real_date || undefined,
        status: StepStatus.NOT_STARTED,
        orderIndex: data.order_index,
        estimatedDurationDays: data.estimated_duration_days || undefined,
    };
    parsedStep.status = _calculateStepStatus(data);
    return parsedStep;
};

const parseMaterialFromDB = (data: any): Material => ({
    id: data.id,
    workId: data.work_id,
    userId: data.user_id,
    name: data.name,
    brand: data.brand,
    plannedQty: Number(data.planned_qty || 0),
    purchasedQty: Number(data.purchased_qty || 0),
    unit: data.unit,
    stepId: data.step_id,
    category: data.category,
    totalCost: Number(data.total_cost || 0)
});

const parseExpenseFromDB = (data: any): Expense => {
    const paidAmount = Number(data.paid_amount_sum || 0);
    const totalAgreed = data.total_agreed ? Number(data.total_agreed) : Number(data.amount || 0);
    let status: ExpenseStatus;
    if (paidAmount === 0) status = ExpenseStatus.PENDING;
    else if (paidAmount < totalAgreed) status = ExpenseStatus.PARTIAL;
    else if (paidAmount === totalAgreed) status = ExpenseStatus.COMPLETED;
    else status = ExpenseStatus.OVERPAID;

    return {
        id: data.id,
        workId: data.work_id,
        description: data.description,
        amount: Number(data.amount || 0),
        paidAmount: paidAmount,
        quantity: Number(data.quantity || 0),
        date: data.date,
        category: data.category,
        relatedMaterialId: data.related_material_id,
        stepId: data.step_id,
        workerId: data.worker_id,
        supplierId: data.supplier_id,
        totalAgreed: data.total_agreed ? Number(data.total_agreed) : undefined,
        status: status,
    };
};

const parseWorkerFromDB = (data: any): Worker => ({
    id: data.id, userId: data.user_id, workId: data.work_id, name: data.name, role: data.role, phone: data.phone, dailyRate: Number(data.daily_rate || 0), notes: data.notes
});

const parseSupplierFromDB = (data: any): Supplier => ({
    id: data.id, userId: data.user_id, workId: data.work_id, name: data.name, category: data.category, phone: data.phone, email: data.email, address: data.address, notes: data.notes
});

const parsePhotoFromDB = (data: any): WorkPhoto => ({
    id: data.id, workId: data.work_id, url: data.url, description: data.description, date: data.date, type: data.type
});

const parseFileFromDB = (data: any): WorkFile => ({
    id: data.id, workId: data.work_id, name: data.name, category: data.category, url: data.url, type: data.type, date: data.date
});

const parseNotificationFromDB = (data: any): DBNotification => ({
    id: data.id, userId: data.user_id, workId: data.work_id, title: data.title, message: data.message, date: data.date, read: data.read, type: data.type, tag: data.tag
});

const parseChecklistFromDB = (data: any): Checklist => ({
    id: data.id, workId: data.work_id, name: data.name, category: data.category, items: data.items || []
});

const getMaterialCategoriesFromStepName = (stepName: string, work: Work): string[] => {
    const categories: string[] = [];
    if (stepName.includes('Limpeza')) categories.push('Limpeza do Terreno e Gabarito');
    if (stepName.includes('Fundações')) categories.push('Fundações');
    if (stepName.includes('Estrutura')) categories.push('Estrutura e Lajes');
    if (stepName.includes('Alvenaria')) categories.push('Alvenaria e Vedação');
    return categories;
};

// --- AUTH SESSION ---
let sessionCache: { promise: Promise<User | null>, timestamp: number } | null = null;
const AUTH_CACHE_DURATION = 5000;
const pendingProfileRequests: Partial<Record<string, Promise<User | null>>> = {};

const ensureUserProfile = async (authUser: any): Promise<User | null> => {
    if (!authUser) return null;
    const pending = pendingProfileRequests[authUser.id];
    if (pending) return pending;

    const fetchProfileProcess = async (): Promise<User | null> => {
        try {
            const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
            if (existingProfile) return mapProfileFromSupabase(existingProfile);

            const newProfileData = {
                id: authUser.id,
                name: authUser.user_metadata?.name || 'Novo Usuário',
                email: authUser.email,
                plan: null,
                is_trial: false
            };

            const { data: createdProfile } = await supabase.from('profiles').insert(newProfileData).select().single();
            return createdProfile ? mapProfileFromSupabase(createdProfile) : null;
        } catch (e) { return null; }
    };

    const promise = fetchProfileProcess();
    pendingProfileRequests[authUser.id] = promise;
    promise.finally(() => { delete pendingProfileRequests[authUser.id]; });
    return promise;
};

const _addFinancialHistoryEntry = async (entry: any) => {
    await supabase.from('financial_history').insert({ ...entry, timestamp: new Date().toISOString() });
};

export const dbService = {
    // --- AUTH ---
    async getCurrentUser(): Promise<User | null> {
        const now = Date.now();
        if (sessionCache && (now - sessionCache.timestamp < AUTH_CACHE_DURATION)) return sessionCache.promise;
        const newPromise = (async () => {
            const { data } = await supabase.auth.getSession();
            return data?.session?.user ? await ensureUserProfile(data.session.user) : null;
        })();
        sessionCache = { promise: newPromise, timestamp: now };
        return newPromise;
    },

    async login(email: string, password?: string) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || '' });
        if (error) throw error;
        sessionCache = null;
        return await ensureUserProfile(data.user);
    },

    async signup(name: string, email: string, whatsapp: string, password?: string) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password: password || '123456',
            options: {
                data: { name }
            }
        }); // 🔥 CORRIGIDO: Adicionado o fecho de objeto '}' antes do parêntese

        if (authError) throw authError;
        sessionCache = null;
        return await ensureUserProfile(authData.user);
    },

    async logout() {
        await supabase.auth.signOut();
        sessionCache = null;
    },

    // --- WORKS ---
    async getWorks(userId: string): Promise<Work[]> {
        const { data, error } = await supabase.from('works').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        return error ? [] : (data || []).map(parseWorkFromDB);
    },

    async getWorkById(workId: string) {
        const { data } = await supabase.from('works').select('*').eq('id', workId).single();
        return data ? parseWorkFromDB(data) : null;
    },

    // --- STEPS ---
    async getSteps(workId: string) {
        const { data } = await supabase.from('steps').select('*').eq('work_id', workId).order('order_index', { ascending: true });
        return (data || []).map(parseStepFromDB);
    },

    async addStep(step: any) {
        const { data } = await supabase.from('steps').insert({
            work_id: step.workId, name: step.name, start_date: step.startDate, end_date: step.endDate
        }).select().single();
        return parseStepFromDB(data);
    },

    async updateStep(step: Step) {
        const { data, error } = await supabase.from('steps').update({
            name: step.name, start_date: step.startDate, end_date: step.endDate, real_date: step.realDate
        }).eq('id', step.id).select().single();
        if (error) throw error;
        return parseStepFromDB(data);
    },

    async deleteStep(stepId: string, workId: string) {
        await supabase.from('steps').delete().eq('id', stepId);
    },

    // --- MATERIALS ---
    async getMaterials(workId: string) {
        const { data } = await supabase.from('materials').select('*').eq('work_id', workId);
        return (data || []).map(parseMaterialFromDB);
    },

    async addMaterial(userId: string, material: any) {
        const { data } = await supabase.from('materials').insert({
            work_id: material.workId, user_id: userId, name: material.name, planned_qty: material.plannedQty, unit: material.unit
        }).select().single();
        return parseMaterialFromDB(data);
    },

    async deleteMaterial(id: string) {
        await supabase.from('materials').delete().eq('id', id);
    },

    async updateMaterial(material: any) {
        const { data } = await supabase.from('materials').update({ name: material.name, planned_qty: material.plannedQty }).eq('id', material.id).select().single();
        return parseMaterialFromDB(data);
    },

    async registerMaterialPurchase(materialId: string, name: string, brand: any, planned: any, unit: any, qty: number, cost: number) {
        const { data: curr } = await supabase.from('materials').select('*').eq('id', materialId).single();
        const { data } = await supabase.from('materials').update({
            purchased_qty: curr.purchased_qty + qty, total_cost: curr.total_cost + cost
        }).eq('id', materialId).select().single();
        return parseMaterialFromDB(data);
    },

    // --- EXPENSES ---
    async getExpenses(workId: string) {
        const { data } = await supabase.from('expenses').select('*').eq('work_id', workId);
        return (data || []).map(parseExpenseFromDB);
    },

    async addExpense(expense: any) {
        const { data } = await supabase.from('expenses').insert({
            work_id: expense.workId, description: expense.description, amount: expense.amount, category: expense.category, date: expense.date
        }).select().single();
        return parseExpenseFromDB(data);
    },

    async updateExpense(expense: any) {
        const { data } = await supabase.from('expenses').update({ description: expense.description, amount: expense.amount }).eq('id', expense.id).select().single();
        return parseExpenseFromDB(data);
    },

    async deleteExpense(id: string) {
        await supabase.from('expenses').delete().eq('id', id);
    },

    async addPaymentToExpense(expenseId: string, amount: number, date: string) {
        await supabase.from('financial_installments').insert({ expense_id: expenseId, amount, status: InstallmentStatus.PAID, paid_at: date });
        const { data } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
        return parseExpenseFromDB(data);
    },

    // --- OTHERS ---
    async getWorkers(workId: string) {
        const { data } = await supabase.from('workers').select('*').eq('work_id', workId);
        return (data || []).map(parseWorkerFromDB);
    },

    async addWorker(worker: any) {
        const { data } = await supabase.from('workers').insert({ work_id: worker.workId, user_id: worker.userId, name: worker.name, role: worker.role, phone: worker.phone }).select().single();
        return parseWorkerFromDB(data);
    },

    async deleteWorker(id: string, workId: string) {
        await supabase.from('workers').delete().eq('id', id);
    },

    async getSuppliers(workId: string) {
        const { data } = await supabase.from('suppliers').select('*').eq('work_id', workId);
        return (data || []).map(parseSupplierFromDB);
    },

    async addSupplier(sup: any) {
        const { data } = await supabase.from('suppliers').insert({ work_id: sup.workId, user_id: sup.userId, name: sup.name, category: sup.category }).select().single();
        return parseSupplierFromDB(data);
    },

    async deleteSupplier(id: string, workId: string) {
        await supabase.from('suppliers').delete().eq('id', id);
    },

    async getPhotos(workId: string) {
        const { data } = await supabase.from('work_photos').select('*').eq('work_id', workId);
        return (data || []).map(parsePhotoFromDB);
    },

    async addPhoto(photo: any) {
        const { data } = await supabase.from('work_photos').insert({ work_id: photo.workId, url: photo.url, description: photo.description }).select().single();
        return parsePhotoFromDB(data);
    },

    async deletePhoto(id: string) {
        await supabase.from('work_photos').delete().eq('id', id);
    },

    async getFiles(workId: string) {
        const { data } = await supabase.from('work_files').select('*').eq('work_id', workId);
        return (data || []).map(parseFileFromDB);
    },

    async addFile(file: any) {
        const { data } = await supabase.from('work_files').insert({ work_id: file.workId, name: file.name, url: file.url }).select().single();
        return parseFileFromDB(data);
    },

    async deleteFile(id: string) {
        await supabase.from('work_files').delete().eq('id', id);
    },

    async getContractTemplates() { return CONTRACT_TEMPLATES; },

    async getChecklists(workId: string) {
        const { data } = await supabase.from('checklists').select('*').eq('work_id', workId);
        return (data || []).map(parseChecklistFromDB);
    },

    async addChecklist(cl: any) {
        const { data } = await supabase.from('checklists').insert({ work_id: cl.workId, name: cl.name, category: cl.category, items: cl.items }).select().single();
        return parseChecklistFromDB(data);
    },

    async updateChecklist(cl: any) {
        const { data } = await supabase.from('checklists').update({ name: cl.name, items: cl.items }).eq('id', cl.id).select().single();
        return parseChecklistFromDB(data);
    },

    async deleteChecklist(id: string) {
        await supabase.from('checklists').delete().eq('id', id);
    },

    async ensureMaterialsForWork(work: Work, steps: Step[]) {
        const { data } = await supabase.from('materials').select('id').eq('work_id', work.id).limit(1);
        if (!data || data.length === 0) {
            // Lógica de geração aqui se necessário
        }
    },
    
    async savePushSubscription(userId: string, subscription: any) {
        await supabase.from('user_subscriptions').upsert({ user_id: userId, subscription, endpoint: subscription.endpoint, created_at: new Date().toISOString() });
    }
};
