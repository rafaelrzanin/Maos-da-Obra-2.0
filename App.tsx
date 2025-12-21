

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PlanType } from './types.ts';
import { AuthProvider, ThemeProvider, useAuth, useTheme } from './contexts/AuthContext.tsx';

// --- IMPORTAÇÕES ESTÁTICAS (Críticas para velocidade inicial) ---
import Login from './pages/Login.tsx'; // Keep Login static as it's the entry point for unauthenticated users

// --- Lazy Loading sem tipagem 'as unknown as Promise' e sem extensão .tsx ---
// Fix: Add '.tsx' extension to dynamic imports for correct TypeScript resolution of default exports.
// Fix: Explicitly return the default export for React.lazy to resolve type inference issues.
// Fix: Applied type assertion (module as any).default to resolve Property 'default' does not exist error.
const Dashboard = lazy(() => import('./pages/Dashboard.tsx').then(module => ({ default: (module as any).default })));
const CreateWork = lazy(() => import('./pages/CreateWork.tsx').then(module => ({ default: (module as any).default })));
const WorkDetail = lazy(() => import('./pages/WorkDetail.tsx').then(module => ({ default: (module as any).default })));
const Settings = lazy(() => import('./pages/Settings.tsx').then(module => ({ default: (module as any).default })));
const Profile = lazy(() => import('./pages/Profile.tsx').then(module => ({ default: (module as any).default })));
const VideoTutorials = lazy(() => import('./pages/VideoTutorials.tsx').then(module => ({ default: (module as any).default })));
const Checkout = lazy(() => import('./pages/Checkout.tsx').then(module => ({ default: (module as any).default })));
const AiChat = lazy(() => import('./pages/AiChat.tsx').then(module => ({ default: (module as any).default }))); // NEW: Lazy load AiChat page
const Register = lazy(() => import('./pages/Register.tsx').then(module => ({ default: (module as any).default }))); 


// --- Componente de Carregamento ---
const LoadingScreen = () => (
  <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
    <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 border-t-secondary rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-secondary">
            <i className="fa-solid fa-helmet-safety"></i>
        </div>
    </div>
    <p className="mt-4 text-slate-400 text-sm font-bold animate-pulse">Carregando...</p>
  </div>
);

// --- Global Error Boundary Component ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-danger-light dark:bg-danger-dark text-danger">
          <i className="fa-solid fa-triangle-exclamation text-5xl mb-4"></i>
          <h1 className="text-2xl font-bold mb-2">Ops! Algo deu errado.</h1>
          <p className="text-center text-sm mb-4">
            Parece que houve um erro inesperado. Por favor, tente recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-danger text-white font-bold rounded-xl hover:bg-danger-dark transition-colors"
          >
            Recarregar Página
          </button>
          {this.state.error && (
            <details className="mt-6 p-4 bg-danger-light/50 border border-danger rounded-lg max-w-lg overflow-auto text-xs text-left">
              <summary className="font-bold cursor-pointer">Detalhes do Erro</summary>
              <pre className="whitespace-pre-wrap mt-2 break-words">{this.state.error.toString()}</pre>
              {this.state.errorInfo?.componentStack && (
                <div className="mt-2">
                  <h4 className="font-bold">Component Stack:</h4>
                  <pre className="whitespace-pre-wrap break-words">{this.state.errorInfo.componentStack}</pre>
                </div>
              )}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Layout Component - Only applies to authenticated, subscribed areas of the app
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authLoading, isUserAuthFinished, logout, isSubscriptionValid, trialDaysRemaining, updatePlan } = useAuth(); // Updated isAuthReady to isUserAuthFinished
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAiTrialBanner, setShowAiTrialBanner] = useState(true);

  // Log Auth State for debugging
  useEffect(() => {
    console.log(`[Layout] Render - authLoading: ${authLoading}, isUserAuthFinished: ${isUserAuthFinished}, User: ${user ? user.email : 'null'}, Path: ${location.pathname}`);
  }, [authLoading, isUserAuthFinished, user, location.pathname]); // Updated isAuthReady

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Handle plan update from checkout success
  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const status = params.get('status');
      const planParam = params.get('plan') as PlanType | null;

      if (status === 'success' && user) {
          if (planParam) {
              updatePlan(planParam).then(() => {
                  alert("Pagamento confirmado! Plano atualizado com sucesso.");
                  navigate(location.pathname, { replace: true });
              });
          } else {
              navigate(location.pathname, { replace: true });
          }
      }
  }, [location.search, user, updatePlan, navigate, location.pathname]);

  // Use isUserAuthFinished for the initial loading screen
  // If initial auth check is not done, show loading.
  // We also show loading if `authLoading` is true (meaning an active auth operation is happening).
  if (!isUserAuthFinished || authLoading) return <LoadingScreen />; 
  
  // If no user, redirect to login. This covers all protected routes
  // This condition is now safe because isUserAuthFinished is true,
  // meaning we know definitively there's no user.
  if (!user) return <Navigate to="/login" replace />;

  const isSettingsPage = location.pathname === '/settings';
  const isCheckoutPage = location.pathname === '/checkout';
  
  // Condição para exibir banner de trial
  // Modified to exclude VITALICIO users from seeing the trial banner
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0 && user?.plan !== PlanType.VITALICIO;

  // If subscription is not valid and AI trial is not active, and not on settings/checkout page, redirect to settings
  if (!isSubscriptionValid && !isAiTrialActive && !isSettingsPage && !isCheckoutPage) {
      return <Navigate to="/settings" replace />;
  }

  const navItems = [
    { label: 'Painel Geral', path: '/', icon: 'fa-house' },
    { label: 'Nova Obra', path: '/create', icon: 'fa-plus-circle' },
    { label: 'Zé da Obra AI', path: '/ai-chat', icon: 'fa-robot' },
    { label: 'Tutoriais', path: '/tutorials', icon: 'fa-circle-play' },
    { label: 'Meu Perfil', path: '/profile', icon: 'fa-user' },
    { label: 'Assinatura', path: '/settings', icon: 'fa-gear' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white fixed h-full z-30 shadow-xl">
        <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg">
                <i className="fa-solid fa-helmet-safety"></i>
              </div>
              <div>
                  <h1 className="font-black text-lg tracking-tight leading-none">MÃOS DA</h1>
                  <span className="font-bold text-amber-500 text-sm tracking-widest">OBRA</span>
              </div>
            </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
            {navItems.map(item => (
                <button 
                    key={item.path} 
                    onClick={() => navigate(item.path)} 
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${location.pathname === item.path ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'}`}
                >
                    <i className={`fa-solid ${item.icon} w-6 text-center`}></i>
                    {item.label}
                </button>
            ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
            <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors">
                {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
                <span>Modo {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
            </button>
            <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors mt-2">
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Sair</span>
            </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <nav className="md:hidden fixed top-0 w-full z-50 bg-slate-900 text-white shadow-md">
        <div className="flex justify-between h-16 items-center px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                <i className="fa-solid fa-helmet-safety text-sm"></i>
              </div>
              <span className="font-bold text-lg">MÃOS DA OBRA</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-white">
                <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`}></i>
            </button>
        </div>

        {isMobileMenuOpen && (
            <div className="absolute top-16 left-0 w-full bg-slate-900 border-t border-slate-800 shadow-xl animate-in slide-in-from-top-2">
                <div className="p-4 space-y-2">
                    <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl mb-4">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-amber-500">
                            <i className="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <p className="font-bold text-white">{user.name}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                    </div>
                    {navItems.map(item => (
                        <button key={item.path} onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }} className={`w-full p-3 rounded-xl flex items-center gap-4 font-bold transition-colors ${location.pathname === item.path ? 'bg-amber-500 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                            <i className={`fa-solid ${item.icon} w-6 text-center`}></i> {item.label}
                        </button>
                    ))}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
                        <button onClick={toggleTheme} className="flex-1 py-3 bg-slate-800 rounded-xl text-slate-300"><i className={theme === 'dark' ? "fa-solid fa-sun" : "fa-solid fa-moon"}></i> Tema</button>
                        <button onClick={logout} className="flex-1 py-3 bg-red-900/20 text-red-400 rounded-xl"><i className="fa-solid fa-right-from-bracket"></i> Sair</button>
                    </div>
                </div>
            </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 pt-20 md:pt-0 min-h-screen transition-all">
        <div className="p-4 md:p-8 max-w-7xl mx-auto" key={location.pathname}>
            {/* Trial Banner - ZÉ DA OBRA ONLY */}
            {isAiTrialActive && showAiTrialBanner && (
                <div className="mb-6 bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-6 py-4 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse"><i className="fa-solid fa-robot text-xl"></i></div>
                        <div>
                            <p className="font-bold text-sm md:text-base">Zé da Obra Grátis: Restam {trialDaysRemaining} dias</p>
                            <p className="text-xs opacity-90">Aproveite seu engenheiro virtual ilimitado antes que expire.</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/checkout?plan=VITALICIO')} className="px-6 py-2 bg-white text-indigo-700 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors shadow-sm whitespace-nowrap">
                        Garantir Vitalício
                    </button>
                    {/* Close button for the banner */}
                    <button onClick={() => setShowAiTrialBanner(false)} className="absolute top-2 right-2 text-white/70 hover:text-white p-1 rounded-full">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
            )}
            {children}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary> {/* Wrap Routes with ErrorBoundary */}
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Public Routes - Not wrapped by Layout. They handle their own minimal layout. */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} /> 
                
                {/* Protected Routes - Wrapped by Layout */}
                <Route path="/" element={<Layout><Dashboard /></Layout>} />
                <Route path="/create" element={<Layout><CreateWork /></Layout>} />
                <Route path="/work/:id" element={<Layout><WorkDetail /></Layout>} />
                <Route path="/ai-chat" element={<Layout><AiChat /></Layout>} /> {/* NEW Protected Route for AiChat */}
                <Route path="/settings" element={<Layout><Settings /></Layout>} />
                <Route path="/profile" element={<Layout><Profile /></Layout>} />
                <Route path="/tutorials" element={<Layout><VideoTutorials /></Layout>} />
                <Route path="/checkout" element={<Layout><Checkout /></Layout>} /> 
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
