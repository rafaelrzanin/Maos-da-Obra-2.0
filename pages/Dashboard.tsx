
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, WorkStatus, type Work, type DBNotification, type Step, type Material } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx'; // Importa ZeModalProps
import { Recharts } from '../components/RechartsWrapper.tsx'; // Importa Recharts

const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } = Recharts;

/** =========================
 * UI helpers
 * ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

// Updated to use new shadow classes
const surface =
  "bg-white border border-slate-200/90 shadow-card-default ring-1 ring-black/5 " +
  "dark:bg-slate-900/70 dark:border-slate-800 dark:shadow-card-dark-subtle dark:ring-0";

const card = "rounded-3xl p-6 lg:p-8";
const mutedText = "text-slate-500 dark:text-slate-400";

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '--/--';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  }
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch (e) {
    return dateStr;
  }
};

// Helper para formatar valores monetários
const formatCurrency = (value: number | string | undefined): string => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 'R$ 0,00';
  }
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** =========================
 * Skeleton
 * ========================= */
const DashboardSkeleton = () => (
  <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 animate-pulse">
    <div className="flex justify-between items-end mb-8">
      <div className="space-y-2">
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      </div>
      <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
    </div>
    <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl mb-8"></div>
    <div className="mb-8 h-64 w-full rounded-[1.6rem] bg-slate-100 dark:bg-slate-900"></div>
    {/* List Skeleton */}
    <div className="space-y-4">
      <div className="h-4 w-32 rounded-full bg-slate-200 dark:bg-slate-800 mb-2"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-24px_rgba(15,23,42,0.40)] ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none dark:ring-0"
          >
            <div className="h-full w-full rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 to-slate-900"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** =========================
 * Sub-Componentes
 * ========================= */

// NEW: Segmented Progress Bar Component
const SegmentedProgressBar = ({ steps }: { steps: Step[] }) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 flex">
        <div className="h-full bg-slate-300 rounded-full" style={{ width: '100%' }}></div>
      </div>
    );
  }

  const totalSteps = steps.length;
  const today = new Date().toISOString().split('T')[0];

  const completed = steps.filter(s => s.status === StepStatus.COMPLETED);
  const inProgress = steps.filter(s => s.status === StepStatus.IN_PROGRESS);
  const notStarted = steps.filter(s => s.status === StepStatus.NOT_STARTED);
  const delayed = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < today);

  // Remove delayed steps from inProgress and notStarted to avoid double counting for accurate segment widths
  const actualInProgress = inProgress.filter(s => !delayed.some(d => d.id === s.id));
  const actualNotStarted = notStarted.filter(s => !delayed.some(d => d.id === s.id));


  const completedPct = (completed.length / totalSteps) * 100;
  const inProgressPct = (actualInProgress.length / totalSteps) * 100;
  const delayedPct = (delayed.length / totalSteps) * 100;
  const notStartedPct = (actualNotStarted.length / totalSteps) * 100; // Remaining

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 flex overflow-hidden">
      {completedPct > 0 && <div className="h-full bg-green-500" style={{ width: `${completedPct}%` }} title={`Concluído: ${completedPct.toFixed(0)}%`}></div>}
      {inProgressPct > 0 && <div className="h-full bg-orange-500" style={{ width: `${inProgressPct}%` }} title={`Em Andamento: ${inProgressPct.toFixed(0)}%`}></div>}
      {delayedPct > 0 && <div className="h-full bg-red-500" style={{ width: `${delayedPct}%` }} title={`Atrasado: ${delayedPct.toFixed(0)}%`}></div>}
      {notStartedPct > 0 && <div className="h-full bg-slate-300" style={{ width: `${notStartedPct}%` }} title={`Pendente: ${notStartedPct.toFixed(0)}%`}></div>}
    </div>
  );
};


// FIX: Updated KpiCardProps interface to accept `children`
const KpiCard = ({ onClick, icon, iconClass, value, label, badge, accent, children }: {
  onClick?: () => void;
  icon: string;
  iconClass: string;
  value: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  accent?: "ok" | "warn" | "danger";
  children?: React.ReactNode; // NEW: Added children prop
}) => {
  const ring = accent === "danger" ? "ring-1 ring-red-500/20" : accent === "warn" ? "ring-1 ring-amber-500/20" : "ring-1 ring-emerald-500/10";
  return (
    <div 
      onClick={onClick} 
      className={cx(surface, "rounded-3xl p-3 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:border-secondary/40", ring)} 
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1} // Make clickable elements focusable
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick(); }} // Keyboard accessibility
    >
      <div className="flex items-start justify-between mb-2"> {/* Reduced mb-3 to mb-2 */}
        <div className={cx("w-9 h-9 rounded-xl grid place-items-center text-base", iconClass)}><i className={icon}></i></div> {/* Reduced w-10 h-10 to w-9 h-9 */}
        {badge}
      </div>
      <div className="text-xl font-black text-slate-900 dark:text-white leading-none mb-0.5">{value}</div> {/* Reduced text-2xl to text-xl, mb-1 to mb-0.5 */}
      <div className={cx("text-[9px] font-extrabold tracking-widest uppercase", mutedText)}>{label}</div> {/* Reduced text-[10px] to text-[9px] */}
      {children} {/* NEW: Render children here */}
    </div>
  );
};

// NEW: NextSteps Component
const NextSteps = ({
  focusWork,
  steps,
  onOpenWork,
}: {
  focusWork: Work;
  steps: Step[];
  onOpenWork: () => void;
}) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const nextRelevantSteps = useMemo(() => {
    return steps
      .filter(s => s.status !== StepStatus.COMPLETED && s.endDate >= today) // Filter out completed and past due
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3); // Changed from 5 to 3 for compactness
  }, [steps, today]);

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-black text-slate-900 dark:text-white">Próximas Etapas</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Organize os próximos passos da sua obra</p>
        </div>
        <button onClick={onOpenWork} className="text-xs font-extrabold text-secondary hover:opacity-80 px-3 py-1.5 rounded-lg bg-secondary/5 transition-colors" aria-label="Ver cronograma completo">
          Ver cronograma →
        </button>
      </div>

      {nextRelevantSteps.length === 0 ? (
        <div className="text-center text-slate-400 py-8 italic text-sm">
          Todas as etapas futuras concluídas ou sem etapas futuras.
        </div>
      ) : (
        <div className="space-y-3"> {/* Reduced space-y-4 to space-y-3 */}
          {nextRelevantSteps.map((step, idx) => {
            let statusClass = '';
            let statusIcon = '';

            const isDelayed = step.status !== StepStatus.COMPLETED && step.endDate < today;

            if (isDelayed) {
                statusClass = 'text-red-600';
                statusIcon = 'fa-triangle-exclamation';
            } else if (step.status === StepStatus.COMPLETED) {
                statusClass = 'text-green-600';
                statusIcon = 'fa-check-circle';
            } else if (step.status === StepStatus.IN_PROGRESS) {
                statusClass = 'text-orange-600';
                statusIcon = 'fa-hammer';
            } else { // StepStatus.NOT_STARTED
                statusClass = 'text-slate-500';
                statusIcon = 'fa-clock';
            }

            return (
              <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-primary dark:text-white text-sm">{step.name}</p>
                  <span className={cx("text-xs font-semibold flex items-center gap-1", statusClass)}>
                    <i className={`fa-solid ${statusIcon}`}></i> {isDelayed ? "Atrasada" : (step.status === StepStatus.COMPLETED ? "Concluída" : (step.status === StepStatus.IN_PROGRESS ? "Em Andamento" : "Pendente"))}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// NEW: MaterialsNeeded Component
const MaterialsNeeded = ({
  focusWork,
  materials,
  steps,
  onOpenWork,
}: {
  focusWork: Work;
  materials: Material[];
  steps: Step[];
  onOpenWork: () => void;
}) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const threeDaysFromNow = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + 3);
    return d;
  }, [today]);

  const relevantMaterials = useMemo(() => {
    return materials.filter(mat => {
      if (!mat.stepId || mat.purchasedQty >= mat.plannedQty) return false; // Already purchased or no step

      const linkedStep = steps.find(s => s.id === mat.stepId);
      if (!linkedStep) return false;

      // Normalize step dates to local midnight for consistent comparison
      const [yearS, monthS, dayS] = linkedStep.startDate.split('-').map(Number);
      const stepStartDate = new Date(yearS, monthS - 1, dayS, 0, 0, 0, 0);

      // Rule 1: Step starts in up to 3 days (inclusive)
      const isUpcoming = stepStartDate >= today && stepStartDate <= threeDaysFromNow;

      // Rule 2: Step has already started (or is today) AND material is pending/partial
      const hasStartedAndPending = stepStartDate <= today && mat.purchasedQty < mat.plannedQty;
      
      return isUpcoming || hasStartedAndPending;
    });
  }, [materials, steps, today, threeDaysFromNow]);

  if (relevantMaterials.length === 0) {
    return null; // Don't render the section if no relevant materials
  }

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-black text-slate-900 dark:text-white">Materiais para Compra</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Organize suas compras para não atrasar a obra</p>
        </div>
        <button onClick={onOpenWork} className="text-xs font-extrabold text-secondary hover:opacity-80 px-3 py-1.5 rounded-lg bg-secondary/5 transition-colors" aria-label="Ver todos os materiais">
          Ver todos os materiais →
        </button>
      </div>

      <div className="space-y-3"> {/* Reduced space-y-4 to space-y-3 */}
        {relevantMaterials.map(mat => {
          const linkedStep = steps.find(s => s.id === mat.stepId);
          const statusText = mat.purchasedQty === 0 ? "Pendente" : "Parcial";
          const statusClass = mat.purchasedQty === 0 ? "text-red-500" : "text-orange-500";
          const progress = (mat.purchasedQty / mat.plannedQty) * 100;

          return (
            <div key={mat.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-primary dark:text-white text-sm">{mat.name}</p>
                <span className={cx("text-xs font-semibold flex items-center gap-1", statusClass)}>
                  <i className="fa-solid fa-box"></i> {statusText}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text