import { supabase } from './supabase';
import { User, Work, Step, Material, Worker, Supplier, PlanType, StepStatus, Notification, WorkStatus, Expense, WorkPhoto, WorkFile } from '../types';
import { FULL_MATERIAL_PACKAGES, WORK_TEMPLATES } from './standards';

const STORAGE_KEY = 'maos_db_v1';

const getLocalDb = () => {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : { users: [], works: [], steps: [], materials: [], expenses: [], workers: [], suppliers: [], notifications: [], photos: [], files: [] };
};

const saveLocalDb = (data: any) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

export const dbService = {
  getCurrentUser: (): User | null => {
      const u = localStorage.getItem('maos_user');
      return u ? JSON.parse(u) : null;
  },
  
  isSubscriptionActive: (user: User): boolean => {
      if (!user.subscriptionExpiresAt && user.plan === PlanType.VITALICIO) return true;
      if (!user.subscriptionExpiresAt) return false;
      return new Date(user.subscriptionExpiresAt) > new Date();
  },

  syncSession: async () => {
      if (supabase) {
          const { data: { session: _session } } = await supabase.auth.getSession();
      }
      return dbService.getCurrentUser();
  },

  onAuthChange: (_callback: (user: User | null) => void) => {
      if (supabase) {
          const { data } = supabase.auth.onAuthStateChange((_event, _session) => {
              // handle session
          });
          return () => data.subscription.unsubscribe();
      }
      return () => {};
  },

  login: async (email: string, _password?: string): Promise<User | null> => {
      const db = getLocalDb();
      const user = db.users.find((u: User) => u.email === email);
      if (user) {
          localStorage.setItem('maos_user', JSON.stringify(user));
          return user;
      }
      return null;
  },

  signup: async (name: string, email: string, whatsapp: string, _password?: string, cpf?: string, plan?: string | null): Promise<User | null> => {
      const db = getLocalDb();
      const newUser: User = { 
          id: Math.random().toString(36).substr(2, 9), 
          name, 
          email, 
          whatsapp, 
          cpf, 
          plan: plan as PlanType || null,
          subscriptionExpiresAt: plan === PlanType.VITALICIO ? '2099-12-31' : undefined
      };
      db.users.push(newUser);
      saveLocalDb(db);
      localStorage.setItem('maos_user', JSON.stringify(newUser));
      return newUser;
  },

  logout: () => {
      if (supabase) supabase.auth.signOut();
      localStorage.removeItem('maos_user');
  },

  updatePlan: async (userId: string, plan: PlanType) => {
      const db = getLocalDb();
      const userIdx = db.users.findIndex((u: User) => u.id === userId);
      if (userIdx >= 0) {
          db.users[userIdx].plan = plan;
          const now = new Date();
          if (plan === PlanType.MENSAL) now.setMonth(now.getMonth() + 1);
          if (plan === PlanType.SEMESTRAL) now.setMonth(now.getMonth() + 6);
          if (plan === PlanType.VITALICIO) now.setFullYear(2099);
          db.users[userIdx].subscriptionExpiresAt = now.toISOString();
          
          saveLocalDb(db);
          const currentUser = dbService.getCurrentUser();
          if (currentUser && currentUser.id === userId) {
              localStorage.setItem('maos_user', JSON.stringify(db.users[userIdx]));
          }
      }
  },

  loginSocial: async (_provider: string) => { return { error: null }; },

  getWorks: async (userId: string): Promise<Work[]> => {
      const db = getLocalDb();
      return db.works.filter((w: Work) => w.userId === userId);
  },

  getWorkById: async (workId: string): Promise<Work | null> => {
      const db = getLocalDb();
      return db.works.find((w: Work) => w.id === workId) || null;
  },

  createWork: async (workData: Partial<Work>, templateId: string): Promise<Work> => {
      const db = getLocalDb();
      const newWork: Work = {
          id: Math.random().toString(36).substr(2, 9),
          userId: workData.userId!,
          name: workData.name || 'Nova Obra',
          address: workData.address || '',
          budgetPlanned: workData.budgetPlanned || 0,
          startDate: workData.startDate || new Date().toISOString().split('T')[0],
          endDate: workData.endDate || new Date().toISOString().split('T')[0],
          area: workData.area || 0,
          floors: workData.floors,
          bedrooms: workData.bedrooms,
          bathrooms: workData.bathrooms,
          kitchens: workData.kitchens,
          livingRooms: workData.livingRooms,
          hasLeisureArea: workData.hasLeisureArea,
          notes: workData.notes || '',
          status: WorkStatus.PLANNING
      };
      
      db.works.push(newWork);
      
      const template = WORK_TEMPLATES.find(t => t.id === templateId);
      
      if (template && template.includedSteps) {
         const totalDuration = template.defaultDurationDays || 90;
         const stepDuration = Math.max(2, Math.floor(totalDuration / template.includedSteps.length));
         
         template.includedSteps.forEach((stepName, idx) => {
             const startDate = new Date(newWork.startDate);
             startDate.setDate(startDate.getDate() + (idx * stepDuration)); 
             const endDate = new Date(startDate);
             endDate.setDate(endDate.getDate() + stepDuration);

             const newStepId = Math.random().toString(36).substr(2, 9);

             // Criar Etapa
             db.steps.push({
                 id: newStepId,
                 workId: newWork.id,
                 name: stepName,
                 startDate: startDate.toISOString().split('T')[0],
                 endDate: endDate.toISOString().split('T')[0],
                 status: StepStatus.NOT_STARTED,
                 isDelayed: false
             });

             // INTELIGÊNCIA DE MATERIAIS - CORRELAÇÃO MAIS FORTE
             const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
             const stepNorm = normalize(stepName);

             // Mapeamento direto de palavras-chave da etapa para categorias de material
             // Isso garante que se a etapa é "Fundações", pegamos os materiais de "Fundação"
             const pkg = FULL_MATERIAL_PACKAGES.find(p => {
                 const pkgNorm = normalize(p.category);
                 
                 // Lógica de "Contém" bidirecional + casos específicos
                 if (stepNorm.includes(pkgNorm)) return true; // Ex: Step "Fundações" inclui Pkg "Fundação"
                 if (pkgNorm.includes(stepNorm)) return true;
                 
                 // Casos especiais
                 if (stepNorm.includes('parede') && pkgNorm.includes('alvenaria')) return true;
                 if (stepNorm.includes('laje') && pkgNorm.includes('alvenaria')) return true; // Ferro/Cimento
                 if (stepNorm.includes('agua') && pkgNorm.includes('hidraulica')) return true;
                 if (stepNorm.includes('fiacao') && pkgNorm.includes('eletrica')) return true;
                 if (stepNorm.includes('piso') && pkgNorm.includes('acabamento')) return true;
                 if (stepNorm.includes('azulejo') && pkgNorm.includes('acabamento')) return true;
                 if (stepNorm.includes('pintura') && pkgNorm.includes('pintura')) return true;

                 return false;
             });

             if (pkg) {
                 pkg.items.forEach(item => {
                     db.materials.push({
                        id: Math.random().toString(36).substr(2, 9),
                        workId: newWork.id,
                        name: item.name,
                        brand: '', // Brand start empty
                        plannedQty: Math.ceil(newWork.area * (item.multiplier || 0)),
                        purchasedQty: 0,
                        unit: item.unit,
                        category: pkg.category,
                        stepId: newStepId // VÍNCULO DIRETO COM A ETAPA
                     });
                 });
             }
         });
      } else {
          const stepId = Math.random().toString(36).substr(2, 9);
          db.steps.push({
             id: stepId,
             workId: newWork.id,
             name: 'Início da Obra',
             startDate: newWork.startDate,
             endDate: newWork.endDate,
             status: StepStatus.NOT_STARTED,
             isDelayed: false
          });
      }
      
      saveLocalDb(db);
      return newWork;
  },

  deleteWork: async (workId: string) => {
      const db = getLocalDb();
      db.works = db.works.filter((w: Work) => w.id !== workId);
      db.steps = db.steps.filter((s: Step) => s.workId !== workId);
      db.materials = db.materials.filter((m: Material) => m.workId !== workId);
      db.expenses = db.expenses.filter((e: Expense) => e.workId !== workId);
      if (db.photos) db.photos = db.photos.filter((p: WorkPhoto) => p.workId !== workId);
      if (db.files) db.files = db.files.filter((f: WorkFile) => f.workId !== workId);
      saveLocalDb(db);
  },

  calculateWorkStats: async (workId: string) => {
      const db = getLocalDb();
      const expenses = db.expenses.filter((e: Expense) => e.workId === workId);
      const steps = db.steps.filter((s: Step) => s.workId === workId);
      const totalSpent = expenses.reduce((acc: number, curr: Expense) => acc + Number(curr.amount), 0);
      const completedSteps = steps.filter((s: Step) => s.status === StepStatus.COMPLETED).length;
      const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
      const today = new Date().toISOString().split('T')[0];
      const delayedSteps = steps.filter((s: Step) => s.status !== StepStatus.COMPLETED && s.endDate < today).length;
      return { totalSpent, progress, delayedSteps };
  },

  getDailySummary: async (workId: string) => {
      const db = getLocalDb();
      const steps = db.steps.filter((s: Step) => s.workId === workId);
      const materials = db.materials.filter((m: Material) => m.workId === workId);
      const today = new Date().toISOString().split('T')[0];
      const completedSteps = steps.filter((s: Step) => s.status === StepStatus.COMPLETED).length;
      const delayedSteps = steps.filter((s: Step) => s.status !== StepStatus.COMPLETED && s.endDate < today).length;
      const pendingMaterials = materials.filter((m: Material) => m.purchasedQty < m.plannedQty).length;
      return { completedSteps, delayedSteps, pendingMaterials, totalSteps: steps.length };
  },

  getNotifications: async (_userId: string): Promise<Notification[]> => { return []; },
  dismissNotification: async (_id: string) => {},
  clearAllNotifications: async (_userId: string) => {},
  generateSmartNotifications: async (_userId: string, _workId: string) => {},

  getSteps: async (workId: string): Promise<Step[]> => {
      const db = getLocalDb();
      return db.steps.filter((s: Step) => s.workId === workId);
  },
  updateStep: async (step: Step) => {
      const db = getLocalDb();
      const idx = db.steps.findIndex((s: Step) => s.id === step.id);
      if (idx >= 0) { db.steps[idx] = step; saveLocalDb(db); }
  },
  deleteStep: async (id: string) => {
      const db = getLocalDb();
      db.steps = db.steps.filter((s: Step) => s.id !== id);
      saveLocalDb(db);
  },

  getExpenses: async (workId: string): Promise<Expense[]> => {
      const db = getLocalDb();
      return db.expenses.filter((e: Expense) => e.workId === workId).sort((a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getMaterials: async (workId: string): Promise<Material[]> => {
      const db = getLocalDb();
      return db.materials.filter((m: Material) => m.workId === workId);
  },

  // --- ADD MANUAL MATERIAL (Com Vínculo de Etapa) ---
  addMaterial: async (material: Material) => {
      const db = getLocalDb();
      db.materials.push(material);
      saveLocalDb(db);
  },
  
  // --- ADD MANUAL EXPENSE (Com Vínculo de Etapa) ---
  addExpense: async (expense: Expense) => {
      const db = getLocalDb();
      db.expenses.push(expense);
      saveLocalDb(db);
  },

  // FUNÇÃO CRÍTICA: ATUALIZA MATERIAL E GERA GASTO
  // Atualizada para suportar Brand (Marca)
  registerMaterialPurchase: async (
      materialId: string, 
      updatedName: string, 
      updatedBrand: string,
      updatedPlannedQty: number,
      updatedUnit: string,
      purchaseQty: number, 
      purchaseCost: number
  ) => {
      const db = getLocalDb();
      const idx = db.materials.findIndex((m: Material) => m.id === materialId);
      
      if (idx >= 0) {
          const oldMaterial = db.materials[idx];
          
          // 1. Atualizar dados do material (Nome, Marca, Planejado, Unidade) e incrementar comprado
          db.materials[idx] = {
              ...oldMaterial,
              name: updatedName,
              brand: updatedBrand,
              plannedQty: updatedPlannedQty,
              unit: updatedUnit,
              purchasedQty: oldMaterial.purchasedQty + purchaseQty
          };

          // 2. Se houve compra (qty > 0), gerar gasto no financeiro vinculado à etapa
          if (purchaseQty > 0) {
              db.expenses.push({
                  id: Math.random().toString(36).substr(2, 9),
                  workId: oldMaterial.workId,
                  description: `Compra: ${purchaseQty} ${updatedUnit} de ${updatedName} (${updatedBrand || 'Genérico'})`,
                  amount: purchaseCost,
                  date: new Date().toISOString(),
                  category: 'Material',
                  relatedMaterialId: materialId,
                  stepId: oldMaterial.stepId // Vincula à mesma etapa do material
              });
          }

          saveLocalDb(db);
      }
  },

  // Mantido para compatibilidade
  updateMaterial: async (material: Material, _cost: number, _addedQty: number) => {
      const db = getLocalDb();
      const idx = db.materials.findIndex((m: Material) => m.id === material.id);
      if (idx >= 0) {
          db.materials[idx] = material;
          saveLocalDb(db);
      }
  },

  importMaterialPackage: async (workId: string, category: string): Promise<number> => {
    const work = await dbService.getWorkById(workId);
    if (!work) return 0;
    
    const steps = await dbService.getSteps(workId);
    const targetStep = steps.find(s => s.status !== StepStatus.COMPLETED) || steps[0];

    const pkg = FULL_MATERIAL_PACKAGES.find(p => p.category === category);
    if (!pkg) return 0;

    let totalImported = 0;
    const db = getLocalDb();
    
    pkg.items.forEach(item => {
        db.materials.push({
            id: Math.random().toString(36).substr(2, 9),
            workId,
            name: item.name,
            plannedQty: Math.ceil(work.area * (item.multiplier || 0)),
            purchasedQty: 0,
            unit: item.unit,
            category: category,
            stepId: targetStep?.id
        });
        totalImported++;
    });
    
    saveLocalDb(db);
    return totalImported;
  },

  getWorkers: async (userId: string): Promise<Worker[]> => {
      const db = getLocalDb();
      return db.workers.filter((w: Worker) => w.userId === userId);
  },
  addWorker: async (worker: any) => {
      const db = getLocalDb();
      db.workers.push({ ...worker, id: Math.random().toString(36).substr(2, 9) });
      saveLocalDb(db);
  },
  updateWorker: async (worker: Worker) => {
      const db = getLocalDb();
      const idx = db.workers.findIndex((w: Worker) => w.id === worker.id);
      if (idx >= 0) { db.workers[idx] = worker; saveLocalDb(db); }
  },
  deleteWorker: async (id: string) => {
      const db = getLocalDb();
      db.workers = db.workers.filter((w: Worker) => w.id !== id);
      saveLocalDb(db);
  },

  getSuppliers: async (userId: string): Promise<Supplier[]> => {
      const db = getLocalDb();
      return db.suppliers.filter((s: Supplier) => s.userId === userId);
  },
  addSupplier: async (supplier: any) => {
      const db = getLocalDb();
      db.suppliers.push({ ...supplier, id: Math.random().toString(36).substr(2, 9) });
      saveLocalDb(db);
  },
  updateSupplier: async (supplier: Supplier) => {
      const db = getLocalDb();
      const idx = db.suppliers.findIndex((s: Supplier) => s.id === supplier.id);
      if (idx >= 0) { db.suppliers[idx] = supplier; saveLocalDb(db); }
  },
  deleteSupplier: async (id: string) => {
      const db = getLocalDb();
      db.suppliers = db.suppliers.filter((s: Supplier) => s.id !== id);
      saveLocalDb(db);
  },

  getJobRoles: async () => ['Pedreiro', 'Servente', 'Mestre de Obras'],
  getSupplierCategories: async () => ['Material de Construção', 'Elétrica', 'Hidráulica'],

  updateUser: async (id: string, data: any, _password?: string) => {
      const db = getLocalDb();
      const idx = db.users.findIndex((u: User) => u.id === id);
      if (idx >= 0) {
          db.users[idx] = { ...db.users[idx], ...data };
          saveLocalDb(db);
          localStorage.setItem('maos_user', JSON.stringify(db.users[idx]));
      }
  },
  getUserProfile: async (_id: string) => dbService.getCurrentUser(),

  generatePix: async (_amount: number, _payer: any) => {
      return { qr_code_base64: '', copy_paste_code: '000201010212...' };
  }
};
