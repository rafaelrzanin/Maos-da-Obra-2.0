import { 
  User, Work, Step, Expense, Material, WorkPhoto, WorkFile,
  PlanType, WorkStatus, StepStatus, Notification, StandardMaterial,
  Supplier, Worker, ExpenseCategory
} from '../types';
import { FULL_MATERIAL_PACKAGES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES } from './standards';
import { supabase } from './supabase';

// --- LOCAL STORAGE CONSTANTS ---
const DB_KEY = 'maos_db_v1';
const SESSION_KEY = 'maos_session_v1';
const NOTIFICATION_CHECK_KEY = 'maos_last_notif_check';

// --- DATABASE SCHEMA ---
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

// --- INITIAL MOCK DB ---
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

// --- HELPERS ---
const getLocalDb = (): DbSchema => {
  const stored = localStorage.getItem(DB_KEY);
  if (!stored) {
    localStorage.setItem(DB_KEY, JSON.stringify(initialDb));
    return initialDb;
  }
  const db = JSON.parse(stored);
  // Ensure arrays exist (migration fallback)
  if (!db.files) db.files = [];
  if (!db.photos) db.photos = [];
  if (!db.suppliers) db.suppliers = [];
  if (!db.workers) db.workers = [];
  return db;
};

const saveLocalDb = (db: DbSchema) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

const uploadToBucket = async (file: File, path: string): Promise<string | null> => {
    if (!supabase) return null;
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${path}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('work_assets').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('work_assets').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) {
        console.error("Upload Error:", error);
        return null;
    }
}

// --- ENGINE: CONSTRUCTION PLAN GENERATOR (ENGENHEIRO VIRTUAL 4.0) ---
// Gera lista sequencial e enumerada de etapas e materiais
interface PlanItem {
    stepName: string;
    duration: number;
    startOffset: number; 
    materials: { name: string, unit: string, qty: number }[];
}

const generateConstructionPlan = (totalArea: number, floors: number): PlanItem[] => {
    const plan: PlanItem[] = [];
    const footprint = totalArea / Math.max(1, floors); // Área por pavimento
    let currentDay = 0;
    let stepCount = 1;

    // Helper para enumerar etapas (01 - Nome, 02 - Nome...)
    const formatStep = (name: string) => `${stepCount.toString().padStart(2, '0')} - ${name}`;

    // 1. SERVIÇOS PRELIMINARES
    plan.push({
        stepName: formatStep("Serviços Preliminares"),
        duration: 5,
        startOffset: currentDay,
        materials: [
            { name: 'Tapume (Madeirite)', unit: 'chapas', qty: Math.ceil(Math.sqrt(footprint) * 4 / 2) },
            { name: 'Sarrasfo 2.5cm', unit: 'dz', qty: 2 },
            { name: 'Prego 17x21', unit: 'kg', qty: 2 },
            { name: 'Ligação Provisória Água/Luz', unit: 'vb', qty: 1 },
        ]
    });
    currentDay += 5;
    stepCount++;

    // 2. FUNDAÇÃO
    plan.push({
        stepName: formatStep("Fundação e Baldrames"),
        duration: 20,
        startOffset: currentDay,
        materials: [
            { name: 'Cimento CP-II (Concreto)', unit: 'sacos', qty: Math.ceil(footprint * 0.8) },
            { name: 'Areia Média/Grossa', unit: 'm³', qty: Math.ceil(footprint * 0.08) },
            { name: 'Brita 1', unit: 'm³', qty: Math.ceil(footprint * 0.08) },
            { name: 'Pedra de Mão (Rachão)', unit: 'm³', qty: Math.ceil(footprint * 0.04) },
            { name: 'Vergalhão 3/8 (10mm)', unit: 'barras', qty: Math.ceil(footprint * 0.6) },
            { name: 'Vergalhão 5/16 (8mm)', unit: 'barras', qty: Math.ceil(footprint * 0.4) },
            { name: 'Estribos 4.2mm (Prontos)', unit: 'un', qty: Math.ceil(footprint * 4) },
            { name: 'Tábua de Pinus 30cm', unit: 'dz', qty: Math.ceil(footprint / 15) },
            { name: 'Impermeabilizante Betuminoso', unit: 'latas', qty: Math.ceil(footprint / 12) },
        ]
    });
    currentDay += 20;
    stepCount++;

    // 3. ESTRUTURA (Loop por Andar)
    for (let i = 0; i < floors; i++) {
        const floorLabel = i === 0 ? "Térreo" : `${i}º Pavimento`;
        
        plan.push({
            stepName: formatStep(`Alvenaria e Estrutura (${floorLabel})`),
            duration: 20,
            startOffset: currentDay,
            materials: [
                { name: `Tijolo/Bloco (${floorLabel})`, unit: 'milheiro', qty: Math.ceil((footprint * 3 * 25) / 1000) },
                { name: 'Cimento (Assentamento)', unit: 'sacos', qty: Math.ceil(footprint * 0.25) },
                { name: 'Cal Hidratada', unit: 'sacos', qty: Math.ceil(footprint * 0.3) },
                { name: 'Areia Média', unit: 'm³', qty: Math.ceil(footprint * 0.05) },
                { name: 'Ferro 3/8 (Colunas)', unit: 'barras', qty: Math.ceil(footprint * 0.4) },
                { name: 'Caixinhas de Luz 4x2', unit: 'un', qty: Math.ceil(footprint / 8) },
                { name: 'Eletroduto Corrugado (Parede)', unit: 'rolos', qty: Math.ceil(footprint / 20) },
            ]
        });
        currentDay += 20;
        stepCount++;

        plan.push({
            stepName: formatStep(`Laje e Cobertura (${floorLabel})`),
            duration: 15,
            startOffset: currentDay,
            materials: [
                { name: `Vigota Trilho (${floorLabel})`, unit: 'm', qty: Math.ceil(footprint * 3.2) },
                { name: `Isopor/Lajota (${floorLabel})`, unit: 'un', qty: Math.ceil(footprint * 3.5) },
                { name: 'Malha Pop 15x15', unit: 'un', qty: Math.ceil(footprint / 8) },
                { name: 'Concreto Usinado FCK25', unit: 'm³', qty: Math.ceil(footprint * 0.1) },
                { name: 'Escoras de Eucalipto', unit: 'dz', qty: Math.ceil(footprint / 12) },
                { name: 'Caixas de Luz de Laje', unit: 'un', qty: Math.ceil(footprint / 15) },
                { name: 'Eletroduto Corrugado (Laje)', unit: 'rolos', qty: Math.ceil(footprint / 40) },
            ]
        });
        currentDay += 15;
        stepCount++;
    }

    // 4. TELHADO
    plan.push({
        stepName: formatStep("Telhado e Calhas"),
        duration: 15,
        startOffset: currentDay,
        materials: [
            { name: 'Madeiramento (Vigas/Caibros)', unit: 'm³', qty: Math.ceil(footprint * 0.04) },
            { name: 'Telhas (Cerâmica/Concreto)', unit: 'milheiro', qty: Math.ceil((footprint * 1.4 * 16) / 1000) },
            { name: 'Caixa D\'água 1000L', unit: 'un', qty: 1 },
            { name: 'Manta Térmica', unit: 'rolos', qty: Math.ceil(footprint / 45) },
            { name: 'Calhas e Rufos', unit: 'm', qty: Math.ceil(Math.sqrt(footprint) * 3) },
        ]
    });
    currentDay += 10; 
    stepCount++;

    // 5. INSTALAÇÕES
    plan.push({
        stepName: formatStep("Instalações Hidráulicas"),
        duration: 10,
        startOffset: currentDay,
        materials: [
            { name: 'Tubos PVC 25mm (Água)', unit: 'barras', qty: Math.ceil(totalArea / 8) },
            { name: 'Tubos Esgoto 100mm', unit: 'barras', qty: Math.ceil(floors * 3) },
            { name: 'Tubos Esgoto 40mm', unit: 'barras', qty: Math.ceil(totalArea / 10) },
            { name: 'Kit Conexões (Joelhos/Luvas)', unit: 'vb', qty: 1 },
            { name: 'Registros de Gaveta', unit: 'un', qty: Math.ceil(floors * 2) },
            { name: 'Cola PVC', unit: 'tubo', qty: 2 },
        ]
    });
    currentDay += 10;
    stepCount++;

    // 6. ACABAMENTO GROSSO
    plan.push({
        stepName: formatStep("Reboco e Contrapiso"),
        duration: 25,
        startOffset: currentDay,
        materials: [
            { name: 'Cimento (Reboco/Piso)', unit: 'sacos', qty: Math.ceil(totalArea * 0.4) },
            { name: 'Areia Fina/Média', unit: 'm³', qty: Math.ceil(totalArea * 0.1) },
            { name: 'Cal Hidratada', unit: 'sacos', qty: Math.ceil(totalArea * 0.3) },
            { name: 'Aditivo Vedalit', unit: 'litros', qty: Math.ceil(totalArea / 20) },
        ]
    });
    currentDay += 25;
    stepCount++;

    // 7. ELÉTRICA
    plan.push({
        stepName: formatStep("Fiação e Cabos"),
        duration: 7,
        startOffset: currentDay,
        materials: [
            { name: 'Cabos 2.5mm (Tomadas)', unit: 'rolos', qty: Math.ceil(totalArea / 25) },
            { name: 'Cabos 1.5mm (Iluminação)', unit: 'rolos', qty: Math.ceil(totalArea / 30) },
            { name: 'Cabos 6mm (Chuveiro)', unit: 'm', qty: Math.ceil(floors * 15) },
            { name: 'Quadro de Distribuição', unit: 'un', qty: floors },
            { name: 'Disjuntores', unit: 'un', qty: Math.ceil(totalArea / 20) },
            { name: 'Fita Isolante', unit: 'un', qty: 2 },
        ]
    });
    currentDay += 7;
    stepCount++;

    // 8. ACABAMENTO FINO
    plan.push({
        stepName: formatStep("Pisos e Revestimentos"),
        duration: 20,
        startOffset: currentDay,
        materials: [
            { name: 'Piso Cerâmico/Porcelanato', unit: 'm²', qty: Math.ceil(totalArea * 1.15) },
            { name: 'Argamassa AC-II/AC-III', unit: 'sacos', qty: Math.ceil(totalArea * 1.55 / 4) },
            { name: 'Rejunte', unit: 'kg', qty: Math.ceil(totalArea / 8) },
            { name: 'Niveladores de Piso', unit: 'pct', qty: Math.ceil(totalArea / 30) },
            { name: 'Rodapés', unit: 'm', qty: Math.ceil(Math.sqrt(totalArea) * 4) },
        ]
    });
    currentDay += 20;
    stepCount++;

    // 9. PINTURA
    plan.push({
        stepName: formatStep("Pintura Geral"),
        duration: 15,
        startOffset: currentDay,
        materials: [
            { name: 'Massa Corrida/Acrílica', unit: 'latas', qty: Math.ceil(totalArea / 12) },
            { name: 'Selador Acrílico', unit: 'latas', qty: Math.ceil(totalArea / 60) },
            { name: 'Tinta Acrílica (18L)', unit: 'latas', qty: Math.ceil(totalArea / 40) },
            { name: 'Lixas 150/220', unit: 'un', qty: 20 },
            { name: 'Kit Pintura (Rolo/Pincel)', unit: 'kit', qty: 1 },
            { name: 'Fita Crepe', unit: 'rolos', qty: 3 },
            { name: 'Lona Plástica', unit: 'm', qty: 20 },
        ]
    });
    currentDay += 15;
    stepCount++;

    // 10. FINALIZAÇÃO
    plan.push({
        stepName: formatStep("Acabamentos Finais e Entrega"),
        duration: 10,
        startOffset: currentDay,
        materials: [
            { name: 'Kit Tomadas e Interruptores', unit: 'un', qty: Math.ceil(totalArea / 8) },
            { name: 'Luminárias / Plafons', unit: 'un', qty: Math.ceil(totalArea / 12) },
            { name: 'Louças (Vaso/Pia)', unit: 'un', qty: Math.ceil(floors * 1.5) },
            { name: 'Metais (Torneiras/Chuveiro)', unit: 'un', qty: Math.ceil(floors * 2) },
            { name: 'Sifões e Engates', unit: 'un', qty: Math.ceil(floors * 3) },
        ]
    });

    return plan;
};


// --- DB SERVICE IMPLEMENTATION ---

export const dbService = {
  
  // --- AUTH ---
  login: async (email: string, password?: string): Promise<User | null> => {
    if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: password || '123456' });
        if (error) return null;
        if (data.user) {
            await supabase.from('profiles').update({ plan: PlanType.VITALICIO }).eq('id', data.user.id);
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
            if (profile) { localStorage.setItem(SESSION_KEY, JSON.stringify(profile)); return profile as User; }
        }
        return null;
    } else {
        return new Promise((resolve) => {
            setTimeout(() => {
                const db = getLocalDb();
                const user = db.users.find(u => u.email === email);
                if (user) {
                    if (user.plan !== PlanType.VITALICIO) { user.plan = PlanType.VITALICIO; saveLocalDb(db); }
                    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
                    resolve(user);
                } else resolve(null);
            }, 500); 
        });
    }
  },
  
  signup: async (name: string, email: string, whatsapp?: string, password?: string): Promise<User | null> => {
    if (supabase) {
        const { data, error } = await supabase.auth.signUp({ email, password: password || '123456', options: { data: { name, whatsapp } } });
        if (error || !data.user) return null;
        await new Promise(r => setTimeout(r, 1000));
        await supabase.from('profiles').update({ plan: PlanType.VITALICIO }).eq('id', data.user.id);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (profile) localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        return profile as User;
    } else {
        return new Promise((resolve) => {
            const db = getLocalDb();
            const newUser: User = { id: Math.random().toString(36).substr(2, 9), name, email, whatsapp, plan: PlanType.VITALICIO, subscriptionExpiresAt: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString() };
            db.users.push(newUser);
            saveLocalDb(db);
            localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
            resolve(newUser);
        });
    }
  },

  getCurrentUser: (): User | null => { const stored = localStorage.getItem(SESSION_KEY); return stored ? JSON.parse(stored) : null; },
  logout: async () => { if (supabase) await supabase.auth.signOut(); localStorage.removeItem(SESSION_KEY); },
    updatePlan: async (userId: string, plan: PlanType) => {
    if (supabase) {
      // Atualiza plano no Supabase
      await supabase.from('profiles').update({ plan }).eq('id', userId);

      // Sincroniza o perfil atualizado no localStorage
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
      }
    } else {
      // Modo offline/local DB
      const db = getLocalDb();
      const user = db.users.find(u => u.id === userId);
      if (user) {
        user.plan = plan;
        saveLocalDb(db);
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      }
    }
  },

  // --- WORKS ---
  getWorks: async (userId: string): Promise<Work[]> => {
    if (supabase) {
        const { data } = await supabase.from('works').select('*').eq('user_id', userId);
        return (data || []).map(w => ({ ...w, userId: w.user_id, budgetPlanned: w.budget_planned, startDate: w.start_date, endDate: w.end_date, floors: w.floors || 1 }));
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.works.filter(w => w.userId === userId));
    }
  },

  getWorkById: async (workId: string): Promise<Work | undefined> => {
    if (supabase) {
        const { data } = await supabase.from('works').select('*').eq('id', workId).single();
        if (!data) return undefined;
        return { ...data, userId: data.user_id, budgetPlanned: data.budget_planned, startDate: data.start_date, endDate: data.end_date, floors: data.floors || 1 };
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.works.find(w => w.id === workId));
    }
  },

  createWork: async (work: Omit<Work, 'id' | 'status'>, isConstructionMode: boolean = false): Promise<Work> => {
    // 1. Create Work
    let newWorkId = '';
    
    if (supabase) {
        const { data: newWork, error } = await supabase.from('works').insert({
            user_id: work.userId, name: work.name, address: work.address, budget_planned: work.budgetPlanned, start_date: work.startDate, end_date: work.endDate, area: work.area, floors: work.floors || 1, notes: work.notes, status: WorkStatus.PLANNING
        }).select().single();
        if (error || !newWork) throw new Error("Failed to create work");
        newWorkId = newWork.id;
    } else {
        const db = getLocalDb();
        const created: Work = { ...work, id: Math.random().toString(36).substr(2, 9), status: WorkStatus.PLANNING, floors: work.floors || 1 };
        db.works.push(created);
        saveLocalDb(db);
        newWorkId = created.id;
    }

    // 2. Generate Logic (Steps + Materials)
    if (isConstructionMode) {
        const plan = generateConstructionPlan(work.area, work.floors || 1);
        const startDate = new Date(work.startDate);

        for (const item of plan) {
            const sDate = new Date(startDate);
            sDate.setDate(sDate.getDate() + item.startOffset);
            const eDate = new Date(sDate);
            eDate.setDate(eDate.getDate() + item.duration);

            let stepId = '';

            // A. Insert Step
            if (supabase) {
                 const { data: newStep } = await supabase.from('steps').insert({
                    work_id: newWorkId, name: item.stepName, start_date: sDate.toISOString().split('T')[0], end_date: eDate.toISOString().split('T')[0], status: StepStatus.NOT_STARTED
                 }).select().single();
                 if (newStep) stepId = newStep.id;
            } else {
                 const db = getLocalDb();
                 stepId = Math.random().toString(36).substr(2, 9);
                 db.steps.push({ id: stepId, workId: newWorkId, name: item.stepName, startDate: sDate.toISOString().split('T')[0], endDate: eDate.toISOString().split('T')[0], status: StepStatus.NOT_STARTED, isDelayed: false });
                 saveLocalDb(db);
            }

            // B. Insert Materials (Linked to Step by Name/Category)
            if (item.materials.length > 0) {
                 if (supabase) {
                    // Supabase Payload (snake_case)
                    const payload = item.materials.map(m => ({
                        work_id: newWorkId,
                        name: m.name,
                        planned_qty: m.qty,
                        purchased_qty: 0,
                        unit: m.unit,
                        category: item.stepName, 
                        step_id: stepId || null 
                    }));
                    await supabase.from('materials').insert(payload);
                 } else {
                    // Local DB Payload (camelCase)
                    const db = getLocalDb();
                    const payload: Material[] = item.materials.map(m => ({
                        id: Math.random().toString(36).substr(2, 9),
                        workId: newWorkId,
                        name: m.name,
                        plannedQty: m.qty,
                        purchasedQty: 0,
                        unit: m.unit,
                        category: item.stepName,
                        stepId: stepId
                    }));
                    db.materials.push(...payload);
                    saveLocalDb(db);
                 }
            }
        }
    }

    if (supabase) {
        const { data } = await supabase.from('works').select('*').eq('id', newWorkId).single();
         return { ...data, userId: data.user_id, budgetPlanned: data.budget_planned, startDate: data.start_date, endDate: data.end_date, floors: data.floors };
    } else {
        const db = getLocalDb();
        return db.works.find(w => w.id === newWorkId)!;
    }
  },

  deleteWork: async (workId: string) => {
      if (supabase) { await supabase.from('works').delete().eq('id', workId); } 
      else {
          const db = getLocalDb();
          db.works = db.works.filter(w => w.id !== workId);
          db.steps = db.steps.filter(s => s.workId !== workId);
          db.expenses = db.expenses.filter(e => e.workId !== workId);
          db.materials = db.materials.filter(m => m.workId !== workId);
          saveLocalDb(db);
      }
  },

  // --- STEPS ---
  getSteps: async (workId: string): Promise<Step[]> => {
    if (supabase) {
        const { data } = await supabase.from('steps').select('*').eq('work_id', workId);
        const now = new Date();
        return (data || []).map(s => {
             const endDate = new Date(s.end_date);
             const isDelayed = (s.status !== StepStatus.COMPLETED) && (now > endDate);
             return { ...s, workId: s.work_id, startDate: s.start_date, endDate: s.end_date, isDelayed };
        });
    } else {
        const db = getLocalDb();
        const now = new Date();
        return Promise.resolve(db.steps.filter(s => s.workId === workId).map(s => {
            const endDate = new Date(s.endDate);
            const isDelayed = (s.status !== StepStatus.COMPLETED) && (now > endDate);
            return { ...s, isDelayed };
        }));
    }
  },

  addStep: async (step: Omit<Step, 'id' | 'isDelayed'>) => {
      if (supabase) await supabase.from('steps').insert({ work_id: step.workId, name: step.name, start_date: step.startDate, end_date: step.endDate, status: step.status });
      else { const db = getLocalDb(); db.steps.push({ ...step, id: Math.random().toString(36).substr(2, 9), isDelayed: false }); saveLocalDb(db); }
  },

  updateStep: async (step: Step) => {
    if (supabase) await supabase.from('steps').update({ name: step.name, start_date: step.startDate, end_date: step.endDate, status: step.status }).eq('id', step.id);
    else { const db = getLocalDb(); const idx = db.steps.findIndex(s => s.id === step.id); if (idx > -1) { db.steps[idx] = step; saveLocalDb(db); } }
  },

  deleteStep: async (stepId: string) => {
      if (supabase) await supabase.from('steps').delete().eq('id', stepId);
      else { const db = getLocalDb(); db.steps = db.steps.filter(s => s.id !== stepId); saveLocalDb(db); }
  },

  // --- EXPENSES ---
  getExpenses: async (workId: string): Promise<Expense[]> => {
    if (supabase) {
        const { data } = await supabase.from('expenses').select('*').eq('work_id', workId);
        return (data || []).map(e => ({ ...e, workId: e.work_id, paidAmount: e.paid_amount, stepId: e.step_id, workerId: e.worker_id }));
    } else { const db = getLocalDb(); return Promise.resolve(db.expenses.filter(e => e.workId === workId)); }
  },

  addExpense: async (expense: Omit<Expense, 'id'>) => {
      if (supabase) await supabase.from('expenses').insert({ work_id: expense.workId, description: expense.description, amount: expense.amount, paid_amount: expense.paidAmount, quantity: expense.quantity, category: expense.category, date: expense.date, step_id: expense.stepId, worker_id: expense.workerId });
      else { const db = getLocalDb(); db.expenses.push({ ...expense, id: Math.random().toString(36).substr(2, 9) }); saveLocalDb(db); }
  },

  updateExpense: async (expense: Expense) => {
      if (supabase) await supabase.from('expenses').update({ description: expense.description, amount: expense.amount, paid_amount: expense.paidAmount, category: expense.category, date: expense.date, step_id: expense.stepId, worker_id: expense.workerId }).eq('id', expense.id);
      else { const db = getLocalDb(); const idx = db.expenses.findIndex(e => e.id === expense.id); if (idx > -1) { db.expenses[idx] = expense; saveLocalDb(db); } }
  },

  deleteExpense: async (id: string) => {
      if (supabase) await supabase.from('expenses').delete().eq('id', id);
      else { const db = getLocalDb(); db.expenses = db.expenses.filter(e => e.id !== id); saveLocalDb(db); }
  },

  // --- MATERIALS ---
  getMaterials: async (workId: string): Promise<Material[]> => {
      if (supabase) {
          const { data } = await supabase.from('materials').select('*').eq('work_id', workId);
          return (data || []).map(m => ({ ...m, workId: m.work_id, plannedQty: m.planned_qty, purchasedQty: m.purchased_qty, stepId: m.step_id, category: m.category }));
      } else { const db = getLocalDb(); return Promise.resolve(db.materials.filter(m => m.workId === workId)); }
  },

  addMaterial: async (material: Omit<Material, 'id'>) => {
      if (supabase) await supabase.from('materials').insert({ work_id: material.workId, name: material.name, planned_qty: material.plannedQty, purchased_qty: material.purchasedQty, unit: material.unit, category: material.category || 'Geral' });
      else { const db = getLocalDb(); db.materials.push({ ...material, id: Math.random().toString(36).substr(2, 9), category: material.category || 'Geral' }); saveLocalDb(db); }
  },

  updateMaterial: async (material: Material, cost?: number) => {
      if (supabase) await supabase.from('materials').update({ name: material.name, planned_qty: material.plannedQty, purchased_qty: material.purchasedQty, category: material.category, unit: material.unit }).eq('id', material.id);
      else { const db = getLocalDb(); const idx = db.materials.findIndex(m => m.id === material.id); if (idx > -1) { db.materials[idx] = material; saveLocalDb(db); } }

      // Auto-launch Expense if cost provided
      if (cost && cost > 0) {
          let finalStepId = material.stepId;
          if (!finalStepId && material.category) {
               const steps = await dbService.getSteps(material.workId);
               const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
               const targetCat = normalize(material.category);
               let match = steps.find(s => normalize(s.name) === targetCat);
               if (!match) match = steps.find(s => normalize(s.name).includes(targetCat) || targetCat.includes(normalize(s.name)));
               if (match) finalStepId = match.id;
          }
          await dbService.addExpense({ workId: material.workId, description: `Compra: ${material.name}`, amount: cost, paidAmount: cost, quantity: 1, category: ExpenseCategory.MATERIAL, date: new Date().toISOString().split('T')[0], stepId: finalStepId });
      }
  },

  deleteMaterial: async (id: string) => {
      if (supabase) await supabase.from('materials').delete().eq('id', id);
      else { const db = getLocalDb(); db.materials = db.materials.filter(m => m.id !== id); saveLocalDb(db); }
  },

  importMaterialPackage: async (workId: string, category: string): Promise<number> => {
    let itemsToImport: StandardMaterial[] = [];
    if (supabase) {
        const { data } = await supabase.from('standard_materials').select('*').eq('category', category);
        if (data && data.length > 0) itemsToImport = data.map(d => ({ category: d.category, name: d.name, unit: d.unit }));
    }
    if (itemsToImport.length === 0) {
        const pkg = FULL_MATERIAL_PACKAGES.find(p => p.category === category);
        if (pkg) itemsToImport = pkg.items.map(i => ({ category: pkg.category, name: i.name, unit: i.unit }));
    }
    if (itemsToImport.length === 0) return 0;

    let relatedStepId = undefined;
    const steps = await dbService.getSteps(workId);
    const matchStep = steps.find(s => s.name.toLowerCase().includes(category.toLowerCase()));
    if (matchStep) relatedStepId = matchStep.id;

    if (supabase) {
        const payload = itemsToImport.map(item => ({ work_id: workId, name: item.name, planned_qty: 0, purchased_qty: 0, unit: item.unit, category: category, step_id: relatedStepId }));
        await supabase.from('materials').insert(payload);
    } else {
        const db = getLocalDb();
        const payload = itemsToImport.map(item => ({ id: Math.random().toString(36).substr(2, 9), workId: workId, name: item.name, plannedQty: 0, purchasedQty: 0, unit: item.unit, category: category, stepId: relatedStepId }));
        db.materials.push(...payload);
        saveLocalDb(db);
    }
    return itemsToImport.length;
  },

  // --- SUPPLIERS & WORKERS (CRUD Simple) ---
  getSuppliers: async (userId: string): Promise<Supplier[]> => {
    if (supabase) { const { data } = await supabase.from('suppliers').select('*').eq('user_id', userId); return (data || []).map(s => ({ ...s, userId: s.user_id })); }
    else { const db = getLocalDb(); return Promise.resolve(db.suppliers.filter(s => s.userId === userId)); }
  },
  addSupplier: async (supplier: Omit<Supplier, 'id'>) => {
    if (supabase) await supabase.from('suppliers').insert({ user_id: supplier.userId, name: supplier.name, category: supplier.category, phone: supplier.phone, email: supplier.email, address: supplier.address, notes: supplier.notes });
    else { const db = getLocalDb(); db.suppliers.push({ ...supplier, id: Math.random().toString(36).substr(2, 9) }); saveLocalDb(db); }
  },
  updateSupplier: async (supplier: Supplier) => {
    if (supabase) await supabase.from('suppliers').update({ name: supplier.name, category: supplier.category, phone: supplier.phone, email: supplier.email, address: supplier.address, notes: supplier.notes }).eq('id', supplier.id);
    else { const db = getLocalDb(); const idx = db.suppliers.findIndex(s => s.id === supplier.id); if (idx > -1) { db.suppliers[idx] = supplier; saveLocalDb(db); } }
  },
  deleteSupplier: async (id: string) => {
    if (supabase) await supabase.from('suppliers').delete().eq('id', id);
    else { const db = getLocalDb(); db.suppliers = db.suppliers.filter(s => s.id !== id); saveLocalDb(db); }
  },

  getWorkers: async (userId: string): Promise<Worker[]> => {
    if (supabase) { const { data } = await supabase.from('workers').select('*').eq('user_id', userId); return (data || []).map(w => ({ ...w, userId: w.user_id, dailyRate: w.daily_rate })); }
    else { const db = getLocalDb(); return Promise.resolve(db.workers.filter(w => w.userId === userId)); }
  },
  addWorker: async (worker: Omit<Worker, 'id'>) => {
    if (supabase) await supabase.from('workers').insert({ user_id: worker.userId, name: worker.name, role: worker.role, phone: worker.phone, daily_rate: worker.dailyRate, notes: worker.notes });
    else { const db = getLocalDb(); db.workers.push({ ...worker, id: Math.random().toString(36).substr(2, 9) }); saveLocalDb(db); }
  },
  updateWorker: async (worker: Worker) => {
    if (supabase) await supabase.from('workers').update({ name: worker.name, role: worker.role, phone: worker.phone, daily_rate: worker.dailyRate, notes: worker.notes }).eq('id', worker.id);
    else { const db = getLocalDb(); const idx = db.workers.findIndex(w => w.id === worker.id); if (idx > -1) { db.workers[idx] = worker; saveLocalDb(db); } }
  },
  deleteWorker: async (id: string) => {
    if (supabase) await supabase.from('workers').delete().eq('id', id);
    else { const db = getLocalDb(); db.workers = db.workers.filter(w => w.id !== id); saveLocalDb(db); }
  },

  getJobRoles: async (): Promise<string[]> => { return STANDARD_JOB_ROLES; },
  getSupplierCategories: async (): Promise<string[]> => { return STANDARD_SUPPLIER_CATEGORIES; },
  
  // --- PHOTOS & FILES ---
  getPhotos: async (workId: string): Promise<WorkPhoto[]> => {
      if (supabase) { const { data } = await supabase.from('work_photos').select('*').eq('work_id', workId).order('created_at', { ascending: false }); return (data || []).map(p => ({...p, workId: p.work_id, date: p.created_at})); }
      else { const db = getLocalDb(); return db.photos.filter(p => p.workId === workId); }
  },
  uploadPhoto: async (workId: string, file: File, type: 'BEFORE' | 'AFTER' | 'PROGRESS'): Promise<WorkPhoto | null> => {
      if (supabase) {
          const publicUrl = await uploadToBucket(file, `${workId}/photos`);
          if (!publicUrl) return null;
          const { data } = await supabase.from('work_photos').insert({ work_id: workId, url: publicUrl, type: type, description: file.name }).select().single();
          return data ? { ...data, workId: data.work_id, date: data.created_at } : null;
      } else {
          const db = getLocalDb();
          const newPhoto: WorkPhoto = { id: Math.random().toString(36).substr(2, 9), workId, url: URL.createObjectURL(file), type, description: file.name, date: new Date().toISOString() };
          db.photos.push(newPhoto); saveLocalDb(db); return newPhoto;
      }
  },
  deletePhoto: async (id: string) => { if (supabase) await supabase.from('work_photos').delete().eq('id', id); else { const db = getLocalDb(); db.photos = db.photos.filter(p => p.id !== id); saveLocalDb(db); } },

  getFiles: async (workId: string): Promise<WorkFile[]> => {
      if (supabase) { const { data } = await supabase.from('work_files').select('*').eq('work_id', workId).order('created_at', { ascending: false }); return (data || []).map(f => ({...f, workId: f.work_id, date: f.created_at, type: f.file_type})); }
      else { const db = getLocalDb(); return db.files.filter(f => f.workId === workId); }
  },
  uploadFile: async (workId: string, file: File, category: string): Promise<WorkFile | null> => {
      if (supabase) {
          const publicUrl = await uploadToBucket(file, `${workId}/files`);
          if (!publicUrl) return null;
          const { data } = await supabase.from('work_files').insert({ work_id: workId, url: publicUrl, name: file.name, category: category, file_type: file.name.split('.').pop() || 'file' }).select().single();
          return data ? { ...data, workId: data.work_id, date: data.created_at, type: data.file_type } : null;
      } else {
           const db = getLocalDb();
           const newFile: WorkFile = { id: Math.random().toString(36).substr(2, 9), workId, url: '#', name: file.name, category: category as any, type: 'pdf', date: new Date().toISOString() };
           db.files.push(newFile); saveLocalDb(db); return newFile;
      }
  },
  deleteFile: async (id: string) => { if (supabase) await supabase.from('work_files').delete().eq('id', id); else { const db = getLocalDb(); db.files = db.files.filter(f => f.id !== id); saveLocalDb(db); } },

  // --- NOTIFICATIONS & STATS ---
  getNotifications: async (userId: string): Promise<Notification[]> => { const db = getLocalDb(); return Promise.resolve(db.notifications.filter(n => n.userId === userId)); },
  dismissNotification: async (id: string) => { const db = getLocalDb(); db.notifications = db.notifications.filter(n => n.id !== id); saveLocalDb(db); },
  clearAllNotifications: async (userId: string) => { const db = getLocalDb(); db.notifications = db.notifications.filter(n => n.userId !== userId); saveLocalDb(db); },
  
  generateSmartNotifications: async (userId: string, workId: string) => {
      const db = getLocalDb();
      const lastCheckKey = `${NOTIFICATION_CHECK_KEY}_${workId}`;
      if (localStorage.getItem(lastCheckKey) === new Date().toISOString().split('T')[0]) return;

      const [expenses, steps, work] = await Promise.all([dbService.getExpenses(workId), dbService.getSteps(workId), dbService.getWorkById(workId)]);
      if (!work) return;

      const totalSpent = expenses.reduce((acc, curr) => acc + (curr.paidAmount ?? curr.amount), 0);
      if (work.budgetPlanned > 0 && (totalSpent / work.budgetPlanned) >= 0.8) {
           db.notifications.push({ id: Math.random().toString(36).substr(2, 9), userId, title: 'Cuidado com o dinheiro', message: '80% do orçamento atingido.', type: 'WARNING', read: false, date: new Date().toISOString() });
      }
      
      const now = new Date();
      steps.forEach(step => {
          if (step.status !== StepStatus.COMPLETED && new Date(step.endDate) < now) {
               db.notifications.push({ id: Math.random().toString(36).substr(2, 9), userId, title: 'Atraso detectado', message: `A tarefa "${step.name}" está atrasada.`, type: 'WARNING', read: false, date: new Date().toISOString() });
          }
      });
      saveLocalDb(db);
      localStorage.setItem(lastCheckKey, new Date().toISOString().split('T')[0]);
  },

  getDailySummary: async (workId: string) => {
      const [steps, materials] = await Promise.all([dbService.getSteps(workId), dbService.getMaterials(workId)]);
      return {
          completedSteps: steps.filter(s => s.status === StepStatus.COMPLETED).length,
          delayedSteps: steps.filter(s => s.status !== StepStatus.COMPLETED && new Date(s.endDate) < new Date()).length,
          pendingMaterials: materials.filter(m => m.purchasedQty < m.plannedQty).length,
          totalSteps: steps.length
      };
  },

  calculateWorkStats: async (workId: string) => {
    const [expenses, steps] = await Promise.all([dbService.getExpenses(workId), dbService.getSteps(workId)]);
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    return {
      totalSpent: expenses.reduce((acc, curr) => acc + (curr.paidAmount ?? curr.amount), 0),
      progress: steps.length === 0 ? 0 : Math.round((completedSteps / steps.length) * 100),
      delayedSteps: steps.filter(s => (s.status !== StepStatus.COMPLETED) && (new Date(s.endDate) < new Date())).length
    };
  }
};
