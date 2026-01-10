import React, { useState, useEffect, Suspense, lazy } from 'react';
import * as ReactRouter from 'react-router-dom';
import { PlanType } from './types.ts';
import { AuthProvider, ThemeProvider, useAuth, useTheme } from './contexts/AuthContext.tsx';
import { type WorkDetailProps, type MainTab } from './pages/WorkDetail.tsx'; 

// --- IMPORTAÇÕES ESTÁTICAS ---
import Login from './pages/Login.tsx';

// --- Lazy Loading ---
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const CreateWork = lazy(() => import('./pages/CreateWork.tsx'));
const WorkDetail = lazy(() => import('./pages/WorkDetail.tsx') as Promise<{ default: React.ComponentType<WorkDetailProps> }>);
const Settings = lazy(() => import('./pages/Settings.tsx'));
const Profile = lazy(() => import('./pages/Profile.tsx'));
const VideoTutorials = lazy(() => import('./pages/VideoTutorials.tsx'));
const Checkout = lazy(() => import('./pages/Checkout.tsx'));
const AiChat = lazy(() => import('./pages/AiChat.tsx'));
const Notifications = lazy(() => import('./pages/Notifications.tsx'));
const AiWorkPlanner = lazy(() => import('./pages/AiWorkPlanner.tsx'));
const ReportsView = lazy(() => import('./components/ReportsView.tsx'));

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

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error(error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Ops! Algo deu errado.</h1>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-secondary text-white rounded-xl">Recarregar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const BottomNavBar = ({ workId, activeTab, onTabClick }: { workId: string, activeTab: MainTab, onTabClick: (tab: MainTab) => void }) => {
  const navigate = ReactRouter.useNavigate();
  const navItems: { name: MainTab, label: string, icon: string }[] = [
    { name: 'ETAPAS', label: 'Cronograma', icon: 'fa-list-check' },
    { name: 'MATERIAIS', label: 'Materiais', icon: 'fa-boxes-stacked' },
    { name: 'FINANCEIRO', label: 'Financeiro', icon: 'fa-dollar-sign' },
    { name: 'FERRAMENTAS', label: 'Ferramentas', icon: 'fa-screwdriver-wrench' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg md:hidden">
      <nav className="flex justify-around h-16">
        {navItems.map(item => (
          <button
            key={item.name}
            onClick={() => { navigate(`/work/${workId}?tab=${item.name}`); onTabClick(item.name); }}
            className={`flex flex-col items-center justify-center flex-1 text-xs font-bold ${activeTab === item.name ? 'text-secondary' : 'text-slate-500'}`}
          >
            <i className={`fa-solid ${item.icon} text-lg mb-1`}></i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, authLoading, isUserAuthFinished, isSubscriptionValid, trialDaysRemaining, updatePlan, unreadNotificationsCount, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = ReactRouter.useNavigate();
  const location = ReactRouter.useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeWorkDetailTab, setActiveWorkDetailTab] = useState<MainTab>('ETAPAS');

  useEffect(() => {
    window.scrollTo(0, 0);
    setIsSidebarOpen(false);
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl && ['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'].includes(tabFromUrl)) {
      setActiveWorkDetailTab(tabFromUrl as MainTab);
    }
  }, [location.pathname, location.search]);

  if (!isUserAuthFinished || authLoading) return <LoadingScreen />;
  if (!user) return <ReactRouter.Navigate to="/login" replace />;

  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0 && user?.plan !== PlanType.VITALICIO;
  if (!isSubscriptionValid && !isAiTrialActive && !['/settings', '/checkout'].includes(location.pathname)) {
      return <ReactRouter.Navigate to="/settings" replace />;
  }

  const match = ReactRouter.useMatch('/work/:id');
  const workIdForBottomNav = match?.params.id || '';

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <header className="bg-primary text-white p-4 flex items-center justify-between shadow-md print:hidden">
        <button onClick={() => setIsSidebarOpen(true)} className="text-xl p-2"><i className="fa-solid fa-bars"></i></button>
        <h1 className="text-xl font-bold">MÃOS DA OBRA</h1>
        <button onClick={toggleTheme} className="text-xl p-2">{theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}</button>
      </header>
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-[999]" onClick={() => setIsSidebarOpen(false)}></div>}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-primary z-[1000] transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <button onClick={() => setIsSidebarOpen(false)} className="text-white mb-8"><i className="fa-solid fa-xmark"></i> Fechar</button>
          <nav className="space-y-4">
            <button onClick={() => navigate('/')} className="block text-white font-bold w-full text-left">Dashboard</button>
            <button onClick={() => navigate('/settings')} className="block text-white font-bold w-full text-left">Configurações</button>
            <button onClick={() => logout()} className="block text-red-400 font-bold w-full text-left">Sair</button>
          </nav>
        </div>
      </aside>

      <main className={`p-4 max-w-7xl mx-auto ${!!match ? 'pb-20' : ''}`}>{children}</main>
      {!!match && workIdForBottomNav && <BottomNavBar workId={workIdForBottomNav} activeTab={activeWorkDetailTab} onTabClick={setActiveWorkDetailTab} />}
    </div>
  );
};

const App = () => {
  const [activeWorkDetailTab, setActiveWorkDetailTab] = useState<MainTab>('ETAPAS');

  return (
    <ReactRouter.BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <ReactRouter.Routes>
                <ReactRouter.Route path="/login" element={<Login />} />
                <ReactRouter.Route path="/" element={<Layout><Dashboard /></Layout>} />
                <ReactRouter.Route path="/create" element={<Layout><CreateWork /></Layout>} />
                <ReactRouter.Route path="/work/:id" element={<Layout><WorkDetail activeTab={activeWorkDetailTab} onTabChange={setActiveWorkDetailTab} /></Layout>} />
                <ReactRouter.Route path="/settings" element={<Layout><Settings /></Layout>} />
                <ReactRouter.Route path="/ai-chat" element={<Layout><AiChat /></Layout>} />
                <ReactRouter.Route path="/profile" element={<Layout><Profile /></Layout>} />
                <ReactRouter.Route path="/notifications" element={<Layout><Notifications /></Layout>} />
                <ReactRouter.Route path="/tutorials" element={<Layout><VideoTutorials /></Layout>} />
                <ReactRouter.Route path="/checkout" element={<Layout><Checkout /></Layout>} />
                <ReactRouter.Route path="/work/:id/ai-planner" element={<Layout><AiWorkPlanner /></Layout>} />
                <ReactRouter.Route path="/work/:id/reports" element={<Layout><ReportsView /></Layout>} />
                <ReactRouter.Route path="*" element={<ReactRouter.Navigate to="/login" replace />} />
              </ReactRouter.Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </ReactRouter.BrowserRouter>
  );
};

export default App;
