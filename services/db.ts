
import { PlanType, ExpenseCategory, StepStatus, FileCategory, type User, type Work, type Step, type Material, type Expense, type Worker, type Supplier, type WorkPhoto, type WorkFile, type Notification, type PushSubscriptionInfo } from '../types.ts';
import { WORK_TEMPLATES, FULL_MATERIAL_PACKAGES } from './standards.ts';
import { supabase } from './supabase.ts';

// --- CACHE SYSTEM (IN-MEMORY) ---
const CACHE_TTL = 60000; // Aumentado para 60s para maior estabilidade
const _dashboardCache: {
    works: { data: Work[], timestamp: number } | null;
    stats: Record<string, { data: any, timestamp: number }>;
    summary: Record<string, { data: any, timestamp: number }>;
    notifications: { data: Notification[], timestamp: number } | null;
} = {
    works: null,
    stats: {},
    summary: {},
    notifications: null
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
    realDate: data.real_date, // Added real_date parsing
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
    category: data.category
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
    // FIX: Changed from total_agagreed to total_agreed
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

const parseNotificationFromDB = (data: any): Notification => ({
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

            // FIX: If RLS denies access (42501), return null instead of a partial user.
            // This ensures AuthContext correctly identifies a non-accessible profile,
            // preventing login loops and inconsistent state.
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

            const trialExpires = new Date();
            trialExpires.setDate(trialExpires.getDate() + 7);

            const newProfileData = {
                id: authUser.id,
                name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Novo Usuário',
                email: authUser.email,
                whatsapp: null, // Default to null for new profile
                cpf: null, // Default to null for new profile
                plan: PlanType.MENSAL,
                is_trial: true,
                subscription_expires_at: trialExpires.toISOString()
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
  async getCurrentUser() {
    const client = supabase;
    
    const now = Date.now();
    
    // Capture sessionCache locally for better type narrowing by TypeScript
    const currentSessionCache = sessionCache; 

    // Check if we have a valid cached promise
    // Refactored to address TS2801: check if currentSessionCache is not null
    if (currentSessionCache !== null && (now - currentSessionCache.timestamp < AUTH_CACHE_DURATION)) {
        return currentSessionCache.promise;
    }

    // If no valid cache, create a new promise
    const newPromise = (async () => {
        const { data: { session } } = await client.auth.getSession();
        if (!session?.user) {
            // If no user, ensure sessionCache is null before returning
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

  async syncSession() {
    sessionCache = null; // Invalidate cache to force a fresh fetch
    // FIX: ensure getCurrentUser returns a Promise<User | null>
    const userPromise = this.getCurrentUser();
    // Wait for the promise to resolve before returning, so AuthContext gets the actual user object.
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
            callback(null);
        }
    });
    return () => subscription.unsubscribe();
  },

  async login(email: string, password?: string) {
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

  async signup(name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) {
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

    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 7);

    const newProfileData = {
        id: authData.user.id,
        name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Novo Usuário',
        email: authData.user.email,
        whatsapp: null, // Default to null for new profile
        cpf: null, // Default to null for new profile
        plan: planType || PlanType.MENSAL, 
        is_trial: true,
        subscription_expires_at: trialExpires.toISOString()
    };

    const { error: profileError } = await supabase.from('profiles').insert(newProfileData);

    if (profileError) {
        console.error("Erro ao criar perfil:", profileError);
    }

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
            const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
            if (error) throw new Error("Erro ao atualizar dados: " + error.message);
          }

          // 2. Atualiza a senha SE fornecida (AUTH separado)
          if (newPassword && newPassword.trim() !== '') {
              const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
              if (passError) throw new Error("Erro ao atualizar senha: " + passError.message);
          }
          
          sessionCache = null; // Invalida cache para forçar refresh
      } catch (e: any) { // Explicitly type as any to allow .message access
          console.error("Erro updateUser:", e);
          throw e; // Repassa erro para a UI tratar
      }
  },

  async resetPassword(email: string) {
      // Supabase is guaranteed to be initialized now
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/settings'
      });
      return !error;
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

  async updatePlan(userId: string, plan: PlanType) {
      // Supabase is guaranteed to be initialized now
      
      let expires = new Date();
      if (plan === PlanType.MENSAL) expires.setDate(expires.getDate() + 30);
      if (plan === PlanType.SEMESTRAL) expires.setDate(expires.getDate() + 180);
      if (plan === PlanType.VITALICIO) expires.setFullYear(expires.getFullYear() + 100); // Effectively forever

      await supabase.from('profiles').update({
          plan,
          subscription_expires_at: expires.toISOString(),
          is_trial: false // Após o pagamento do plano, a flag `is_trial` para o app principal é desativada
      }).eq('id', userId);
      
      sessionCache = null; // Invalida cache
  },

  async generatePix(_amount: number, _payer: any) {
      // This is a mock function, no actual Supabase interaction required
      return {
          qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQyF2NgYGBgAAAABQAEV9D3sgAAAABJRU5ErkJggg==",
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

    const { data, error } = await supabase
        .from('works')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error("Erro ao buscar obras:", error);
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

    const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
    if (error) {
        console.error("Erro ao buscar obra por ID:", error);
        return null;
    }
    return data ? parseWorkFromDB(data) : null;
  },

  // NEW: Method to regenerate materials based on work template and area
  async regenerateMaterials(workId: string, area: number, templateId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    try {
        // 1. Delete existing materials for this work
        await supabase.from('materials').delete().eq('work_id', workId);

        // 2. Find the selected work template
        const template = WORK_TEMPLATES.find(t => t.id === templateId);
        if (!template) {
            console.warn(`[REGEN MATERIAL] Template with ID ${templateId} not found.`);
            return;
        }

        const materialsToInsert: Omit<Material, 'id'>[] = [];
        
        // Iterate through included steps (which map to material categories)
        for (const stepName of template.includedSteps) {
            const materialCategory = FULL_MATERIAL_PACKAGES.find(p => p.category === stepName);
            if (materialCategory) {
                for (const item of materialCategory.items) {
                    const multiplier = item.multiplier || 1; // Default multiplier to 1
                    materialsToInsert.push({
                        workId: workId,
                        name: item.name,
                        brand: undefined, // No brand by default
                        plannedQty: Math.ceil(area * multiplier), // Calculate based on work area
                        purchasedQty: 0,
                        unit: item.unit,
                        stepId: undefined, // Assign later if linking to a specific step
                        category: materialCategory.category
                    });
                }
            } else {
                console.warn(`[REGEN MATERIAL] Material package for category "${stepName}" not found.`);
            }
        }
        
        // 3. Insert new materials
        if (materialsToInsert.length > 0) {
            // Bulk insert
            const { error } = await supabase.from('materials').insert(materialsToInsert);
            if (error) {
                console.error("Erro ao inserir materiais gerados:", error);
                throw error;
            }
        }
        
        _dashboardCache.notifications = null; // Invalidate notifications cache due to potential material-related alerts
        console.log(`[REGEN MATERIAL] Materiais para obra ${workId} regenerados com sucesso.`);

    } catch (error: any) {
        console.error(`[REGEN MATERIAL ERROR] Erro ao regenerar materiais para work ${workId}:`, error);
        throw error;
    }
  },

  async createWork(work: Partial<Work>, templateId: string): Promise<Work> {
    // Supabase is guaranteed to be initialized now
    
    const dbWork = {
        user_id: work.userId,
        name: work.name,
        address: work.address,
        budget_planned: work.budgetPlanned,
        start_date: work.startDate,
        end_date: work.endDate,
        area: work.area,
        status: work.status,
        notes: work.notes,
        floors: work.floors,
        bedrooms: work.bedrooms,
        bathrooms: work.bathrooms,
        kitchens: work.kitchens,
        living_rooms: work.livingRooms, // FIX: Changed to snake_case for DB column compatibility
        has_leisure_area: work.hasLeisureArea 
    };

    const { data: savedWork, error } = await supabase.from('works').insert(dbWork).select().single();
    
    if (error) {
        console.error("Erro SQL ao criar obra:", error);
        throw new Error(`Erro ao criar obra: ${error.message}`);
    }
    
    const parsedWork = parseWorkFromDB(savedWork);
    
    // Invalidate Cache
    _dashboardCache.works = null;
    delete _dashboardCache.stats[parsedWork.id]; // Invalidate specific stats for new work
    delete _dashboardCache.summary[parsedWork.id]; // Invalidate specific summary for new work

    // Generate Steps
    const template = WORK_TEMPLATES.find(t => t.id === templateId);
    if (template) {
        const stepsToInsert = template.includedSteps.map((stepName, idx) => {
            const start = new Date(work.startDate!);
            start.setDate(start.getDate() + (idx * 5)); 
            const end = new Date(start);
            end.setDate(end.getDate() + 5);

            return {
                work_id: parsedWork.id,
                name: stepName,
                start_date: start.toISOString().split('T')[0],
                end_date: end.toISOString().split('T')[0],
                status: StepStatus.NOT_STARTED,
                is_delayed: false
            };
        });
        
        await supabase.from('steps').insert(stepsToInsert);
        // FIXED: Now calling the correctly defined method
        await this.regenerateMaterials(parsedWork.id, parsedWork.area, templateId);
    }

    return parsedWork;
  },

  async deleteWork(workId: string) {
    // Supabase is guaranteed to be initialized now

    // Start a transaction (Supabase does not have explicit transactions, but we can do multiple operations)
    try {
        console.log(`[DB DELETE] Iniciando exclusão para workId: ${workId}`);
        await supabase.from('steps').delete().eq('work_id', workId);
        console.log(`[DB DELETE] Etapas para ${workId} deletadas.`);
        await supabase.from('materials').delete().eq('work_id', workId);
        console.log(`[DB DELETE] Materiais para ${workId} deletados.`);
        await supabase.from('expenses').delete().eq('work_id', workId);
        console.log(`[DB DELETE] Despesas para ${workId} deletadas.`);
        await supabase.from('work_photos').delete().eq('work_id', workId);
        console.log(`[DB DELETE] Fotos para ${workId} deletadas.`);
        await supabase.from('work_files').delete().eq('work_id', workId);
        console.log(`[DB DELETE] Arquivos para ${workId} deletados.`);
        // NEW: Delete workers and suppliers tied to this work
        await supabase.from('workers').delete().eq('work_id', workId);
        console.log(`[DB DELETE] Profissionais para ${workId} deletados.`);
        await supabase.from('suppliers').delete().eq('work_id', workId);
        console.log(`[DB DELETE] Fornecedores para ${workId} deletados.`);
        // NEW: Delete notifications tied to this work
        // FIX: Corrected syntax for deleting notifications to avoid TS2554 error
        const { count: deletedNotifsCount, error: notifDeleteError } = await supabase.from('notifications').delete().eq('work_id', workId);
        if (notifDeleteError) {
            console.error(`[DB DELETE] Erro ao deletar notificações para ${workId}:`, notifDeleteError);
        } else {
            console.log(`[DB DELETE] ${deletedNotifsCount || 0} notificações deletadas para ${workId}.`); // Use || 0 as count can be null
        }
        
        const { error } = await supabase.from('works').delete().eq('id', workId);
        if (error) throw error;
        console.log(`[DB DELETE] Obra ${workId} deletada com sucesso.`);
        
        _dashboardCache.works = null; // Invalidate cache
        delete _dashboardCache.stats[workId]; // Invalidate specific stats for deleted work
        delete _dashboardCache.summary[workId]; // Invalidate specific summary for deleted work
        _dashboardCache.notifications = null; // NEW: Invalidate global notification cache
        console.log(`[DB DELETE] Caches para workId ${workId} invalidados.`);

    } catch (error: unknown) { // Fix TS18046: Explicitly type as unknown
        console.error(`[DB DELETE] Erro ao apagar obra e dados relacionados para ${workId}:`, error);
        if (error instanceof Error) {
            throw new Error(`Falha ao apagar obra: ${error.message}`);
        } else {
            throw new Error(`Falha ao apagar obra: Um erro desconhecido ocorreu.`);
        }
    }
  },

  // --- STEPS ---
  async getSteps(workId: string): Promise<Step[]> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('steps').select('*').eq('work_id', workId).order('start_date', { ascending: true });
    if (error) {
      console.error("Erro ao buscar etapas:", error);
      return [];
    }
    return (data || []).map(parseStepFromDB);
  },

  async addStep(step: Omit<Step, 'id'>): Promise<Step | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('steps').insert({
      work_id: step.workId,
      name: step.name,
      start_date: step.startDate, // FIX: Changed to snake_case
      end_date: step.endDate, // FIX: Changed to snake_case
      status: step.status,
      is_delayed: step.isDelayed
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar etapa:", error);
      throw error;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[step.workId];
    delete _dashboardCache.summary[step.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    return parseStepFromDB(data);
  },

  async updateStep(step: Step): Promise<Step | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('steps').update({
      name: step.name,
      start_date: step.startDate,
      end_date: step.endDate,
      status: step.status,
      real_date: step.realDate, // Added real_date parsing
      is_delayed: step.isDelayed
    }).eq('id', step.id).select().single();
    if (error) {
      console.error("Erro ao atualizar etapa:", error);
      throw error;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[step.workId];
    delete _dashboardCache.summary[step.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    return parseStepFromDB(data);
  },

  // --- MATERIALS ---
  async getMaterials(workId: string): Promise<Material[]> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('materials').select('*').eq('work_id', workId).order('category', { ascending: true }).order('name', { ascending: true });
    if (error) {
      console.error("Erro ao buscar materiais:", error);
      return [];
    }
    return (data || []).map(parseMaterialFromDB);
  },

  async addMaterial(material: Omit<Material, 'id'>, purchaseInfo?: {qty: number, cost: number, date: string}): Promise<Material | null> {
    // Supabase is guaranteed to be initialized now
    
    const { data, error } = await supabase.from('materials').insert({
      work_id: material.workId,
      name: material.name,
      brand: material.brand,
      planned_qty: material.plannedQty,
      purchased_qty: purchaseInfo?.qty || 0,
      unit: material.unit,
      step_id: material.stepId, // FIX: Changed to snake_case
      category: material.category
    }).select().single();

    if (error) {
      console.error("Erro ao adicionar material:", error);
      throw error;
    }

    if (purchaseInfo && data) {
      // Also record as an expense
      await this.addExpense({
        workId: material.workId,
        description: `Compra de ${material.name}`,
        amount: purchaseInfo.cost,
        date: new Date().toISOString(),
        category: ExpenseCategory.MATERIAL,
        relatedMaterialId: data.id,
        stepId: material.stepId
      });
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[material.workId];
    delete _dashboardCache.summary[material.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    return parseMaterialFromDB(data);
  },

  async updateMaterial(material: Material): Promise<Material | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('materials').update({
      name: material.name,
      brand: material.brand,
      planned_qty: material.plannedQty,
      purchased_qty: material.purchasedQty,
      unit: material.unit,
      step_id: material.stepId, // This is already snake_case
      category: material.category
    }).eq('id', material.id).select().single();
    if (error) {
      console.error("Erro ao atualizar material:", error);
      throw error;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[material.workId];
    delete _dashboardCache.summary[material.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    return parseMaterialFromDB(data);
  },

  async registerMaterialPurchase(materialId: string, name: string, brand: string | undefined, plannedQty: number, unit: string, qty: number, cost: number): Promise<void> {
    // Supabase is guaranteed to be initialized now

    // 1. Update material's purchased quantity
    const { data: existingMaterial, error: fetchError } = await supabase
        .from('materials')
        .select('purchased_qty, work_id, step_id')
        .eq('id', materialId)
        .single();

    if (fetchError || !existingMaterial) {
        console.error("Erro ao buscar material para compra:", fetchError);
        throw fetchError;
    }

    const newPurchasedQty = existingMaterial.purchased_qty + qty;
    const { error: updateError } = await supabase
        .from('materials')
        .update({ purchased_qty: newPurchasedQty })
        .eq('id', materialId);
    
    if (updateError) {
        console.error("Erro ao atualizar qtd comprada de material:", updateError);
        throw updateError;
    }

    // 2. Record as an expense
    await this.addExpense({
      workId: existingMaterial.work_id,
      description: `Compra de ${name} (${qty} ${unit})`,
      amount: cost,
      date: new Date().toISOString(),
      category: ExpenseCategory.MATERIAL,
      relatedMaterialId: materialId,
      stepId: existingMaterial.step_id
    });
    // Invalidate cache for work stats/summary after purchase
    delete _dashboardCache.stats[existingMaterial.work_id];
    delete _dashboardCache.summary[existingMaterial.work_id];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
  },

  // --- EXPENSES ---
  async getExpenses(workId: string): Promise<Expense[]> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('expenses').select('*').eq('work_id', workId).order('date', { ascending: false });
    if (error) {
      console.error("Erro ao buscar despesas:", error);
      return [];
    }
    return (data || []).map(parseExpenseFromDB);
  },

  async addExpense(expense: Omit<Expense, 'id'>): Promise<Expense | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('expenses').insert({
      work_id: expense.workId,
      description: expense.description,
      amount: expense.amount,
      paid_amount: expense.paidAmount || expense.amount, // Ensure paid_amount is set
      quantity: expense.quantity || 1, // Default quantity to 1 if not provided
      date: expense.date,
      category: expense.category,
      step_id: expense.stepId, // FIX: Changed to snake_case
      related_material_id: expense.relatedMaterialId, // FIX: Changed to snake_case
      worker_id: expense.workerId, // FIX: Changed to snake_case
      supplier_id: expense.supplierId, // NEW: Added supplier_id
      total_agreed: expense.totalAgreed // FIX: Changed to snake_case
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar despesa:", error);
      throw error;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[expense.workId];
    delete _dashboardCache.summary[expense.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    return parseExpenseFromDB(data);
  },

  async updateExpense(expense: Expense): Promise<Expense | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('expenses').update({
      description: expense.description,
      amount: expense.amount,
      paid_amount: expense.paidAmount || expense.amount,
      quantity: expense.quantity,
      date: expense.date,
      category: expense.category,
      step_id: expense.stepId, // This is already snake_case
      related_material_id: expense.relatedMaterialId, // This is already snake_case
      worker_id: expense.workerId, // This is already snake_case
      supplier_id: expense.supplierId, // NEW: Added supplier_id
      total_agreed: expense.totalAgreed
    }).eq('id', expense.id).select().single();
    if (error) {
      console.error("Erro ao atualizar despesa:", error);
      throw error;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[expense.workId];
    delete _dashboardCache.summary[expense.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    return parseExpenseFromDB(data);
  },

  async deleteExpense(expenseId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const { data: deletedExpense, error: deleteError } = await supabase.from('expenses').delete().eq('id', expenseId).select('work_id').single();
    if (deleteError) {
      console.error("Erro ao apagar despesa:", deleteError);
      throw deleteError;
    }
    if (deletedExpense) {
        // Invalidate cache for work stats/summary of the work where the expense was deleted
        delete _dashboardCache.stats[deletedExpense.work_id];
        delete _dashboardCache.summary[deletedExpense.work_id];
        _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    }
  },

  // --- WORKERS ---
  async getWorkers(workId: string): Promise<Worker[]> { // NEW: Accepts workId
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('workers').select('*').eq('work_id', workId).order('name', { ascending: true }); // NEW: Filter by work_id
    if (error) {
      console.error("Erro ao buscar profissionais:", error);
      return [];
    }
    return (data || []).map(parseWorkerFromDB);
  },

  async addWorker(worker: Omit<Worker, 'id'>): Promise<Worker | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('workers').insert({
      user_id: worker.userId,
      work_id: worker.workId, // NEW: Include work_id
      name: worker.name,
      role: worker.role,
      phone: worker.phone,
      daily_rate: worker.dailyRate,
      notes: worker.notes
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar profissional:", error);
      throw error;
    }
    return parseWorkerFromDB(data);
  },

  async updateWorker(worker: Worker): Promise<Worker | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('workers').update({
      name: worker.name,
      role: worker.role,
      phone: worker.phone,
      daily_rate: worker.dailyRate,
      notes: worker.notes
    }).eq('id', worker.id).eq('work_id', worker.workId).select().single(); // NEW: Filter by work_id
    if (error) {
      console.error("Erro ao atualizar profissional:", error);
      throw error;
    }
    return parseWorkerFromDB(data);
  },

  async deleteWorker(workerId: string, workId: string): Promise<void> { // NEW: Accepts workId
    // Supabase is guaranteed to be initialized now
    const { error } = await supabase.from('workers').delete().eq('id', workerId).eq('work_id', workId); // NEW: Filter by work_id
    if (error) {
      console.error("Erro ao apagar profissional:", error);
      throw error;
    }
  },

  // --- SUPPLIERS ---
  async getSuppliers(workId: string): Promise<Supplier[]> { // NEW: Accepts workId
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('suppliers').select('*').eq('work_id', workId).order('name', { ascending: true }); // NEW: Filter by work_id
    if (error) {
      console.error("Erro ao buscar fornecedores:", error);
      return [];
    }
    return (data || []).map(parseSupplierFromDB);
  },

  async addSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('suppliers').insert({
      user_id: supplier.userId,
      work_id: supplier.workId, // NEW: Include work_id
      name: supplier.name,
      category: supplier.category,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      notes: supplier.notes
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar fornecedor:", error);
      throw error;
    }
    return parseSupplierFromDB(data);
  },

  async updateSupplier(supplier: Supplier): Promise<Supplier | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('suppliers').update({
      name: supplier.name,
      category: supplier.category,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      notes: supplier.notes
    }).eq('id', supplier.id).eq('work_id', supplier.workId).select().single(); // NEW: Filter by work_id
    if (error) {
      console.error("Erro ao atualizar fornecedor:", error);
      throw error;
    }
    return parseSupplierFromDB(data);
  },

  async deleteSupplier(supplierId: string, workId: string): Promise<void> { // NEW: Accepts workId
    // Supabase is guaranteed to be initialized now
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId).eq('work_id', workId); // NEW: Filter by work_id
    if (error) {
      console.error("Erro ao apagar fornecedor:", error);
      throw error;
    }
  },

  // --- WORK PHOTOS ---
  async getPhotos(workId: string): Promise<WorkPhoto[]> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('work_photos').select('*').eq('work_id', workId).order('date', { ascending: false });
    if (error) {
      console.error("Erro ao buscar fotos:", error);
      return [];
    }
    return (data || []).map(parsePhotoFromDB);
  },

  async addPhoto(photo: Omit<WorkPhoto, 'id'>): Promise<WorkPhoto | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('work_photos').insert({
      work_id: photo.workId,
      url: photo.url,
      description: photo.description,
      date: photo.date,
      type: photo.type
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar foto:", error);
      throw error;
    }
    return parsePhotoFromDB(data);
  },

  // --- WORK FILES ---
  async getFiles(workId: string): Promise<WorkFile[]> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('work_files').select('*').eq('work_id', workId).order('date', { ascending: false });
    if (error) {
      console.error("Erro ao buscar arquivos:", error);
      return [];
    }
    return (data || []).map(parseFileFromDB);
  },

  async addFile(file: Omit<WorkFile, 'id'>): Promise<WorkFile | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('work_files').insert({
      work_id: file.workId,
      name: file.name,
      category: file.category,
      url: file.url,
      type: file.type,
      date: file.date
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar arquivo:", error);
      throw error;
    }
    return parseFileFromDB(data);
  },

  // --- NOTIFICATIONS ---
  async getNotifications(userId: string): Promise<Notification[]> {
    // Supabase is guaranteed to be initialized now
    
    const now = Date.now();
    if (_dashboardCache.notifications && (now - _dashboardCache.notifications.timestamp < CACHE_TTL)) {
        return _dashboardCache.notifications.data;
    }

    const { data, error } = await supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('date', { ascending: false });

    if (error) {
      console.error("Erro ao buscar notificações:", error);
      return [];
    }
    const parsed = (data || []).map(parseNotificationFromDB);
    _dashboardCache.notifications = { data: parsed, timestamp: now };
    return parsed;
  },

  async addNotification(notification: Omit<Notification, 'id'>): Promise<Notification | null> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('notifications').insert({
      user_id: notification.userId,
      work_id: notification.workId, // NEW: Include work_id
      title: notification.title,
      message: notification.message,
      date: notification.date,
      read: notification.read,
      type: notification.type,
      tag: notification.tag // NEW: Save the tag to DB
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar notificação:", error.message, error.details, error.code, "Full Error Object:", error); // Log more details
      throw error;
    }
    _dashboardCache.notifications = null; // Invalidate cache
    return parseNotificationFromDB(data);
  },

  async dismissNotification(notificationId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const { error } = await supabase.from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    if (error) {
      console.error("Erro ao dispensar notificação:", error);
      throw error;
    }
    _dashboardCache.notifications = null; // Invalidate cache
  },

  async clearAllNotifications(userId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const { error } = await supabase.from('notifications')
      .update({ read: true })
      .eq('user_id', userId);
    if (error) {
      console.error("Erro ao limpar notificações:", error);
      throw error;
    }
    _dashboardCache.notifications = null; // Invalidate cache
  },

  // --- DASHBOARD STATS ---
  async calculateWorkStats(workId: string): Promise<{ totalSpent: number, progress: number, delayedSteps: number }> {
    // Supabase is guaranteed to be initialized now

    const now = Date.now();
    if (_dashboardCache.stats[workId] && (now - _dashboardCache.stats[workId].timestamp < CACHE_TTL)) {
        return _dashboardCache.stats[workId].data;
    }

    const [expensesData, stepsData, workData] = await Promise.all([
      supabase.from('expenses').select('amount').eq('work_id', workId),
      supabase.from('steps').select('id, status, end_date').eq('work_id', workId),
      supabase.from('works').select('budget_planned').eq('id', workId).single()
    ]);

    if (expensesData.error || stepsData.error || workData.error) {
      console.error("Erro ao calcular stats da obra:", expensesData.error || stepsData.error || workData.error);
      return { totalSpent: 0, progress: 0, delayedSteps: 0 };
    }

    const totalSpent = expensesData.data.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalSteps = stepsData.data.length;
    const completedSteps = stepsData.data.filter(s => s.status === StepStatus.COMPLETED).length;
    
    const today = new Date().toISOString().split('T')[0];
    const delayedSteps = stepsData.data.filter(s => s.status !== StepStatus.COMPLETED && s.end_date < today).length;

    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const stats = { totalSpent, progress, delayedSteps };
    _dashboardCache.stats[workId] = { data: stats, timestamp: now };
    return stats;
  },

  async getDailySummary(workId: string): Promise<{ completedSteps: number, delayedSteps: number, pendingMaterials: number, totalSteps: number }> {
    // Supabase is guaranteed to be initialized now

    // Corrected `Date.Now()` to `Date.now()`
    const now = Date.now();
    if (_dashboardCache.summary[workId] && (now - _dashboardCache.summary[workId].timestamp < CACHE_TTL)) {
        return _dashboardCache.summary[workId].data;
    }

    const [stepsData, materialsData] = await Promise.all([
      supabase.from('steps').select('id, status, end_date').eq('work_id', workId),
      supabase.from('materials').select('id, planned_qty, purchased_qty, step_id, name').eq('work_id', workId) // Fetch name and step_id
    ]);

    if (stepsData.error || materialsData.error) {
      console.error("Erro ao buscar summary da obra:", stepsData.error || materialsData.error);
      return { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 };
    }

    const totalSteps = stepsData.data.length;
    const completedSteps = stepsData.data.filter(s => s.status === StepStatus.COMPLETED).length;
    
    const today = new Date().toISOString().split('T')[0];
    const delayedSteps = stepsData.data.filter(s => s.status !== StepStatus.COMPLETED && s.end_date < today).length;

    const pendingMaterials = materialsData.data.filter(m => m.purchased_qty < m.planned_qty).length;

    const summary = { completedSteps, delayedSteps, pendingMaterials, totalSteps };
    _dashboardCache.summary[workId] = { data: summary, timestamp: now };
    return summary;
  },

  // Modificado para aceitar dados pré-carregados, evitando buscas redundantes.
  async generateSmartNotifications(
    userId: string, 
    workId: string, 
    prefetchedSteps?: Step[], 
    prefetchedExpenses?: Expense[], 
    prefetchedMaterials?: Material[], 
    prefetchedWork?: Work
  ): Promise<void> {
    // Supabase is guaranteed to be initialized now
    
    try {
        console.log(`[NOTIF DEBUG START] =================================================`);
        console.log(`[NOTIF DEBUG START] Generating smart notifications for User: ${userId}, Work: ${workId}`);

        // Usa dados pré-carregados se disponíveis, senão busca do DB.
        const currentSteps = prefetchedSteps || await this.getSteps(workId);
        // FIX: Corrected typo from `prefetfetchedMaterials` to `prefetchedMaterials`.
        const currentMaterials = prefetchedMaterials || await this.getMaterials(workId);
        const currentExpenses = prefetchedExpenses || await this.getExpenses(workId); // Added for budget check
        const currentWork = prefetchedWork || await this.getWorkById(workId);

        if (!currentWork) {
            console.warn(`[NOTIF DEBUG] Work ${workId} not found. Skipping notification generation.`);
            console.log(`[NOTIF DEBUG END] ===================================================`);
            return;
        }

        console.log(`[NOTIF DEBUG] Processing work "${currentWork.name}" (ID: ${currentWork.id})`);
        console.log(`[NOTIF DEBUG] Total steps fetched for this work: ${currentSteps.length}`);
        currentSteps.forEach(s => console.log(`  - Step: ${s.name} (ID: ${s.id}, WorkID: ${s.workId}, Status: ${s.status}, Start: ${s.startDate}, End: ${s.endDate})`));
        console.log(`[NOTIF DEBUG] Total materials fetched for this work: ${currentMaterials.length}`);
        currentMaterials.forEach(m => console.log(`  - Material: ${m.name} (ID: ${m.id}, WorkID: ${m.workId}, StepID: ${m.stepId}, Planned: ${m.plannedQty}, Purchased: ${m.purchasedQty})`));


        // --- INÍCIO DA CORREÇÃO DA LÓGICA DE DATAS ---
        const getLocalMidnightDate = (dateString: string) => {
            const [year, month, day] = dateString.split('-').map(Number);
            return new Date(year, month - 1, day, 0, 0, 0, 0); // Local midnight
        };

        const todayLocalMidnight = new Date();
        todayLocalMidnight.setHours(0, 0, 0, 0); // Local midnight today
        const todayDateString = todayLocalMidnight.toISOString().split('T')[0]; // For daily tag

        const threeDaysFromNowLocalMidnight = new Date();
        threeDaysFromNowLocalMidnight.setDate(threeDaysFromNowLocalMidnight.getDate() + 3);
        threeDaysFromNowLocalMidnight.setHours(0, 0, 0, 0); // Local midnight 3 days from now (inclusive)
        // --- FIM DA CORREÇÃO DA LÓGICA DE DATAS ---


        // Example: Notification for delayed steps (existing logic, no changes)
        const delayedSteps = currentSteps.filter(s => {
            const stepEndDate = getLocalMidnightDate(s.endDate);
            return s.status !== StepStatus.COMPLETED && stepEndDate < todayLocalMidnight;
        });
        console.log(`[NOTIF DEBUG] Delayed steps identified for work "${currentWork.name}": ${delayedSteps.map(s => s.name).join(', ') || 'Nenhum'}`);


        for (const step of delayedSteps) {
            const notificationTag = `work-${workId}-delayed-step-${step.id}`; // Unique tag for this notification
            const { data: existingNotif } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', userId)
                .eq('work_id', workId) // NEW: Ensure to check for work_id here
                .eq('tag', notificationTag) // Use tag for unique check
                .eq('read', false)
                .maybeSingle();

            if (!existingNotif) {
                console.log(`[NOTIF GENERATION] Adding delayed step notification: "${step.name}" for work "${currentWork.name}"`); // Debug log
                await this.addNotification({
                    userId,
                    workId, // NEW: Add workId to notification
                    title: 'Etapa Atrasada!',
                    message: `A etapa "${step.name}" da obra "${currentWork.name}" está atrasada. Verifique o cronograma!`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'WARNING',
                    tag: notificationTag // Save tag
                });
                await dbService.sendPushNotification(userId, {
                    title: 'Etapa Atrasada!',
                    body: `A etapa "${step.name}" da obra "${currentWork.name}" está atrasada. Verifique o cronograma!`,
                    url: `${window.location.origin}/work/${workId}`,
                    tag: notificationTag
                });
            }
        }

        // Example: Notification for upcoming steps (within 3 days, not started - existing logic, no changes)
        const upcomingSteps = currentSteps.filter(s => {
            const stepStartDate = getLocalMidnightDate(s.startDate);
            return (
                s.status === StepStatus.NOT_STARTED && 
                stepStartDate >= todayLocalMidnight && // Starts today or in the future
                stepStartDate <= threeDaysFromNowLocalMidnight // Starts within the next 3 days (inclusive of day 3)
            );
        });
        console.log(`[NOTIF DEBUG] Upcoming steps identified (within 3 days) for work "${currentWork.name}": ${upcomingSteps.map(s => s.name).join(', ') || 'Nenhum'}`);


        for (const step of upcomingSteps) {
            // Calculate days until start for more precise message
            const daysUntilStart = Math.ceil((getLocalMidnightDate(step.startDate).getTime() - todayLocalMidnight.getTime()) / (1000 * 60 * 60 * 24));

            const notificationTag = `work-${workId}-upcoming-step-${step.id}-${todayDateString}`; // NEW: Add daily tag
            const { data: existingNotif } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', userId)
                .eq('work_id', workId) // NEW: Ensure to check for work_id here
                .eq('tag', notificationTag) // Use tag for unique check
                .eq('read', false)
                .maybeSingle();

            if (!existingNotif) {
                console.log(`[NOTIF GENERATION] Adding upcoming step notification: "${step.name}" for work "${currentWork.name}"`); // Debug log
                await this.addNotification({
                    userId,
                    workId, // NEW: Add workId to notification
                    // FIX: Improved phrasing
                    title: `Próxima Etapa: ${step.name}!`,
                    message: `A etapa "${step.name}" da obra "${currentWork.name}" inicia em ${daysUntilStart} dia(s). Prepare-se!`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'INFO',
                    tag: notificationTag // Save tag
                });
                await dbService.sendPushNotification(userId, {
                    title: `Próxima Etapa: ${step.name}!`,
                    body: `A etapa "${step.name}" da obra "${currentWork.name}" inicia em ${daysUntilStart} dia(s). Prepare-se!`,
                    url: `${window.location.origin}/work/${workId}`,
                    tag: notificationTag
                });
            }
        }


        // NEW LOGIC: Notification for material running low, specifically for upcoming steps (within 3 days)
        // FIX: Ensure this logic runs for materials tied to *truly* upcoming steps
        for (const step of upcomingSteps) { 
            const materialsForStep = currentMaterials.filter(m => m.stepId === step.id);
            console.log(`[NOTIF DEBUG] Checking materials for upcoming step "${step.name}". Tag: ${step.id}. Existing unread notif: ${!!materialsForStep}`);

            for (const material of materialsForStep) {
                // FIX: Ensure plannedQty is greater than 0 to avoid division by zero and irrelevant notifications
                if (material.plannedQty > 0 && material.purchasedQty < material.plannedQty) {
                    // Only notify if still more than 20% to purchase
                    if ((material.purchasedQty / material.plannedQty) < 0.8) {
                        // FIX: Add current date to the tag to ensure daily re-notification if not dismissed/resolved
                        const notificationTag = `work-${workId}-low-material-${material.id}-${step.id}-${todayDateString}`; 

                        const { data: existingNotif } = await supabase
                            .from('notifications')
                            .select('id')
                            .eq('user_id', userId)
                            .eq('work_id', workId) // NEW: Ensure to check for work_id here
                            .eq('tag', notificationTag) 
                            .eq('read', false)
                            .maybeSingle();
                        
                        console.log(`[NOTIF DEBUG] Checking material "${material.name}" for step "${step.name}". Tag: ${notificationTag}. Existing unread notif: ${!!existingNotif}`);

                        if (!existingNotif) {
                            console.log(`[NOTIF GENERATION] Adding low material notification: "${material.name}" for step "${step.name}" (Work: "${currentWork.name}")`); // Debug log
                            await this.addNotification({
                                userId,
                                workId, // NEW: Add workId to notification
                                // FIX: Improved phrasing
                                title: `Atenção: Material em falta para a etapa ${step.name}!`,
                                message: `O material "${material.name}" (${material.purchasedQty}/${material.plannedQty} ${material.unit}) para a etapa "${step.name}" da obra "${currentWork.name}" está em falta. Faça a compra!`,
                                date: new Date().toISOString(),
                                read: false,
                                type: 'WARNING',
                                tag: notificationTag 
                            });
                            await dbService.sendPushNotification(userId, {
                                title: `Atenção: Material em falta para a etapa ${step.name}!`,
                                body: `O material "${material.name}" (${material.purchasedQty}/${material.plannedQty} ${material.unit}) para a etapa "${step.name}" da obra "${currentWork.name}" está em falta. Faça a compra!`,
                                url: `${window.location.origin}/work/${workId}/materials`,
                                tag: notificationTag
                            });
                        }
                    }
                }
            }
        }


        // Example: Notification for budget usage (existing logic, no changes)
        if (currentWork && currentWork.budgetPlanned > 0) {
            const totalSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
            const budgetUsage = (totalSpent / currentWork.budgetPlanned) * 100;

            if (budgetUsage > 90 && budgetUsage <= 100) {
                 const notificationTag = `work-${workId}-budget-warning`; // Unique tag
                 const { data: existingNotif } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('work_id', workId) // NEW: Ensure to check for work_id here
                    .eq('tag', notificationTag) // Use tag for unique check
                    .eq('read', false)
                    .maybeSingle();

                if (!existingNotif) {
                    console.log(`[NOTIF GENERATION] Adding budget warning notification for work "${currentWork.name}"`); // Debug log
                    await this.addNotification({
                        userId,
                        workId, // NEW: Add workId to notification
                        title: 'Atenção ao Orçamento!',
                        message: `Você já usou ${Math.round(budgetUsage)}% do orçamento da obra "${currentWork.name}".`,
                        date: new Date().toISOString(),
                        read: false,
                        type: 'WARNING',
                        tag: notificationTag // Save tag
                    });
                    await dbService.sendPushNotification(userId, {
                        title: 'Atenção ao Orçamento!',
                        body: `Você já usou ${Math.round(budgetUsage)}% do orçamento da obra "${currentWork.name}".`,
                        url: `${window.location.origin}/work/${workId}/financial`,
                        tag: notificationTag
                    });
                }
            } else if (budgetUsage > 100) {
                 const notificationTag = `work-${workId}-budget-exceeded`; // Unique tag
                 const { data: existingNotif } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('work_id', workId) // NEW: Ensure to check for work_id here
                    .eq('tag', notificationTag) // Use tag for unique check
                    .eq('read', false)
                    .maybeSingle();
                
                if (!existingNotif) {
                    console.log(`[NOTIF GENERATION] Adding budget exceeded notification for work "${currentWork.name}"`); // Debug log
                    await this.addNotification({
                        userId,
                        workId, // NEW: Add workId to notification
                        title: 'Orçamento Estourado!',
                        message: `O orçamento da obra "${currentWork.name}" foi excedido em ${Math.round(budgetUsage - 100)}%.`,
                        date: new Date().toISOString(),
                        read: false,
                        type: 'ERROR',
                        tag: notificationTag // Save tag
                    });
                    await dbService.sendPushNotification(userId, {
                        title: 'Orçamento Estourado!',
                        body: `O orçamento da obra "${currentWork.name}" foi excedido em ${Math.round(budgetUsage - 100)}%.`,
                        url: `${window.location.origin}/work/${workId}/financial`,
                        tag: notificationTag
                    });
                }
            }
        }
        console.log(`[NOTIF DEBUG END] ===================================================`);

    } catch (error: any) { // Explicitly type as any to allow .message access
        console.error(`[NOTIF DEBUG ERROR] Erro ao gerar notificações inteligentes para work ${workId}:`, error);
        console.log(`[NOTIF DEBUG END] ===================================================`);

    }
  },

  // --- NEW: PWA Push Notification Management ---
  async getPushSubscription(userId: string): Promise<PushSubscriptionInfo | null> {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error("Erro ao buscar PushSubscription:", error);
      return null;
    }
    return data ? mapPushSubscriptionFromDB(data) : null;
  },

  async savePushSubscription(userId: string, subscription: PushSubscriptionJSON): Promise<void> {
    // Chamada para o endpoint serverless que salvará a subscription no Supabase.
    // Isso evita expor a chave VAPID_PUBLIC_KEY no cliente para fins de subscribe.
    try {
        const response = await fetch('/api/subscribe-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, subscription }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao salvar a assinatura de push.');
        }
        console.log("PushSubscription salva com sucesso!");
    } catch (error: any) {
        console.error("Erro ao salvar PushSubscription:", error);
        throw error;
    }
  },

  async deletePushSubscription(userId: string, endpoint: string): Promise<void> {
    try {
        const response = await fetch('/api/subscribe-push', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, endpoint }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao remover a assinatura de push.');
        }
        console.log("PushSubscription removida com sucesso!");
    } catch (error: any) {
        console.error("Erro ao remover PushSubscription:", error);
        throw error;
    }
  },

  async sendPushNotification(userId: string, notificationPayload: { title: string, body: string, url?: string, tag?: string }): Promise<void> {
    try {
        const response = await fetch('/api/send-event-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, ...notificationPayload }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao enviar push notification de evento.');
        }
        console.log("Push notification de evento enviada para o usuário:", userId);
    } catch (error: any) {
        console.error("Erro ao enviar push notification de evento:", error);
        // Não relança o erro, pois a falha na notificação não deve impedir a funcionalidade principal
    }
  },

};