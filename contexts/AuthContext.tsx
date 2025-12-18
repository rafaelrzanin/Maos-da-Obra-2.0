
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { User, PlanType } from '../types.ts';
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
  loading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => Promise<boolean>;
  logout: () => void;
  updatePlan: (plan: PlanType) => Promise<void>;
  refreshUser: () => Promise<void>;
  isSubscriptionValid: boolean;
  isNewAccount: boolean;
  trialDaysRemaining: number | null;
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const timeoutDuration = 10000; // 10 seconds
        const timeoutPromise = new Promise<User | null | 'TIMEOUT'>((resolve) => 
            setTimeout(() => resolve('TIMEOUT'), timeoutDuration) 
        );
        const authPromise = dbService.getCurrentUser();
        
        const result = await Promise.race([authPromise, timeoutPromise]);
        
        if (mounted) {
            if (result === 'TIMEOUT') {
                console.warn(`Auth check timed out after ${timeoutDuration / 1000}s. Waiting for onAuthChange listener to resolve...`);
                // If it timed out, we keep loading=true and wait for `onAuthChange` to eventually fire
                // with the definitive user state (either logged in or null), which will then set loading=false.
                // This prevents prematurely showing unauthenticated state if `getCurrentUser` is just slow.
            } else {
                // If getCurrentUser resolved within the timeout, we have a definitive state.
                setUser(result); // result can be User or null
                setLoading(false); // Initial auth check is complete.
            }
        }
      } catch (error) {
        console.error("Erro auth inicial:", error);
        if (mounted) {
            setUser(null); // Explicitly set user to null on any error during initial fetch
            setLoading(false); // Stop loading on error
        }
      }
      // The `finally` block with conditional setLoading(false) was removed as it was the source of the issue.
      // Now, setLoading(false) is either called directly after a successful fetch/error,
      // or by the onAuthChange listener if the initial fetch timed out.
    };

    initAuth();

    // The onAuthChange listener is crucial for real-time updates and also acts
    // as a fallback for `setLoading(false)` if `initAuth` hits a timeout
    // and `getCurrentUser` eventually resolves or determines no user.
    const unsubscribe = dbService.onAuthChange((u) => {
      if (mounted) {
        setUser(u);
        setLoading(false); // This is the definitive point where loading is set to false
                         // if the session changes after the initial `initAuth` or if `initAuth` timed out.
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

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
      const currentUser = await dbService.syncSession();
      if (currentUser) setUser(currentUser);
  };

  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
        const loginPromise = dbService.login(email, password);
        // Timeout de segurança no login manual
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Tempo limite excedido. Verifique sua conexão.")), 15000)
        );
        
        const u = await Promise.race([loginPromise, timeoutPromise]) as User | null;
        
        if (u) {
            setUser(u);
            return true;
        }
        return false;
    } catch (e) {
        console.error("Login exception:", e);
        return false;
    } finally {
        setLoading(false);
    }
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    setLoading(true);
    try {
        const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
        if (u) {
            setUser(u);
            return true;
        }
        return false;
    } finally {
        setLoading(false);
    }
  };

  const logout = () => {
    dbService.logout();
    setUser(null);
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      await dbService.updatePlan(user.id, plan);
      await refreshUser();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid, isNewAccount, trialDaysRemaining }}>
      {children}
    </AuthContext.Provider>
  );
};

