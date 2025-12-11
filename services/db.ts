
import { 
  User, Work, Step, Material, Expense, Worker, Supplier, 
  WorkPhoto, WorkFile, Notification, PlanType,
  ExpenseCategory
} from '../types';
import { WORK_TEMPLATES } from './standards';
import { supabase } from './supabase';

// --- HELPER: Mapeamento de Snake_case (Banco) para CamelCase (App) ---
const mapProfileFromSupabase = (data: any): User => ({
    id: data.id,
    name: data.name || 'Usuário',
    email: data.email || '',
    whatsapp: data.whatsapp,
    cpf: data.cpf,
    plan: data.plan as PlanType,
    subscriptionExpiresAt: data.subscription_expires_at
});

export const dbService = {
  
  // --- AUTHENTICATION & PROFILE ---

  getCurrentUser: (): User | null => {
    const json = localStorage.getItem('maos_user');
    try { return json ? JSON.parse(json) : null; } catch { return null; }
  },
  
  syncSession: async (): Promise<User | null> => {
    if (!supabase) return dbService.getCurrentUser();
    
    // 1. Verificar sessão ativa
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        localStorage.removeItem('maos_user');
        return null;
    }

    // 2. Buscar perfil atualizado
    const profile = await dbService.getUserProfile(session.user.id);
    if (profile) {
        localStorage.setItem('maos_user', JSON.stringify(profile));
        return profile;
    }
    
    // 3. Auto-correção: Se tem sessão mas não tem perfil, cria agora
    return await dbService.createProfileFromAuth(session.user);
  },

  onAuthChange: (callback: (user: User | null) => void) => {
     if (!supabase) return () => {};
     const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            let user = await dbService.getUserProfile(session.user.id);
            if (!user) user = await dbService.createProfileFromAuth(session.user);
            
            localStorage.setItem('maos_user', JSON.stringify(user));
            callback(user);
        } else if (event === 'SIGNED_OUT') {
            localStorage.removeItem('maos_user');
            callback(null);
        }
     });
     return () => subscription.unsubscribe();
  },

  isSubscriptionActive: (user: User) => {
    if (user.plan === PlanType.VITALICIO) return true;
    if (!user.subscriptionExpiresAt) return false;
    return new Date(user.subscriptionExpiresAt) > new Date();
  },

  // Busca perfil na tabela 'profiles'
  getUserProfile: async (userId: string): Promise<User | null> => {
      if (!supabase) return null;
      try {
          const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
          
          if (error || !data) return null;
          return mapProfileFromSupabase(data);
      } catch (e) {
          console.error("Erro ao buscar perfil:", e);
          return null;
      }
  },

  // Cria perfil na tabela 'profiles' baseado no usuário Auth (Self-healing)
  createProfileFromAuth: async (authUser: any, metadata: any = {}): Promise<User | null> => {
      if (!supabase) return null;
      
      const newProfile = {
          id: authUser.id,
          email: authUser.email,
          name: metadata.name || authUser.user_metadata?.name || 'Usuário',
          whatsapp: metadata.whatsapp || authUser.user_metadata?.whatsapp || '',
          cpf: metadata.cpf || authUser.user_metadata?.cpf || '',
          plan: metadata.plan || null,
          subscription_expires_at: metadata.plan ? new Date(Date.now() + 30*24*60*60*1000).toISOString() : null
      };

      const { error } = await supabase.from('profiles').upsert([newProfile]);
      
      if (error) {
          console.error("Erro ao criar perfil:", error);
          return null;
      }
      return mapProfileFromSupabase(newProfile);
  },

  login: async (email: string, password?: string): Promise<User | null> => {
     if (!supabase) throw new Error("Erro de conexão: Supabase não configurado.");
     if (!password) throw new Error("Senha obrigatória.");

     // 1. Auth com Supabase
     const { data, error } = await supabase.auth.signInWithPassword({ email, password });
     if (error) throw error;
     if (!data.user) return null;

     // 2. Busca Perfil
     let profile = await dbService.getUserProfile(data.user.id);
     
     // 3. Fallback Crítico: Se o Auth existe mas o Profile não, cria agora.
     if (!profile) {
         console.warn("Perfil ausente para usuário autenticado. Criando...");
         profile = await dbService.createProfileFromAuth(data.user);
     }

     if (profile) localStorage.setItem('maos_user', JSON.stringify(profile));
     return profile;
  },

  signup: async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null): Promise<User | null> => {
      if (!supabase) throw new Error("Supabase não configurado.");
      if (!password) throw new Error("Senha obrigatória.");

      // 1. Criar Usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, whatsapp, cpf } }
      });

      if (authError) throw authError;
      if (!authData.user) return null;

      // 2. Inserir na tabela 'profiles'
      const initialPlan = (planType as PlanType) || null;
      const profile = await dbService.createProfileFromAuth(authData.user, { name, whatsapp, cpf, plan: initialPlan });

      if (!profile) throw new Error("Conta criada, mas houve erro ao salvar o perfil. Tente fazer login.");

      localStorage.setItem('maos_user', JSON.stringify(profile));
      return profile;
  },

  logout: async () => {
      if (supabase) await supabase.auth.signOut();
      localStorage.removeItem('maos_user');
  },

  updateUser: async (userId: string, data: Partial<User>, newPassword?: string) => {
      if (!supabase) return;
      
      // Atualiza tabela profiles
      const updates: any = {};
      if (data.name) updates.name = data.name;
      if (data.whatsapp) updates.whatsapp = data.whatsapp;
      
      if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', userId);
      }

      // Atualiza senha se fornecida
      if (newPassword) {
          await supabase.auth.updateUser({ password: newPassword });
      }
  },

  updatePlan: async (userId: string, plan: PlanType) => {
      if (!supabase) return;
      // Define expiração baseada no plano
      let expires = new Date();
      if (plan === PlanType.MENSAL) expires.setDate(expires.getDate() + 30);
      else if (plan === PlanType.SEMESTRAL) expires.setDate(expires.getDate() + 180);
      else if (plan === PlanType.VITALICIO) expires.setFullYear(expires.getFullYear() + 100);

      await supabase.from('profiles').update({
          plan: plan,
          subscription_expires_at: expires.toISOString()
      }).eq('id', userId);
  },

  resetPassword: async (email: string) => {
      if (!supabase) return false;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/settings',
      });
      return !error;
  },

  loginSocial: async (provider: 'google') => {
      if (!supabase) return { user: null, error: 'No Supabase' };
      const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider,
          options: { redirectTo: window.location.origin }
      });
      return { user: data, error };
  },

  // --- DATA METHODS (CRUD) ---

  // 1. WORKS (OBRAS)
  getWorks: async (userId: string): Promise<Work[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('works').select('*').eq('userId', userId);
      return (data || []).map(w => ({
          ...w,
          budgetPlanned: Number(w.budgetPlanned), // Ensure number
          area: Number(w.area)
      }));
  },

  getWorkById: async (workId: string): Promise<Work | null> => {
      if (!supabase) return null;
      const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
      if (error || !data) return null;
      return {
          ...data,
          budgetPlanned: Number(data.budgetPlanned),
          area: Number(data.area)
      } as Work;
  },

  createWork: async (work: Omit<Work, 'id'>, templateId?: string): Promise<Work> => {
      if (!supabase) throw new Error("Offline");
      
      // 1. Insert Work
      const { data, error } = await supabase.from('works').insert([{
          userId: work.userId,
          name: work.name,
          address: work.address,
          budgetPlanned: work.budgetPlanned,
          startDate: work.startDate,
          endDate: work.endDate,
          area: work.area,
          status: work.status || 'Planejamento',
          notes: work.notes
      }]).select().single();

      if (error || !data) throw error || new Error("Erro ao criar obra");
      const newWork = data as Work;

      // 2. Apply Template (Steps) if selected
      if (templateId) {
          const template = WORK_TEMPLATES.find(t => t.id === templateId);
          if (template) {
              const stepsPayload = template.includedSteps.map(stepName => ({
                  workId: newWork.id,
                  name: stepName,
                  startDate: newWork.startDate,
                  endDate: newWork.endDate,
                  status: 'NAO_INICIADO',
                  isDelayed: false
              }));
              await supabase.from('steps').insert(stepsPayload);
          }
      }
      return newWork;
  },

  deleteWork: async (workId: string) => {
      if (!supabase) return;
      await supabase.from('works').delete().eq('id', workId);
  },

  // 2. STEPS (ETAPAS)
  getSteps: async (workId: string): Promise<Step[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('steps').select('*').eq('workId', workId);
      return (data || []) as Step[];
  },

  addStep: async (step: Step) => {
      if (!supabase) return;
      await supabase.from('steps').insert([{
          workId: step.workId,
          name: step.name,
          startDate: step.startDate,
          endDate: step.endDate,
          status: step.status
      }]);
  },

  updateStep: async (step: Step) => {
      if (!supabase) return;
      await supabase.from('steps').update({
          name: step.name,
          startDate: step.startDate,
          endDate: step.endDate,
          status: step.status
      }).eq('id', step.id);
  },

  // 3. MATERIALS
  getMaterials: async (workId: string): Promise<Material[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('materials').select('*').eq('workId', workId);
      return (data || []) as Material[];
  },

  addMaterial: async (material: Material, purchaseData?: { qty: number, cost: number, date: string }) => {
      if (!supabase) return;
      
      const { data: matData } = await supabase.from('materials').insert([{
          workId: material.workId,
          name: material.name,
          brand: material.brand,
          plannedQty: material.plannedQty,
          purchasedQty: purchaseData ? purchaseData.qty : 0,
          unit: material.unit,
          stepId: material.stepId
      }]).select().single();

      if (purchaseData && matData) {
          await dbService.addExpense({
              id: '', // DB generates
              workId: material.workId,
              description: `Compra: ${material.name}`,
              amount: purchaseData.cost,
              date: purchaseData.date,
              category: ExpenseCategory.MATERIAL,
              relatedMaterialId: matData.id,
              stepId: material.stepId
          });
      }
  },

  updateMaterial: async (material: Material) => {
      if (!supabase) return;
      await supabase.from('materials').update({
          name: material.name,
          brand: material.brand,
          plannedQty: material.plannedQty,
          unit: material.unit
      }).eq('id', material.id);
  },

  registerMaterialPurchase: async (matId: string, name: string, brand: string, plannedQty: number, unit: string, buyQty: number, cost: number) => {
      if (!supabase) return;
      
      // 1. Get current
      const { data: current } = await supabase.from('materials').select('purchasedQty, workId, stepId').eq('id', matId).single();
      if (!current) return;

      // 2. Update Material (Qty, Brand, Name, PlannedQty if changed)
      const newPurchasedQty = (current.purchasedQty || 0) + buyQty;
      
      await supabase.from('materials').update({ 
          purchasedQty: newPurchasedQty,
          name: name,
          brand: brand,
          plannedQty: plannedQty,
          unit: unit
      }).eq('id', matId);

      // 3. Add Expense
      await dbService.addExpense({
          id: '',
          workId: current.workId,
          description: `Compra: ${name}`,
          amount: cost,
          date: new Date().toISOString(),
          category: ExpenseCategory.MATERIAL,
          relatedMaterialId: matId,
          stepId: current.stepId
      });
  },

  // 4. EXPENSES (FINANCEIRO)
  getExpenses: async (workId: string): Promise<Expense[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('expenses').select('*').eq('workId', workId);
      return (data || []) as Expense[];
  },

  addExpense: async (expense: Expense) => {
      if (!supabase) return;
      await supabase.from('expenses').insert([{
          workId: expense.workId,
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
          stepId: expense.stepId,
          relatedMaterialId: expense.relatedMaterialId,
          totalAgreed: expense.totalAgreed
      }]);
  },

  updateExpense: async (expense: Expense) => {
      if (!supabase) return;
      await supabase.from('expenses').update({
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
          stepId: expense.stepId,
          totalAgreed: expense.totalAgreed
      }).eq('id', expense.id);
  },

  deleteExpense: async (id: string) => {
      if (!supabase) return;
      await supabase.from('expenses').delete().eq('id', id);
  },

  // 5. TEAMS & SUPPLIERS
  getWorkers: async (userId: string): Promise<Worker[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('workers').select('*').eq('userId', userId);
      return (data || []) as Worker[];
  },
  addWorker: async (worker: Omit<Worker, 'id'>) => {
      if (!supabase) return;
      await supabase.from('workers').insert([{
          userId: worker.userId,
          name: worker.name,
          role: worker.role,
          phone: worker.phone,
          notes: worker.notes
      }]);
  },
  updateWorker: async (worker: Worker) => {
      if (!supabase) return;
      await supabase.from('workers').update(worker).eq('id', worker.id);
  },
  deleteWorker: async (id: string) => {
      if (supabase) await supabase.from('workers').delete().eq('id', id);
  },

  getSuppliers: async (userId: string): Promise<Supplier[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('suppliers').select('*').eq('userId', userId);
      return (data || []) as Supplier[];
  },
  addSupplier: async (supplier: Omit<Supplier, 'id'>) => {
      if (!supabase) return;
      await supabase.from('suppliers').insert([{
          userId: supplier.userId,
          name: supplier.name,
          category: supplier.category,
          phone: supplier.phone,
          notes: supplier.notes
      }]);
  },
  updateSupplier: async (supplier: Supplier) => {
      if (!supabase) return;
      await supabase.from('suppliers').update(supplier).eq('id', supplier.id);
  },
  deleteSupplier: async (id: string) => {
      if (supabase) await supabase.from('suppliers').delete().eq('id', id);
  },

  // 6. PHOTOS & FILES
  getPhotos: async (workId: string): Promise<WorkPhoto[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('photos').select('*').eq('workId', workId);
      return (data || []) as WorkPhoto[];
  },
  addPhoto: async (photo: WorkPhoto) => {
      if (!supabase) return;
      await supabase.from('photos').insert([{
          workId: photo.workId,
          url: photo.url,
          description: photo.description,
          date: photo.date,
          type: photo.type
      }]);
  },

  getFiles: async (workId: string): Promise<WorkFile[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('files').select('*').eq('workId', workId);
      return (data || []) as WorkFile[];
  },
  addFile: async (file: WorkFile) => {
      if (!supabase) return;
      await supabase.from('files').insert([{
          workId: file.workId,
          name: file.name,
          category: file.category,
          url: file.url,
          type: file.type,
          date: file.date
      }]);
  },

  // 7. NOTIFICATIONS & DASHBOARD
  getNotifications: async (_userId: string): Promise<Notification[]> => {
      return []; 
  },
  dismissNotification: async (_id: string) => {},
  clearAllNotifications: async (_userId: string) => {},
  generateSmartNotifications: async (_userId: string, _workId: string) => {},

  calculateWorkStats: async (workId: string) => {
      if (!supabase) return { totalSpent: 0, progress: 0, delayedSteps: 0 };
      
      const { data: expenses } = await supabase.from('expenses').select('amount').eq('workId', workId);
      const totalSpent = (expenses || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

      const { data: steps } = await supabase.from('steps').select('status').eq('workId', workId);
      const totalSteps = steps?.length || 0;
      const completed = steps?.filter(s => s.status === 'CONCLUIDO').length || 0;
      const progress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;

      return { totalSpent, progress, delayedSteps: 0 };
  },

  getDailySummary: async (_workId: string) => {
      return { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 };
  },

  generatePix: async (_amount: number, _user: any) => {
      return {
          qr_code_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          copy_paste_code: "00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540410.005802BR5913Maos da Obra6008Sao Paulo62070503***6304E2CA"
      };
  }
};
