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

const parseStepFromDB = (data: any): Step => ({
    id: data.id,
    workId: data.work_id,
    name: data.name,
    startDate: data.start_date,
    endDate: data.end_date,
    realDate: data.real_date || undefined,
    status: data.status,
    isDelayed: data.is_delayed,
    orderIndex: data.order_index
});

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
    if (paidAmount === 0) {
        status = ExpenseStatus.PENDING;
    } else if (paidAmount < totalAgreed) {
        status = ExpenseStatus.PARTIAL;
    } else if (paidAmount === totalAgreed) {
        status = ExpenseStatus.COMPLETED;
    } else {
        status = ExpenseStatus.OVERPAID;
    }

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
    id: data.id,
    userId: data.user_id,
    workId: data.work_id,
    name: data.name,
    role: data.role,
    phone: data.phone,
    dailyRate: Number(data.daily_rate || 0),
    notes: data.notes
});

const parseSupplierFromDB = (data: any): Supplier => ({
    id: data.id,
    userId: data.user_id,
    workId: data.work_id,
    name: data.name,
    category: data.category,
    phone: data.phone,
    email: data.email,
    address: data.address,
    notes: data.notes
});

const parsePhotoFromDB = (data: any): WorkPhoto => ({
    id: data.id,
    workId: data.work_id,
    url: data.url,
    description: data.description,
    date: data.date,
    type: data.type
});

const parseFileFromDB = (data: any): WorkFile => ({
    id: data.id,
    workId: data.work_id,
    name: data.name,
    category: data.category,
    url: data.url,
    type: data.type,
    date: data.date
});

const parseNotificationFromDB = (data: any): DBNotification => ({
    id: data.id,
    userId: data.user_id,
    workId: data.work_id,
    title: data.title,
    message: data.message,
    date: data.date,
    read: data.read,
    type: data.type,
    tag: data.tag
});

const mapPushSubscriptionFromDB = (data: any): PushSubscriptionInfo => ({
  id: data.id,
  userId: data.user_id,
  subscription: data.subscription,
  endpoint: data.endpoint,
});

const parseContractFromDB = (data: any): Contract => ({
    id: data.id,
    title: data.title,
    category: data.category,
    contentTemplate: data.content_template,
});

const parseChecklistItemFromDB = (data: any): ChecklistItem => ({
    id: data.id,
    text: data.text,
    checked: data.checked,
});

const parseChecklistFromDB = (data: any): Checklist => ({
    id: data.id,
    workId: data.work_id,
    name: data.name,
    category: data.category,
    items: data.items ? data.items.map(parseChecklistItemFromDB) : [],
});

const parseFinancialHistoryFromDB = (data: any): FinancialHistoryEntry => ({
  id: data.id,
  expenseId: data.expense_id || undefined,
  workId: data.work_id,
  userId: data.user_id,
  timestamp: data.timestamp,
  action: data.action,
  field: data.field || undefined,
  oldValue: data.old_value,
  newValue: data.new_value,
  description: data.description,
});

const getMaterialCategoriesFromStepName = (stepName: string, work: Work): string[] => {
  const categories: string[] = [];
  const numBathrooms = work.bathrooms || 0;
  const numKitchens = work.kitchens || 0;

  if (stepName.includes('Limpeza do Terreno')) categories.push('Limpeza do Terreno e Gabarito');
  if (stepName.includes('Fundações')) categories.push('Fundações');
  if (stepName.includes('Estrutura')) categories.push('Estrutura e Lajes');
  if (stepName.includes('Alvenaria')) categories.push('Alvenaria e Vedação');
  if (stepName.includes('Cobertura')) categories.push('Cobertura e Telhado');
  if (stepName.includes('Reboco')) categories.push('Reboco e Regularização');
  if (stepName.includes('Impermeabilização Principal')) categories.push('Impermeabilização Principal');
  if (stepName.includes('Gesso')) categories.push('Gesso e Forros');
  if (stepName.includes('Pisos')) categories.push('Pisos e Revestimentos');
  if (stepName.includes('Esquadrias')) categories.push('Esquadrias (Portas e Janelas)');
  if (stepName.includes('Bancadas')) categories.push('Bancadas e Marmoraria');
  if (stepName.includes('Pintura')) categories.push('Pintura Interna e Externa');
  if (stepName.includes('Louças')) categories.push('Louças e Metais Finais');
  if (stepName.includes('Luminotécnica')) categories.push('Luminotécnica');
  if (stepName.includes('Limpeza Final')) categories.push('Limpeza Final e Entrega');
  
  if (stepName.includes('Instalações Hidráulicas') || stepName.includes('Revisão Hidráulica')) {
    if (numBathrooms > 0) categories.push('Hidráulica de Banheiro');
    if (numKitchens > 0) categories.push('Hidráulica de Cozinha');
  }
  
  return Array.from(new Set(categories));
};

let sessionCache: { promise: Promise<User | null>, timestamp: number } | null = null;
const AUTH_CACHE_DURATION = 5000;
const pendingProfileRequests: Partial<Record<string, Promise<User | null>>> = {};

const ensureUserProfile = async (authUser: any): Promise<User | null> => {
    if (!authUser) return null;
    const pending = pendingProfileRequests[authUser.id];
    if (pending) return pending;

    const fetchProfileProcess = async (): Promise<User | null> => {
        try {
            const { data: existingProfile, error: readError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();

            if (existingProfile) return mapProfileFromSupabase(existingProfile);
            if (readError && readError.code === '42501') return null;

            const newProfileData = {
                id: authUser.id,
                name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Novo Usuário',
                email: authUser.email,
                whatsapp: null,
                cpf: null,
                plan: null,
                is_trial: false,
                subscription_expires_at: null
            };

            const { data: createdProfile, error: createError } = await supabase
                .from('profiles')
                .insert(newProfileData)
                .select()
                .single();

            if (createError) return null;
            return mapProfileFromSupabase(createdProfile);
        } catch (e) {
            return null;
        }
    };

    const promise = fetchProfileProcess();
    pendingProfileRequests[authUser.id] = promise;
    promise.finally(() => { delete pendingProfileRequests[authUser.id]; });
    return promise;
};

const _addFinancialHistoryEntry = async (entry: Omit<FinancialHistoryEntry, 'id' | 'timestamp'>) => {
  try {
    await supabase.from('financial_history').insert({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
  }
};

export const dbService = {
  async getCurrentUser(): Promise<User | null> {
    const now = Date.now();
    if (sessionCache !== null && (now - sessionCache.timestamp < AUTH_CACHE_DURATION)) {
        return sessionCache.promise;
    }
    const newPromise = (async (): Promise<User | null> => {
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.user) return null;
        return await ensureUserProfile(data.session.user);
    })();
    sessionCache = { promise: newPromise, timestamp: now };
    return newPromise;
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
        _dashboardCache.works = null;
        callback(null);
      }
    });
    return () => subscription.unsubscribe();
  },

  async login(email: string, password?: string): Promise<User | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || '' });
    if (error) throw error;
    sessionCache = null;
    return await ensureUserProfile(data.user);
  },

  async loginSocial(provider: 'google') {
    return await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  },

  async signup(name: string, email: string, whatsapp: string, password?: string, cpf?: string): Promise<User | null> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: password || '123456',
        options: { data: { name } }
    });
    if (authError) throw authError;
    sessionCache = null;
    return await ensureUserProfile(authData.user);
  },

  async logout() {
    await supabase.auth.signOut();
    sessionCache = null;
    _dashboardCache.works = null;
  },

  async getWorks(userId: string): Promise<Work[]> {
    const now = Date.now();
    if (_dashboardCache.works && (now - _dashboardCache.works.timestamp < CACHE_TTL)) {
        return _dashboardCache.works.data;
    }
    const { data, error } = await supabase.from('works').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return [];
    const parsed = (data || []).map(parseWorkFromDB);
    _dashboardCache.works = { data: parsed, timestamp: now };
    return parsed;
  },

  async getWorkById(workId: string): Promise<Work | null> {
    const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
    if (error) return null;
    return data ? parseWorkFromDB(data) : null;
  },

  async ensureMaterialsForWork(work: Work, steps: Step[]): Promise<void> {
    const { data } = await supabase.from('materials').select('id').eq('work_id', work.id).limit(1);
    if ((!data || data.length === 0) && steps.length > 0) {
        await this.regenerateMaterials(work, steps);
    }
  },

  async regenerateMaterials(work: Work, createdSteps: Step[]): Promise<void> {
    await supabase.from('materials').delete().eq('work_id', work.id);
    const materialsToInsert: any[] = [];
    for (const step of createdSteps) {
        const materialCategories = getMaterialCategoriesFromStepName(step.name, work);
        for (const catName of materialCategories) {
            const catalog = FULL_MATERIAL_PACKAGES.find(p => p.category === catName);
            if (catalog) {
                for (const item of catalog.items) {
                    let calculatedQty = item.flat_qty || (work.area * (item.multiplier || 0));
                    if (calculatedQty > 0) {
                        materialsToInsert.push({
                            work_id: work.id, user_id: work.userId, name: item.name, brand: item.brand || '',
                            planned_qty: Math.ceil(calculatedQty), purchased_qty: 0, unit: item.unit,
                            step_id: step.id, category: catName, total_cost: 0
                        });
                    }
                }
            }
        }
    }
    if (materialsToInsert.length > 0) await supabase.from('materials').insert(materialsToInsert);
  },

  async createWork(workData: Partial<Work>, templateId: string): Promise<Work> {
    const { data: savedWork, error } = await supabase.from('works').insert({
        user_id: workData.userId, name: workData.name, address: workData.address,
        budget_planned: workData.budgetPlanned, start_date: workData.startDate,
        area: workData.area, floors: workData.floors, bedrooms: workData.bedrooms,
        bathrooms: workData.bathrooms, kitchens: workData.kitchens,
    }).select().single();
    if (error) throw error;
    const parsedWork = parseWorkFromDB(savedWork);
    const template = WORK_TEMPLATES.find(t => t.id === templateId);
    if (template) {
        const stepsToInsert = template.includedSteps.map((name, index) => ({
            work_id: parsedWork.id, name, start_date: parsedWork.startDate,
            end_date: parsedWork.startDate, status: StepStatus.NOT_STARTED, order_index: index + 1
        }));
        const { data: createdSteps } = await supabase.from('steps').insert(stepsToInsert).select();
        if (createdSteps) await this.regenerateMaterials(parsedWork, createdSteps.map(parseStepFromDB));
    }
    return parsedWork;
  },

  async getSteps(workId: string): Promise<Step[]> {
    const { data, error } = await supabase.from('steps').select('*').eq('work_id', workId).order('order_index', { ascending: true });
    return error ? [] : (data || []).map(parseStepFromDB);
  },

  async addStep(step: Omit<Step, 'id' | 'isDelayed' | 'orderIndex'>): Promise<Step> {
    const { data } = await supabase.from('steps').insert({
        work_id: step.workId, name: step.name, start_date: step.startDate,
        end_date: step.endDate, status: StepStatus.NOT_STARTED
    }).select().single();
    return parseStepFromDB(data);
  },

  async updateStep(step: Step): Promise<Step> {
    const { data, error } = await supabase.from('steps').update({
        name: step.name, start_date: step.startDate, end_date: step.endDate,
        status: step.status, is_delayed: step.isDelayed
    }).eq('id', step.id).select().single();
    if (error) throw error;
    return parseStepFromDB(data);
  },

  async deleteStep(stepId: string, workId: string): Promise<void> {
    await supabase.from('steps').delete().eq('id', stepId);
  },

  async getMaterials(workId: string): Promise<Material[]> {
    const { data, error } = await supabase.from('materials').select('*').eq('work_id', workId);
    return error ? [] : (data || []).map(parseMaterialFromDB);
  },

  async addMaterial(userId: string, material: Omit<Material, 'id' | 'userId' | 'totalCost'>): Promise<Material> {
    const { data, error } = await supabase.from('materials').insert({
        work_id: material.workId, user_id: userId, name: material.name,
        planned_qty: material.plannedQty, purchased_qty: 0, unit: material.unit
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

  async registerMaterialPurchase(materialId: string, materialName: string, materialBrand: string | undefined, plannedQty: number, unit: string, purchasedQtyDelta: number, cost: number): Promise<Material> {
    const { data: current } = await supabase.from('materials').select('*').eq('id', materialId).single();
    const { data, error } = await supabase.from('materials').update({
        purchased_qty: current.purchased_qty + purchasedQtyDelta,
        total_cost: current.total_cost + cost
    }).eq('id', materialId).select().single();
    if (error) throw error;
    await this.addExpense({
        workId: current.work_id, description: `Compra ${materialName}`,
        amount: cost, quantity: purchasedQtyDelta, date: new Date().toISOString().split('T')[0],
        category: ExpenseCategory.MATERIAL, relatedMaterialId: materialId
    });
    return parseMaterialFromDB(data);
  },

  async getExpenses(workId: string): Promise<Expense[]> {
    const { data, error } = await supabase.from('expenses').select('*, financial_installments(amount, status)').eq('work_id', workId);
    if (error) return [];
    return data.map((dbExpense: any) => {
        const installments = dbExpense.financial_installments || [];
        const paidAmount = installments.filter((i: any) => i.status === InstallmentStatus.PAID).reduce((s: number, i: any) => s + Number(i.amount), 0);
        return { ...parseExpenseFromDB(dbExpense), paidAmount };
    });
  },

  async addExpense(expense: Omit<Expense, 'id' | 'paidAmount' | 'status'>): Promise<Expense> {
    const { data: newExpense, error } = await supabase.from('expenses').insert({
        work_id: expense.workId, description: expense.description, amount: expense.amount,
        category: expense.category, date: expense.date, related_material_id: expense.relatedMaterialId
    }).select().single();
    if (error) throw error;
    await supabase.from('financial_installments').insert({
        expense_id: newExpense.id, amount: expense.amount, status: InstallmentStatus.PENDING
    });
    return parseExpenseFromDB(newExpense);
  },

  async updateExpense(expense: Expense): Promise<Expense> {
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
        expense_id: expenseId, amount, paid_at: date, status: InstallmentStatus.PAID
    });
    const { data } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
    return parseExpenseFromDB(data);
  },

  async getWorkers(workId: string): Promise<Worker[]> {
    const { data } = await supabase.from('workers').select('*').eq('work_id', workId);
    return (data || []).map(parseWorkerFromDB);
  },

  async addWorker(worker: Omit<Worker, 'id'>): Promise<Worker> {
    const { data } = await supabase.from('workers').insert({
        work_id: worker.workId, user_id: worker.userId, name: worker.name, role: worker.role, phone: worker.phone
    }).select().single();
    return parseWorkerFromDB(data);
  },

  async updateWorker(worker: Worker): Promise<Worker> {
    const { data } = await supabase.from('workers').update({ name: worker.name, role: worker.role }).eq('id', worker.id).select().single();
    return parseWorkerFromDB(data);
  },

  async deleteWorker(workerId: string, workId: string): Promise<void> {
    await supabase.from('workers').delete().eq('id', workerId);
  },

  async getSuppliers(workId: string): Promise<Supplier[]> {
    const { data } = await supabase.from('suppliers').select('*').eq('work_id', workId);
    return (data || []).map(parseSupplierFromDB);
  },

  async addSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    const { data } = await supabase.from('suppliers').insert({
        work_id: supplier.workId, user_id: supplier.userId, name: supplier.name, category: supplier.category
    }).select().single();
    return parseSupplierFromDB(data);
  },

  async updateSupplier(supplier: Supplier): Promise<Supplier> {
    const { data } = await supabase.from('suppliers').update({ name: supplier.name }).eq('id', supplier.id).select().single();
    return parseSupplierFromDB(data);
  },

  async deleteSupplier(supplierId: string, workId: string): Promise<void> {
    await supabase.from('suppliers').delete().eq('id', supplierId);
  },

  async getPhotos(workId: string): Promise<WorkPhoto[]> {
    const { data } = await supabase.from('work_photos').select('*').eq('work_id', workId);
    return (data || []).map(parsePhotoFromDB);
  },

  async addPhoto(photo: Omit<WorkPhoto, 'id'>): Promise<WorkPhoto> {
    const { data } = await supabase.from('work_photos').insert({
        work_id: photo.workId, url: photo.url, description: photo.description, date: photo.date, type: photo.type
    }).select().single();
    return parsePhotoFromDB(data);
  },

  async deletePhoto(photoId: string): Promise<void> {
    await supabase.from('work_photos').delete().eq('id', photoId);
  },

  async getFiles(workId: string): Promise<WorkFile[]> {
    const { data } = await supabase.from('work_files').select('*').eq('work_id', workId);
    return (data || []).map(parseFileFromDB);
  },

  async addFile(file: Omit<WorkFile, 'id'>): Promise<WorkFile> {
    const { data } = await supabase.from('work_files').insert({
        work_id: file.workId, name: file.name, category: file.category, url: file.url, type: file.type, date: file.date
    }).select().single();
    return parseFileFromDB(data);
  },

  async deleteFile(fileId: string): Promise<void> {
    await supabase.from('work_files').delete().eq('id', fileId);
  },

  async getContractTemplates(): Promise<Contract[]> {
    return CONTRACT_TEMPLATES;
  },

  async getChecklists(workId: string): Promise<Checklist[]> {
    const { data } = await supabase.from('checklists').select('*').eq('work_id', workId);
    return (data || []).map(parseChecklistFromDB);
  },

  async addChecklist(checklist: Omit<Checklist, 'id'>): Promise<Checklist> {
    const { data } = await supabase.from('checklists').insert({
        work_id: checklist.workId, name: checklist.name, category: checklist.category, items: checklist.items
    }).select().single();
    return parseChecklistFromDB(data);
  },

  async updateChecklist(checklist: Checklist): Promise<Checklist> {
    const { data } = await supabase.from('checklists').update({ name: checklist.name, items: checklist.items }).eq('id', checklist.id).select().single();
    return parseChecklistFromDB(data);
  },

  async deleteChecklist(checklistId: string): Promise<void> {
    await supabase.from('checklists').delete().eq('id', checklistId);
  },

  async getNotifications(userId: string): Promise<DBNotification[]> {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).eq('read', false);
    return (data || []).map(parseNotificationFromDB);
  },

  async savePushSubscription(userId: string, subscription: any): Promise<void> {
    await supabase.from('user_subscriptions').upsert({
        user_id: userId, subscription, endpoint: subscription.endpoint, created_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });
  }
};
