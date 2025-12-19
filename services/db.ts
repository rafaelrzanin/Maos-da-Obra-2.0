import { 
  User, Work, Step, Material, Expense, Worker, Supplier, 
  WorkPhoto, WorkFile, Notification, PlanType,
  ExpenseCategory, StepStatus, FileCategory
} from '../types.ts';
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
    totalAgreed: data.total_agreed ? Number(data.total_agreed) : undefined
});

const parseWorkerFromDB = (data: any): Worker => ({
    id: data.id,
    userId: data.user_id,
    name: data.name,
    role: data.role,
    phone: data.phone,
    dailyRate: Number(data.daily_rate || 0), // Added dailyRate parsing
    notes: data.notes
});

const parseSupplierFromDB = (data: any): Supplier => ({
    id: data.id,
    userId: data.user_id,
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
    title: data.title,
    message: data.message,
    date: data.date,
    read: data.read,
    type: data.type
});

// --- AUTH CACHE & DEDUPLICATION ---
let sessionCache: { promise: Promise<User | null>, timestamp: number } | null = null;
const AUTH_CACHE_DURATION = 5000;
const pendingProfileRequests: Partial<Record<string, Promise<User | null>>> = {};

const ensureUserProfile = async (authUser: any): Promise<User | null> => {
    const client = supabase; // Supabase is guaranteed to be initialized now
    if (!authUser) return null;

  const pending = pendingProfileRequests[authUser.id];
if (pending) {
  return pending;
  }


    const fetchProfileProcess = async (): Promise<User | null> => {
        try {
            const { data: existingProfile, error: readError } = await client
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();

            if (existingProfile) {
                return mapProfileFromSupabase(existingProfile);
            }

            if (readError && readError.code === '42501') { 
                 console.error("ERRO CRÍTICO 403: Permissão negada ao ler perfil.");
                 return {
                    id: authUser.id,
                    name: authUser.user_metadata?.name || 'Erro de Permissão',
                    email: authUser.email || '',
                    plan: PlanType.MENSAL,
                    isTrial: true // Default for error case
                 };
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
                console.error("Erro ao criar perfil:", createError);
                return {
                    id: authUser.id,
                    name: newProfileData.name,
                    email: authUser.email || '', // Corrected from authData.user.email
                    plan: PlanType.MENSAL,
                    isTrial: true,
                    subscriptionExpiresAt: trialExpires.toISOString()
                };
            }

            return mapProfileFromSupabase(createdProfile);

        } catch (e) {
            console.error("Exceção no ensureUserProfile", e);
            return {
                id: authUser.id,
                name: authUser.email || 'Usuário',
                email: authUser.email,
                plan: PlanType.MENSAL,
                isTrial: true // Default for error case
            };
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
    return this.getCurrentUser();
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

    const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        name,
        email,
        whatsapp,
        cpf,
        // CORREÇÃO: Sempre inicia com plano MENSAL (trial) no signup.
        // O plano desejado pelo usuário (planType) será usado para redirecionar ao checkout,
        // onde o plano pago será efetivamente ativado após o pagamento.
        plan: PlanType.MENSAL, 
        is_trial: true,
        subscription_expires_at: trialExpires.toISOString()
    });

    if (profileError) {
        console.error("Erro ao criar perfil no signup:", profileError);
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
          qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
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
        livingRooms: work.livingRooms,
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
        await this.regenerateMaterials(parsedWork.id, parsedWork.area, templateId);
    }

    return parsedWork;
  },

  async regenerateMaterials(workId: string, area: number, templateId: string = 'CONSTRUCAO') {
      // Supabase is guaranteed to be initialized now
      if (!workId) return;
      
      const safeArea = area && area > 0 ? area : 100;
      let materialsToInsert: any[] = [];

      const { data: dbSteps } = await supabase.from('steps').select('*').eq('work_id', workId);
      
      if (!dbSteps || dbSteps.length === 0) return;

      const template = WORK_TEMPLATES.find(t => t.id === templateId);
      if (!template) return;

      for (const stepName of template.includedSteps) {
          const materialCatalog = FULL_MATERIAL_PACKAGES.find(p => p.category === stepName);
          if (materialCatalog) {
              const currentStep = dbSteps.find(s => s.name === stepName);
              if (currentStep) {
                  for (const item of materialCatalog.items) {
                      materialsToInsert.push({
                          work_id: workId,
                          name: item.name,
                          planned_qty: Math.ceil(safeArea * (item.multiplier || 0)),
                          purchased_qty: 0,
                          unit: item.unit,
                          step_id: currentStep.id,
                          category: materialCatalog.category
                      });
                  }
              }
          }
      }
      if (materialsToInsert.length > 0) {
          // Clear existing materials for this work before inserting new ones
          await supabase.from('materials').delete().eq('work_id', workId);
          await supabase.from('materials').insert(materialsToInsert);
      }
  },

  async deleteWork(workId: string) {
    // Supabase is guaranteed to be initialized now

    // Start a transaction (Supabase does not have explicit transactions, but we can do multiple operations)
    try {
        await supabase.from('steps').delete().eq('work_id', workId);
        await supabase.from('materials').delete().eq('work_id', workId);
        await supabase.from('expenses').delete().eq('work_id', workId);
        await supabase.from('work_photos').delete().eq('work_id', workId);
        await supabase.from('work_files').delete().eq('work_id', workId);
        
        const { error } = await supabase.from('works').delete().eq('id', workId);
        if (error) throw error;
        
        _dashboardCache.works = null; // Invalidate cache
    } catch (error: unknown) { // Fix TS18046: Explicitly type as unknown
        console.error("Erro ao apagar obra e dados relacionados:", error);
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
      start_date: step.startDate,
      end_date: step.endDate,
      status: step.status,
      is_delayed: step.isDelayed
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar etapa:", error);
      throw error;
    }
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
      stepId: material.stepId,
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
        date: purchaseInfo.date,
        category: ExpenseCategory.MATERIAL,
        relatedMaterialId: data.id,
        stepId: material.stepId
      });
    }

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
      step_id: material.stepId,
      category: material.category
    }).eq('id', material.id).select().single();
    if (error) {
      console.error("Erro ao atualizar material:", error);
      throw error;
    }
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
      step_id: expense.stepId,
      related_material_id: expense.relatedMaterialId,
      worker_id: expense.workerId,
      total_agreed: expense.totalAgreed
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar despesa:", error);
      throw error;
    }
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
      step_id: expense.stepId,
      related_material_id: expense.relatedMaterialId,
      worker_id: expense.workerId,
      total_agreed: expense.totalAgreed
    }).eq('id', expense.id).select().single();
    if (error) {
      console.error("Erro ao atualizar despesa:", error);
      throw error;
    }
    return parseExpenseFromDB(data);
  },

  async deleteExpense(expenseId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) {
      console.error("Erro ao apagar despesa:", error);
      throw error;
    }
  },

  // --- WORKERS ---
  async getWorkers(userId: string): Promise<Worker[]> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('workers').select('*').eq('user_id', userId).order('name', { ascending: true });
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
    }).eq('id', worker.id).select().single();
    if (error) {
      console.error("Erro ao atualizar profissional:", error);
      throw error;
    }
    return parseWorkerFromDB(data);
  },

  async deleteWorker(workerId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const { error } = await supabase.from('workers').delete().eq('id', workerId);
    if (error) {
      console.error("Erro ao apagar profissional:", error);
      throw error;
    }
  },

  // --- SUPPLIERS ---
  async getSuppliers(userId: string): Promise<Supplier[]> {
    // Supabase is guaranteed to be initialized now
    const { data, error } = await supabase.from('suppliers').select('*').eq('user_id', userId).order('name', { ascending: true });
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
    }).eq('id', supplier.id).select().single();
    if (error) {
      console.error("Erro ao atualizar fornecedor:", error);
      throw error;
    }
    return parseSupplierFromDB(data);
  },

  async deleteSupplier(supplierId: string): Promise<void> {
    // Supabase is guaranteed to be initialized now
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
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
      title: notification.title,
      message: notification.message,
      date: notification.date,
      read: notification.read,
      type: notification.type
    }).select().single();
    if (error) {
      console.error("Erro ao adicionar notificação:", error);
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

    const now = Date.now();
    if (_dashboardCache.summary[workId] && (now - _dashboardCache.summary[workId].timestamp < CACHE_TTL)) {
        return _dashboardCache.summary[workId].data;
    }

    const [stepsData, materialsData] = await Promise.all([
      supabase.from('steps').select('id, status, end_date').eq('work_id', workId),
      supabase.from('materials').select('id, planned_qty, purchased_qty').eq('work_id', workId)
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
        // Usa dados pré-carregados se disponíveis, senão busca do DB.
        const currentSteps = prefetchedSteps || await this.getSteps(workId);
        const currentExpenses = prefetchedExpenses || await this.getExpenses(workId);
        const currentMaterials = prefetchedMaterials || await this.getMaterials(workId);
        const currentWork = prefetchedWork || await this.getWorkById(workId);

        const today = new Date();
        today.setHours(0,0,0,0);

        // Example: Notification for delayed steps
        const delayedSteps = currentSteps.filter(s => s.status !== StepStatus.COMPLETED && new Date(s.endDate) < today);
        for (const step of delayedSteps) {
            // Verifica se a notificação já existe para evitar duplicação em execuções rápidas
            const { data: existingNotif } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', userId)
                .eq('title', 'Etapa Atrasada!')
                .like('message', `%${step.name}%`)
                .eq('read', false)
                .maybeSingle();

            if (!existingNotif) {
                await this.addNotification({
                    userId,
                    title: 'Etapa Atrasada!',
                    message: `A etapa "${step.name}" está atrasada. Verifique o cronograma!`,
                    date: new Date().toISOString(),
                    read: false,
                    type: 'WARNING'
                });
            }
        }

        // Example: Notification for budget usage (if work and expenses are available)
        if (currentWork && currentWork.budgetPlanned > 0) {
            const totalSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
            const budgetUsage = (totalSpent / currentWork.budgetPlanned) * 100;

            if (budgetUsage > 90 && budgetUsage <= 100) {
                 const { data: existingNotif } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('title', 'Atenção ao Orçamento!')
                    .like('message', `%${currentWork.name}%`)
                    .eq('read', false)
                    .maybeSingle();

                if (!existingNotif) {
                    await this.addNotification({
                        userId,
                        title: 'Atenção ao Orçamento!',
                        message: `Você já usou ${Math.round(budgetUsage)}% do orçamento da obra "${currentWork.name}".`,
                        date: new Date().toISOString(),
                        read: false,
                        type: 'WARNING'
                    });
                }
            } else if (budgetUsage > 100) {
                 const { data: existingNotif } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('title', 'Orçamento Estourado!')
                    .like('message', `%${currentWork.name}%`)
                    .eq('read', false)
                    .maybeSingle();
                
                if (!existingNotif) {
                    await this.addNotification({
                        userId,
                        title: 'Orçamento Estourado!',
                        message: `O orçamento da obra "${currentWork.name}" foi excedido em ${Math.round(budgetUsage - 100)}%.`,
                        date: new Date().toISOString(),
                        read: false,
                        type: 'ERROR'
                    });
                }
            }
        }
    } catch (error: any) { // Explicitly type as any to allow .message access
        console.error("Erro ao gerar notificações inteligentes:", error);
    }
  },
};
