
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
  const { user, authLoading, isUserAuthFinished, logout, isSubscriptionValid, trialDaysRemaining, updatePlan } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Log Auth State for debugging
  useEffect(() => {
    console.log(`[Layout] Render - authLoading: ${authLoading}, isUserAuthFinished: ${isUserAuthFinished}, User: ${user ? user.email : 'null'}, Path: ${location.pathname}`);
  }, [authLoading, isUserAuthFinished, user, location.pathname]);

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
  
  // Check if AI trial is active (logic is fine, just removed UI from here)
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0 && user?.plan !== PlanType.VITALICIO;

  // If subscription is not valid and AI trial is not active, and not on settings/checkout page, redirect to settings
  if (!isSubscriptionValid && !isAiTrialActive && !isSettingsPage && !isCheckoutPage) {
      return <Navigate to="/settings" replace />;
  }

  // --- START REVERTED NAVIGATION ---
  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 transition-colors">
      <header className="bg-primary text-white p-4 flex items-center justify-between shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2">
            <i className="fa-solid fa-arrow-left text-xl"></i>
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
      
      <main className="p-4 max-w-7xl mx-auto">
        {children}
      </main>

      {/* Simplified bottom navigation for mobile-first approach, or can be removed if not needed */}
      <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-primary-light shadow-lg md:hidden z-40 print:hidden">
        <div className="flex justify-around py-3">
          <button onClick={() => navigate('/')} className={`flex flex-col items-center text-xs font-medium ${location.pathname === '/' ? 'text-secondary' : 'text-slate-500 dark:text-slate-400'}`}>
            <i className="fa-solid fa-home text-lg mb-1"></i> Dashboard
          </button>
          <button onClick={() => navigate('/create')} className={`flex flex-col items-center text-xs font-medium ${location.pathname === '/create' ? 'text-secondary' : 'text-slate-500 dark:text-slate-400'}`}>
            <i className="fa-solid fa-plus-circle text-lg mb-1"></i> Nova Obra
          </button>
          <button onClick={() => navigate('/ai-chat')} className={`flex flex-col items-center text-xs font-medium ${location.pathname === '/ai-chat' ? 'text-secondary' : 'text-slate-500 dark:text-slate-400'}`}>
            <i className="fa-solid fa-robot text-lg mb-1"></i> Zé da Obra AI
          </button>
          <button onClick={() => navigate('/settings')} className={`flex flex-col items-center text-xs font-medium ${location.pathname === '/settings' ? 'text-secondary' : 'text-slate-500 dark:text-slate-400'}`}>
            <i className="fa-solid fa-gear text-lg mb-1"></i> Config.
          </button>
        </div>
      </nav>
    </div>
  );
  // --- END REVERTED NAVIGATION ---
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
