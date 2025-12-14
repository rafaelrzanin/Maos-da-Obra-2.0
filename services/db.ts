
import { 
  User, Work, Step, Material, Expense, Worker, Supplier, 
  WorkPhoto, WorkFile, Notification, PlanType,
  ExpenseCategory, StepStatus
} from '../types';
import { WORK_TEMPLATES, FULL_MATERIAL_PACKAGES } from './standards';
import { supabase } from './supabase';

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

// --- CACHE ---
let cachedUserPromise: Promise<User | null> | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5000;

// Função crítica: Garante que o perfil existe. Se falhar com 403, o app trava.
const ensureUserProfile = async (authUser: any): Promise<User | null> => {
    if (!authUser || !supabase) return null;

    try {
        // 1. Tenta ler o perfil existente
        const { data: existingProfile, error: readError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

        if (existingProfile) {
            return mapProfileFromSupabase(existingProfile);
        }

        // Se deu erro de permissão (403), não adianta tentar inserir, vai falhar também.
        // Mas se for null (não encontrado), tentamos inserir.
        if (readError && readError.code === '42501') { // 42501 = Permission denied
             console.error("ERRO CRÍTICO 403: Permissão negada ao ler perfil. Verifique as Policies no Supabase.");
             // Tentamos retornar um objeto temporário para não crashar a UI, mas as operações de banco falharão
             return {
                id: authUser.id,
                name: authUser.user_metadata?.name || 'Erro de Permissão',
                email: authUser.email || '',
                plan: PlanType.MENSAL,
                isTrial: true
             };
        }

        // 2. Se não existe, cria
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

        const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .insert(newProfileData)
            .select()
            .single();

        if (createError) {
            console.error("Erro ao criar perfil:", createError);
            // Retorna dados da memória em caso de falha no DB
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

export const dbService = {
  // --- AUTH ---
  async getCurrentUser() {
    if (!supabase) return null;
    
    const now = Date.now();
    if (cachedUserPromise && (now - lastCacheTime < CACHE_DURATION)) {
        return cachedUserPromise;
    }

    cachedUserPromise = (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        return await ensureUserProfile(session.user);
    })();
    
    lastCacheTime = now;
    return cachedUserPromise;
  },

  async syncSession() {
    cachedUserPromise = null;
    return this.getCurrentUser();
  },

  onAuthChange(callback: (user: User | null) => void) {
    if (!supabase) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        cachedUserPromise = null;
        
        if (session?.user) {
            const user = await ensureUserProfile(session.user);
            callback(user);
        } else {
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
        cachedUserPromise = null;
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

    // Tenta inserir direto. O RLS deve permitir 'INSERT' para 'auth.uid() = id'
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
        // Não lançamos erro aqui para não bloquear o signup do Auth,
        // o ensureUserProfile vai tentar corrigir no próximo load.
    }

    cachedUserPromise = null;
    return await ensureUserProfile(authData.user);
  },

  async logout() {
    if (supabase) await supabase.auth.signOut();
    cachedUserPromise = null;
  },

  async getUserProfile(userId: string): Promise<User | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return mapProfileFromSupabase(data);
  },

  async updateUser(userId: string, data: Partial<User>, newPassword?: string) {
      if (!supabase) return;
      const updates: any = {};
      if (data.name) updates.name = data.name;
      if (data.whatsapp) updates.whatsapp = data.whatsapp;
      if (data.plan) updates.plan = data.plan;

      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', userId);
      }
      if (newPassword) {
          await supabase.auth.updateUser({ password: newPassword });
      }
      cachedUserPromise = null;
  },

  async resetPassword(email: string) {
      if(!supabase) return false;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/settings'
      });
      return !error;
  },

  // --- SUBSCRIPTION ---
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
      
      cachedUserPromise = null;
  },

  async generatePix(_amount: number, _payer: any) {
      return {
          qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          copy_paste_code: "00020126330014BR.GOV.BCB.PIX011155555555555520400005303986540510.005802BR5913Mãos da Obra6008Brasilia62070503***63041234"
      };
  },

  // --- WORKS ---
  async getWorks(userId: string): Promise<Work[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('works')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error("Erro ao buscar obras (getWorks):", error);
        return [];
    }
    
    return (data || []).map(parseWorkFromDB);
  },

  async getWorkById(workId: string): Promise<Work | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
    if (error) {
        console.error("Erro ao buscar obra por ID:", error);
        return null;
    }
    return data ? parseWorkFromDB(data) : null;
  },

  async createWork(work: Partial<Work>, templateId: string): Promise<Work> {
    if (!supabase) throw new Error("Supabase off");
    
    // 1. Create Work
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
        living_rooms: work.livingRooms,
        has_leisure_area: work.hasLeisureArea
    };

    // Insert da Obra - Ponto crítico de RLS
    const { data: savedWork, error } = await supabase.from('works').insert(dbWork).select().single();
    
    if (error) {
        console.error("Erro SQL ao criar obra:", error);
        throw new Error(`Erro ao criar obra no banco: ${error.message} (${error.code})`);
    }
    
    const parsedWork = parseWorkFromDB(savedWork);

    // 2. Generate Steps
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
        
        const { error: stepsError } = await supabase.from('steps').insert(stepsToInsert);
        if (stepsError) console.error("Erro ao gerar etapas:", stepsError);

        // 3. GENERATE MATERIALS (AWAITING HERE TO ENSURE COMPLETION)
        await this.regenerateMaterials(parsedWork.id, parsedWork.area, templateId);
    }

    return parsedWork;
  },

  // --- ROBUST MATERIAL GENERATION ---
  async regenerateMaterials(workId: string, area: number, templateId: string = 'CONSTRUCAO') {
      if (!supabase) return;
      if (!workId) return;
      
      const safeArea = area && area > 0 ? area : 100; // Default safer area
      let materialsToInsert: any[] = [];

      let packagesToInclude = [];
      const safeTemplateId = templateId || 'CONSTRUCAO';

      if (safeTemplateId === 'CONSTRUCAO') {
          packagesToInclude = FULL_MATERIAL_PACKAGES;
      } else if (safeTemplateId === 'REFORMA_APTO') {
          packagesToInclude = FULL_MATERIAL_PACKAGES.filter(p => 
              !['Fundação e Estrutura', 'Telhado e Cobertura', 'Limpeza e Canteiro'].includes(p.category)
          );
      } else if (safeTemplateId === 'BANHEIRO') {
          packagesToInclude = FULL_MATERIAL_PACKAGES.filter(p => 
              ['Instalações Hidráulicas (Tubulação)', 'Pisos e Revestimentos Cerâmicos', 'Louças e Metais (Acabamento Hidro)', 'Marmoraria e Granitos', 'Impermeabilização'].includes(p.category)
          );
      } else if (safeTemplateId === 'PINTURA') {
          packagesToInclude = FULL_MATERIAL_PACKAGES.filter(p => p.category === 'Pintura');
      } else {
          packagesToInclude = FULL_MATERIAL_PACKAGES;
      }

      packagesToInclude.forEach(pkg => {
          pkg.items.forEach(item => {
              const qty = Math.ceil(safeArea * (item.multiplier || 1));
              materialsToInsert.push({
                  work_id: workId,
                  name: item.name,
                  brand: '',
                  planned_qty: qty,
                  purchased_qty: 0,
                  unit: item.unit,
                  category: pkg.category
              });
          });
      });

      if (materialsToInsert.length > 0) {
          // BATCH INSERT (Should work with correct SQL Schema)
          const { error } = await supabase.from('materials').insert(materialsToInsert);
          if (error) {
              console.error("FATAL: Failed to insert materials.", error);
              // Não lança erro para não quebrar a UI, mas loga.
          }
      }
  },

  async deleteWork(workId: string) {
      if(!supabase) return;
      await supabase.from('works').delete().eq('id', workId);
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
  },

  async updateStep(step: Step) {
      if (!supabase) return;
      await supabase.from('steps').update({
          name: step.name,
          start_date: step.startDate,
          end_date: step.endDate,
          status: step.status
      }).eq('id', step.id);
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
  },

  async registerMaterialPurchase(materialId: string, name: string, _brand: string, _planned: number, _unit: string, qty: number, cost: number) {
      if (!supabase) return;
      
      // FIX: Fetch step_id from the material record to link the expense
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
              step_id: mat.step_id // Ensures the expense is linked to the construction step
          });
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
  },

  async deleteExpense(id: string) {
      if (!supabase) return;
      await supabase.from('expenses').delete().eq('id', id);
  },

  // --- TEAM & SUPPLIERS ---
  async getWorkers(userId: string): Promise<Worker[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('workers').select('*').eq('user_id', userId);
      return (data || []).map(parseWorkerFromDB);
  },

  async addWorker(worker: Partial<Worker>) {
      if (!supabase) return;
      await supabase.from('workers').insert({
          user_id: worker.userId,
          name: worker.name,
          role: worker.role,
          phone: worker.phone,
          notes: worker.notes
      });
  },

  async updateWorker(worker: Partial<Worker>) {
      if (!supabase) return;
      await supabase.from('workers').update({
          name: worker.name,
          role: worker.role,
          phone: worker.phone,
          notes: worker.notes
      }).eq('id', worker.id);
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
      await supabase.from('suppliers').insert({
          user_id: supplier.userId,
          name: supplier.name,
          category: supplier.category,
          phone: supplier.phone,
          notes: supplier.notes
      });
  },

  async updateSupplier(supplier: Partial<Supplier>) {
      if (!supabase) return;
      await supabase.from('suppliers').update({
          name: supplier.name,
          category: supplier.category,
          phone: supplier.phone,
          notes: supplier.notes
      }).eq('id', supplier.id);
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
      await supabase.from('work_photos').insert({
          work_id: photo.workId,
          url: photo.url,
          description: photo.description,
          date: photo.date,
          type: photo.type
      });
  },

  async getFiles(workId: string): Promise<WorkFile[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('work_files').select('*').eq('work_id', workId);
      return (data || []).map(parseFileFromDB);
  },

  async addFile(file: WorkFile) {
      if (!supabase) return;
      await supabase.from('work_files').insert({
          work_id: file.workId,
          name: file.name,
          category: file.category,
          url: file.url,
          type: file.type,
          date: file.date
      });
  },

  // --- NOTIFICATIONS & DASHBOARD ---
  async getNotifications(userId: string): Promise<Notification[]> {
      if (!supabase) return [];
      const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).eq('read', false);
      return (data || []).map(parseNotificationFromDB);
  },

  async dismissNotification(id: string) {
      if (!supabase) return;
      await supabase.from('notifications').update({ read: true }).eq('id', id);
  },

  async clearAllNotifications(userId: string) {
      if (!supabase) return;
      await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
  },

  async calculateWorkStats(workId: string) {
      if (!supabase) return { totalSpent: 0, progress: 0, delayedSteps: 0 };
      
      const { data: expenses } = await supabase.from('expenses').select('amount').eq('work_id', workId);
      const totalSpent = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const { data: steps } = await supabase.from('steps').select('status, end_date').eq('work_id', workId);
      const totalSteps = steps?.length || 0;
      const completed = steps?.filter((s: any) => s.status === StepStatus.COMPLETED).length || 0;
      const progress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
      
      const today = new Date().toISOString().split('T')[0];
      const delayedSteps = steps?.filter((s: any) => s.end_date < today && s.status !== StepStatus.COMPLETED).length || 0;

      return { totalSpent, progress, delayedSteps };
  },

  async getDailySummary(workId: string) {
      if (!supabase) return { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 };
      
      const { data: steps } = await supabase.from('steps').select('*').eq('work_id', workId);
      const { data: materials } = await supabase.from('materials').select('*').eq('work_id', workId);

      const totalSteps = steps?.length || 0;
      const completedSteps = steps?.filter((s: any) => s.status === StepStatus.COMPLETED).length || 0;
      
      const today = new Date().toISOString().split('T')[0];
      const delayedSteps = steps?.filter((s: any) => s.end_date < today && s.status !== StepStatus.COMPLETED).length || 0;

      const pendingMaterials = materials?.filter((m: any) => (m.purchased_qty || 0) < (m.planned_qty || 0)).length || 0;

      return { completedSteps, delayedSteps, pendingMaterials, totalSteps };
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
          }
      }
  }
};

