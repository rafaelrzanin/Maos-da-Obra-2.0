
import { supabase } from './supabase';
import { User, Work, Step, Material, Worker, Supplier, PlanType, StepStatus, Notification, WorkStatus, Expense, WorkPhoto, WorkFile } from '../types';
import { FULL_MATERIAL_PACKAGES, WORK_TEMPLATES } from './standards';

const STORAGE_KEY = 'maos_db_v1';

const getLocalDb = () => {
    const s = localStorage.getItem(STORAGE_KEY);
    const db = s ? JSON.parse(s) : { users: [], works: [], steps: [], materials: [], expenses: [], workers: [], suppliers: [], notifications: [], photos: [], files: [] };

    // --- AUTO-SEED TEST USER (VITALICIO) ---
    // Cria automaticamente um usuário de teste se não existir
    const testEmail = 'teste@maosdaobra.app';
    if (!db.users.find((u: User) => u.email === testEmail)) {
        const testUser: User = {
            id: 'user_test_vitalicio',
            name: 'Usuário Teste (Vitalício)',
            email: testEmail,
            whatsapp: '11999999999',
            cpf: '000.000.000-00',
            plan: PlanType.VITALICIO,
            subscriptionExpiresAt: '2099-12-31T23:59:59.000Z'
        };
        db.users.push(testUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
    // ---------------------------------------

    return db;
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
      // Case insensitive check
      const user = db.users.find((u: User) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (user) {
          localStorage.setItem('maos_user', JSON.stringify(user));
          return user;
      }
      return null;
  },

  signup: async (name: string, email: string, whatsapp: string, _password?: string, cpf?: string, plan?: string | null): Promise<User | null> => {
      const db = getLocalDb();
      // Check if exists first to avoid duplicates
      const existing = db.users.find((u: User) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (existing) return null;

      const newUser: User = { 
          id: Math.random().toString(36).substr(2, 9), 
          name, 
          email: email.trim(), 
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

  resetPassword: async (email: string): Promise<boolean> => {
      // Simulate API call delay
      await new Promise(r => setTimeout(r, 1500));
      const db = getLocalDb();
      const user = db.users.find((u: User) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
      // In a real app we would send an email here. 
      // For MVP/Local, we return true if user exists to simulate success.
      return !!user;
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

  loginSocial: async (_provider: string) => { 
      // MOCK GOOGLE LOGIN IMPLEMENTATION
      await new Promise(r => setTimeout(r, 1500)); // Simulate network
      
      const db = getLocalDb();
      const mockEmail = "usuario.google@exemplo.com";
      let user = db.users.find((u: User) => u.email === mockEmail);
      
      if (!user) {
          user = {
              id: "google_user_" + Math.random().toString(36).substr(2, 9),
              name: "Usuário Google",
              email: mockEmail,
              whatsapp: "",
              plan: null
          };
          db.users.push(user);
          saveLocalDb(db);
      }
      
      localStorage.setItem('maos_user', JSON.stringify(user));
      return { user, error: null }; 
  },

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

             // INTELIGÊNCIA DE MATERIAIS
             const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
             const stepNorm = normalize(stepName);

             const pkg = FULL_MATERIAL_PACKAGES.find(p => {
                 const pkgNorm = normalize(p.category);
                 if ((stepNorm.includes('limpeza') || stepNorm.includes('entulho') || stepNorm.includes('demolicao')) && !stepNorm.includes('final') && pkgNorm.includes('limpeza')) return true;
                 if (stepNorm.includes('fundacao') && pkgNorm.includes('fundacao')) return true;
                 if ((stepNorm.includes('parede') || stepNorm.includes('alvenaria') || stepNorm.includes('bloco')) && !stepNorm.includes('reboco') && !stepNorm.includes('pintura') && pkgNorm.includes('alvenaria')) return true;
                 if (stepNorm.includes('impermeabiliza') && pkgNorm.includes('impermeabiliza')) return true;
                 if ((stepNorm.includes('reboco') || stepNorm.includes('chapisco')) && pkgNorm.includes('chapisco')) return true;
                 if (stepNorm.includes('contrapiso') && pkgNorm.includes('contrapiso')) return true;
                 if ((stepNorm.includes('gesso') || stepNorm.includes('forro')) && pkgNorm.includes('gesso')) return true;
                 if ((stepNorm.includes('piso') || stepNorm.includes('azulejo') || stepNorm.includes('revestimento')) && !stepNorm.includes('contrapiso') && !stepNorm.includes('protecao') && pkgNorm.includes('pisos')) return true;
                 if ((stepNorm.includes('marmore') || stepNorm.includes('granito') || stepNorm.includes('bancada')) && pkgNorm.includes('marmoraria')) return true;
                 if ((stepNorm.includes('janela') || stepNorm.includes('porta') || stepNorm.includes('vidro') || stepNorm.includes('esquadria')) && pkgNorm.includes('esquadria')) return true;
                 if ((stepNorm.includes('agua') || stepNorm.includes('esgoto') || stepNorm.includes('tubulacao')) && !stepNorm.includes('louca') && pkgNorm.includes('tubulacao')) return true;
                 if ((stepNorm.includes('louca') || stepNorm.includes('metal') || stepNorm.includes('torneira')) && pkgNorm.includes('loucas')) return true;
                 if ((stepNorm.includes('fiacao') || stepNorm.includes('eletrica')) && !stepNorm.includes('luminaria') && pkgNorm.includes('infra')) return true;
                 if ((stepNorm.includes('luminaria') || stepNorm.includes('luz')) && pkgNorm.includes('acabamento')) return true;
                 if (stepNorm.includes('pintura') && pkgNorm.includes('pintura')) return true;
                 if ((stepNorm.includes('entrega') || stepNorm.includes('final')) && pkgNorm.includes('limpeza final')) return true;
                 return false;
             });

             if (pkg) {
                 pkg.items.forEach(item => {
                     const calculatedQty = Math.ceil(newWork.area * (item.multiplier || 0));
                     if (calculatedQty > 0) {
                         db.materials.push({
                            id: Math.random().toString(36).substr(2, 9),
                            workId: newWork.id,
                            name: item.name,
                            brand: '',
                            plannedQty: calculatedQty,
                            purchasedQty: 0,
                            unit: item.unit,
                            category: pkg.category,
                            stepId: newStepId
                         });
                     }
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
  
  addStep: async (step: Step) => {
      const db = getLocalDb();
      db.steps.push(step);
      saveLocalDb(db);
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

  addMaterial: async (material: Material, purchaseDetails?: { qty: number, cost: number, date: string }) => {
      const db = getLocalDb();
      if (purchaseDetails && purchaseDetails.qty > 0) {
          material.purchasedQty = purchaseDetails.qty;
      }
      db.materials.push(material);
      if (purchaseDetails && purchaseDetails.qty > 0) {
          db.expenses.push({
              id: Math.random().toString(36).substr(2, 9),
              workId: material.workId,
              description: `Compra: ${purchaseDetails.qty} ${material.unit} de ${material.name} (${material.brand || 'Novo'})`,
              amount: purchaseDetails.cost,
              date: purchaseDetails.date,
              category: 'Material',
              relatedMaterialId: material.id,
              stepId: material.stepId
          });
      }
      saveLocalDb(db);
  },
  
  addExpense: async (expense: Expense) => {
      const db = getLocalDb();
      db.expenses.push(expense);
      saveLocalDb(db);
  },

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
          db.materials[idx] = {
              ...oldMaterial,
              name: updatedName,
              brand: updatedBrand,
              plannedQty: updatedPlannedQty,
              unit: updatedUnit,
              purchasedQty: oldMaterial.purchasedQty + purchaseQty
          };
          if (purchaseQty > 0) {
              db.expenses.push({
                  id: Math.random().toString(36).substr(2, 9),
                  workId: oldMaterial.workId,
                  description: `Compra: ${purchaseQty} ${updatedUnit} de ${updatedName} (${updatedBrand || 'Genérico'})`,
                  amount: purchaseCost,
                  date: new Date().toISOString(),
                  category: 'Material',
                  relatedMaterialId: materialId,
                  stepId: oldMaterial.stepId
              });
          }
          saveLocalDb(db);
      }
  },

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
        const calculatedQty = Math.ceil(work.area * (item.multiplier || 0));
        if (calculatedQty > 0) {
            db.materials.push({
                id: Math.random().toString(36).substr(2, 9),
                workId,
                name: item.name,
                plannedQty: calculatedQty,
                purchasedQty: 0,
                unit: item.unit,
                category: category,
                stepId: targetStep?.id
            });
            totalImported++;
        }
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
  },

  // --- FOTOS E ARQUIVOS (LOCAL STORAGE MVP) ---
  getPhotos: async (workId: string): Promise<WorkPhoto[]> => {
      const db = getLocalDb();
      return db.photos ? db.photos.filter((p: WorkPhoto) => p.workId === workId) : [];
  },
  addPhoto: async (photo: WorkPhoto) => {
      const db = getLocalDb();
      if(!db.photos) db.photos = [];
      db.photos.push(photo);
      saveLocalDb(db);
  },
  deletePhoto: async (id: string) => {
      const db = getLocalDb();
      if(db.photos) {
          db.photos = db.photos.filter((p: WorkPhoto) => p.id !== id);
          saveLocalDb(db);
      }
  },
  getFiles: async (workId: string): Promise<WorkFile[]> => {
      const db = getLocalDb();
      return db.files ? db.files.filter((f: WorkFile) => f.workId === workId) : [];
  },
  addFile: async (file: WorkFile) => {
      const db = getLocalDb();
      if(!db.files) db.files = [];
      db.files.push(file);
      saveLocalDb(db);
  },
  deleteFile: async (id: string) => {
      const db = getLocalDb();
      if(db.files) {
          db.files = db.files.filter((f: WorkFile) => f.id !== id);
          saveLocalDb(db);
      }
  }
};
