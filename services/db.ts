
import { 
  User, Work, Step, Material, Expense, Worker, Supplier, 
  WorkPhoto, WorkFile, Notification, PlanType,
  ExpenseCategory,
  WorkStatus,
  StepStatus
} from '../types';
import { WORK_TEMPLATES, FULL_MATERIAL_PACKAGES } from './standards';
import { supabase } from './supabase';

// --- HELPERS: Mapeamento de Snake_case (Banco) para CamelCase (App) ---

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
    stepId: data.step_id
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

// Helper para converter CamelCase para Snake_case para inserção
const mapWorkToDB = (work: Partial<Work>) => ({
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
});

export const dbService = {
  // --- AUTH ---
  async getCurrentUser() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return await this.getUserProfile(session.user.id);
  },

  async syncSession() {
    return this.getCurrentUser();
  },

  async login(email: string, password?: string) {
    if (!supabase) throw new Error("Supabase não configurado");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || '' });
    if (error) throw error;
    if (data.user) {
        return await this.getUserProfile(data.user.id);
    }
    return null;
  },

  async loginSocial(provider: 'google') {
    if (!supabase) return { error: 'Supabase not configured' };
    return await supabase.auth.signInWithOAuth({ provider });
  },

  async signup(name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) {
    if (!supabase) throw new Error("Supabase não configurado");
    
    // 1. Criar Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: password || '123456', // Password mandatory for email signup
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Erro ao criar usuário");

    // 2. Criar Perfil na tabela pública 'profiles'
    // Define trial expiration (7 days from now) if no plan selected
    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 7);

    const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        name,
        email,
        whatsapp,
        cpf,
        plan: planType || PlanType.MENSAL, // Default plan
        is_trial: true,
        subscription_expires_at: trialExpires.toISOString()
    });

    if (profileError) {
        // Rollback is tricky on client side, but usually this works fine
        console.error("Erro ao criar perfil:", profileError);
        throw new Error("Erro ao salvar dados do perfil.");
    }

    return await this.getUserProfile(authData.user.id);
  },

  async logout() {
    if (supabase) await supabase.auth.signOut();
  },

  async getUserProfile(userId: string): Promise<User | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) return null;
    return mapProfileFromSupabase(data);
  },

  async updateUser(userId: string, data: Partial<User>, newPassword?: string) {
      if (!supabase) return;
      
      const updates: any = {};
      if (data.name) updates.name = data.name;
      if (data.whatsapp) updates.whatsapp = data.whatsapp;
      
      await supabase.from('profiles').update(updates).eq('id', userId);

      if (newPassword) {
          await supabase.auth.updateUser({ password: newPassword });
      }
  },

  async resetPassword(email: string) {
      if (!supabase) return false;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/settings',
      });
      return !error;
  },

  onAuthChange(callback: (user: User | null) => void) {
      if (!supabase) return () => {};
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
              const profile = await this.getUserProfile(session.user.id);
              callback(profile);
          } else {
              callback(null);
          }
      });
      return () => data.subscription.unsubscribe();
  },

  isSubscriptionActive(user: User) {
      if (user.plan === PlanType.VITALICIO) return true;
      if (!user.subscriptionExpiresAt) return true; // New accounts might have undefined
      return new Date(user.subscriptionExpiresAt) > new Date();
  },

  async updatePlan(userId: string, plan: PlanType) {
      if (!supabase) return;
      
      let expiresAt = new Date();
      if (plan === PlanType.MENSAL) expiresAt.setMonth(expiresAt.getMonth() + 1);
      if (plan === PlanType.SEMESTRAL) expiresAt.setMonth(expiresAt.getMonth() + 6);
      if (plan === PlanType.VITALICIO) expiresAt.setFullYear(expiresAt.getFullYear() + 100);

      await supabase.from('profiles').update({
          plan: plan,
          subscription_expires_at: expiresAt.toISOString(),
          is_trial: false
      }).eq('id', userId);
  },

  // --- WORKS (OTIMIZADO) ---

  async getWorks(userId: string) {
    if (!supabase) return [];
    // Otimização: Select apenas campos necessários para a lista se possível, mas * é ok para poucas obras
    const { data, error } = await supabase
        .from('works')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching works:", error);
        return [];
    }
    return data.map(parseWorkFromDB);
  },

  async getWorkById(workId: string) {
      if (!supabase) return null;
      const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
      if (error) return null;
      return parseWorkFromDB(data);
  },

  // --- CRIAÇÃO DE OBRA OTIMIZADA (BULK INSERT) ---
  async createWork(workData: Omit<Work, 'id'>, templateId?: string) {
      if (!supabase) throw new Error("Offline");

      // 1. Create Work
      const { data: work, error } = await supabase
          .from('works')
          .insert(mapWorkToDB(workData))
          .select()
          .single();
      
      if (error) throw error;
      if (!work) throw new Error("Falha ao criar obra");

      // 2. Generate Steps & Materials (In Memory for Bulk Insert)
      if (templateId) {
          const template = WORK_TEMPLATES.find(t => t.id === templateId);
          if (template) {
              const stepsPayload = [];
              const materialsPayload = [];
              
              const startDate = new Date(workData.startDate);
              let currentDate = new Date(startDate);
              const daysPerStep = Math.ceil(template.defaultDurationDays / template.includedSteps.length);

              // Prepare Steps Payload
              for (const stepName of template.includedSteps) {
                  const endDate = new Date(currentDate);
                  endDate.setDate(endDate.getDate() + daysPerStep);
                  
                  stepsPayload.push({
                      work_id: work.id,
                      name: stepName,
                      start_date: currentDate.toISOString().split('T')[0],
                      end_date: endDate.toISOString().split('T')[0],
                      status: 'NAO_INICIADO', // StepStatus.NOT_STARTED
                      is_delayed: false
                  });
                  currentDate = new Date(endDate);
              }

              // BULK INSERT STEPS
              // Usamos select() para receber os IDs gerados se precisássemos vincular materiais
              const { error: stepError } = await supabase
                  .from('steps')
                  .insert(stepsPayload);
              
              if (stepError) console.error("Erro ao inserir etapas:", stepError);

              // Prepare Materials Payload (Vinculados à obra, sem vínculo rígido de etapa por enquanto para performance)
              for (const cat of FULL_MATERIAL_PACKAGES) {
                  const area = workData.area || 50; 
                  for (const item of cat.items) {
                      const qty = Math.ceil((item.multiplier || 1) * area);
                      materialsPayload.push({
                          work_id: work.id,
                          name: item.name,
                          planned_qty: qty,
                          purchased_qty: 0,
                          unit: item.unit,
                          brand: 'Genérico',
                          // step_id: null (opcional: implementar lógica de match de nome depois)
                      });
                  }
              }

              // BULK INSERT MATERIALS
              // Dividir em chunks se for muito grande (opcional, mas Supabase aguenta bem ~500 rows)
              if (materialsPayload.length > 0) {
                  const { error: matError } = await supabase
                      .from('materials')
                      .insert(materialsPayload);
                  if (matError) console.error("Erro ao inserir materiais:", matError);
              }
          }
      }

      return parseWorkFromDB(work);
  },

  async deleteWork(workId: string) {
      if (!supabase) return;
      // Cascade delete should handle related tables ideally, but strictly:
      await supabase.from('works').delete().eq('id', workId);
  },

  // --- DASHBOARD STATS (OTIMIZADO) ---
  
  async calculateWorkStats(workId: string) {
    if (!supabase) return { totalSpent: 0, progress: 0, delayedSteps: 0 };

    // Executar queries em paralelo e buscando APENAS colunas necessárias
    const [expensesRes, stepsRes] = await Promise.all([
        supabase.from('expenses').select('amount').eq('work_id', workId),
        supabase.from('steps').select('status').eq('work_id', workId)
    ]);

    const totalSpent = expensesRes.data?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
    
    const steps = stepsRes.data || [];
    const totalSteps = steps.length;
    const completed = steps.filter(s => s.status === 'CONCLUIDO').length;
    const progress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;

    return { totalSpent, progress, delayedSteps: 0 };
  },

  async getDailySummary(workId: string) {
    if (!supabase) return { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 };

    const today = new Date().toISOString().split('T')[0];
    
    // Otimização: Query específica para contagem
    const { count: completedCount } = await supabase
        .from('steps')
        .select('*', { count: 'exact', head: true })
        .eq('work_id', workId)
        .eq('status', 'CONCLUIDO');

    // Buscar etapas não concluídas para verificar atraso
    const { data: activeSteps } = await supabase
        .from('steps')
        .select('end_date')
        .eq('work_id', workId)
        .neq('status', 'CONCLUIDO');
    
    const delayedSteps = activeSteps?.filter(s => s.end_date < today).length || 0;

    // Buscar materiais pendentes (Isso precisa de dados, não só count, pois é computado)
    // Limitando colunas para leveza
    const { data: materials } = await supabase
        .from('materials')
        .select('planned_qty, purchased_qty')
        .eq('work_id', workId);
    
    const pendingMaterials = materials?.filter(m => (Number(m.purchased_qty) || 0) < (Number(m.planned_qty) || 0)).length || 0;

    return {
        completedSteps: completedCount || 0,
        delayedSteps,
        pendingMaterials,
        totalSteps: 0 // não usado
    };
  },

  // --- GENERIC GETTERS ---

  async getSteps(workId: string) {
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
          status: step.status,
          is_delayed: step.isDelayed
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

  async getMaterials(workId: string) {
      if (!supabase) return [];
      const { data } = await supabase.from('materials').select('*').eq('work_id', workId);
      return (data || []).map(parseMaterialFromDB);
  },

  async addMaterial(mat: Material, purchaseInfo?: { qty: number, cost: number, date: string }) {
      if (!supabase) return;
      const { data } = await supabase.from('materials').insert({
          work_id: mat.workId,
          name: mat.name,
          brand: mat.brand,
          planned_qty: mat.plannedQty,
          purchased_qty: purchaseInfo ? purchaseInfo.qty : 0,
          unit: mat.unit,
          step_id: mat.stepId
      }).select().single();

      if (purchaseInfo && data) {
          await this.addExpense({
              id: '', // DB generates
              workId: mat.workId,
              description: `Compra: ${mat.name}`,
              amount: purchaseInfo.cost,
              date: purchaseInfo.date,
              category: ExpenseCategory.MATERIAL,
              relatedMaterialId: data.id
          });
      }
  },

  async updateMaterial(mat: Material) {
      if (!supabase) return;
      await supabase.from('materials').update({
          name: mat.name,
          brand: mat.brand,
          planned_qty: mat.plannedQty,
          purchased_qty: mat.purchasedQty,
          unit: mat.unit
      }).eq('id', mat.id);
  },

  async registerMaterialPurchase(matId: string, name: string, brand: string, plannedQty: number, unit: string, buyQty: number, cost: number) {
      if (!supabase) return;
      
      // Get current qty
      const { data: current } = await supabase.from('materials').select('purchased_qty, work_id').eq('id', matId).single();
      if (!current) return;

      const newQty = (Number(current.purchased_qty) || 0) + buyQty;

      await supabase.from('materials').update({
          purchased_qty: newQty,
          brand: brand || undefined // Update brand if provided
      }).eq('id', matId);

      // Add expense automatically
      await this.addExpense({
          id: '',
          workId: current.work_id,
          description: `Compra: ${name}`,
          amount: cost,
          date: new Date().toISOString(),
          category: ExpenseCategory.MATERIAL,
          relatedMaterialId: matId
      });
  },

  async getExpenses(workId: string) {
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
          related_material_id: exp.relatedMaterialId,
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

  // --- WORKERS & SUPPLIERS ---

  async getWorkers(userId: string) {
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
      if (!supabase || !worker.id) return;
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

  async getSuppliers(userId: string) {
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
      if (!supabase || !supplier.id) return;
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

  async getPhotos(workId: string) {
      if (!supabase) return [];
      const { data } = await supabase.from('work_photos').select('*').eq('work_id', workId).order('date', {ascending: false});
      return (data || []).map(parsePhotoFromDB);
  },

  async addPhoto(photo: WorkPhoto) {
      if (!supabase) return;
      await supabase.from('work_photos').insert({
          work_id: photo.workId,
          url: photo.url, // In real app, upload to storage and save URL
          description: photo.description,
          date: photo.date,
          type: photo.type
      });
  },

  async getFiles(workId: string) {
      if (!supabase) return [];
      const { data } = await supabase.from('work_files').select('*').eq('work_id', workId).order('date', {ascending: false});
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

  // --- NOTIFICATIONS ---

  async getNotifications(userId: string) {
      if (!supabase) return [];
      const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('date', {ascending: false}).limit(10);
      return (data || []).map(parseNotificationFromDB);
  },

  async generateSmartNotifications(userId: string, workId: string) {
      // Logic to generate notifications based on delays, budget, etc.
      // For MVP, simplistic check:
      if (!supabase) return;
      const { data: steps } = await supabase.from('steps').select('name, end_date').eq('work_id', workId).neq('status', 'CONCLUIDO');
      const today = new Date().toISOString().split('T')[0];
      
      const delayed = steps?.filter(s => s.end_date < today) || [];
      if (delayed.length > 0) {
          // Check if notification already exists today to avoid spam
          const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).like('title', 'Atraso%').gte('date', today);
          
          if (!count || count === 0) {
              await supabase.from('notifications').insert({
                  user_id: userId,
                  title: 'Atraso Identificado',
                  message: `Você tem ${delayed.length} etapas atrasadas na obra. Verifique o cronograma.`,
                  date: new Date().toISOString(),
                  read: false,
                  type: 'WARNING'
              });
          }
      }
  },

  async dismissNotification(id: string) {
      if (!supabase) return;
      await supabase.from('notifications').delete().eq('id', id);
  },

  async clearAllNotifications(userId: string) {
      if (!supabase) return;
      await supabase.from('notifications').delete().eq('user_id', userId);
  },

  // --- PIX MOCK ---
  async generatePix(amount: number, user: { name: string, email: string, cpf?: string }) {
      return {
          qr_code_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', // Mock pixel
          copy_paste_code: `00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540${amount.toFixed(2).replace('.','')}5802BR5913${user.name.substring(0,13)}6008BRASILIA62070503***6304`
      };
  }
};
