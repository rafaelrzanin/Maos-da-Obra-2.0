import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, useRef } from 'react';
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
  signup: (name: string, email: string, whatsapp: string, password?: string, cpf?: string) => Promise<boolean>; // REMOVED planType
  logout: () => void;
  updatePlan: (plan: PlanType) => Promise<void>;
  refreshUser: () => Promise<void>;
  isSubscriptionValid: boolean;
  isNewAccount: boolean;
  trialDaysRemaining: number | null;
  unreadNotificationsCount: number; // NEW: Unread notifications count
  refreshNotifications: () => Promise<void>; // NEW: Function to refresh notification count
  requestPushNotificationPermission: () => Promise<void>; // NEW: Function to request push permission
  pushSubscriptionStatus: 'idle' | 'prompting' | 'granted' | 'denied' | 'error'; // NEW: Status of push notifications
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Initial state: true, as we're loading auth
  const [isUserAuthFinished, setIsUserAuthFinished] = useState(false); // NEW: Initially false
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0); // NEW
  const [pushSubscriptionStatus, setPushSubscriptionStatus] = useState<'idle' | 'prompting' | 'granted' | 'denied' | 'error'>('idle'); // NEW

  // NEW: Refs for push notification logic
  const promptCountRef = useRef(0);
  const MAX_PROMPT_ATTEMPTS = 3;

  console.log("[AuthContext] Render AuthProvider:", { authLoading, isUserAuthFinished, user: user?.id });

  // Add more verbose logging for state changes
  useEffect(() => {
    console.log("[AuthContext] State Change: authLoading =", authLoading);
  }, [authLoading]);

  useEffect(() => {
    console.log("[AuthContext] State Change: isUserAuthFinished =", isUserAuthFinished);
  }, [isUserAuthFinished]);

  useEffect(() => {
    console.log("[AuthContext] State Change: user =", user?.id);
  }, [user]);


  const refreshNotifications = useCallback(async () => {
    console.log("[AuthContext] refreshNotifications triggered. User:", user?.id);
    if (user?.id) {
      try {
        const notifications = await dbService.getNotifications(user.id);
        setUnreadNotificationsCount(notifications.length);
        console.log(`[AuthContext] Unread notifications count: ${notifications.length}`);
      } catch (error) {
        console.error("Error refreshing notifications:", error);
        setUnreadNotificationsCount(0);
      }
    } else {
      setUnreadNotificationsCount(0);
    }
  }, [user]); // Depends on `user`

  // NEW: Push Notification Permission Logic
  // Explicitly type the callback's return to Promise<void>
  const requestPushNotificationPermission = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !user?.id) {
      console.warn("Push notifications not supported by this browser or user not logged in.");
      setPushSubscriptionStatus('error');
      return;
    }

    console.log(`[AuthContext - Push Notif] Current Notification.permission: ${Notification.permission}`);
    const hasPromptedOnce = localStorage.getItem('hasPromptedPushOnce');
    console.log(`[AuthContext - Push Notif] Has prompted before (localStorage): ${hasPromptedOnce}`);

    if (Notification.permission === 'granted') {
      setPushSubscriptionStatus('granted');
      console.log("[AuthContext - Push Notif] Notification permission already granted. Ensuring subscription is active.");
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          console.log("[AuthContext - Push Notif] No existing push subscription found, creating a new one.");
          const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY, // Use VITE_ prefix for client
          });
          await dbService.savePushSubscription(user.id, newSubscription.toJSON());
        } else {
          console.log("[AuthContext - Push Notif] Existing push subscription found.");
        }
      } catch (err) {
        console.error("[AuthContext - Push Notif] Error managing push subscription:", err);
        setPushSubscriptionStatus('error');
      }
      return;
    }

    if (Notification.permission === 'denied') {
      setPushSubscriptionStatus('denied');
      console.warn("[AuthContext - Push Notif] Notification permission previously denied by user.");
      return;
    }

    // Only prompt if permission is 'default' and we haven't prompted before in this session/app lifetime
    if (Notification.permission === 'default' && !hasPromptedOnce && (promptCountRef.current < MAX_PROMPT_ATTEMPTS)) {
      setPushSubscriptionStatus('prompting'); // NEW: Set status to 'prompting' before asking for permission
      try {
        const permissionResult = await Notification.requestPermission();
        localStorage.setItem('hasPromptedPushOnce', 'true');
        if (permissionResult === 'granted') {
          setPushSubscriptionStatus('granted');
          await ensurePushSubscription();
        } else {
          setPushSubscriptionStatus('denied');
        }
      } catch (err) {
        console.error("[AuthContext - Push Notif] Error requesting notification permission:", err);
        setPushSubscriptionStatus('error');
      } finally {
        promptCountRef.current++;
      }
    }
  }, [user, ensurePushSubscription, isSubscriptionValid]);
