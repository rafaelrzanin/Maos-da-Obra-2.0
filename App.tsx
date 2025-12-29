
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  const { user, authLoading, isUserAuthFinished, logout, isSubscriptionValid, trialDaysRemaining, updatePlan } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for sidebar visibility

  // Log Auth State for debugging
  useEffect(() => {
    console.log(`[Layout] Render - authLoading: ${authLoading}, isUserAuthFinished: ${isUserAuthFinished}, User: ${user ? user.email : 'null'}, Path: ${location.pathname}`);
  }, [authLoading, isUserAuthFinished, user, location.pathname]);

  // Scroll to top on route change
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
  if (!isUserAuthFinished || authLoading) return <LoadingScreen />; 
  
  // If no user, redirect to login.
  if (!user) return <Navigate to="/login" replace />;

  const isSettingsPage = location.pathname === '/settings';
  const isCheckoutPage = location.pathname === '/checkout';
  
  // Check if AI trial is active
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0 && user?.plan !== PlanType.VITALICIO;

  // If subscription is not valid and AI trial is not active, and not on settings/checkout page, redirect to settings
  if (!isSubscriptionValid && !isAiTrialActive && !isSettingsPage && !isCheckoutPage) {
      return <Navigate to="/settings" replace />;
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 transition-colors">
      {/* Top Header */}
      <header className="bg-primary text-white p-4 flex items-center justify-between shadow-md print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="text-xl">
            <i className="fa-solid fa-bars"></i>
          </button>
          <h1 className="text-xl font-bold">MÃOS DA OBRA</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="text-xl">
            {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
          </button>
          <button onClick={logout} className="text-xl">
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </header>
      
      {/* Sidebar Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      {/* Sidebar Content */}
      <nav className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-primary-light shadow-lg z-50 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary dark:text-white">Menu</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="text-primary dark:text-white text-xl">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        <ul className="py-4 space-y-2">
          <li>
            <button onClick={() => navigate('/')} className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <i className="fa-solid fa-home mr-3"></i> Dashboard
            </button>
          </li>
          <li>
            <button onClick={() => navigate('/create')} className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <i className="fa-solid fa-plus-circle mr-3"></i> Nova Obra
            </button>
          </li>
          <li>
            <button onClick={() => navigate('/ai-chat')} className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <i className="fa-solid fa-robot mr-3"></i> Zé da Obra AI
            </button>
          </li>
          <li>
            <button onClick={() => navigate('/settings')} className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <i className="fa-solid fa-gear mr-3"></i> Configurações
            </button>
          </li>
          <li>
            <button onClick={() => navigate('/profile')} className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <i className="fa-solid fa-user mr-3"></i> Meu Perfil
            </button>
          </li>
          <li>
            <button onClick={() => navigate('/tutorials')} className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <i className="fa-solid fa-video mr-3"></i> Tutoriais
            </button>
          </li>
        </ul>
      </nav>

      {/* Main Content Area */}
      <main className="p-4 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} /> 
                
                {/* Protected Routes - Wrapped by Layout */}
                <Route path="/" element={<Layout><Dashboard /></Layout>} />
                <Route path="/create" element={<Layout><CreateWork /></Layout>} />
                <Route path="/work/:id" element={<Layout><WorkDetail /></Layout>} />
                <Route path="/ai-chat" element={<Layout><AiChat /></Layout>} />
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