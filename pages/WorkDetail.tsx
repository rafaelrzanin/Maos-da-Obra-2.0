
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, PlanType, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile } from '../types.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx';
import { STANDARD_CHECKLISTS, CONTRACT_TEMPLATES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'SCHEDULE' | 'MATERIALS' | 'FINANCIAL' | 'MORE';
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO'; // Keep for reports view

// --- DATE HELPERS ---
const parseDateNoTimezone = (dateStr: string) => {
    if (!dateStr) return '--/--';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    }
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch (e) {
        return dateStr;
    }
};

// --- RENDER FUNCTIONS FOR REPORT SECTIONS (REUSABLE) ---
// These are kept as separate render functions for the REPORTS subView
interface ReportProps {
    steps: Step[];
    materials: Material[];
    expenses: Expense[];
    workers: Worker[];
    suppliers: Supplier[];
    work: Work;
    today: string; // ISO string 'YYYY-MM-DD'
    parseDateNoTimezone: (dateStr: string) => string;
}

const RenderCronogramaReport: React.FC<ReportProps> = ({ steps, today, parseDateNoTimezone }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
        <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-calendar-days text-secondary"></i> Cronograma
        </h3>
        <div className="space-y-4">
            {steps.map((s, idx) => {
                const isDone = s.status === StepStatus.COMPLETED;
                const isInProgress = s.status === StepStatus.IN_PROGRESS;
                const isDelayed = s.endDate < today && !isDone;

                let bgColorClass = 'bg-slate-50 dark:bg-slate-800';
                let textColorClass = 'text-slate-600 dark:text-slate-300';
                let iconClass = 'fa-clock';
                let iconColor = 'text-slate-400';

                if (isDone) {
                    bgColorClass = 'bg-green-50 dark:bg-green-900/10';
                    textColorClass = 'text-green-700 dark:text-green-400';
                    iconClass = 'fa-check-circle';
                    iconColor = 'text-green-600';
                } else if (isDelayed) {
                    bgColorClass = 'bg-red-50 dark:bg-red-900/10';
                    textColorClass = 'text-red-700 dark:text-red-400';
                    iconClass = 'fa-triangle-exclamation';
                    iconColor = 'text-red-600';
                } else if (isInProgress) {
                    bgColorClass = 'bg-orange-50 dark:bg-orange-900/10';
                    textColorClass = 'text-orange-700 dark:text-orange-400';
                    iconClass = 'fa-hammer';
                    iconColor = 'text-orange-600';
                }
                
                return (
                    <div key={s.id} className={`p-3 rounded-xl border ${bgColorClass} border-slate-200 dark:border-slate-700`}>
                        <div className="flex items-center gap-3 mb-2">
                            <i className={`fa-solid ${iconClass} ${iconColor} text-lg`}></i>
                            <p className={`font-bold text-sm ${textColorClass}`}>{String(idx + 1).padStart(2, '0')}. ${s.name}</p>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>Início: ${parseDateNoTimezone(s.startDate)}</span>
                            <span>Fim: ${parseDateNoTimezone(s.endDate)}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const RenderMateriaisReport: React.FC<ReportProps> = ({ steps, materials, parseDateNoTimezone }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
        <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-boxes-stacked text-secondary"></i> Materiais
        </h3>
        <div className="space-y-6">
            {[...steps, { id: 'general-mat', name: 'Materiais Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step) => {
                const groupMaterials = materials.filter(m => {
                    if (step.id === 'general-mat') return !m.stepId;
                    return m.stepId === step.id;
                });

                if (groupMaterials.length === 0) return null;

                const isGeneral = step.id === 'general-mat';
                const stepLabel = isGeneral ? step.name : `Etapa: ${step.name}`;

                return (
                    <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <h4 className="font-bold text-primary dark:text-white text-sm uppercase tracking-wide mb-3">${stepLabel}</h4>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                            {groupMaterials.map(m => {
                                const isFullyPurchased = m.purchasedQty >= m.plannedQty;
                                const itemStatusClass = isFullyPurchased ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
                                const itemIconClass = isFullyPurchased ? 'fa-check-circle' : 'fa-circle-exclamation';

                                return (
                                    <li key={m.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs">
                                        <p className="font-bold text-primary dark:text-white mb-1 sm:mb-0">${m.name} ${m.brand && <span className="text-slate-500 font-normal">(${m.brand})</span>}</p>
                                        <div className="flex items-center gap-2 font-mono text-right">
                                            <span className="text-slate-700 dark:text-slate-300">Sug.: ${m.plannedQty} ${m.unit}</span>
                                            <span className={`font-bold ${itemStatusClass} flex items-center gap-1`}>
                                                <i className={`fa-solid ${itemIconClass}`}></i> Compr.: ${m.purchasedQty} ${m.unit}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}
        </div>
    </div>
);

const RenderFinanceiroReport: React.FC<ReportProps> = ({ steps, expenses, materials, workers, suppliers, parseDateNoTimezone }) => { 
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
            <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2"><i className="fa-solid fa-dollar-sign text-secondary"></i> Financeiro</h3>
            <div className="space-y-6">
                {[...steps, { id: 'general-fin', name: 'Despesas Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step) => {
                    const groupExpenses = expenses.filter(e => {
                        if (step.id === 'general-fin') return !e.stepId;
                        return e.stepId === step.id;
                    });

                    if (groupExpenses.length === 0) return null;

                    const isGeneral = step.id === 'general-fin';
                    const stepLabel = isGeneral ? step.