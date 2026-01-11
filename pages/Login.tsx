

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import * as ReactRouter from 'react-router-dom';
import { dbService } from '../services/db.ts';

const Login = () => {
  const { login, signup, user, authLoading, isUserAuthFinished, isSubscriptionValid } = useAuth();
  const navigate = ReactRouter.useNavigate();
  const location = ReactRouter.useLocation();
  const [searchParams] = ReactRouter.useSearchParams(); // NEW: To read plan from URL

  // Mode: 'login' or 'register'
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register Form State
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerCpf, setRegisterCpf] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password Recovery State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'IDLE' | 'SENDING' | 'SENT' | 'ERROR'>('IDLE');

  // Detect plan from URL (for pre-selection/redirect after signup)
  const planParam = searchParams.get('plan');

  console.log("[Login] Component rendered. Current user from AuthContext:", user ? user.email : 'null', "Auth Loading:", authLoading, "isUserAuthFinished:", isUserAuthFinished, "Mode:", mode, "PlanParam:", planParam);

  // Main redirect logic
  useEffect(() => {
    console.log("[Login useEffect] AuthState:", { user: user ? user.email : 'null', authLoading, isUserAuthFinished, isSubscriptionValid, planParam, currentPath: location.pathname });

    if (isUserAuthFinished && user && !authLoading) {
        console.log("[Login useEffect] Auth Finished, User exists, and Auth not loading. Checking redirect conditions...");
        if (planParam) {
            console.log("[Login useEffect] Redirecting to /checkout due to planParam:", planParam);
            navigate(`/checkout?plan=${planParam}`, { replace: true });
        } 
        else if (isSubscriptionValid) {
            console.log("[Login useEffect] Redirecting to / (Dashboard) due to valid subscription.");
            navigate('/', { replace: true });
        } 
        else {
            console.log("[Login useEffect] Redirecting to /settings (Subscription management).");
            navigate('/settings', { replace: true });
        }
    } else if (!user && isUserAuthFinished && !authLoading) {
        console.log("[Login useEffect] No user found, Auth Finished, and Auth not loading. Displaying form (current mode: " + mode + ").");
    } else if (!isUserAuthFinished || authLoading) {
        console.log("[Login useEffect] Auth is still loading or not finished. Waiting...");
    }
  }, [user, navigate, planParam, authLoading, isUserAuthFinished, isSubscriptionValid, location.pathname, mode]);


  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
        const success = await login(loginEmail, loginPassword);
        if (!success) {
            setErrorMsg('E-mail ou senha incorretos.');
        } 
    } catch (error: any) {
        console.error("Login exception:", error);
        let msg = "Erro no sistema. Verifique sua conexão.";
        if (error.message?.includes("Invalid login")) {
            msg = "E-mail ou senha incorretos. Se você ainda não tem cadastro, clique em 'Criar conta' abaixo.";
        } else if (error.message?.includes("security purposes")) {
            msg = "Muitas tentativas. Aguarde alguns minutos.";
        }
        setErrorMsg(msg);
    } finally {
        setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    const cleanCpf = registerCpf.replace(/\D/g, '');
    const cleanPhone = registerPhone.replace(/\D/g, '');

    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
        setErrorMsg('Preencha todos os campos obrigatórios (Nome, E-mail, Senha).');
        setLoading(false);
        return;
    }
    if (cleanCpf.length !== 11) {
        setErrorMsg('Por favor, insira um CPF válido com 11 dígitos.');
        setLoading(false);
        return;
    }
    if (cleanPhone.length !== 11 && cleanPhone.length !== 10) { // Allow 10 or 11 digits for phone
        setErrorMsg('Por favor, insira um número de celular válido com 10 ou 11 dígitos.');
        setLoading(false);
        return;
    }
    if (registerPassword.length < 6) {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
        setLoading(false);
        return;
    }

    try {
        // CRITICAL: signup NO LONGER takes planType. Profile is created plan-agnostic.
        const success = await signup(
            registerName,
            registerEmail,
            cleanPhone,
            registerPassword,
            cleanCpf
        );

        if (success) {
            // Redirect based on whether a plan was pre-selected from external link
            if (planParam) {
                console.log("[Register Submit] Signup successful with planParam. Redirecting to checkout.");
                navigate(`/checkout?plan=${planParam}`, { replace: true });
            } else {
                console.log("[Register Submit] Signup successful without planParam. Redirecting to settings.");
                navigate('/settings', { replace: true });
            }
        } else {
            setErrorMsg("Falha ao criar conta. Verifique os dados e tente novamente.");
        }
    } catch (error: any) {
        console.error("Erro ao registrar:", error);
        let msg = "Erro no registro. Tente novamente.";
        if (error.message?.includes("User already registered")) {
            msg = "E-mail já cadastrado. Tente fazer login ou use outro e-mail.";
        }
        setErrorMsg(msg);
    } finally {
        setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setLoading(true);
    setErrorMsg('');
    const { error } = await dbService.loginSocial(provider);

    if (error) {
        console.error(error);
        setErrorMsg("Erro no login com Google. Verifique se o domínio da Vercel está autorizado no Supabase.");
    } 
    // Redirecionamento é tratado pelo useEffect principal após onAuthChange
    setLoading(false);
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
          setErrorMsg('Erro ao enviar e-mail. Verifique se o e-mail está correto.');
      }
  };

  // Common input change handler for both forms with masks
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;

    // Apply masks
    if (name === 'cpf') {
        value = value.replace(/\D/g, '').substring(0, 11);
        if (value.length === 11) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        } else {
            value = value.replace(/(\d{3})(\d)/, "$1.$2");
            value = value.replace(/(\d{3})(\d)/, "$1.$2");
            value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        }
    }
    if (name === 'phone') {
        value = value.replace(/\D/g, '').substring(0, 11);
        if (value.length === 11) {
            value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        } else {
            value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
            value = value.replace(/(\d{5})(\d)/, "$1-$2");
        }
    }

    if (mode === 'login') {
        if (name === 'email') setLoginEmail(value);
        if (name === 'password') setLoginPassword(value);
    } else { // register mode
        if (name === 'name') setRegisterName(value);
        if (name === 'email') setRegisterEmail(value);
        if (name === 'cpf') setRegisterCpf(value);
        if (name === 'phone') setRegisterPhone(value);
        if (name === 'password') setRegisterPassword(value);
    }
    setErrorMsg(''); // Clear error on input change
  };


  if (!isUserAuthFinished || authLoading) {
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
            <div className="relative z-10 text-center text-white">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-amber-500 mb-4"></i>
                <p className="text-xl font-bold">Carregando...</p>
            </div>
        </div>
    );
  }

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
                  {mode === 'login' ? 'Bem-vindo de volta' : 'Criar sua Conta'}
              </h2>
              {planParam && mode === 'register' && (
                <p className="text-center text-amber-400 text-base mb-5 font-semibold"> {/* OE #004: Increased text size, margin */}
                  Você está se cadastrando para o plano {planParam.toUpperCase()}. Você poderá confirmá-lo após o cadastro.
                </p>
              )}


              {mode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                    <input type="email" placeholder="E-mail" value={loginEmail} onChange={handleInputChange} name="email"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50 placeholder:text-gray-400 dark:placeholder:text-gray-500" /* OE #004: Added placeholder styling */
                        aria-label="E-mail"
                        autoComplete="username"
                    />
                    
                    <input type="password" placeholder="Senha" value={loginPassword} onChange={handleInputChange} name="password"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50 placeholder:text-gray-400 dark:placeholder:text-gray-500" /* OE #004: Added placeholder styling */
                        aria-label="Senha"
                        autoComplete="current-password"
                    />

                    <button type="submit" disabled={loading}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 text-lg" /* OE #004: Increased text size */
                        aria-label="Entrar na sua conta"
                    >
                        {loading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                        Entrar
                    </button>
                </form>
              )}

              {mode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <input type="text" name="name" placeholder="Nome Completo" value={registerName} onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-secondary transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        aria-label="Nome Completo" autoComplete="name" required />
                    <input type="email" name="email" placeholder="E-mail" value={registerEmail} onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-secondary transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        aria-label="E-mail" autoComplete="email" required />
                    <input type="text" name="cpf" placeholder="CPF" value={registerCpf} onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-secondary transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        aria-label="CPF" autoComplete="off" inputMode="numeric" maxLength={14} required />
                    <input type="tel" name="phone" placeholder="Celular (WhatsApp)" value={registerPhone} onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-secondary transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        aria-label="Celular (WhatsApp)" autoComplete="tel" inputMode="tel" maxLength={15} required />
                    <input type="password" name="password" placeholder="Senha (mín. 6 caracteres)" value={registerPassword} onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-secondary transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        aria-label="Senha" autoComplete="new-password" minLength={6} required />

                    <button type="submit" disabled={loading}
                        className="w-full py-4 bg-secondary hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-secondary/20 disabled:opacity-50 flex items-center justify-center gap-2 text-lg" /* OE #004: Increased text size */
                        aria-label="Criar sua conta"
                    >
                        {loading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                        Criar minha conta
                    </button>
                </form>
              )}


              {errorMsg && (
                  <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 text-red-200 rounded-xl text-base font-bold flex items-center gap-2 animate-in fade-in" role="alert"> {/* OE #004: Increased text size */}
                      <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
                  </div>
              )}

              <div className="mt-6 flex flex-col gap-4">
                  <button onClick={() => handleSocialLogin('google')} type="button" disabled={loading} className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors disabled:opacity-50 text-base" aria-label="Entrar com Google"> {/* OE #004: Increased text size */}
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                      Entrar com Google
                  </button>

                  {mode === 'login' && (
                    <div className="flex justify-between items-center text-base"> {/* OE #004: Increased text size */}
                        <button onClick={() => setMode('register')} className="text-white/70 hover:text-white font-medium" aria-label="Criar nova conta">
                            Criar conta
                        </button>
                        <button onClick={() => setShowForgotModal(true)} className="text-amber-400 hover:text-amber-300 font-medium" aria-label="Esqueci minha senha">
                            Esqueci a senha
                        </button>
                    </div>
                  )}
                  {mode === 'register' && (
                    <div className="flex justify-center text-base"> {/* OE #004: Increased text size */}
                        <button onClick={() => setMode('login')} className="text-white/70 hover:text-white font-medium" aria-label="Fazer login se já tem conta">
                            Já tem conta? Faça login aqui
                        </button>
                    </div>
                  )}
              </div>
          </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm relative">
                  <button onClick={() => setShowForgotModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" aria-label="Fechar modal de recuperação de senha"><i className="fa-solid fa-xmark text-xl"></i></button>
                  <h3 className="text-xl font-bold text-white mb-2">Recuperar Senha</h3>
                  <p className="text-slate-400 text-base mb-4">Digite seu e-mail para receber o link de redefinição.</p> {/* OE #004: Increased text size */}
                  
                  {forgotStatus === 'SENT' ? (
                      <div className="bg-green-500/20 border border-green-500/50 text-green-200 p-4 rounded-xl text-center text-base" role="status"> {/* OE #004: Increased text size */}
                          <i className="fa-solid fa-check-circle text-2xl mb-2 block"></i>
                          E-mail enviado! Verifique sua caixa de entrada.
                      </div>
                  ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                          <input type="email" placeholder="Seu e-mail cadastrado" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" required aria-label="E-mail para recuperação de senha" /> {/* OE #004: Added placeholder styling */}
                          <button type="submit" disabled={forgotStatus === 'SENDING'} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all text-lg" aria-label="Enviar link de redefinição de senha"> {/* OE #004: Increased text size */}
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
