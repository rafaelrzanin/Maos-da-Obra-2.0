

import { PlanType, ExpenseCategory, StepStatus, FileCategory, type User, type Work, type Step, type Material, type Expense, type Worker, type Supplier, type WorkPhoto, type WorkFile, type DBNotification, type PushSubscriptionInfo, type Contract, type Checklist, type ChecklistItem, type FinancialHistoryEntry, InstallmentStatus, ExpenseStatus } from '../types.ts';
import { WORK_TEMPLATES, FULL_MATERIAL_PACKAGES, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from './standards.ts';
import { supabase } from './supabase.ts';

// --- CACHE SYSTEM (IN-MEMORY) ---
const CACHE_TTL = 60000; // Aumentado para 60s para maior estabilidade
const _dashboardCache: {
    works: { data: Work[], timestamp: number } | null;
    stats: Record<string, { data: any, timestamp: number }>;
    summary: Record<string, { data: any, timestamp: number }>;
    notifications: { data: DBNotification[], timestamp: number } | null;
    // NEW: Caching for steps and materials per workId
    steps: Record<string, { data: Step[], timestamp: number }>;
    materials: Record<string, { data: Material[], timestamp: number }>;
    // NEW: Caching for expenses per workId
    expenses: Record<string, { data: Expense[], timestamp: number }>;
    // NEW: Caching for other related entities
    workers: Record<string, { data: Worker[], timestamp: number }>;
    suppliers: Record<string, { data: Supplier[], timestamp: number }>;
    photos: Record<string, { data: WorkPhoto[], timestamp: number }>;
    files: Record<string, { data: WorkFile[], timestamp: number }>;
    contracts: { data: Contract[], timestamp: number } | null; // Contracts are global
    checklists: Record<string, { data: Checklist[], timestamp: number }>;
    // NEW: Cache for push subscriptions
    pushSubscriptions: Record<string, { data: PushSubscriptionInfo[], timestamp: number }>;
    // NEW: Cache for financial history (not exposed in UI, but good for internal consistency)
    financialHistory: Record<string, { data: FinancialHistoryEntry[], timestamp: number }>;
} = {
    works: null,
    stats: {},
    summary: {},
    notifications: null,
    steps: {}, // Initialize new cache
    materials: {}, // Initialize new cache
    expenses: {}, // NEW: Initialize new cache
    workers: {}, // NEW
    suppliers: {}, // NEW
    photos: {}, // NEW
    files: {}, // NEW
    contracts: null, // NEW
    checklists: {}, // NEW
    pushSubscriptions: {}, // NEW
    financialHistory: {}, // NEW
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
    livingRooms: Number(data.living_rooms || 0), // Corrected to livingRooms
    hasLeisureArea: data.has_leisure_area || false
});

// NEW: Centralized function to calculate StepStatus
const _calculateStepStatus = (dbStep: any): StepStatus => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to local midnight

    // If real_date is set, it's completed
    if (dbStep.real_date) {
        return StepStatus.COMPLETED;
    }
    // If start_date is not set, it's not started
    if (!dbStep.start_date) {
        return StepStatus.NOT_STARTED;
    }

    const stepEndDate = new Date(dbStep.end_date);
    stepEndDate.setHours(0, 0, 0, 0); // Normalize to local midnight

    // If start_date is set but not completed:
    // If today is past the planned end_date, it's delayed
    if (today.getTime() > stepEndDate.getTime()) {
        return StepStatus.DELAYED;
    }
    // Otherwise, it's in progress
    return StepStatus.IN_PROGRESS;
};

const parseStepFromDB = (data: any): Step => {
    // 🔥 CRITICAL: Removed parsing of `status` and `is_delayed` as they are now derived
    const parsedStep: Step = {
        id: data.id,
        workId: data.work_id,
        name: data.name,
        startDate: data.start_date,
        endDate: data.end_date,
        realDate: data.real_date || undefined,
        // status is assigned by _calculateStepStatus after parsing
        status: StepStatus.NOT_STARTED, // Placeholder, will be overwritten by _calculateStepStatus
        // isDelayed: data.is_delayed, // REMOVED
        orderIndex: data.order_index, // NEW: Parse order_index
        estimatedDurationDays: data.estimated_duration_days || undefined, // NEW: Parse estimated_duration_days
    };
    parsedStep.status = _calculateStepStatus(data); // Assign the derived status
    return parsedStep;
};

const parseMaterialFromDB = (data: any): Material => ({
    id: data.id,
    workId: data.work_id,
    userId: data.user_id, // NEW: Parse userId from DB
    name: data.name,
    brand: data.brand,
    plannedQty: Number(data.planned_qty || 0),
    purchasedQty: Number(data.purchased_qty || 0),
    unit: data.unit,
    stepId: data.step_id,
    category: data.category,
    totalCost: Number(data.total_cost || 0) // NEW: Parse total_cost
});

// MODIFICADO: parseExpenseFromDB agora calcula paidAmount e status dinamicamente
const parseExpenseFromDB = (data: any): Expense => {
    // data pode incluir `paid_amount_sum` e `installment_count` do JOIN SQL
    const paidAmount = Number(data.paid_amount_sum || 0);
    const totalAgreed = data.total_agreed ? Number(data.total_agreed) : Number(data.amount || 0);

    let status: ExpenseStatus;
    if (paidAmount === 0) {
        status = ExpenseStatus.PENDING;
    } else if (paidAmount < totalAgreed) {
        status = ExpenseStatus.PARTIAL;
    } else if (paidAmount === totalAgreed) {
        status = ExpenseStatus.COMPLETED;
    } else { // paidAmount > totalAgreed
        status = ExpenseStatus.OVERPAID;
    }

    return {
        id: data.id,
        workId: data.work_id,
        description: data.description,
        amount: Number(data.amount || 0),
        paidAmount: paidAmount, // Derivado
        quantity: Number(data.quantity || 0),
        date: data.date,
        category: data.category,
        relatedMaterialId: data.related_material_id,
        stepId: data.step_id,
        workerId: data.worker_id,
        supplierId: data.supplier_id,
        totalAgreed: data.total_agreed ? Number(data.total_agreed) : undefined,
        status: status, // Derivado
    };
};

// NEW: Parser for Worker
const parseWorkerFromDB = (data: any): Worker => ({
    id: data.id,
    userId: data.user_id,
    workId: data.work_id, // NEW: Parse work_id
    name: data.name,
    role: data.role,
    phone: data.phone,
    dailyRate: Number(data.daily_rate || 0), // Added dailyRate parsing
    notes: data.notes
});

// NEW: Parser for Supplier
const parseSupplierFromDB = (data: any): Supplier => ({
    id: data.id,
    userId: data.user_id,
    workId: data.work_id, // NEW: Parse work_id
    name: data.name,
    category: data.category,
    phone: data.phone,
    email: data.email, // Added email parsing
    address: data.address, // Added address parsing
    notes: data.notes
});

// NEW: Parser for WorkPhoto
const parsePhotoFromDB = (data: any): WorkPhoto => ({
    id: data.id,
    workId: data.work_id,
    url: data.url,
    description: data.description,
    date: data.date,
    type: data.type
});

// NEW: Parser for WorkFile
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
    workId: data.work_id, // NEW: Parse work_id
    title: data.title,
    message: data.message,
    date: data.date,
    read: data.read,
    type: data.type,
    tag: data.tag // NEW: Parse the tag from DB
});

const mapPushSubscriptionFromDB = (data: any): PushSubscriptionInfo => ({
  id: data.id,
  userId: data.user_id,
  subscription: data.subscription,
  endpoint: data.endpoint,
});

// NEW: Parser for Contract
const parseContractFromDB = (data: any): Contract => ({
    id: data.id,
    title: data.title,
    category: data.category,
    contentTemplate: data.content_template,
});

// NEW: Parser for Checklist and ChecklistItem
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
    items: data.items ? data.items.map(parseChecklistItemFromDB) : [], // items is a JSONB column
});

// NEW: Parser for FinancialHistoryEntry
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


// NEW: Helper para mapear nomes de etapas generalizadas para categorias de materiais específicas
// Esta função agora retorna um ARRAY de categorias de materiais relevantes
const getMaterialCategoriesFromStepName = (stepName: string, work: Work): string[] => {
  const categories: string[] = [];
  const numBathrooms = work.bathrooms || 0;
  const numKitchens = work.kitchens || 0;

  // Mapeamento para etapas generalizadas de CONSTRUCAO e REFORMA_APTO
  if (stepName.includes('Limpeza do Terreno e Gabarito')) categories.push('Limpeza do Terreno e Gabarito');
  if (stepName.includes('Fundações')) categories.push('Fundações');
  if (stepName.includes('Estrutura e Lajes')) categories.push('Estrutura e Lajes');
  if (stepName.includes('Alvenaria e Vedação')) categories.push('Alvenaria e Vedação');
  if (stepName.includes('Cobertura e Telhado')) categories.push('Cobertura e Telhado');
  if (stepName.includes('Reboco e Regularização')) categories.push('Reboco e Regularização');
  if (stepName.includes('Impermeabilização Principal')) categories.push('Impermeabilização Principal');
  if (stepName.includes('Gesso e Forros')) categories.push('Gesso e Forros');
  if (stepName.includes('Pisos e Revestimentos')) categories.push('Pisos e Revestimentos');
  if (stepName.includes('Esquadrias (Portas e Janelas)')) categories.push('Esquadrias (Portas e Janelas)');
  if (stepName.includes('Bancadas e Marmoraria')) categories.push('Bancadas e Marmoraria');
  if (stepName.includes('Pintura Interna e Externa')) categories.push('Pintura Interna e Externa');
  if (stepName.includes('Louças e Metais Finais')) categories.push('Louças e Metais Finais');
  if (stepName.includes('Luminotécnica')) categories.push('Luminotécnica');
  if (stepName.includes('Limpeza Final e Entrega')) categories.push('Limpeza Final e Entrega');
  
  // Mapeamento para etapas generalizadas de REFORMA_APTO
  if (stepName.includes('Demolição e Retirada de Entulho') && !stepName.includes('(Banheiro)') && !stepName.includes('(Cozinha)')) categories.push('Demolição e Retirada de Entulho'); // Genérica para reforma geral
  if (stepName.includes('Revisão Hidráulica e Esgoto') && !stepName.includes('(Banheiro)') && !stepName.includes('(Cozinha)')) categories.push('Revisão Hidráulica e Esgoto'); // Genérica para reforma geral
  if (stepName.includes('Revisão Elétrica e Lógica') && !stepName.includes('(Banheiro)') && !stepName.includes('(Cozinha)')) categories.push('Revisão Elétrica e Lógica'); // Genérica para reforma geral
  if (stepName.includes('Regularização de Contrapisos')) categories.push('Regularização de Contrapisos');
  if (stepName.includes('Impermeabilização') && !stepName.includes('(Banheiro)')) categories.push('Impermeabilização'); // Categoria genérica para reforma


  // Lógica para inferir categorias específicas de cômodos a partir de etapas generalizadas ou específicas
  // Para Instalações Hidráulicas/Revisão Hidráulica
  if (stepName.includes('Instalações Hidráulicas') || stepName.includes('Revisão Hidráulica') || stepName.includes('Hidráulica de Banheiro')) {
    if (numBathrooms > 0) categories.push('Hidráulica de Banheiro');
    if (numKitchens > 0) categories.push('Hidráulica de Cozinha');
  }
  // Para Instalações Elétricas/Revisão Elétrica
  if (stepName.includes('Instalações Elétricas') || stepName.includes('Revisão Elétrica') || stepName.includes('Elétrica de Banheiro')) {
    if (numBathrooms > 0) categories.push('Elétrica de Banheiro');
    if (numKitchens > 0) categories.push('Elétrica de Cozinha');
  }
  // Para Pisos e Revestimentos
  if (stepName.includes('Pisos e Revestimentos')) { // Isso abrange tanto o genérico quanto o específico de cômodos
    if (numBathrooms > 0) categories.push('Pisos e Revestimentos de Banheiro');
    if (numKitchens > 0) categories.push('Pisos e Revestimentos de Cozinha');
  }
  // Para Gesso e Forros
  if (stepName.includes('Gesso e Forros')) { 
    if (numBathrooms > 0) categories.push('Gesso e Forro de Banheiro'); // Ex: gesso hidrofugado para banheiro
  }
  // Para Bancadas e Marmoraria
  if (stepName.includes('Bancadas e Marmoraria')) {
    if (numBathrooms > 0) categories.push('Bancada de Banheiro');
    if (numKitchens > 0) categories.push('Bancada de Cozinha');
  }
  // Para Louças e Metais Finais
  if (stepName.includes('Louças e Metais Finais')) {
    if (numBathrooms > 0) categories.push('Louças e Metais de Banheiro');
    if (numKitchens > 0) categories.push('Louças e Metais de Cozinha');
  }

  // Mapeamento para etapas específicas de projetos (Banheiro, Cozinha, Pintura) que não foram pegas acima
  if (stepName === 'Demolição e Retirada de Entulho (Banheiro)') categories.push('Demolição e Retirada de Entulho (Banheiro)');
  if (stepName === 'Impermeabilização de Banheiro') categories.push('Impermeabilização de Banheiro');
  if (stepName === 'Contrapiso de Banheiro') categories.push('Contrapiso de Banheiro');
  if (stepName === 'Limpeza Final e Entrega (Banheiro)') categories.push('Limpeza Final e Entrega'); // Mapeia para categoria genérica de limpeza

  if (stepName === 'Demolição e Retirada de Entulho (Cozinha)') categories.push('Demolição e Retirada de Entulho (Cozinha)');
  if (stepName === 'Limpeza Final e Entrega (Cozinha)') categories.push('Limpeza Final e Entrega'); // Mapeia para categoria genérica de limpeza

  if (stepName === 'Proteção e Preparação (Pintura)') categories.push('Proteção e Preparação (Pintura)');
  if (stepName === 'Lixamento e Massa (Pintura)') categories.push('Lixamento e Massa (Pintura)');
  if (stepName === 'Pintura Paredes e Tetos') categories.push('Pintura Paredes e Tetos');
  if (stepName === 'Limpeza Final e Entrega (Pintura)') categories.push('Limpeza Final e Entrega'); // Mapeia para categoria genérica de limpeza
  
  // Filtrar categorias duplicadas e garantir que 'Limpeza Final e Entrega' genérica seja a única se houver sobreposição
  return Array.from(new Set(categories));
};


// --- AUTH CACHE & DEDUPLICATION ---
let sessionCache: { promise: Promise<User | null>, timestamp: number } | null = null;
const AUTH_CACHE_DURATION = 5000;
const pendingProfileRequests: Partial<Record<string, Promise<User | null>>> = {};

const ensureUserProfile = async (authUser: any): Promise<User | null> => {
    const client = supabase; // Supabase is guaranteed to be initialized now
    if (!authUser) {
        console.log("[ensureUserProfile] authUser é nulo, retornando null.");
        return null;
    }

    console.log(`[ensureUserProfile] Processando usuário autenticado: ${authUser.id} (${authUser.email})`);

    const pending = pendingProfileRequests[authUser.id];
    if (pending) {
        console.log(`[ensureUserProfile] Requisição de perfil para ${authUser.id} já em andamento, retornando promessa existente.`);
        return pending;
    }


    const fetchProfileProcess = async (): Promise<User | null> => {
        try {
            console.log(`[ensureUserProfile] Buscando perfil existente para ${authUser.id}...`);
            const { data: existingProfile, error: readError } = await client
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();

            if (existingProfile) {
                console.log(`[ensureUserProfile] Perfil encontrado para ${authUser.id}.`);
                return mapProfileFromSupabase(existingProfile);
            }

            // If RLS denies access (42501), return null instead of a partial user.
            if (readError) {
                console.error(`[ensureUserProfile] Erro ao buscar perfil para ${authUser.id}:`, readError);
                if (readError.code === '42501') { 
                     console.error("[ensureUserProfile] ERRO CRÍTICO 403: Permissão RLS negada ao ler perfil. Retornando null para evitar loops de login.");
                     return null;
                }
                // Para outros erros de leitura, logar e continuar para tentar criar o perfil
                console.warn("[ensureUserProfile] Outro erro na leitura do perfil, tentando criar novo perfil...");
            } else {
                console.log(`[ensureUserProfile] Nenhum perfil existente encontrado para ${authUser.id}. Criando um novo...`);
            }

            // CRITICAL: NEW PROFILE CREATION MUST BE PLAN-AGNOSTIC
            const newProfileData = {
                id: authUser.id,
                name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Novo Usuário',
                email: authUser.email,
                whatsapp: null, 
                cpf: null, 
                plan: null, // Set to null initially
                is_trial: false, // No trial by default on registration
                subscription_expires_at: null // No expiration by default on registration
            };

            const { data: createdProfile, error: createError } = await client
                .from('profiles')
                .insert(newProfileData)
                .select()
                .single();

            if (createError) {
                console.error(`[ensureUserProfile] Erro ao criar perfil para ${authUser.id}:`, createError);
                // On creation error, return null to signify profile couldn't be established.
                return null;
            }

            console.log(`[ensureUserProfile] Perfil criado com sucesso para ${authUser.id}.`);
            return mapProfileFromSupabase(createdProfile);

        } catch (e: any) {
            console.error(`[ensureUserProfile] Exceção inesperada ao processar perfil para ${authUser.id}:`, e);
            // On any unexpected exception, ensure null is returned.
            return null;
        }
    };

    const promise = fetchProfileProcess();
    pendingProfileRequests[authUser.id] = promise;

    promise.finally(() => {
        delete pendingProfileRequests[authUser.id];
    });

    return promise;
};

// NEW: Helper function for adding financial history entries
const _addFinancialHistoryEntry = async (entry: Omit<FinancialHistoryEntry, 'id' | 'timestamp'>) => {
  try {
    const { error } = await supabase.from('financial_history').insert({
      ...entry,
      timestamp: new Date().toISOString(), // Automatically set timestamp
    });
    if (error) {
      console.error("Erro ao registrar histórico financeiro:", error);
      // It's critical to log this, but not necessarily throw an error that blocks the main operation.
    } else {
      // Invalidate specific cache for financial history if needed, but not exposed in UI.
      // delete _dashboardCache.financialHistory[entry.workId]; 
    }
  } catch (e) {
    console.error("Exceção ao tentar registrar histórico financeiro:", e);
  }
};


export const dbService = {
  // --- AUTH ---
  async getCurrentUser(): Promise<User | null> {
    const client = supabase;
    
    const now = Date.now();
    
    const currentSessionCache = sessionCache; 

    if (currentSessionCache !== null && (now - currentSessionCache.timestamp < AUTH_CACHE_DURATION)) {
        return currentSessionCache.promise;
    }

    // If no valid cache, create a new promise
    const newPromise = (async (): Promise<User | null> => {
        const { data, error: sessionError } = await client.auth.getSession();
        const session = data?.session;
        if (!session?.user) {
            sessionCache = null; 
            return null;
        }
        // Ensure profile for the user
        return await ensureUserProfile(session.user);
    })();
    
    // Store the new promise and its timestamp
    sessionCache = { promise: newPromise, timestamp: now };
    return newPromise;
  },

  async syncSession(): Promise<User | null> { // Explicitly set return type
    sessionCache = null; // Invalidate cache to force a fresh fetch
    const userPromise = this.getCurrentUser();
    return userPromise; 
  },

  onAuthChange(callback: (user: User | null) => void) {
    const client = supabase; // Supabase is guaranteed to be initialized now
    
    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, session) => {
      sessionCache = null; // Clear cache on auth state change
        
      if (session?.user) {
        const user = await ensureUserProfile(session.user);
        callback(user);
      } else {
        // Limpa cache ao deslogar
        _dashboardCache.works = null;
        _dashboardCache.stats = {};
        _dashboardCache.summary = {};
        _dashboardCache.notifications = null;
        _dashboardCache.steps = {}; // NEW: Clear steps cache on logout
        _dashboardCache.materials = {}; // NEW: Clear materials cache on logout
        _dashboardCache.expenses = {}; // NEW: Clear expenses cache on logout
        _dashboardCache.workers = {}; // NEW
        _dashboardCache.suppliers = {}; // NEW
        _dashboardCache.photos = {}; // NEW
        _dashboardCache.files = {}; // NEW
        _dashboardCache.contracts = null; // NEW
        _dashboardCache.checklists = {}; // NEW
        _dashboardCache.pushSubscriptions = {}; // NEW: Clear push subscriptions cache on logout
        _dashboardCache.financialHistory = {}; // NEW: Clear financial history cache
        callback(null);
      }
    });
    return () => subscription.unsubscribe();
  },

  async login(email: string, password?: string): Promise<User | null> { // Explicitly set return type
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || '' });
    if (error) throw error;
    if (data.user) {
        sessionCache = null; // Invalidate cache
        return await ensureUserProfile(data.user);
    }
    return null;
  },

  async loginSocial(provider: 'google') {
    // Supabase is guaranteed to be initialized now
    return await supabase.auth.signInWithOAuth({ 
        provider,
        options: {
            redirectTo: window.location.origin 
        }
    });
  },

  async signup(name: string, email: string, whatsapp: string, password?: string, cpf?: string): Promise<User | null> { // REMOVED planType parameter
    // Supabase is guaranteed to be initialized now
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: password || '123456',
        options: {
            data: { name }
        }
    );

    if (authError) throw authError;
    // If user already exists and signed in, just ensure profile and return
    if (!authData.user) { 
        return this.login(email, password);
    }

    // CRITICAL: New profile data is handled by ensureUserProfile now.
    // The ensureUserProfile will set plan: null, is_trial: false, subscription_expires_at: null
    // This ensures registration is plan-agnostic.

    sessionCache = null; // Invalidate cache
    return await ensureUserProfile(authData.user);
  },

  async logout() {
    // Supabase is guaranteed to be initialized now
    await supabase.auth.signOut();
    sessionCache = null; // Invalidate cache
    // Clear Dashboard Cache
    _dashboardCache.works = null;
    _dashboardCache.stats = {};
    _dashboardCache.summary = {};
    _dashboardCache.notifications = null;
    _dashboardCache.steps = {}; // NEW: Clear steps cache on logout
    _dashboardCache.materials = {}; // NEW: Clear materials cache on logout
    _dashboardCache.expenses = {}; // NEW: Clear expenses cache on logout
    _dashboardCache.workers = {}; // NEW
    _dashboardCache.suppliers = {}; // NEW
    _dashboardCache.photos = {}; // NEW
    _dashboardCache.files = {}; // NEW
    _dashboardCache.contracts = null; // NEW
    _dashboardCache.checklists = {}; // NEW
    _dashboardCache.pushSubscriptions = {}; // NEW: Clear push subscriptions cache on logout
    _dashboardCache.financialHistory = {}; // NEW: Clear financial history cache
  },

  async getUserProfile(userId: string): Promise<User | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return data ? mapProfileFromSupabase(data) : null;
  },

  async updateUser(userId: string, data: Partial<User>, newPassword?: string) {
      // Supabase is guaranteed to be initialized now
      
      try {
          // 1. Atualiza dados do perfil (Nome, Whatsapp, etc)
          const updates: any = {};
          if (data.name) updates.name = data.name;
          if (data.whatsapp) updates.whatsapp = data.whatsapp;
          if (data.plan) updates.plan = data.plan;

          if (Object.keys(updates).length > 0) {
            const { error: updateProfileError } = await supabase.from('profiles').update(updates).eq('id', userId); // Renamed error
            if (updateProfileError) throw new Error("Erro ao atualizar dados: " + updateProfileError.message);
          }

          // 2. Atualiza a senha SE fornecida (AUTH separado)
          if (newPassword && newPassword.trim() !== '') {
              const { error: updatePassError } = await supabase.auth.updateUser({ password: newPassword }); // Renamed error
              if (updatePassError) throw new Error("Erro ao atualizar senha: " + updatePassError.message);
          }
          
          sessionCache = null; // Invalida cache para forçar refresh
      } catch (e: any) { // Explicitly type as any to allow .message access
          console.error("Erro updateUser:", e);
          throw e; // Repassa erro para a UI tratar
      }
  },

  // NEW: Method to update user's plan details including subscription_expires_at and is_trial.
  async updatePlan(userId: string, planType: PlanType): Promise<void> {
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('subscription_expires_at, is_trial')
      .eq('id', userId)
      .single();

    if (fetchError || !currentProfile) {
      console.error("Erro ao buscar perfil para atualizar plano:", fetchError);
      throw new Error("Não foi possível encontrar o perfil do usuário.");
    }

    let newExpiresAt: string | null = null;
    let newIsTrial: boolean = false;

    if (planType === PlanType.VITALICIO) {
      // For lifetime plan, set expiration to a very distant future date or null.
      // Using a distant date for easier comparison logic with `new Date()`.
      newExpiresAt = '2100-01-01T00:00:00.000Z'; 
      newIsTrial = false;
    } else {
      let baseDate = new Date();
      // If current subscription is still active (expires in the future),
      // the new subscription starts from the end of the current one.
      if (currentProfile.subscription_expires_at && new Date(currentProfile.subscription_expires_at) > baseDate) {
        baseDate = new Date(currentProfile.subscription_expires_at);
      }

      if (planType === PlanType.MENSAL) {
        baseDate.setMonth(baseDate.getMonth() + 1);
      } else if (planType === PlanType.SEMESTRAL) {
        baseDate.setMonth(baseDate.getMonth() + 6);
      }
      newExpiresAt = baseDate.toISOString();
      newIsTrial = false; // Once a paid plan is active, trial is over.
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan: planType,
        subscription_expires_at: newExpiresAt,
        is_trial: newIsTrial
      })
      .eq('id', userId);

    if (updateError) {
      console.error("Erro ao atualizar plano do usuário:", updateError);
      throw new Error(`Falha ao atualizar o plano: ${updateError.message}`);
    }

    // Invalidate caches to ensure fresh data on next fetch
    sessionCache = null;
    _dashboardCache.notifications = null; // Plan updates might affect notification logic.
  },
  async resetPassword(email: string) {
      // Supabase is guaranteed to be initialized now
      const { error: resetPassError } = await supabase.auth.resetPasswordForEmail(email, { // Renamed error
          redirectTo: window.location.origin + '/settings'
      });
      return !resetPassError;
  },

  isSubscriptionActive(user: User): boolean {
    // Se o plano é Vitalício, ele está sempre ativo, independentemente de `isTrial`
    if (user.plan === PlanType.VITALICIO) return true;

    // Se o usuário está em modo de `isTrial` (teste da IA), e não é Vitalício,
    // o acesso completo ao aplicativo é considerado INATIVO.
    // Isso garante que o app não seja "gratuito" por 7 dias, apenas a IA.
    if (user.isTrial) {
        return false;
    }

    // Para todos os outros planos (Mensal, Semestral)
    // Se não há data de expiração, a assinatura não está ativa.
    if (!user.subscriptionExpiresAt) return false;

    // Se a data de expiração existe e está no futuro, a assinatura está ativa.
    return new Date(user.subscriptionExpiresAt) > new Date();
  },

  // Fix: Added default values to unused parameters to resolve TypeScript error.
  async generatePix(_amount: number = 0, _payer: any = {}) {
      // This is a mock function, no actual Supabase interaction required
      return {
          qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQyF2NgYGBgAAAABQAEV9D3sgAAAABJRohIBMAA==",
          copy_paste_code: "00020126330014BR.GOV.BCB.PIX011155555555555520400005303986540510.005802BR5913Mãos da Obra6008Brasilia62070503***63041234"
      };
  },

  // --- WORKS (WITH CACHING) ---
  async getWorks(userId: string): Promise<Work[]> {
    // Supabase is guaranteed to be initialized now
    
    // Fix: Changed Date.24 to Date.now() to correctly get the current timestamp.
    const now = Date.now();
    // Return cache immediately if valid
    if (_dashboardCache.works && (now - _dashboardCache.works.timestamp < CACHE_TTL)) {
        return _dashboardCache.works.data;
    }

    console.log(`[dbService.getWorks] Fetching works for user: ${userId}`); // Log para depuração
    const { data, error: fetchWorksError } = await supabase // Renamed error
        .from('works')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    if (fetchWorksError) {
        console.error(`[dbService.getWorks] Erro ao buscar obras para user ${userId}:`, fetchWorksError); // Log de erro mais detalhado
        return []; // Return empty on error
    }
    
    const parsed = (data || []).map(parseWorkFromDB);
    _dashboardCache.works = { data: parsed, timestamp: now };
    return parsed;
  },

  async getWorkById(workId: string): Promise<Work | null> {
    // Supabase is guaranteed to be initialized now
    
    // Check cache first
    if (_dashboardCache.works) {
        const cached = _dashboardCache.works.data.find(w => w.id === workId);
        if (cached) return cached;
    }

    console.log(`[dbService.getWorkById] Fetching work by ID: ${workId}`); // Log para depuração
    const { data, error: fetchWorkError } = await supabase.from('works').select('*').eq('id', workId).single(); // Renamed error
    if (fetchWorkError) {
        console.error(`[dbService.getWorkById] Erro ao buscar obra por ID ${workId}:`, fetchWorkError); // Log de erro mais detalhado
        return null;
    }
    return data ? parseWorkFromDB(data) : null;
  },

  // NEW: Function to ensure materials exist for a work, generating them if not present.
  async ensureMaterialsForWork(work: Work, steps: Step[]): Promise<void> {
    try {
        const { data: existingMaterials, error: fetchMaterialsError } = await supabase
            .from('materials')
            .select('id')
            .eq('work_id', work.id)
            .limit(1); // Only need to know if *any* exist

        if (fetchMaterialsError) {
            console.error(`[ensureMaterialsForWork] Error checking existing materials for work ${work.id}:`, fetchMaterialsError);
            throw fetchMaterialsError;
        }

        if ((!existingMaterials || existingMaterials.length === 0) && steps.length > 0) {
            console.log(`[ensureMaterialsForWork] No materials found for work ${work.id} but steps exist. Initiating generation.`);
            // Call the existing regenerateMaterials, which deletes all then inserts all.
            // This is safe here because we just confirmed no materials exist.
            await dbService.regenerateMaterials(work, steps);
        } else if (existingMaterials && existingMaterials.length > 0) {
            console.log(`[ensureMaterialsForWork] Materiais already exist for work ${work.id}. Skipping generation.`);
        } else {
            console.log(`[ensureMaterialsForWork] No steps to generate materials for work ${work.id}. Skipping generation.`);
        }
    } catch (error: any) {
        console.error(`[ensureMaterialsForWork ERROR] Failed to ensure materials for work ${work.id}:`, error?.message || error);
        throw error;
    }
},

  // NEW: Method to regenerate materials based on work attributes and steps
  async regenerateMaterials(work: Work, createdSteps: Step[]): Promise<void> {
    // Supabase is guaranteed to be initialized now
    try {
        // 1. Delete existing materials for this work
        await supabase.from('materials').delete().eq('work_id', work.id);

        const materialsToInsert: any[] = [];
        
        // Iterate through the actual created steps (now generalized)
        for (const step of createdSteps) {
            // Use the new function to get an array of relevant material categories
            const materialCategories = getMaterialCategoriesFromStepName(step.name, work);

            for (const materialCategoryName of materialCategories) {
                const materialCatalog = FULL_MATERIAL_PACKAGES.find(p => p.category === materialCategoryName);

                if (materialCatalog) {
                    for (const item of materialCatalog.items) {
                        let calculatedQty = 0;

                        if (item.flat_qty !== undefined) { // NEW: Prioritize flat_qty if available
                            calculatedQty = item.flat_qty;
                        } else if (item.multiplier !== undefined) {
                            // Base calculation (e.g., per m² of area)
                            calculatedQty = work.area * item.multiplier;

                            // Adjust based on room counts IF applicable (for specific room material categories)
                            // This ensures correct scaling for room-specific items
                            if (materialCategoryName.includes('Banheiro') && work.bathrooms && work.bathrooms > 0) {
                                calculatedQty = (item.multiplier || 0) * work.bathrooms; // Use multiplier for rooms
                            } else if (materialCategoryName.includes('Cozinha') && work.kitchens && work.kitchens > 0) {
                                calculatedQty = (item.multiplier || 0) * work.kitchens; // Use multiplier for rooms
                            } else if (materialCategoryName.includes('Quarto') && work.bedrooms && work.bedrooms > 0) {
                                calculatedQty *= work.bedrooms;
                            } else if (materialCategoryName.includes('Sala') && work.livingRooms && work.livingRooms > 0) {
                                calculatedQty *= work.livingRooms;
                            }

                            // Adjust for floors if applicable (e.g., for slabs, general walls)
                            // This logic applies to generic construction stages that scale with floors
                            if (step.name.includes('Estrutura') && work.floors && work.floors > 1) { 
                                calculatedQty *= (work.floors - 1); // Adjust for intermediate slabs
                            } else if (step.name.includes('Alvenaria') && work.floors && work.floors > 1) {
                                calculatedQty *= work.floors; // Assuming multiplier is for one floor, scale with floors
                            } else if (step.name.includes('Reboco') && work.floors && work.floors > 1) {
                                calculatedQty *= work.floors;
                            } else if (step.name.includes('Pisos') && work.floors && work.floors > 1) {
                                calculatedQty *= work.floors;
                            } else if (step.name.includes('Pintura') && work.floors && work.floors > 1) {
                                calculatedQty *= work.floors;
                            }
                        }
                        
                        calculatedQty = Math.ceil(Math.max(0, calculatedQty));
                        // CRITICAL FIX: Ensure planned_qty is at least 1 if a quantity was expected
                        // (i.e., if item had a multiplier or a flat_qty defined).
                        if (calculatedQty === 0 && (item.multiplier !== undefined || item.flat_qty !== undefined)) {
                            calculatedQty = 1; 
                        }
                        
                        if (calculatedQty > 0) { // Only insert if quantity is positive
                          materialsToInsert.push({
                              work_id: work.id, 
                              user_id: work.userId, // 🔥 FIX CRÍTICO: Adicionado user_id
                              name: item.name,
                              brand: item.brand || '', // FIX: Send empty string if undefined for TEXT NOT NULL.
                              planned_qty: calculatedQty, 
                              purchased_qty: 0, 
                              unit: item.unit,
                              step_id: step.id, // Link material to the specific step
                              category: materialCategoryName || '', // FIX: Send empty string if undefined for TEXT NOT NULL.
                              total_cost: 0 // Initialize total_cost
                          });
                        }
                    }
                } else {
                    console.warn(`[REGEN MATERIAL] Pacote de material para categoria inferida "${materialCategoryName}" (baseado na etapa "${step.name}" da obra "${work.name}") não encontrado.`);
                }
            }
        }
        
        // 3. Insert new materials
        if (materialsToInsert.length > 0) {
            const { error: insertMaterialsError } = await supabase.from('materials').insert(materialsToInsert);
            if (insertMaterialsError) {
                console.error("Erro ao inserir materiais gerados:", insertMaterialsError?.message || insertMaterialsError);
                throw insertMaterialsError;
            }
        }
        
        // Invalidate caches
        _dashboardCache.materials[work.id] = null; 
        _dashboardCache.expenses[work.id] = null; // NEW: Invalidate expenses cache after regenerating materials
        console.log(`[REGEN MATERIAL] Materiais para obra ${work.id} regenerados com sucesso.`);

    } catch (error: any) {
        console.error(`[REGEN MATERIAL ERROR] Erro ao regenerar materiais para work ${work.id}:`, error?.message || error);
        throw error;
    }
  },

  async createWork(workData: Partial<Work>, templateId: string): Promise<Work> {
    // Supabase is guaranteed to be initialized now
    
    // Calcula a data final com base no número de etapas dinamicamente generadas
    let finalEndDate = workData.endDate;
    let effectiveDefaultDurationDays = 0; // Para calcular a duração final
    
    const dbWork = {
        user_id: workData.userId,
        name: workData.name,
        address: workData.address || 'Endereço não informado',
        budget_planned: workData.budgetPlanned,
        start_date: workData.startDate,
        // end_date será definido após a geração das etapas
        area: workData.area,
        status: workData.status,
        notes: workData.notes,
        floors: workData.floors,
        bedrooms: workData.bedrooms,
        bathrooms: workData.bathrooms,
        kitchens: workData.kitchens,
        living_rooms: workData.livingRooms, 
        has_leisure_area: workData.hasLeisureArea 
    };

    const { data: savedWork, error: createWorkError } = await supabase.from('works').insert(dbWork).select().single();
    
    if (createWorkError) {
        console.error("Erro SQL ao criar obra:", createWorkError);
        throw new Error(`Erro ao criar obra: ${createWorkError.message}`);
    }
    
    const parsedWork = parseWorkFromDB(savedWork);
    
    // Invalidate Cache
    _dashboardCache.works = null;
    delete _dashboardCache.stats[parsedWork.id];
    delete _dashboardCache.summary[parsedWork.id];
    _dashboardCache.notifications = null; 
    _dashboardCache.steps[parsedWork.id] = null;
    _dashboardCache.materials[parsedWork.id] = null;
    _dashboardCache.expenses[parsedWork.id] = null; // NEW: Invalidate expenses cache


    const template = WORK_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
        throw new Error(`Template de obra com ID ${templateId} não encontrado.`);
    }

    let finalStepNames: string[] = [];
    const numFloors = parsedWork.floors || 1; 
    const numBathrooms = parsedWork.bathrooms || 0;
    const numKitchens = parsedWork.kitchens || 0;

    // Use a base set of steps and adjust duration based on complexity
    finalStepNames = [...template.includedSteps];
    effectiveDefaultDurationDays = template.defaultDurationDays;

    // Adjust duration based on complex factors for CONSTRUCTION/REFORMA_APTO
    // Note: These multipliers are estimates and can be fine-tuned.
    if (template.id === 'CONSTRUCAO') {
        effectiveDefaultDurationDays += (numFloors > 1 ? (numFloors - 1) * 30 : 0); // More days per additional floor for construction
        effectiveDefaultDurationDays += numBathrooms * 15; // More days per bathroom for construction
        effectiveDefaultDurationDays += numKitchens * 15; // More days per kitchen for construction
        if (parsedWork.area > 0) {
            effectiveDefaultDurationDays += Math.ceil(parsedWork.area / 20) * 7; // Add 7 days per 20m²
        }
    } else if (template.id === 'REFORMA_APTO') {
        effectiveDefaultDurationDays += numBathrooms * 7; // 7 days per bathroom for apartment renovation
        effectiveDefaultDurationDays += numKitchens * 7; // 7 days per kitchen for apartment renovation
        if (parsedWork.area > 0) {
            effectiveDefaultDurationDays += Math.ceil(parsedWork.area / 15) * 4; // Add 4 days per 15m²
        }
    } else { // For smaller, specific projects like BANHEIRO, COZINHA, PINTURA
        effectiveDefaultDurationDays += numBathrooms * 5; 
        effectiveDefaultDurationDays += numKitchens * 5;
    }


    // Adjust endDate based on calculated duration
    if (effectiveDefaultDurationDays > 0) {
        const startDateObj = new Date(parsedWork.startDate);
        startDateObj.setDate(startDateObj.getDate() + effectiveDefaultDurationDays);
        finalEndDate = startDateObj.toISOString().split('T')[0];
    } else {
        // Fix: Replace `parsedObj` with `parsedWork` as `parsedObj` is not defined.
        finalEndDate = parsedWork.startDate; // If no duration, end date is start date
    }

    // Update the work with the calculated end date
    const { error: updateWorkError } = await supabase.from('works').update({ end_date: finalEndDate }).eq('id', parsedWork.id);
    if (updateWorkError) {
        console.error("Erro ao atualizar data final da obra:", updateWorkError);
        throw new Error(`Erro ao atualizar data final da obra: ${updateWorkError.message}`);
    }

    const stepsToInsert = finalStepNames.map((stepName, index) => {
        // Distribute total duration among steps, ensuring at least 1 day per step
        const baseDurationDays = Math.max(1, Math.ceil(effectiveDefaultDurationDays / finalStepNames.length));
        
        // Calculate start and end dates for each step
        const stepStartDate = new Date(parsedWork.startDate);
        stepStartDate.setDate(stepStartDate.getDate() + (index * baseDurationDays));
        
        const stepEndDate = new Date(stepStartDate);
        stepEndDate.setDate(stepEndDate.getDate() + baseDurationDays);

        return {
            work_id: parsedWork.id,
            name: stepName,
            start_date: stepStartDate.toISOString().split('T')[0],
            end_date: stepEndDate.toISOString().split('T')[0],
            // status is now derived, not inserted
            // is_delayed is now derived, not inserted
            order_index: index + 1, // Assign orderIndex
            estimated_duration_days: baseDurationDays // NEW: Add estimated_duration_days
        };
    });

    if (stepsToInsert.length > 0) {
        const { data: createdSteps, error: insertStepsError } = await supabase.from('steps').insert(stepsToInsert).select();
        if (insertStepsError) {
            console.error("Erro ao inserir etapas geradas:", insertStepsError);
            throw insertStepsError;
        }

        // Regenerate materials based on the newly created steps
        await dbService.regenerateMaterials(parsedWork, createdSteps.map(parseStepFromDB)); // Pass parsed steps
    }
    
    return parsedWork; // Ensure this is always returned
  },

  // NEW: Calculate Work Stats
  async calculateWorkStats(workId: string) {
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch all related data
    const [steps, materials, expenses] = await Promise.all([
      dbService.getSteps(workId),
      dbService.getMaterials(workId),
      dbService.getExpenses(workId), // getExpenses já retorna `paidAmount` calculado
    ]);

    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    // Fix: `delayedSteps` should now use `StepStatus.DELAYED`
    const delayedSteps = steps.filter(s => s.status === StepStatus.DELAYED).length;
    
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    
    // 🔥 MODIFICADO: totalSpent agora soma paidAmount das despesas (não material)
    const totalSpent = expenses
      .filter(expense => expense.category !== ExpenseCategory.MATERIAL)
      .reduce((sum, expense) => sum + (expense.paidAmount || 0), 0); // Soma o paidAmount derivado

    const stats = {
      totalSpent,
      progress: parseFloat(progress.toFixed(2)),
      delayedSteps
    };
    
    _dashboardCache.stats[workId] = { data: stats, timestamp: Date.now() };
    return stats;
  },

  // NEW: Get Daily Summary (for Dashboard)
  async getDailySummary(workId: string) {
    const now = Date.now();
    if (_dashboardCache.summary[workId] && (now - _dashboardCache.summary[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.summary[workId].data;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    const [steps, materials] = await Promise.all([
      dbService.getSteps(workId),
      dbService.getMaterials(workId),
    ]);

    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    // Fix: `delayedSteps` should now use `StepStatus.DELAYED`
    const delayedSteps = steps.filter(s => s.status === StepStatus.DELAYED).length;
    const pendingMaterials = materials.filter(m => m.purchasedQty < m.plannedQty).length;

    const summary = {
      totalSteps,
      completedSteps,
      delayedSteps,
      pendingMaterials,
    };
    
    _dashboardCache.summary[workId] = { data: summary, timestamp: now };
    return summary;
  },

  // NEW: Delete Work
  async deleteWork(workId: string): Promise<void> {
    try {
      // Cascade delete is configured in Supabase, so deleting the work
      // should automatically delete related steps, materials, expenses, etc.
      const { error } = await supabase.from('works').delete().eq('id', workId);
      if (error) throw error;

      // Invalidate all related caches
      _dashboardCache.works = null;
      delete _dashboardCache.stats[workId];
      delete _dashboardCache.summary[workId];
      delete _dashboardCache.steps[workId];
      delete _dashboardCache.materials[workId];
      delete _dashboardCache.expenses[workId];
      delete _dashboardCache.workers[workId];
      delete _dashboardCache.suppliers[workId];
      delete _dashboardCache.photos[workId];
      delete _dashboardCache.files[workId];
      // Checklists are also linked
      delete _dashboardCache.checklists[workId];
      _dashboardCache.notifications = null; // Notifications might be linked to workId
      delete _dashboardCache.financialHistory[workId]; // NEW: Invalidate financial history cache
      
    } catch (error: any) {
      console.error(`Error deleting work ${workId}:`, error);
      throw new Error(`Falha ao excluir obra: ${error.message}`);
    }
  },

  // --- STEPS (ETAPAS) ---
  async getSteps(workId: string): Promise<Step[]> {
    const now = Date.now();
    if (_dashboardCache.steps[workId] && (now - _dashboardCache.steps[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.steps[workId].data;
    }

    const { data, error } = await supabase.from('steps').select('*').eq('work_id', workId).order('order_index', { ascending: true });
    if (error) {
      console.error(`Error fetching steps for work ${workId}:`, error);
      return [];
    }
    // 🔥 CRITICAL: Map to parsed objects, which now include derived status
    const parsed = (data || []).map(parseStepFromDB);
    _dashboardCache.steps[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  // Fix: orderIndex is now omitted from the input parameter as it's calculated internally.
  // 🔥 CRITICAL: Changed input type for addStep
  async addStep(step: Omit<Step, 'id' | 'status' | 'orderIndex'>): Promise<Step> { 
    const { data: currentSteps, error: fetchError } = await supabase.from('steps').select('order_index').eq('work_id', step.workId).order('order_index', { ascending: false }).limit(1);
    if (fetchError) console.error("Error fetching max order_index:", fetchError);

    const newOrderIndex = (currentSteps && currentSteps.length > 0) ? currentSteps[0].order_index + 1 : 1;

    const dbStep = {
      work_id: step.workId,
      name: step.name,
      start_date: step.startDate,
      end_date: step.endDate,
      real_date: step.realDate || null, // Ensure real_date is properly set to null if undefined
      // status and is_delayed are derived, not inserted
      order_index: newOrderIndex,
      estimated_duration_days: step.estimatedDurationDays || null, // NEW: Add estimated_duration_days
    };
    const { data, error } = await supabase.from('steps').insert(dbStep).select().single();
    if (error) throw error;
    _dashboardCache.steps[step.workId] = null; // Invalidate cache
    _dashboardCache.summary[step.workId] = null; // Summary might change
    _dashboardCache.stats[step.workId] = null; // Stats might change
    return parseStepFromDB(data);
  },

  async updateStep(step: Step): Promise<Step> {
    // 1. Fetch current step from DB for validation (immutability)
    const { data: currentDbStep, error: fetchError } = await supabase.from('steps').select('*').eq('id', step.id).single();
    if (fetchError || !currentDbStep) throw new Error(`Etapa com ID ${step.id} não encontrada.`);

    const hasStarted = !!currentDbStep.start_date;

    // 2. Apply immutability rules if the step has started
    if (hasStarted) {
        if (currentDbStep.name !== step.name) {
            throw new Error(`Não é possível alterar o nome da etapa "${currentDbStep.name}" após o início.`);
        }
        // order_index changes should be handled by reorderSteps and should be prevented by backend if started
        if (currentDbStep.order_index !== step.orderIndex) {
          throw new Error(`Não é possível alterar a ordem da etapa "${currentDbStep.name}" após o início.`);
        }
        if (currentDbStep.start_date !== step.startDate) {
            throw new Error(`Não é possível alterar a data de início da etapa "${currentDbStep.name}" após ser definida.`);
        }
    }
    // Validate end_date: must exist if start_date exists
    if (step.startDate && !step.endDate) {
        throw new Error("A data de término deve ser definida se a data de início estiver definida.");
    }

    const dbStepUpdates = {
      name: step.name,
      start_date: step.startDate,
      end_date: step.endDate,
      real_date: step.realDate || null, // Explicitly set to null if undefined
      // status and is_delayed are derived, not updated directly
      order_index: step.orderIndex,
      estimated_duration_days: step.estimatedDurationDays || null,
    };

    console.log(`[dbService.updateStep] Sending update to Supabase for step ${step.id}. Payload:`, dbStepUpdates);

    const { data, error } = await supabase.from('steps').update(dbStepUpdates).eq('id', step.id).select().single();
    
    console.log(`[dbService.updateStep] Supabase response for step ${step.id}: Data:`, data, "Error:", error);

    if (error) throw error;
    _dashboardCache.steps[step.workId] = null; // Invalidate cache
    _dashboardCache.summary[step.workId] = null; // Summary might change
    _dashboardCache.stats[step.workId] = null; // Stats might change
    return parseStepFromDB(data);
  },

  async deleteStep(stepId: string, workId: string): Promise<void> {
    // 1. Fetch step data to check if it has started
    const { data: stepToDelete, error: fetchError } = await supabase.from('steps').select('start_date, name').eq('id', stepId).single();
    if (fetchError || !stepToDelete) throw new Error("Etapa não encontrada.");

    if (stepToDelete.start_date) {
        throw new Error(`Não é possível excluir a etapa "${stepToDelete.name}" porque ela já foi iniciada.`);
    }

    // Before deleting step, handle related materials and expenses
    // Cascade delete is configured in Supabase, so deleting the work
    // should automatically delete related steps, materials, expenses, etc.
    const { error: deleteStepError } = await supabase.from('steps').delete().eq('id', stepId);
    if (deleteStepError) throw deleteStepError;

    _dashboardCache.steps[workId] = null; // Invalidate steps cache
    _dashboardCache.materials[workId] = null; // Materials related to this step
    _dashboardCache.expenses[workId] = null; // Expenses related to this step
    _dashboardCache.summary[workId] = null; // Summary might change
    _dashboardCache.stats[workId] = null; // Stats might change
  },

  // --- MATERIALS (MATERIAIS) ---
  async getMaterials(workId: string): Promise<Material[]> {
    const now = Date.now();
    if (_dashboardCache.materials[workId] && (now - _dashboardCache.materials[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.materials[workId].data;
    }

    const { data, error } = await supabase.from('materials').select('*').eq('work_id', workId).order('name', { ascending: true });
    if (error) {
      console.error(`Error fetching materials for work ${workId}:`, error);
      return [];
    }
    const parsed = (data || []).map(parseMaterialFromDB);
    _dashboardCache.materials[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addMaterial(userId: string, material: Omit<Material, 'id' | 'userId' | 'totalCost' | 'status'>): Promise<Material> { // totalCost is initialized by DB, not passed
    const dbMaterial = {
      work_id: material.workId,
      user_id: userId, // 🔥 FIX: Adicionado user_id aqui
      name: material.name,
      brand: material.brand || '', // FIX: Send empty string if undefined for TEXT NOT NULL.
      planned_qty: Math.max(1, material.plannedQty), // CRITICAL FIX: Ensure planned_qty is at least 1
      purchased_qty: material.purchasedQty, // This is passed from the front end, which could be 0.
      unit: material.unit,
      step_id: material.stepId || null, // FIX: Send null if undefined, assuming step_id is nullable in DB.
      category: material.category || '', // FIX: Send empty string if undefined for TEXT NOT NULL.
      total_cost: 0, // Initialized to 0
    };
    const { data, error } = await supabase.from('materials').insert(dbMaterial).select().single();
    if (error) throw error;
    _dashboardCache.materials[material.workId] = null; // Invalidate cache
    _dashboardCache.summary[material.workId] = null; // Summary might change
    return parseMaterialFromDB(data);
  },

  async updateMaterial(material: Material): Promise<Material> {
    // 🔥 FIX CRÍTICO: Bloqueio de edição para campos importantes de materiais quando já há compras registradas
    const { data: currentMaterial, error: fetchError } = await supabase.from('materials').select('*').eq('id', material.id).single();
    if (fetchError || !currentMaterial) throw new Error(`Material with ID ${material.id} not found.`);

    if (currentMaterial.purchased_qty > 0) {
      // Campos que NÃO podem ser alterados se já houver compras registradas
      const restrictedFields: (keyof Omit<Material, 'id' | 'workId' | 'userId' | 'purchasedQty' | 'totalCost' | 'stepId'>)[] = ['name', 'brand', 'plannedQty', 'unit', 'category'];
      
      for (const field of restrictedFields) {
        // Handle conversion from camelCase to snake_case for DB field names
        const dbFieldName = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (material[field] !== (currentMaterial as any)[dbFieldName]) { 
          throw new Error(`Não é possível alterar o campo '${field}' de um material que já possui compras registradas.`);
        }
      }
      // stepId can be updated even if there are purchases, as it only links to a different step
      if (material.stepId !== currentMaterial.step_id) {
          // Allow stepId change, but log a warning if needed
          console.warn(`Material ${material.id} com compras registradas teve seu stepId alterado de ${currentMaterial.step_id} para ${material.stepId}.`);
      }

      // purchasedQty e totalCost são derivados de compras, não editáveis diretamente via updateMaterial
      if (material.purchasedQty !== currentMaterial.purchased_qty || material.totalCost !== currentMaterial.total_cost) {
        throw new Error("Não é possível alterar 'Quantidade Comprada' ou 'Custo Total' diretamente. Use a função 'registerMaterialPurchase' para isso.");
      }
    }


    const dbMaterial = {
      name: material.name,
      brand: material.brand || '', // FIX: Send empty string if undefined for TEXT NOT NULL.
      planned_qty: material.plannedQty,
      // purchased_qty: material.purchasedQty, // REMOVIDO: Não deve ser editado diretamente
      unit: material.unit,
      step_id: material.stepId || null, // FIX: Send null if undefined, assuming step_id is nullable in DB.
      category: material.category || '', // FIX: Send empty string if undefined for TEXT NOT NULL.
      // total_cost: material.totalCost, // REMOVIDO: Não deve ser editado diretamente
    };
    const { data, error } = await supabase.from('materials').update(dbMaterial).eq('id', material.id).select().single();
    if (error) throw error;
    _dashboardCache.materials[material.workId] = null; // Invalidate cache
    _dashboardCache.summary[material.workId] = null; // Summary might change
    _dashboardCache.expenses[material.workId] = null; // Expenses might be related
    return parseMaterialFromDB(data);
  },

  async deleteMaterial(materialId: string): Promise<void> {
    // First, find the material to get its workId
    const { data: materialToDelete, error: fetchError } = await supabase.from('materials').select('work_id, purchased_qty').eq('id', materialId).single();
    if (fetchError || !materialToDelete) throw new Error("Material not found or error fetching workId.");
    const workId = materialToDelete.work_id;
    const userId = (await dbService.getCurrentUser())?.id || 'unknown';

    // Log material deletion
    await _addFinancialHistoryEntry({
        workId,
        userId,
        // expenseId: undefined, // No specific expense directly tied to material deletion itself
        action: 'delete',
        description: `Material ID ${materialId} excluído.`,
        oldValue: materialId,
        newValue: null,
        field: 'material_id',
    });

    // Delete any associated expenses
    // MODIFICADO: A exclusão de expenses agora tem cascata para installments e excess
    const { data: deletedExpenses, error: deleteExpensesError } = await supabase.from('expenses').delete().eq('related_material_id', materialId).select('id, amount, quantity, description');
    if (deleteExpensesError) console.error("Error deleting related expenses:", deleteExpensesError);
    else if (deletedExpenses) {
        for (const expense of deletedExpenses) {
            await _addFinancialHistoryEntry({
                workId,
                userId,
                expenseId: expense.id,
                action: 'delete',
                description: `Despesa de material "${expense.description}" (R$${expense.amount}) excluída junto com o material.`,
                oldValue: expense.amount,
                newValue: null
            });
        }
    }

    const { error: deleteMaterialError } = await supabase.from('materials').delete().eq('id', materialId);
    if (deleteMaterialError) throw deleteMaterialError;

    _dashboardCache.materials[workId] = null; // Invalidate materials cache
    _dashboardCache.expenses[workId] = null; // Invalidate expenses cache (due to potential deletions)
    _dashboardCache.summary[workId] = null; // Summary might change
  },

  async registerMaterialPurchase(materialId: string, materialName: string, materialBrand: string | undefined, plannedQty: number, unit: string, purchasedQtyDelta: number, cost: number): Promise<Material> {
    // 1. Fetch current material data
    const { data: currentMaterial, error: fetchError } = await supabase.from('materials').select('*').eq('id', materialId).single();
    if (fetchError || !currentMaterial) throw new Error(`Material with ID ${materialId} not found.`);

    const newPurchasedQty = currentMaterial.purchased_qty + purchasedQtyDelta;
    const newTotalCost = currentMaterial.total_cost + cost;

    // 2. Update material's purchased_qty and total_cost
    const { data: updatedMaterialData, error: updateError } = await supabase.from('materials')
      .update({
        purchased_qty: newPurchasedQty,
        total_cost: newTotalCost,
      })
      .eq('id', materialId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Add a new expense record for this purchase
    const expenseData: Omit<Expense, 'id' | 'paidAmount' | 'status'> = { // REMOVIDO paidAmount e status
      workId: currentMaterial.work_id,
      description: `Compra de ${purchasedQtyDelta} ${unit} de ${materialName} (${materialBrand || 's/marca'})`,
      amount: cost, // O `amount` da despesa será o custo total da compra
      quantity: purchasedQtyDelta,
      date: new Date().toISOString().split('T')[0],
      category: ExpenseCategory.MATERIAL,
      relatedMaterialId: materialId,
      stepId: currentMaterial.step_id,
      // 🔥 FIX CRÍTICO: Para materiais, o valor combinado é SEMPRE nulo/indefinido.
      totalAgreed: undefined, 
    };
    // MODIFICADO: addExpense agora gerencia a criação da primeira parcela
    const addedExpense = await dbService.addExpense(expenseData); 

    // Log the material purchase and associated expense creation
    await _addFinancialHistoryEntry({
        workId: currentMaterial.work_id,
        userId: (await dbService.getCurrentUser())?.id || 'unknown',
        expenseId: addedExpense.id,
        action: 'payment', // Tipo de ação é 'payment' porque registra uma compra.
        description: `Compra de material "${materialName}" registrada: ${purchasedQtyDelta} ${unit} por ${cost}. Despesa #${addedExpense.id} criada e paga.`,
        field: 'purchased_qty',
        oldValue: currentMaterial.purchased_qty,
        newValue: newPurchasedQty
    });
    await _addFinancialHistoryEntry({
        workId: currentMaterial.work_id,
        userId: (await dbService.getCurrentUser())?.id || 'unknown',
        expenseId: addedExpense.id,
        action: 'payment',
        description: `Custo total do material "${materialName}" atualizado.`,
        field: 'total_cost',
        oldValue: currentMaterial.total_cost,
        newValue: newTotalCost
    });


    _dashboardCache.materials[currentMaterial.work_id] = null; // Invalidate materials cache
    _dashboardCache.expenses[currentMaterial.work_id] = null; // Invalidate expenses cache
    _dashboardCache.summary[currentMaterial.work_id] = null; // Summary might change
    return parseMaterialFromDB(updatedMaterialData);
  },

  // --- EXPENSES (FINANCEIRO) ---
  async getExpenses(workId: string): Promise<Expense[]> {
    const now = Date.now();
    if (_dashboardCache.expenses[workId] && (now - _dashboardCache.expenses[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.expenses[workId].data;
    }

    // MODIFICADO: Consulta para unir expenses com financial_installments para calcular paidAmount e status
    const { data, error } = await supabase
        .from('expenses')
        .select(`
            *,
            financial_installments(amount, status)
        `)
        .eq('work_id', workId)
        .order('date', { ascending: false });

    if (error) {
        console.error(`Error fetching expenses for work ${workId}:`, error);
        return [];
    }
    
    // Processar os dados para incluir paidAmount e status
    const parsedExpenses: Expense[] = (data || []).map((dbExpense: any) => {
        const installments = dbExpense.financial_installments || [];
        const paidAmount = installments.filter((inst: any) => inst.status === InstallmentStatus.PAID).reduce((sum: number, inst: any) => sum + Number(inst.amount), 0);
        const totalAgreed = dbExpense.total_agreed ? Number(dbExpense.total_agreed) : Number(dbExpense.amount || 0);

        let status: ExpenseStatus;
        if (paidAmount === 0) {
            status = ExpenseStatus.PENDING;
        } else if (paidAmount < totalAgreed) {
            status = ExpenseStatus.PARTIAL;
        } else if (paidAmount === totalAgreed) {
            status = ExpenseStatus.COMPLETED;
        } else { // paidAmount > totalAgreed
            status = ExpenseStatus.OVERPAID;
        }

        return {
            id: dbExpense.id,
            workId: dbExpense.work_id,
            description: dbExpense.description,
            amount: Number(dbExpense.amount || 0),
            paidAmount: paidAmount, // Propriedade DERIVADA
            quantity: Number(dbExpense.quantity || 0),
            date: dbExpense.date,
            category: dbExpense.category,
            relatedMaterialId: dbExpense.related_material_id,
            stepId: dbExpense.step_id,
            workerId: dbExpense.worker_id,
            supplierId: dbExpense.supplier_id,
            totalAgreed: dbExpense.total_agreed ? Number(dbExpense.total_agreed) : undefined,
            status: status, // Propriedade DERIVADA
        };
    });

    _dashboardCache.expenses[workId] = { data: parsedExpenses, timestamp: now };
    return parsedExpenses;
  },

  async addExpense(expense: Omit<Expense, 'id' | 'paidAmount' | 'status'>): Promise<Expense> { // MODIFICADO: Remove paidAmount e status do input
    const userId = (await dbService.getCurrentUser())?.id || 'unknown';

    // 🔥 FIX CRÍTICO: Valor combinado NÃO existe em Materiais (Validação Backend)
    let totalAgreedValue = expense.totalAgreed !== undefined ? expense.totalAgreed : expense.amount;
    if (expense.category === ExpenseCategory.MATERIAL) {
        totalAgreedValue = undefined; // Garante que seja nulo no DB
    }

    const dbExpense = {
      work_id: expense.workId,
      description: expense.description,
      amount: expense.amount,
      quantity: expense.quantity,
      date: expense.date,
      category: expense.category,
      related_material_id: expense.relatedMaterialId,
      step_id: expense.stepId,
      worker_id: expense.workerId,
      supplier_id: expense.supplierId,
      total_agreed: totalAgreedValue, 
    };
    const { data: newExpense, error: addExpenseError } = await supabase.from('expenses').insert(dbExpense).select().single();
    if (addExpenseError) throw addExpenseError;

    // Criar uma parcela inicial para a despesa
    const installmentAmount = totalAgreedValue !== undefined && totalAgreedValue !== null ? totalAgreedValue : expense.amount; // Use actual amount if totalAgreed is undefined/null
    const initialInstallmentStatus = (expense.category === ExpenseCategory.MATERIAL) ? InstallmentStatus.PAID : InstallmentStatus.PENDING; // Material expenses are usually 'paid in full' at creation
    const initialInstallmentPaidAt = (expense.category === ExpenseCategory.MATERIAL) ? new Date().toISOString() : undefined;

    const { data: newInstallment, error: addInstallmentError } = await supabase.from('financial_installments').insert({
        expense_id: newExpense.id,
        amount: installmentAmount,
        paid_at: initialInstallmentPaidAt,
        status: initialInstallmentStatus,
    }).select().single();
    if (addInstallmentError) {
        // Se a parcela não puder ser criada, a despesa ainda existe, mas o fluxo financeiro está comprometido.
        console.error("Erro ao criar parcela inicial para despesa:", addInstallmentError);
        // Opcional: deletar a despesa recém-criada para manter a consistência, ou deixar para ser corrigido manualmente.
        // await supabase.from('expenses').delete().eq('id', newExpense.id);
        throw new Error("Despesa criada, mas falha ao criar parcela inicial. Verifique o financeiro.");
    }

    await _addFinancialHistoryEntry({
        workId: expense.workId,
        userId,
        expenseId: newExpense.id,
        action: 'create',
        description: `Despesa "${expense.description}" (R$${expense.amount}) criada.`,
        newValue: expense.amount
    });
    await _addFinancialHistoryEntry({
        workId: expense.workId,
        userId,
        expenseId: newExpense.id,
        action: 'installment_create',
        description: `Parcela inicial (R$${installmentAmount}, status: ${initialInstallmentStatus}) criada para a despesa "${expense.description}".`
    });

    _dashboardCache.expenses[expense.workId] = null; // Invalidate cache
    _dashboardCache.summary[expense.workId] = null; // Summary might change
    _dashboardCache.stats[expense.workId] = null; // Stats might change due to new expense
    return parseExpenseFromDB(newExpense); // Retorna a despesa com os campos derivados
  },

  async updateExpense(expense: Expense): Promise<Expense> { // MODIFICADO: Aceita Expense com paidAmount/status derivado
    // 1. Fetch current expense data for comparison and validation
    const { data: currentDbExpense, error: fetchError } = await supabase.from('expenses').select('*').eq('id', expense.id).single();
    if (fetchError || !currentDbExpense) throw new Error(`Expense with ID ${expense.id} not found.`);
    
    const userId = (await dbService.getCurrentUser())?.id || 'unknown';

    // Buscar as parcelas para determinar o status real e paidAmount
    const { data: currentInstallments, error: fetchInstallmentsError } = await supabase
        .from('financial_installments')
        .select('amount, status')
        .eq('expense_id', expense.id);
    if (fetchInstallmentsError) throw fetchInstallmentsError;
    const currentPaidAmount = (currentInstallments || []).filter(inst => inst.status === InstallmentStatus.PAID).reduce((sum, inst) => sum + Number(inst.amount), 0);
    
    // 🔥 FIX CRÍTICO: Bloqueio de edição para campos pagos (Validação Backend)
    // Se a despesa já tem algum valor pago, 'amount', 'total_agreed', 'date' e 'category' não podem ser alterados.
    if (currentPaidAmount > 0) {
        if (expense.amount !== currentDbExpense.amount) {
            throw new Error("Não é possível alterar o 'Valor' de uma despesa que já possui pagamentos.");
        }
        if (expense.totalAgreed !== undefined && expense.totalAgreed !== currentDbExpense.total_agreed) {
            throw new Error("Não é possível alterar o 'Valor Combinado' de uma despesa que já possui pagamentos.");
        }
        if (expense.date !== currentDbExpense.date) {
            throw new Error("Não é possível alterar a 'Data' de uma despesa que já possui pagamentos.");
        }
        if (expense.category !== currentDbExpense.category) {
            throw new Error("Não é possível alterar a 'Categoria' de uma despesa que já possui pagamentos.");
        }
    }

    // 🔥 FIX CRÍTICO: Valor combinado NÃO existe em Materiais (Validação Backend)
    let totalAgreedValue = expense.totalAgreed;
    if (expense.category === ExpenseCategory.MATERIAL) {
        totalAgreedValue = undefined; // Garante que seja nulo no DB
        if (expense.totalAgreed !== undefined && expense.totalAgreed !== null) {
            console.warn(`Tentativa de definir 'totalAgreed' para despesa de material ${expense.id}. Valor será ignorado.`);
        }
    }

    const dbExpenseUpdates = {
      description: expense.description,
      amount: expense.amount,
      // paid_amount foi removido
      quantity: expense.quantity,
      date: expense.date,
      category: expense.category,
      related_material_id: expense.relatedMaterialId,
      step_id: expense.stepId,
      worker_id: expense.workerId,
      supplier_id: expense.supplierId,
      total_agreed: totalAgreedValue,
    };
    const { data: updatedDbExpense, error: updateError } = await supabase.from('expenses').update(dbExpenseUpdates).eq('id', expense.id).select().single();
    if (updateError) throw updateError;

    // Log changes to financial history
    const changes: Array<{ field: string; oldValue: any; newValue: any; description: string }> = [];
    if (expense.description !== currentDbExpense.description) {
        changes.push({ field: 'description', oldValue: currentDbExpense.description, newValue: expense.description, description: `Descrição alterada de "${currentDbExpense.description}" para "${expense.description}".` });
    }
    if (expense.amount !== currentDbExpense.amount) {
        changes.push({ field: 'amount', oldValue: currentDbExpense.amount, newValue: expense.amount, description: `Valor alterado de R$${currentDbExpense.amount} para R$${expense.amount}.` });
    }
    if (expense.date !== currentDbExpense.date) {
        changes.push({ field: 'date', oldValue: currentDbExpense.date, newValue: expense.date, description: `Data alterada de ${currentDbExpense.date} para ${expense.date}.` });
    }
    if (expense.category !== currentDbExpense.category) {
        changes.push({ field: 'category', oldValue: currentDbExpense.category, newValue: expense.category, description: `Categoria alterada de "${currentDbExpense.category}" para "${expense.category}".` });
    }
    // Only log if totalAgreed was actually changed and is not for a material expense
    if (expense.category !== ExpenseCategory.MATERIAL && expense.totalAgreed !== undefined && expense.totalAgreed !== currentDbExpense.total_agreed) {
        changes.push({ field: 'totalAgreed', oldValue: currentDbExpense.total_agreed, newValue: expense.totalAgreed, description: `Valor combinado alterado de R$${currentDbExpense.total_agreed} para R$${expense.totalAgreed}.` });
    }
    // Add similar checks for other fields if desired

    if (changes.length > 0) {
        for (const change of changes) {
            await _addFinancialHistoryEntry({
                workId: expense.workId,
                userId,
                expenseId: expense.id,
                action: 'update',
                ...change
            });
        }
    }


    _dashboardCache.expenses[expense.workId] = null; // Invalidate cache
    _dashboardCache.summary[expense.workId] = null; // Summary might change
    _dashboardCache.stats[expense.workId] = null; // Stats might change due to expense update
    // Retornar a despesa com paidAmount e status calculados
    return parseExpenseFromDB(updatedDbExpense); 
  },

  async deleteExpense(expenseId: string): Promise<void> {
    // Before deleting expense, get its workId and if it was related to a material
    const { data: expenseToDelete, error: fetchError } = await supabase.from('expenses').select('work_id, related_material_id, amount, quantity, description, category').eq('id', expenseId).single();
    if (fetchError || !expenseToDelete) throw new Error("Expense not found or error fetching workId.");
    const workId = expenseToDelete.work_id;
    const userId = (await dbService.getCurrentUser())?.id || 'unknown';

    // If it was a material-related expense, decrement the purchased_qty and total_cost of the material
    if (expenseToDelete.related_material_id && expenseToDelete.category === ExpenseCategory.MATERIAL) {
      const { data: material, error: materialFetchError } = await supabase.from('materials').select('purchased_qty, total_cost, name').eq('id', expenseToDelete.related_material_id).single();
      if (materialFetchError) console.error("Error fetching related material for expense deletion:", materialFetchError);
      if (material) {
        const newPurchasedQty = material.purchased_qty - (expenseToDelete.quantity || 0);
        const newTotalCost = material.total_cost - expenseToDelete.amount;
        await supabase.from('materials').update({
          purchased_qty: Math.max(0, newPurchasedQty),
          total_cost: Math.max(0, newTotalCost)
        }).eq('id', expenseToDelete.related_material_id);

        await _addFinancialHistoryEntry({
            workId,
            userId,
            expenseId: expenseId,
            action: 'update',
            field: 'material_purchased_qty_deducted',
            description: `Dedução de material "${material.name}" devido à exclusão da despesa "${expenseToDelete.description}".`,
            oldValue: material.purchased_qty,
            newValue: newPurchasedQty
        });
      }
    }

    // A exclusão da despesa em `expenses` agora vai em cascata para `financial_installments` e `financial_excess`
    const { error: deleteExpenseError } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (deleteExpenseError) throw deleteExpenseError;

    await _addFinancialHistoryEntry({
        workId,
        userId,
        expenseId: expenseId,
        action: 'delete',
        description: `Despesa "${expenseToDelete.description}" (R$${expenseToDelete.amount}) excluída.`,
        oldValue: expenseToDelete.amount,
        newValue: null
    });


    _dashboardCache.expenses[workId] = null; // Invalidate expenses cache
    _dashboardCache.materials[workId] = null; // Invalidate materials cache (if related material was updated)
    _dashboardCache.summary[workId] = null; // Summary might change
    _dashboardCache.stats[workId] = null; // Stats might change due to expense deletion
  },

  // NEW: Add payment to an existing expense (for partial payments)
  async addPaymentToExpense(expenseId: string, amount: number, date: string): Promise<Expense> {
    // 1. Fetch current expense data
    const { data: currentExpenseData, error: fetchError } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
    if (fetchError || !currentExpenseData) throw new Error(`Expense with ID ${expenseId} not found.`);
    
    const userId = (await dbService.getCurrentUser())?.id || 'unknown';
    const currentExpense = parseExpenseFromDB(currentExpenseData); // Convert to Expense to get derived properties
    
    // 2. Criar nova parcela
    const { data: newInstallment, error: addInstallmentError } = await supabase.from('financial_installments').insert({
        expense_id: expenseId,
        amount: amount,
        paid_at: date,
        status: InstallmentStatus.PAID,
    }).select().single();
    if (addInstallmentError) throw addInstallmentError;

    await _addFinancialHistoryEntry({
        workId: currentExpense.workId,
        userId,
        expenseId: currentExpense.id,
        action: 'payment',
        field: 'new_installment',
        newValue: amount,
        description: `Pagamento de R$${amount} registrado para a despesa "${currentExpense.description}". Parcela #${newInstallment.id} criada.`
    });

    // Recalcular paidAmount e status APÓS adicionar a parcela
    _dashboardCache.expenses[currentExpense.workId] = null; // Invalidate cache para forçar recálculo
    _dashboardCache.summary[currentExpense.workId] = null; // Summary might change
    _dashboardCache.stats[currentExpense.workId] = null; // Stats might change due to new payment

    // Refetch the updated expense to ensure latest derived status and paidAmount
    const { data: latestExpenseRaw, error: refetchError } = await supabase
        .from('expenses')
        .select(`
            *,
            financial_installments(amount, status)
        `)
        .eq('id', expenseId)
        .single();
    
    if (refetchError || !latestExpenseRaw) {
        console.error("Erro ao refetchar despesa após adicionar pagamento:", refetchError);
        throw new Error("Erro ao carregar status atualizado da despesa.");
    }
    const latestExpense = parseExpenseFromDB(latestExpenseRaw);


    if (latestExpense && latestExpense.status === ExpenseStatus.OVERPAID) {
        // 🔥 FIX CRÍTICO: Registrar excedente separadamente
        const excessAmount = (latestExpense.paidAmount || 0) - (latestExpense.totalAgreed !== undefined && latestExpense.totalAgreed !== null ? latestExpense.totalAgreed : latestExpense.amount);
        
        const { data: existingExcess, error: fetchExcessError } = await supabase
            .from('financial_excess')
            .select('id')
            .eq('expense_id', expenseId)
            .maybeSingle();

        if (fetchExcessError) console.error("Error fetching existing excess:", fetchExcessError);

        if (existingExcess) {
            // Atualizar excedente existente
            await supabase.from('financial_excess').update({
                amount: excessAmount,
                description: `Excedente atualizado para R$${excessAmount}.`,
                recorded_at: new Date().toISOString(),
            }).eq('expense_id', expenseId);
            await _addFinancialHistoryEntry({
                workId: currentExpense.workId,
                userId,
                expenseId: currentExpense.id,
                action: 'excess_create', // Pode ser 'excess_update' se houver um tipo
                field: 'excess_amount',
                newValue: excessAmount,
                description: `Excedente financeiro atualizado para R$${excessAmount} na despesa "${currentExpense.description}".`
            });
        } else {
            // Criar novo registro de excedente
            await supabase.from('financial_excess').insert({
                expense_id: expenseId,
                amount: excessAmount,
                description: `Excedente financeiro registrado: R$${excessAmount}.`,
                recorded_at: new Date().toISOString(),
            });
            await _addFinancialHistoryEntry({
                workId: currentExpense.workId,
                userId,
                expenseId: currentExpense.id,
                action: 'excess_create',
                field: 'excess_amount',
                newValue: excessAmount,
                description: `Excedente financeiro de R$${excessAmount} registrado na despesa "${currentExpense.description}".`
            });
        }
    }

    return latestExpense || currentExpense; // Return the latest data or fallback
  },

  // --- WORKERS ---
  async getWorkers(workId: string): Promise<Worker[]> {
    const now = Date.now();
    if (_dashboardCache.workers[workId] && (now - _dashboardCache.workers[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.workers[workId].data;
    }

    const { data, error } = await supabase.from('workers').select('*').eq('work_id', workId).order('name', { ascending: true });
    if (error) {
      console.error(`Error fetching workers for work ${workId}:`, error);
      return [];
    }
    const parsed = (data || []).map(parseWorkerFromDB);
    _dashboardCache.workers[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addWorker(worker: Omit<Worker, 'id'>): Promise<Worker> {
    const dbWorker = {
      work_id: worker.workId,
      user_id: worker.userId,
      name: worker.name,
      role: worker.role,
      phone: worker.phone,
      daily_rate: worker.dailyRate || null,
      notes: worker.notes || null,
    };
    const { data, error } = await supabase.from('workers').insert(dbWorker).select().single();
    if (error) throw error;
    _dashboardCache.workers[worker.workId] = null;
    return parseWorkerFromDB(data);
  },

  async updateWorker(worker: Worker): Promise<Worker> {
    const dbWorker = {
      name: worker.name,
      role: worker.role,
      phone: worker.phone,
      daily_rate: worker.dailyRate || null,
      notes: worker.notes || null,
    };
    const { data, error } = await supabase.from('workers').update(dbWorker).eq('id', worker.id).select().single();
    if (error) throw error;
    _dashboardCache.workers[worker.workId] = null;
    _dashboardCache.expenses[worker.workId] = null; // Expenses might be related
    return parseWorkerFromDB(data);
  },

  async deleteWorker(workerId: string, workId: string): Promise<void> {
    const { error } = await supabase.from('workers').delete().eq('id', workerId);
    if (error) throw error;
    _dashboardCache.workers[workId] = null;
    _dashboardCache.expenses[workId] = null; // Invalidate expenses that might have referenced this worker
  },

  // --- SUPPLIERS ---
  async getSuppliers(workId: string): Promise<Supplier[]> {
    const now = Date.now();
    if (_dashboardCache.suppliers[workId] && (now - _dashboardCache.suppliers[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.suppliers[workId].data;
    }

    const { data, error } = await supabase.from('suppliers').select('*').eq('work_id', workId).order('name', { ascending: true });
    if (error) {
      console.error(`Error fetching suppliers for work ${workId}:`, error);
      return [];
    }
    const parsed = (data || []).map(parseSupplierFromDB);
    _dashboardCache.suppliers[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    const dbSupplier = {
      work_id: supplier.workId,
      user_id: supplier.userId,
      name: supplier.name,
      category: supplier.category,
      phone: supplier.phone,
      email: supplier.email || null,
      address: supplier.address || null,
      notes: supplier.notes || null,
    };
    const { data, error } = await supabase.from('suppliers').insert(dbSupplier).select().single();
    if (error) throw error;
    _dashboardCache.suppliers[supplier.workId] = null;
    return parseSupplierFromDB(data);
  },

  async updateSupplier(supplier: Supplier): Promise<Supplier> {
    const dbSupplier = {
      name: supplier.name,
      category: supplier.category,
      phone: supplier.phone,
      email: supplier.email || null,
      address: supplier.address || null,
      notes: supplier.notes || null,
    };
    const { data, error } = await supabase.from('suppliers').update(dbSupplier).eq('id', supplier.id).select().single();
    if (error) throw error;
    _dashboardCache.suppliers[supplier.workId] = null;
    _dashboardCache.expenses[supplier.workId] = null; // Expenses might be related
    return parseSupplierFromDB(data);
  },

  async deleteSupplier(supplierId: string, workId: string): Promise<void> {
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) throw error;
    _dashboardCache.suppliers[workId] = null;
    _dashboardCache.expenses[workId] = null; // Invalidate expenses that might have referenced this supplier
  },

  // --- WORK PHOTOS ---
  async getPhotos(workId: string): Promise<WorkPhoto[]> {
    const now = Date.now();
    if (_dashboardCache.photos[workId] && (now - _dashboardCache.photos[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.photos[workId].data;
    }

    const { data, error } = await supabase.from('work_photos').select('*').eq('work_id', workId).order('date', { ascending: false });
    if (error) {
      console.error(`Error fetching photos for work ${workId}:`, error);
      return [];
    }
    const parsed = (data || []).map(parsePhotoFromDB);
    _dashboardCache.photos[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addPhoto(photo: Omit<WorkPhoto, 'id'>): Promise<WorkPhoto> {
    const dbPhoto = {
      work_id: photo.workId,
      url: photo.url,
      description: photo.description,
      date: photo.date,
      type: photo.type,
    };
    const { data, error } = await supabase.from('work_photos').insert(dbPhoto).select().single();
    if (error) throw error;
    _dashboardCache.photos[photo.workId] = null;
    return parsePhotoFromDB(data);
  },

  async deletePhoto(photoId: string): Promise<void> {
    // Note: Deleting the actual file from storage is handled in the UI component
    const { data: photoToDelete, error: fetchError } = await supabase.from('work_photos').select('work_id').eq('id', photoId).single();
    if (fetchError || !photoToDelete) throw new Error("Photo not found.");
    const workId = photoToDelete.work_id;

    const { error } = await supabase.from('work_photos').delete().eq('id', photoId);
    if (error) throw error;
    _dashboardCache.photos[workId] = null;
  },

  // --- WORK FILES ---
  async getFiles(workId: string): Promise<WorkFile[]> {
    const now = Date.now();
    if (_dashboardCache.files[workId] && (now - _dashboardCache.files[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.files[workId].data;
    }

    const { data, error } = await supabase.from('work_files').select('*').eq('work_id', workId).order('date', { ascending: false });
    if (error) {
      console.error(`Error fetching files for work ${workId}:`, error);
      return [];
    }
    const parsed = (data || []).map(parseFileFromDB);
    _dashboardCache.files[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addFile(file: Omit<WorkFile, 'id'>): Promise<WorkFile> {
    const dbFile = {
      work_id: file.workId,
      name: file.name,
      category: file.category,
      url: file.url,
      type: file.type,
      date: file.date,
    };
    const { data, error } = await supabase.from('work_files').insert(dbFile).select().single();
    if (error) throw error;
    _dashboardCache.files[file.workId] = null;
    return parseFileFromDB(data);
  },

  async deleteFile(fileId: string): Promise<void> {
    // Note: Deleting the actual file from storage is handled in the UI component
    const { data: fileToDelete, error: fetchError } = await supabase.from('work_files').select('work_id').eq('id', fileId).single();
    if (fetchError || !fileToDelete) throw new Error("File not found.");
    const workId = fileToDelete.work_id;

    const { error } = await supabase.from('work_files').delete().eq('id', fileId);
    if (error) throw error;
    _dashboardCache.files[workId] = null;
  },

  // --- CONTRACT TEMPLATES ---
  // Contracts are global and don't change often, so a simple hardcoded list from standards.ts
  // or a single fetch with aggressive caching is appropriate.
  async getContractTemplates(): Promise<Contract[]> {
    // Fix: Changed Date.Now() to Date.now()
    const now = Date.now();
    if (_dashboardCache.contracts && (now - _dashboardCache.contracts.timestamp < CACHE_TTL)) {
      return _dashboardCache.contracts.data;
    }
    // For simplicity, using the hardcoded templates from standards.ts
    // If contracts were stored in DB, this would be a fetch operation.
    const fetchedContracts = CONTRACT_TEMPLATES; // Assuming CONTRACT_TEMPLATES is an array of Contract
    _dashboardCache.contracts = { data: fetchedContracts, timestamp: now };
    return fetchedContracts;
  },

  // --- CHECKLISTS ---
  async getChecklists(workId: string): Promise<Checklist[]> {
    const now = Date.now();
    if (_dashboardCache.checklists[workId] && (now - _dashboardCache.checklists[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.checklists[workId].data;
    }

    const { data, error } = await supabase.from('checklists').select('*').eq('work_id', workId).order('name', { ascending: true });
    if (error) {
      console.error(`Error fetching checklists for work ${workId}:`, error);
      return [];
    }
    const parsed = (data || []).map(parseChecklistFromDB);
    _dashboardCache.checklists[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addChecklist(checklist: Omit<Checklist, 'id'>): Promise<Checklist> {
    const dbChecklist = {
      work_id: checklist.workId,
      name: checklist.name,
      category: checklist.category,
      items: checklist.items, // JSONB column
    };
    const { data, error } = await supabase.from('checklists').insert(dbChecklist).select().single();
    if (error) throw error;
    _dashboardCache.checklists[checklist.workId] = null;
    return parseChecklistFromDB(data);
  },

  async updateChecklist(checklist: Checklist): Promise<Checklist> {
    const dbChecklist = {
      name: checklist.name,
      category: checklist.category,
      items: checklist.items, // JSONB column
    };
    const { data, error } = await supabase.from('checklists').update(dbChecklist).eq('id', checklist.id).select().single();
    if (error) throw error;
    _dashboardCache.checklists[checklist.workId] = null;
    return parseChecklistFromDB(data);
  },

  async deleteChecklist(checklistId: string): Promise<void> {
    const { data: checklistToDelete, error: fetchError } = await supabase.from('checklists').select('work_id').eq('id', checklistId).single();
    if (fetchError || !checklistToDelete) throw new Error("Checklist not found.");
    const workId = checklistToDelete.work_id;

    const { error } = await supabase.from('checklists').delete().eq('id', checklistId);
    if (error) throw error;
    _dashboardCache.checklists[workId] = null;
  },

  // --- NOTIFICATIONS ---
  async getNotifications(userId: string): Promise<DBNotification[]> {
    const now = Date.now();
    // Cache for notifications is global, not per workId
    if (_dashboardCache.notifications && (now - _dashboardCache.notifications.timestamp < CACHE_TTL)) {
      return _dashboardCache.notifications.data;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false) // Only fetch unread for the count
      .order('date', { ascending: false });

    if (error) {
      console.error(`Error fetching notifications for user ${userId}:`, error);
      return [];
    }
    const parsed = (data || []).map(parseNotificationFromDB);
    _dashboardCache.notifications = { data: parsed, timestamp: now };
    return parsed;
  },

  async addNotification(notification: Omit<DBNotification, 'id'>): Promise<DBNotification> {
    const dbNotification = {
      user_id: notification.userId,
      work_id: notification.workId || null,
      title: notification.title,
      message: notification.message,
      date: notification.date,
      read: notification.read,
      type: notification.type,
      tag: notification.tag || null,
    };
    const { data, error } = await supabase.from('notifications').insert(dbNotification).select().single();
    if (error) throw error;
    _dashboardCache.notifications = null; // Invalidate global notification cache
    return parseNotificationFromDB(data);
  },

  async dismissNotification(notificationId: string): Promise<void> {
    const { data: notificationToDismiss, error: fetchError } = await supabase.from('notifications').select('user_id').eq('id', notificationId).single();
    if (fetchError || !notificationToDismiss) throw new Error("Notification not found.");

    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    if (error) throw error;
    _dashboardCache.notifications = null; // Invalidate cache to force reload count
  },

  async clearAllNotifications(userId: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw error;
    _dashboardCache.notifications = null; // Invalidate cache
  },

  // --- PUSH SUBSCRIPTIONS ---
  async savePushSubscription(userId: string, subscription: PushSubscriptionJSON): Promise<void> {
    const now = Date.now();
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .upsert(
                { 
                    user_id: userId, 
                    subscription: subscription, 
                    endpoint: subscription.endpoint, // Store endpoint for easier lookup
                    created_at: new Date().toISOString(), // Ensure created_at is set for new records
                },
                { onConflict: 'endpoint' } // Update if endpoint already exists
            )
            .select();

        if (error) {
            console.error("Error saving push subscription:", error);
            throw error;
        }
        _dashboardCache.pushSubscriptions[userId] = null; // Invalidate user's push subscriptions cache
    } catch (error: any) {
        console.error(`Error saving push subscription for user ${userId}:`, error?.message || error);
        throw error;
    }
  },
};
