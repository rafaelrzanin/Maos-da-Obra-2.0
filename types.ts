export enum PlanType {
  MENSAL = 'MENSAL',
  SEMESTRAL = 'SEMESTRAL',
  VITALICIO = 'VITALICIO',
}

export interface User {
  id: string;
  name: string;
  email: string;
  whatsapp?: string;
  cpf?: string; 
  plan?: PlanType | null; 
  subscriptionExpiresAt?: string;
  isTrial?: boolean; // New field for trial status
}

// NEW: Interface para armazenar a PushSubscription de um usuário
export interface PushSubscriptionInfo {
  id: string; // UUID do Supabase (pode ser ignorado se não for usado)
  userId: string; // Added userId to match database mapping
  // O objeto PushSubscription é o que o navegador retorna e é necessário para enviar notificações
  subscription: PushSubscriptionJSON; 
  endpoint: string; // Para facilitar a busca
}

export enum WorkStatus {
  PLANNING = 'Planejamento',
  IN_PROGRESS = 'Em Andamento',
  COMPLETED = 'Concluída',
  PAUSED = 'Pausada',
}

export enum RiskLevel {
  LOW = 'BAIXO',
  MEDIUM = 'MÉDIO',
  HIGH = 'ALTO',
}

export interface Work {
  id: string;
  userId: string;
  name: string;
  address: string;
  budgetPlanned: number;
  startDate: string;
  endDate: string;
  area: number; 
  floors?: number; 
  bedrooms?: number;
  bathrooms?: number;
  kitchens?: number;
  livingRooms?: number;
  hasLeisureArea?: boolean;
  notes: string;
  status: WorkStatus;
}

export enum StepStatus {
  NOT_STARTED = 'NAO_INICIADO',
  IN_PROGRESS = 'EM_ANDAMENTO',
  COMPLETED = 'CONCLUIDO',
}

export interface Step {
  id: string;
  workId: string;
  name: string;
  startDate: string; 
  endDate: string;   
  realDate?: string;
  status: StepStatus;
  isDelayed: boolean;
  orderIndex: number; // NEW: Added orderIndex for step reordering
}

export enum ExpenseCategory {
  MATERIAL = 'Material',
  LABOR = 'Mão de Obra',
  PERMITS = 'Taxas/Licenças',
  OTHER = 'Outros',
}

export interface Expense {
  id: string;
  workId: string;
  description: string;
  amount: number; 
  paidAmount?: number; 
  quantity?: number; 
  date: string;
  category: ExpenseCategory | string;
  relatedMaterialId?: string; 
  stepId?: string; 
  workerId?: string;
  supplierId?: string; // NEW: Added supplierId for financial reports
  totalAgreed?: number; 
}

export enum MaterialStatus {
  MISSING = 'FALTANDO',
  PURCHASED = 'COMPRADO',
  EXTRA = 'SOBRANDO',
}

export interface Material {
  id: string;
  workId: string;
  name: string;
  brand?: string; // NEW: Added brand for materials
  plannedQty: number;
  purchasedQty: number;
  unit: string;
  stepId?: string; 
  category?: string; 
  totalCost?: number; // NEW: Added for tracking total cost of material
}

export interface StandardMaterial {
  category: string;
  items: {name: string, unit: string, multiplier?: number}[];
}

export interface WorkPhoto {
  id: string;
  workId: string;
  url: string;
  description: string;
  date: string;
  type: 'BEFORE' | 'AFTER' | 'PROGRESS';
}

export enum FileCategory {
  ARCHITECTURAL = 'Arquitetônico',
  STRUCTURAL = 'Estrutural',
  HYDRAULIC = 'Hidráulico',
  ELECTRICAL = 'Elétrico',
  INTERIOR = 'Interiores',
  OTHER_PROJECT = 'Outros Projetos',
  GENERAL = 'Geral / Documentos'
}

export interface WorkFile {
  id: string;
  workId: string;
  name: string;
  category: FileCategory;
  url: string; 
  type: string; 
  date: string;
}

// RENOMEADO para evitar conflito com o objeto global 'Notification' do navegador
export interface DBNotification { 
  id: string;
  userId: string;
  workId?: string; // NEW: Added workId to link notification to a specific work
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  tag?: string; // NEW: Unique identifier for notification deduplication
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Checklist {
  id: string;
  workId: string; // NEW: Associate checklist with a work
  name: string; // Ex: "Fundações - Pré-Concretagem"
  category: string; // Ex: "Fundações", "Elétrica"
  items: ChecklistItem[]; // NEW: Defined items as an array of ChecklistItem
}

export interface Contract { // Changed ContractTemplate to Contract
  id: string;
  title: string;
  category: string; // Ex: "Mão de Obra", "Serviços", "Recibos"
  contentTemplate: string; 
}

export interface Supplier {
  id: string;
  userId: string;
  workId: string; // NEW: Added workId to link supplier to a specific work
  name: string;
  category: string;
  phone: string;
  email?: string; // NEW: Added email
  address?: string; // NEW: Added address
  notes?: string;
}

export interface Worker {
  id: string;
  userId: string;
  workId: string; // NEW: Added workId to link worker to a specific work
  name: string;
  role: string;
  phone: string;
  dailyRate?: number; // NEW: Added dailyRate
  notes?: string;
}

// NEW: Interfaces for AI Work Plan (Re-added)
export interface AIWorkPlan {
  workId: string;
  generalAdvice: string;
  timelineSummary: string;
  detailedSteps: {
    orderIndex?: number; // NEW: Added orderIndex for explicit ordering
    name: string;
    estimatedDurationDays: number;
    notes: string;
  }[];
  potentialRisks: {
    description: string;
    likelihood: 'low' | 'medium' | 'high';
    mitigation: string;
  }[];
  materialSuggestions: {
    item: string;
    priority: 'low' | 'medium' | 'high';
    reason: string;
  }[];
}

// Removed ZeSuggestion as the card UI is removed.
// Removed AI-related interfaces as AI Planner will handle structured responses differently.

// Add ambient module declarations for import.meta.env AND process.env
// This resolves TypeScript errors like "Property 'env' does not exist on type 'ImportMeta')"
// When types.ts is a module (has exports), ambient declarations must be in a 'declare global {}' block
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_VAPID_PUBLIC_KEY: string; // Adicionado explicitamente para client-side
    readonly VITE_GOOGLE_API_KEY: string; // NEW: Adicionado para a chave da IA com o nome específico
    readonly VITE_APP_URL: string; // NEW: Adicionado para o URL base do aplicativo
    // Add an index signature to allow dynamic access with string keys
    [key: string]: string | undefined; 
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // Augment the NodeJS namespace to include process.env
  namespace NodeJS {
    interface ProcessEnv {
      // REMOVIDO 'readonly API_KEY: string;' pois não é o método idiomático para Vite client-side
      readonly VITE_GOOGLE_API_KEY: string; // NEW: Variável de ambiente real para a chave da IA
      readonly NEON_SECRET_KEY: string; // From api/create-pix.js
      // NEW: VAPID keys for Web Push Notifications
      readonly VAPID_PUBLIC_KEY: string;
      readonly VAPID_PRIVATE_KEY: string;
      // Adicionado explicitamente para serverless functions/process.env
      readonly VITE_SUPABASE_URL: string; 
      readonly VITE_SUPABASE_ANON_KEY: string;
      readonly VITE_APP_URL: string; // NEW: Adicionado para o URL base do aplicativo (server-side)
      // Add an index signature to allow dynamic access with string keys
      [key: string]: string | undefined; 
    }
  }
}