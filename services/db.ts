
import { 
  User, Work, Step, Material, Expense, Worker, Supplier, 
  WorkPhoto, WorkFile, Notification, PlanType, StepStatus
} from '../types';

const DB_KEY = 'maos_da_obra_db';

const getLocalDb = () => {
  const emptyDb = {
    users: [],
    works: [],
    steps: [],
    materials: [],
    expenses: [],
    workers: [],
    suppliers: [],
    photos: [],
    files: [],
    notifications: []
  };
  try {
    const data = localStorage.getItem(DB_KEY);
    if (!data) return emptyDb;
    
    const parsed = JSON.parse(data);
    // Merge ensures that if new arrays are added to the code (like suppliers),
    // they are initialized even if the localStorage has old data.
    return { ...emptyDb, ...parsed };
  } catch {
    return emptyDb;
  }
};

const saveLocalDb = (data: any) => {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
};

export const dbService = {
  // Auth
  getCurrentUser: (): User | null => {
    const json = localStorage.getItem('maos_user');
    try {
        return json ? JSON.parse(json) : null;
    } catch {
        return null;
    }
  },
  
  syncSession: async (): Promise<User | null> => {
    return dbService.getCurrentUser();
  },

  onAuthChange: (_callback: (user: User | null) => void) => {
     return () => {};
  },

  isSubscriptionActive: (user: User) => {
    if (!user.subscriptionExpiresAt) return false;
    return new Date(user.subscriptionExpiresAt) > new Date();
  },

  login: async (email: string, _password?: string): Promise<User | null> => {
     const db = getLocalDb();
     const cleanEmail = email.trim().toLowerCase();
     
     let user = db.users.find((u: User) => u.email === cleanEmail);
     
     // --- SAFETY NET: DEMO USER ---
     // If the user tries to login as Test/Demo, we FORCE its existence.
     // This solves the issue of "Account doesn't exist" during development/testing.
     if (cleanEmail === 'teste@maosdaobra.app') {
         if (!user) {
             user = {
                 id: 'demo-user-id',
                 name: 'Zé da Obra (Demo)',
                 email: 'teste@maosdaobra.app',
                 whatsapp: '51999999999',
                 plan: PlanType.VITALICIO,
                 subscriptionExpiresAt: new Date(Date.now() + 36500 * 24 * 60 * 60 * 1000).toISOString() // 100 years
             };
             // Ensure the array exists before pushing
             if (!Array.isArray(db.users)) db.users = [];
             db.users.push(user);
             saveLocalDb(db);
         }
         // Force session update
         localStorage.setItem('maos_user', JSON.stringify(user));
         return user;
     }

     if (user) { 
         localStorage.setItem('maos_user', JSON.stringify(user));
         return user;
     }
     return null;
  },

  signup: async (name: string, email: string, whatsapp: string, _password?: string, cpf?: string, planType?: string | null): Promise<User | null> => {
      const db = getLocalDb();
      const cleanEmail = email.trim().toLowerCase();

      if (db.users.find((u: User) => u.email === cleanEmail)) return null;
      
      const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          email: cleanEmail,
          whatsapp,
          cpf,
          plan: (planType as PlanType) || null,
          subscriptionExpiresAt: planType ? new Date(Date.now() + 30*24*60*60*1000).toISOString() : undefined
      };
      
      db.users.push(newUser);
      saveLocalDb(db);
      localStorage.setItem('maos_user', JSON.stringify(newUser));
      return newUser;
  },

  logout: () => {
      localStorage.removeItem('maos_user');
  },

  updatePlan: async (userId: string, plan: PlanType) => {
      const db = getLocalDb();
      const userIdx = db.users.findIndex((u: User) => u.id === userId);
      if (userIdx >= 0) {
          db.users[userIdx].plan = plan;
          let days = 30;
          if (plan === PlanType.SEMESTRAL) days = 180;
          if (plan === PlanType.VITALICIO) days = 36500;
          
          db.users[userIdx].subscriptionExpiresAt = new Date(Date.now() + days*24*60*60*1000).toISOString();
          saveLocalDb(db);
          
          const currentUser = dbService.getCurrentUser();
          if (currentUser && currentUser.id === userId) {
              localStorage.setItem('maos_user', JSON.stringify(db.users[userIdx]));
          }
      }
  },
  
  updateUser: async (id: string, data: Partial<User>, _password?: string) => {
      const db = getLocalDb();
      const idx = db.users.findIndex((u: User) => u.id === id);
      if (idx >= 0) {
          db.users[idx] = { ...db.users[idx], ...data };
          saveLocalDb(db);
           const currentUser = dbService.getCurrentUser();
          if (currentUser && currentUser.id === id) {
              localStorage.setItem('maos_user', JSON.stringify(db.users[idx]));
          }
      }
  },
  
  getUserProfile: async (id: string) => {
      const db = getLocalDb();
      return db.users.find((u: User) => u.id === id) || null;
  },

  loginSocial: async (_provider: string) => {
      return { user: null, error: 'Not implemented' };
  },
  
  resetPassword: async (_email: string) => {
      return true;
  },

  // Works
  getWorks: async (userId: string): Promise<Work[]> => {
      const db = getLocalDb();
      return db.works.filter((w: Work) => w.userId === userId);
  },

  getWorkById: async (id: string): Promise<Work | undefined> => {
      const db = getLocalDb();
      return db.works.find((w: Work) => w.id === id);
  },

  createWork: async (data: Partial<Work>, _templateId?: string): Promise<Work> => {
      const db = getLocalDb();
      const newWork: Work = {
          id: Math.random().toString(36).substr(2, 9),
          status: StepStatus.NOT_STARTED,
          ...data
      } as Work;
      db.works.push(newWork);
      saveLocalDb(db);
      return newWork;
  },
  
  deleteWork: async (id: string) => {
      const db = getLocalDb();
      db.works = db.works.filter((w: Work) => w.id !== id);
      db.steps = db.steps.filter((s: Step) => s.workId !== id);
      db.materials = db.materials.filter((m: Material) => m.workId !== id);
      db.expenses = db.expenses.filter((e: Expense) => e.workId !== id);
      saveLocalDb(db);
  },

  // Stats & Summary
  calculateWorkStats: async (workId: string) => {
      const db = getLocalDb();
      const workExpenses = db.expenses.filter((e: Expense) => e.workId === workId);
      const totalSpent = workExpenses.reduce((acc: number, cur: Expense) => acc + (Number(cur.amount)||0), 0);
      
      const workSteps = db.steps.filter((s: Step) => s.workId === workId);
      const completed = workSteps.filter((s: Step) => s.status === StepStatus.COMPLETED).length;
      const progress = workSteps.length > 0 ? Math.round((completed / workSteps.length) * 100) : 0;
      
      return { totalSpent, progress, delayedSteps: 0 };
  },

  getDailySummary: async (workId: string) => {
      const db = getLocalDb();
      const steps = db.steps.filter((s: Step) => s.workId === workId);
      const delayedSteps = steps.filter((s: Step) => {
          if (s.status === StepStatus.COMPLETED) return false;
          return new Date(s.endDate) < new Date();
      }).length;
      
      const completedSteps = steps.filter((s: Step) => s.status === StepStatus.COMPLETED).length;
      
      const materials = db.materials.filter((m: Material) => m.workId === workId);
      const pendingMaterials = materials.filter((m: Material) => m.purchasedQty < m.plannedQty).length;
      
      return { completedSteps, delayedSteps, pendingMaterials, totalSteps: steps.length };
  },

  // Steps
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
      if (idx >= 0) {
          db.steps[idx] = step;
          saveLocalDb(db);
      }
  },

  // Materials
  getMaterials: async (workId: string): Promise<Material[]> => {
      const db = getLocalDb();
      return db.materials.filter((m: Material) => m.workId === workId);
  },

  addMaterial: async (material: Material, purchase?: any) => {
      const db = getLocalDb();
      if (purchase) {
          material.purchasedQty = purchase.qty;
          db.expenses.push({
              id: Math.random().toString(36).substr(2, 9),
              workId: material.workId,
              description: `Compra: ${material.name}`,
              amount: purchase.cost,
              date: purchase.date,
              category: 'Material',
              relatedMaterialId: material.id
          });
      }
      db.materials.push(material);
      saveLocalDb(db);
  },

  updateMaterial: async (material: Material) => {
      const db = getLocalDb();
      const idx = db.materials.findIndex((m: Material) => m.id === material.id);
      if (idx >= 0) {
          db.materials[idx] = material;
          saveLocalDb(db);
      }
  },

  registerMaterialPurchase: async (id: string, name: string, _brand: string, _planned: number, _unit: string, qty: number, cost: number) => {
      const db = getLocalDb();
      const idx = db.materials.findIndex((m: Material) => m.id === id);
      if (idx >= 0) {
          db.materials[idx].purchasedQty = (db.materials[idx].purchasedQty || 0) + qty;
          
          db.expenses.push({
              id: Math.random().toString(36).substr(2, 9),
              workId: db.materials[idx].workId,
              description: `Compra: ${name}`,
              amount: cost,
              date: new Date().toISOString(),
              category: 'Material',
              relatedMaterialId: id
          });
          
          saveLocalDb(db);
      }
  },

  // Expenses
  getExpenses: async (workId: string): Promise<Expense[]> => {
      const db = getLocalDb();
      return db.expenses.filter((e: Expense) => e.workId === workId);
  },

  addExpense: async (expense: Expense) => {
      const db = getLocalDb();
      db.expenses.push(expense);
      saveLocalDb(db);
  },

  updateExpense: async (expense: Expense) => {
      const db = getLocalDb();
      const idx = db.expenses.findIndex((e: Expense) => e.id === expense.id);
      if (idx >= 0) {
          db.expenses[idx] = expense;
          saveLocalDb(db);
      }
  },

  deleteExpense: async (id: string) => {
      const db = getLocalDb();
      db.expenses = db.expenses.filter((e: Expense) => e.id !== id);
      saveLocalDb(db);
  },

  getPaymentHistory: async (workId: string, description: string, excludeId?: string): Promise<{ totalPaid: number, lastTotalAgreed: number }> => {
      const db = getLocalDb();
      if (!description) return { totalPaid: 0, lastTotalAgreed: 0 };

      const normalize = (str: string) => str.toLowerCase().trim();
      const targetDesc = normalize(description);

      const relevant = db.expenses.filter((e: Expense) => 
          e.workId === workId && 
          normalize(e.description) === targetDesc &&
          e.id !== excludeId
      );
      
      const totalPaid = relevant.reduce((acc: number, curr: Expense) => acc + (Number(curr.amount) || 0), 0);
      
      const lastAgreedItem = relevant
        .sort((a: Expense, b: Expense) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .find((e: Expense) => e.totalAgreed && Number(e.totalAgreed) > 0);
      
      return { 
          totalPaid, 
          lastTotalAgreed: lastAgreedItem ? Number(lastAgreedItem.totalAgreed) : 0 
      };
  },

  // Workers & Suppliers
  getWorkers: async (userId: string): Promise<Worker[]> => {
      const db = getLocalDb();
      return db.workers.filter((w: Worker) => w.userId === userId);
  },

  addWorker: async (worker: Worker) => {
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

  addSupplier: async (supplier: Supplier) => {
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

  // Photos & Files
  getPhotos: async (workId: string): Promise<WorkPhoto[]> => {
      const db = getLocalDb();
      return db.photos.filter((p: WorkPhoto) => p.workId === workId);
  },

  addPhoto: async (photo: WorkPhoto) => {
      const db = getLocalDb();
      db.photos.push(photo);
      saveLocalDb(db);
  },

  getFiles: async (workId: string): Promise<WorkFile[]> => {
      const db = getLocalDb();
      return db.files.filter((f: WorkFile) => f.workId === workId);
  },

  addFile: async (file: WorkFile) => {
      const db = getLocalDb();
      db.files.push(file);
      saveLocalDb(db);
  },

  // Notifications
  getNotifications: async (userId: string): Promise<Notification[]> => {
      const db = getLocalDb();
      return db.notifications.filter((n: Notification) => n.userId === userId);
  },

  dismissNotification: async (id: string) => {
      const db = getLocalDb();
      db.notifications = db.notifications.filter((n: Notification) => n.id !== id);
      saveLocalDb(db);
  },

  clearAllNotifications: async (userId: string) => {
      const db = getLocalDb();
      db.notifications = db.notifications.filter((n: Notification) => n.userId !== userId);
      saveLocalDb(db);
  },

  generateSmartNotifications: async (_userId: string, _workId: string) => {
      // Mock implementation
  },

  generatePix: async (amount: number, _user: any) => {
      return { 
          qr_code_base64: '', 
          copy_paste_code: '00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540' + amount.toFixed(2) + '5802BR5913Maos Da Obra6008BRASILIA62070503***6304ABCD'
      };
  },
};
