import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
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
  authLoading: boolean;
  isUserAuthFinished: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (name: string, email: string, whatsapp: string, password?: string, cpf?: string) => Promise<boolean>;
  logout: () => void;
  updatePlan: (plan: PlanType) => Promise<void>;
  refreshUser: () => Promise<void>;
  isSubscriptionValid: boolean;
  isNewAccount: boolean;
  trialDaysRemaining: number | null;
  unreadNotificationsCount: number;
  refreshNotifications: () => Promise<void>;
  requestPushNotificationPermission: () => Promise<void>;
  pushSubscriptionStatus: 'idle' | 'prompting' | 'granted' | 'denied' | 'error';
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isUserAuthFinished, setIsUserAuthFinished] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pushSubscriptionStatus, setPushSubscriptionStatus] = useState<'idle' | 'prompting' | 'granted' | 'denied' | 'error'>('idle');

  const refreshNotifications = useCallback(async () => {
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
  }, [user]);

  const requestPushNotificationPermission = useCallback(async () => {
    // Verificação robusta: se o serviceWorker foi desativado no App.tsx, esta função apenas retorna.
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !user?.id) {
      setPushSubscriptionStatus('idle');
      return;
    }

    if (Notification.permission === 'granted') {
      setPushSubscriptionStatus('granted');
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
          });
          await dbService.savePushSubscription(user.id, newSubscription.toJSON());
        }
      } catch (err) {
        console.error("Push Error:", err);
      }
      return;
    }

    if (Notification.permission === 'default') {
      try {
        const result = await Notification.requestPermission();
        setPushSubscriptionStatus(result === 'granted' ? 'granted' : 'denied');
      } catch (err) {
        setPushSubscriptionStatus('error');
      }
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const checkInitialAuth = async () => {
      setAuthLoading(true);
      try {
        const currentUser = await dbService.getCurrentUser();
        if (mounted) {
          setUser(currentUser);
          if (currentUser) await refreshNotifications();
        }
      } catch (error) {
        console.error("Initial Auth Error:", error);
      } finally {
        if (mounted) {
          setAuthLoading(false);
          setIsUserAuthFinished(true);
        }
      }
    };
    
    checkInitialAuth();

    const unsubscribe = dbService.onAuthChange(async (updatedUser: User | null) => {
      if (!mounted) return;
      setUser(updatedUser);
      if (updatedUser) {
        await refreshNotifications();
      } else {
        setUnreadNotificationsCount(0);
        setPushSubscriptionStatus('idle');
      }
      setIsUserAuthFinished(true);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [refreshNotifications]);

  const isSubscriptionValid = useMemo(() => user ? dbService.isSubscriptionActive(user) : false, [user]);
  const isNewAccount = useMemo(() => user ? !user.subscriptionExpiresAt : true, [user]);
  
  const trialDaysRemaining = useMemo(() => {
      if (user?.isTrial && user.subscriptionExpiresAt) {
          const diff = new Date(user.subscriptionExpiresAt).getTime() - new Date().getTime();
          return Math.ceil(diff / (1000 * 60 * 60 * 24)); 
      }
      return null;
  }, [user]);

  const refreshUser = async () => {
      setAuthLoading(true);
      try {
          const currentUser = await dbService.syncSession();
          setUser(currentUser);
          if (currentUser) await refreshNotifications();
      } finally {
          setAuthLoading(false);
      }
  };

  const login = async (email: string, password?: string) => {
    setAuthLoading(true);
    try {
        const u = await dbService.login(email, password);
        if (u) {
            setUser(u);
            await refreshNotifications();
            return true;
        }
        return false;
    } catch (e) {
        return false;
    } finally {
        setAuthLoading(false);
    }
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string) => {
    setAuthLoading(true);
    try {
        const u = await dbService.signup(name, email, whatsapp, password, cpf);
        if (u) {
            setUser(u);
            await refreshNotifications();
            return true;
        }
        return false;
    } catch (e) {
        return false;
    } finally {
        setAuthLoading(false);
    }
  };

  const logout = () => {
    dbService.logout();
    setUser(null);
    setUnreadNotificationsCount(0);
    localStorage.removeItem('hasPromptedPushOnce');
    setAuthLoading(false);
    setIsUserAuthFinished(true);
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      setAuthLoading(true);
      try {
          await dbService.updatePlan(user.id, plan);
          await refreshUser();
      } finally {
          setAuthLoading(false);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, authLoading, isUserAuthFinished, login, signup, logout, 
      updatePlan, refreshUser, isSubscriptionValid, isNewAccount, 
      trialDaysRemaining, unreadNotificationsCount, refreshNotifications, 
      requestPushNotificationPermission, pushSubscriptionStatus 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
