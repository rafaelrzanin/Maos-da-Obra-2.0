
// @ts-nocheck
import { 
  User, Work, Step, Material, Expense, Worker, Supplier, 
  WorkPhoto, WorkFile, Notification, PlanType,
  ExpenseCategory, StepStatus
} from '../types';
import { WORK_TEMPLATES, FULL_MATERIAL_PACKAGES } from './standards';
import { supabase } from './supabase';

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
    date: data.date,
    category: data.category,
    stepId: data.step_id,
    relatedMaterialId: data.related_material_id,
    totalAgreed: data.total_agreed ? Number(data.total_agreed) : undefined
});

const parseWorkerFromDB = (data: any): Worker => ({
    id: data.id,
    userId: data.user_id,
    name: data.name,
    role: data.role,
    phone: data.phone,
    notes: data.notes
});

const parseSupplierFromDB = (data: any): Supplier => ({
    id: data.id,
    userId: data.user_id,
    name: data.name,
    category: data.category,
    phone: data.phone,
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
let sessionCachePromise: Promise<User | null> | null = null;
let sessionCacheTimestamp = 0;
const AUTH_CACHE_DURATION = 5000;
const pendingProfileRequests: Record<string, Promise<User | null>> = {};

const ensureUserProfile = async (authUser: any): Promise<User | null> => {
    const client = supabase;
    if (!authUser || !client) return null;

    if (pendingProfileRequests[authUser.id]) {
        return pendingProfileRequests[authUser.id];
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
                    isTrial: true
                 };
            }

            const trialExpires = new Date();
            trialExpires.setDate(trialExpires.getDate() + 7);

            const newProfileData = {
                id: authUser.id,
                name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Novo Usuário',
                email: authUser.email,
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
                    email: authUser.email || '',
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
                isTrial: true
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
    if (!client) return null;
    
    const now = Date.now();
    
    if (sessionCachePromise && (now - sessionCacheTimestamp < AUTH_CACHE_DURATION)) {
        return sessionCachePromise;
    }

    sessionCachePromise = (async () => {
        const { data: { session } } = await client.auth.getSession();
        if (!session?.user) return null;
        return await ensureUserProfile(session.user);
    })();
    
    sessionCacheTimestamp = now;
    return sessionCachePromise;
  },

  async syncSession() {
    sessionCachePromise = null;
    return this.getCurrentUser();
  },

  onAuthChange(callback: (user: User | null) => void) {
    const client = supabase;
    if (!client) return () => {};
    
    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, session) => {
        sessionCachePromise = null;
        
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
    if (!supabase) throw new Error("Supabase não configurado");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || '' });
    if (error) throw error;
    if (data.user) {
        sessionCachePromise = null;
        return await ensureUserProfile(data.user);
    }
    return null;
  },

  async loginSocial(provider: 'google') {
    if (!supabase) return { error: 'Supabase not configured', data: null };
    return await supabase.auth.signInWithOAuth({ 
        provider,
        options: {
            redirectTo: window.location.origin 
        }
    });
  },

  async signup(name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) {
    if (!supabase) throw new Error("Supabase não configurado");
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: password || '123456',
        options: {
            data: { name }
        }
    });

    if (authError) throw authError;
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
        plan: planType || PlanType.MENSAL, 
        is_trial: true,
        subscription_expires_at: trialExpires.toISOString()
    });

    if (profileError) {
        console.error("Erro ao criar perfil no signup:", profileError);
    }

    sessionCachePromise = null;
    return await ensureUserProfile(authData.user);
  },

  async logout() {
    if (supabase) await supabase.auth.signOut();
    sessionCachePromise = null;
    // Clear Dashboard Cache
    _dashboardCache.works = null;
    _dashboardCache.stats = {};
    _dashboardCache.summary = {};
    _dashboardCache.notifications = null;
  },

  async getUserProfile(userId: string): Promise<User | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return mapProfileFromSupabase(data);
  },

  async updateUser(userId: string, data: Partial<User>, newPassword?: string) {
      if (!supabase) return;
      
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
          
          sessionCachePromise = null; // Invalida cache para forçar refresh
      } catch (e) {
          console.error("Erro updateUser:", e);
          throw e; // Repassa erro para a UI tratar
      }
  },

  async resetPassword(email: string) {
      if(!supabase) return false;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/settings'
      });
      return !error;
  },

  isSubscriptionActive(user: User): boolean {
    if (user.plan === PlanType.VITALICIO) return true;
    if (!user.subscriptionExpiresAt) return false;
    return new Date(user.subscriptionExpiresAt) > new Date();
  },

  async updatePlan(userId: string, plan: PlanType) {
      if (!supabase) return;
      
      let expires = new Date();
      if (plan === PlanType.MENSAL) expires.setDate(expires.getDate() + 30);
      if (plan === PlanType.SEMESTRAL) expires.setDate(expires.getDate() + 180);
      if (plan === PlanType.VITALICIO) expires.setFullYear(expires.getFullYear() + 100);

      await supabase.from('profiles').update({
          plan,
          subscription_expires_at: expires.toISOString(),
          is_trial: false
      }).eq('id', userId);
      
      sessionCachePromise = null;
  },

  async generatePix(_amount: number, _payer: any) {
      return {
          qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          copy_paste_code: "00020126330014BR.GOV.BCB.PIX011155555555555520400005303986540510.005802BR5913Mãos da Obra6008Brasilia62070503***63041234"
      };
  },

  // --- WORKS (WITH CACHING) ---
  async getWorks(userId: string): Promise<Work[]> {
    if (!supabase) return [];
    
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
        return [];
    }
    
    const parsed = (data || []).map(parseWorkFromDB);
    _dashboardCache.works = { data: parsed, timestamp: now };
    return parsed;
  },

  async getWorkById(workId: string): Promise<Work | null> {
    if (!supabase) return null;
    
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
    if (!supabase) throw new Error("Supabase off");
    
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
        living_rooms: work.living_rooms,
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
      if (!supabase || !workId) return;
      
      const safeArea = area && area > 0 ? area : 100;
      let materialsToInsert: any[] = [];

      const { data: dbSteps } = await supabase.from('steps').select('*').eq('work_id', workId);
      
      if (!dbSteps || dbSteps.length === 0) return;

      dbSteps.forEach((step: any) => {
          const packageForStep = FULL_MATERIAL_PACKAGES.find(p => p.category === step.name);
          if (packageForStep) {
              packageForStep.items.forEach(item => {
                  const qty = Math.ceil(safeArea * (item.multiplier || 1));
                  materialsToInsert.push({
                      work_id: workId,
                      name: item.name,
                      brand: '',
                      planned_qty: qty,
                      purchased_qty: 0,
                      unit: item.unit,
                      step_id: step.id,
                      category: step.name
                  });
              });
          }
      });

      if (materialsToInsert.length > 0) {
          await supabase.from('materials').insert(materialsToInsert);
      }
  },

  async deleteWork(workId: string) {
      if(!supabase) return;
      await supabase.from('works').delete().eq('id', workId);
      _dashboardCache.works = null;
      delete _dashboardCache.stats[workId];
      delete _dashboardCache.summary[workId];
  },

  // --- STEPS ---
  async getSteps(workId: string): Promise<Step[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('steps').select('*').eq('work_id', workId);
      return (data || []).map(parseStepFromDB);
  },

  async addStep(step: Step) {
      if (!supabase) return;
      await supabase.from('steps').insert({
          work_id: step.workId,
          name: step.name,
          start_date: step.startDate,
          end_date: step.endDate,
          status: step.status
      });
      // Invalidate related caches
      delete _dashboardCache.stats[step.workId];
      delete _dashboardCache.summary[step.workId];
  },

  async updateStep(step: Step) {
      if (!supabase) return;
      await supabase.from('steps').update({
          name: step.name,
          start_date: step.startDate,
          end_date: step.endDate,
          status: step.status
      }).eq('id', step.id);
      delete _dashboardCache.stats[step.workId];
      delete _dashboardCache.summary[step.workId];
  },

  // --- MATERIALS ---
  async getMaterials(workId: string): Promise<Material[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('materials').select('*').eq('work_id', workId);
      return (data || []).map(parseMaterialFromDB);
  },

  async addMaterial(mat: Material, purchaseInfo?: { qty: number, cost: number, date: string }) {
      if (!supabase) return { error: "Sem conexão" };
      
      const { data: savedMat, error } = await supabase.from('materials').insert({
          work_id: mat.workId,
          name: mat.name,
          brand: mat.brand,
          planned_qty: mat.plannedQty,
          unit: mat.unit,
          step_id: mat.stepId,
          category: mat.category
      }).select().single();

      if (error) return { error };

      if (purchaseInfo && savedMat) {
          await this.registerMaterialPurchase(savedMat.id, mat.name, mat.brand||'', mat.plannedQty, mat.unit, purchaseInfo.qty, purchaseInfo.cost);
      } else {
          // If no purchase, still need to invalidate summary because of pending items count
          delete _dashboardCache.summary[mat.workId];
      }
      return { data: savedMat };
  },

  async updateMaterial(mat: Material) {
      if (!supabase) return;
      await supabase.from('materials').update({
          name: mat.name,
          brand: mat.brand,
          planned_qty: mat.plannedQty,
          unit: mat.unit,
          category: mat.category
      }).eq('id', mat.id);
      delete _dashboardCache.summary[mat.workId];
  },

  async registerMaterialPurchase(materialId: string, name: string, _brand: string, _planned: number, _unit: string, qty: number, cost: number) {
      if (!supabase) return;
      
      const { data: mat } = await supabase.from('materials').select('purchased_qty, work_id, step_id').eq('id', materialId).single();
      
      if (mat) {
          await supabase.from('materials').update({
              purchased_qty: (mat.purchased_qty || 0) + qty
          }).eq('id', materialId);

          await supabase.from('expenses').insert({
              work_id: mat.work_id,
              description: `Compra: ${name}`,
              amount: cost,
              date: new Date().toISOString(),
              category: ExpenseCategory.MATERIAL,
              related_material_id: materialId,
              step_id: mat.step_id
          });
          
          delete _dashboardCache.stats[mat.work_id];
          delete _dashboardCache.summary[mat.work_id];
      }
  },

  // --- EXPENSES ---
  async getExpenses(workId: string): Promise<Expense[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('expenses').select('*').eq('work_id', workId);
      return (data || []).map(parseExpenseFromDB);
  },

  async addExpense(exp: Expense) {
      if (!supabase) return;
      await supabase.from('expenses').insert({
          work_id: exp.workId,
          description: exp.description,
          amount: exp.amount,
          date: exp.date,
          category: exp.category,
          step_id: exp.stepId,
          total_agreed: exp.totalAgreed
      });
      delete _dashboardCache.stats[exp.workId];
  },

  async updateExpense(exp: Expense) {
      if (!supabase) return;
      await supabase.from('expenses').update({
          description: exp.description,
          amount: exp.amount,
          date: exp.date,
          category: exp.category,
          step_id: exp.stepId,
          total_agreed: exp.totalAgreed
      }).eq('id', exp.id);
      delete _dashboardCache.stats[exp.workId];
  },

  async deleteExpense(id: string) {
      if (!supabase) return;
      // Need to find work_id first to invalidate cache correctly (or just wipe strict if complex)
      // For speed, let's assume we refresh on load. But cleaning specific cache is better.
      const { data } = await supabase.from('expenses').select('work_id').eq('id', id).single();
      await supabase.from('expenses').delete().eq('id', id);
      if (data) delete _dashboardCache.stats[data.work_id];
  },

  // --- WORKERS/SUPPLIERS (Standard CRUD, no heavy caching needed) ---
  async getWorkers(userId: string): Promise<Worker[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('workers').select('*').eq('user_id', userId);
      return (data || []).map(parseWorkerFromDB);
  },
  async addWorker(worker: Partial<Worker>) {
      if (!supabase) return;
      await supabase.from('workers').insert({ user_id: worker.userId, name: worker.name, role: worker.role, phone: worker.phone, notes: worker.notes });
  },
  async updateWorker(worker: Partial<Worker>) {
      if (!supabase) return;
      await supabase.from('workers').update({ name: worker.name, role: worker.role, phone: worker.phone, notes: worker.notes }).eq('id', worker.id);
  },
  async deleteWorker(id: string) {
      if (!supabase) return;
      await supabase.from('workers').delete().eq('id', id);
  },
  async getSuppliers(userId: string): Promise<Supplier[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('suppliers').select('*').eq('user_id', userId);
      return (data || []).map(parseSupplierFromDB);
  },
  async addSupplier(supplier: Partial<Supplier>) {
      if (!supabase) return;
      await supabase.from('suppliers').insert({ user_id: supplier.userId, name: supplier.name, category: supplier.category, phone: supplier.phone, notes: supplier.notes });
  },
  async updateSupplier(supplier: Partial<Supplier>) {
      if (!supabase) return;
      await supabase.from('suppliers').update({ name: supplier.name, category: supplier.category, phone: supplier.phone, notes: supplier.notes }).eq('id', supplier.id);
  },
  async deleteSupplier(id: string) {
      if (!supabase) return;
      await supabase.from('suppliers').delete().eq('id', id);
  },

  // --- PHOTOS & FILES ---
  async getPhotos(workId: string): Promise<WorkPhoto[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('work_photos').select('*').eq('work_id', workId).order('date', {ascending: false});
      return (data || []).map(parsePhotoFromDB);
  },
  async addPhoto(photo: WorkPhoto) {
      if (!supabase) return;
      await supabase.from('work_photos').insert({ work_id: photo.workId, url: photo.url, description: photo.description, date: photo.date, type: photo.type });
  },
  async getFiles(workId: string): Promise<WorkFile[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('work_files').select('*').eq('work_id', workId);
      return (data || []).map(parseFileFromDB);
  },
  async addFile(file: WorkFile) {
      if (!supabase) return;
      await supabase.from('work_files').insert({ work_id: file.workId, name: file.name, category: file.category, url: file.url, type: file.type, date: file.date });
  },

  // --- NOTIFICATIONS (WITH CACHE) ---
  async getNotifications(userId: string): Promise<Notification[]> {
      if (!supabase) return [];
      
      const now = Date.now();
      if (_dashboardCache.notifications && (now - _dashboardCache.notifications.timestamp < CACHE_TTL)) {
          return _dashboardCache.notifications.data;
      }

      const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).eq('read', false);
      const parsed = (data || []).map(parseNotificationFromDB);
      _dashboardCache.notifications = { data: parsed, timestamp: now };
      return parsed;
  },

  async dismissNotification(id: string) {
      if (!supabase) return;
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      _dashboardCache.notifications = null;
  },

  async clearAllNotifications(userId: string) {
      if (!supabase) return;
      await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
      _dashboardCache.notifications = null;
  },

  // --- DASHBOARD STATS (WITH CACHE) ---
  async calculateWorkStats(workId: string) {
      if (!supabase) return { totalSpent: 0, progress: 0, delayedSteps: 0 };
      
      const now = Date.now();
      if (_dashboardCache.stats[workId] && (now - _dashboardCache.stats[workId].timestamp < CACHE_TTL)) {
          return _dashboardCache.stats[workId].data;
      }

      const { data: expenses } = await supabase.from('expenses').select('amount').eq('work_id', workId);
      const totalSpent = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const { data: steps } = await supabase.from('steps').select('status, end_date').eq('work_id', workId);
      const totalSteps = steps?.length || 0;
      const completed = steps?.filter((s: any) => s.status === StepStatus.COMPLETED).length || 0;
      const progress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
      
      const today = new Date().toISOString().split('T')[0];
      const delayedSteps = steps?.filter((s: any) => s.end_date < today && s.status !== StepStatus.COMPLETED).length || 0;

      const result = { totalSpent, progress, delayedSteps };
      _dashboardCache.stats[workId] = { data: result, timestamp: now };
      return result;
  },

  async getDailySummary(workId: string) {
      if (!supabase) return { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 };
      
      const now = Date.now();
      if (_dashboardCache.summary[workId] && (now - _dashboardCache.summary[workId].timestamp < CACHE_TTL)) {
          return _dashboardCache.summary[workId].data;
      }

      const { data: steps } = await supabase.from('steps').select('*').eq('work_id', workId);
      const { data: materials } = await supabase.from('materials').select('*').eq('work_id', workId);

      const totalSteps = steps?.length || 0;
      const completedSteps = steps?.filter((s: any) => s.status === StepStatus.COMPLETED).length || 0;
      
      const today = new Date().toISOString().split('T')[0];
      const delayedSteps = steps?.filter((s: any) => s.end_date < today && s.status !== StepStatus.COMPLETED).length || 0;

      const pendingMaterials = materials?.filter((m: any) => (m.purchased_qty || 0) < (m.planned_qty || 0)).length || 0;

      const result = { completedSteps, delayedSteps, pendingMaterials, totalSteps };
      _dashboardCache.summary[workId] = { data: result, timestamp: now };
      return result;
  },

  async generateSmartNotifications(userId: string, workId: string) {
      if (!supabase) return;
      const { data: steps } = await supabase.from('steps').select('*').eq('work_id', workId);
      const today = new Date().toISOString().split('T')[0];
      
      const delays = steps?.filter((s: any) => s.end_date < today && s.status !== StepStatus.COMPLETED) || [];
      
      for (const step of delays) {
          const { data: exists } = await supabase.from('notifications')
            .select('*')
            .eq('user_id', userId)
            .ilike('message', `%${step.name}%`)
            .eq('read', false);
          
          if (!exists || exists.length === 0) {
              await supabase.from('notifications').insert({
                  user_id: userId,
                  title: 'Atraso Detectado',
                  message: `A etapa "${step.name}" deveria ter acabado em ${step.end_date}.`,
                  type: 'WARNING',
                  date: new Date().toISOString(),
                  read: false
              });
              // Invalidate notification cache
              _dashboardCache.notifications = null;
          }
      }
  }
};

