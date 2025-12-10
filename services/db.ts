import { 
  User, Work, Step, Expense, Material, WorkPhoto, WorkFile,
  PlanType, WorkStatus, StepStatus, Notification,
  Supplier, Worker, ExpenseCategory
} from '../types';
import { FULL_MATERIAL_PACKAGES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, WORK_TEMPLATES } from './standards';
import { supabase } from './supabase';

// --- LOCAL STORAGE FALLBACK CONSTANTS ---
const DB_KEY = 'maos_db_v1';
const SESSION_KEY = 'maos_session_v1';

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
  try {
    const db = JSON.parse(stored);
    if (!db.files) db.files = [];
    if (!db.photos) db.photos = [];
    if (!db.suppliers) db.suppliers = [];
    if (!db.workers) db.workers = [];
    if (!db.notifications) db.notifications = [];
    return db;
  } catch (e) {
    return initialDb;
  }
};

const saveLocalDb = (db: DbSchema) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

// --- HELPER: SYNC SUPABASE USER (INTERNAL) ---
const syncSupabaseUser = async (): Promise<User | null> => {
    if (!supabase) return null;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        if (!profile && !error) {
             const { data: newProfile } = await supabase.from('profiles').insert({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Usuário',
                plan: null,
                subscription_expires_at: null
             }).select().single();
             
             if (newProfile) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(newProfile));
                return newProfile as User;
             }
        }

        if (profile) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
            return profile as User;
        }
    }
    return null;
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
        const db = getLocalDb();
        const user = db.users.find(u => u.email === email);
        if (user) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(user));
            return user;
        }
        return null;
    }
  },
  
  signup: async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null): Promise<User | null> => {
    if (supabase) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password: password || '',
            options: { data: { name, whatsapp } }
        });
        
        if (error || !data.user) return null;
        
        await supabase.from('profiles').update({ 
            name: name,
            whatsapp: whatsapp,
            cpf: cpf,
            plan_type: planType, 
            subscription_expires_at: null 
        }).eq('id', data.user.id);

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (profile) localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        return profile as User;

    } else {
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
        return newUser;
    }
  },

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
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

  getUserProfile: async (userId: string) => {
      if (supabase) {
          const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
          return data;
      }
      const db = getLocalDb();
      return db.users.find(u => u.id === userId);
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
            floors: data.floors || 1,
            livingRooms: data.living_rooms,
            hasLeisureArea: data.has_leisure_area
        };
    } else {
        const db = getLocalDb();
        return db.works.find(w => w.id === workId);
    }
  },

  getWorks: async (userId: string): Promise<Work[]> => {
    if (supabase) {
        const { data } = await supabase.from('works').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        return (data || []).map(w => ({
            ...w,
            userId: w.user_id,
            budgetPlanned: w.budget_planned,
            startDate: w.start_date,
            endDate: w.end_date,
            floors: w.floors || 1,
            livingRooms: w.living_rooms,
            hasLeisureArea: w.has_leisure_area
        }));
    } else {
        const db = getLocalDb();
        return db.works.filter(w => w.userId === userId);
    }
  },

  calculateWorkStats: async (workId: string) => {
    if (supabase) {
        const { data: expenses } = await supabase.from('expenses').select('amount').eq('work_id', workId);
        const totalSpent = (expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0);

        const { data: steps } = await supabase.from('steps').select('status, end_date').eq('work_id', workId);
        const totalSteps = steps?.length || 0;
        const completed = steps?.filter((s: any) => s.status === StepStatus.COMPLETED).length || 0;
        const progress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
        
        const today = getLocalTodayString();
        const delayedSteps = steps?.filter((s: any) => s.status !== StepStatus.COMPLETED && s.end_date < today).length || 0;
        
        return { totalSpent, progress, delayedSteps };
    }
    const db = getLocalDb();
    const workExpenses = db.expenses.filter(e => e.workId === workId);
    const totalSpent = workExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    
    const workSteps = db.steps.filter(s => s.workId === workId);
    const completed = workSteps.filter(s => s.status === StepStatus.COMPLETED).length;
    const progress = workSteps.length > 0 ? Math.round((completed / workSteps.length) * 100) : 0;
    
    const today = getLocalTodayString();
    const delayedSteps = workSteps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < today).length;

    return { totalSpent, progress, delayedSteps };
  },

  getDailySummary: async (workId: string) => {
    if (supabase) {
        const today = getLocalTodayString();
        const { data: steps } = await supabase.from('steps').select('status, end_date').eq('work_id', workId);
        const delayedSteps = steps?.filter((s: any) => s.status !== StepStatus.COMPLETED && s.end_date < today).length || 0;
        const completedSteps = steps?.filter((s: any) => s.status === StepStatus.COMPLETED).length || 0;

        const { data: materials } = await supabase.from('materials').select('purchased_qty, planned_qty').eq('work_id', workId);
        const pendingMaterials = materials?.filter((m: any) => m.purchased_qty < m.planned_qty).length || 0;

        return { completedSteps, delayedSteps, pendingMaterials, totalSteps: steps?.length || 0 };
    }
    const db = getLocalDb();
    const today = getLocalTodayString();
    const steps = db.steps.filter(s => s.workId === workId);
    const delayedSteps = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < today).length;
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const pendingMaterials = db.materials.filter(m => m.workId === workId && m.purchasedQty < m.plannedQty).length;
    
    return { completedSteps, delayedSteps, pendingMaterials, totalSteps: steps.length };
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    const db = getLocalDb();
    return db.notifications.filter(n => n.userId === userId && !n.read).sort((a,b) => b.date.localeCompare(a.date));
  },

  dismissNotification: async (notificationId: string) => {
    const db = getLocalDb();
    const idx = db.notifications.findIndex(n => n.id === notificationId);
    if (idx > -1) {
        db.notifications[idx].read = true;
        saveLocalDb(db);
    }
  },

  clearAllNotifications: async (userId: string) => {
    const db = getLocalDb();
    db.notifications = db.notifications.map(n => n.userId === userId ? { ...n, read: true } : n);
    saveLocalDb(db);
  },

  generateSmartNotifications: async (userId: string, workId: string) => {
    const db = getLocalDb();
    const today = getLocalTodayString();
    const steps = db.steps.filter(s => s.workId === workId);
    const delayed = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < today);
    
    delayed.forEach(s => {
        const title = "Etapa Atrasada";
        const message = `A etapa "${s.name}" expirou em ${s.endDate}.`;
        if (!db.notifications.find(n => n.userId === userId && n.title === title && n.message === message)) {
            db.notifications.push({
                id: Math.random().toString(36).substr(2, 9),
                userId,
                title,
                message,
                date: new Date().toISOString(),
                read: false,
                type: 'WARNING'
            });
        }
    });
    saveLocalDb(db);
  },

  getSteps: async (workId: string): Promise<Step[]> => {
    if (supabase) {
        const { data } = await supabase.from('steps').select('*').eq('work_id', workId);
        const today = getLocalTodayString();
        return (data || []).map((s: any) => ({
            id: s.id,
            workId: s.work_id,
            name: s.name,
            startDate: s.start_date,
            endDate: s.end_date,
            realDate: s.real_date,
            status: s.status,
            isDelayed: s.status !== StepStatus.COMPLETED && s.end_date < today
        }));
    }
    const db = getLocalDb();
    const today = getLocalTodayString();
    return db.steps.filter(s => s.workId === workId).map(s => ({
        ...s,
        isDelayed: s.status !== StepStatus.COMPLETED && s.endDate < today
    }));
  },

  deleteWork: async (workId: string) => {
    if (supabase) {
        await supabase.from('works').delete().eq('id', workId);
        // Supabase configured with CASCADE delete usually handles children, 
        // but explicit delete is safer if cascades aren't set
        await supabase.from('steps').delete().eq('work_id', workId);
        await supabase.from('materials').delete().eq('work_id', workId);
        await supabase.from('expenses').delete().eq('work_id', workId);
    } else {
        const db = getLocalDb();
        db.works = db.works.filter(w => w.id !== workId);
        db.steps = db.steps.filter(s => s.workId !== workId);
        db.expenses = db.expenses.filter(e => e.workId !== workId);
        db.materials = db.materials.filter(m => m.workId !== workId);
        db.photos = db.photos.filter(p => p.workId !== workId);
        db.files = db.files.filter(f => f.workId !== workId);
        saveLocalDb(db);
    }
  },

  createWork: async (workData: Partial<Work>, templateId: string): Promise<Work> => {
    if (supabase) {
        const { data, error } = await supabase.from('works').insert({
            user_id: workData.userId,
            name: workData.name,
            address: workData.address,
            budget_planned: workData.budgetPlanned,
            start_date: workData.startDate,
            end_date: workData.endDate,
            area: workData.area,
            floors: workData.floors,
            bedrooms: workData.bedrooms,
            bathrooms: workData.bathrooms,
            kitchens: workData.kitchens,
            living_rooms: workData.livingRooms,
            has_leisure_area: workData.hasLeisureArea,
            notes: workData.notes,
            status: WorkStatus.PLANNING
        }).select().single();

        if (error || !data) throw new Error("Erro ao criar obra no Supabase: " + (error?.message || 'Unknown'));

        const newWork = {
            ...data,
            userId: data.user_id,
            budgetPlanned: data.budget_planned,
            startDate: data.start_date,
            endDate: data.end_date,
            floors: data.floors || 1,
            livingRooms: data.living_rooms,
            hasLeisureArea: data.has_leisure_area
        };

        // Template Logic for Supabase
        const template = WORK_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            let currentStart = new Date(newWork.startDate);
            const stepsPayload = template.includedSteps.map(stepName => {
                const end = new Date(currentStart);
                end.setDate(end.getDate() + 7);
                const step = {
                    work_id: newWork.id,
                    name: stepName,
                    start_date: currentStart.toISOString().split('T')[0],
                    end_date: end.toISOString().split('T')[0],
                    status: StepStatus.NOT_STARTED
                };
                currentStart = new Date(end);
                return step;
            });

            if (stepsPayload.length > 0) {
                await supabase.from('steps').insert(stepsPayload);
            }

            // Materials logic
            const materialsPayload: any[] = [];
            FULL_MATERIAL_PACKAGES.forEach(pkg => {
                pkg.items.slice(0, 3).forEach(item => {
                    materialsPayload.push({
                        work_id: newWork.id,
                        name: item.name,
                        planned_qty: 10,
                        purchased_qty: 0,
                        unit: item.unit,
                        category: pkg.category
                    });
                });
            });

            if (materialsPayload.length > 0) {
                await supabase.from('materials').insert(materialsPayload);
            }
        }

        return newWork;
    }

    // LOCAL IMPLEMENTATION
    const db = getLocalDb();
    const id = Math.random().toString(36).substr(2, 9);
    const newWork: Work = {
        id,
        status: WorkStatus.PLANNING,
        userId: workData.userId!,
        name: workData.name!,
        address: workData.address!,
        budgetPlanned: workData.budgetPlanned!,
        startDate: workData.startDate!,
        endDate: workData.endDate!,
        area: workData.area!,
        floors: workData.floors || 1,
        bedrooms: workData.bedrooms,
        bathrooms: workData.bathrooms,
        kitchens: workData.kitchens,
        livingRooms: workData.livingRooms,
        hasLeisureArea: workData.hasLeisureArea,
        notes: workData.notes || ''
    };
    
    db.works.push(newWork);

    // Initial steps based on template
    const template = WORK_TEMPLATES.find(t => t.id === templateId);
    if (template) {
        let currentStart = new Date(newWork.startDate);
        template.includedSteps.forEach(stepName => {
            const end = new Date(currentStart);
            end.setDate(end.getDate() + 7); // Default step duration
            db.steps.push({
                id: Math.random().toString(36).substr(2, 9),
                workId: id,
                name: stepName,
                startDate: currentStart.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                status: StepStatus.NOT_STARTED,
                isDelayed: false
            });
            currentStart = new Date(end);
        });
        
        // Initial materials
        FULL_MATERIAL_PACKAGES.forEach(pkg => {
            pkg.items.slice(0, 3).forEach(item => { // Limit initial materials
                db.materials.push({
                    id: Math.random().toString(36).substr(2, 9),
                    workId: id,
                    name: item.name,
                    plannedQty: 10,
                    purchasedQty: 0,
                    unit: item.unit,
                    category: pkg.category
                });
            });
        });
    }

    saveLocalDb(db);
    return newWork;
  },

  getWorkers: async (userId: string): Promise<Worker[]> => {
    const db = getLocalDb();
    return db.workers.filter(w => w.userId === userId);
  },

  getJobRoles: async (): Promise<string[]> => {
    return STANDARD_JOB_ROLES;
  },

  getSuppliers: async (userId: string): Promise<Supplier[]> => {
    const db = getLocalDb();
    return db.suppliers.filter(s => s.userId === userId);
  },

  getSupplierCategories: async (): Promise<string[]> => {
    return STANDARD_SUPPLIER_CATEGORIES;
  },

  addWorker: async (data: Partial<Worker>): Promise<Worker> => {
    const db = getLocalDb();
    const newWorker: Worker = {
        id: Math.random().toString(36).substr(2, 9),
        userId: data.userId!,
        name: data.name!,
        role: data.role!,
        phone: data.phone!,
        notes: data.notes
    };
    db.workers.push(newWorker);
    saveLocalDb(db);
    return newWorker;
  },

  updateWorker: async (data: Worker): Promise<Worker> => {
    const db = getLocalDb();
    const idx = db.workers.findIndex(w => w.id === data.id);
    if (idx > -1) {
        db.workers[idx] = data;
        saveLocalDb(db);
    }
    return data;
  },

  deleteWorker: async (id: string) => {
    const db = getLocalDb();
    db.workers = db.workers.filter(w => w.id !== id);
    saveLocalDb(db);
  },

  addSupplier: async (data: Partial<Supplier>): Promise<Supplier> => {
    const db = getLocalDb();
    const newSupplier: Supplier = {
        id: Math.random().toString(36).substr(2, 9),
        userId: data.userId!,
        name: data.name!,
        category: data.category!,
        phone: data.phone!,
        notes: data.notes
    };
    db.suppliers.push(newSupplier);
    saveLocalDb(db);
    return newSupplier;
  },

  updateSupplier: async (data: Supplier): Promise<Supplier> => {
    const db = getLocalDb();
    const idx = db.suppliers.findIndex(s => s.id === data.id);
    if (idx > -1) {
        db.suppliers[idx] = data;
        saveLocalDb(db);
    }
    return data;
  },

  deleteSupplier: async (id: string) => {
    const db = getLocalDb();
    db.suppliers = db.suppliers.filter(s => s.id !== id);
    saveLocalDb(db);
  },

  getPhotos: async (workId: string): Promise<WorkPhoto[]> => {
    if (supabase) {
        const { data } = await supabase.from('work_photos').select('*').eq('work_id', workId);
        return (data || []).map((p: any) => ({
            ...p,
            workId: p.work_id
        }));
    }
    const db = getLocalDb();
    return db.photos.filter(p => p.workId === workId);
  },

  uploadPhoto: async (workId: string, file: File, _type: string) => {
    const db = getLocalDb();
    // In local mode, store as data URL
    const reader = new FileReader();
    reader.onloadend = () => {
        db.photos.push({
            id: Math.random().toString(36).substr(2, 9),
            workId,
            url: reader.result as string,
            description: file.name,
            date: new Date().toISOString(),
            type: 'PROGRESS'
        });
        saveLocalDb(db);
    };
    reader.readAsDataURL(file);
  },

  deletePhoto: async (id: string) => {
    if (supabase) {
        await supabase.from('work_photos').delete().eq('id', id);
    } else {
        const db = getLocalDb();
        db.photos = db.photos.filter(p => p.id !== id);
        saveLocalDb(db);
    }
  },

  getFiles: async (workId: string): Promise<WorkFile[]> => {
    if (supabase) {
        const { data } = await supabase.from('work_files').select('*').eq('work_id', workId);
        return (data || []).map((f: any) => ({
            ...f,
            workId: f.work_id
        }));
    }
    const db = getLocalDb();
    return db.files.filter(f => f.workId === workId);
  },

  uploadFile: async (workId: string, file: File, category: string) => {
    const db = getLocalDb();
    const reader = new FileReader();
    reader.onloadend = () => {
        db.files.push({
            id: Math.random().toString(36).substr(2, 9),
            workId,
            name: file.name,
            category: category as any,
            url: reader.result as string,
            type: file.type,
            date: new Date().toISOString()
        });
        saveLocalDb(db);
    };
    reader.readAsDataURL(file);
  },

  deleteFile: async (id: string) => {
    if (supabase) {
        await supabase.from('work_files').delete().eq('id', id);
    } else {
        const db = getLocalDb();
        db.files = db.files.filter(f => f.id !== id);
        saveLocalDb(db);
    }
  },

  getExpenses: async (workId: string): Promise<Expense[]> => {
    if (supabase) {
        const { data } = await supabase.from('expenses').select('*').eq('work_id', workId).order('date', {ascending: false});
        return (data || []).map((e: any) => ({
            id: e.id,
            workId: e.work_id,
            description: e.description,
            amount: e.amount,
            paidAmount: e.paid_amount,
            category: e.category,
            date: e.date,
            stepId: e.step_id,
            quantity: e.quantity
        }));
    }
    const db = getLocalDb();
    return db.expenses.filter(e => e.workId === workId);
  },

  addExpense: async (data: Partial<Expense>): Promise<Expense> => {
    if (supabase) {
        const { data: expense } = await supabase.from('expenses').insert({
            work_id: data.workId,
            description: data.description,
            amount: data.amount,
            paid_amount: data.paidAmount || 0,
            category: data.category,
            date: data.date,
            step_id: data.stepId,
            quantity: data.quantity
        }).select().single();
        return {
            ...expense,
            workId: expense.work_id,
            paidAmount: expense.paid_amount,
            stepId: expense.step_id
        } as Expense;
    }
    const db = getLocalDb();
    const newExpense: Expense = {
        id: Math.random().toString(36).substr(2, 9),
        workId: data.workId!,
        description: data.description!,
        amount: data.amount!,
        paidAmount: data.paidAmount || 0,
        category: data.category!,
        date: data.date!,
        stepId: data.stepId,
        quantity: data.quantity
    };
    db.expenses.push(newExpense);
    saveLocalDb(db);
    return newExpense;
  },

  updateExpense: async (data: Expense): Promise<Expense> => {
    if (supabase) {
        await supabase.from('expenses').update({
            description: data.description,
            amount: data.amount,
            paid_amount: data.paidAmount,
            category: data.category,
            date: data.date,
            step_id: data.stepId
        }).eq('id', data.id);
        return data;
    }
    const db = getLocalDb();
    const idx = db.expenses.findIndex(e => e.id === data.id);
    if (idx > -1) {
        db.expenses[idx] = data;
        saveLocalDb(db);
    }
    return data;
  },

  deleteExpense: async (id: string) => {
    if (supabase) {
        await supabase.from('expenses').delete().eq('id', id);
    } else {
        const db = getLocalDb();
        db.expenses = db.expenses.filter(e => e.id !== id);
        saveLocalDb(db);
    }
  },

  getMaterials: async (workId: string): Promise<Material[]> => {
    if (supabase) {
        const { data } = await supabase.from('materials').select('*').eq('work_id', workId);
        return (data || []).map((m: any) => ({
            id: m.id,
            workId: m.work_id,
            name: m.name,
            plannedQty: m.planned_qty,
            purchasedQty: m.purchased_qty,
            unit: m.unit,
            category: m.category
        }));
    }
    const db = getLocalDb();
    return db.materials.filter(m => m.workId === workId);
  },

  addMaterial: async (data: Partial<Material>): Promise<Material> => {
    if (supabase) {
        const { data: mat } = await supabase.from('materials').insert({
            work_id: data.workId,
            name: data.name,
            planned_qty: data.plannedQty,
            purchased_qty: data.purchasedQty || 0,
            unit: data.unit,
            category: data.category
        }).select().single();
        return {
            ...mat,
            workId: mat.work_id,
            plannedQty: mat.planned_qty,
            purchasedQty: mat.purchased_qty
        } as Material;
    }
    const db = getLocalDb();
    const newMat: Material = {
        id: Math.random().toString(36).substr(2, 9),
        workId: data.workId!,
        name: data.name!,
        plannedQty: data.plannedQty!,
        purchasedQty: data.purchasedQty || 0,
        unit: data.unit!,
        category: data.category
    };
    db.materials.push(newMat);
    saveLocalDb(db);
    return newMat;
  },

  importMaterialPackage: async (workId: string, category: string): Promise<number> => {
    const pkg = FULL_MATERIAL_PACKAGES.find(p => p.category === category);
    if (!pkg) return 0;
    
    if (supabase) {
        const items = pkg.items.map(item => ({
            work_id: workId,
            name: item.name,
            planned_qty: 1,
            purchased_qty: 0,
            unit: item.unit,
            category
        }));
        await supabase.from('materials').insert(items);
        return pkg.items.length;
    }

    const db = getLocalDb();
    pkg.items.forEach(item => {
        db.materials.push({
            id: Math.random().toString(36).substr(2, 9),
            workId,
            name: item.name,
            plannedQty: 1,
            purchasedQty: 0,
            unit: item.unit,
            category
        });
    });
    saveLocalDb(db);
    return pkg.items.length;
  },

  updateMaterial: async (data: Material, cost?: number, qtyAdded?: number): Promise<Material> => {
    if (supabase) {
        await supabase.from('materials').update({
            name: data.name,
            planned_qty: data.plannedQty,
            purchased_qty: data.purchasedQty,
            unit: data.unit,
            category: data.category
        }).eq('id', data.id);

        if (cost && cost > 0) {
            await supabase.from('expenses').insert({
                work_id: data.workId,
                description: `Compra: ${data.name} (${qtyAdded} ${data.unit})`,
                amount: cost,
                paid_amount: cost,
                category: ExpenseCategory.MATERIAL,
                date: getLocalTodayString(),
                related_material_id: data.id
            });
        }
        return data;
    }
    const db = getLocalDb();
    const idx = db.materials.findIndex(m => m.id === data.id);
    if (idx > -1) {
        db.materials[idx] = data;
        if (cost && cost > 0) {
            db.expenses.push({
                id: Math.random().toString(36).substr(2, 9),
                workId: data.workId,
                description: `Compra: ${data.name} (${qtyAdded} ${data.unit})`,
                amount: cost,
                paidAmount: cost,
                category: ExpenseCategory.MATERIAL,
                date: getLocalTodayString(),
                relatedMaterialId: data.id
            });
        }
        saveLocalDb(db);
    }
    return data;
  },

  deleteMaterial: async (id: string) => {
    if (supabase) {
        await supabase.from('materials').delete().eq('id', id);
    } else {
        const db = getLocalDb();
        db.materials = db.materials.filter(m => m.id !== id);
        saveLocalDb(db);
    }
  },

  addStep: async (data: Partial<Step>): Promise<Step> => {
    if (supabase) {
        const { data: step } = await supabase.from('steps').insert({
            work_id: data.workId,
            name: data.name,
            start_date: data.startDate,
            end_date: data.endDate,
            status: data.status || StepStatus.NOT_STARTED
        }).select().single();
        return {
            id: step.id,
            workId: step.work_id,
            name: step.name,
            startDate: step.start_date,
            endDate: step.end_date,
            status: step.status,
            isDelayed: false // calculated later
        } as Step;
    }
    const db = getLocalDb();
    const newStep: Step = {
        id: Math.random().toString(36).substr(2, 9),
        workId: data.workId!,
        name: data.name!,
        startDate: data.startDate!,
        endDate: data.endDate!,
        status: data.status || StepStatus.NOT_STARTED,
        isDelayed: false
    };
    db.steps.push(newStep);
    saveLocalDb(db);
    return newStep;
  },

  updateStep: async (data: Step): Promise<Step> => {
    if (supabase) {
        await supabase.from('steps').update({
            name: data.name,
            start_date: data.startDate,
            end_date: data.endDate,
            status: data.status
        }).eq('id', data.id);
        return data;
    }
    const db = getLocalDb();
    const idx = db.steps.findIndex(s => s.id === data.id);
    if (idx > -1) {
        db.steps[idx] = data;
        saveLocalDb(db);
    }
    return data;
  },

  deleteStep: async (id: string) => {
    if (supabase) {
        await supabase.from('steps').delete().eq('id', id);
    } else {
        const db = getLocalDb();
        db.steps = db.steps.filter(s => s.id !== id);
        saveLocalDb(db);
    }
  },

  generatePix: async (amount: number, _user: { name: string, email: string, cpf: string }) => {
    // Return mock data
    return {
        qr_code_base64: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=MOCKPIXCODE',
        copy_paste_code: '00020126580014br.gov.bcb.pix013600000000-0000-0000-0000-000000000000520400005303986540' + amount.toFixed(2) + '5802BR5913MAOS DA OBRA6008SAO PAULO62070503***6304'
    };
  }
};
