
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx'; // Import useAuth

// Helper para formatar valores monetários (adicionado para consistência, mas não usado diretamente aqui)
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
      // Aplica a máscara apenas se tiver 11 dígitos para evitar máscaras parciais indesejadas
      if (value.length === 11) {
          value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else {
          // Garante que o formato é mantido durante a digitação
          value = value.replace(/(\d{3})(\d)/, "$1.$2");
          value = value.replace(/(\d{3})(\d)/, "$1.$2");
          value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      }
    }
    if (name === 'phone') {
      value = value.replace(/\D/g, '').substring(0, 11);
      // Aplica a máscara apenas se tiver 11 dígitos para evitar máscaras parciais indesejadas
      if (value.length === 11) {
          value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
      } else {
          // Garante que o formato é mantido durante a digitação
          value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
          value = value.replace(/(\d{5})(\d)/, "$1-$2");
      }
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
    if (cleanPhone.length !== 11 && cleanPhone.length !== 10) { // Allow 10 or 11 digits for phone
        setErrorMsg('Por favor, insira um número de celular válido com 10 ou 11 dígitos.');
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
            planParam // Pass selected plan type - used for redirection to checkout
        );

        if (success) {
            // CORREÇÃO: Redireciona explicitamente para o checkout após o cadastro bem-sucedido.
            // Isso garante que o fluxo de pagamento seja ativado para o plano desejado.
            navigate(`/checkout?plan=${planParam}`, { replace: true });
        } else {
            // signup function in AuthContext already handles alert for common errors
            setErrorMsg("Falha ao criar conta. Verifique os dados e tente novamente.");
        }
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
    <div className="min-h-screen bg-[#172134] flex items-center justify-center p-4 font-sans selection:bg-secondary selection:text-white relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute bottom-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[100px]"></div> {/* Corrigido bg-blue para bg-secondary */}
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95">
        
        {/* Header / Logo */}
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary rounded-2xl shadow-lg shadow-orange-900/20 transform rotate-6 mb-6"> {/* Corrigido bg-[#bc5a08] para bg-secondary */}
                <i className="fa-solid fa-helmet-safety text-white w-9 h-9 transform -rotate-6"></i>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Criar sua Conta</h1>
            <p className="text-gray-400 text-sm mt-2">
                <span className="inline-block px-3 py-1 rounded-full bg-secondary/20 text-secondary text-xs font-bold uppercase tracking-wider">
                    Plano: {getPlanName()}
                </span>
            </p> {/* Melhorado visual do plano */}
        </div>
      </div> {/* Closing the main content div */}
    </div> // Closing the main container div
  );
}
    