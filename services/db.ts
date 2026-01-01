

import { PlanType, ExpenseCategory, StepStatus, FileCategory, type User, type Work, type Step, type Material, type Expense, type Worker, type Supplier, type WorkPhoto, type WorkFile, type DBNotification, type PushSubscriptionInfo, type Contract, type Checklist, type ChecklistItem } from './types.ts';
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
} = {
    works: null,
    stats: {},
    summary: {},
    notifications: null,
    steps: {}, // Initialize new cache
    materials: {}, // Initialize new cache
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

// NEW: Helper para mapear nome de etapa dinâmica para categoria de material genérica
const getMaterialCategoryFromStepName = (stepName: string): string => {
  // Regras para etapas dinâmicas
  if (stepName.includes('Levantamento de paredes')) return 'Levantamento de paredes';
  if (stepName.includes('Lajes e Vigas')) return 'Lajes e Vigas';
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
  if (stepName.includes('Pintura Paredes/Tetos')) return 'Pintura Paredes/Tetos'; 
  if (stepName.includes('Preparação de Superfície (Lixar/Massa)')) return 'Preparação de Superfície (Lixar/Massa)';
  if (stepName.includes('Proteção do Piso para Pintura')) return 'Proteção do Piso para Pintura';
  
  // For Telhado, Mantém o nome exact if Telhado is a material category.
  if (stepName.includes('Telhado')) return 'Telhado';

  // Outros casos: retorna o próprio nome da etapa (para correspondência exata)
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
    const userPromise = dbService.getCurrentUser(); // Changed from this.getCurrentUser()
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

  async signup(name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null): Promise<User | null> { // Explicitly set return type
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
        return dbService.login(email, password); // Changed from this.login
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
    _dashboardCache.steps = {}; // NEW: Clear steps cache on logout
    _dashboardCache.materials = {}; // NEW: Clear materials cache on logout
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

  // NEW: Method to regenerate materials based on work template and area
  async regenerateMaterials(workId: string, area: number, createdSteps: Step[]): Promise<void> {
    // Supabase is guaranteed to be initialized now
    try {
        // 1. Delete existing materials for this work
        await supabase.from('materials').delete().eq('work_id', workId);

        const materialsToInsert: any[] = [];
        
        // Iterate through the actual created steps
        for (const step of createdSteps) {
            const materialCategoryName = getMaterialCategoryFromStepName(step.name);
            const materialCategory = FULL_MATERIAL_PACKAGES.find(p => p.category === materialCategoryName);

            if (materialCategory) {
                for (const item of materialCategory.items) {
                    const multiplier = item.multiplier || 1; 
                    materialsToInsert.push({
                        work_id: workId, 
                        name: item.name,
                        brand: undefined, 
                        planned_qty: Math.ceil(area * multiplier), 
                        purchased_qty: 0, 
                        unit: item.unit,
                        step_id: step.id, // Link material to the specific step
                        category: materialCategory.category
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
        _dashboardCache.materials[workId] = null; 
        console.log(`[REGEN MATERIAL] Materiais para obra ${workId} regenerados com sucesso.`);

    } catch (error: any) {
        console.error(`[REGEN MATERIAL ERROR] Erro ao regenerar materiais para work ${workId}:`, error);
        throw error;
    }
  },

  async createWork(workData: Partial<Work>, templateId: string): Promise<Work> {
    // Supabase is guaranteed to be initialized now
    
    // Calcula a data final com base no número de etapas dinamicamente geradas
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


    const template = WORK_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
        throw new Error(`Template de obra com ID ${templateId} não encontrado.`);
    }

    let finalStepNames: string[] = [];
    const numFloors = parsedWork.floors || 1; // Garante pelo menos 1 pavimento

    if (template.id === 'CONSTRUCAO') {
        // Etapas base que são sempre incluídas
        const baseStepsExcludingDynamic = template.includedSteps.filter(name => 
            !name.includes('Limpeza do terreno') &&
            !name.includes('Fundações') &&
            !name.includes('Levantamento de paredes') &&
            !name.includes('Lajes e Vigas') &&
            !name.includes('Telhado') // Telhado será adicionado dinamicamente no final
        );

        finalStepNames.push('Limpeza do terreno');
        finalStepNames.push('Fundações');
        finalStepNames.push('Levantamento de paredes (Térreo)');

        for (let i = 1; i < numFloors; i++) {
            finalStepNames.push(`Lajes e Vigas (Piso ${i}º Pavimento)`);
            finalStepNames.push(`Levantamento de paredes (${i}º Pavimento)`);
        }
        finalStepNames.push('Lajes e Vigas (Cobertura)');
        finalStepNames.push('Telhado'); // Adiciona o telhado uma única vez no final

        finalStepNames = [...finalStepNames, ...baseStepsExcludingDynamic];
        effectiveDefaultDurationDays = finalStepNames.length * 10; // Cerca de 10 dias por etapa
        if (effectiveDefaultDurationDays < template.defaultDurationDays) {
            effectiveDefaultDurationDays = template.defaultDurationDays; // Garante uma duração mínima
        }

    } else {
        finalStepNames = template.includedSteps;
        effectiveDefaultDurationDays = template.defaultDurationDays;
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


    const stepsToInsert = finalStepNames.map((stepName, idx) => {
        const start = new Date(workData.startDate!);
        start.setDate(start.getDate() + (idx * (effectiveDefaultDurationDays / finalStepNames.length))); // Distribui o tempo
        const end = new Date(start);
        end.setDate(end.getDate() + (effectiveDefaultDurationDays / finalStepNames.length) -1); // Define a duração da etapa

        return {
            work_id: parsedWork.id,
            name: stepName,
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
            status: StepStatus.NOT_STARTED,
            is_delayed: false
        };
    });
    
    const { data: createdStepsData, error: stepsError } = await supabase.from('steps').insert(stepsToInsert).select('*');
    if (stepsError) {
      console.error("Erro ao inserir etapas:", stepsError);
    }
    const createdSteps = (createdStepsData || []).map(parseStepFromDB);

    // FIX: Agora chamando a função regenerateMaterials com a lista real de etapas criadas
    await dbService.regenerateMaterials(parsedWork.id, parsedWork.area, createdSteps); 

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

  // --- STEPS ---
  async getSteps(workId: string): Promise<Step[]> {
    // Supabase is guaranteed to be initialized now
    const now = Date.now();
    if (_dashboardCache.steps[workId] && (now - _dashboardCache.steps[workId].timestamp < CACHE_TTL)) {
        console.log(`[CACHE HIT] getSteps for workId ${workId}`);
        return _dashboardCache.steps[workId].data;
    }

    console.log(`[dbService.getSteps] Fetching steps for work: ${workId}`); // Log para depuração
    const { data, error: fetchStepsError } = await supabase.from('steps').select('*').eq('work_id', workId).order('start_date', { ascending: true }); // Renamed error
    if (fetchStepsError) {
      console.error(`[dbService.getSteps] Erro ao buscar etapas para work ${workId}:`, fetchStepsError); // Log de erro mais detalhado
      return [];
    }
    const parsed = (data || []).map(parseStepFromDB);
    _dashboardCache.steps[workId] = { data: parsed, timestamp: now }; // Cache the result
    return parsed;
  },

  async addStep(step: Omit<Step, 'id'>): Promise<Step | null> {
    // Supabase is guaranteed to be initialized now
    const { data: newStepData, error: addStepError } = await supabase.from('steps').insert({ // Renamed data and error
      work_id: step.workId,
      name: step.name,
      start_date: step.startDate, 
      end_date: step.endDate, 
      status: step.status,
      is_delayed: step.isDelayed
    }).select().single();
    if (addStepError) {
      console.error("Erro ao adicionar etapa:", addStepError);
      throw addStepError;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[step.workId];
    delete _dashboardCache.summary[step.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    _dashboardCache.steps[step.workId] = null; // NEW: Invalidate steps cache for this workId
    return parseStepFromDB(newStepData);
  },

  async updateStep(step: Step): Promise<Step | null> {
    // Supabase is guaranteed to be initialized now
    const { data: updatedStepData, error: updateStepError } = await supabase.from('steps').update({ // Renamed data and error
      name: step.name,
      start_date: step.startDate,
      end_date: step.endDate,
      status: step.status,
      real_date: step.realDate, // Added real_date parsing
      is_delayed: step.isDelayed
    }).eq('id', step.id).select().single();
    if (updateStepError) {
      console.error("Erro ao atualizar etapa:", updateStepError);
      throw updateStepError;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[step.workId];
    delete _dashboardCache.summary[step.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    _dashboardCache.steps[step.workId] = null; // NEW: Invalidate steps cache for this workId
    return parseStepFromDB(updatedStepData);
  },

  async deleteStep(stepId: string, workId: string): Promise<void> {
    console.log(`[DB DELETE] Iniciando exclusão para stepId: ${stepId} na workId: ${workId}`);

    // Fetch the step details first to get its name for checklist deletion
    const { data: stepToDelete, error: fetchStepError } = await supabase
        .from('steps')
        .select('*')
        .eq('id', stepId)
        .single();

    if (fetchStepError || !stepToDelete) {
        console.error(`[DB DELETE] Erro ao buscar etapa ${stepId}:`, fetchStepError || 'Etapa não encontrada.');
        throw new Error(`Falha ao buscar etapa: ${fetchStepError?.message || 'Etapa não encontrada.'}`);
    }

    // 1. Obter todos os materiais associados a esta etapa
    const { data: materialsToDelete, error: materialsFetchError } = await supabase
      .from('materials')
      .select('id')
      .eq('step_id', stepId);

    if (materialsFetchError) {
      console.error(`[DB DELETE] Erro ao buscar materiais para stepId ${stepId}:`, materialsFetchError);
      throw new Error(`Falha ao verificar materiais associados à etapa: ${materialsFetchError.message}`);
    }

    const materialIds = materialsToDelete ? materialsToDelete.map(m => m.id) : [];

    // 2. Verificar se existem despesas associadas à etapa ou aos materiais
    const { data: expensesCheck, error: expensesCheckError } = await supabase
      .from('expenses')
      .select('id')
      .or(`step_id.eq.${stepId},related_material_id.in.(${materialIds.join(',')})`);

    if (expensesCheckError) {
      console.error(`[DB DELETE] Erro ao verificar despesas para stepId ${stepId}:`, expensesCheckError);
      throw new Error(`Falha ao verificar despesas associadas à etapa: ${expensesCheckError.message}`);
    }

    if (expensesCheck && expensesCheck.length > 0) {
      const expenseCount = expensesCheck.length;
      throw new Error(`Esta etapa não pode ser excluída pois possui ${expenseCount} lançamento(s) financeiro(s) associado(s). Apague os lançamentos primeiro.`);
    }

    // Se não há despesas associadas, proceed with deletion
    try {
      // 3. Deletar materiais associados (agora sabemos que não há despesas vinculadas a eles)
      if (materialIds.length > 0) {
        const { error: matError } = await supabase.from('materials').delete().in('id', materialIds);
        if (matError) {
          console.error(`[DB DELETE] Erro ao deletar materiais para stepId ${stepId}:`, matError);
          // throw matError; // Decide if you want to be strict or log and continue
        } else {
          console.log(`[DB DELETE] Materiais para stepId ${stepId} deletados.`);
        }
      }

      // NEW: Delete checklists associated with this step
      const { error: checklistDeleteError } = await supabase.from('checklists').delete().eq('work_id', workId).eq('category', stepToDelete.name); // Assuming category links to step name
      if (checklistDeleteError) {
          console.error(`[DB DELETE] Erro ao deletar checklists para stepId ${stepId}:`, checklistDeleteError);
      } else {
          console.log(`[DB DELETE] Checklists para stepId ${stepId} deletados.`);
      }

      // 4. Deletar a própria etapa
      const { error: deleteStepError } = await supabase.from('steps').delete().eq('id', stepId);
      if (deleteStepError) {
        console.error(`[DB DELETE] Erro ao deletar etapa ${stepId}:`, deleteStepError);
        throw deleteStepError;
      }
      console.log(`[DB DELETE] Etapa ${stepId} deletada com sucesso.`);

      // Invalidate caches for the affected work
      delete _dashboardCache.stats[workId];
      delete _dashboardCache.summary[workId];
      _dashboardCache.notifications = null; // Notifications might be tied to steps, invalidate global cache
      _dashboardCache.steps[workId] = null; // NEW: Invalidate steps cache for this workId
      _dashboardCache.materials[workId] = null; // NEW: Invalidate materials cache for this workId
      console.log(`[DB DELETE] Caches para workId ${workId} invalidados após exclusão da etapa.`);

    } catch (error: any) {
      console.error(`[DB DELETE ERROR] Erro ao apagar etapa ${stepId} e dados relacionados:`, error);
      throw new Error(`Falha ao apagar etapa: ${error.message}`);
    }
  },

  // --- MATERIALS ---
  async getMaterials(workId: string): Promise<Material[]> {
    // Supabase is guaranteed to be initialized now
    const now = Date.now();
    if (_dashboardCache.materials[workId] && (now - _dashboardCache.materials[workId].timestamp < CACHE_TTL)) {
        console.log(`[CACHE HIT] getMaterials for workId ${workId}`);
        return _dashboardCache.materials[workId].data;
    }

    console.log(`[dbService.getMaterials] Fetching materials for work: ${workId}`); // Log para depuração
    const { data, error: fetchMaterialsError } = await supabase.from('materials').select('*').eq('work_id', workId).order('category', { ascending: true }).order('name', { ascending: true }); // Renamed error
    if (fetchMaterialsError) {
      console.error(`[dbService.getMaterials] Erro ao buscar materiais para work ${workId}:`, fetchMaterialsError); // Log de erro mais detalhado
      return [];
    }
    const parsed = (data || []).map(parseMaterialFromDB);
    _dashboardCache.materials[workId] = { data: parsed, timestamp: now }; // Cache the result
    return parsed;
  },

  async addMaterial(material: Omit<Material, 'id'>, purchaseInfo?: {qty: number, cost: number, date: string}): Promise<Material | null> {
    // Supabase is guaranteed to be initialized now
    
    // Fix: Safely destructure data and error from the response object
    const response = await supabase.from('materials').insert({ 
      work_id: material.workId,
      name: material.name,
      brand: material.brand,
      planned_qty: material.plannedQty,
      purchased_qty: purchaseInfo?.qty || 0,
      unit: material.unit,
      step_id: material.stepId, // FIX: Changed to snake_case
      category: material.category
    }).select().single();

    const newMaterialData = response.data;
    const addMaterialError = response.error;

    if (addMaterialError) {
      console.error("Erro ao adicionar material:", addMaterialError);
      throw addMaterialError;
    }

    if (purchaseInfo && newMaterialData) { // Used newMaterialData
      // Also record as an expense
      await dbService.addExpense({ // Changed from this.addExpense
        workId: material.workId,
        description: `Compra de ${material.name}`,
        amount: purchaseInfo.cost,
        date: new Date().toISOString(),
        category: ExpenseCategory.MATERIAL,
        relatedMaterialId: newMaterialData.id, // Used newMaterialData
        stepId: material.stepId
      });
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[material.workId];
    delete _dashboardCache.summary[material.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    _dashboardCache.materials[material.workId] = null; // NEW: Invalidate materials cache for this workId
    return parseMaterialFromDB(newMaterialData);
  },

  async updateMaterial(material: Material): Promise<Material | null> {
    // Supabase is guaranteed to be initialized now
    const { data: updatedMaterialData, error: updateMaterialError } = await supabase.from('materials').update({ // Renamed data and error
      name: material.name,
      brand: material.brand,
      planned_qty: material.plannedQty,
      purchased_qty: material.purchasedQty,
      unit: material.unit,
      step_id: material.stepId, // This is already snake_case
      category: material.category
    }).eq('id', material.id).select().single();
    if (updateMaterialError) {
      console.error("Erro ao atualizar material:", updateMaterialError);
      throw updateMaterialError;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[material.workId];
    delete _dashboardCache.summary[material.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    _dashboardCache.materials[material.workId] = null; // NEW: Invalidate materials cache for this workId
    return parseMaterialFromDB(updatedMaterialData);
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
    await dbService.addExpense({ // Changed from this.addExpense
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
    _dashboardCache.materials[existingMaterial.work_id] = null; // NEW: Invalidate materials cache for this workId
  },

  // --- EXPENSES ---
  async getExpenses(workId: string): Promise<Expense[]> {
    // Supabase is guaranteed to be initialized now
    console.log(`[dbService.getExpenses] Fetching expenses for work: ${workId}`); // Log para depuração
    const { data, error: fetchExpensesError } = await supabase.from('expenses').select('*').eq('work_id', workId).order('date', { ascending: false }); // Renamed error
    if (fetchExpensesError) {
      console.error(`[dbService.getExpenses] Erro ao buscar despesas para work ${workId}:`, fetchExpensesError); // Log de erro mais detalhado
      return [];
    }
    return (data || []).map(parseExpenseFromDB);
  },

  async addExpense(expense: Omit<Expense, 'id'>): Promise<Expense | null> {
    // Supabase is guaranteed to be initialized now
    const { data: newExpenseData, error: addExpenseError } = await supabase.from('expenses').insert({ // Renamed data and error
      work_id: expense.workId,
      description: expense.description,
      amount: expense.amount,
      paid_amount: expense.paidAmount || expense.amount, // Ensure paid_amount is set
      quantity: expense.quantity || 1, // Default quantity
      date: expense.date,
      category: expense.category,
      step_id: expense.stepId, 
      related_material_id: expense.relatedMaterialId, 
      worker_id: expense.workerId, 
      supplier_id: expense.supplierId, // NEW: Added supplier_id
      total_agreed: expense.totalAgreed // Corrected to total_agreed
    }).select().single();
    if (addExpenseError) {
      console.error("Erro ao adicionar despesa:", addExpenseError);
      throw addExpenseError;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[expense.workId];
    delete _dashboardCache.summary[expense.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    return parseExpenseFromDB(newExpenseData);
  },

  async updateExpense(expense: Expense): Promise<Expense | null> {
    // Supabase is guaranteed to be initialized now
    const { data: updatedExpenseData, error: updateExpenseError } = await supabase.from('expenses').update({ // Renamed data and error
      description: expense.description,
      amount: expense.amount,
      paid_amount: expense.paidAmount || expense.amount,
      quantity: expense.quantity,
      date: expense.date,
      category: expense.category,
      step_id: expense.stepId, 
      related_material_id: expense.relatedMaterialId, 
      worker_id: expense.workerId, 
      supplier_id: expense.supplierId, // NEW: Added supplier_id
      total_agreed: expense.totalAgreed // Corrected to total_agreed
    }).eq('id', expense.id).select().single();
    if (updateExpenseError) {
      console.error("Erro ao atualizar despesa:", updateExpenseError);
      throw updateExpenseError;
    }
    // Invalidate cache for work stats/summary
    delete _dashboardCache.stats[expense.workId];
    delete _dashboardCache.summary[expense.workId];
    _dashboardCache.notifications = null; // NEW: Invalidate notifications cache
    return parseExpenseFromDB(updatedExpenseData);
  },

  async deleteExpense(expenseId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const response = await supabase.from('expenses').delete().eq('id', expenseId).select('work_id').single();
    const deletedExpense: { work_id: string } | null = response.data; // Explicitly type to allow for null
    const deleteExpenseError = response.error; // Extract error from response

    if (deleteExpenseError) {
      console.error("Erro ao apagar despesa:", deleteExpenseError);
      throw deleteExpenseError;
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
    console.log(`[dbService.getWorkers] Fetching workers for work: ${workId}`); // Log para depuração
    const { data, error: fetchWorkersError } = await supabase.from('workers').select('*').eq('work_id', workId).order('name', { ascending: true }); // NEW: Filter by work_id // Renamed error
    if (fetchWorkersError) {
      console.error(`[dbService.getWorkers] Erro ao buscar profissionais para work ${workId}:`, fetchWorkersError); // Log de erro mais detalhado
      return [];
    }
    return (data || []).map(parseWorkerFromDB);
  },

  async addWorker(worker: Omit<Worker, 'id'>): Promise<Worker | null> {
    // Supabase is guaranteed to be initialized now
    const { data: newWorkerData, error: addWorkerError } = await supabase.from('workers').insert({ // Renamed data and error
      user_id: worker.userId,
      work_id: worker.workId, // NEW: Include work_id
      name: worker.name,
      role: worker.role,
      phone: worker.phone,
      daily_rate: worker.dailyRate, // NEW: Include daily_rate
      notes: worker.notes
    }).select().single();
    if (addWorkerError) {
      console.error("Erro ao adicionar profissional:", addWorkerError);
      throw addWorkerError;
    }
    return parseWorkerFromDB(newWorkerData);
  },

  async updateWorker(worker: Worker): Promise<Worker | null> {
    // Supabase is guaranteed to be initialized now
    const { data: updatedWorkerData, error: updateWorkerError } = await supabase.from('workers').update({ // Renamed data and error
      name: worker.name,
      role: worker.role,
      phone: worker.phone,
      daily_rate: worker.dailyRate, // NEW: Include daily_rate
      notes: worker.notes
    }).eq('id', worker.id).eq('work_id', worker.workId).select().single(); // NEW: Filter by work_id
    if (updateWorkerError) {
      console.error("Erro ao atualizar profissional:", updateWorkerError);
      throw updateWorkerError;
    }
    return parseWorkerFromDB(updatedWorkerData);
  },

  async deleteWorker(workerId: string, workId: string): Promise<void> { // NEW: Accepts workId
    // Supabase is guaranteed to be initialized now
    const { error: deleteWorkerError } = await supabase.from('workers').delete().eq('id', workerId).eq('work_id', workId); // NEW: Filter by work_id // Renamed error
    if (deleteWorkerError) {
      console.error("Erro ao apagar profissional:", deleteWorkerError);
      throw deleteWorkerError;
    }
  },

  // --- SUPPLIERS ---
  async getSuppliers(workId: string): Promise<Supplier[]> { // NEW: Accepts workId
    // Supabase is guaranteed to be initialized now
    console.log(`[dbService.getSuppliers] Fetching suppliers for work: ${workId}`); // Log para depuração
    const { data, error: fetchSuppliersError } = await supabase.from('suppliers').select('*').eq('work_id', workId).order('name', { ascending: true }); // NEW: Filter by work_id // Renamed error
    if (fetchSuppliersError) {
      console.error(`[dbService.getSuppliers] Erro ao buscar fornecedores para work ${workId}:`, fetchSuppliersError); // Log de erro mais detalhado
      return [];
    }
    return (data || []).map(parseSupplierFromDB);
  },

  async addSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier | null> {
    // Supabase is guaranteed to be initialized now
    const { data: newSupplierData, error: addSupplierError } = await supabase.from('suppliers').insert({ // Renamed data and error
      user_id: supplier.userId,
      work_id: supplier.workId, // NEW: Include work_id
      name: supplier.name,
      category: supplier.category,
      phone: supplier.phone,
      email: supplier.email, // NEW: Include email
      address: supplier.address, // NEW: Include address
      notes: supplier.notes
    }).select().single();
    if (addSupplierError) {
      console.error("Erro ao adicionar fornecedor:", addSupplierError);
      throw addSupplierError;
    }
    return parseSupplierFromDB(newSupplierData);
  },

  async updateSupplier(supplier: Supplier): Promise<Supplier | null> {
    // Supabase is guaranteed to be initialized now
    const { data: updatedSupplierData, error: updateSupplierError } = await supabase.from('suppliers').update({ // Renamed data and error
      name: supplier.name,
      category: supplier.category,
      phone: supplier.phone,
      email: supplier.email, // NEW: Include email
      address: supplier.address, // NEW: Include address
      notes: supplier.notes
    }).eq('id', supplier.id).eq('work_id', supplier.workId).select().single(); // NEW: Filter by work_id
    if (updateSupplierError) {
      console.error("Erro ao atualizar fornecedor:", updateSupplierError);
      throw updateSupplierError;
    }
    return parseSupplierFromDB(updatedSupplierData);
  },

  async deleteSupplier(supplierId: string, workId: string): Promise<void> { // NEW: Accepts workId
    // Supabase is guaranteed to be initialized now
    const { error: deleteSupplierError } = await supabase.from('suppliers').delete().eq('id', supplierId).eq('work_id', workId); // NEW: Filter by work_id // Renamed error
    if (deleteSupplierError) {
      console.error("Erro ao apagar fornecedor:", deleteSupplierError);
      throw deleteSupplierError;
    }
  },

  // --- WORK PHOTOS ---
  async getPhotos(workId: string): Promise<WorkPhoto[]> {
    // Supabase is guaranteed to be initialized now
    console.log(`[dbService.getPhotos] Fetching photos for work: ${workId}`); // Log para depuração
    const { data, error: fetchPhotosError } = await supabase.from('work_photos').select('*').eq('work_id', workId).order('date', { ascending: false }); // Renamed error
    if (fetchPhotosError) {
      console.error(`[dbService.getPhotos] Erro ao buscar fotos para work ${workId}:`, fetchPhotosError); // Log de erro mais detalhado
      return [];
    }
    return (data || []).map(parsePhotoFromDB);
  },

  async addPhoto(photo: Omit<WorkPhoto, 'id'>): Promise<WorkPhoto | null> {
    // Supabase is guaranteed to be initialized now
    const { data: newPhotoData, error: addPhotoError } = await supabase.from('work_photos').insert({ // Renamed data and error
      work_id: photo.workId,
      url: photo.url,
      description: photo.description,
      date: photo.date,
      type: photo.type
    }).select().single();
    if (addPhotoError) {
      console.error("Erro ao adicionar foto:", addPhotoError);
      throw addPhotoError;
    }
    return parsePhotoFromDB(newPhotoData);
  },

  // --- WORK FILES ---
  async getFiles(workId: string): Promise<WorkFile[]> {
    // Supabase is guaranteed to be initialized now
    console.log(`[dbService.getFiles] Fetching files for work: ${workId}`); // Log para depuração
    const { data, error: fetchFilesError } = await supabase.from('work_files').select('*').eq('work_id', workId).order('date', { ascending: false }); // Renamed error
    if (fetchFilesError) {
      console.error(`[dbService.getFiles] Erro ao buscar arquivos para work ${workId}:`, fetchFilesError); // Log de erro mais detalhado
      return [];
    }
    return (data || []).map(parseFileFromDB);
  },

  async addFile(file: Omit<WorkFile, 'id'>): Promise<WorkFile | null> {
    // Supabase is guaranteed to be initialized now
    const { data: newFileData, error: addFileError } = await supabase.from('work_files').insert({ // Renamed data and error
      work_id: file.workId,
      name: file.name,
      category: file.category,
      url: file.url,
      type: file.type,
      date: file.date
    }).select().single();
    if (addFileError) {
      console.error("Erro ao adicionar arquivo:", addFileError);
      throw addFileError;
    }
    return parseFileFromDB(newFileData);
  },

  // --- NOTIFICATIONS ---
  async getNotifications(userId: string): Promise<DBNotification[]> {
    // Supabase is guaranteed to be initialized now
    
    const now = Date.now();
    if (_dashboardCache.notifications && (now - _dashboardCache.notifications.timestamp < CACHE_TTL)) {
        return _dashboardCache.notifications.data;
    }

    console.log(`[dbService.getNotifications] Fetching notifications for user: ${userId}`); // Log para depuração
    const { data, error: fetchNotificationsError } = await supabase.from('notifications') // Renamed error
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('date', { ascending: false });

    if (fetchNotificationsError) {
      console.error(`[dbService.getNotifications] Erro ao buscar notificações para user ${userId}:`, fetchNotificationsError); // Log de erro mais detalhado
      return [];
    }
    const parsed = (data || []).map(parseNotificationFromDB);
    _dashboardCache.notifications = { data: parsed, timestamp: now };
    return parsed;
  },

  async addNotification(notification: Omit<DBNotification, 'id'>): Promise<DBNotification | null> {
    // Supabase is guaranteed to be initialized now
    const { data: newNotificationData, error: addNotificationError } = await supabase.from('notifications').insert({ // Renamed data and error
      user_id: notification.userId,
      work_id: notification.workId, // NEW: Include work_id
      title: notification.title,
      message: notification.message,
      date: notification.date,
      read: notification.read,
      type: notification.type,
      tag: notification.tag // NEW: Save the tag to DB
    }).select().single();
    if (addNotificationError) {
      console.error("Erro ao adicionar notificação:", addNotificationError.message, addNotificationError.details, addNotificationError.code, "Full Error Object:", addNotificationError); // Log more details
      throw addNotificationError;
    }
    _dashboardCache.notifications = null; // Invalidate cache
    return parseNotificationFromDB(newNotificationData);
  },

  async dismissNotification(notificationId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const { error: dismissNotificationError } = await supabase.from('notifications') // Renamed error
      .update({ read: true })
      .eq('id', notificationId);
    if (dismissNotificationError) {
      console.error("Erro ao dispensar notificação:", dismissNotificationError);
      throw dismissNotificationError;
    }
    _dashboardCache.notifications = null; // Invalidate cache
  },

  async clearAllNotifications(userId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const { error: clearNotificationsError } = await supabase.from('notifications') // Renamed error
      .update({ read: true })
      .eq('user_id', userId);
    if (clearNotificationsError) {
      console.error("Erro ao limpar notificações:", clearNotificationsError);
      throw clearNotificationsError;
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

    console.log(`[dbService.calculateWorkStats] Fetching stats for work: ${workId}`); // Log para depuração
    const [expensesResult, stepsResult, workResult] = await Promise.all([
      supabase.from('expenses').select('amount').eq('work_id', workId),
      supabase.from('steps').select('id, status, end_date').eq('work_id', workId),
      supabase.from('works').select('budget_planned').eq('id', workId).single()
    ]);

    if (expensesResult.error || stepsResult.error || workResult.error) {
      console.error(`[dbService.calculateWorkStats] Erro ao calcular stats para work ${workId}:`, expensesResult.error || stepsResult.error || workResult.error); // Log de erro mais detalhado
      return { totalSpent: 0, progress: 0, delayedSteps: 0 };
    }

    const totalSpent = expensesResult.data.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalSteps = stepsResult.data.length;
    const completedSteps = stepsResult.data.filter(s => s.status === StepStatus.COMPLETED).length;
    
    const today = new Date().toISOString().split('T')[0];
    const delayedSteps = stepsResult.data.filter(s => s.status !== StepStatus.COMPLETED && s.end_date < today).length;

    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const stats = { totalSpent, progress, delayedSteps };
    _dashboardCache.stats[workId] = { data: stats, timestamp: now };
    return stats;
  },

  async getDailySummary(workId: string): Promise<{ completedSteps: number, delayedSteps: number, pendingMaterials: number, totalSteps: number }> {
    // Supabase is guaranteed to be initialized now

    const now = Date.now();
    if (_dashboardCache.summary[workId] && (now - _dashboardCache.summary[workId].timestamp < CACHE_TTL)) {
        return _dashboardCache.summary[workId].data;
    }

    console.log(`[dbService.getDailySummary] Fetching summary for work: ${workId}`); // Log para depuração
    const [stepsResult, materialsResult] = await Promise.all([
      supabase.from('steps').select('id, status, end_date').eq('work_id', workId),
      supabase.from('materials').select('id, planned_qty, purchased_qty, step_id, name').eq('work_id', workId) // Fetch name and step_id
    ]);

    if (stepsResult.error || materialsResult.error) {
      console.error(`[dbService.getDailySummary] Erro ao buscar summary para work ${workId}:`, stepsResult.error || materialsResult.error); // Log de erro mais detalhado
      return { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 };
    }

    const totalSteps = stepsResult.data.length;
    const completedSteps = stepsResult.data.filter(s => s.status === 'CONCLUIDO').length;
    
    const today = new Date().toISOString().split('T')[0];
    const delayedSteps = stepsResult.data.filter(s => s.status !== 'CONCLUIDO' && s.end_date < today).length;

    const pendingMaterials = materialsResult.data.filter(m => m.purchased_qty < m.planned_qty).length;

    const summary = { completedSteps, delayedSteps, pendingMaterials, totalSteps };
    _dashboardCache.summary[workId] = { data: summary, timestamp: now };
    return summary;
  },

  // generateSmartNotifications logic MOVED TO SERVERLESS FUNCTION api/send-daily-notifications.js


  // --- NEW: PWA Push Notification Management ---
  async getPushSubscription(userId: string): Promise<PushSubscriptionInfo | null> {
    const { data: subscriptionData, error: fetchSubscriptionError } = await supabase // Renamed data and error
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchSubscriptionError && fetchSubscriptionError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error("Erro ao buscar PushSubscription:", fetchSubscriptionError);
      return null;
    }
    return subscriptionData ? mapPushSubscriptionFromDB(subscriptionData) : null;
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
            let errorData = { error: 'Unknown error', message: 'Failed to parse error response' };
            try {
                errorData = await response.json();
            } catch (e: any) { // Explicitly type e as any
                const textError = await response.text();
                errorData.message = textError; // Fallback to raw text
            }
            throw new Error(errorData.error || errorData.message || 'Falha ao salvar a assinatura de push.');
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
            let errorData = { error: 'Unknown error', message: 'Failed to parse error response' };
            try {
                errorData = await response.json();
            } catch (e: any) { // Explicitly type e as any
                const textError = await response.text();
                errorData.message = textError; // Fallback to raw text
            }
            throw new Error(errorData.error || errorData.message || 'Falha ao remover a assinatura de push.');
        }
        console.log("PushSubscription removida com sucesso!");
    } catch (error: any) {
        console.error("Erro ao remover PushSubscription:", error);
        throw error;
    }
  },

  async sendPushNotification(userId: string, notificationPayload: { title: string, body: string, url?: string, tag?: string }): Promise<void> {
    const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin; // Fallback to window.location.origin

    try {
        const response = await fetch('/api/send-event-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, ...notificationPayload, url: notificationPayload.url || APP_URL }), // Ensure URL is passed to server
        });

        if (!response.ok) {
            let errorData = { error: 'Unknown error', message: 'Failed to parse error response' };
            // Adicionado log do rawText para melhor diagnóstico
            const textResponse = await response.text(); 
            try {
                errorData = JSON.parse(textResponse); // Tentar parsear o texto se for JSON
            } catch (e: any) { // Explicitly type e as any
                errorData.message = `API returned non-JSON or unparseable text: "${textResponse}"`; // Fallback to raw text
            }
            throw new Error(errorData.error || errorData.message || 'Falha ao enviar push notification de evento.');
        }
        console.log("Push notification de evento enviada para o usuário:", userId);
    } catch (error: any) {
        console.error("Erro ao enviar push notification de evento:", error);
        // Não relança o erro, pois a falha na notificação não deve impedir a funcionalidade principal
    }
  },

  // --- NEW: CONTRACTS (MOCK/TEMPLATE) ---
  async getContractTemplates(): Promise<Contract[]> {
    // In a real app, this would fetch from a 'contracts' table in Supabase
    // For now, it returns the static templates from standards.ts
    await new Promise(r => setTimeout(r, 200)); // Simulate API call
    return CONTRACT_TEMPLATES;
  },

  // --- NEW: CHECKLISTS (MOCK/LOCAL DB) ---
  async getChecklists(workId: string, category?: string): Promise<Checklist[]> {
    // In a real app, this would fetch from a 'checklists' table in Supabase
    // For now, it returns the static templates from standards.ts and filters them
    await new Promise(r => setTimeout(r, 200)); // Simulate API call
    // Filter by workId (mocked) and category
    const filtered = CHECKLIST_TEMPLATES.filter(c => 
        (c.workId === 'mock-work-id' || c.workId === workId) && // Allow general mock or specific work
        (!category || category === 'all' || c.category === category)
    );
    // Simulate deep copy to prevent direct state mutation
    return filtered.map(c => ({
      ...c,
      items: c.items.map(item => ({...item}))
    }));
  },

  async addChecklist(checklist: Omit<Checklist, 'id'>): Promise<Checklist> {
    await new Promise(r => setTimeout(r, 200)); // Simulate API call
    const newId = `ckl-${Date.now()}`;
    // FIX: Explicitly type newChecklist as Checklist to ensure stricter type checking.
    const newChecklist: Checklist = { ...checklist, id: newId }; 
    CHECKLIST_TEMPLATES.push(newChecklist); // Add to mock DB
    return newChecklist;
  },

  async updateChecklist(checklist: Checklist): Promise<Checklist> {
    await new Promise(r => setTimeout(r, 200)); // Simulate API call
    const index = CHECKLIST_TEMPLATES.findIndex(c => c.id === checklist.id);
    if (index !== -1) {
      CHECKLIST_TEMPLATES[index] = checklist; // Update mock DB
    }
    return checklist;
  },

  async deleteChecklist(checklistId: string): Promise<void> {
    await new Promise(r => setTimeout(r, 200)); // Simulate API call
    const index = CHECKLIST_TEMPLATES.findIndex(c => c.id === checklistId);
    if (index !== -1) {
      CHECKLIST_TEMPLATES.splice(index, 1); // Delete from mock DB
    }
  }

};