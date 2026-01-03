import { PlanType, ExpenseCategory, StepStatus, FileCategory, type User, type Work, type Step, type Material, type Expense, type Worker, type Supplier, type WorkPhoto, type WorkFile, type DBNotification, type PushSubscriptionInfo, type Contract, type Checklist, type ChecklistItem } from '../types.ts';
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

const parseStepFromDB = (data: any): Step => ({
    id: data.id,
    workId: data.work_id,
    name: data.name,
    startDate: data.start_date,
    endDate: data.end_date,
    // Fix: Ensure null from DB is mapped to undefined for optional string properties
    realDate: data.real_date || undefined,
    status: data.status,
    isDelayed: data.is_delayed
});

const parseMaterialFromDB = (data: any): Material => ({
    id: data.id,
    workId: data.work_id,
    name: data.name,
    brand: data.brand,
    plannedQty: Number(data.planned_qty || 0),
    purchasedQty: Number(data.purchased_qty || 0),
    unit: data.unit,
    stepId: data.step_id,
    category: data.category,
    totalCost: Number(data.total_cost || 0) // NEW: Parse total_cost
});

const parseExpenseFromDB = (data: any): Expense => ({
    id: data.id,
    workId: data.work_id,
    description: data.description,
    amount: Number(data.amount || 0),
    paidAmount: Number(data.paid_amount || 0), // Added paidAmount parsing
    quantity: Number(data.quantity || 0), // Added quantity parsing
    date: data.date,
    category: data.category,
    stepId: data.step_id,
    relatedMaterialId: data.related_material_id,
    workerId: data.worker_id, // Added workerId parsing
    supplierId: data.supplier_id, // NEW: Added supplierId for financial reports
    totalAgreed: data.total_agreed ? Number(data.total_agreed) : undefined 
});

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

// NEW: Helper para mapear nome de etapa dinâmica para categoria de material genérica
const getMaterialCategoryFromStepName = (stepName: string): string => {
  // Regras para etapas dinâmicas
  if (stepName.includes('Limpeza do terreno')) return 'Limpeza do terreno';
  if (stepName.includes('Fundações')) return 'Fundações';
  if (stepName.includes('Levantamento de paredes')) return 'Levantamento de paredes'; // Genérico para dinâmica
  if (stepName.includes('Lajes e Vigas')) return 'Lajes e Vigas'; // Genérico para dinâmica
  if (stepName.includes('Telhado')) return 'Telhado';
  if (stepName.includes('Tubulação de Água/Esgoto Geral')) return 'Tubulação de Água/Esgoto Geral';
  if (stepName.includes('Fiação Elétrica Geral')) return 'Fiação Elétrica Geral';
  if (stepName.includes('Chapisco e Reboco')) return 'Chapisco e Reboco';
  if (stepName.includes('Contrapiso')) return 'Contrapiso';
  if (stepName.includes('Impermeabilização Geral')) return 'Impermeabilização Geral';
  if (stepName.includes('Gesso / Forro Geral')) return 'Gesso / Forro Geral';
  if (stepName.includes('Pisos e Revestimentos Geral')) return 'Pisos e Revestimentos Geral';
  if (stepName.includes('Esquadrias (Janelas/Portas)')) return 'Esquadrias (Janelas/Portas)';
  if (stepName.includes('Marmoraria Geral (Bancadas)')) return 'Marmoraria Geral (Bancadas)';
  if (stepName.includes('Pintura Paredes/Tetos')) return 'Pintura Paredes/Tetos'; 
  if (stepName.includes('Instalação de Louças e Metais Geral')) return 'Instalação de Louças e Metais Geral';
  if (stepName.includes('Instalação de Luminárias')) return 'Instalação de Luminárias';
  if (stepName.includes('Demolição de Banheiro')) return 'Demolição de Banheiro';
  if (stepName.includes('Hidráulica de Banheiro')) return 'Hidráulica de Banheiro';
  if (stepName.includes('Elétrica de Banheiro')) return 'Elétrica de Banheiro';
  if (stepName.includes('Impermeabilização de Banheiro')) return 'Impermeabilização de Banheiro';
  if (stepName.includes('Contrapiso de Banheiro')) return 'Contrapiso de Banheiro';
  if (stepName.includes('Pisos e Revestimentos de Banheiro')) return 'Pisos e Revestimentos de Banheiro';
  if (stepName.includes('Gesso / Forro de Banheiro')) return 'Gesso / Forro de Banheiro';
  if (stepName.includes('Bancada de Banheiro')) return 'Bancada de Banheiro';
  if (stepName.includes('Louças e Metais de Banheiro')) return 'Louças e Metais de Banheiro';
  if (stepName.includes('Demolição de Cozinha')) return 'Demolição de Cozinha';
  if (stepName.includes('Hidráulica de Cozinha')) return 'Hidráulica de Cozinha';
  if (stepName.includes('Elétrica de Cozinha')) return 'Elétrica de Cozinha';
  if (stepName.includes('Pisos e Revestimentos de Cozinha')) return 'Pisos e Revestimentos de Cozinha';
  if (stepName.includes('Bancada de Cozinha')) return 'Bancada de Cozinha';
  if (stepName.includes('Louças e Metais de Cozinha')) return 'Louças e Metais de Cozinha';
  if (stepName.includes('Preparação de Superfície (Lixar/Massa)')) return 'Preparação de Superfície (Lixar/Massa)';
  if (stepName.includes('Proteção do Piso para Pintura')) return 'Proteção do Piso para Pintura';
  if (stepName.includes('Limpeza Final e Entrega')) return 'Limpeza Final e Entrega'; // Nova etapa geral

  // Fallback
  return stepName;
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

            // CRITICAL FIX: NEW PROFILE CREATION MUST BE PLAN-AGNOSTIC
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
    });

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

  // NEW: Method to regenerate materials based on work attributes and steps
  async regenerateMaterials(work: Work, createdSteps: Step[]): Promise<void> {
    // Supabase is guaranteed to be initialized now
    try {
        // 1. Delete existing materials for this work
        await supabase.from('materials').delete().eq('work_id', work.id);

        const materialsToInsert: any[] = [];
        
        // Iterate through the actual created steps
        for (const step of createdSteps) {
            const materialCategoryName = getMaterialCategoryFromStepName(step.name);
            const materialCategory = FULL_MATERIAL_PACKAGES.find(p => p.category === materialCategoryName);

            if (materialCategory) {
                for (const item of materialCategory.items) {
                    let calculatedQty = 0;

                    if (item.flat_qty) {
                        calculatedQty = item.flat_qty;
                    } else {
                        // Base calculation (e.g., per m² of area)
                        calculatedQty = work.area * item.multiplier;

                        // Adjust based on room counts if applicable to this step/category
                        if (step.name.includes('Banheiro') && work.bathrooms && work.bathrooms > 0) {
                            calculatedQty *= work.bathrooms;
                        } else if (step.name.includes('Cozinha') && work.kitchens && work.kitchens > 0) {
                            calculatedQty *= work.kitchens;
                        } else if (step.name.includes('Quarto') && work.bedrooms && work.bedrooms > 0) { // Future proofing
                            calculatedQty *= work.bedrooms;
                        } else if (step.name.includes('Sala') && work.livingRooms && work.livingRooms > 0) { // Future proofing
                            calculatedQty *= work.livingRooms;
                        }

                        // Adjust for floors if applicable (e.g., for slabs, general walls)
                        if (step.name.includes('Lajes e Vigas') && work.floors && work.floors > 1) { // If multi-floor slab
                            calculatedQty *= (work.floors -1); // Adjust for intermediate slabs
                        } else if (step.name.includes('Levantamento de paredes') && work.floors && work.floors > 1) {
                             // Assuming multiplier is for one floor, scale with floors
                             calculatedQty *= work.floors;
                        }
                    }
                    
                    // Ensure min 1 if calculated > 0, and round up
                    calculatedQty = Math.ceil(Math.max(0, calculatedQty));
                    if (calculatedQty === 0 && item.multiplier > 0) calculatedQty = 1; // Ensure at least 1 unit if material has a multiplier but calculated to 0

                    materialsToInsert.push({
                        work_id: work.id, 
                        name: item.name,
                        brand: undefined, 
                        planned_qty: calculatedQty, 
                        purchased_qty: 0, 
                        unit: item.unit,
                        step_id: step.id, // Link material to the specific step
                        category: materialCategory.category,
                        total_cost: 0 // Initialize total_cost
                    });
                }
            } else {
                console.warn(`[REGEN MATERIAL] Pacote de material para categoria "${materialCategoryName}" (baseado na etapa "${step.name}") não encontrado.`);
            }
        }
        
        // 3. Insert new materials
        if (materialsToInsert.length > 0) {
            const { error: insertMaterialsError } = await supabase.from('materials').insert(materialsToInsert);
            if (insertMaterialsError) {
                console.error("Erro ao inserir materiais gerados:", insertMaterialsError);
                throw insertMaterialsError;
            }
        }
        
        // Invalidate caches
        _dashboardCache.materials[work.id] = null; 
        _dashboardCache.expenses[work.id] = null; // NEW: Invalidate expenses cache after regenerating materials
        console.log(`[REGEN MATERIAL] Materiais para obra ${work.id} regenerados com sucesso.`);

    } catch (error: any) {
        console.error(`[REGEN MATERIAL ERROR] Erro ao regenerar materiais para work ${work.id}:`, error);
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
    const numFloors = parsedWork.floors || 1; // Garante pelo menos 1 pavimento
    const numBathrooms = parsedWork.bathrooms || 0;
    const numKitchens = parsedWork.kitchens || 0;

    if (template.id === 'CONSTRUCAO') {
        // Base steps for construction, explicitly excluding demolition
        finalStepNames.push('Limpeza do terreno', 'Fundações');

        // Dynamic floor/wall steps
        for (let i = 0; i < numFloors; i++) {
            if (i === 0) { // Ground floor
                finalStepNames.push('Levantamento de paredes (Térreo)');
            } else { // Intermediate floors
                finalStepNames.push(`Lajes e Vigas (Piso ${i + 1}º Pavimento)`); 
                finalStepNames.push(`Levantamento de paredes (${i + 1}º Pavimento)`);
            }
        }
        if (numFloors > 0) { // Roof slab/structure always after walls
            finalStepNames.push('Lajes e Vigas (Cobertura)');
            finalStepNames.push('Telhado');
        }

        // Interior steps - filter out general ones if specific room steps will cover them
        const generalInteriorSteps = [
            'Tubulação de Água/Esgoto Geral',
            'Fiação Elétrica Geral',
            'Chapisco e Reboco',
            'Contrapiso',
            'Impermeabilização Geral',
            'Gesso / Forro Geral',
            'Pisos e Revestimentos Geral',
            'Esquadrias (Janelas/Portas)',
            'Marmoraria Geral (Bancadas)',
            'Pintura Paredes/Tetos',
            'Instalação de Louças e Metais Geral',
            'Instalação de Luminárias',
        ];

        // Flags to check if specific room steps are being added
        const willHaveSpecificBathroomPlumbing = numBathrooms > 0;
        const willHaveSpecificKitchenPlumbing = numKitchens > 0;

        generalInteriorSteps.forEach(stepName => {
            let shouldAdd = true;
            // If specific bathrooms exist, don't add general plumbing/electrical/finishing/countertops/fixtures that would be covered
            if (willHaveSpecificBathroomPlumbing) {
                if (stepName.includes('Tubulação de Água/Esgoto Geral') || stepName.includes('Fiação Elétrica Geral') ||
                    stepName.includes('Pisos e Revestimentos Geral') || stepName.includes('Marmoraria Geral (Bancadas)') ||
                    stepName.includes('Instalação de Louças e Metais Geral') || stepName.includes('Gesso / Forro Geral') || 
                    stepName.includes('Contrapiso') || stepName.includes('Impermeabilização Geral')) { // Add general waterproofing/gypsum/subfloor to filter
                    shouldAdd = false;
                }
            }
            // If specific kitchens exist, don't add general plumbing/electrical/finishing/countertops/fixtures that would be covered
            if (willHaveSpecificKitchenPlumbing) {
                 if (stepName.includes('Tubulação de Água/Esgoto Geral') || stepName.includes('Fiação Elétrica Geral') ||
                    stepName.includes('Pisos e Revestimentos Geral') || stepName.includes('Marmoraria Geral (Bancadas)') ||
                    stepName.includes('Instalação de Louças e Metais Geral') || stepName.includes('Gesso / Forro Geral') ||
                    stepName.includes('Contrapiso')) { // Add general gypsum/subfloor to filter
                    shouldAdd = false;
                }
            }
            if (shouldAdd) {
                finalStepNames.push(stepName);
            }
        });

        // Add specific room steps
        for (let i = 0; i < numBathrooms; i++) {
            finalStepNames.push(
                // Demolition is for renovation, not new construction
                `Hidráulica de Banheiro (B${i + 1})`,
                `Elétrica de Banheiro (B${i + 1})`,
                `Impermeabilização de Banheiro (B${i + 1})`,
                `Contrapiso de Banheiro (B${i + 1})`,
                `Pisos e Revestimentos de Banheiro (B${i + 1})`,
                `Gesso / Forro de Banheiro (B${i + 1})`,
                `Bancada de Banheiro (B${i + 1})`,
                `Louças e Metais de Banheiro (B${i + 1})`
            );
        }
        for (let i = 0; i < numKitchens; i++) {
            finalStepNames.push(
                // Demolition is for renovation, not new construction
                `Hidráulica de Cozinha (C${i + 1})`,
                `Elétrica de Cozinha (C${i + 1})`,
                `Pisos e Revestimentos de Cozinha (C${i + 1})`,
                `Bancada de Cozinha (C${i + 1})`,
                `Louças e Metais de Cozinha (C${i + 1})`
            );
        }

        finalStepNames.push('Limpeza Final e Entrega');

        // Calculate effective default duration based on dynamic elements
        effectiveDefaultDurationDays = template.defaultDurationDays;
        effectiveDefaultDurationDays += (numFloors > 1 ? numFloors - 1 : 0) * 20; // 20 days per additional floor (after ground)
        effectiveDefaultDurationDays += numBathrooms * 10; // 10 days per bathroom
        effectiveDefaultDurationDays += numKitchens * 10; // 10 days per kitchen

    } else if (template.id === 'REFORMA_APTO') {
        finalStepNames.push('Demolição', 'Retirada de entulho'); // Base for renovation, includes demolition

        // Interior steps - similar filtering as construction if specific rooms exist
        const generalInteriorRenovationSteps = [
            'Tubulação de Água/Esgoto Geral',
            'Fiação Elétrica Geral',
            'Gesso / Forro Geral',
            'Pisos e Revestimentos Geral',
            'Marmoraria Geral (Bancadas)',
            'Pintura Paredes/Tetos',
            'Instalação de Louças e Metais Geral',
            'Instalação de Luminárias',
        ];

        // Flags to check if specific room steps are being added
        const willHaveSpecificBathroomRenovation = numBathrooms > 0;
        const willHaveSpecificKitchenRenovation = numKitchens > 0;

        generalInteriorRenovationSteps.forEach(stepName => {
            let shouldAdd = true;
            if (willHaveSpecificBathroomRenovation) {
                if (stepName.includes('Tubulação de Água/Esgoto Geral') || stepName.includes('Fiação Elétrica Geral') ||
                    stepName.includes('Pisos e Revestimentos Geral') || stepName.includes('Marmoraria Geral (Bancadas)') ||
                    stepName.includes('Instalação de Louças e Metais Geral') || stepName.includes('Gesso / Forro Geral')) {
                    shouldAdd = false;
                }
            }
            if (willHaveSpecificKitchenRenovation) {
                 if (stepName.includes('Tubulação de Água/Esgoto Geral') || stepName.includes('Fiação Elétrica Geral') ||
                    stepName.includes('Pisos e Revestimentos Geral') || stepName.includes('Marmoraria Geral (Bancadas)') ||
                    stepName.includes('Instalação de Louças e Metais Geral') || stepName.includes('Gesso / Forro Geral')) {
                    shouldAdd = false;
                }
            }
            if (shouldAdd) {
                finalStepNames.push(stepName);
            }
        });

        // Add specific room steps
        for (let i = 0; i < numBathrooms; i++) {
            finalStepNames.push(
                `Demolição de Banheiro (B${i + 1})`,
                `Hidráulica de Banheiro (B${i + 1})`,
                `Elétrica de Banheiro (B${i + 1})`,
                `Impermeabilização de Banheiro (B${i + 1})`,
                `Contrapiso de Banheiro (B${i + 1})`,
                `Pisos e Revestimentos de Banheiro (B${i + 1})`,
                `Gesso / Forro de Banheiro (B${i + 1})`,
                `Bancada de Banheiro (B${i + 1})`,
                `Louças e Metais de Banheiro (B${i + 1})`
            );
        }
        for (let i = 0; i < numKitchens; i++) {
            finalStepNames.push(
                `Demolição de Cozinha (C${i + 1})`,
                `Hidráulica de Cozinha (C${i + 1})`,
                `Elétrica de Cozinha (C${i + 1})`,
                `Pisos e Revestimentos de Cozinha (C${i + 1})`,
                `Bancada de Cozinha (C${i + 1})`,
                `Louças e Metais de Cozinha (C${i + 1})`
            );
        }
        finalStepNames.push('Limpeza Final e Entrega'); // Final step

        // Calculate effective default duration based on dynamic elements
        effectiveDefaultDurationDays = template.defaultDurationDays;
        effectiveDefaultDurationDays += numBathrooms * 7; // 7 days per bathroom
        effectiveDefaultDurationDays += numKitchens * 7; // 7 days per kitchen

    } else { // For single room templates (BANHEIRO, COZINHA, PINTURA, etc.)
        finalStepNames = [...template.includedSteps]; 
        effectiveDefaultDurationDays = template.defaultDurationDays;
        // No additional duration for rooms/floors as it's a specific, confined template
    }

    // Calcula a endDate com base nas etapas generadas
    const startDate = new Date(workData.startDate!);
    const calculatedEndDate = new Date(startDate);
    calculatedEndDate.setDate(startDate.getDate() + effectiveDefaultDurationDays);
    finalEndDate = calculatedEndDate.toISOString().split('T')[0];

    // Atualiza a obra com a data final calculada
    const { error: updateWorkError } = await supabase.from('works').update({ end_date: finalEndDate }).eq('id', parsedWork.id);
    if (updateWorkError) {
        console.error("Erro ao atualizar data final da obra:", updateWorkError);
        // Não jogamos erro crítico, a obra já foi criada
    }
    // Atualiza o objeto parsedWork para refletir a nova data final
    parsedWork.endDate = finalEndDate;


    // CRITICAL: Ensure step start/end dates are calculated correctly AND consecutively
    let currentStepStartDate = new Date(workData.startDate!);
    const stepsToInsert = finalStepNames.map((stepName, idx) => {
        // Calculate duration for this specific step (average distribution)
        const stepDuration = Math.round(effectiveDefaultDurationDays / finalStepNames.length); 
        
        const stepEndDate = new Date(currentStepStartDate);
        stepEndDate.setDate(currentStepStartDate.getDate() + Math.max(1, stepDuration) -1); // Ensure at least 1 day, subtract 1 for inclusive end date

        const stepToInsert = {
            work_id: parsedWork.id,
            name: stepName,
            start_date: currentStepStartDate.toISOString().split('T')[0],
            end_date: stepEndDate.toISOString().split('T')[0],
            status: StepStatus.NOT_STARTED,
            is_delayed: false
        };

        // Set start date for the next step to be the day after the current step's end date
        currentStepStartDate.setDate(stepEndDate.getDate() + 1); 

        return stepToInsert;
    });
    
    const { data: createdStepsData, error: stepsError } = await supabase.from('steps').insert(stepsToInsert).select('*');
    if (stepsError) {
      console.error("Erro ao inserir etapas:", stepsError);
      // Even if steps fail, try to proceed with materials to avoid blocking entirely
    }
    const createdSteps = (createdStepsData || []).map(parseStepFromDB);

    // FIX: Agora chamando a função regenerateMaterials com a lista real de etapas criadas E O OBJETO WORK
    await this.regenerateMaterials(parsedWork, createdSteps); 

    return parsedWork;
  },

  async deleteWork(workId: string) {
    // Supabase is guaranteed to be initialized now
    console.log(`[DB DELETE] Iniciando exclusão transacional para workId: ${workId}`);

    try {
        // Sequência de deleções para evitar erros de chave estrangeira
        const deleteOperations = [
            { table: 'work_files', eq: ['work_id', workId] },
            { table: 'work_photos', eq: ['work_id', workId] },
            { table: 'expenses', eq: ['work_id', workId] },
            { table: 'materials', eq: ['work_id', workId] },
            { table: 'steps', eq: ['work_id', workId] },
            { table: 'workers', eq: ['work_id', workId] },
            { table: 'suppliers', eq: ['work_id', workId] },
            { table: 'notifications', eq: ['work_id', workId] },
            // NEW: Delete checklists associated with the work
            { table: 'checklists', eq: ['work_id', workId] },
            { table: 'works', eq: ['id', workId] } // Por último, a obra principal
        ];

        for (const op of deleteOperations) {
            console.log(`[DB DELETE] Tentando deletar da tabela '${op.table}' onde ${op.eq[0]} = '${op.eq[1]}'`);
            const { data = [], error: deleteOpError } = await supabase.from(op.table).delete().eq(op.eq[0], op.eq[1]).select('*');
            const count = data ? data.length : 0;
            if (deleteOpError) {
                // Logar o erro específico de RLS ou DB.
                console.error(`[DB DELETE ERROR] Falha ao deletar da tabela '${op.table}' para workId ${workId}:`, deleteOpError);
                throw new Error(`Falha de RLS/DB ao deletar ${op.table}: ${deleteOpError.message}`);
            }
            console.log(`[DB DELETE] Tabela '${op.table}' limpa. Registros afetados: ${count}`);
        }
        
        console.log(`[DB DELETE] Obra ${workId} e dados relacionados deletados com sucesso.`);
        
        _dashboardCache.works = null; // Invalidate cache
        delete _dashboardCache.stats[workId]; // Invalidate specific stats for deleted work
        delete _dashboardCache.summary[workId]; // Invalidate specific summary for deleted work
        _dashboardCache.notifications = null; // Invalidate global notification cache
        _dashboardCache.steps[workId] = null; // NEW: Invalidate steps cache for this workId
        _dashboardCache.materials[workId] = null; // NEW: Invalidate materials cache for this workId
        _dashboardCache.expenses[workId] = null; // NEW: Invalidate expenses cache for this workId
        _dashboardCache.workers[workId] = null; // NEW
        _dashboardCache.suppliers[workId] = null; // NEW
        _dashboardCache.photos[workId] = null; // NEW
        _dashboardCache.files[workId] = null; // NEW
        _dashboardCache.checklists[workId] = null; // NEW
        console.log(`[DB DELETE] Caches para workId ${workId} invalidados.`);

    } catch (error: unknown) { // Explicitly type as unknown
        console.error(`[DB DELETE CRITICAL] Erro fatal ao apagar obra e dados relacionados para ${workId}:`, error);
        if (error instanceof Error) {
            // Relança um erro mais claro para o frontend
            throw new Error(`Falha ao apagar obra: ${error.message}. Verifique suas permissões de RLS ou logs do servidor.`);
        } else {
            throw new Error(`Falha ao apagar obra: Um erro desconhecido ocorreu.`);
        }
    }
  },

  // --- DASHBOARD STATS ---
  async calculateWorkStats(workId: string): Promise<{ totalSpent: number; progress: number; delayedSteps: number }> {
    const now = Date.now();
    const cacheKey = `stats-${workId}`;
    if (_dashboardCache.stats[cacheKey] && (now - _dashboardCache.stats[cacheKey].timestamp < CACHE_TTL)) {
      return _dashboardCache.stats[cacheKey].data;
    }

    const [steps, expenses] = await Promise.all([
      this.getSteps(workId),
      this.getExpenses(workId),
    ]);

    const totalSpent = expenses.reduce((sum, expense) => sum + (expense.paidAmount || 0), 0);
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const totalSteps = steps.length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    const today = new Date().toISOString().split('T')[0];
    const delayedSteps = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < today).length;

    const stats = { totalSpent, progress, delayedSteps };
    _dashboardCache.stats[cacheKey] = { data: stats, timestamp: now };
    return stats;
  },

  async getDailySummary(workId: string): Promise<{ completedSteps: number; delayedSteps: number; pendingMaterials: number; totalSteps: number }> {
    const now = Date.now();
    const cacheKey = `summary-${workId}`;
    if (_dashboardCache.summary[cacheKey] && (now - _dashboardCache.summary[cacheKey].timestamp < CACHE_TTL)) {
      return _dashboardCache.summary[cacheKey].data;
    }

    const [steps, materials] = await Promise.all([
      this.getSteps(workId),
      this.getMaterials(workId),
    ]);

    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const today = new Date().toISOString().split('T')[0];
    const delayedSteps = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < today).length;
    const pendingMaterials = materials.filter(m => m.purchasedQty < m.plannedQty).length;

    const summary = { completedSteps, delayedSteps, pendingMaterials, totalSteps };
    _dashboardCache.summary[cacheKey] = { data: summary, timestamp: now };
    return summary;
  },


  // --- STEPS ---
  async getSteps(workId: string): Promise<Step[]> {
    // Supabase is guaranteed to be initialized now
    const now = Date.now();
    if (_dashboardCache.steps[workId] && (now - _dashboardCache.steps[workId].timestamp < CACHE_TTL)) {
        console.log(`[CACHE HIT] getSteps for workId ${workId}`);
        return _dashboardCache.steps[workId].data;
    }

    console.log(`[dbService.getSteps] Fetching steps for work: ${workId}`); // Log para depuração
    const { data, error: fetchStepsError } = await supabase.from('steps').select('*').eq('work_id', workId).order('start_date', { ascending: true });
        
    if (fetchStepsError) {
        console.error(`[dbService.getSteps] Erro ao buscar etapas para work ${workId}:`, fetchStepsError);
        return [];
    }
    const parsed = (data || []).map(parseStepFromDB);
    _dashboardCache.steps[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async getStepById(stepId: string): Promise<Step | null> {
    // Check cache first
    for (const workId in _dashboardCache.steps) {
      if (_dashboardCache.steps[workId]?.data) {
        const cached = _dashboardCache.steps[workId].data.find(s => s.id === stepId);
        if (cached) return cached;
      }
    }
    const { data, error } = await supabase.from('steps').select('*').eq('id', stepId).single();
    if (error) return null;
    return data ? parseStepFromDB(data) : null;
  },

  async addStep(stepData: Omit<Step, 'id'>): Promise<Step> {
    const { data, error } = await supabase.from('steps').insert({
      work_id: stepData.workId,
      name: stepData.name,
      start_date: stepData.startDate,
      end_date: stepData.endDate,
      status: stepData.status,
      is_delayed: stepData.isDelayed
    }).select().single();
    if (error) throw error;
    _dashboardCache.steps[stepData.workId] = null; // Invalidate cache
    _dashboardCache.stats[stepData.workId] = null; // Invalidate stats cache
    _dashboardCache.summary[stepData.workId] = null; // Invalidate summary cache
    return parseStepFromDB(data);
  },

  async updateStep(stepData: Step): Promise<Step> {
    const { data, error } = await supabase.from('steps').update({
      name: stepData.name,
      start_date: stepData.startDate,
      end_date: stepData.endDate,
      real_date: stepData.realDate || null,
      status: stepData.status,
      is_delayed: stepData.isDelayed
    }).eq('id', stepData.id).select().single();
    if (error) throw error;
    _dashboardCache.steps[stepData.workId] = null; // Invalidate cache
    _dashboardCache.stats[stepData.workId] = null; // Invalidate stats cache
    _dashboardCache.summary[stepData.workId] = null; // Invalidate summary cache
    return parseStepFromDB(data);
  },

  async deleteStep(stepId: string, workId: string): Promise<void> {
    // Delete associated materials first
    await supabase.from('materials').delete().eq('step_id', stepId);
    // Delete associated expenses
    await supabase.from('expenses').delete().eq('step_id', stepId);
    // Delete associated checklists
    await supabase.from('checklists').delete().eq('category', (await this.getStepById(stepId))?.name || ''); // Use step name as category
    
    const { error } = await supabase.from('steps').delete().eq('id', stepId);
    if (error) throw error;
    _dashboardCache.steps[workId] = null; // Invalidate cache
    _dashboardCache.materials[workId] = null; // Invalidate materials cache
    _dashboardCache.expenses[workId] = null; // Invalidate expenses cache
    _dashboardCache.stats[workId] = null; // Invalidate stats cache
    _dashboardCache.summary[workId] = null; // Invalidate summary cache
    _dashboardCache.checklists[workId] = null; // Invalidate checklists cache
  },

  // --- MATERIALS ---
  async getMaterials(workId: string): Promise<Material[]> {
    const now = Date.now();
    if (_dashboardCache.materials[workId] && (now - _dashboardCache.materials[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.materials[workId].data;
    }
    const { data, error } = await supabase.from('materials').select('*').eq('work_id', workId).order('created_at', { ascending: false });
    if (error) return [];
    const parsed = (data || []).map(parseMaterialFromDB);
    _dashboardCache.materials[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addMaterial(materialData: Omit<Material, 'id'>): Promise<Material> {
    const { data, error } = await supabase.from('materials').insert({
      work_id: materialData.workId,
      name: materialData.name,
      brand: materialData.brand,
      planned_qty: materialData.plannedQty,
      purchased_qty: materialData.purchasedQty,
      unit: materialData.unit,
      step_id: materialData.stepId,
      category: materialData.category,
      total_cost: materialData.totalCost || 0 // Initialize total_cost
    }).select().single();
    if (error) throw error;
    _dashboardCache.materials[materialData.workId] = null; // Invalidate cache
    _dashboardCache.summary[materialData.workId] = null; // Invalidate summary cache
    return parseMaterialFromDB(data);
  },

  async updateMaterial(materialData: Material): Promise<Material> {
    const { data, error } = await supabase.from('materials').update({
      name: materialData.name,
      brand: materialData.brand,
      planned_qty: materialData.plannedQty,
      purchased_qty: materialData.purchasedQty,
      unit: materialData.unit,
      step_id: materialData.stepId,
      category: materialData.category,
      total_cost: materialData.totalCost || 0 // Ensure total_cost is updated
    }).eq('id', materialData.id).select().single();
    if (error) throw error;
    _dashboardCache.materials[materialData.workId] = null; // Invalidate cache
    _dashboardCache.summary[materialData.workId] = null; // Invalidate summary cache
    return parseMaterialFromDB(data);
  },

  async deleteMaterial(materialId: string): Promise<void> {
    // Check if there are any expenses associated with this material
    const { data: expenses, error: expenseCheckError } = await supabase.from('expenses').select('id').eq('related_material_id', materialId);
    if (expenseCheckError) throw expenseCheckError;
    if (expenses && expenses.length > 0) {
      throw new Error("Não é possível excluir o material pois existem despesas financeiras associadas a ele. Exclua as despesas primeiro.");
    }
    
    const { data: deletedMaterial, error } = await supabase.from('materials').delete().eq('id', materialId).select().single();
    if (error) throw error;
    if (deletedMaterial) {
      _dashboardCache.materials[deletedMaterial.work_id] = null; // Invalidate cache
      _dashboardCache.summary[deletedMaterial.work_id] = null; // Invalidate summary cache
    }
  },

  async registerMaterialPurchase(
    materialId: string, 
    materialName: string, 
    brand: string | undefined, 
    plannedQty: number, 
    unit: string, 
    purchasedQty: number, 
    purchaseCost: number
  ): Promise<Expense> {
    const { data: currentMaterial, error: fetchError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    if (fetchError || !currentMaterial) throw fetchError || new Error("Material not found.");

    const newPurchasedQty = currentMaterial.purchased_qty + purchasedQty;
    const newTotalCost = (currentMaterial.total_cost || 0) + purchaseCost;

    // Update material's purchased quantity and total cost
    const { data: updatedMaterial, error: updateMaterialError } = await supabase
      .from('materials')
      .update({
        purchased_qty: newPurchasedQty,
        total_cost: newTotalCost 
      })
      .eq('id', materialId)
      .select().single();

    if (updateMaterialError || !updatedMaterial) throw updateMaterialError || new Error("Failed to update material after purchase.");

    // Create an expense entry for this purchase
    const { data: newExpense, error: addExpenseError } = await supabase
      .from('expenses')
      .insert({
        work_id: updatedMaterial.work_id,
        description: `Compra de ${materialName} (${purchasedQty} ${unit})`,
        amount: purchaseCost,
        paid_amount: purchaseCost,
        quantity: purchasedQty,
        date: new Date().toISOString().split('T')[0],
        category: ExpenseCategory.MATERIAL,
        related_material_id: materialId,
        step_id: updatedMaterial.step_id,
        total_agreed: purchaseCost // For material purchases, total_agreed usually equals amount
      })
      .select().single();

    if (addExpenseError) throw addExpenseError;

    _dashboardCache.materials[updatedMaterial.work_id] = null; // Invalidate cache
    _dashboardCache.expenses[updatedMaterial.work_id] = null; // Invalidate cache
    _dashboardCache.stats[updatedMaterial.work_id] = null; // Invalidate stats cache
    return parseExpenseFromDB(newExpense);
  },

  // --- EXPENSES ---
  async getExpenses(workId: string): Promise<Expense[]> {
    // Fix: Changed Date.Now() to Date.now()
    const now = Date.now();
    if (_dashboardCache.expenses[workId] && (now - _dashboardCache.expenses[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.expenses[workId].data;
    }
    const { data, error } = await supabase.from('expenses').select('*').eq('work_id', workId).order('date', { ascending: false });
    if (error) return [];
    const parsed = (data || []).map(parseExpenseFromDB);
    _dashboardCache.expenses[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
    const { data, error } = await supabase.from('expenses').insert({
      work_id: expenseData.workId,
      description: expenseData.description,
      amount: expenseData.amount,
      paid_amount: expenseData.paidAmount || 0,
      quantity: expenseData.quantity || 1,
      date: expenseData.date,
      category: expenseData.category,
      related_material_id: expenseData.relatedMaterialId,
      step_id: expenseData.stepId,
      worker_id: expenseData.workerId,
      supplier_id: expenseData.supplierId,
      total_agreed: expenseData.totalAgreed || expenseData.amount
    }).select().single();
    if (error) throw error;
    _dashboardCache.expenses[expenseData.workId] = null; // Invalidate cache
    _dashboardCache.stats[expenseData.workId] = null; // Invalidate stats cache
    return parseExpenseFromDB(data);
  },

  async updateExpense(expenseData: Expense): Promise<Expense> {
    const { data, error } = await supabase.from('expenses').update({
      description: expenseData.description,
      amount: expenseData.amount,
      paid_amount: expenseData.paidAmount || 0,
      quantity: expenseData.quantity || 1,
      date: expenseData.date,
      category: expenseData.category,
      related_material_id: expenseData.relatedMaterialId,
      step_id: expenseData.stepId,
      worker_id: expenseData.workerId,
      supplier_id: expenseData.supplierId,
      total_agreed: expenseData.totalAgreed || expenseData.amount
    }).eq('id', expenseData.id).select().single();
    if (error) throw error;
    _dashboardCache.expenses[expenseData.workId] = null; // Invalidate cache
    _dashboardCache.stats[expenseData.workId] = null; // Invalidate stats cache
    return parseExpenseFromDB(data);
  },

  async deleteExpense(expenseId: string): Promise<void> {
    const { data: expenseToDelete, error: fetchError } = await supabase.from('expenses').select('work_id, related_material_id').eq('id', expenseId).single();
    if (fetchError) throw fetchError;
    if (expenseToDelete?.related_material_id) {
      throw new Error("Não é possível excluir esta despesa, pois ela é um lançamento automático de compra de material. Edite a compra do material para ajustar o valor.");
    }
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) throw error;
    _dashboardCache.expenses[expenseToDelete.work_id] = null; // Invalidate cache
    _dashboardCache.stats[expenseToDelete.work_id] = null; // Invalidate stats cache
  },

  async addPaymentToExpense(expenseId: string, paymentAmount: number, paymentDate: string): Promise<Expense> {
    const { data: currentExpense, error: fetchError } = await supabase
      .from('expenses')
      .select('work_id, amount, paid_amount, total_agreed')
      .eq('id', expenseId)
      .single();
    
    if (fetchError || !currentExpense) throw fetchError || new Error("Despesa não encontrada.");

    const newPaidAmount = (currentExpense.paid_amount || 0) + paymentAmount;
    const totalAgreed = currentExpense.total_agreed || currentExpense.amount;

    if (newPaidAmount > totalAgreed) {
        throw new Error(`O valor do pagamento excede o saldo a pagar. Saldo: ${totalAgreed - (currentExpense.paid_amount || 0)}`);
    }

    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update({
        paid_amount: newPaidAmount,
        // No need to update date here, as paymentDate is for the payment transaction, not the original expense date
      })
      .eq('id', expenseId)
      .select().single();
    
    if (updateError) throw updateError;

    // Optionally, you might want to record individual payment transactions in a separate table.
    // For simplicity, we are just updating the `paid_amount` on the expense itself.

    _dashboardCache.expenses[currentExpense.work_id] = null; // Invalidate cache
    _dashboardCache.stats[currentExpense.work_id] = null; // Invalidate stats cache
    return parseExpenseFromDB(updatedExpense);
  },

  // --- WORKERS ---
  async getWorkers(workId: string): Promise<Worker[]> {
    const now = Date.now();
    if (_dashboardCache.workers[workId] && (now - _dashboardCache.workers[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.workers[workId].data;
    }
    const { data, error } = await supabase.from('workers').select('*').eq('work_id', workId).order('name', { ascending: true });
    if (error) return [];
    const parsed = (data || []).map(parseWorkerFromDB);
    _dashboardCache.workers[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addWorker(workerData: Omit<Worker, 'id'>): Promise<Worker> {
    const { data, error } = await supabase.from('workers').insert({
      user_id: workerData.userId,
      work_id: workerData.workId,
      name: workerData.name,
      role: workerData.role,
      phone: workerData.phone,
      daily_rate: workerData.dailyRate,
      notes: workerData.notes
    }).select().single();
    if (error) throw error;
    _dashboardCache.workers[workerData.workId] = null; // Invalidate cache
    return parseWorkerFromDB(data);
  },

  async updateWorker(workerData: Worker): Promise<Worker> {
    const { data, error } = await supabase.from('workers').update({
      name: workerData.name,
      role: workerData.role,
      phone: workerData.phone,
      daily_rate: workerData.dailyRate,
      notes: workerData.notes
    }).eq('id', workerData.id).select().single();
    if (error) throw error;
    _dashboardCache.workers[workerData.workId] = null; // Invalidate cache
    return parseWorkerFromDB(data);
  },

  async deleteWorker(workerId: string, workId: string): Promise<void> {
    const { error } = await supabase.from('workers').delete().eq('id', workerId);
    if (error) throw error;
    _dashboardCache.workers[workId] = null; // Invalidate cache
  },

  // --- SUPPLIERS ---
  async getSuppliers(workId: string): Promise<Supplier[]> {
    const now = Date.now();
    if (_dashboardCache.suppliers[workId] && (now - _dashboardCache.suppliers[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.suppliers[workId].data;
    }
    const { data, error } = await supabase.from('suppliers').select('*').eq('work_id', workId).order('name', { ascending: true });
    if (error) return [];
    const parsed = (data || []).map(parseSupplierFromDB);
    _dashboardCache.suppliers[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addSupplier(supplierData: Omit<Supplier, 'id'>): Promise<Supplier> {
    const { data, error } = await supabase.from('suppliers').insert({
      user_id: supplierData.userId,
      work_id: supplierData.workId,
      name: supplierData.name,
      category: supplierData.category,
      phone: supplierData.phone,
      email: supplierData.email,
      address: supplierData.address,
      notes: supplierData.notes
    }).select().single();
    if (error) throw error;
    _dashboardCache.suppliers[supplierData.workId] = null; // Invalidate cache
    return parseSupplierFromDB(data);
  },

  async updateSupplier(supplierData: Supplier): Promise<Supplier> {
    const { data, error } = await supabase.from('suppliers').update({
      name: supplierData.name,
      category: supplierData.category,
      phone: supplierData.phone,
      email: supplierData.email,
      address: supplierData.address,
      notes: supplierData.notes
    }).eq('id', supplierData.id).select().single();
    if (error) throw error;
    _dashboardCache.suppliers[supplierData.workId] = null; // Invalidate cache
    return parseSupplierFromDB(data);
  },

  async deleteSupplier(supplierId: string, workId: string): Promise<void> {
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) throw error;
    _dashboardCache.suppliers[workId] = null; // Invalidate cache
  },

  // --- WORK PHOTOS ---
  async getPhotos(workId: string): Promise<WorkPhoto[]> {
    const now = Date.now();
    if (_dashboardCache.photos[workId] && (now - _dashboardCache.photos[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.photos[workId].data;
    }
    const { data, error } = await supabase.from('work_photos').select('*').eq('work_id', workId).order('date', { ascending: false });
    if (error) return [];
    const parsed = (data || []).map(parsePhotoFromDB);
    _dashboardCache.photos[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addPhoto(photoData: Omit<WorkPhoto, 'id'>): Promise<WorkPhoto> {
    const { data, error } = await supabase.from('work_photos').insert({
      work_id: photoData.workId,
      url: photoData.url,
      description: photoData.description,
      date: photoData.date,
      type: photoData.type
    }).select().single();
    if (error) throw error;
    _dashboardCache.photos[photoData.workId] = null; // Invalidate cache
    return parsePhotoFromDB(data);
  },

  async deletePhoto(photoId: string): Promise<void> {
    const { data: deletedPhoto, error } = await supabase.from('work_photos').delete().eq('id', photoId).select().single();
    if (error) throw error;
    if (deletedPhoto) {
      _dashboardCache.photos[deletedPhoto.work_id] = null; // Invalidate cache
    }
  },

  // --- WORK FILES ---
  async getFiles(workId: string): Promise<WorkFile[]> {
    const now = Date.now();
    if (_dashboardCache.files[workId] && (now - _dashboardCache.files[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.files[workId].data;
    }
    const { data, error } = await supabase.from('work_files').select('*').eq('work_id', workId).order('date', { ascending: false });
    if (error) return [];
    const parsed = (data || []).map(parseFileFromDB);
    _dashboardCache.files[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addFile(fileData: Omit<WorkFile, 'id'>): Promise<WorkFile> {
    const { data, error } = await supabase.from('work_files').insert({
      work_id: fileData.workId,
      name: fileData.name,
      category: fileData.category,
      url: fileData.url,
      type: fileData.type,
      date: fileData.date
    }).select().single();
    if (error) throw error;
    _dashboardCache.files[fileData.workId] = null; // Invalidate cache
    return parseFileFromDB(data);
  },

  async deleteFile(fileId: string): Promise<void> {
    const { data: deletedFile, error } = await supabase.from('work_files').delete().eq('id', fileId).select().single();
    if (error) throw error;
    if (deletedFile) {
      _dashboardCache.files[deletedFile.work_id] = null; // Invalidate cache
    }
  },

  // --- CONTRACTS ---
  async getContractTemplates(): Promise<Contract[]> {
    // This uses a static list of templates, no DB fetching needed.
    // However, we cache it for consistency with other `get` methods.
    const now = Date.now();
    if (_dashboardCache.contracts && (now - _dashboardCache.contracts.timestamp < CACHE_TTL)) {
      return _dashboardCache.contracts.data;
    }
    // Deep copy to prevent accidental modification of the standard templates
    const templates = CONTRACT_TEMPLATES.map(template => parseContractFromDB(template)); // Parse the mock data
    _dashboardCache.contracts = { data: templates, timestamp: now };
    return templates;
  },

  // --- CHECKLISTS ---
  async getChecklists(workId: string): Promise<Checklist[]> {
    const now = Date.now();
    if (_dashboardCache.checklists[workId] && (now - _dashboardCache.checklists[workId].timestamp < CACHE_TTL)) {
      return _dashboardCache.checklists[workId].data;
    }
    const { data, error } = await supabase.from('checklists').select('*').eq('work_id', workId).order('name', { ascending: true });
    if (error) return [];
    const parsed = (data || []).map(parseChecklistFromDB);
    _dashboardCache.checklists[workId] = { data: parsed, timestamp: now };
    return parsed;
  },

  async addChecklist(checklistData: Omit<Checklist, 'id'>): Promise<Checklist> {
    const { data, error } = await supabase.from('checklists').insert({
      work_id: checklistData.workId,
      name: checklistData.name,
      category: checklistData.category,
      items: checklistData.items // Direct insert of JSON array
    }).select().single();
    if (error) throw error;
    _dashboardCache.checklists[checklistData.workId] = null; // Invalidate cache
    return parseChecklistFromDB(data);
  },

  async updateChecklist(checklistData: Checklist): Promise<Checklist> {
    const { data, error } = await supabase.from('checklists').update({
      name: checklistData.name,
      category: checklistData.category,
      items: checklistData.items
    }).eq('id', checklistData.id).select().single();
    if (error) throw error;
    _dashboardCache.checklists[checklistData.workId] = null; // Invalidate cache
    return parseChecklistFromDB(data);
  },

  async deleteChecklist(checklistId: string): Promise<void> {
    const { data: deletedChecklist, error } = await supabase.from('checklists').delete().eq('id', checklistId).select().single();
    if (error) throw error;
    if (deletedChecklist) {
      _dashboardCache.checklists[deletedChecklist.work_id] = null; // Invalidate cache
    }
  },

  // --- NOTIFICATIONS & PUSH SUBSCRIPTIONS ---
  async getNotifications(userId: string): Promise<DBNotification[]> {
    const now = Date.now();
    // For the main notifications page, we fetch all notifications, not just unread.
    // The filter for 'unread' is handled by the UI component itself.
    // For consistency with AuthContext, we use 'notifications' cache, but for count it's different.
    // Let's create a separate cache key or always re-fetch for the actual page.
    // For now, disabling cache for full list for simplicity, AuthContext will use its own filtered cached version.

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error("Erro ao buscar notificações não lidas:", error);
      return [];
    }
    const parsed = (data || []).map(parseNotificationFromDB);
    // This cache is specifically for the UNREAD count in AuthContext.
    // For the full list on the Notifications page, we just return the fetched data.
    return parsed;
  },
  
  // Method to get UNREAD notifications for the count in AuthContext, with caching.
  async getUnreadNotifications(userId: string): Promise<DBNotification[]> {
    const now = Date.now();
    if (_dashboardCache.notifications && (now - _dashboardCache.notifications.timestamp < CACHE_TTL)) {
        return _dashboardCache.notifications.data;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false) // Only fetch unread for the dashboard count
      .order('date', { ascending: false });

    if (error) {
      console.error("Erro ao buscar notificações não lidas para o contador:", error);
      return [];
    }
    const parsed = (data || []).map(parseNotificationFromDB);
    _dashboardCache.notifications = { data: parsed, timestamp: now };
    return parsed;
  },

  async savePushSubscription(userId: string, subscription: PushSubscriptionJSON): Promise<void> {
    // Check if subscription already exists for this endpoint
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint)
      .maybeSingle();

    if (fetchError) {
      console.error("Error checking existing subscription:", fetchError);
      throw fetchError;
    }

    if (existingSubscription) {
      console.log("Subscription already exists for this user and endpoint.");
      return; // No need to save again
    }

    // If not existing, insert new subscription
    const { error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        subscription: subscription,
        endpoint: subscription.endpoint,
      });

    if (error) {
      console.error("Error saving push subscription:", error);
      throw error;
    }
    console.log("Push subscription saved successfully.");
  },

  async dismissNotification(notificationId: string): Promise<void> {
    const { data: updatedNotification, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select().single();
    if (error) throw error;
    if (updatedNotification) {
      _dashboardCache.notifications = null; // Invalidate global notification cache for unread count
    }
  },

  async clearAllNotifications(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false); // Only update unread ones
    if (error) throw error;
    _dashboardCache.notifications = null; // Invalidate global notification cache for unread count
  },
};