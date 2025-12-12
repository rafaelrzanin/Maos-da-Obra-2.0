
import { 
  User, Work, Step, Material, Expense, Worker, Supplier, 
  WorkPhoto, WorkFile, Notification, PlanType,
  ExpenseCategory
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
    subscriptionExpiresAt: data.subscription_expires_at
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

export const dbService = {
  
  // --- AUTHENTICATION & PROFILE ---

  getCurrentUser: (): User | null => {
    const json = localStorage.getItem('maos_user');
    try { return json ? JSON.parse(json) : null; } catch { return null; }
  },
  
  syncSession: async (): Promise<User | null> => {
    if (!supabase) return dbService.getCurrentUser();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        localStorage.removeItem('maos_user');
        return null;
    }

    const profile = await dbService.getUserProfile(session.user.id);
    if (profile) {
        localStorage.setItem('maos_user', JSON.stringify(profile));
        return profile;
    }
    
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

     const { data, error } = await supabase.auth.signInWithPassword({ email, password });
     if (error) throw error;
     if (!data.user) return null;

     let profile = await dbService.getUserProfile(data.user.id);
     if (!profile) {
         profile = await dbService.createProfileFromAuth(data.user);
     }

     if (profile) localStorage.setItem('maos_user', JSON.stringify(profile));
     return profile;
  },

  signup: async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null): Promise<User | null> => {
      if (!supabase) throw new Error("Supabase não configurado.");
      if (!password) throw new Error("Senha obrigatória.");

      const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, whatsapp, cpf } }
      });

      if (authError) throw authError;
      if (!authData.user) return null;

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
      const updates: any = {};
      if (data.name) updates.name = data.name;
      if (data.whatsapp) updates.whatsapp = data.whatsapp;
      
      if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', userId);
      }
      if (newPassword) {
          await supabase.auth.updateUser({ password: newPassword });
      }
  },

  updatePlan: async (userId: string, plan: PlanType) => {
      if (!supabase) return;
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

  // --- WORKS (OBRAS) ---
  
  getWorks: async (userId: string): Promise<Work[]> => {
      if (!supabase) return [];
      // Usa user_id (snake_case)
      const { data, error } = await supabase.from('works').select('*').eq('user_id', userId);
      if (error) {
          console.error("Erro ao buscar obras:", error);
          return [];
      }
      return (data || []).map(parseWorkFromDB);
  },

  getWorkById: async (workId: string): Promise<Work | null> => {
      if (!supabase) return null;
      const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
      if (error || !data) return null;
      return parseWorkFromDB(data);
  },

  createWork: async (work: Omit<Work, 'id'>, templateId?: string): Promise<Work> => {
      if (!supabase) throw new Error("Offline");
      
      const payload = {
          user_id: work.userId,
          name: work.name,
          address: work.address,
          budget_planned: work.budgetPlanned,
          start_date: work.startDate,
          end_date: work.endDate,
          area: work.area,
          status: work.status || 'Planejamento',
          notes: work.notes,
          floors: work.floors,
          bedrooms: work.bedrooms,
          bathrooms: work.bathrooms,
          kitchens: work.kitchens,
          living_rooms: work.livingRooms,
          has_leisure_area: work.hasLeisureArea
      };

      // 1. Criar Obra
      const { data, error } = await supabase.from('works').insert([payload]).select().single();

      if (error || !data) {
          console.error("Supabase Create Work Error:", error);
          throw new Error(error?.message || "Erro ao criar obra.");
      }
      
      const newWork = parseWorkFromDB(data);

      if (templateId) {
          const template = WORK_TEMPLATES.find(t => t.id === templateId);
          
          if (template) {
              // 2. Gerar Cronograma (Etapas)
              const stepsPayload = template.includedSteps.map(stepName => ({
                  work_id: newWork.id,
                  name: stepName,
                  start_date: newWork.startDate,
                  end_date: newWork.endDate,
                  status: 'NAO_INICIADO',
                  is_delayed: false
              }));
              const { data: createdSteps } = await supabase.from('steps').insert(stepsPayload).select();

              // 3. Gerar Lista de Materiais Inteligente
              // Filtra quais categorias de materiais adicionar baseado no template
              let categoriesToInclude: string[] = [];

              if (templateId === 'CONSTRUCAO') {
                  // Inclui TUDO
                  categoriesToInclude = FULL_MATERIAL_PACKAGES.map(c => c.category);
              } else if (templateId === 'REFORMA_APTO') {
                  // Remove fundação e telhado
                  categoriesToInclude = FULL_MATERIAL_PACKAGES
                      .map(c => c.category)
                      .filter(c => !c.includes('Fundação') && !c.includes('Telhado'));
              } else if (templateId === 'BANHEIRO') {
                  categoriesToInclude = ['Instalações Hidráulicas (Tubulação)', 'Pisos e Revestimentos Cerâmicos', 'Louças e Metais (Acabamento Hidro)', 'Marmoraria e Granitos', 'Limpeza Final'];
              } else if (templateId === 'COZINHA') {
                  categoriesToInclude = ['Instalações Hidráulicas (Tubulação)', 'Instalações Elétricas (Infra)', 'Pisos e Revestimentos Cerâmicos', 'Marmoraria e Granitos', 'Louças e Metais (Acabamento Hidro)', 'Limpeza Final'];
              } else if (templateId === 'PINTURA') {
                  categoriesToInclude = ['Pintura', 'Limpeza Final'];
              }

              const materialsPayload: any[] = [];
              const area = work.area || 10; // Fallback seguro se area for 0

              // Mapeia steps criados para tentar vincular materiais (heurística simples)
              // Ex: Material 'Cimento' -> Tenta achar etapa 'Estrutura' ou 'Alvenaria'
              const findStepId = (categoryName: string) => {
                  if (!createdSteps) return null;
                  // Tenta achar uma etapa que contenha parte do nome da categoria
                  const match = createdSteps.find((s: any) => 
                      categoryName.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]) ||
                      s.name.toLowerCase().includes(categoryName.toLowerCase().split(' ')[0])
                  );
                  return match ? match.id : null;
              };

              for (const pkg of FULL_MATERIAL_PACKAGES) {
                  if (categoriesToInclude.includes(pkg.category)) {
                      const stepId = findStepId(pkg.category);
                      
                      for (const item of pkg.items) {
                          // Calcula quantidade: Multiplicador * Área da Obra
                          const qty = Math.ceil((item.multiplier || 1) * area);
                          
                          materialsPayload.push({
                              work_id: newWork.id,
                              name: item.name,
                              brand: '', // Marca em branco para preencher depois
                              planned_qty: qty,
                              purchased_qty: 0,
                              unit: item.unit,
                              step_id: stepId // Vincula à etapa se possível
                          });
                      }
                  }
              }

              if (materialsPayload.length > 0) {
                  await supabase.from('materials').insert(materialsPayload);
              }
          }
      }
      return newWork;
  },

  deleteWork: async (workId: string) => {
      if (!supabase) return;
      await supabase.from('works').delete().eq('id', workId);
  },

  // --- STEPS ---
  getSteps: async (workId: string): Promise<Step[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('steps').select('*').eq('work_id', workId);
      return (data || []).map(parseStepFromDB);
  },

  addStep: async (step: Step) => {
      if (!supabase) return;
      await supabase.from('steps').insert([{
          work_id: step.workId,
          name: step.name,
          start_date: step.startDate,
          end_date: step.endDate,
          status: step.status
      }]);
  },

  updateStep: async (step: Step) => {
      if (!supabase) return;
      await supabase.from('steps').update({
          name: step.name,
          start_date: step.startDate,
          end_date: step.endDate,
          status: step.status
      }).eq('id', step.id);
  },

  // --- MATERIALS ---
  getMaterials: async (workId: string): Promise<Material[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('materials').select('*').eq('work_id', workId);
      return (data || []).map(parseMaterialFromDB);
  },

  addMaterial: async (material: Material, purchaseData?: { qty: number, cost: number, date: string }) => {
      if (!supabase) return;
      
      const { data: matData } = await supabase.from('materials').insert([{
          work_id: material.workId,
          name: material.name,
          brand: material.brand,
          planned_qty: material.plannedQty,
          purchased_qty: purchaseData ? purchaseData.qty : 0,
          unit: material.unit,
          step_id: material.stepId
      }]).select().single();

      if (purchaseData && matData) {
          await dbService.addExpense({
              id: '', 
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
          planned_qty: material.plannedQty,
          unit: material.unit
      }).eq('id', material.id);
  },

  registerMaterialPurchase: async (matId: string, name: string, brand: string, plannedQty: number, unit: string, buyQty: number, cost: number) => {
      if (!supabase) return;
      
      const { data: current } = await supabase.from('materials').select('purchased_qty, work_id, step_id').eq('id', matId).single();
      if (!current) return;

      const newPurchasedQty = (Number(current.purchased_qty) || 0) + buyQty;
      
      await supabase.from('materials').update({ 
          purchased_qty: newPurchasedQty,
          name: name,
          brand: brand,
          planned_qty: plannedQty,
          unit: unit
      }).eq('id', matId);

      await dbService.addExpense({
          id: '',
          workId: current.work_id,
          description: `Compra: ${name}`,
          amount: cost,
          date: new Date().toISOString(),
          category: ExpenseCategory.MATERIAL,
          relatedMaterialId: matId,
          stepId: current.step_id
      });
  },

  // --- EXPENSES ---
  getExpenses: async (workId: string): Promise<Expense[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('expenses').select('*').eq('work_id', workId);
      return (data || []).map(parseExpenseFromDB);
  },

  addExpense: async (expense: Expense) => {
      if (!supabase) return;
      await supabase.from('expenses').insert([{
          work_id: expense.workId,
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
          step_id: expense.stepId,
          related_material_id: expense.relatedMaterialId,
          total_agreed: expense.totalAgreed
      }]);
  },

  updateExpense: async (expense: Expense) => {
      if (!supabase) return;
      await supabase.from('expenses').update({
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
          step_id: expense.stepId,
          total_agreed: expense.totalAgreed
      }).eq('id', expense.id);
  },

  deleteExpense: async (id: string) => {
      if (!supabase) return;
      await supabase.from('expenses').delete().eq('id', id);
  },

  // --- WORKERS & SUPPLIERS ---
  getWorkers: async (userId: string): Promise<Worker[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('workers').select('*').eq('user_id', userId);
      return (data || []).map(parseWorkerFromDB);
  },
  addWorker: async (worker: Omit<Worker, 'id'>) => {
      if (!supabase) return;
      await supabase.from('workers').insert([{
          user_id: worker.userId,
          name: worker.name,
          role: worker.role,
          phone: worker.phone,
          notes: worker.notes
      }]);
  },
  updateWorker: async (worker: Worker) => {
      if (!supabase) return;
      await supabase.from('workers').update({
          name: worker.name, 
          role: worker.role, 
          phone: worker.phone, 
          notes: worker.notes
      }).eq('id', worker.id);
  },
  deleteWorker: async (id: string) => {
      if (supabase) await supabase.from('workers').delete().eq('id', id);
  },

  getSuppliers: async (userId: string): Promise<Supplier[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('suppliers').select('*').eq('user_id', userId);
      return (data || []).map(parseSupplierFromDB);
  },
  addSupplier: async (supplier: Omit<Supplier, 'id'>) => {
      if (!supabase) return;
      await supabase.from('suppliers').insert([{
          user_id: supplier.userId,
          name: supplier.name,
          category: supplier.category,
          phone: supplier.phone,
          notes: supplier.notes
      }]);
  },
  updateSupplier: async (supplier: Supplier) => {
      if (!supabase) return;
      await supabase.from('suppliers').update({
          name: supplier.name, 
          category: supplier.category, 
          phone: supplier.phone, 
          notes: supplier.notes
      }).eq('id', supplier.id);
  },
  deleteSupplier: async (id: string) => {
      if (supabase) await supabase.from('suppliers').delete().eq('id', id);
  },

  // --- PHOTOS & FILES ---
  getPhotos: async (workId: string): Promise<WorkPhoto[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('photos').select('*').eq('work_id', workId);
      return (data || []).map(parsePhotoFromDB);
  },
  addPhoto: async (photo: WorkPhoto) => {
      if (!supabase) return;
      await supabase.from('photos').insert([{
          work_id: photo.workId,
          url: photo.url,
          description: photo.description,
          date: photo.date,
          type: photo.type
      }]);
  },

  getFiles: async (workId: string): Promise<WorkFile[]> => {
      if (!supabase) return [];
      const { data } = await supabase.from('files').select('*').eq('work_id', workId);
      return (data || []).map(parseFileFromDB);
  },
  addFile: async (file: WorkFile) => {
      if (!supabase) return;
      await supabase.from('files').insert([{
          work_id: file.workId,
          name: file.name,
          category: file.category,
          url: file.url,
          type: file.type,
          date: file.date
      }]);
  },

  // --- STATS ---
  getNotifications: async (_userId: string): Promise<Notification[]> => { return []; },
  dismissNotification: async (_id: string) => {},
  clearAllNotifications: a (_userId: string) => {},
  generateSmartNotifications: async (_userId: string, _workId: string) => {},

  calculateWorkStats: async (workId: string) => {
      if (!supabase) return { totalSpent: 0, progress: 0, delayedSteps: 0 };
      
      const { data: expenses } = await supabase.from('expenses').select('amount').eq('work_id', workId);
      const totalSpent = (expenses || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

      const { data: steps } = await supabase.from('steps').select('status').eq('work_id', workId);
      const totalSteps = steps?.length || 0;
      const completed = steps?.filter((s: any) => s.status === 'CONCLUIDO').length || 0;
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
