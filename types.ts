

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
  plan: PlanType;
  subscriptionExpiresAt?: string;
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
  area: number; // m2
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
  startDate: string; // Changed from plannedDate
  endDate: string;   // Added
  realDate?: string;
  status: StepStatus;
  isDelayed: boolean;
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
  amount: number; // Total Value (Valor Total da Nota/Serviço)
  paidAmount?: number; // Amount actually paid (Valor Pago)
  quantity?: number; // Qty (e.g., 2 diárias, 5 sacos)
  date: string;
  category: ExpenseCategory;
  relatedMaterialId?: string; // Link to material
  stepId?: string; // Link to specific step (New)
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
  plannedQty: number;
  purchasedQty: number;
  unit: string;
  stepId?: string; // Optional link to a specific step
  category?: string; // Visual grouping
}

export interface StandardMaterial {
  category: string;
  name: string;
  unit: string;
}

export interface WorkPhoto {
  id: string;
  workId: string;
  url: string;
  description: string;
  date: string;
  type: 'BEFORE' | 'AFTER' | 'PROGRESS';
}

// --- NOVOS TIPOS PARA ARQUIVOS ---
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
  url: string; // Base64 data URI
  type: string; // MIME type (pdf, image, etc)
  date: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
}

// --- TOOLS TYPES ---
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Checklist {
  id: string;
  category: string;
  items: ChecklistItem[];
}

export interface ContractTemplate {
  id: string;
  title: string;
  description: string;
  contentTemplate: string; // Text with placeholders
}

// --- TEAM & SUPPLIERS ---
export interface Supplier {
  id: string;
  userId: string;
  name: string;
  category: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface Worker {
  id: string;
  userId: string;
  name: string;
  role: string;
  phone: string;
  dailyRate?: number;
  notes?: string;
}