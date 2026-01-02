

import React, { useState, useEffect, Suspense, lazy } from 'react';
import * as ReactRouter from 'react-router-dom';
import { PlanType } from './types.ts';
import { AuthProvider, ThemeProvider, useAuth, useTheme } from './contexts/AuthContext.tsx';

// --- IMPORTAÇÕES ESTÁTICAS (Críticas para velocidade inicial) ---
import Login from './pages/Login.tsx'; // Keep Login static as it's the entry point for unauthenticated users

// --- Lazy Loading ---
const Dashboard = lazy(() => import('./pages/Dashboard.tsx').then(module => ({ default: (module as any).default })));
const CreateWork = lazy(() => import('./pages/CreateWork.tsx').then(module => ({ default: (module as any).default })));
const WorkDetail = lazy(() => import('./pages/WorkDetail.tsx').then(module => ({ default: (module as any).default })));
const Settings = lazy(() => import('./pages/Settings.tsx').then(module => ({ default: (module as any).default })));
const Profile = lazy(() => import('./pages/Profile.tsx').then(module => ({ default: (module as any).default })));
const VideoTutorials = lazy(() => import('./pages/VideoTutorials.tsx').then(module => ({ default: (module as any).default })));
const Checkout = lazy(() => import('./pages/Checkout.tsx').then(module => ({ default: (module as any).default })));
const AiChat = lazy(() => import('./pages/AiChat.tsx').then(module => ({ default: (module as any).default }))); // Lazy load AiChat page
// const Register = lazy(() => import('./pages/Register.tsx').then(module => ({ default: (module as any).default }))); // REMOVED: Register absorbed into Login
const Notifications = lazy(() => import('./pages/Notifications.tsx')); // NEW: Lazy load Notifications page


// --- Componente de Carregamento ---
const LoadingScreen = () => (
  <div className="h-screen w-full flex flex-col items-center justify-center bg-surface dark:bg-slate-950 transition-colors">
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
const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, authLoading, isUserAuthFinished, isSubscriptionValid, trialDaysRemaining, updatePlan, unreadNotificationsCount, logout } = useAuth(); // NEW: Get unreadNotificationsCount, logout
  const { theme, toggleTheme } = useTheme();
  const navigate = ReactRouter.useNavigate();
  const location = ReactRouter.useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar state

  // Log Auth State for debugging
  useEffect(() => {
    console.log(`[App - Layout] Render. Path: ${location.pathname}, authLoading: ${authLoading}, isUserAuthFinished: ${isUserAuthFinished}, User: ${user ? user.email : 'null'}`);
  }); // Run on every render for detailed debugging


  // Scroll to top on route change & close sidebar
  useEffect(() => {
    window.scrollTo(0, 0);
    setIsSidebarOpen(false); // Close sidebar on route change
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
  if (!isUserAuthFinished || authLoading) {
    console.log("[App - Layout] Displaying LoadingScreen due to auth state.");
    return <LoadingScreen />; 
  }
  
  // If no user, redirect to login.
  if (!user) {
    console.log("[App - Layout] No user, redirecting to /login.");
    return <ReactRouter.Navigate to="/login" replace />;
  }

  const isSettingsPage = location.pathname === '/settings';
  const isCheckoutPage = location.pathname === '/checkout';
  
  // Check if AI trial is active (user must have isTrial true AND trialDaysRemaining > 0 AND NOT be Vitalício)
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0 && user?.plan !== PlanType.VITALICIO;

  // CRITICAL REDIRECT LOGIC: If subscription is not valid AND AI trial is not active
  // This handles new users (plan: null, isTrial: false) and expired users.
  if (!isSubscriptionValid && !isAiTrialActive && !isSettingsPage && !isCheckoutPage) {
      console.log("[App - Layout] Subscription invalid/AI trial inactive, redirecting to /settings to choose plan.");
      return <ReactRouter.Navigate to="/settings" replace />;
  }
  console.log("[App - Layout] All auth/subscription checks passed, rendering main layout.");

  // Define navigation items for the sidebar
  const navItems = [
    { path: '/', icon: 'fa-home', label: 'Dashboard' },
    { path: '/create', icon: 'fa-plus-circle', label: 'Nova Obra' },
    { path: '/ai-chat', icon: 'fa-robot', label: 'Zé da Obra AI' },
    { path: '/notifications', icon: 'fa-bell', label: 'Alertas', badge: unreadNotificationsCount },
    { path: '/profile', icon: 'fa-user', label: 'Meu Perfil' }, // Added Profile
    { path: '/tutorials', icon: 'fa-video', label: 'Tutoriais em Vídeo' }, // Added Tutorials
    { path: '/settings', icon: 'fa-gear', label: 'Configurações' },
  ];

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 transition-colors"> {/* Removed pb-20 */}
      {/* Top Header */}
      <header className="bg-primary text-white p-4 flex items-center justify-between shadow-md print:hidden">
        <button onClick={() => setIsSidebarOpen(true)} className="text-xl p-2 -ml-2" aria-label="Abrir menu principal">
          <i className="fa-solid fa-bars"></i>
        </button>
        <h1 className="text-xl font-bold absolute left-1/2 -translate-x-1/2">MÃOS DA OBRA</h1>
        <button onClick={toggleTheme} className="text-xl p-2 -mr-2" aria-label="Alternar tema">
          {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
        </button>
      </header>
      
      {/* Sidebar */}
      <div 
        className={`fixed top-0 left-0 h-full w-full max-w-[300px] bg-gradient-to-b from-primary-darker to-primary-dark shadow-2xl z-[1000] transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="navigation"
        aria-label="Menu principal"
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-700"> {/* Adjusted border color for dark theme */}
            <h2 className="text-2xl font-black text-white">
                MÃOS DA <span className="text-secondary">OBRA</span> {/* Logo with accent color */}
            </h2>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white text-xl" aria-label="Fechar menu principal">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <nav className="flex-1 space-y-2">
            {navItems.map(item => (
              <button 
                key={item.path} 
                onClick={() => { navigate(item.path); setIsSidebarOpen(false); }}
                // Fix for Vercel build error: concatenate string and dynamic part
                className={
                  "flex items-center gap-4 w-full py-3 px-4 rounded-xl text-left font-bold transition-colors " +
                  (location.pathname === item.path ? 'bg-secondary/20 text-secondary' : 'text-slate-200 hover:bg-slate-800')
                }
                aria-current={location.pathname === item.path ? 'page' : undefined}
              >
                <div className="relative text-lg w-6 flex justify-center">
                  <i className={`fa-solid ${item.icon}`}></i>
                  {item.badge && item.badge > 0 && item.path === '/notifications' && (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none" aria-label={`${item.badge} notificações não lidas`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          
          {/* High Premium User Info Card */}
          {user && (
            <div className="mt-8 p-4 rounded-xl bg-gradient-gold shadow-lg flex items-center gap-4 border border-amber-800">
                <div className="w-12 h-12 rounded-full bg-amber-900 text-white flex items-center justify-center text-xl font-bold shadow-inner">
                    {user.name.charAt(0)}
                </div>
                <div>
                    <p className="font-bold text-white text-md">{user.name}</p>
                    <p className="text-xs text-amber-100 uppercase tracking-wide">{user.plan || 'Plano Básico'}</p>
                </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-700"> {/* Adjusted border color for dark theme */}
            <button 
                onClick={() => { logout(); setIsSidebarOpen(false); }}
                className="flex items-center gap-4 w-full py-3 px-4 rounded-xl text-left font-bold transition-colors text-red-400 hover:bg-red-500/20"
                aria-label="Sair da conta"
            >
                <i className="fa-solid fa-right-from-bracket text-lg w-6 flex justify-center"></i> Sair da Conta
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[999] animate-in fade-in cursor-pointer" 
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      {/* Main Content Area */}
      <main className="p-4 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
};

const App = () => {
  return (
    <ReactRouter.BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <ReactRouter.Routes>
                {/* Public Routes */}
                <ReactRouter.Route path="/login" element={<Login />} />
                {/* <ReactRouter.Route path="/register" element={<Register />} /> REMOVED: Register absorbed into Login */}
                
                {/* Protected Routes - Wrapped by Layout */}
                <ReactRouter.Route path="/" element={<Layout><Dashboard /></Layout>} />
                <ReactRouter.Route path="/create" element={<Layout><CreateWork /></Layout>} />
                <ReactRouter.Route path="/work/:id" element={<Layout><WorkDetail /></Layout>} />
                <ReactRouter.Route path="/ai-chat" element={<Layout><AiChat /></Layout>} />
                <ReactRouter.Route path="/notifications" element={<Layout><Notifications /></Layout>} />
                <ReactRouter.Route path="/settings" element={<Layout><Settings /></Layout>} />
                <ReactRouter.Route path="/profile" element={<Layout><Profile /></Layout>} />
                <ReactRouter.Route path="/tutorials" element={<Layout><VideoTutorials /></Layout>} />
                <ReactRouter.Route path="/checkout" element={<Layout><Checkout /></Layout>} /> 
                
                <ReactRouter.Route path="*" element={<ReactRouter.Navigate to="/login" replace />} /> {/* Redirects to login if route not found */}
              </ReactRouter.Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </ReactRouter.BrowserRouter>
  );
};

export default App;