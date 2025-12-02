import { 
  User, Work, Step, Expense, Material, WorkPhoto, WorkFile,
  PlanType, WorkStatus, StepStatus, Notification, StandardMaterial,
  Supplier, Worker, ExpenseCategory
} from '../types';
import { FULL_MATERIAL_PACKAGES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES } from './standards';
import { supabase } from './supabase';

// --- LOCAL STORAGE FALLBACK CONSTANTS ---
const DB_KEY = 'maos_db_v1';
const SESSION_KEY = 'maos_session_v1';
const NOTIFICATION_CHECK_KEY = 'maos_last_notif_check';

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

// --- ENGINE: CONSTRUCTION PLAN GENERATOR (ENGENHEIRO VIRTUAL 4.0 - SEQUENCIAL STRICT) ---
interface PlanItem {
    stepName: string;
    duration: number;
    startOffset: number; 
    materials: { name: string, unit: string, qty: number, category?: string }[];
}

const generateConstructionPlan = (totalArea: number, floors: number): PlanItem[] => {
    const plan: PlanItem[] = [];
    const footprint = totalArea / Math.max(1, floors); 
    let currentDay = 0;
    let stepCount = 1;

    const formatStep = (name: string) => `${stepCount.toString().padStart(2, '0')} - ${name}`;

    // 1. SERVIÇOS PRELIMINARES
    plan.push({
        stepName: formatStep("Serviços Preliminares (Canteiro)"),
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
            { name: 'Tábua de Pinus 30cm (Caixaria)', unit: 'dz', qty: Math.ceil(footprint / 15) },
            { name: 'Impermeabilizante Betuminoso', unit: 'latas', qty: Math.ceil(footprint / 12) },
        ]
    });
    currentDay += 20;
    stepCount++;

    // 3. ESTRUTURA
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
        stepName: formatStep("Instalações Hidráulicas e Esgoto"),
        duration: 10,
        startOffset: currentDay,
        materials: [
            { name: 'Tubos PVC 25mm (Água)', unit: 'barras', qty: Math.ceil(totalArea / 8) },
            { name: 'Tubos Esgoto 100mm', unit: 'barras', qty: Math.ceil(floors * 3) },
            { name: 'Tubos Esgoto 40mm/50mm', unit: 'barras', qty: Math.ceil(totalArea / 10) },
            { name: 'Conexões Diversas (Kit)', unit: 'vb', qty: 1 },
            { name: 'Registros de Gaveta', unit: 'un', qty: Math.ceil(floors * 2) },
            { name: 'Cola PVC', unit: 'tubo', qty: 2 },
        ]
    });
    currentDay += 10;
    stepCount++;

    // 6. REBOCO
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

    // 7. FIAÇÃO
    plan.push({
        stepName: formatStep("Fiação e Cabos Elétricos"),
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

    // 8. PISOS
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
            { name: 'Rolo de Lã e Pincel', unit: 'kit', qty: 1 },
            { name: 'Fita Crepe', unit: 'rolos', qty: 3 },
            { name: 'Lona Plástica', unit: 'm', qty: 20 },
        ]
    });
    currentDay += 15;
    stepCount++;

    // 10. ACABAMENTOS FINAIS
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


// --- SERVICE LAYER (ASYNC INTERFACE) ---

export const dbService = {
  
  // --- Auth ---
  login: async (email: string, password?: string): Promise<User | null> => {
    if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: password || '123456' 
        });
        
        if (error) {
             console.error("Supabase Login Error:", error);
             return null;
        }

        if (data.user) {
            // Force Update Plan to Vitalicio on Login
            await supabase.from('profiles').update({ plan: PlanType.VITALICIO }).eq('id', data.user.id);
            
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
            // Local Storage Persistence for Supabase Session
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
                    if (user.plan !== PlanType.VITALICIO) {
                        user.plan = PlanType.VITALICIO;
                        saveLocalDb(db);
                    }
                    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
                    resolve(user);
                } else {
                    resolve(null);
                }
            }, 500); 
        });
    }
  },
  
  signup: async (name: string, email: string, whatsapp?: string, password?: string): Promise<User | null> => {
    if (supabase) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password: password || '123456',
            options: {
                data: { name, whatsapp }
            }
        });
        
        if (error || !data.user) {
            console.error("Signup Error", error);
            return null;
        }
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Force Vitalicio on Signup
        await supabase.from('profiles').update({ plan: PlanType.VITALICIO }).eq('id', data.user.id);

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
                plan: PlanType.VITALICIO, // Force Vitalicio
                subscriptionExpiresAt: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString()
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

  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
  },

  updatePlan: async (userId: string, plan: PlanType) => {
     if (supabase) {
        const baseDate = new Date();
        if (plan === PlanType.MENSAL) baseDate.setMonth(baseDate.getMonth() + 1);
        if (plan === PlanType.SEMESTRAL) baseDate.setMonth(baseDate.getMonth() + 6);
        if (plan === PlanType.VITALICIO) baseDate.setFullYear(baseDate.getFullYear() + 99);

        await supabase.from('profiles').update({ 
            plan, 
            subscription_expires_at: baseDate.toISOString() 
        }).eq('id', userId);
     } else {
        const db = getLocalDb();
        const userIdx = db.users.findIndex(u => u.id === userId);
        if (userIdx > -1) {
            db.users[userIdx].plan = plan;
            db.users[userIdx].subscriptionExpiresAt = new Date().toISOString();
            saveLocalDb(db); 
            localStorage.setItem(SESSION_KEY, JSON.stringify(db.users[userIdx]));
        }
     }
  },

  // --- Works ---
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

  createWork: async (work: Omit<Work, 'id' | 'status'>, isConstructionMode: boolean = false): Promise<Work> => {
    // 1. CREATE WORK RECORD
    let newWorkId = '';
    
    if (supabase) {
        const { data: newWork, error } = await supabase.from('works').insert({
            user_id: work.userId,
            name: work.name,
            address: work.address,
            budget_planned: work.budgetPlanned,
            start_date: work.startDate,
            end_date: work.endDate,
            area: work.area,
            floors: work.floors || 1,
            notes: work.notes,
            status: WorkStatus.PLANNING
        }).select().single();

        if (error || !newWork) throw new Error("Failed to create work");
        newWorkId = newWork.id;

    } else {
        const db = getLocalDb();
        const created: Work = {
            ...work,
            id: Math.random().toString(36).substr(2, 9),
            status: WorkStatus.PLANNING,
            floors: work.floors || 1
        };
        db.works.push(created);
        saveLocalDb(db);
        newWorkId = created.id;
    }

    // 2. GENERATE INTELLIGENT PLAN (If Construction)
    if (isConstructionMode) {
        const plan = generateConstructionPlan(work.area, work.floors || 1);
        const startDate = new Date(work.startDate);

        // SEQUENTIAL INSERTION TO ENSURE ID LINKING
        for (const item of plan) {
            // Calculate dates
            const sDate = new Date(startDate);
            sDate.setDate(sDate.getDate() + item.startOffset);
            const eDate = new Date(sDate);
            eDate.setDate(eDate.getDate() + item.duration);

            // A. Create Step
            let stepId = '';
            if (supabase) {
                 const { data: newStep } = await supabase.from('steps').insert({
                    work_id: newWorkId,
                    name: item.stepName,
                    start_date: sDate.toISOString().split('T')[0],
                    end_date: eDate.toISOString().split('T')[0],
                    status: StepStatus.NOT_STARTED
                 }).select().single();
                 if (newStep) stepId = newStep.id;
            } else {
                 const db = getLocalDb();
                 stepId = Math.random().toString(36).substr(2, 9);
                 db.steps.push({
                     id: stepId,
                     workId: newWorkId,
                     name: item.stepName,
                     startDate: sDate.toISOString().split('T')[0],
                     endDate: eDate.toISOString().split('T')[0],
                     status: StepStatus.NOT_STARTED,
                     isDelayed: false
                 });
                 saveLocalDb(db);
            }

            // B. Create Linked Materials
            if (item.materials.length > 0) {
                 // FORCE CATEGORY TO MATCH STEP NAME FOR VISUAL GROUPING
                 const matPayload = item.materials.map(m => ({
                    work_id: newWorkId,
                    name: m.name,
                    planned_qty: m.qty,
                    purchased_qty: 0,
                    unit: m.unit,
                    category: item.stepName, // CRITICAL: USE STEP NAME AS CATEGORY
                    step_id: stepId || null 
                 }));

                 if (supabase) {
                    // Try insert via Supabase
                    const { error } = await supabase.from('materials').insert(matPayload);
                    if (error) {
                        console.error("Erro ao inserir materiais automáticos:", error);
                        // Fallback if step_id column missing
                        if (error.message.includes('step_id')) {
                             const fallbackPayload = matPayload.map(({ step_id, ...rest }) => rest);
                             await supabase.from('materials').insert(fallbackPayload);
                        }
                    }
                 } else {
                    const db = getLocalDb();
                    const localPayload = matPayload.map(m => ({
                        ...m,
                        id: Math.random().toString(36).substr(2, 9),
                        stepId: stepId,
                        plannedQty: m.planned_qty,
                        purchasedQty: 0,
                        workId: newWorkId
                    }));
                    // Cleanup snake_case for local
                    const cleanPayload = localPayload.map(({ step_id, planned_qty, purchased_qty, work_id, ...rest }) => rest);
                    
                    db.materials.push(...cleanPayload as Material[]);
                    saveLocalDb(db);
                 }
            }
        }
    }

    // Return the work object to the frontend
    if (supabase) {
        const { data } = await supabase.from('works').select('*').eq('id', newWorkId).single();
         return {
            ...data,
            userId: data.user_id,
            budgetPlanned: data.budget_planned,
            startDate: data.start_date,
            endDate: data.end_date,
            floors: data.floors
        };
    } else {
        const db = getLocalDb();
        return db.works.find(w => w.id === newWorkId)!;
    }
  },

  deleteWork: async (workId: string) => {
      if (supabase) {
          await supabase.from('works').delete().eq('id', workId);
      } else {
          const db = getLocalDb();
          db.works = db.works.filter(w => w.id !== workId);
          db.steps = db.steps.filter(s => s.workId !== workId);
          db.expenses = db.expenses.filter(e => e.workId !== workId);
          db.materials = db.materials.filter(m => m.workId !== workId);
          saveLocalDb(db);
      }
  },

  // --- Steps ---
  getSteps: async (workId: string): Promise<Step[]> => {
    if (supabase) {
        const { data } = await supabase.from('steps').select('*').eq('work_id', workId);
        const now = new Date();
        return (data || []).map(s => {
             const endDate = new Date(s.end_date);
             const isDelayed = (s.status !== StepStatus.COMPLETED) && (now > endDate);
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
        const now = new Date();
        return Promise.resolve(db.steps.filter(s => s.workId === workId).map(s => {
            const endDate = new Date(s.endDate);
            const isDelayed = (s.status !== StepStatus.COMPLETED) && (now > endDate);
            return { ...s, isDelayed };
        }));
    }
  },

  updateStep: async (step: Step) => {
    if (supabase) {
        await supabase.from('steps').update({
            name: step.name,
            start_date: step.startDate,
            end_date: step.endDate,
            status: step.status
        }).eq('id', step.id);
    } else {
        const db = getLocalDb();
        const idx = db.steps.findIndex(s => s.id === step.id);
        if (idx > -1) {
            db.steps[idx] = step;
            saveLocalDb(db);
        }
    }
  },

  addStep: async (step: Omit<Step, 'id' | 'isDelayed'>) => {
      if (supabase) {
          await supabase.from('steps').insert({
              work_id: step.workId,
              name: step.name,
              start_date: step.startDate,
              end_date: step.endDate,
              status: step.status
          });
      } else {
          const db = getLocalDb();
          db.steps.push({ ...step, id: Math.random().toString(36).substr(2, 9), isDelayed: false });
          saveLocalDb(db);
      }
  },

  deleteStep: async (stepId: string) => {
      if (supabase) {
          await supabase.from('steps').delete().eq('id', stepId);
      } else {
          const db = getLocalDb();
          db.steps = db.steps.filter(s => s.id !== stepId);
          saveLocalDb(db);
      }
  },

  // --- Expenses ---
  getExpenses: async (workId: string): Promise<Expense[]> => {
    if (supabase) {
        const { data } = await supabase.from('expenses').select('*').eq('work_id', workId);
        return (data || []).map(e => ({
            ...e,
            workId: e.work_id,
            paidAmount: e.paid_amount,
            stepId: e.step_id,
            workerId: e.worker_id
        }));
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.expenses.filter(e => e.workId === workId));
    }
  },

  addExpense: async (expense: Omit<Expense, 'id'>) => {
      if (supabase) {
          await supabase.from('expenses').insert({
              work_id: expense.workId,
              description: expense.description,
              amount: expense.amount,
              paid_amount: expense.paidAmount,
              quantity: expense.quantity,
              category: expense.category,
              date: expense.date,
              step_id: expense.stepId,
              worker_id: expense.workerId
          });
      } else {
          const db = getLocalDb();
          db.expenses.push({ ...expense, id: Math.random().toString(36).substr(2, 9) });
          saveLocalDb(db);
      }
  },

  updateExpense: async (expense: Expense) => {
      if (supabase) {
          await supabase.from('expenses').update({
              description: expense.description,
              amount: expense.amount,
              paid_amount: expense.paidAmount,
              category: expense.category,
              date: expense.date,
              step_id: expense.stepId,
              worker_id: expense.workerId
          }).eq('id', expense.id);
      } else {
          const db = getLocalDb();
          const idx = db.expenses.findIndex(e => e.id === expense.id);
          if (idx > -1) {
              db.expenses[idx] = expense;
              saveLocalDb(db);
          }
      }
  },

  deleteExpense: async (id: string) => {
      if (supabase) await supabase.from('expenses').delete().eq('id', id);
      else {
          const db = getLocalDb();
          db.expenses = db.expenses.filter(e => e.id !== id);
          saveLocalDb(db);
      }
  },

  // --- Materials ---
  getMaterials: async (workId: string): Promise<Material[]> => {
      if (supabase) {
          const { data } = await supabase.from('materials').select('*').eq('work_id', workId);
          return (data || []).map(m => ({
              ...m,
              workId: m.work_id,
              plannedQty: m.planned_qty,
              purchasedQty: m.purchased_qty,
              stepId: m.step_id,
              category: m.category
          }));
      } else {
          const db = getLocalDb();
          return Promise.resolve(db.materials.filter(m => m.workId === workId));
      }
  },

  addMaterial: async (material: Omit<Material, 'id'>) => {
      if (supabase) {
          await supabase.from('materials').insert({
              work_id: material.workId,
              name: material.name,
              planned_qty: material.plannedQty,
              purchased_qty: material.purchasedQty,
              unit: material.unit,
              category: material.category || 'Geral'
          });
      } else {
          const db = getLocalDb();
          db.materials.push({ 
              ...material, 
              id: Math.random().toString(36).substr(2, 9),
              category: material.category || 'Geral'
            });
          saveLocalDb(db);
      }
  },

  updateMaterial: async (material: Material, cost?: number) => {
      // 1. Update Material Record
      if (supabase) {
          await supabase.from('materials').update({
              name: material.name,
              planned_qty: material.plannedQty,
              purchased_qty: material.purchasedQty,
              category: material.category,
              unit: material.unit
          }).eq('id', material.id);
      } else {
          const db = getLocalDb();
          const idx = db.materials.findIndex(m => m.id === material.id);
          if (idx > -1) {
              db.materials[idx] = material;
              saveLocalDb(db);
          }
      }

      // 2. If Cost provided, Add to Expenses automatically linked to the material/step
      if (cost && cost > 0) {
          // SMART LINKING: Resolve Step ID
          let finalStepId = material.stepId;

          // If material is not explicitly linked to a step ID, try to find a step by Category Name
          if (!finalStepId && material.category) {
               // We need to fetch steps to find the ID
               const steps = await dbService.getSteps(material.workId);
               
               // Normalize Helper: remove accents, lowercase, trim
               const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
               const targetCat = normalize(material.category);

               // 1. Try Exact Normalized Match (e.g. "Fundacao" == "Fundação")
               let match = steps.find(s => normalize(s.name) === targetCat);

               // 2. Try Contains Match (e.g. Category "Pintura" matches Step "Pintura e Acabamento")
               if (!match) {
                   match = steps.find(s => normalize(s.name).includes(targetCat) || targetCat.includes(normalize(s.name)));
               }

               if (match) finalStepId = match.id;
          }

          const description = `Compra: ${material.name}`;
          await dbService.addExpense({
              workId: material.workId,
              description: description,
              amount: cost,
              paidAmount: cost, // Assuming full payment for simplicity in this quick action
              quantity: 1,
              category: ExpenseCategory.MATERIAL,
              date: new Date().toISOString().split('T')[0],
              stepId: finalStepId // Pass the resolved ID (or undefined -> Geral)
          });
      }
  },

  deleteMaterial: async (id: string) => {
      if (supabase) await supabase.from('materials').delete().eq('id', id);
      else {
          const db = getLocalDb();
          db.materials = db.materials.filter(m => m.id !== id);
          saveLocalDb(db);
      }
  },

  // --- STANDARD MATERIAL PACKAGES IMPORT ---
  importMaterialPackage: async (workId: string, category: string): Promise<number> => {
    let itemsToImport: StandardMaterial[] = [];

    // 1. Fetch Standard Items
    if (supabase) {
        const { data, error } = await supabase.from('standard_materials').select('*').eq('category', category);
        if (!error && data && data.length > 0) {
            itemsToImport = data.map(d => ({ category: d.category, name: d.name, unit: d.unit }));
        }
    }
    
    // Fallback
    if (itemsToImport.length === 0) {
        const pkg = FULL_MATERIAL_PACKAGES.find(p => p.category === category);
        if (pkg) {
            itemsToImport = pkg.items.map(i => ({ category: pkg.category, name: i.name, unit: i.unit }));
        }
    }

    if (itemsToImport.length === 0) return 0;

    // 2. Try to find a matching Step to link for alerts (Smart Link)
    let relatedStepId = undefined;
    const steps = await dbService.getSteps(workId);
    const matchStep = steps.find(s => s.name.toLowerCase().includes(category.toLowerCase()));
    if (matchStep) relatedStepId = matchStep.id;

    // 3. Insert
    if (supabase) {
        const payload = itemsToImport.map(item => ({
            work_id: workId,
            name: item.name,
            planned_qty: 0,
            purchased_qty: 0,
            unit: item.unit,
            category: category,
            step_id: relatedStepId // Link to step if found
        }));
        await supabase.from('materials').insert(payload);
    } else {
        const db = getLocalDb();
        const payload = itemsToImport.map(item => ({
            id: Math.random().toString(36).substr(2, 9),
            workId: workId,
            name: item.name,
            plannedQty: 0,
            purchasedQty: 0,
            unit: item.unit,
            category: category,
            stepId: relatedStepId
        }));
        db.materials.push(...payload);
        saveLocalDb(db);
    }

    return itemsToImport.length;
  },

  // --- SUPPLIERS & WORKERS ---
  getSuppliers: async (userId: string): Promise<Supplier[]> => {
    if (supabase) {
        const { data } = await supabase.from('suppliers').select('*').eq('user_id', userId);
        return (data || []).map(s => ({ ...s, userId: s.user_id }));
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.suppliers.filter(s => s.userId === userId));
    }
  },

  addSupplier: async (supplier: Omit<Supplier, 'id'>) => {
    if (supabase) {
        await supabase.from('suppliers').insert({
            user_id: supplier.userId,
            name: supplier.name,
            category: supplier.category,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            notes: supplier.notes
        });
    } else {
        const db = getLocalDb();
        db.suppliers.push({ ...supplier, id: Math.random().toString(36).substr(2, 9) });
        saveLocalDb(db);
    }
  },

  updateSupplier: async (supplier: Supplier) => {
    if (supabase) {
        await supabase.from('suppliers').update({
            name: supplier.name,
            category: supplier.category,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            notes: supplier.notes
        }).eq('id', supplier.id);
    } else {
        const db = getLocalDb();
        const idx = db.suppliers.findIndex(s => s.id === supplier.id);
        if (idx > -1) {
            db.suppliers[idx] = supplier;
            saveLocalDb(db);
        }
    }
  },

  deleteSupplier: async (id: string) => {
    if (supabase) await supabase.from('suppliers').delete().eq('id', id);
    else {
        const db = getLocalDb();
        db.suppliers = db.suppliers.filter(s => s.id !== id);
        saveLocalDb(db);
    }
  },

  getWorkers: async (userId: string): Promise<Worker[]> => {
    if (supabase) {
        const { data } = await supabase.from('workers').select('*').eq('user_id', userId);
        return (data || []).map(w => ({ 
            ...w, 
            userId: w.user_id, 
            dailyRate: w.daily_rate 
        }));
    } else {
        const db = getLocalDb();
        return Promise.resolve(db.workers.filter(w => w.userId === userId));
    }
  },

  addWorker: async (worker: Omit<Worker, 'id'>) => {
    if (supabase) {
        await supabase.from('workers').insert({
            user_id: worker.userId,
            name: worker.name,
            role: worker.role,
            phone: worker.phone,
            daily_rate: worker.dailyRate,
            notes: worker.notes
        });
    } else {
        const db = getLocalDb();
        db.workers.push({ ...worker, id: Math.random().toString(36).substr(2, 9) });
        saveLocalDb(db);
    }
  },

  updateWorker: async (worker: Worker) => {
    if (supabase) {
        await supabase.from('workers').update({
            name: worker.name,
            role: worker.role,
            phone: worker.phone,
            daily_rate: worker.dailyRate,
            notes: worker.notes
        }).eq('id', worker.id);
    } else {
        const db = getLocalDb();
        const idx = db.workers.findIndex(w => w.id === worker.id);
        if (idx > -1) {
            db.workers[idx] = worker;
            saveLocalDb(db);
        }
    }
  },

  deleteWorker: async (id: string) => {
    if (supabase) await supabase.from('workers').delete().eq('id', id);
    else {
        const db = getLocalDb();
        db.workers = db.workers.filter(w => w.id !== id);
        saveLocalDb(db);
    }
  },

  // --- PRE-REGISTERED LISTS ---
  getJobRoles: async (): Promise<string[]> => {
      if (supabase) {
          const { data } = await supabase.from('job_roles').select('name').order('name');
          if (data && data.length > 0) return data.map(d => d.name);
      }
      return STANDARD_JOB_ROLES;
  },

  getSupplierCategories: async (): Promise<string[]> => {
      if (supabase) {
          const { data } = await supabase.from('supplier_categories').select('name').order('name');
          if (data && data.length > 0) return data.map(d => d.name);
      }
      return STANDARD_SUPPLIER_CATEGORIES;
  },
  
  // --- PHOTOS & FILES UPLOAD ---
  getPhotos: async (workId: string): Promise<WorkPhoto[]> => {
      if (supabase) {
          const { data } = await supabase.from('work_photos').select('*').eq('work_id', workId).order('created_at', { ascending: false });
          return (data || []).map(p => ({...p, workId: p.work_id, date: p.created_at}));
      } else {
          const db = getLocalDb();
          return db.photos.filter(p => p.workId === workId);
      }
  },

  uploadPhoto: async (workId: string, file: File, type: 'BEFORE' | 'AFTER' | 'PROGRESS'): Promise<WorkPhoto | null> => {
      if (supabase) {
          // 1. Upload
          const publicUrl = await uploadToBucket(file, `${workId}/photos`);
          if (!publicUrl) return null;

          // 2. Insert DB
          const { data, error } = await supabase.from('work_photos').insert({
              work_id: workId,
              url: publicUrl,
              type: type,
              description: file.name
          }).select().single();

          if (error || !data) return null;
          return { ...data, workId: data.work_id, date: data.created_at };
      } else {
          // Local fallback (Fake Upload)
          const db = getLocalDb();
          const newPhoto: WorkPhoto = {
              id: Math.random().toString(36).substr(2, 9),
              workId,
              url: URL.createObjectURL(file),
              type,
              description: file.name,
              date: new Date().toISOString()
          };
          db.photos.push(newPhoto);
          saveLocalDb(db);
          return newPhoto;
      }
  },

  deletePhoto: async (id: string) => {
      if (supabase) await supabase.from('work_photos').delete().eq('id', id);
      else {
          const db = getLocalDb();
          db.photos = db.photos.filter(p => p.id !== id);
          saveLocalDb(db);
      }
  },

  getFiles: async (workId: string): Promise<WorkFile[]> => {
      if (supabase) {
          const { data } = await supabase.from('work_files').select('*').eq('work_id', workId).order('created_at', { ascending: false });
          return (data || []).map(f => ({...f, workId: f.work_id, date: f.created_at, type: f.file_type}));
      } else {
          const db = getLocalDb();
          return db.files.filter(f => f.workId === workId);
      }
  },

  uploadFile: async (workId: string, file: File, category: string): Promise<WorkFile | null> => {
      if (supabase) {
          // 1. Upload
          const publicUrl = await uploadToBucket(file, `${workId}/files`);
          if (!publicUrl) return null;

          // 2. Insert DB
          const fileType = file.name.split('.').pop() || 'file';
          const { data, error } = await supabase.from('work_files').insert({
              work_id: workId,
              url: publicUrl,
              name: file.name,
              category: category,
              file_type: fileType
          }).select().single();

          if (error || !data) return null;
          return { ...data, workId: data.work_id, date: data.created_at, type: data.file_type };
      } else {
           const db = getLocalDb();
           const newFile: WorkFile = {
              id: Math.random().toString(36).substr(2, 9),
              workId,
              url: '#',
              name: file.name,
              category: category as any,
              type: 'pdf',
              date: new Date().toISOString()
           };
           db.files.push(newFile);
           saveLocalDb(db);
           return newFile;
      }
  },
  
  deleteFile: async (id: string) => {
      if (supabase) await supabase.from('work_files').delete().eq('id', id);
      else {
          const db = getLocalDb();
          db.files = db.files.filter(f => f.id !== id);
          saveLocalDb(db);
      }
  },

  // --- Notifications (Smart Logic) ---
  getNotifications: async (userId: string): Promise<Notification[]> => {
      const db = getLocalDb();
      return Promise.resolve(db.notifications.filter(n => n.userId === userId));
  },
  dismissNotification: async (id: string) => {
      const db = getLocalDb();
      db.notifications = db.notifications.filter(n => n.id !== id);
      saveLocalDb(db);
  },
  clearAllNotifications: async (userId: string) => {
      const db = getLocalDb();
      db.notifications = db.notifications.filter(n => n.userId !== userId);
      saveLocalDb(db);
  },
  generateSmartNotifications: async (userId: string, workId: string) => {
      const expenses = await dbService.getExpenses(workId);
      const steps = await dbService.getSteps(workId);
      const materials = await dbService.getMaterials(workId);
      const work = await dbService.getWorkById(workId);

      if (!work) return;
      
      const db = getLocalDb();
      const today = new Date().toISOString().split('T')[0];
      const lastCheckKey = `${NOTIFICATION_CHECK_KEY}_${workId}`;
      const lastCheck = localStorage.getItem(lastCheckKey);

      if (lastCheck === today) return; 

      // 1. Budget Check
      const totalSpent = expenses.reduce((acc, curr) => acc + (curr.paidAmount ?? curr.amount), 0);
      const percentage = work.budgetPlanned > 0 ? (totalSpent / work.budgetPlanned) : 0;
      
      if (percentage >= 0.8) {
           db.notifications.push({
              id: Math.random().toString(36).substr(2, 9),
              userId,
              title: 'Cuidado com o dinheiro',
              message: 'Você já usou quase tudo que planejou (80%).',
              type: 'WARNING',
              read: false,
              date: new Date().toISOString()
          });
      }
      
      const now = new Date();
      steps.forEach(step => {
          // 2. Delay Check
          if (step.status !== StepStatus.COMPLETED && new Date(step.endDate) < now) {
               db.notifications.push({
                      id: Math.random().toString(36).substr(2, 9),
                      userId,
                      title: 'Atraso detectado',
                      message: `A tarefa "${step.name}" está atrasada.`,
                      type: 'WARNING',
                      read: false,
                      date: new Date().toISOString()
               });
          }

          // 3. Upcoming Material Check (starts in <= 3 days)
          const daysUntilStart = Math.ceil((new Date(step.startDate).getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (daysUntilStart >= 0 && daysUntilStart <= 3 && step.status === StepStatus.NOT_STARTED) {
              const linkedMaterials = materials.filter(m => 
                 (m.stepId === step.id) || 
                 (m.category && step.name.toLowerCase().includes(m.category.toLowerCase()))
              );

              const missingMaterials = linkedMaterials.filter(m => m.purchasedQty < m.plannedQty);

              if (missingMaterials.length > 0) {
                  db.notifications.push({
                      id: Math.random().toString(36).substr(2, 9),
                      userId,
                      title: 'Compras Urgentes',
                      message: `A etapa "${step.name}" começa em breve e faltam ${missingMaterials.length} materiais.`,
                      type: 'WARNING',
                      read: false,
                      date: new Date().toISOString()
                  });
              }
          }
      });

      saveLocalDb(db);
      localStorage.setItem(lastCheckKey, today);
  },

  getDailySummary: async (workId: string) => {
      const steps = await dbService.getSteps(workId);
      const materials = await dbService.getMaterials(workId);
      
      const completed = steps.filter(s => s.status === StepStatus.COMPLETED).length;
      const now = new Date();
      const delayed = steps.filter(s => s.status !== StepStatus.COMPLETED && new Date(s.endDate) < now).length;
      const pendingMaterials = materials.filter(m => m.purchasedQty < m.plannedQty).length;
      
      return {
          completedSteps: completed,
          delayedSteps: delayed,
          pendingMaterials,
          totalSteps: steps.length
      };
  },

  calculateWorkStats: async (workId: string) => {
    const expenses = await dbService.getExpenses(workId);
    const steps = await dbService.getSteps(workId);
    
    const totalSpent = expenses.reduce((acc, curr) => acc + (curr.paidAmount ?? curr.amount), 0);
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const now = new Date();
    const delayedSteps = steps.filter(s => (s.status !== StepStatus.COMPLETED) && (new Date(s.endDate) < now)).length;
    
    return {
      totalSpent,
      progress: totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100),
      delayedSteps
    };
  }
};

## pages/WorkDetail.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Expense, Material, StepStatus, ExpenseCategory, PlanType, WorkPhoto, WorkFile } from '../types';
import { Recharts } from '../components/RechartsWrapper';
import { ZeModal } from '../components/ZeModal';
import { FULL_MATERIAL_PACKAGES, ZE_AVATAR, CALCULATOR_LOGIC, CONTRACT_TEMPLATES, STANDARD_CHECKLISTS } from '../services/standards';
import { useAuth } from '../App';
import { aiService } from '../services/ai';

// --- Shared Components ---

const SectionHeader: React.FC<{ title: string, subtitle: string }> = ({ title, subtitle }) => (
    <div className="mb-6 print:mb-2">
        <h2 className="text-2xl font-bold text-primary dark:text-white tracking-tight">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{subtitle}</p>
        <div className="h-1 w-10 bg-secondary rounded-full mt-3 print:hidden"></div>
    </div>
);

// ----------------------------------------------------------------------
// SUB-VIEWS FOR "MORE" TAB
// ----------------------------------------------------------------------

// 1. CONTACTS VIEW
const ContactsView: React.FC<{ mode: 'TEAM' | 'SUPPLIERS', onBack: () => void }> = ({ mode, onBack }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [options, setOptions] = useState<string[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState(''); 
    const [newPhone, setNewPhone] = useState('');

    const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

    const loadData = async () => {
        if(user) {
            setItems([]);
            if (mode === 'TEAM') {
                const [w, r] = await Promise.all([dbService.getWorkers(user.id), dbService.getJobRoles()]);
                setItems(w); setOptions(r);
            } else {
                const [s, c] = await Promise.all([dbService.getSuppliers(user.id), dbService.getSupplierCategories()]);
                setItems(s); setOptions(c);
            }
        }
    };
    useEffect(() => { loadData(); }, [user, mode]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(user) {
            if (editingId) {
                if (mode === 'TEAM') {
                    const currentItem = items.find(i => i.id === editingId);
                    if (currentItem) await dbService.updateWorker({ ...currentItem, name: newName, role: newRole, phone: newPhone });
                } else {
                    const currentItem = items.find(i => i.id === editingId);
                    if (currentItem) await dbService.updateSupplier({ ...currentItem, name: newName, category: newRole, phone: newPhone });
                }
            } else {
                if (mode === 'TEAM') await dbService.addWorker({ userId: user.id, name: newName, role: newRole, phone: newPhone });
                else await dbService.addSupplier({ userId: user.id, name: newName, category: newRole, phone: newPhone });
            }
            setIsAddOpen(false); setEditingId(null); setNewName(''); setNewRole(''); setNewPhone(''); loadData();
        }
    };

    const openEdit = (item: any) => {
        setEditingId(item.id);
        setNewName(item.name);
        setNewRole(item.role || item.category);
        setNewPhone(item.phone);
        setIsAddOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setZeModal({
            isOpen: true, title: "Remover", message: `Tem certeza?`,
            onConfirm: async () => {
                if (mode === 'TEAM') await dbService.deleteWorker(id); else await dbService.deleteSupplier(id);
                setZeModal(prev => ({...prev, isOpen: false})); loadData();
            }
        });
    }

    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <SectionHeader title={mode === 'TEAM' ? "Minha Equipe" : "Meus Fornecedores"} subtitle={mode === 'TEAM' ? "Profissionais cadastrados." : "Lojas e prestadores."} />
            <div className="space-y-3">
                {items.map(item => (
                    <div key={item.id} onClick={() => openEdit(item)} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:border-secondary transition-all">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${mode === 'TEAM' ? 'bg-blue-500' : 'bg-indigo-500'}`}><i className={`fa-solid ${mode === 'TEAM' ? 'fa-helmet-safety' : 'fa-truck'}`}></i></div>
                            <div><h4 className="font-bold text-primary dark:text-white">{item.name}</h4><p className="text-xs text-slate-500">{(item as any).role || (item as any).category}</p></div>
                        </div>
                        <div className="flex gap-2">
                             <a href={`https://wa.me/55${item.phone.replace(/\D/g,'')}`} target="_blank" onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"><i className="fa-brands fa-whatsapp"></i></a>
                             <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id); }} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><i className="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    </div>
                ))}
                {items.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum cadastro encontrado.</p>}
            </div>
            <button onClick={() => { setEditingId(null); setNewName(''); setNewRole(''); setNewPhone(''); setIsAddOpen(true); }} className="mt-6 w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg"><i className="fa-solid fa-plus mr-2"></i> Adicionar</button>
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">{editingId ? 'Editar Cadastro' : 'Novo Cadastro'}</h3>
                        <form onSubmit={handleSave} className="space-y-3">
                            <input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none" required />
                            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none" required>
                                <option value="">{mode === 'TEAM' ? "Selecione a Profissão" : "Selecione a Categoria"}</option>
                                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <input placeholder="Telefone" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none" required />
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
             <ZeModal isOpen={zeModal.isOpen} title={zeModal.title} message={zeModal.message} onConfirm={zeModal.onConfirm} onCancel={() => setZeModal({isOpen: false, title: '', message: '', onConfirm: () => {}})} />
        </div>
    );
};

// 2. PHOTOS VIEW
const PhotosView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const loadPhotos = async () => { const p = await dbService.getPhotos(workId); setPhotos(p); };
    useEffect(() => { loadPhotos(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadPhoto(workId, e.target.files[0], 'PROGRESS'); loadPhotos(); }};
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6"><SectionHeader title="Galeria" subtitle="Acompanhamento visual." /><label className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer"><i className="fa-solid fa-camera"></i><input type="file" className="hidden" accept="image/*" onChange={handleUpload} /></label></div>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{photos.map(p => (<div key={p.id} className="aspect-square rounded-xl overflow-hidden relative group"><img src={p.url} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><button onClick={async () => { await dbService.deletePhoto(p.id); loadPhotos(); }} className="text-white hover:text-red-400"><i className="fa-solid fa-trash"></i></button></div></div>))}</div>
             {photos.length === 0 && <p className="text-center text-slate-400 py-10">Nenhuma foto.</p>}
        </div>
    );
};

// 3. FILES VIEW
const FilesView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [files, setFiles] = useState<WorkFile[]>([]);
    const loadFiles = async () => { const f = await dbService.getFiles(workId); setFiles(f); };
    useEffect(() => { loadFiles(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadFile(workId, e.target.files[0], 'Geral'); loadFiles(); }};
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6"><SectionHeader title="Projetos" subtitle="Plantas e documentos." /><label className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer"><i className="fa-solid fa-upload"></i><input type="file" className="hidden" onChange={handleUpload} /></label></div>
             <div className="space-y-3">{files.map(f => (<div key={f.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-xl"><i className="fa-solid fa-file-pdf"></i></div><div><h4 className="font-bold text-sm text-primary dark:text-white truncate max-w-[150px]">{f.name}</h4><p className="text-xs text-slate-500">{new Date(f.date).toLocaleDateString()}</p></div></div><div className="flex gap-3"><a href={f.url} target="_blank" className="text-secondary font-bold text-sm">Abrir</a><button onClick={async () => { await dbService.deleteFile(f.id); loadFiles(); }} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button></div></div>))}</div>
             {files.length === 0 && <p className="text-center text-slate-400 py-10">Nenhum arquivo.</p>}
        </div>
    );
};

// 4. REPORTS VIEW
const ReportsView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'MATERIALS' | 'STEPS'>('FINANCIAL');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [work, setWork] = useState<Work | undefined>();
    useEffect(() => {
        const loadAll = async () => { const [exp, mat, stp, w] = await Promise.all([dbService.getExpenses(workId), dbService.getMaterials(workId), dbService.getSteps(workId), dbService.getWorkById(workId)]); setExpenses(exp); setMaterials(mat); setSteps(stp.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())); setWork(w); }; loadAll();
    }, [workId]);
    const handlePrint = () => { window.print(); };
    // Calculations
    const financialData = expenses.reduce((acc: any[], curr) => { const existing = acc.find((a: any) => a.name === curr.category); if (existing) existing.value += curr.amount; else acc.push({ name: curr.category, value: curr.amount }); return acc; }, []);
    const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0); const totalPaid = expenses.reduce((acc, e) => acc + (e.paidAmount || 0), 0); const totalPending = totalSpent - totalPaid;
    const purchasedMaterials = materials.filter(m => m.purchasedQty >= m.plannedQty).length; const materialChartData = [{ name: 'Comprado', value: purchasedMaterials, fill: '#059669' }, { name: 'Pendente', value: materials.length - purchasedMaterials, fill: '#E2E8F0' }];
    const groupedMaterials: Record<string, Material[]> = {}; materials.forEach(m => { const cat = m.category || 'Geral'; if (!groupedMaterials[cat]) groupedMaterials[cat] = []; groupedMaterials[cat].push(m); });
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length; const delayedSteps = steps.filter(s => s.isDelayed).length; const totalSteps = steps.length;

    return (
        <div className="animate-in fade-in slide-in-from-right-4 bg-white dark:bg-slate-950 min-h-screen">
             <div className="hidden print:block mb-8 border-b-2 border-black pb-4"><h1 className="text-3xl font-bold uppercase">{work?.name || "Relatório"}</h1><p className="text-sm">Endereço: {work?.address}</p></div>
             <div className="flex justify-between items-center mb-6 print:hidden"><button onClick={onBack} className="text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button><div className="flex gap-2"><button onClick={handlePrint} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2"><i className="fa-solid fa-print"></i> PDF</button></div></div>
             <SectionHeader title="Relatórios Inteligentes" subtitle="Analise cada detalhe da sua obra." />
             <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6 print:hidden">{[{ id: 'FINANCIAL', label: 'Financeiro', icon: 'fa-wallet' }, { id: 'MATERIALS', label: 'Compras', icon: 'fa-cart-shopping' }, { id: 'STEPS', label: 'Etapas', icon: 'fa-list-check' }].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><i className={`fa-solid ${tab.icon}`}></i> {tab.label}</button>))}</div>
             {activeTab === 'FINANCIAL' && (<div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Total Gasto</p><p className="text-2xl font-bold text-primary dark:text-white">R$ {totalSpent.toLocaleString('pt-BR')}</p></div><div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Valor Pago</p><p className="text-2xl font-bold text-green-600">R$ {totalPaid.toLocaleString('pt-BR')}</p></div><div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">A Pagar</p><p className="text-2xl font-bold text-red-500">R$ {totalPending.toLocaleString('pt-BR')}</p></div></div><div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"><div className="h-64"><Recharts.ResponsiveContainer width="100%" height="100%"><Recharts.BarChart data={financialData}><Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} /><Recharts.XAxis dataKey="name" tick={{fontSize: 10}} /><Recharts.YAxis /><Recharts.Tooltip /><Recharts.Bar dataKey="value" fill="#D97706" radius={[6, 6, 0, 0]} barSize={40} /></Recharts.BarChart></Recharts.ResponsiveContainer></div></div><div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"><h3 className="font-bold mb-4 dark:text-white">Extrato Detalhado</h3><table className="w-full text-sm text-left"><thead><tr className="border-b dark:border-slate-700 text-slate-500"><th className="py-2 font-bold">Data</th><th className="py-2 font-bold">Descrição</th><th className="py-2 font-bold">Categoria</th><th className="py-2 font-bold text-right">Valor</th></tr></thead><tbody>{expenses.map(e => (<tr key={e.id} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"><td className="py-3 text-slate-500">{new Date(e.date).toLocaleDateString()}</td><td className="py-3 font-medium dark:text-slate-300">{e.description}</td><td className="py-3 text-xs"><span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{e.category}</span></td><td className="py-3 text-right font-bold dark:text-white">R$ {e.amount.toLocaleString('pt-BR')}</td></tr>))}</tbody></table></div></div>)}
             {activeTab === 'MATERIALS' && (<div className="space-y-6 animate-in fade-in"><div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center"><div className="w-40 h-40 relative"><Recharts.ResponsiveContainer width="100%" height="100%"><Recharts.PieChart><Recharts.Pie data={materialChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" cornerRadius={5} /></Recharts.PieChart></Recharts.ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-primary dark:text-white">{purchasedMaterials}</span><span className="text-[10px] text-slate-400 uppercase">Comprados</span></div></div></div><div className="space-y-4">{Object.keys(groupedMaterials).sort().map(cat => (<div key={cat} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 break-inside-avoid"><h4 className="font-bold text-primary dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">{cat}</h4><div className="grid grid-cols-1 gap-3">{groupedMaterials[cat].map(m => (<div key={m.id} className="flex items-center gap-4 text-sm"><div className={`w-2 h-2 rounded-full ${m.purchasedQty >= m.plannedQty ? 'bg-green-500' : 'bg-slate-300'}`}></div><div className="flex-1"><div className="flex justify-between mb-1"><span className="font-medium dark:text-slate-200">{m.name}</span><span className="text-slate-500 text-xs">{m.purchasedQty} / {m.plannedQty} {m.unit}</span></div></div></div>))}</div></div>))}</div></div>)}
             {activeTab === 'STEPS' && (<div className="space-y-6 animate-in fade-in"><div className="flex gap-4 mb-4 overflow-x-auto pb-2"><div className="flex-1 min-w-[120px] bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-900/30 text-center"><p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedSteps}</p><p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Concluídas</p></div><div className="flex-1 min-w-[120px] bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center"><p className="text-2xl font-bold text-red-600 dark:text-red-400">{delayedSteps}</p><p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase">Atrasadas</p></div><div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{totalSteps}</p><p className="text-xs font-bold text-slate-500 uppercase">Total Etapas</p></div></div><div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden"><div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 font-bold text-sm text-slate-500 flex justify-between"><span>Etapa</span><span>Status & Prazo</span></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{steps.map(step => { const isDone = step.status === StepStatus.COMPLETED; const isLate = !isDone && step.isDelayed; return (<div key={step.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors break-inside-avoid"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white ${isDone ? 'bg-green-500' : isLate ? 'bg-red-500' : 'bg-slate-300'}`}><i className={`fa-solid ${isDone ? 'fa-check' : isLate ? 'fa-exclamation' : 'fa-clock'}`}></i></div><div><p className={`font-bold text-sm ${isDone ? 'text-slate-400 line-through' : 'text-primary dark:text-white'}`}>{step.name}</p><p className="text-xs text-slate-400">Previsto: {new Date(step.startDate).toLocaleDateString()}</p></div></div><div className="text-right">{isLate && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Atrasado</span>}{isDone && <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Feito</span>}{!isLate && !isDone && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Em andamento</span>}</div></div>)})}</div></div></div>)}
        </div>
    );
};

// 5. CALCULATOR VIEW
const CalculatorView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [mode, setMode] = useState<'MENU' | 'FLOOR' | 'WALL' | 'PAINT' | 'ESTIMATOR'>('MENU');
    const [area, setArea] = useState(0);
    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0);
    const [rooms, setRooms] = useState(0);
    const [baths, setBaths] = useState(0);

    const ResultCard: React.FC<{ label: string, value: string, sub?: string }> = ({ label, value, sub }) => (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
            <p className="text-3xl font-extrabold text-secondary mb-1">{value}</p>
            {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
    );

    const renderContent = () => {
        if (mode === 'FLOOR') { const res = CALCULATOR_LOGIC.FLOOR(area); return (<div className="animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-primary dark:text-white mb-4">Pisos</h3><div className="mb-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase">Área Total (m²)</label><input type="number" className="w-full text-3xl font-bold bg-transparent outline-none text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-2 focus:border-secondary transition-colors" placeholder="0" onChange={e => setArea(Number(e.target.value))}/></div><div className="grid grid-cols-1 gap-4"><ResultCard label="Piso" value={`${res.tiles} m²`} sub="+10% Perda" /><ResultCard label="Argamassa" value={`${res.mortar} sc`} sub="20kg" /><ResultCard label="Rejunte" value={`${res.grout} kg`} /></div></div>); }
        if (mode === 'WALL') { const res = CALCULATOR_LOGIC.WALL(width, height); return (<div className="animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-primary dark:text-white mb-4">Paredes</h3><div className="grid grid-cols-2 gap-4 mb-6"><div><label className="text-xs font-bold text-slate-500 uppercase">Largura</label><input type="number" className="w-full text-2xl font-bold bg-transparent border-b border-slate-200 dark:border-slate-700 dark:text-white outline-none" onChange={e => setWidth(Number(e.target.value))} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Altura</label><input type="number" className="w-full text-2xl font-bold bg-transparent border-b border-slate-200 dark:border-slate-700 dark:text-white outline-none" onChange={e => setHeight(Number(e.target.value))} /></div></div><div className="grid grid-cols-1 gap-4"><ResultCard label="Tijolos" value={`${res.bricks} un`} /><ResultCard label="Cimento" value={`${res.cement} sc`} /><ResultCard label="Areia" value={`${res.sand} m³`} /></div></div>); }
        if (mode === 'PAINT') { const res = CALCULATOR_LOGIC.PAINT(area); return (<div className="animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-primary dark:text-white mb-4">Pintura</h3><div className="mb-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase">Área Parede (m²)</label><input type="number" className="w-full text-3xl font-bold bg-transparent outline-none text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-2" placeholder="0" onChange={e => setArea(Number(e.target.value))}/></div><div className="grid grid-cols-1 gap-4"><ResultCard label="Tinta 18L" value={`${res.cans18} un`} /><ResultCard label="Massa" value={`${res.spackle} lt`} /><ResultCard label="Selador" value={`${res.sealer} lt`} /></div></div>); }
        if (mode === 'ESTIMATOR') { const res = CALCULATOR_LOGIC.ESTIMATOR(baths, rooms); return (<div className="animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-primary dark:text-white mb-4">Estimativa</h3><div className="grid grid-cols-2 gap-4 mb-6"><div><label className="text-xs font-bold text-slate-500 uppercase">Cômodos</label><input type="number" className="w-full text-2xl font-bold bg-transparent border-b outline-none dark:text-white" onChange={e => setRooms(Number(e.target.value))} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">Banheiros</label><input type="number" className="w-full text-2xl font-bold bg-transparent border-b outline-none dark:text-white" onChange={e => setBaths(Number(e.target.value))} /></div></div><div className="space-y-4"><ResultCard label="Tomadas/Interruptores" value={`${res.outlets + res.switches} un`} /><ResultCard label="Pontos Hidráulicos" value={`${res.toilets + res.sinks} un`} /></div></div>); }
        
        return (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
                {[{ id: 'FLOOR', label: 'Pisos', icon: 'fa-layer-group', color: 'bg-emerald-500' }, { id: 'WALL', label: 'Paredes', icon: 'fa-cubes-stacked', color: 'bg-orange-500' }, { id: 'PAINT', label: 'Pintura', icon: 'fa-paint-roller', color: 'bg-blue-500' }, { id: 'ESTIMATOR', label: 'Estimativa', icon: 'fa-calculator', color: 'bg-purple-500' }].map(item => (
                    <button key={item.id} onClick={() => setMode(item.id as any)} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3 shadow-lg ${item.color}`}><i className={`fa-solid ${item.icon} text-2xl`}></i></div><span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-white">{item.label}</span></button>
                ))}
            </div>
        );
    };
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={mode === 'MENU' ? onBack : () => setMode('MENU')} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> {mode === 'MENU' ? 'Voltar' : 'Outras Calculadoras'}</button>
            <SectionHeader title="Calculadora Premium" subtitle="Estimativas precisas para sua obra." />
            {renderContent()}
        </div>
    );
};

// 6. CONTRACTS VIEW
const ContractsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [selectedContract, setSelectedContract] = useState<any | null>(null);
    const [editableContent, setEditableContent] = useState('');
    const handleSelect = (contract: any) => { setSelectedContract(contract); setEditableContent(contract.contentTemplate); };
    const handleDownload = () => {
        const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${selectedContract.title}</title></head><body style="font-family: Arial; white-space: pre-wrap;">${editableContent}</body></html>`;
        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `${selectedContract.title}.doc`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };
    if (selectedContract) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 h-full flex flex-col">
                <button onClick={() => setSelectedContract(null)} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-primary dark:text-white">{selectedContract.title}</h2><button onClick={handleDownload} className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><i className="fa-solid fa-download"></i> Baixar .doc</button></div>
                <textarea className="flex-1 w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-sm font-mono leading-relaxed outline-none resize-none focus:ring-2 focus:ring-secondary/50" value={editableContent} onChange={(e) => setEditableContent(e.target.value)} />
            </div>
        );
    }
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <SectionHeader title="Contratos" subtitle="Modelos editáveis." />
            <div className="grid grid-cols-1 gap-3">{CONTRACT_TEMPLATES.map(ct => (<button key={ct.id} onClick={() => handleSelect(ct)} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary transition-all text-left shadow-sm group"><div className="flex items-start gap-4"><div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform"><i className="fa-solid fa-file-contract"></i></div><div><h4 className="font-bold text-primary dark:text-white mb-1 group-hover:text-secondary transition-colors">{ct.title}</h4><p className="text-xs text-slate-500">{ct.description}</p></div></div></button>))}</div>
        </div>
    );
};

// 7. CHECKLISTS VIEW (NEW BONUS)
const ChecklistsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2 print:hidden"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <div className="flex justify-between items-center mb-6"><SectionHeader title="Checklists Anti-Erro" subtitle="O que verificar para evitar prejuízo." /><button onClick={() => window.print()} className="bg-slate-100 dark:bg-slate-800 text-slate-500 w-10 h-10 rounded-xl flex items-center justify-center print:hidden"><i className="fa-solid fa-print"></i></button></div>
            <div className="space-y-4">
                {STANDARD_CHECKLISTS.map((list, idx) => {
                    const isOpen = openCategory === list.category;
                    return (
                        <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden print:border-black print:break-inside-avoid">
                            <button onClick={() => setOpenCategory(isOpen ? null : list.category)} className="w-full flex items-center justify-between p-5 text-left bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-sm"><i className="fa-solid fa-list-check"></i></div><h4 className="font-bold text-primary dark:text-white">{list.category}</h4></div><i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                            {(isOpen || window.matchMedia('print').matches) && (<div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800"><div className="space-y-4 mt-4">{list.items.map((item, i) => (<label key={i} className="flex items-start gap-3 cursor-pointer group"><input type="checkbox" className="mt-1 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary" /><span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed group-hover:text-primary dark:group-hover:text-white transition-colors">{item}</span></label>))}</div></div>)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- More / Super Menu Tab ---
const MoreMenuTab: React.FC<{ workId: string }> = ({ workId }) => {
    const { user } = useAuth();
    const isLifetime = user?.plan === PlanType.VITALICIO;
    const [activeSection, setActiveSection] = useState<string | null>(null);

    if (activeSection === 'TEAM') return <ContactsView mode="TEAM" onBack={() => setActiveSection(null)} />;
    if (activeSection === 'SUPPLIERS') return <ContactsView mode="SUPPLIERS" onBack={() => setActiveSection(null)} />;
    if (activeSection === 'PHOTOS') return <PhotosView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'FILES') return <FilesView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'REPORTS') return <ReportsView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'CALC') return <CalculatorView onBack={() => setActiveSection(null)} />;
    if (activeSection === 'CONTRACTS') return <ContractsView onBack={() => setActiveSection(null)} />;
    if (activeSection === 'CHECKLISTS') return <ChecklistsView onBack={() => setActiveSection(null)} />;
    
    if (activeSection === 'AI') {
        return (
            <div className="flex flex-col h-full"><button onClick={() => setActiveSection(null)} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button><div className="flex-1 flex flex-col items-center justify-center text-center p-6"><div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mb-4"><i className="fa-solid fa-robot text-4xl text-secondary"></i></div><h3 className="text-xl font-bold text-primary dark:text-white mb-2">IA do Zé da Obra</h3><p className="text-slate-500 mb-6">Seu assistente está disponível no ícone de robô no topo da tela.</p></div></div>
        )
    }

    const sections = [{ id: 'TEAM', icon: 'fa-users', label: 'Equipe', color: 'bg-blue-500' }, { id: 'SUPPLIERS', icon: 'fa-truck', label: 'Fornecedores', color: 'bg-indigo-500' }, { id: 'REPORTS', icon: 'fa-chart-line', label: 'Relatórios', color: 'bg-emerald-500' }, { id: 'PHOTOS', icon: 'fa-camera', label: 'Galeria', color: 'bg-rose-500' }, { id: 'FILES', icon: 'fa-folder-open', label: 'Projetos', color: 'bg-orange-500' }];
    const bonusFeatures = [{ id: 'AI', icon: 'fa-robot', label: 'IA do Zé da Obra', desc: 'Tire dúvidas 24h' }, { id: 'CALC', icon: 'fa-calculator', label: 'Calculadora', desc: 'Estimativa de material' }, { id: 'CONTRACTS', icon: 'fa-file-signature', label: 'Contratos', desc: 'Modelos prontos' }, { id: 'CHECKLISTS', icon: 'fa-list-check', label: 'Checklists', desc: 'Não esqueça nada' }];

    return (
        <div className="animate-in fade-in duration-500 pb-24">
            <SectionHeader title="Mais Opções" subtitle="Gestão completa e ferramentas." />
            <div className="grid grid-cols-3 gap-3 mb-8">{sections.map(s => (<button key={s.id} onClick={() => setActiveSection(s.id)} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-95"><div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg ${s.color}`}><i className={`fa-solid ${s.icon}`}></i></div><span className="text-xs font-bold text-slate-600 dark:text-slate-300">{s.label}</span></button>))}</div>
            <div className={`relative rounded-3xl p-6 overflow-hidden ${isLifetime ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {!isLifetime && (<div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-6"><i className="fa-solid fa-lock text-3xl text-slate-400 mb-3"></i><h3 className="font-bold text-primary dark:text-white mb-1">Bônus Exclusivo</h3><p className="text-xs text-slate-500 mb-4">Disponível no Plano Vitalício</p><button onClick={() => window.location.hash = '#/settings'} className="bg-premium text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-purple-500/20 text-sm">Liberar Acesso</button></div>)}
                <div className="relative z-0"><div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-crown"></i></div><div><h3 className={`font-bold ${isLifetime ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>Ferramentas Premium</h3><p className={`text-xs ${isLifetime ? 'text-slate-400' : 'text-slate-500'}`}>Incluso no seu plano</p></div></div><div className="grid grid-cols-2 gap-3">{bonusFeatures.map(f => (<button key={f.id} onClick={() => { if(isLifetime) setActiveSection(f.id); }} className={`p-4 rounded-xl text-left transition-all ${isLifetime ? 'bg-white/10 hover:bg-white/20 border border-white/5' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}><i className={`fa-solid ${f.icon} text-xl mb-2 ${isLifetime ? 'text-secondary' : 'text-slate-400'}`}></i><h4 className={`font-bold text-sm mb-0.5 ${isLifetime ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{f.label}</h4><p className={`text-[10px] leading-tight ${isLifetime ? 'text-slate-400' : 'text-slate-400'}`}>{f.desc}</p></button>))}</div></div>
            </div>
        </div>
    );
}

// --- MAIN DETAIL COMPONENT ---
const WorkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [work, setWork] = useState<Work | null>(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, steps, materials, expenses, more
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });
  const [loading, setLoading] = useState(true);
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiHistory, setAiHistory] = useState<{sender: 'user'|'ze', text: string}[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const loadWork = async () => { if (!id) return; setLoading(true); const w = await dbService.getWorkById(id); if (w) { setWork(w); const s = await dbService.calculateWorkStats(id); setStats(s); } setLoading(false); };
  useEffect(() => { loadWork(); }, [id]);

  const handleAiSend = async (e: React.FormEvent) => { e.preventDefault(); if (!aiMessage.trim()) return; const userMsg = aiMessage; setAiHistory(prev => [...prev, { sender: 'user', text: userMsg }]); setAiMessage(''); setAiLoading(true); const response = await aiService.sendMessage(userMsg); setAiHistory(prev => [...prev, { sender: 'ze', text: response }]); setAiLoading(false); };

  if (loading) return (<div className="min-h-screen flex items-center justify-center text-secondary"><i className="fa-solid fa-circle-notch fa-spin text-3xl"></i></div>);
  if (!work) return (<div className="min-h-screen flex flex-col items-center justify-center p-4 text-center"><h2 className="text-xl font-bold text-slate-500 mb-4">Obra não encontrada</h2><button onClick={() => navigate('/')} className="text-primary hover:underline">Voltar ao Painel</button></div>);

  return (
      <div className="min-h-screen pb-24">
          <div className="sticky top-0 z-30 bg-surface/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex justify-between items-center"><div className="flex items-center gap-3"><button onClick={() => navigate('/')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i className="fa-solid fa-arrow-left"></i></button><h1 className="font-bold text-primary dark:text-white truncate max-w-[200px]">{work.name}</h1></div><button onClick={() => setShowAiChat(true)} className="bg-secondary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20"><i className="fa-solid fa-robot text-xs"></i></button></div>
          <div className="max-w-4xl mx-auto p-4 md:p-6">
              {activeTab === 'overview' && <OverviewTab work={work} stats={stats} onGoToSteps={() => setActiveTab('steps')} />}
              {activeTab === 'steps' && <StepsTab workId={work.id} refreshWork={loadWork} />}
              {activeTab === 'materials' && <MaterialsTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'expenses' && <ExpensesTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'more' && <MoreMenuTab workId={work.id} />}
          </div>
          <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-6 flex justify-between items-center z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">{[{ id: 'overview', icon: 'fa-house', label: 'Geral' }, { id: 'steps', icon: 'fa-calendar-days', label: 'Cronograma' }, { id: 'materials', icon: 'fa-cart-shopping', label: 'Materiais' }, { id: 'expenses', icon: 'fa-wallet', label: 'Gastos' }, { id: 'more', icon: 'fa-bars', label: 'Mais' }].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300 ${activeTab === tab.id ? 'text-secondary -translate-y-2' : 'text-slate-400 hover:text-slate-600'}`}><div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-all ${activeTab === tab.id ? 'bg-secondary text-white shadow-lg shadow-orange-500/30' : ''}`}><i className={`fa-solid ${tab.icon}`}></i></div><span className={`text-[10px] font-bold ${activeTab === tab.id ? 'opacity-100' : 'opacity-0'}`}>{tab.label}</span></button>))}</div>
          {showAiChat && (<div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-bottom duration-300 md:max-w-md md:right-4 md:bottom-20 md:left-auto md:top-auto md:h-[600px] md:rounded-3xl md:shadow-2xl md:border md:border-slate-200"><div className="p-4 bg-primary text-white flex justify-between items-center shrink-0 md:rounded-t-3xl"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/10 p-1"><img src={ZE_AVATAR} className="w-full h-full object-cover rounded-full" /></div><div><h3 className="font-bold text-sm">Zé da Obra</h3><p className="text-[10px] text-green-300 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span> Online</p></div></div><button onClick={() => setShowAiChat(false)} className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"><i className="fa-solid fa-xmark"></i></button></div><div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-black/20">{aiHistory.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-6"><i className="fa-solid fa-comments text-4xl mb-3"></i><p className="text-sm font-medium">"Fala chefe! Tô aqui pra ajudar."</p></div>)}{aiHistory.map((msg, i) => (<div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none shadow-sm'}`}>{msg.text}</div></div>))}{aiLoading && (<div className="flex justify-start"><div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm"><div className="flex gap-1.5"><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span></div></div></div>)}</div><form onSubmit={handleAiSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0 md:rounded-b-3xl"><input className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary/50 outline-none dark:text-white" placeholder="Digite sua dúvida..." value={aiMessage} onChange={e => setAiMessage(e.target.value)} /><button type="submit" disabled={!aiMessage.trim() || aiLoading} className="w-12 h-12 rounded-xl bg-secondary text-white flex items-center justify-center hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><i className="fa-solid fa-paper-plane"></i></button></form></div>)}
      </div>
  );
};

export default WorkDetail;
