
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
  authLoading: boolean; // Renamed from 'loading'
  isAuthReady: boolean; // New flag to indicate initial auth check is complete
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
  const [authLoading, setAuthLoading] = useState(true); // Renamed from 'loading'
  const [isAuthReady, setIsAuthReady] = useState(false); // New state for initial auth check completion

  console.log("[AuthProvider] Component rendered. Initial authLoading state:", authLoading, "isAuthReady:", isAuthReady);

  useEffect(() => {
    let mounted = true;
    console.log("[AuthContext] useEffect mounted, initAuth called. Mounted:", mounted, "Initial authLoading:", authLoading);

    // This function will fetch the current user and set the initial state.
    // It is called once on mount. Subsequent changes are handled by onAuthChange.
    const initAuth = async () => {
        try {
            console.log("[AuthContext] initAuth: Calling dbService.getCurrentUser()");
            const currentUser = await dbService.getCurrentUser();
            if (mounted) {
                setUser(currentUser);
                console.log("[AuthContext] initAuth resolved. User:", currentUser ? currentUser.email : 'null');
            } else {
                console.log("[AuthContext] initAuth resolved, but component is unmounted. Skipping state update.");
            }
        } catch (error) {
            console.error("[AuthContext] Erro during initAuth:", error);
            if (mounted) {
                setUser(null); // Ensure user is null on error
            }
        } finally {
            if (mounted) {
                setAuthLoading(false); // Ensure authLoading is false after initial check
                setIsAuthReady(true); // Initial auth check is now complete
                console.log("[AuthContext] initAuth finally block. Setting authLoading to false and isAuthReady to true.");
            }
        }
    };

    initAuth();

    // Set up the listener for auth state changes
    const unsubscribe = dbService.onAuthChange(async (u) => {
      if (mounted) {
        console.log("[AuthContext] onAuthChange event. User:", u ? u.email : 'null');
        setAuthLoading(true); // Set loading while we process the new user object
        // dbService.onAuthChange now passes the raw user object,
        // we might need to fetch the profile explicitly if not already done.
        // However, dbService.getCurrentUser (which is used internally by onAuthChange for full user object)
        // already handles ensureUserProfile, so we just set the user.
        setUser(u);
        setAuthLoading(false); // Auth state has been updated
        setIsAuthReady(true); // Ensure this is true after any auth change
      } else {
        console.log("[AuthContext] onAuthChange event, but component is unmounted. Skipping state update.");
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      console.log("[AuthContext] useEffect cleanup. Unsubscribed from auth changes.");
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
      console.log("[AuthContext] refreshUser called.");
      setAuthLoading(true); // Set loading while refreshing
      const currentUser = await dbService.syncSession();
      if (currentUser) setUser(currentUser);
      setAuthLoading(false); // Loading complete
  };

  const login = async (email: string, password?: string) => {
    setAuthLoading(true);
    console.log("[AuthContext] login called. Setting authLoading to true.");
    try {
        const u = await dbService.login(email, password);
        
        if (u) {
            setUser(u);
            console.log("[AuthContext] login successful. User:", u ? u.email : 'null');
            return true;
        }
        console.log("[AuthContext] login failed. No user returned.");
        return false;
    } catch (e: any) {
        console.error("[AuthContext] Login exception:", e);
        // dbService.login already throws, catch and return false to indicate failure.
        // The calling component (Login.tsx) will handle the specific error message.
        return false;
    } finally {
        setAuthLoading(false);
        console.log("[AuthContext] login finished. Setting authLoading to false.");
    }
  };

  async function loginSocial(provider: 'google') {
    setAuthLoading(true);
    console.log("[AuthContext] loginSocial called. Setting authLoading to true.");
    try {
        const { error } = await dbService.loginSocial(provider);

        if (error) {
            console.error("[AuthContext] Error in social login:", error);
            alert("Erro no login Google. Verifique se o domínio da Vercel está autorizado no Supabase.");
            return false;
        } 
        // If successful, Supabase handles the redirect automatically.
        // The onAuthChange listener should pick it up and set user/authLoading.
        return true;
    } catch (e) {
        console.error("[AuthContext] Social login exception:", e);
        return false;
    } finally {
        // IMPORTANT: DO NOT setAuthLoading(false) here.
        // The `onAuthChange` listener will be triggered by the redirect from Supabase,
        // and it is responsible for setting `authLoading(false)` once the new session is processed.
        console.log("[AuthContext] loginSocial finished. `onAuthChange` will handle final authLoading state.");
    }
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    setAuthLoading(true);
    console.log("[AuthContext] signup called. Setting authLoading to true.");
    try {
        const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
        if (u) {
            setUser(u);
            console.log("[AuthContext] signup successful. User:", u ? u.email : 'null');
            return true;
        }
        console.log("[AuthContext] signup failed. No user returned.");
        return false;
    } catch (e: any) {
        console.error("[AuthContext] Signup exception:", e);
        return false;
    } finally {
        setAuthLoading(false);
        console.log("[AuthContext] signup finished. Setting authLoading to false.");
    }
  };

  const logout = () => {
    console.log("[AuthContext] logout called.");
    dbService.logout();
    setUser(null);
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      console.log("[AuthContext] updatePlan called for user:", user.email, "Plan:", plan);
      setAuthLoading(true); // Set loading while updating plan
      await dbService.updatePlan(user.id, plan);
      await refreshUser();
      setAuthLoading(false); // Loading complete
    }
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, isAuthReady, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid, isNewAccount, trialDaysRemaining }}>
      {children}
    </AuthContext.Provider>
  );
};
    
