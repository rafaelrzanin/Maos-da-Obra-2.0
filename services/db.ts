import { 
  User, Work, Step, Expense, Material, WorkPhoto, WorkFile,
  PlanType, WorkStatus, StepStatus, Notification,
  Supplier, Worker, ExpenseCategory
} from '../types';
import { FULL_MATERIAL_PACKAGES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES } from './standards';
import { supabase } from './supabase';

// --- LOCAL STORAGE FALLBACK CONSTANTS ---
const DB_KEY = 'maos_db_v1';
const SESSION_KEY = 'maos_session_v1';
const NOTIFICATION_CHECK_KEY = 'maos_last_notif_check';

// --- HELPER: GET LOCAL YYYY-MM-DD STRING ---
const getLocalTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- TYPES FOR LOCAL MOCK ---
interface DbSchema {
  users: User[];
  works: Work[];
  steps: Step[];
  expenses: Expense[];
  materials: Material[];
  photos: WorkPhoto[];
  files: WorkFile[]; 
  notifications: Notification[];
  suppliers: Supplier[];
  workers: Worker[];
}

const initialDb: DbSchema = {
  users: [
    { id: '1', name: 'Usuário Demo', email: 'demo@maos.com', whatsapp: '(11) 99999-9999', plan: PlanType.VITALICIO, subscriptionExpiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() }
  ],
  works: [],
  steps: [],
  expenses: [],
  materials: [],
  photos: [],
  files: [], 
  notifications: [],
  suppliers: [],
  workers: []
};

// --- LOCAL STORAGE HELPERS (SYNC) ---
const getLocalDb = (): DbSchema => {
  const stored = localStorage.getItem(DB_KEY);
  if (!stored) {
    localStorage.setItem(DB_KEY, JSON.stringify(initialDb));
    return initialDb;
  }
  const db = JSON.parse(stored);
  if (!db.files) db.files = [];
  if (!db.photos) db.photos = [];
  if (!db.suppliers) db.suppliers = [];
  if (!db.workers) db.workers = [];
  return db;
};

const saveLocalDb = (db: DbSchema) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

// --- HELPER: FILE UPLOAD ---
const uploadToBucket = async (file: File, path: string): Promise<string | null> => {
    if (!supabase) return null;
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('work_assets')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('work_assets').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) {
        console.error("Upload Error:", error);
        return null;
    }
}

// --- HELPER: SYNC SUPABASE USER (INTERNAL) ---
const syncSupabaseUser = async (): Promise<User | null> => {
    if (!supabase) return null;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
        let { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        if (!profile) {
             // Fallback profile creation if not exists (should be handled by signup usually)
             const { data: newProfile, error } = await supabase.from('profiles').insert({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Usuário',
                plan: null,
                subscription_expires_at: null
             }).select().single();
             
             if (newProfile) profile = newProfile;
             else if (error) console.error("Error creating profile:", error);
        }

        if (profile) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
            return profile as User;
        }
    }
    return null;
};

// --- INTERNAL HELPERS (Avoid Circular Dependency) ---
const insertExpenseInternal = async (expense: Omit<Expense, 'id'>) => {
    const safeAmount = Number(expense.amount) || 0;
    const safePaid = Number(expense.paidAmount) || 0;
    const safeQty = Number(expense.quantity) || 1;

    if (supabase) {
        await supabase.from('expenses').insert({
            work_id: expense.workId,
            description: expense.description,
            amount: safeAmount,
            paid_amount: safePaid,
            quantity: safeQty,
            category: expense.category,
            date: expense.date,
            step_id: expense.stepId,
            worker_id: expense.workerId,
            related_material_id: expense.relatedMaterialId
        });
    } else {
        const db = getLocalDb();
        db.expenses.push({ 
            ...expense, 
            amount: safeAmount,
            paidAmount: safePaid,
            quantity: safeQty,
            id: Math.random().toString(36).substr(2, 9) 
        });
        saveLocalDb(db);
    }
};

const getStepsInternal = async (workId: string): Promise<Step[]> => {
    const todayStr = getLocalTodayString();
    
    if (supabase) {
        const { data } = await supabase.from('steps').select('*').eq('work_id', workId);
        return (data || []).map(s => {
             const isDelayed = (s.status !== StepStatus.COMPLETED) && (todayStr > s.end_date);
             return {
                 ...s,
                 workId: s.work_id,
                 startDate: s.start_date,
                 endDate: s.end_date,
                 isDelayed
             };
        });
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.steps.filter(s => s.workId === workId).map(s => {
            const isDelayed = (s.status !== StepStatus.COMPLETED) && (todayStr > s.endDate);
            return { ...s, isDelayed };
        }));
    }
};

const getExpensesInternal = async (workId: string): Promise<Expense[]> => {
    if (supabase) {
        const { data } = await supabase.from('expenses').select('*').eq('work_id', workId);
        return (data || []).map(e => ({
            ...e,
            workId: e.work_id,
            paidAmount: Number(e.paid_amount) || 0,
            amount: Number(e.amount) || 0,
            stepId: e.step_id,
            workerId: e.worker_id,
            relatedMaterialId: e.related_material_id
        }));
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.expenses.filter(e => e.workId === workId).map(e => ({
            ...e,
            amount: Number(e.amount) || 0,
            paidAmount: Number(e.paidAmount) || 0
        })));
    }
};

interface PlanItem {
  stepName: string;
  duration: number;
  startOffset: number;
  materials: {
      name: string;
      unit: string;
      qty: number;
  }[];
}

interface ConstructionDetails {
    bedrooms?: number;
    bathrooms?: number;
    kitchens?: number;
    livingRooms?: number;
    hasLeisureArea?: boolean;
}

// --- ENGINE: SMART PLAN GENERATOR ---
const generateSmartPlan = (_templateId: string, _totalArea: number, _floors: number, _details?: ConstructionDetails): PlanItem[] => {
    // Simplified Mock Implementation for MVP to avoid unused var errors
    // In production, this would use the arguments to generate a specific plan
    const plan: PlanItem[] = [];
    plan.push({ stepName: "Início", duration: 1, startOffset: 0, materials: [] });
    return plan; 
};

// --- SERVICE LAYER ---

export const dbService = {
  
  isSubscriptionActive: (user: User): boolean => {
      if (!user.plan) return false;
      if (user.plan === PlanType.VITALICIO) return true;
      if (!user.subscriptionExpiresAt) return false;
      
      const today = new Date();
      const expires = new Date(user.subscriptionExpiresAt);
      return expires.getTime() > today.getTime();
  },

  loginSocial: async (provider: 'google'): Promise<{ error: any }> => {
      if (supabase) {
          const { error } = await supabase.auth.signInWithOAuth({
              provider: provider,
              options: {
                  redirectTo: window.location.origin
              }
          });
          return { error };
      } else {
          return { error: { message: "Supabase não configurado." } };
      }
  },

  syncSession: async (): Promise<User | null> => {
      return await syncSupabaseUser();
  },

  onAuthChange: (callback: (user: User | null) => void) => {
      if (!supabase) return () => {};
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              const user = await syncSupabaseUser();
              callback(user);
          } else if (event === 'SIGNED_OUT') {
              localStorage.removeItem(SESSION_KEY);
              callback(null);
          }
      });
      return () => subscription.unsubscribe();
  },

  login: async (email: string, password?: string): Promise<User | null> => {
    if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: password || '' 
        });
        if (error) { console.error("Login Error:", error); return null; }
        if (data.user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
            if (profile) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
                return profile as User;
            }
        }
        return null;
    } else {
        return new Promise((resolve) => {
            setTimeout(() => {
                const db = getLocalDb();
                const user = db.users.find(u => u.email === email);
                if (user) {
                    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
                    resolve(user);
                } else {
                    resolve(null);
                }
            }, 500); 
        });
    }
  },
  
  signup: async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null): Promise<User | null> => {
    if (supabase) {
        // 1. Create Auth User
        const { data, error } = await supabase.auth.signUp({
            email,
            password: password || '',
            options: { data: { name, whatsapp } }
        });
        
        if (error || !data.user) { 
            console.error("Signup Error", error); 
            return null; 
        }
        
        await new Promise(r => setTimeout(r, 1000));
        
        // 2. Update Profile with Extra Fields (CPF, Plan, etc)
        // Note: The trigger usually creates the profile on insert, so we UPDATE here
        await supabase.from('profiles').update({ 
            name: name,
            whatsapp: whatsapp,
            cpf: cpf,
            plan_type: planType, // Saving the plan intent (e.g. 'mensal')
            // Don't set subscription_expires_at yet if they haven't paid, OR set to null explicitly
            subscription_expires_at: null 
        }).eq('id', data.user.id);

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (profile) localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        return profile as User;

    } else {
        return new Promise((resolve) => {
            const db = getLocalDb();
            const newUser: User = {
                id: Math.random().toString(36).substr(2, 9),
                name,
                email,
                whatsapp,
                cpf,
                plan: planType as PlanType || null,
                subscriptionExpiresAt: undefined
            };
            db.users.push(newUser);
            saveLocalDb(db);
            localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
            resolve(newUser);
        });
    }
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  updateUser: async (userId: string, data: { name?: string, whatsapp?: string }, newPassword?: string): Promise<User | null> => {
      if (supabase) {
          const { data: profile, error } = await supabase.from('profiles')
              .update(data)
              .eq('id', userId)
              .select()
              .single();
          if (error) throw error;
          if (newPassword) {
              const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
              if (pwdError) throw pwdError;
          }
          if (profile) {
              localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
              return profile as User;
          }
      } else {
          const db = getLocalDb();
          const userIdx = db.users.findIndex(u => u.id === userId);
          if (userIdx > -1) {
              if (data.name) db.users[userIdx].name = data.name;
              if (data.whatsapp) db.users[userIdx].whatsapp = data.whatsapp;
              saveLocalDb(db);
              localStorage.setItem(SESSION_KEY, JSON.stringify(db.users[userIdx]));
              return db.users[userIdx];
          }
      }
      return null;
  },

  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
  },

  updatePlan: async (userId: string, plan: PlanType) => {
     const baseDate = new Date();
     if (plan === PlanType.MENSAL) baseDate.setDate(baseDate.getDate() + 30);
     if (plan === PlanType.SEMESTRAL) baseDate.setDate(baseDate.getDate() + 180);
     if (plan === PlanType.VITALICIO) baseDate.setFullYear(baseDate.getFullYear() + 99); 

     if (supabase) {
        await supabase.from('profiles').update({ 
            plan, 
            subscription_expires_at: baseDate.toISOString() 
        }).eq('id', userId);
     } else {
        const db = getLocalDb();
        const userIdx = db.users.findIndex(u => u.id === userId);
        if (userIdx > -1) {
            db.users[userIdx].plan = plan;
            db.users[userIdx].subscriptionExpiresAt = baseDate.toISOString();
            saveLocalDb(db); 
            localStorage.setItem(SESSION_KEY, JSON.stringify(db.users[userIdx]));
        }
     }
  },

  getWorks: async (userId: string): Promise<Work[]> => {
    if (supabase) {
        const { data } = await supabase.from('works').select('*').eq('user_id', userId);
        return (data || []).map(w => ({
            ...w,
            userId: w.user_id,
            budgetPlanned: w.budget_planned,
            startDate: w.start_date,
            endDate: w.end_date,
            floors: w.floors || 1
        }));
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.works.filter(w => w.userId === userId));
    }
  },

  getWorkById: async (workId: string): Promise<Work | undefined> => {
    if (supabase) {
        const { data } = await supabase.from('works').select('*').eq('id', workId).single();
        if (!data) return undefined;
        return {
            ...data,
            userId: data.user_id,
            budgetPlanned: data.budget_planned,
            startDate: data.start_date,
            endDate: data.end_date,
            floors: data.floors || 1
        };
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.works.find(w => w.id === workId));
    }
  },

  createWork: async (work: Omit<Work, 'id' | 'status'>, templateId: string): Promise<Work> => {
    const db = getLocalDb();
    const created: Work = { ...work, id: Math.random().toString(36).substr(2, 9), status: WorkStatus.PLANNING, floors: work.floors || 1 };
    db.works.push(created);
    saveLocalDb(db);
    
    // Generate simple steps based on template (Mock)
    const steps = generateSmartPlan(templateId, work.area, work.floors || 1);
    steps.forEach(s => {
        db.steps.push({
            id: Math.random().toString(36).substr(2, 9),
            workId: created.id,
            name: s.stepName,
            startDate: work.startDate,
            endDate: work.endDate,
            status: StepStatus.NOT_STARTED,
            isDelayed: false
        });
    });
    saveLocalDb(db);
    
    return created;
  },

  deleteWork: async (workId: string) => {
      const db = getLocalDb();
      db.works = db.works.filter(w => w.id !== workId);
      db.steps = db.steps.filter(s => s.workId !== workId);
      db.expenses = db.expenses.filter(e => e.workId !== workId);
      db.materials = db.materials.filter(m => m.workId !== workId);
      saveLocalDb(db);
  },

  getSteps: getStepsInternal,
  
  updateStep: async (step: Step) => {
      const db = getLocalDb();
      const idx = db.steps.findIndex(s => s.id === step.id);
      if (idx > -1) {
          db.steps[idx] = step;
          saveLocalDb(db);
      }
  },
  
  addStep: async (step: Omit<Step, 'id' | 'isDelayed'>) => {
      const db = getLocalDb();
      db.steps.push({ ...step, id: Math.random().toString(36).substr(2, 9), isDelayed: false });
      saveLocalDb(db);
  },
  
  deleteStep: async (stepId: string) => {
      const db = getLocalDb();
      db.steps = db.steps.filter(s => s.id !== stepId);
      saveLocalDb(db);
  },
  
  getExpenses: getExpensesInternal,
  
  addExpense: async (expense: Omit<Expense, 'id'>) => { await insertExpenseInternal(expense); },
  
  updateExpense: async (expense: Expense) => {
      const db = getLocalDb();
      const idx = db.expenses.findIndex(e => e.id === expense.id);
      if (idx > -1) {
          db.expenses[idx] = expense;
          saveLocalDb(db);
      }
  },
  
  deleteExpense: async (id: string) => {
      const db = getLocalDb();
      db.expenses = db.expenses.filter(e => e.id !== id);
      saveLocalDb(db);
  },
  
  getMaterials: async (workId: string) => { const db = getLocalDb(); return Promise.resolve(db.materials.filter(m => m.workId === workId)); },
  
  addMaterial: async (material: Omit<Material, 'id'>) => {
      const db = getLocalDb();
      db.materials.push({ ...material, id: Math.random().toString(36).substr(2, 9) });
      saveLocalDb(db);
  },
  
  updateMaterial: async (material: Material, cost?: number, addedQty?: number) => {
      const db = getLocalDb();
      const idx = db.materials.findIndex(m => m.id === material.id);
      if (idx > -1) {
          db.materials[idx] = material;
          saveLocalDb(db);
      }
      
      if (cost && cost > 0) {
          await insertExpenseInternal({
              workId: material.workId,
              description: `Compra: ${material.name}`,
              amount: cost,
              paidAmount: cost,
              quantity: addedQty || 1,
              category: ExpenseCategory.MATERIAL,
              date: new Date().toISOString().split('T')[0],
              relatedMaterialId: material.id
          });
      }
  },
  
  deleteMaterial: async (id: string) => {
      const db = getLocalDb();
      db.materials = db.materials.filter(m => m.id !== id);
      saveLocalDb(db);
  },
  
  importMaterialPackage: async (workId: string, category: string) => {
      const db = getLocalDb();
      const pkg = FULL_MATERIAL_PACKAGES.find(p => p.category === category);
      let count = 0;
      if (pkg) {
          pkg.items.forEach(item => {
              db.materials.push({
                  id: Math.random().toString(36).substr(2, 9),
                  workId,
                  name: item.name,
                  unit: item.unit,
                  plannedQty: 0,
                  purchasedQty: 0,
                  category: category
              });
              count++;
          });
          saveLocalDb(db);
      }
      return count;
  },

  getNotifications: async (userId: string): Promise<Notification[]> => { const db = getLocalDb(); return Promise.resolve(db.notifications.filter(n => n.userId === userId)); },
  dismissNotification: async (id: string) => { const db = getLocalDb(); db.notifications = db.notifications.filter(n => n.id !== id); saveLocalDb(db); },
  clearAllNotifications: async (userId: string) => { const db = getLocalDb(); db.notifications = db.notifications.filter(n => n.userId !== userId); saveLocalDb(db); },
  
  generateSmartNotifications: async (userId: string, _workId: string) => { 
      const db = getLocalDb();
      const today = getLocalTodayString();
      const user = db.users.find(u => u.id === userId);
      const lastCheckKey = `${NOTIFICATION_CHECK_KEY}_${userId}`;
      const lastCheck = localStorage.getItem(lastCheckKey);

      if (lastCheck === today) return; 

      if (user && user.subscriptionExpiresAt) {
          const expires = new Date(user.subscriptionExpiresAt);
          const now = new Date();
          const diffTime = expires.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 0 && diffDays <= 5) {
              db.notifications.push({
                  id: Math.random().toString(36).substr(2, 9),
                  userId,
                  title: 'Renovação Necessária',
                  message: `Sua assinatura expira em ${diffDays} dias.`,
                  type: 'WARNING',
                  read: false,
                  date: new Date().toISOString()
              });
          }
      }
      saveLocalDb(db);
      localStorage.setItem(lastCheckKey, today);
  },
  
  getDailySummary: async (workId: string) => { 
      const steps = await getStepsInternal(workId);
      const materials = await dbService.getMaterials(workId);
      const completed = steps.filter(s => s.status === StepStatus.COMPLETED).length;
      const delayed = steps.filter(s => s.isDelayed).length;
      const pendingMaterials = materials.filter(m => m.purchasedQty < m.plannedQty).length;
      return { completedSteps: completed, delayedSteps: delayed, pendingMaterials, totalSteps: steps.length };
  },
  
  calculateWorkStats: async (workId: string) => { 
      const expenses = await getExpensesInternal(workId);
      const steps = await getStepsInternal(workId);
      const totalSpent = expenses.reduce((acc, curr) => acc + (Number(curr.paidAmount) || 0), 0);
      const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
      return { totalSpent, progress: steps.length === 0 ? 0 : Math.round((completedSteps / steps.length) * 100), delayedSteps: steps.filter(s => s.isDelayed).length }; 
  },

  getSuppliers: async (userId: string) => {
      const db = getLocalDb();
      return db.suppliers.filter(s => s.userId === userId);
  },
  addSupplier: async (supplier: Omit<Supplier, 'id'>) => {
      const db = getLocalDb();
      db.suppliers.push({ ...supplier, id: Math.random().toString(36).substr(2, 9) });
      saveLocalDb(db);
  },
  updateSupplier: async (supplier: Supplier) => {
      const db = getLocalDb();
      const idx = db.suppliers.findIndex(s => s.id === supplier.id);
      if (idx > -1) {
          db.suppliers[idx] = supplier;
          saveLocalDb(db);
      }
  },
  deleteSupplier: async (id: string) => {
      const db = getLocalDb();
      db.suppliers = db.suppliers.filter(s => s.id !== id);
      saveLocalDb(db);
  },

  getWorkers: async (userId: string) => {
      const db = getLocalDb();
      return db.workers.filter(w => w.userId === userId);
  },
  addWorker: async (worker: Omit<Worker, 'id'>) => {
      const db = getLocalDb();
      db.workers.push({ ...worker, id: Math.random().toString(36).substr(2, 9) });
      saveLocalDb(db);
  },
  updateWorker: async (worker: Worker) => {
      const db = getLocalDb();
      const idx = db.workers.findIndex(w => w.id === worker.id);
      if (idx > -1) {
          db.workers[idx] = worker;
          saveLocalDb(db);
      }
  },
  deleteWorker: async (id: string) => {
      const db = getLocalDb();
      db.workers = db.workers.filter(w => w.id !== id);
      saveLocalDb(db);
  },

  getJobRoles: async () => STANDARD_JOB_ROLES,
  getSupplierCategories: async () => STANDARD_SUPPLIER_CATEGORIES,

  getPhotos: async (workId: string) => {
      const db = getLocalDb();
      return db.photos.filter(p => p.workId === workId);
  },
  uploadPhoto: async (workId: string, file: File, type: 'BEFORE' | 'AFTER' | 'PROGRESS') => {
      const db = getLocalDb();
      if (supabase) {
          const url = await uploadToBucket(file, `${workId}/photos`);
          if (url) {
              const newPhoto = { id: Math.random().toString(36).substr(2,9), workId, url, description: file.name, date: new Date().toISOString(), type };
              // Since we don't have a real supabase table for photos in this mock, we save locally ref
              db.photos.push(newPhoto);
              saveLocalDb(db);
              return url;
          }
      }
      return new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
             if (e.target?.result) {
                 const url = e.target.result as string;
                 db.photos.push({
                     id: Math.random().toString(36).substr(2, 9),
                     workId,
                     url,
                     description: file.name,
                     date: new Date().toISOString(),
                     type
                 });
                 saveLocalDb(db);
                 resolve(url);
             } else resolve(null);
          };
          reader.readAsDataURL(file);
      });
  },
  deletePhoto: async (id: string) => {
      const db = getLocalDb();
      db.photos = db.photos.filter(p => p.id !== id);
      saveLocalDb(db);
  },

  getFiles: async (workId: string) => {
      const db = getLocalDb();
      return db.files.filter(f => f.workId === workId);
  },
  uploadFile: async (workId: string, file: File, category: string) => {
      const db = getLocalDb();
      if (supabase) {
          const url = await uploadToBucket(file, `${workId}/files`);
          if (url) {
              const newFile = {
                     id: Math.random().toString(36).substr(2, 9),
                     workId,
                     name: file.name,
                     category: category as any,
                     url,
                     type: file.type,
                     date: new Date().toISOString()
              };
              db.files.push(newFile);
              saveLocalDb(db);
              return url;
          }
      }
      return new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
             if (e.target?.result) {
                 const url = e.target.result as string;
                 db.files.push({
                     id: Math.random().toString(36).substr(2, 9),
                     workId,
                     name: file.name,
                     category: category as any,
                     url,
                     type: file.type,
                     date: new Date().toISOString()
                 });
                 saveLocalDb(db);
                 resolve(url);
             } else resolve(null);
          };
          reader.readAsDataURL(file);
      });
  },
  deleteFile: async (id: string) => {
      const db = getLocalDb();
      db.files = db.files.filter(f => f.id !== id);
      saveLocalDb(db);
  }
};
