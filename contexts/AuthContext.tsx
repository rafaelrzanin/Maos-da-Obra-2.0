import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { User, PlanType, DBNotification } from '../types.ts';
import { dbService } from '../services/db.ts';

// --- Theme Context ---
type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType>(null!);
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('maos_theme') as Theme) || 'light');
  useEffect(() => {
    const root = window.document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
    localStorage.setItem('maos_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  authLoading: boolean; // True if any auth operation (initial check, login, refresh) is in progress
  isUserAuthFinished: boolean; // NEW: True once the *initial* auth check has completed
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => Promise<boolean>;
  logout: () => void;
  updatePlan: (plan: PlanType) => Promise<void>;
  refreshUser: () => Promise<void>;
  isSubscriptionValid: boolean;
  isNewAccount: boolean;
  trialDaysRemaining: number | null;
  unreadNotificationsCount: number; // NEW: Unread notifications count
  refreshNotifications: () => Promise<void>; // NEW: Function to refresh notification count
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Initial state: true, as we're loading auth
  const [isUserAuthFinished, setIsUserAuthFinished] = useState(false); // NEW: Initially false
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0); // NEW

  console.log("[AuthProvider] Component rendered. Initial authLoading:", authLoading, "isUserAuthFinished:", isUserAuthFinished);

  const refreshNotifications = useCallback(async () => {
    console.log("[AuthContext] refreshNotifications triggered. User:", user?.id);
    if (user?.id) {
      try {
        const notifications = await dbService.getNotifications(user.id);
        setUnreadNotificationsCount(notifications.length);
      } catch (error) {
        console.error("Error refreshing notifications:", error);
        setUnreadNotificationsCount(0);
      }
    } else {
      setUnreadNotificationsCount(0);
    }
  }, [user]); // Depends on `user`

  useEffect(() => {
    let mounted = true;
    console.log("[AuthContext] Main useEffect for auth setup triggered.");

    // Initial auth check
    const checkInitialAuth = async () => {
      setAuthLoading(true); // Começa com loading
      try {
        console.log("[AuthContext] checkInitialAuth: Calling dbService.getCurrentUser().");
        const currentUser = await dbService.getCurrentUser();
        if (mounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("[AuthContext] Error during initial auth check:", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          setAuthLoading(false); // Termina o loading inicial
          setIsUserAuthFinished(true); // Marca que a checagem inicial foi concluída
          console.log("[AuthContext] checkInitialAuth: Initial auth check finished.");
        }
      }
    };
    checkInitialAuth();


    // Supabase auth state change listener (deve rodar apenas uma vez para registrar o listener)
    // Fix: The callback for dbService.onAuthChange expects a single 'user: User | null' argument.
    const unsubscribe = dbService.onAuthChange(async (user: User | null) => {
      if (!mounted) return;

      console.log("[AuthContext] onAuthChange event received.", { user: user?.id });

      // The `user` argument received here is ALREADY the result of `ensureUserProfile` from `dbService.onAuthChange`.
      // No need to call `dbService.getUserProfile` again or process `_event` and `session`.
      if (mounted) {
        setUser(user);
        if (user) {
          refreshNotifications(); 
        } else {
          setUnreadNotificationsCount(0); // Limpa notificações no logout
        }
        setIsUserAuthFinished(true); // Garante que auth esteja marcado como finished após qualquer evento
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      console.log("[AuthContext] Main useEffect cleanup: Auth listener unsubscribed.");
    };
  }, []); // <--- CRÍTICO: Array de dependências vazio para garantir que o useEffect rode apenas uma vez.

  const isSubscriptionValid = useMemo(() => user ? dbService.isSubscriptionActive(user) : false, [user]);
  const isNewAccount = useMemo(() => user ? !user.subscriptionExpiresAt : true, [user]);
  
  const trialDaysRemaining = useMemo(() => {
      if (user?.isTrial && user.subscriptionExpiresAt) {
          const now = new Date();
          const expires = new Date(user.subscriptionExpiresAt);
          const diffTime = expires.getTime() - now.getTime();
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      }
      return null;
  }, [user]);

  const refreshUser = async () => {
      console.log("[AuthContext] refreshUser called.");
      setAuthLoading(true); // Indicate active loading
      try {
          const currentUser = await dbService.syncSession();
          if (currentUser) {
            setUser(currentUser);
            refreshNotifications(); // Refresh notifications after user data is refreshed
          } else {
            setUser(null); // Clear user if session sync fails
            setUnreadNotificationsCount(0); // Clear notifications
          }
      } finally {
          setAuthLoading(false); // Loading complete
          console.log("[AuthContext] refreshUser finished. Setting authLoading to false.");
      }
  };

  const login = async (email: string, password?: string) => {
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] login called. Setting authLoading to true.");
    try {
        const u = await dbService.login(email, password);
        
        if (u) {
            setUser(u);
            refreshNotifications(); // Refresh notifications on successful login
            console.log("[AuthContext] login successful. User:", u ? u.email : 'null');
            return true;
        }
        console.log("[AuthContext] login failed. No user returned.");
        return false;
    } catch (e: any) {
        console.error("[AuthContext] Login exception:", e);
        return false;
    } finally {
        setAuthLoading(false); // Loading complete
        console.log("[AuthContext] login finished. Setting authLoading to false.");
    }
  };

  async function loginSocial(provider: 'google') {
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] loginSocial called. Setting authLoading to true.");
    try {
        const { error } = await dbService.loginSocial(provider);

        if (error) {
            console.error("[AuthContext] Error in social login:", error);
            return false;
        } 
        return true;
    } catch (e) {
        console.error("[AuthContext] Social login exception:", e);
        return false;
    } finally {
        console.log("[AuthContext] loginSocial finished. Redirect/onAuthChange will handle final authLoading state.");
    }
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] signup called. Setting authLoading to true.");
    try {
        const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
        if (u) {
            setUser(u);
            refreshNotifications(); // Refresh notifications on successful signup
            console.log("[AuthContext] signup successful. User:", u ? u.email : 'null');
            return true;
        }
        console.log("[AuthContext] signup failed. No user returned.");
        return false;
    } catch (e: any) {
        console.error("[AuthContext] Signup exception:", e);
        return false;
    } finally {
        setAuthLoading(false); // Loading complete
        console.log("[AuthContext] signup finished. Setting authLoading to false.");
    }
  };

  const logout = () => {
    console.log("[AuthContext] logout called.");
    dbService.logout();
    setUser(null); // Clear user immediately
    setUnreadNotificationsCount(0); // Clear notifications on logout
    localStorage.removeItem('hasPromptedPushOnce'); // NEW: Clear push notification prompt status on logout
    setAuthLoading(false); // Explicitly set to false after logout operation
    setIsUserAuthFinished(true); // Still ready, just no user.
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      console.log("[AuthContext] updatePlan called for user:", user.email, "Plan:", plan);
      setAuthLoading(true); // Indicate active loading
      try {
          await dbService.updatePlan(user.id, plan);
          await refreshUser(); // Refresh user to get updated plan details
      } finally {
          setAuthLoading(false); // Loading complete
          console.log("[AuthContext] updatePlan finished. Setting authLoading to false.");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, isUserAuthFinished, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid, isNewAccount, trialDaysRemaining, unreadNotificationsCount, refreshNotifications }}>
      {children}
    </AuthContext.Provider>
  );
};