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
    works: null, stats: {}, summary: {}, notifications: null, steps: {}, materials: {}, expenses: {}, workers: {}, suppliers: {}, photos: {}, files: {}, contracts: null, checklists: {}, pushSubscriptions: {}, financialHistory: {},
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
    if (!dbStep.start_date) return StepStatus.PENDING;
    const stepEndDate = new Date(dbStep.end_date);
    stepEndDate.setHours(0, 0, 0, 0);
    return today.getTime() > stepEndDate.getTime() ? StepStatus.DELAYED : StepStatus.IN_PROGRESS;
};

const parseStepFromDB = (data: any): Step => {
    const parsedStep: Step = {
        id: data.id,
        workId: data.work_id,
        name: data.name,
        startDate: data.start_date || null,
        endDate: data.end_date || null,
        realDate: data.real_date || null,
        status: StepStatus.PENDING,
        orderIndex: data.order_index,
        estimatedDurationDays: data.estimated_duration_days || undefined,
    };
    parsedStep.status = _calculateStepStatus(data);
    return parsedStep;
};

const parseMaterialFromDB = (data: any): Material => ({
    id: data.id, workId: data.work_id, userId: data.user_id, name: data.name, brand: data.brand,
    plannedQty: Number(data.planned_qty || 0), purchasedQty: Number(data.purchased_qty || 0),
    unit: data.unit, stepId: data.step_id, category: data.category, totalCost: Number(data.total_cost || 0)
});

const parseExpenseFromDB = (data: any): Expense => {
    const paidAmount = Number(data.paid_amount_sum || 0);
    const totalAgreed = data.total_agreed ? Number(data.total_agreed) : Number(data.amount || 0);
    let status: ExpenseStatus = ExpenseStatus.PENDING;
    if (paidAmount > 0) {
        if (paidAmount < totalAgreed) status = ExpenseStatus.PARTIAL;
        else if (paidAmount === totalAgreed) status = ExpenseStatus.COMPLETED;
        else status = ExpenseStatus.OVERPAID;
    }
    return {
        id: data.id, workId: data.work_id, description: data.description, amount: Number(data.amount || 0),
        paidAmount, quantity: Number(data.quantity || 0), date: data.date, category: data.category,
        relatedMaterialId: data.related_material_id, stepId: data.step_id, workerId: data.worker_id,
        supplierId: data.supplier_id, totalAgreed: data.total_agreed ? Number(data.total_agreed) : undefined,
        status
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
        }); 
        if (authError) throw authError;
        sessionCache = null;
        return await ensureUserProfile(authData.user);
    },

    async logout() {
        await supabase.auth.signOut();
        sessionCache = null;
    },

    async syncSession(): Promise<User | null> {
        sessionCache = null;
        return this.getCurrentUser();
    },

    onAuthChange(callback: (user: User | null) => void) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            sessionCache = null;
            if (session?.user) {
                const user = await ensureUserProfile(session.user);
                callback(user);
            } else {
                callback(null);
            }
        });
        return () => subscription.unsubscribe();
    },

    isSubscriptionActive(user: User): boolean {
        if (user.plan === PlanType.VITALICIO) return true;
        if (user.isTrial) return false;
        if (!user.subscriptionExpiresAt) return false;
        return new Date(user.subscriptionExpiresAt) > new Date();
    },

    async updatePlan(userId: string, plan: PlanType): Promise<void> {
        await supabase.from('profiles').update({ plan }).eq('id', userId);
    },

    // --- WORKS ---
    async getWorks(userId: string): Promise<Work[]> {
        const { data, error } = await supabase.from('works').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        return error ? [] : (data || []).map(parseWorkFromDB);
    },

    async getWorkById(workId: string): Promise<Work | null> {
        const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
        if (error) return null;
        return data ? parseWorkFromDB(data) : null;
    },

    // --- STEPS ---
    async getSteps(workId: string): Promise<Step[]> {
        const { data } = await supabase.from('steps').select('*').eq('work_id', workId).order('order_index', { ascending: true });
        return (data || []).map(parseStepFromDB);
    },

    async addStep(step: any): Promise<Step> {
        const { data, error } = await supabase.from('steps').insert({
            work_id: step.workId, name: step.name, start_date: step.startDate, end_date: step.endDate
        }).select().single();
        if (error) throw error;
        return parseStepFromDB(data);
    },

    async updateStep(step: Step): Promise<Step> {
        const { data, error } = await supabase.from('steps').update({
            name: step.name, start_date: step.startDate, end_date: step.endDate, real_date: step.realDate
        }).eq('id', step.id).select().single();
        if (error) throw error;
        return parseStepFromDB(data);
    },

    async deleteStep(stepId: string, workId: string): Promise<void> {
        await supabase.from('steps').delete().eq('id', stepId);
    },

    // --- MATERIALS ---
    async getMaterials(workId: string): Promise<Material[]> {
        const { data, error } = await supabase.from('materials').select('*').eq('work_id', workId);
        return error ? [] : (data || []).map(parseMaterialFromDB);
    },

    async addMaterial(userId: string, material: any): Promise<Material> {
        const { data, error } = await supabase.from('materials').insert({
            work_id: material.workId, user_id: userId, name: material.name, planned_qty: material.plannedQty, unit: material.unit
        }).select().single();
        if (error) throw error;
        return parseMaterialFromDB(data);
    },

    async updateMaterial(material: Material): Promise<Material> {
        const { data, error } = await supabase.from('materials').update({
            name: material.name, planned_qty: material.plannedQty, unit: material.unit
        }).eq('id', material.id).select().single();
        if (error) throw error;
        return parseMaterialFromDB(data);
    },

    async deleteMaterial(materialId: string): Promise<void> {
        await supabase.from('materials').delete().eq('id', materialId);
    },

    async registerMaterialPurchase(materialId: string, name: string, brand: any, planned: any, unit: any, qty: number, cost: number): Promise<Material> {
        const { data: curr } = await supabase.from('materials').select('*').eq('id', materialId).single();
        const { data, error } = await supabase.from('materials').update({
            purchased_qty: curr.purchased_qty + qty, total_cost: curr.total_cost + cost
        }).eq('id', materialId).select().single();
        if (error) throw error;
        return parseMaterialFromDB(data);
    },

    // --- EXPENSES ---
    async getExpenses(workId: string): Promise<Expense[]> {
        const { data, error } = await supabase.from('expenses').select('*, financial_installments(amount, status)').eq('work_id', workId);
        if (error) return [];
        return data.map((dbExpense: any) => {
            const insts = dbExpense.financial_installments || [];
            const paidSum = insts.filter((i: any) => i.status === InstallmentStatus.PAID).reduce((s: number, i: any) => s + Number(i.amount), 0);
            return { ...parseExpenseFromDB(dbExpense), paidAmount: paidSum };
        });
    },

    async addExpense(expense: any): Promise<Expense> {
        const { data: newExpense, error } = await supabase.from('expenses').insert({
            work_id: expense.workId, description: expense.description, amount: expense.amount, category: expense.category, date: expense.date
        }).select().single();
        if (error) throw error;
        return parseExpenseFromDB(newExpense);
    },

    async updateExpense(expense: any): Promise<Expense> {
        const { data, error } = await supabase.from('expenses').update({
            description: expense.description, amount: expense.amount
        }).eq('id', expense.id).select().single();
        if (error) throw error;
        return parseExpenseFromDB(data);
    },

    async deleteExpense(expenseId: string): Promise<void> {
        await supabase.from('expenses').delete().eq('id', expenseId);
    },

    async addPaymentToExpense(expenseId: string, amount: number, date: string): Promise<Expense> {
        await supabase.from('financial_installments').insert({
            expense_id: expenseId, amount, status: InstallmentStatus.PAID, paid_at: date
        });
        const { data } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
        return parseExpenseFromDB(data);
    },

    // --- OTHERS ---
    async getWorkers(workId: string): Promise<Worker[]> {
        const { data } = await supabase.from('workers').select('*').eq('work_id', workId);
        return (data || []).map(parseWorkerFromDB);
    },

    async addWorker(worker: any): Promise<Worker> {
        const { data } = await supabase.from('workers').insert({
            work_id: worker.workId, user_id: worker.userId, name: worker.name, role: worker.role, phone: worker.phone
        }).select().single();
        return parseWorkerFromDB(data);
    },

    async deleteWorker(id: string, workId: string): Promise<void> {
        await supabase.from('workers').delete().eq('id', id);
    },

    async getSuppliers(workId: string): Promise<Supplier[]> {
        const { data } = await supabase.from('suppliers').select('*').eq('work_id', workId);
        return (data || []).map(parseSupplierFromDB);
    },

    async addSupplier(sup: any): Promise<Supplier> {
        const { data } = await supabase.from('suppliers').insert({
            work_id: sup.workId, user_id: sup.userId, name: sup.name, category: sup.category, phone: sup.phone
        }).select().single();
        return parseSupplierFromDB(data);
    },

    async deleteSupplier(id: string, workId: string): Promise<void> {
        await supabase.from('suppliers').delete().eq('id', id);
    },

    async getPhotos(workId: string): Promise<WorkPhoto[]> {
        const { data } = await supabase.from('work_photos').select('*').eq('work_id', workId);
        return (data || []).map(parsePhotoFromDB);
    },

    async addPhoto(photo: any): Promise<WorkPhoto> {
        const { data } = await supabase.from('work_photos').insert({
            work_id: photo.workId, url: photo.url, description: photo.description
        }).select().single();
        return parsePhotoFromDB(data);
    },

    async deletePhoto(id: string): Promise<void> {
        await supabase.from('work_photos').delete().eq('id', id);
    },

    async getFiles(workId: string): Promise<WorkFile[]> {
        const { data } = await supabase.from('work_files').select('*').eq('work_id', workId);
        return (data || []).map(parseFileFromDB);
    },

    async addFile(file: any): Promise<WorkFile> {
        const { data } = await supabase.from('work_files').insert({
            work_id: file.workId, name: file.name, url: file.url, category: file.category
        }).select().single();
        return parseFileFromDB(data);
    },

    async deleteFile(id: string): Promise<void> {
        await supabase.from('work_files').delete().eq('id', id);
    },

    async getContractTemplates() { return CONTRACT_TEMPLATES; },

    async getChecklists(workId: string): Promise<Checklist[]> {
        const { data } = await supabase.from('checklists').select('*').eq('work_id', workId);
        return (data || []).map(parseChecklistFromDB);
    },

    async addChecklist(cl: any): Promise<Checklist> {
        const { data } = await supabase.from('checklists').insert({
            work_id: cl.workId, name: cl.name, category: cl.category, items: cl.items
        }).select().single();
        return parseChecklistFromDB(data);
    },

    async updateChecklist(cl: any): Promise<Checklist> {
        const { data } = await supabase.from('checklists').update({
            name: cl.name, items: cl.items
        }).eq('id', cl.id).select().single();
        return parseChecklistFromDB(data);
    },

    async deleteChecklist(id: string): Promise<void> {
        await supabase.from('checklists').delete().eq('id', id);
    },

    async ensureMaterialsForWork(work: Work, steps: Step[]): Promise<void> {
        const { data } = await supabase.from('materials').select('id').eq('work_id', work.id).limit(1);
        if ((!data || data.length === 0) && steps.length > 0) {
            await this.regenerateMaterials(work, steps);
        }
    },

    async regenerateMaterials(work: Work, createdSteps: Step[]): Promise<void> {
        await supabase.from('materials').delete().eq('work_id', work.id);
        const toInsert: any[] = [];
        for (const step of createdSteps) {
            const cats = getMaterialCategoriesFromStepName(step.name, work);
            for (const cat of cats) {
                const catalog = FULL_MATERIAL_PACKAGES.find(p => p.category === cat);
                if (catalog) {
                    catalog.items.forEach(item => {
                        toInsert.push({
                            work_id: work.id, user_id: work.userId, name: item.name, brand: '',
                            planned_qty: 1, purchased_qty: 0, unit: item.unit, step_id: step.id,
                            category: cat, total_cost: 0
                        });
                    });
                }
            }
        }
        if (toInsert.length > 0) await supabase.from('materials').insert(toInsert);
    },

    async getNotifications(userId: string): Promise<DBNotification[]> {
        const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).eq('read', false);
        return (data || []).map(parseNotificationFromDB);
    },

    async savePushSubscription(userId: string, sub: any): Promise<void> {
        await supabase.from('user_subscriptions').upsert({
            user_id: userId, subscription: sub, endpoint: sub.endpoint, created_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });
    }
};
