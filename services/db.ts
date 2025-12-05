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
        // Tenta buscar perfil existente
        let { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        // Se não existir (primeiro login social), cria
        if (!profile) {
             const { data: newProfile, error } = await supabase.from('profiles').insert({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Usuário',
                plan: PlanType.VITALICIO,
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
    // Ensure numbers are numbers
    const safeAmount = Number(expense.amount) || 0;
    const safePaid = Number(expense.paidAmount) || 0;
    const safeQty = Number(expense.quantity) || 1;

    // Secure: Removed logging of expense payload to prevent data leaks
    // console.log("DB: Saving Expense...", expense);

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
             // String comparison is safer for dates YYYY-MM-DD than Date objects due to timezone offsets
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
            // String comparison is safer for dates YYYY-MM-DD than Date objects due to timezone offsets
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

// --- ENGINE: SMART PLAN GENERATOR (CONSTRUCTION & RENOVATION) ---
const generateSmartPlan = (templateId: string, totalArea: number, floors: number, details?: ConstructionDetails): PlanItem[] => {
    const plan: PlanItem[] = [];
    const footprint = totalArea / Math.max(1, floors); 
    
    // Default safe values if details missing
    const baths = details?.bathrooms || Math.max(1, Math.ceil(totalArea / 70)); 
    const kitchens = details?.kitchens || 1;
    const rooms = details?.bedrooms || Math.max(1, Math.ceil(totalArea / 50));
    const living = details?.livingRooms || 1;
    const hasLeisure = details?.hasLeisureArea || false;

    // Derived counts
    const wetAreas = baths + kitchens + (hasLeisure ? 1 : 0);
    const totalRooms = rooms + living + kitchens + baths;
    const electricalPoints = (rooms * 4) + (living * 6) + (kitchens * 6) + (baths * 2);

    let currentDay = 0;
    let stepCount = 1;
    const formatStep = (name: string) => `${stepCount.toString().padStart(2, '0')} - ${name}`;

    // --- CASE 1: CONSTRUÇÃO DO ZERO ---
    if (templateId === 'CONSTRUCAO') {
        // 1. PRELIMINARES
        plan.push({ stepName: formatStep("Serviços Preliminares (Canteiro)"), duration: 5, startOffset: currentDay, materials: [{ name: 'Tapume (Madeirite)', unit: 'chapas', qty: Math.ceil(Math.sqrt(footprint) * 4 / 2) }, { name: 'Sarrasfo 2.5cm', unit: 'dz', qty: 2 }, { name: 'Prego 17x21', unit: 'kg', qty: 2 }, { name: 'Ligação Provisória Água/Luz', unit: 'vb', qty: 1 }] });
        currentDay += 5; stepCount++;
        
        // 2. FUNDAÇÃO
        plan.push({ stepName: formatStep("Fundação e Baldrames"), duration: 20, startOffset: currentDay, materials: [{ name: 'Cimento CP-II (Concreto)', unit: 'sacos', qty: Math.ceil(footprint * 0.8) }, { name: 'Areia Média/Grossa', unit: 'm³', qty: Math.ceil(footprint * 0.08) }, { name: 'Brita 1', unit: 'm³', qty: Math.ceil(footprint * 0.08) }, { name: 'Pedra de Mão (Rachão)', unit: 'm³', qty: Math.ceil(footprint * 0.04) }, { name: 'Vergalhão 3/8 (10mm)', unit: 'barras', qty: Math.ceil(footprint * 0.6) }, { name: 'Vergalhão 5/16 (8mm)', unit: 'barras', qty: Math.ceil(footprint * 0.4) }, { name: 'Estribos 4.2mm (Prontos)', unit: 'un', qty: Math.ceil(footprint * 4) }, { name: 'Tábua de Pinus 30cm (Caixaria)', unit: 'dz', qty: Math.ceil(footprint / 15) }, { name: 'Impermeabilizante Betuminoso', unit: 'latas', qty: Math.ceil(footprint / 12) }] });
        currentDay += 20; stepCount++;
        
        // 3. ESTRUTURA
        for (let i = 0; i < floors; i++) {
            const floorLabel = i === 0 ? "Térreo" : `${i}º Pavimento`;
            plan.push({ stepName: formatStep(`Alvenaria e Estrutura (${floorLabel})`), duration: 20, startOffset: currentDay, materials: [{ name: `Tijolo/Bloco (${floorLabel})`, unit: 'milheiro', qty: Math.ceil((footprint * 3 * 25) / 1000) }, { name: 'Cimento (Assentamento)', unit: 'sacos', qty: Math.ceil(footprint * 0.25) }, { name: 'Cal Hidratada', unit: 'sacos', qty: Math.ceil(footprint * 0.3) }, { name: 'Areia Média', unit: 'm³', qty: Math.ceil(footprint * 0.05) }, { name: 'Ferro 3/8 (Colunas)', unit: 'barras', qty: Math.ceil(footprint * 0.4) }, { name: 'Ferro 4.2 (Estribos)', unit: 'barras', qty: Math.ceil(footprint * 0.2) }, { name: 'Tábua de Pinus (Vigas)', unit: 'dz', qty: Math.ceil(footprint / 20) }, { name: 'Caixinhas de Luz 4x2', unit: 'un', qty: Math.ceil(footprint / 8) }, { name: 'Eletroduto Corrugado (Parede)', unit: 'rolos', qty: Math.ceil(footprint / 20) }] });
            currentDay += 20; stepCount++;
            plan.push({ stepName: formatStep(`Laje e Cobertura (${floorLabel})`), duration: 15, startOffset: currentDay, materials: [{ name: `Vigota Trilho (${floorLabel})`, unit: 'm', qty: Math.ceil(footprint * 3.2) }, { name: `Isopor/Lajota (${floorLabel})`, unit: 'un', qty: Math.ceil(footprint * 3.5) }, { name: 'Malha Pop 15x15', unit: 'un', qty: Math.ceil(footprint / 8) }, { name: 'Concreto Usinado FCK25', unit: 'm³', qty: Math.ceil(footprint * 0.1) }, { name: 'Escoras de Eucalipto', unit: 'dz', qty: Math.ceil(footprint / 12) }, { name: 'Caixas de Luz de Laje (Octogonal)', unit: 'un', qty: Math.ceil(footprint / 15) }, { name: 'Eletroduto Corrugado Reforçado (Laje)', unit: 'rolos', qty: Math.ceil(footprint / 40) }] });
            currentDay += 15; stepCount++;
        }
        
        // 4. TELHADO
        plan.push({ stepName: formatStep("Telhado e Calhas"), duration: 15, startOffset: currentDay, materials: [{ name: 'Madeiramento (Vigas/Caibros)', unit: 'm³', qty: Math.ceil(footprint * 0.04) }, { name: 'Telhas (Cerâmica/Concreto)', unit: 'milheiro', qty: Math.ceil((footprint * 1.4 * 16) / 1000) }, { name: 'Caixa D\'água 1000L', unit: 'un', qty: 1 }, { name: 'Manta Térmica', unit: 'rolos', qty: Math.ceil(footprint / 45) }, { name: 'Calhas e Rufos', unit: 'm', qty: Math.ceil(Math.sqrt(footprint) * 3) }] });
        currentDay += 10; stepCount++;
        
        // 5. INSTALAÇÕES
        const hydraulicDuration = 10 + (wetAreas * 2);
        plan.push({ stepName: formatStep("Instalações Hidráulicas e Esgoto"), duration: hydraulicDuration, startOffset: currentDay, materials: [{ name: 'Tubos PVC 25mm (Água)', unit: 'barras', qty: Math.ceil(totalArea / 10) + (wetAreas * 3) }, { name: 'Tubos Esgoto 100mm', unit: 'barras', qty: Math.ceil(floors * 3) + baths }, { name: 'Tubos Esgoto 40mm/50mm', unit: 'barras', qty: Math.ceil(totalArea / 12) + (wetAreas * 2) }, { name: 'Conexões Diversas (Kit)', unit: 'vb', qty: 1 }, { name: 'Registros de Gaveta', unit: 'un', qty: wetAreas + 1 }, { name: 'Cola PVC', unit: 'tubo', qty: 2 + Math.floor(wetAreas/3) }] });
        currentDay += hydraulicDuration; stepCount++;
        
        // 6. REBOCO
        plan.push({ stepName: formatStep("Reboco e Contrapiso"), duration: 25, startOffset: currentDay, materials: [{ name: 'Cimento (Reboco/Piso)', unit: 'sacos', qty: Math.ceil(totalArea * 0.4) }, { name: 'Areia Fina/Média', unit: 'm³', qty: Math.ceil(totalArea * 0.1) }, { name: 'Cal Hidratada', unit: 'sacos', qty: Math.ceil(totalArea * 0.3) }, { name: 'Aditivo Vedalit', unit: 'litros', qty: Math.ceil(totalArea / 20) }] });
        currentDay += 25; stepCount++;
        
        // 7. FIAÇÃO
        plan.push({ stepName: formatStep("Fiação e Cabos Elétricos"), duration: 7 + (floors * 2), startOffset: currentDay, materials: [{ name: 'Cabos 2.5mm (Tomadas)', unit: 'rolos', qty: Math.ceil(electricalPoints / 15) }, { name: 'Cabos 1.5mm (Iluminação)', unit: 'rolos', qty: Math.ceil(totalArea / 30) }, { name: 'Cabos 6mm (Chuveiro)', unit: 'm', qty: Math.ceil(floors * 15) + (baths * 5) }, { name: 'Quadro de Distribuição', unit: 'un', qty: floors }, { name: 'Disjuntor', unit: 'un', qty: Math.ceil(totalRooms / 2) + 2 }, { name: 'Fita Isolante', unit: 'un', qty: 2 }] });
        currentDay += (7 + (floors * 2)); stepCount++;
        
        // 8. PISOS
        const wallTileArea = (baths * 20) + (kitchens * 10); 
        const totalTileArea = Math.ceil(totalArea * 1.15) + wallTileArea;
        plan.push({ stepName: formatStep("Pisos e Revestimentos"), duration: 20 + Math.ceil(wetAreas * 1.5), startOffset: currentDay, materials: [{ name: 'Piso Cerâmico/Porcelanato', unit: 'm²', qty: totalTileArea }, { name: 'Argamassa AC-II/AC-III', unit: 'sacos', qty: Math.ceil(totalTileArea / 3.5) }, { name: 'Rejunte', unit: 'kg', qty: Math.ceil(totalTileArea / 8) }, { name: 'Niveladores de Piso', unit: 'pct', qty: Math.ceil(totalArea / 30) }, { name: 'Rodapés', unit: 'm', qty: Math.ceil(Math.sqrt(totalArea) * 4) }] });
        currentDay += (20 + Math.ceil(wetAreas * 1.5)); stepCount++;
        
        // 9. PINTURA
        plan.push({ stepName: formatStep("Pintura Geral"), duration: 15, startOffset: currentDay, materials: [{ name: 'Massa Corrida/Acrílica', unit: 'latas', qty: Math.ceil(totalArea / 12) }, { name: 'Selador Acrílico', unit: 'latas', qty: Math.ceil(totalArea / 60) }, { name: 'Tinta Acrílica (18L)', unit: 'latas', qty: Math.ceil(totalArea / 40) }, { name: 'Lixas 150/220', unit: 'un', qty: 20 }, { name: 'Rolo de Lã e Pincel', unit: 'kit', qty: 1 }, { name: 'Fita Crepe', unit: 'rolos', qty: 3 }, { name: 'Lona Plástica', unit: 'm', qty: 20 }] });
        currentDay += 15; stepCount++;
        
        // 10. ACABAMENTOS
        plan.push({ stepName: formatStep("Acabamentos Finais e Entrega"), duration: 10 + wetAreas, startOffset: currentDay, materials: [{ name: 'Kit Tomadas e Interruptores', unit: 'un', qty: Math.ceil(electricalPoints) }, { name: 'Luminárias / Plafons', unit: 'un', qty: totalRooms + 2 }, { name: 'Louças (Vaso/Pia)', unit: 'un', qty: baths + (hasLeisure ? 1 : 0) }, { name: 'Metais (Torneiras/Chuveiro)', unit: 'un', qty: baths + kitchens + (hasLeisure ? 1 : 0) }, { name: 'Sifões e Engates', unit: 'un', qty: baths + kitchens + (hasLeisure ? 1 : 0) }] });
    
    // --- CASE 2: REFORMA COMPLETA (Casa/Apto) ---
    } else if (templateId === 'REFORMA_APTO') {
        // Demolition
        plan.push({ stepName: formatStep("Demolição e Retirada"), duration: 7, startOffset: currentDay, materials: [{ name: 'Sacos de Entulho', unit: 'un', qty: Math.ceil(totalArea * 2) }, { name: 'Caçamba de Entulho', unit: 'un', qty: Math.ceil(totalArea / 20) }] });
        currentDay += 7; stepCount++;

        // Instalações (If full renovation, usually involves electrical/hydraulic changes)
        plan.push({ stepName: formatStep("Instalações (Elétrica e Hidráulica)"), duration: 10 + wetAreas, startOffset: currentDay, materials: [
            { name: 'Cabos 2.5mm (Tomadas)', unit: 'rolos', qty: Math.ceil(electricalPoints / 20) }, 
            { name: 'Tubos e Conexões (Reparos)', unit: 'kit', qty: 1 },
            { name: 'Cimento e Areia (Chumbamento)', unit: 'sc/m3', qty: 5 }
        ]});
        currentDay += (10 + wetAreas); stepCount++;

        // Pisos (Renovation usually overlays or replaces floor)
        const tileArea = Math.ceil(totalArea * 1.15); // +15% loss
        plan.push({ stepName: formatStep("Pisos e Revestimentos"), duration: 15, startOffset: currentDay, materials: [
            { name: 'Piso Novo', unit: 'm²', qty: tileArea },
            { name: 'Argamassa Piso sobre Piso', unit: 'sacos', qty: Math.ceil(tileArea / 3) },
            { name: 'Rejunte', unit: 'kg', qty: Math.ceil(tileArea / 8) }
        ]});
        currentDay += 15; stepCount++;

        // Pintura
        const wallAreaEst = totalArea * 3; // Approx wall area
        plan.push({ stepName: formatStep("Pintura Completa"), duration: 10, startOffset: currentDay, materials: [
            { name: 'Tinta Acrílica (18L)', unit: 'latas', qty: Math.ceil(wallAreaEst / 40) },
            { name: 'Massa Corrida', unit: 'latas', qty: Math.ceil(wallAreaEst / 15) },
            { name: 'Lixas', unit: 'un', qty: 15 }
        ]});
        currentDay += 10; stepCount++;

        // Acabamentos
        plan.push({ stepName: formatStep("Acabamentos e Elétrica Final"), duration: 5, startOffset: currentDay, materials: [
            { name: 'Espelhos de Tomada', unit: 'un', qty: Math.ceil(electricalPoints) },
            { name: 'Luminárias', unit: 'un', qty: totalRooms + 2 },
            { name: 'Metais (Torneiras)', unit: 'un', qty: kitchens + baths }
        ]});

    // --- CASE 3: BANHEIRO ---
    } else if (templateId === 'BANHEIRO') {
        const wallArea = Math.ceil((Math.sqrt(totalArea) * 4 * 2.6)); // Perimeter * Height
        const totalTile = Math.ceil((totalArea + wallArea) * 1.15);

        plan.push({ stepName: formatStep("Demolição de Pisos/Revestimentos"), duration: 3, startOffset: currentDay, materials: [{ name: 'Sacos de Entulho', unit: 'un', qty: 20 }] });
        currentDay += 3; stepCount++;

        plan.push({ stepName: formatStep("Hidráulica e Impermeabilização"), duration: 5, startOffset: currentDay, materials: [
            { name: 'Kit Hidráulico (Tubos/Conexões)', unit: 'vb', qty: 1 },
            { name: 'Manta Líquida Impermeabilizante', unit: 'balde', qty: 1 }
        ]});
        currentDay += 5; stepCount++;

        plan.push({ stepName: formatStep("Revestimentos (Piso e Parede)"), duration: 7, startOffset: currentDay, materials: [
            { name: 'Revestimento Cerâmico', unit: 'm²', qty: totalTile },
            { name: 'Argamassa AC-III', unit: 'sacos', qty: Math.ceil(totalTile / 3.5) },
            { name: 'Rejunte Acrílico/Epóxi', unit: 'kg', qty: Math.ceil(totalTile / 6) }
        ]});
        currentDay += 7; stepCount++;

        plan.push({ stepName: formatStep("Instalação de Louças e Metais"), duration: 2, startOffset: currentDay, materials: [
            { name: 'Vaso Sanitário com Caixa', unit: 'un', qty: 1 },
            { name: 'Cuba/Pia', unit: 'un', qty: 1 },
            { name: 'Torneira', unit: 'un', qty: 1 },
            { name: 'Chuveiro', unit: 'un', qty: 1 },
            { name: 'Kit Acessórios (Toalheiro/Papeleira)', unit: 'kit', qty: 1 }
        ]});

    // --- CASE 4: COZINHA ---
    } else if (templateId === 'COZINHA') {
        const wallArea = Math.ceil((Math.sqrt(totalArea) * 4 * 1.5)); // Usually tiled halfway or backsplash area estimate
        const totalTile = Math.ceil((totalArea + wallArea) * 1.15);

        plan.push({ stepName: formatStep("Demolição e Retirada"), duration: 3, startOffset: currentDay, materials: [{ name: 'Sacos de Entulho', unit: 'un', qty: 15 }] });
        currentDay += 3; stepCount++;

        plan.push({ stepName: formatStep("Instalações (Água, Esgoto e Elétrica)"), duration: 5, startOffset: currentDay, materials: [
            { name: 'Pontos de Tomada (Fios e Caixas)', unit: 'kit', qty: 1 },
            { name: 'Tubos e Conexões Esgoto Pia', unit: 'kit', qty: 1 }
        ]});
        currentDay += 5; stepCount++;

        plan.push({ stepName: formatStep("Revestimentos e Bancadas"), duration: 7, startOffset: currentDay, materials: [
            { name: 'Piso/Revestimento', unit: 'm²', qty: totalTile },
            { name: 'Argamassa AC-III', unit: 'sacos', qty: Math.ceil(totalTile / 3.5) },
            { name: 'Rejunte', unit: 'kg', qty: Math.ceil(totalTile / 8) }
        ]});
        currentDay += 7; stepCount++;

        plan.push({ stepName: formatStep("Acabamentos Finais"), duration: 3, startOffset: currentDay, materials: [
            { name: 'Torneira Cozinha', unit: 'un', qty: 1 },
            { name: 'Sifão e Engate Flexível', unit: 'un', qty: 1 },
            { name: 'Tomadas e Interruptores', unit: 'un', qty: 6 }
        ]});

    // --- CASE 5: PINTURA ---
    } else if (templateId === 'PINTURA') {
        const wallArea = Math.ceil(totalArea * 3); // Estimate: Floor Area x 3 = Wall + Ceiling Area

        plan.push({ stepName: formatStep("Proteção e Preparação"), duration: 2, startOffset: currentDay, materials: [
            { name: 'Lona Plástica/Papelão', unit: 'm', qty: Math.ceil(totalArea * 1.5) },
            { name: 'Fita Crepe', unit: 'rolos', qty: Math.ceil(totalArea / 10) },
            { name: 'Lixas', unit: 'un', qty: Math.ceil(wallArea / 10) }
        ]});
        currentDay += 2; stepCount++;

        plan.push({ stepName: formatStep("Correção e Massa"), duration: 4, startOffset: currentDay, materials: [
            { name: 'Massa Corrida (Interna)', unit: 'latas', qty: Math.ceil(wallArea / 15) },
            { name: 'Selador Acrílico', unit: 'latas', qty: Math.ceil(wallArea / 50) }
        ]});
        currentDay += 4; stepCount++;

        plan.push({ stepName: formatStep("Pintura (2 a 3 Demãos)"), duration: 4, startOffset: currentDay, materials: [
            { name: 'Tinta Acrílica Premium (18L)', unit: 'latas', qty: Math.ceil(wallArea / 40) },
            { name: 'Rolo de Lã e Pincel', unit: 'kit', qty: 1 }
        ]});
    
    // FALLBACK
    } else {
        // Fallback for custom renovation if no template matches perfectly
        plan.push({ stepName: formatStep("Execução da Reforma"), duration: 30, startOffset: currentDay, materials: [] });
    }

    return plan;
};


// --- SERVICE LAYER (ASYNC INTERFACE) ---

export const dbService = {
  
  // --- Auth ---
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
          return { error: { message: "Supabase não configurado. Adicione as chaves no arquivo .env" } };
      }
  },

  // NEW METHOD: Sincroniza a sessão do Supabase (útil após redirect do OAuth)
  syncSession: async (): Promise<User | null> => {
      return await syncSupabaseUser();
  },

  // NEW METHOD: Ouve mudanças de auth (login, logout, refresh)
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
            // Security: Removed hardcoded default password. Requires proper password.
            password: password || '' 
        });
        
        if (error) {
             console.error("Supabase Login Error:", error);
             return null;
        }

        if (data.user) {
            await supabase.from('profiles').update({ plan: PlanType.VITALICIO }).eq('id', data.user.id);
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
            // Security: Removed hardcoded default password.
            password: password || '',
            options: {
                data: { name, whatsapp }
            }
        });
        
        if (error || !data.user) {
            console.error("Signup Error", error);
            return null;
        }
        
        await new Promise(r => setTimeout(r, 1000));
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
                plan: PlanType.VITALICIO, 
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

  updateUser: async (userId: string, data: { name?: string, whatsapp?: string }, newPassword?: string): Promise<User | null> => {
      if (supabase) {
          // 1. Update Profile Data
          const { data: profile, error } = await supabase.from('profiles')
              .update(data)
              .eq('id', userId)
              .select()
              .single();
          
          if (error) throw error;

          // 2. Update Password (if provided)
          if (newPassword) {
              const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
              if (pwdError) throw pwdError;
          }

          if (profile) {
              localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
              return profile as User;
          }
      } else {
          // Local Mock
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

  createWork: async (work: Omit<Work, 'id' | 'status'>, templateId: string): Promise<Work> => {
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
            status: WorkStatus.PLANNING,
            // We'd ideally save the new details here too if the DB schema supported it
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

    // 2. GENERATE INTELLIGENT PLAN (Used for both Construction and Renovations)
    // The generator now handles different template IDs to create specific steps and materials
    const constructionDetails: ConstructionDetails = {
        bedrooms: work.bedrooms,
        bathrooms: work.bathrooms,
        kitchens: work.kitchens,
        livingRooms: work.livingRooms,
        hasLeisureArea: work.hasLeisureArea
    };

    const plan = generateSmartPlan(templateId, work.area, work.floors || 1, constructionDetails);
    
    // SAFE LOCAL DATE PARSING (YYYY-MM-DD to Date)
    const [startY, startM, startD] = work.startDate.split('-').map(Number);
    const startDate = new Date(startY, startM - 1, startD); // Local Date at midnight

    for (const item of plan) {
        const sDate = new Date(startDate);
        sDate.setDate(sDate.getDate() + item.startOffset);
        const eDate = new Date(sDate);
        eDate.setDate(eDate.getDate() + item.duration);
        
        // Helper to format Date object back to YYYY-MM-DD string
        const formatDateStr = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const sDateStr = formatDateStr(sDate);
        const eDateStr = formatDateStr(eDate);

        let stepId = '';
        if (supabase) {
                const { data: newStep } = await supabase.from('steps').insert({
                work_id: newWorkId,
                name: item.stepName,
                start_date: sDateStr,
                end_date: eDateStr,
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
                    startDate: sDateStr,
                    endDate: eDateStr,
                    status: StepStatus.NOT_STARTED,
                    isDelayed: false
                });
                saveLocalDb(db);
        }

        if (item.materials.length > 0) {
                const matPayload = item.materials.map(m => ({
                work_id: newWorkId,
                name: m.name,
                planned_qty: m.qty,
                purchased_qty: 0,
                unit: m.unit,
                category: item.stepName,
                step_id: stepId || null 
                }));

                if (supabase) {
                const { error } = await supabase.from('materials').insert(matPayload);
                if (error) {
                    console.error("Erro ao inserir materiais automáticos:", error);
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
                const cleanPayload = localPayload.map(({ step_id, planned_qty, purchased_qty, work_id, ...rest }) => rest);
                db.materials.push(...cleanPayload as Material[]);
                saveLocalDb(db);
                }
        }
    }

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
  getSteps: getStepsInternal,

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
  getExpenses: getExpensesInternal,

  addExpense: async (expense: Omit<Expense, 'id'>) => {
      await insertExpenseInternal(expense);
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
      let expenseToDelete: Expense | undefined;

      if (supabase) {
          const { data } = await supabase.from('expenses').select('*').eq('id', id).single();
          if (data) expenseToDelete = { ...data, relatedMaterialId: data.related_material_id };
      } else {
          const db = getLocalDb();
          expenseToDelete = db.expenses.find(e => e.id === id);
      }

      if (expenseToDelete && expenseToDelete.relatedMaterialId && expenseToDelete.category === ExpenseCategory.MATERIAL) {
          let material: Material | undefined;
          if (supabase) {
              const { data } = await supabase.from('materials').select('*').eq('id', expenseToDelete.relatedMaterialId).single();
              if (data) material = { ...data, plannedQty: data.planned_qty, purchasedQty: data.purchased_qty, workId: data.work_id, stepId: data.step_id };
          } else {
              const db = getLocalDb();
              material = db.materials.find(m => m.id === expenseToDelete!.relatedMaterialId);
          }

          if (material) {
              const qtyToRevert = Number(expenseToDelete.quantity) || 0;
              material.purchasedQty = Math.max(0, material.purchasedQty - qtyToRevert);
              if (supabase) {
                  await supabase.from('materials').update({ purchased_qty: material.purchasedQty }).eq('id', material.id);
              } else {
                  const db = getLocalDb();
                  const idx = db.materials.findIndex(m => m.id === material!.id);
                  if (idx > -1) {
                      db.materials[idx] = material;
                      saveLocalDb(db);
                  }
              }
          }
      }

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

  updateMaterial: async (material: Material, cost?: number, addedQty?: number) => {
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

      // 2. If Cost provided, Add to Expenses
      // Check if cost is strictly greater than 0
      if (cost && cost > 0) {
          // SMART LINKING: Resolve Step ID
          let finalStepId = material.stepId;

          // If material is not explicitly linked to a step ID, try to find a step by Category Name
          if (!finalStepId && material.category) {
               try {
                   // Use internal function to avoid circular dependency
                   const steps = await getStepsInternal(material.workId);
                   
                   const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                   const targetCat = normalize(material.category);

                   let match = steps.find(s => normalize(s.name) === targetCat);
                   if (!match) {
                       match = steps.find(s => normalize(s.name).includes(targetCat) || targetCat.includes(normalize(s.name)));
                   }

                   if (match) finalStepId = match.id;
               } catch (e) {
                   console.error("Error linking material to step (non-fatal):", e);
               }
          }

          const qtyDesc = addedQty ? `(${addedQty} ${material.unit})` : '';
          const description = `Compra: ${material.name} ${qtyDesc}`;
          
          await insertExpenseInternal({
              workId: material.workId,
              description: description,
              amount: cost,
              paidAmount: cost, 
              quantity: addedQty || 1, 
              category: ExpenseCategory.MATERIAL,
              date: new Date().toISOString().split('T')[0],
              stepId: finalStepId, 
              relatedMaterialId: material.id
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

    if (supabase) {
        const { data, error } = await supabase.from('standard_materials').select('*').eq('category', category);
        if (!error && data && data.length > 0) {
            itemsToImport = data.map(d => ({ category: d.category, name: d.name, unit: d.unit }));
        }
    }
    
    if (itemsToImport.length === 0) {
        const pkg = FULL_MATERIAL_PACKAGES.find(p => p.category === category);
        if (pkg) {
            itemsToImport = pkg.items.map(i => ({ category: pkg.category, name: i.name, unit: i.unit }));
        }
    }

    if (itemsToImport.length === 0) return 0;

    let relatedStepId = undefined;
    const steps = await getStepsInternal(workId);
    const matchStep = steps.find(s => s.name.toLowerCase().includes(category.toLowerCase()));
    if (matchStep) relatedStepId = matchStep.id;

    if (supabase) {
        const payload = itemsToImport.map(item => ({
            work_id: workId,
            name: item.name,
            planned_qty: 0,
            purchased_qty: 0,
            unit: item.unit,
            category: category,
            step_id: relatedStepId
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
          const publicUrl = await uploadToBucket(file, `${workId}/files`);
          if (!publicUrl) return null;

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
      const expenses = await getExpensesInternal(workId);
      const steps = await getStepsInternal(workId);
      const materials = await dbService.getMaterials(workId);
      const work = await dbService.getWorkById(workId);

      if (!work) return;
      
      const db = getLocalDb();
      const today = getLocalTodayString();
      const lastCheckKey = `${NOTIFICATION_CHECK_KEY}_${workId}`;
      const lastCheck = localStorage.getItem(lastCheckKey);

      if (lastCheck === today) return; 

      // 1. Budget Check
      // Only count PAID amounts towards "spending" for notifications
      const totalSpent = expenses.reduce((acc, curr) => acc + (Number(curr.paidAmount) || 0), 0);
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
          // 2. Delay Check (Reused isDelayed which is string based)
          if (step.isDelayed) {
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

          // 3. Upcoming Material Check
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
      const steps = await getStepsInternal(workId);
      const materials = await dbService.getMaterials(workId);
      
      const completed = steps.filter(s => s.status === StepStatus.COMPLETED).length;
      
      // Use the pre-calculated isDelayed flag which uses robust string comparison
      const delayed = steps.filter(s => s.isDelayed).length;
      
      const pendingMaterials = materials.filter(m => m.purchasedQty < m.plannedQty).length;
      
      return {
          completedSteps: completed,
          delayedSteps: delayed,
          pendingMaterials,
          totalSteps: steps.length
      };
  },

  calculateWorkStats: async (workId: string) => {
    const expenses = await getExpensesInternal(workId);
    const steps = await getStepsInternal(workId);
    
    // Safety check to ensure numbers are numbers
    // FIXED: Only count what is actually paid (paidAmount)
    const totalSpent = expenses.reduce((acc, curr) => acc + (Number(curr.paidAmount) || 0), 0);
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    
    // Use robust isDelayed logic
    const delayedSteps = steps.filter(s => s.isDelayed).length;
    
    return {
      totalSpent,
      progress: totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100),
      delayedSteps
    };
  }
};
