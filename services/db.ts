import { supabase } from './supabase';
import { User, Work, Step, Material, Worker, Supplier, PlanType, StepStatus, Notification, WorkStatus } from '../types';
import { FULL_MATERIAL_PACKAGES, WORK_TEMPLATES } from './standards';

const STORAGE_KEY = 'maos_db_v1';

const getLocalDb = () => {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : { users: [], works: [], steps: [], materials: [], expenses: [], workers: [], suppliers: [], notifications: [] };
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
          // Logic to sync session if needed
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
          ...workData as Work,
          id: Math.random().toString(36).substr(2, 9),
          status: WorkStatus.PLANNING
      };
      db.works.push(newWork);
      
      const template = WORK_TEMPLATES.find(t => t.id === templateId);
      if (template) {
         template.includedSteps.forEach((stepName, _idx) => {
             db.steps.push({
                 id: Math.random().toString(36).substr(2, 9),
                 workId: newWork.id,
                 name: stepName,
                 startDate: newWork.startDate,
                 endDate: newWork.endDate,
                 status: StepStatus.NOT_STARTED,
                 isDelayed: false
             });
         });
      }
      
      saveLocalDb(db);
      return newWork;
  },

  deleteWork: async (workId: string) => {
      const db = getLocalDb();
      db.works = db.works.filter((w: Work) => w.id !== workId);
      saveLocalDb(db);
  },

  calculateWorkStats: async (_workId: string) => {
      return { totalSpent: 0, progress: 0, delayedSteps: 0 };
  },

  getDailySummary: async (_workId: string) => {
      return { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 };
  },

  getNotifications: async (_userId: string): Promise<Notification[]> => {
      return [];
  },

  dismissNotification: async (_id: string) => {},
  clearAllNotifications: async (_userId: string) => {},
  generateSmartNotifications: async (_userId: string, _workId: string) => {},

  getSteps: async (workId: string): Promise<Step[]> => {
      const db = getLocalDb();
      return db.steps.filter((s: Step) => s.workId === workId);
  },

  getMaterials: async (workId: string): Promise<Material[]> => {
      const db = getLocalDb();
      return db.materials.filter((m: Material) => m.workId === workId);
  },

  updateMaterial: async (material: Material, cost: number, _addedQty: number) => {
      const db = getLocalDb();
      const idx = db.materials.findIndex((m: Material) => m.id === material.id);
      if (idx >= 0) {
          db.materials[idx] = material;
          if (cost > 0) {
              db.expenses.push({
                  id: Math.random().toString(36).substr(2, 9),
                  workId: material.workId,
                  description: `Compra: ${material.name}`,
                  amount: cost,
                  date: new Date().toISOString(),
                  category: 'Material',
                  relatedMaterialId: material.id
              });
          }
          saveLocalDb(db);
      }
  },

  importMaterialPackage: async (workId: string, category: string): Promise<number> => {
    const work = await dbService.getWorkById(workId);
    if (!work) return 0;
    
    let targetCategories: string[] = [];
    
    if (category === 'ALL_PENDING') {
        const steps = await dbService.getSteps(workId);
        const pendingSteps = steps.filter(s => s.status !== StepStatus.COMPLETED);
        
        pendingSteps.forEach(step => {
            const foundPackage = FULL_MATERIAL_PACKAGES.find(pkg => {
                const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return normalize(step.name).includes(normalize(pkg.category)) || 
                       normalize(pkg.category).includes(normalize(step.name));
            });
            if (foundPackage) {
                targetCategories.push(foundPackage.category);
            }
        });
        
        targetCategories = [...new Set(targetCategories)];
    } else {
        targetCategories = [category];
    }

    let totalImported = 0;

    for (const cat of targetCategories) {
        const pkg = FULL_MATERIAL_PACKAGES.find(p => p.category === cat);
        if (!pkg) continue;

        if (supabase) {
            const items = pkg.items.map(item => ({
                work_id: workId,
                name: item.name,
                planned_qty: Math.ceil(work.area * (item.multiplier || 0)),
                purchased_qty: 0,
                unit: item.unit,
                category: cat
            }));
            
            await supabase.from('materials').insert(items);
            totalImported += items.length;
        } else {
            const db = getLocalDb();
            pkg.items.forEach(item => {
                db.materials.push({
                    id: Math.random().toString(36).substr(2, 9),
                    workId,
                    name: item.name,
                    plannedQty: Math.ceil(work.area * (item.multiplier || 0)),
                    purchasedQty: 0,
                    unit: item.unit,
                    category: cat
                });
            });
            saveLocalDb(db);
            totalImported += pkg.items.length;
        }
    }

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
