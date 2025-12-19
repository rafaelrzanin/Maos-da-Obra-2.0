
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx'; // Import useAuth

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signup, authLoading } = useAuth(); // Use authLoading from AuthContext

  const planParam = searchParams.get('plan') || 'MENSAL'; // Default to 'MENSAL' if not specified

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '', // Changed from whatsapp to phone to match form.
    password: ''
  });
  const [errorMsg, setErrorMsg] = useState('');

  // --- FUNÇÃO INJETADA PARA O TÍTULO ---
  const getPlanName = () => {
    switch (planParam.toUpperCase()) {
      case 'SEMESTRAL': return 'Semestral';
      case 'VITALICIO': return 'Vitalício';
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
    if (authLoading) return; // Use authLoading
    setErrorMsg('');

    const cleanCpf = formData.cpf.replace(/\D/g, '');
    const cleanPhone = formData.phone.replace(/\D/g, '');

    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
        setErrorMsg('Preencha todos os campos obrigatórios (Nome, E-mail, Senha).');
        return;
    }
    if (cleanCpf.length !== 11) {
        setErrorMsg('Por favor, insira um CPF válido com 11 dígitos.');
        return;
    }
    if (formData.password.length < 6) {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
        return;
    }

    try {
        const success = await signup(
            formData.name,
            formData.email,
            cleanPhone, // Pass clean phone to signup
            formData.password,
            cleanCpf, // Pass clean CPF to signup
            planParam // Pass selected plan type
        );

        if (!success) {
            // signup function in AuthContext already handles alert for common errors
            setErrorMsg("Falha ao criar conta. Verifique os dados e tente novamente.");
        }
        // If success, AuthContext useEffect handles redirect
    } catch (error: any) {
        console.error("Erro ao registrar:", error);
        let msg = "Erro no registro. Tente novamente.";
        if (error.message?.includes("User already registered")) {
            msg = "E-mail já cadastrado. Tente fazer login ou use outro e-mail.";
        }
        setErrorMsg(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#172134] flex items-center justify-center p-4 font-sans selection:bg-[#bc5a08] selection:text-white relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute bottom-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#bc5a08]/10 blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95">
        
        {/* Header / Logo */}
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#bc5a08] rounded-2xl shadow-lg shadow-orange-900/20 transform rotate-6 mb-6">
                <i className="fa-solid fa-helmet-safety text-white w-9 h-9 transform -rotate-6"></i>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Criar sua Conta</h1>
            <p className="text-gray-400 text-sm mt-2">Plano: **{getPlanName()}**</p>
        </div>

        <div className="bg-[#1E293B]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            {errorMsg && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 text-red-200 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
                    <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Nome */}
                <div className="relative group">
                    <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors text-lg"></i>
                    <input 
                        type="text" name="name" placeholder="Nome Completo" required
                        value={formData.name} onChange={handleChange}
                        className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                    />
                </div>

                {/* CPF & Telefone */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative group">
                        <i className="fa-solid fa-id-card absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors text-lg"></i>
                        <input 
                            type="text" name="cpf" placeholder="CPF" required maxLength={14}
                            value={formData.cpf} onChange={handleChange}
                            className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                        />
                    </div>
                    <div className="relative group">
                        <i className="fa-solid fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors text-lg"></i>
                        <input 
                            type="tel" name="phone" placeholder="Celular" required maxLength={15}
                            value={formData.phone} onChange={handleChange}
                            className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                {/* Email */}
                <div className="relative group">
                    <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors text-lg"></i>
                    <input 
                        type="email" name="email" placeholder="Seu melhor e-mail" required
                        value={formData.email} onChange={handleChange}
                        className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                    />
                </div>

                {/* Senha */}
                <div className="relative group">
                    <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#bc5a08] transition-colors text-lg"></i>
                    <input 
                        type="password" name="password" placeholder="Crie uma senha forte" required minLength={6}
                        value={formData.password} onChange={handleChange}
                        className="w-full bg-[#0F172A] border border-gray-700 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-1 focus:ring-[#bc5a08] focus:border-[#bc5a08] outline-none transition-all placeholder:text-gray-600"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={authLoading}
                    className="w-full bg-[#bc5a08] hover:bg-[#a64e07] text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                    {authLoading ? <i className="fa-solid fa-circle-notch fa-spin text-lg"></i> : <>CONTINUAR PARA PAGAMENTO ({getPlanName()}) <i className="fa-solid fa-arrow-right text-lg"></i></>}
                </button>

            </form>
        </div>
        
        <div className="text-center mt-8">
            <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                <i className="fa-solid fa-shield-halved text-sm"></i> Seus dados estão 100% protegidos.
            </p>
            <button 
                onClick={() => navigate('/login')}
                className="text-white/70 hover:text-white font-medium mt-4 text-sm"
            >
                Já tem uma conta? Faça Login
            </button>
        </div>

      </div>
    </div>
  );
}
    
