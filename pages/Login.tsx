
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { dbService } from '../services/db';

const Login: React.FC = () => {
  const { login, signup, user, loading: authLoading, isSubscriptionValid } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Password Recovery State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'IDLE' | 'SENDING' | 'SENT' | 'ERROR'>('IDLE');

  // Detect plan from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plan = params.get('plan');
    if (plan) {
      setSelectedPlan(plan);
      setIsLogin(false);
    }
  }, [location.search]);

  // Main redirect logic
  useEffect(() => {
    // Only redirect if user exists and auth is done loading
    if (user && !authLoading) {
        // 1. Se tem um plano selecionado na URL (fluxo de compra), vai pro Checkout
        if (selectedPlan) {
            navigate('/checkout', { replace: true });
        } 
        // 2. Se já tem assinatura válida (Vitalício ou Ativo), vai pro Dashboard
        else if (isSubscriptionValid) {
            navigate('/', { replace: true });
        } 
        // 3. Se é conta nova ou expirada sem plano selecionado, vai para Configurações escolher
        else {
            navigate('/settings', { replace: true });
        }
    }
  }, [user, navigate, selectedPlan, authLoading, isSubscriptionValid]);

  // Helper for CPF mask
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      
      if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      
      setCpf(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
        if (isLogin) {
            const success = await login(email, password);
            if (!success) {
                // Se login retornar false, é erro de credencial (geralmente tratado dentro do dbService com throw, mas se retornar false é genérico)
                alert('E-mail ou senha incorretos.');
                setLoading(false); 
            } 
            // If success, useEffect will handle redirect.
        } else {
            // Signup Flow
            const cleanCpf = cpf.replace(/\D/g, '');
            
            if (!name || cleanCpf.length !== 11) {
                alert('Nome e um CPF válido (11 números) são obrigatórios.');
                setLoading(false);
                return;
            }
            
            const success = await signup(name, email, whatsapp, password, cpf, selectedPlan);
            if (!success) {
                alert("Falha ao criar conta. Tente novamente.");
                setLoading(false);
            }
            // If success, user state updates, triggering useEffect -> navigate
        }
    } catch (error: any) {
        console.error(error);
        
        let msg = "Erro no sistema. Verifique sua conexão.";
        if (error.message?.includes("Invalid login")) {
            msg = "Conta não encontrada ou senha incorreta. Se você ainda não tem cadastro, clique em 'Criar conta' abaixo.";
        } else if (error.message?.includes("User already registered")) {
            msg = "E-mail já cadastrado.";
        } else if (error.message?.includes("security purposes")) {
            msg = "Muitas tentativas. Aguarde alguns minutos.";
        }
        
        alert(msg);
        setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setLoading(true);
    // loginSocial returns the result of supabase.auth.signInWithOAuth
    const { error } = await dbService.loginSocial(provider);

    if (error) {
        console.error(error);
        alert("Erro no login Google. Verifique se o domínio da Vercel está autorizado no Supabase.");
        setLoading(false);
    } 
    // If successful, Supabase handles the redirect automatically.
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!forgotEmail) return;
      
      setForgotStatus('SENDING');
      try {
          const exists = await dbService.resetPassword(forgotEmail);
          setForgotStatus('SENT');
          if (!exists) {
              // Optionally handle "user not found" message differently if desired
          }
      } catch (e) {
          setForgotStatus('ERROR');
      }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-900 font-sans">
      <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070" 
            className="w-full h-full object-cover opacity-60"
            alt="Background"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30"></div>
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95">
          <div className="text-center mb-8 flex flex-col items-center">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center text-white text-3xl mb-4 shadow-xl rotate-6">
                  <i className="fa-solid fa-helmet-safety"></i>
              </div>
              <h1 className="text-3xl font-black text-white">
                  MÃOS DA <span className="text-amber-400">OBRA</span>
              </h1>
              <p className="text-white/90 text-sm mt-2 font-medium">Controle na palma da sua mão</p>
          </div>

          <div className="backdrop-blur-xl bg-black/70 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-white text-center mb-6">
                  {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <>
                        <input type="text" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                        <input type="text" placeholder="WhatsApp (DDD + Número)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                            className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                        <input type="text" placeholder="CPF" value={cpf} onChange={handleCpfChange}
                            className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                    </>
                  )}
                  <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                  
                  <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />

                  <button type="submit" disabled={loading}
                      className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                      {loading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                      {isLogin ? 'Entrar' : 'Criar Conta'}
                  </button>
              </form>

              <div className="mt-6 flex flex-col gap-4">
                  <button onClick={() => handleSocialLogin('google')} type="button" className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors">
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                      Entrar com Google
                  </button>

                  <div className="flex justify-between items-center text-sm">
                      <button onClick={() => setIsLogin(!isLogin)} className="text-white/70 hover:text-white font-medium">
                          {isLogin ? 'Criar conta' : 'Já tenho conta'}
                      </button>
                      {isLogin && (
                          <button onClick={() => setShowForgotModal(true)} className="text-amber-400 hover:text-amber-300 font-medium">
                              Esqueci a senha
                          </button>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm relative">
                  <button onClick={() => setShowForgotModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
                  <h3 className="text-xl font-bold text-white mb-2">Recuperar Senha</h3>
                  <p className="text-slate-400 text-sm mb-4">Digite seu e-mail para receber o link de redefinição.</p>
                  
                  {forgotStatus === 'SENT' ? (
                      <div className="bg-green-500/20 border border-green-500/50 text-green-200 p-4 rounded-xl text-center">
                          <i className="fa-solid fa-check-circle text-2xl mb-2 block"></i>
                          E-mail enviado! Verifique sua caixa de entrada.
                      </div>
                  ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                          <input type="email" placeholder="Seu e-mail cadastrado" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500" required />
                          <button type="submit" disabled={forgotStatus === 'SENDING'} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all">
                              {forgotStatus === 'SENDING' ? 'Enviando...' : 'Enviar Link'}
                          </button>
                      </form>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default Login;

