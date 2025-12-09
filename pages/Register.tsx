import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { HardHat, ArrowRight, User, Mail, Lock, Phone, FileText, Loader2, ShieldCheck } from 'lucide-react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planParam = searchParams.get('plan') || 'mensal';

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    password: ''
  });

  // --- FUNÇÃO INJETADA PARA O TÍTULO ---
  const getPlanName = () => {
    switch (planParam.toLowerCase()) {
      case 'semestral': return 'Semestral';
      case 'vitalicio': return 'Vitalício';
      default: return 'Mensal';
    }
  };
  // --- FIM FUNÇÃO INJETADA ---


  // Formatações automáticas (Máscaras)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;
    
    if (name === 'cpf') {
      value = value.replace(/\D/g, '').substring(0, 11);
      value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (name === 'phone') {
      value = value.replace(/\D/g, '').substring(0, 11);
      value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // SIMULAÇÃO DE BACKEND (Para fins de fluxo)
    localStorage.setItem('tempUser', JSON.stringify({
      ...formData,
      cpf: formData.cpf.replace(/\D/g, '') // Salva CPF limpo
    }));

    setTimeout(() => {
        navigate(`/checkout?plan=${planParam}`);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#172134] flex items-center justify-center p-4 font-sans selection:bg-[#bc5a08] selection:text-white relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute bottom-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#bc5a08]/10 blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Header / Logo */}
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#bc5a08] rounded-2xl shadow-lg shadow-orange-900/20 transform rotate-6 mb-6">
                <HardHat className="text-white w-9 h-9 transform -rotate-6" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Criar sua Conta</h1>
            <p className="text-gray-400 text-sm mt-2">Plano: **{getPlanName()}**</p> {/* Usando a função */}
        </div>

        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Nome */}
                <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors" size={20} />
                    <input 
                        type="text" name="name" placeholder="Nome Completo" required
                        value={formData.name} onChange={handleChange}
                        className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                    />
                </div>

                {/* CPF & Telefone */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative group">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors" size={20} />
                        <input 
                            type="text" name="cpf" placeholder="CPF" required maxLength={14}
                            value={formData.cpf} onChange={handleChange}
                            className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                        />
                    </div>
                    <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors" size={20} />
                        <input 
                            type="tel" name="phone" placeholder="Celular" required maxLength={15}
                            value={formData.phone} onChange={handleChange}
                            className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                {/* Email */}
                <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors" size={20} />
                    <input 
                        type="email" name="email" placeholder="Seu melhor e-mail" required
                        value={formData.email} onChange={handleChange}
                        className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                    />
                </div>

                {/* Senha */}
                <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors" size={20} />
                    <input 
                        type="password" name="password" placeholder="Crie uma senha forte" required minLength={6}
                        value={formData.password} onChange={handleChange}
                        className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-[#bc5a08] hover:bg-[#a64e07] text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <>CONTINUAR PARA PAGAMENTO ({getPlanName()}) <ArrowRight size={20} /></>}
                </button>

            </form>
        </div>
        
        <div className="text-center mt-8">
            <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                <ShieldCheck size={14} /> Seus dados estão 100% protegidos.
            </p>
        </div>

      </div>
    </div>
  );
}
