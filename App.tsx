
import React, { useState, useEffect, Suspense, lazy, Fragment } from 'react';
import * as ReactRouter from 'react-router-dom';
import { PlanType } from './types.ts';
import { AuthProvider, ThemeProvider, useAuth, useTheme } from './contexts/AuthContext.tsx';
// NEW: Import WorkDetailProps for type casting
// FIX: WorkDetail is now default exported, so its type should be imported separately if needed.
import { type WorkDetailProps, type MainTab } from './pages/WorkDetail.tsx'; 

// --- IMPORTAÇÕES ESTÁTICAS (Críticas para velocidade inicial) ---
import Login from './pages/Login.tsx'; // Keep Login static as it's the entry point for unauthenticated users

// --- Lazy Loading ---
// Fix: Explicitly map module.default to default for lazy loading.
const Dashboard = lazy(() => import('./pages/Dashboard.tsx').then(module => ({ default: module.default })));
// Fix: Explicitly map module.default to default for lazy loading.
const CreateWork = lazy(() => import('./pages/CreateWork.tsx').then(module => ({ default: module.default })));
// MODIFICADO: WorkDetail agora aceitará `activeTab` e `onTabChange` como props
// FIX: Correctly type the lazy-loaded WorkDetail component
const WorkDetail = lazy(() => import('./pages/WorkDetail.tsx').then(module => ({ default: module.default as React.ComponentType<WorkDetailProps> })));
// Fix: Explicitly map module.default to default for lazy loading.
const Settings = lazy(() => import('./pages/Settings.tsx').then(module => ({ default: module.default })));
// Fix: Explicitly map module.default to default for lazy loading.
const Profile = lazy(() => import('./pages/Profile.tsx').then(module => ({ default: module.default })));
// Fix: Explicitly map module.default to default for lazy loading.
const VideoTutorials = lazy(() => import('./pages/VideoTutorials.tsx').then(module => ({ default: module.default })));
// Fix: Explicitly map module.default to default for lazy loading.
const Checkout = lazy(() => import('./pages/Checkout.tsx').then(module => ({ default: module.default })));
// Fix: Explicitly map module.default to default for lazy loading.
const AiChat = lazy(() => import('./pages/AiChat.tsx').then(module => ({ default: module.default }))); // Lazy load AiChat page
// Fix: Explicitly map module.default to default for lazy loading.
const Notifications = lazy(() => import('./pages/Notifications.tsx').then(module => ({ default: module.default }))); // NEW: Lazy load Notifications page
// NEW: AiWorkPlanner lazy load, as it is a premium feature
// Fix: Explicitly map module.default to default for lazy loading.
const AiWorkPlanner = lazy(() => import('./pages/AiWorkPlanner.tsx').then(module => ({ default: module.default })));
// FIX: Changed lazy import to correctly handle named export for ReportsView.
const ReportsView = lazy(() => import('./components/ReportsView.tsx').then(module => ({ default: module.ReportsView }))); // NEW: Lazy load ReportsView
// OE #003: Lazy load HelpFAQ page
// Fix: Explicitly map module.default to default for lazy loading.
const HelpFAQ = lazy(() => import('./pages/HelpFAQ.tsx').then(module => ({ default: module.default })));

// --- Componente de Carregamento ---
const LoadingScreen = () => (
  <div className="h-screen w-full flex flex-col items-center justify-center bg-surface dark:bg-slate-950 transition-colors">
    <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-200 dark:bg-slate-800 border-t-secondary rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-secondary">
            <i className="fa-solid fa-helmet-safety"></i>
        </div>
    </div>
    <p className="mt-4 text-slate-400 text-base font-bold animate-pulse">Carregando...</p> {/* OE #004: Increased text size to base */}
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
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-danger-light dark:bg-danger-dark text-danger">
          <i className="fa-solid fa-triangle-exclamation text-6xl mb-6"></i> {/* OE #004: Increased icon size, margin */}
          <h1 className="text-3xl font-bold mb-3">Ops! Algo inesperado aconteceu.</h1> {/* OE #004: Increased text size, margin */}
          <p className="text-center text-base mb-6 text-slate-700 dark:text-slate-300 max-w-sm"> {/* OE #004: Increased text size, margin, added max-width */}
            A aplicação encontrou um problema inesperado e precisa ser reiniciada. Está tudo sob controle.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-7 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors text-lg" /* OE #004: Increased padding, text size */
          >
            Tentar novamente
          </button>
          {/* Detalhes do erro removidos da UI para uma experiência mais limpa, mas ainda logados no console */}
        </div>
      );
    }
    return this.props.children;
  }
}

// NEW: Bottom Navigation Bar Component
const BottomNavBar = ({ workId, activeTab, onTabClick }: { workId: string, activeTab: MainTab, onTabClick: (tab: MainTab) => void }) => {
  const navigate = ReactRouter.useNavigate();

  const navItems: { name: MainTab, label: string, icon: string }[] = [
    { name: 'ETAPAS', label: 'Cronograma', icon: 'fa-list-check' },
    { name: 'MATERIAIS', label: 'Materiais', icon: 'fa-boxes-stacked' },
    { name: 'FINANCEIRO', label: 'Financeiro', icon: 'fa-dollar-sign' },
    { name: 'FERRAMENTAS', label: 'Ferramentas', icon: 'fa-screwdriver-wrench' },
  ];

  const handleNavClick = (tabName: MainTab) => {
    // This will either update the tab if already on WorkDetail, or navigate to WorkDetail with the tab parameter
    navigate(`/work/${workId}?tab=${tabName}`);
    onTabClick(tabName); // Also update local state
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg md:hidden">
      <nav className="flex justify-around h-16">
        {navItems.map(item => (
          <button
            key={item.name}
            onClick={() => handleNavClick(item.name)}
            className={`flex flex-col items-center justify-center flex-1 text-xs font-bold transition-colors pt-2 ${ /* OE #004: Added pt-2 for better icon/text spacing */
              activeTab === item.name ? 'text-secondary' : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white'
            }`}
            aria-current={activeTab === item.name ? 'page' : undefined}
          >
            <i className={`fa-solid ${item.icon} text-lg mb-1`}></i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};


// Layout Component - Only applies to authenticated, subscribed areas of the app
const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, authLoading, isUserAuthFinished, isSubscriptionValid, trialDaysRemaining, updatePlan, unreadNotificationsCount, logout } = useAuth(); // NEW: Get unreadNotificationsCount, logout
  const { theme, toggleTheme } = useTheme();
  const navigate = ReactRouter.useNavigate();
  const location = ReactRouter.useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar state
  // NEW: State to control WorkDetail's active tab when navigated via BottomNavBar
  // FIX: Explicitly type activeWorkDetailTab as MainTab
  const [activeWorkDetailTab, setActiveWorkDetailTab] = useState<MainTab>('ETAPAS'); 

  // Log Auth State for debugging
  useEffect(() => {
    console.log(`[App - Layout] Render. Path: ${location.pathname}, authLoading: ${authLoading}, isUserAuthFinished: ${isUserAuthFinished}, User: ${user ? user.email : 'null'}`);
  }); // Run on every render for detailed debugging


  // Scroll to top on route change & close sidebar
  useEffect(() => {
    window.scrollTo(0, 0);
    setIsSidebarOpen(false); // Close sidebar on route change

    // NEW: Update activeWorkDetailTab from URL query params
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab');
    // FIX: Validate tabFromUrl before casting and setting state
    if (tabFromUrl && ['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'].includes(tabFromUrl)) {
      setActiveWorkDetailTab(tabFromUrl as MainTab);
    } else {
      setActiveWorkDetailTab('ETAPAS'); // Default if no tab param
    }
  }, [location.pathname, location.search]);

  // Handle plan update from checkout success
  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const status = params.get('status');
      const planParam = params.get('plan') as PlanType | null;

      if (status === 'success' && user) {
          if (planParam) {
              updatePlan(planParam).then(() => {
                  alert("Pagamento confirmado! Plano atualizado com sucesso.");
                  // Clear query params after processing
                  navigate(location.pathname, { replace: true });
              });
          } else {
              // Clear query params even if no planParam, if just a generic success
              navigate(location.pathname, { replace: true });
          }
      }
  }, [location.search, user, updatePlan, navigate, location.pathname]);

  // Use isUserAuthFinished for the initial loading screen
  // This is the critical guard to prevent rendering children if auth state is not known
  if (!isUserAuthFinished || authLoading) {
    console.log("[App - Layout] Displaying LoadingScreen due to auth state.");
    return <LoadingScreen />; 
  }
  
  // If no user, redirect to login. This happens after initial auth check is finished.
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
    { path: '/ai-chat', icon: 'fa-helmet-safety', label: 'Zé da Obra AI' },
    { path: '/notifications', icon: 'fa-bell', label: 'Alertas', badge: unreadNotificationsCount },
    { path: '/profile', icon: 'fa-user', label: 'Meu Perfil' }, // Added Profile
    { path: '/tutorials', icon: 'fa-video', label: 'Tutoriais em Vídeo' }, // Added Tutorials
    { path: '/settings', icon: 'fa-gear', label: 'Configurações' },
    { path: '/help', icon: 'fa-question-circle', label: 'Ajuda e Dúvidas' }, // OE #003: Added HelpFAQ link
  ];

  // Determine if current route is a WorkDetail page (to show bottom nav)
  const match = ReactRouter.useMatch('/work/:id');
  const isWorkDetailPage = !!match;
  const workIdForBottomNav = match?.params.id || '';

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 transition-colors"> 
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
      <main className={`p-4 max-w-7xl mx-auto ${isWorkDetailPage ? 'pb-20' : ''}`}> {/* Added pb-20 to main content if WorkDetail */}
        {/* Suspense is now at the global level below */}
        {children}
      </main>

      {/* NEW: Floating Zé da Obra AI Button */}
      <button
        onClick={() => navigate('/ai-chat')}
        className="fixed bottom-4 right-4 z-50 w-16 h-16 rounded-full bg-secondary shadow-lg hover:bg-secondary-dark focus:outline-none focus:ring-4 focus:ring-secondary/50 transition-all duration-200 flex items-center justify-center text-3xl text-white md:bottom-8 md:right-8"
        aria-label="Abrir chat do Zé da Obra AI"
      >
        <i className="fa-solid fa-helmet-safety"></i>
      </button>

      {/* NEW: Bottom Navigation Bar */}
      {isWorkDetailPage && workIdForBottomNav && (
        <BottomNavBar 
          workId={workIdForBottomNav} 
          activeTab={activeWorkDetailTab} 
          onTabClick={setActiveWorkDetailTab} 
        />
      )}
    </div>
  );
};

// NEW: Component to manage routing content based on authentication state
const AppRouterContent = () => {
  const [activeWorkDetailTab, setActiveWorkDetailTab] = useState<MainTab>('ETAPAS'); // Centralized state for WorkDetail tab
  const { user, authLoading, isUserAuthFinished } = useAuth(); // Get auth state here, now within AuthProvider

  if (authLoading || !isUserAuthFinished) {
    return <LoadingScreen />;
  }

  // Once auth is finished, decide which set of routes to render
  if (!user) {
    // User is NOT authenticated -> Render public routes
    return (
      <ReactRouter.Routes>
        {/* Fix: Login is imported directly and should not be lazy-loaded, so no .then() needed. */}
        <ReactRouter.Route path="/login" element={<Login />} />
        {/* Wildcard route to redirect any unmatched path to login */}
        <ReactRouter.Route path="*" element={<ReactRouter.Navigate to="/login" replace />} />
      </ReactRouter.Routes>
    );
  } else {
    // User IS authenticated -> Render protected routes wrapped by Layout
    // The Layout itself contains the Suspense for its children.
    return (
      <ReactRouter.Routes>
        <ReactRouter.Route path="/" element={<Layout><Dashboard /></Layout>} />
        <ReactRouter.Route path="/create" element={<Layout><CreateWork /></Layout>} />
        {/* Modified WorkDetail route to include optional 'tab' parameter */}
        <ReactRouter.Route 
          path="/work/:id" 
          element={<Layout><WorkDetail activeTab={activeWorkDetailTab} onTabChange={setActiveWorkDetailTab} /></Layout>} 
        />
        <ReactRouter.Route path="/ai-chat" element={<Layout><AiChat /></Layout>} />
        <ReactRouter.Route path="/notifications" element={<Layout><Notifications /></Layout>} />
        <ReactRouter.Route path="/settings" element={<Layout><Settings /></Layout>} />
        <ReactRouter.Route path="/profile" element={<Layout><Profile /></Layout>} />
        <ReactRouter.Route path="/tutorials" element={<Layout><VideoTutorials /></Layout>} />
        <ReactRouter.Route path="/checkout" element={<Layout><Checkout /></Layout>} /> 
        {/* NEW: Route for AI Planner */}
        <ReactRouter.Route path="/work/:id/ai-planner" element={<Layout><AiWorkPlanner /></Layout>} />
        {/* NEW: Route for ReportsView */}
        <ReactRouter.Route path="/work/:id/reports" element={<Layout><ReportsView /></Layout>} />
        {/* OE #003: Route for HelpFAQ */}
        <ReactRouter.Route path="/help" element={<Layout><HelpFAQ /></Layout>} />
        {/* Wildcard route to redirect any unmatched path to dashboard for logged-in users */}
        <ReactRouter.Route path="*" element={<ReactRouter.Navigate to="/" replace />} />
      </ReactRouter.Routes>
    );
  }
};

const App = () => {
  return (
    <ReactRouter.BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            {/* Global Suspense for all routes, as requested in the final architectural correction. */}
            {/* This ensures lazy-loaded components are handled from the top level. */}
            <Suspense fallback={<LoadingScreen />}>
              <AppRouterContent /> {/* Now all routing logic is encapsulated here */}
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </ReactRouter.BrowserRouter>
  );
};

export default App;
