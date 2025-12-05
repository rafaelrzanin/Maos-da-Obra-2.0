import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Worker, Supplier } from '../types';
import { ZeModal } from '../components/ZeModal';

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <div className="mb-6">
        <h2 className="text-xl font-bold text-primary dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
);

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [work, setWork] = useState<Work | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'TEAM' | 'SUPPLIER'>('TEAM');
    
    // Data State
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [jobRoles, setJobRoles] = useState<string[]>([]);
    const [supplierCategories, setSupplierCategories] = useState<string[]>([]);
    
    // UI State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [zeModal, setZeModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // Form State
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newNotes, setNewNotes] = useState('');

    useEffect(() => {
        const load = async () => {
            if (!id) return;
            const w = await dbService.getWorkById(id);
            setWork(w || null);
            
            if (w) {
                const [wk, sp, roles, cats] = await Promise.all([
                    dbService.getWorkers(w.userId),
                    dbService.getSuppliers(w.userId),
                    dbService.getJobRoles(),
                    dbService.getSupplierCategories()
                ]);
                setWorkers(wk);
                setSuppliers(sp);
                setJobRoles(roles);
                setSupplierCategories(cats);
            }
            setLoading(false);
        };
        load();
    }, [id]);

    const mode = tab;
    const items = mode === 'TEAM' ? workers : suppliers;
    const options = mode === 'TEAM' ? jobRoles : supplierCategories;

    const onBack = () => navigate('/');

    const handleEdit = (item: Worker | Supplier) => {
        setEditingId(item.id);
        setNewName(item.name);
        setNewPhone(item.phone);
        setNewNotes(item.notes || '');
        if (mode === 'TEAM') {
            setNewRole((item as Worker).role);
        } else {
            setNewRole((item as Supplier).category);
        }
        setIsAddOpen(true);
    };

    const handleDeleteClick = (itemId: string) => {
        setZeModal({
            isOpen: true,
            title: mode === 'TEAM' ? 'Excluir Profissional' : 'Excluir Fornecedor',
            message: 'Tem certeza? Essa ação não pode ser desfeita.',
            onConfirm: async () => {
                if (mode === 'TEAM') {
                    await dbService.deleteWorker(itemId);
                    setWorkers(prev => prev.filter(w => w.id !== itemId));
                } else {
                    await dbService.deleteSupplier(itemId);
                    setSuppliers(prev => prev.filter(s => s.id !== itemId));
                }
                setZeModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work) return;

        try {
            if (mode === 'TEAM') {
                const payload = {
                    userId: work.userId,
                    name: newName,
                    role: newRole,
                    phone: newPhone,
                    notes: newNotes
                };
                if (editingId) {
                    await dbService.updateWorker({ ...payload, id: editingId });
                } else {
                    await dbService.addWorker(payload);
                }
                const updated = await dbService.getWorkers(work.userId);
                setWorkers(updated);
            } else {
                const payload = {
                    userId: work.userId,
                    name: newName,
                    category: newRole,
                    phone: newPhone,
                    email: '',
                    address: '',
                    notes: newNotes
                };
                if (editingId) {
                    await dbService.updateSupplier({ ...payload, id: editingId } as Supplier);
                } else {
                    await dbService.addSupplier(payload);
                }
                const updated = await dbService.getSuppliers(work.userId);
                setSuppliers(updated);
            }
            setIsAddOpen(false);
            setEditingId(null);
            setNewName('');
            setNewRole('');
            setNewPhone('');
            setNewNotes('');
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen text-primary"><i className="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>;
    if (!work) return <div className="p-8 text-center text-slate-500">Obra não encontrada</div>;

    return (
        <div className="max-w-3xl mx-auto py-6 px-4 pb-20">
            {/* Header / Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button 
                    onClick={() => setTab('TEAM')} 
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${tab === 'TEAM' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className="fa-solid fa-helmet-safety"></i> Minha Equipe
                </button>
                <button 
                    onClick={() => setTab('SUPPLIER')} 
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${tab === 'SUPPLIER' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className="fa-solid fa-truck"></i> Fornecedores
                </button>
            </div>

            {/* Main Content (Restored Fragment) */}
            <div className="animate-in fade-in slide-in-from-right-4">
                <button onClick={onBack} className="mb-6 text-sm