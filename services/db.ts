
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
    { id: '1', name: 'Usuário Demo', email: 'demo@maos.com', whatsapp: '(11) 99999-9999', plan: PlanType.MENSAL, subscriptionExpiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() }
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

// --- ENGINE: CONSTRUCTION PLAN GENERATOR (ENGENHEIRO VIRTUAL 2.0) ---
interface PlanItem {
    stepName: string;
    duration: number;
    startOffset: number; // Dias após o início da obra
    materials: { name: string, unit: string, qty: number, category: string }[];
}

const generateConstructionPlan = (totalArea: number, floors: number): PlanItem[] => {
    const plan: PlanItem[] = [];
    const footprint = totalArea / Math.max(1, floors); // Área por pavimento (projeção no chão)
    let currentDay = 0;

    // 1. SERVIÇOS PRELIMINARES
    plan.push({
        stepName: "Serviços Preliminares (Canteiro)",
        duration: 5,
        startOffset: currentDay,
        materials: [
            { category: 'Preparação', name: 'Tapume (Madeirite)', unit: 'chapas', qty: Math.ceil(Math.sqrt(footprint) * 4 / 2) }, // Perímetro estimado
            { category: 'Preparação', name: 'Sarrasfo 2.5cm', unit: 'dz', qty: 2 },
            { category: 'Preparação', name: 'Prego 17x21', unit: 'kg', qty: 2 },
            { category: 'Preparação', name: 'Ligação Provisória Água/Luz', unit: 'vb', qty: 1 },
        ]
    });
    currentDay += 5;

    // 2. FUNDAÇÃO (Considerando área do footprint)
    plan.push({
        stepName: "Fundação e Baldrames",
        duration: 20,
        startOffset: currentDay,
        materials: [
            { category: 'Fundação', name: 'Cimento CP-II (Concreto)', unit: 'sacos', qty: Math.ceil(footprint * 0.8) },
            { category: 'Fundação', name: 'Areia Média/Grossa', unit: 'm³', qty: Math.ceil(footprint * 0.08) },
            { category: 'Fundação', name: 'Brita 1', unit: 'm³', qty: Math.ceil(footprint * 0.08) },
            { category: 'Fundação', name: 'Pedra de Mão (Rachão)', unit: 'm³', qty: Math.ceil(footprint * 0.04) },
            { category: 'Fundação', name: 'Vergalhão 3/8 (10mm)', unit: 'barras', qty: Math.ceil(footprint * 0.6) },
            { category: 'Fundação', name: 'Vergalhão 5/16 (8mm)', unit: 'barras', qty: Math.ceil(footprint * 0.4) },
            { category: 'Fundação', name: 'Estribos 4.2mm (Prontos)', unit: 'un', qty: Math.ceil(footprint * 4) },
            { category: 'Fundação', name: 'Tábua de Pinus 30cm (Caixaria)', unit: 'dz', qty: Math.ceil(footprint / 15) },
            { category: 'Fundação', name: 'Impermeabilizante Betuminoso', unit: 'latas', qty: Math.ceil(footprint / 12) },
        ]
    });
    currentDay += 20;

    // 3. ESTRUTURA E ALVENARIA (Loop por Andar)
    for (let i = 0; i < floors; i++) {
        const floorLabel = i === 0 ? "Térreo" : `${i}º Pavimento`;
        
        // A. Paredes e Colunas
        plan.push({
            stepName: `Estrutura e Alvenaria (${floorLabel})`,
            duration: 25,
            startOffset: currentDay,
            materials: [
                { category: 'Alvenaria', name: `Tijolo/Bloco (${floorLabel})`, unit: 'milheiro', qty: Math.ceil((footprint * 3 * 25) / 1000) }, // Pé direito 3m
                { category: 'Alvenaria', name: 'Cimento (Assentamento)', unit: 'sacos', qty: Math.ceil(footprint * 0.25) },
                { category: 'Alvenaria', name: 'Cal Hidratada', unit: 'sacos', qty: Math.ceil(footprint * 0.3) },
                { category: 'Alvenaria', name: 'Areia Média', unit: 'm³', qty: Math.ceil(footprint * 0.05) },
                { category: 'Estrutura', name: 'Ferro 3/8 (Colunas/Vigas)', unit: 'barras', qty: Math.ceil(footprint * 0.4) },
                { category: 'Estrutura', name: 'Ferro 5/16 (Complemento)', unit: 'barras', qty: Math.ceil(footprint * 0.2) },
                { category: 'Estrutura', name: 'Tábua de Pinus (Vigas)', unit: 'dz', qty: Math.ceil(footprint / 20) },
            ]
        });
        currentDay += 25;

        // B. Laje (Se não for telhado direto, ou seja, sempre tem laje, seja de piso ou forro)
        plan.push({
            stepName: `Laje (${floorLabel})`,
            duration: 15,
            startOffset: currentDay,
            materials: [
                { category: 'Estrutura', name: `Vigota Trilho (${floorLabel})`, unit: 'm', qty: Math.ceil(footprint * 3.2) },
                { category: 'Estrutura', name: `Isopor/Lajota (${floorLabel})`, unit: 'un', qty: Math.ceil(footprint * 3.5) },
                { category: 'Estrutura', name: 'Malha Pop 15x15', unit: 'un', qty: Math.ceil(footprint / 8) }, // Tamanho padrão tela
                { category: 'Estrutura', name: 'Concreto Usinado FCK25', unit: 'm³', qty: Math.ceil(footprint * 0.1) }, // Capa de 5-7cm + vigotas
                { category: 'Estrutura', name: 'Escoras de Eucalipto', unit: 'dz', qty: Math.ceil(footprint / 12) },
                { category: 'Elétrica', name: 'Caixas de Luz de Laje (Octogonal)', unit: 'un', qty: Math.ceil(footprint / 15) },
                { category: 'Elétrica', name: 'Eletroduto Corrugado (Laje)', unit: 'rolos', qty: Math.ceil(footprint / 40) },
            ]
        });
        currentDay += 15;
    }

    // 4. TELHADO E COBERTURA
    plan.push({
        stepName: "Telhado e Cobertura",
        duration: 20,
        startOffset: currentDay,
        materials: [
            { category: 'Telhado', name: 'Madeiramento (Vigas/Caibros)', unit: 'm³', qty: Math.ceil(footprint * 0.04) }, // Estimativa cubica
            { category: 'Telhado', name: 'Telhas (Cerâmica/Concreto)', unit: 'milheiro', qty: Math.ceil((footprint * 1.4 * 16) / 1000) }, // Inclinação 40%
            { category: 'Telhado', name: 'Caixa D\'água 1000L', unit: 'un', qty: 1 },
            { category: 'Telhado', name: 'Calhas e Rufos', unit: 'm', qty: Math.ceil(Math.sqrt(footprint) * 2) },
            { category: 'Telhado', name: 'Manta Térmica', unit: 'rolos', qty: Math.ceil(footprint / 45) },
        ]
    });
    // Não incrementamos full time pois instalações começam em paralelo
    currentDay += 10; 

    // 5. INSTALAÇÕES (RASGOS E TUBULAÇÕES)
    plan.push({
        stepName: "Instalações (Elétrica e Hidráulica)",
        duration: 20,
        startOffset: currentDay,
        materials: [
            { category: 'Hidráulica', name: 'Tubos PVC 25mm (Água Fria)', unit: 'barras', qty: Math.ceil(totalArea / 8) },
            { category: 'Hidráulica', name: 'Tubos Esgoto 100mm', unit: 'barras', qty: Math.ceil(floors * 3) },
            { category: 'Hidráulica', name: 'Tubos Esgoto 40mm/50mm', unit: 'barras', qty: Math.ceil(totalArea / 10) },
            { category: 'Hidráulica', name: 'Conexões Diversas (Kit)', unit: 'vb', qty: 1 },
            { category: 'Hidráulica', name: 'Registros de Gaveta', unit: 'un', qty: Math.ceil(floors * 2) },
            { category: 'Elétrica', name: 'Eletroduto Flexível (Parede)', unit: 'rolos', qty: Math.ceil(totalArea / 20) },
            { category: 'Elétrica', name: 'Caixinhas 4x2', unit: 'un', qty: Math.ceil(totalArea / 8) },
            { category: 'Elétrica', name: 'Quadro de Distribuição', unit: 'un', qty: floors },
        ]
    });
    currentDay += 20;

    // 6. REBOCO E CONTRAPISO
    plan.push({
        stepName: "Reboco e Contrapiso",
        duration: 30,
        startOffset: currentDay,
        materials: [
            { category: 'Alvenaria', name: 'Cimento (Reboco/Piso)', unit: 'sacos', qty: Math.ceil(totalArea * 0.4) }, // Parede interna/externa + piso
            { category: 'Alvenaria', name: 'Areia Fina/Média', unit: 'm³', qty: Math.ceil(totalArea * 0.1) },
            { category: 'Alvenaria', name: 'Cal Hidratada', unit: 'sacos', qty: Math.ceil(totalArea * 0.3) },
            { category: 'Alvenaria', name: 'Aditivo (Vedalit/Similar)', unit: 'litros', qty: Math.ceil(totalArea / 20) },
        ]
    });
    currentDay += 30;

    // 7. ACABAMENTO FINO (PISO)
    plan.push({
        stepName: "Pisos e Revestimentos",
        duration: 25,
        startOffset: currentDay,
        materials: [
            { category: 'Acabamento', name: 'Piso Cerâmico/Porcelanato', unit: 'm²', qty: Math.ceil(totalArea * 1.15) }, // +15% quebra/rodapé
            { category: 'Acabamento', name: 'Revestimento Parede (Banheiro/Cozinha)', unit: 'm²', qty: Math.ceil(totalArea * 0.4) }, 
            { category: 'Acabamento', name: 'Argamassa AC-II/AC-III', unit: 'sacos', qty: Math.ceil(totalArea * 1.55 / 4) }, // ~4m2 por saco
            { category: 'Acabamento', name: 'Rejunte', unit: 'kg', qty: Math.ceil(totalArea / 8) },
            { category: 'Acabamento', name: 'Niveladores de Piso', unit: 'pct', qty: Math.ceil(totalArea / 30) },
        ]
    });
    currentDay += 25;

    // 8. PINTURA E FINALIZAÇÃO
    plan.push({
        stepName: "Pintura e Entrega",
        duration: 20,
        startOffset: currentDay,
        materials: [
            { category: 'Pintura', name: 'Massa Corrida/Acrílica', unit: 'latas', qty: Math.ceil(totalArea / 12) },
            { category: 'Pintura', name: 'Selador Acrílico', unit: 'latas', qty: Math.ceil(totalArea / 60) },
            { category: 'Pintura', name: 'Tinta Acrílica Premium (18L)', unit: 'latas', qty: Math.ceil(totalArea / 40) },
            { category: 'Pintura', name: 'Lixas 150/220', unit: 'un', qty: 20 },
            { category: 'Elétrica', name: 'Kit Tomadas e Interruptores', unit: 'un', qty: Math.ceil(totalArea / 8) },
            { category: 'Elétrica', name: 'Cabos Flexíveis (1.5mm/2.5mm)', unit: 'rolos', qty: Math.ceil(totalArea / 25) },
            { category: 'Acabamento', name: 'Louças e Metais', unit: 'vb', qty: 1 },
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
                    // Force Plan Update Locally
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
            const now = new Date();
            const currentExpiry = new Date(db.users[userIdx].subscriptionExpiresAt || now);
            const baseDate = currentExpiry > now ? currentExpiry : now;
            
            if (plan === PlanType.MENSAL) baseDate.setMonth(baseDate.getMonth() + 1);
            if (plan === PlanType.SEMESTRAL) baseDate.setMonth(baseDate.getMonth() + 6);
            if (plan === PlanType.VITALICIO) baseDate.setFullYear(baseDate.getFullYear() + 99);
            
            db.users[userIdx].subscriptionExpiresAt = baseDate.toISOString();
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
            if (stepId && item.materials.length > 0) {
                 if (supabase) {
                    const matPayload = item.materials.map(m => ({
                        work_id: newWorkId,
                        name: m.name,
                        planned_qty: m.qty,
                        purchased_qty: 0,
                        unit: m.unit,
                        category: m.category,
                        step_id: stepId // LINK TO STEP
                    }));
                    await supabase.from('materials').insert(matPayload);
                 } else {
                    const db = getLocalDb();
                    const matPayload = item.materials.map(m => ({
                        id: Math.random().toString(36).substr(2, 9),
                        workId: newWorkId,
                        name: m.name,
                        plannedQty: m.qty,
                        purchasedQty: 0,
                        unit: m.unit,
                        category: m.category,
                        stepId: stepId
                    }));
                    db.materials.push(...matPayload);
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
