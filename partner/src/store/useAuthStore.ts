/**
 * @file useAuthStore.ts
 * @description Partner auth state store (Zustand)
 */
import { create } from 'zustand';
import { authManualApi } from '../api';
import type { AuthUser } from '../api/manual';

export class MFARequiredError extends Error {
  constructor(public mfaToken: string) {
    super('MFA_REQUIRED');
    this.name = 'MFARequiredError';
  }
}

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpiryWarning: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

let refreshPromise: Promise<void> | null = null;

const startSessionExpiryTimer = () => {
  if ((window as any).__sessionTimer) clearTimeout((window as any).__sessionTimer);
  (window as any).__sessionTimer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent('session-expiry-warning'));
  }, 14 * 60 * 1000);
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  sessionExpiryWarning: false,

  login: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authManualApi.login(data);
      const resData = response.data;
      if (resData && 'mfa_required' in resData && resData.mfa_required) {
        set({ isLoading: false });
        throw new MFARequiredError(resData.mfa_token);
      }
      const { access_token, user } = resData;
      localStorage.setItem('seedream_partner_logged_in', Date.now().toString());
      set({
        token: access_token,
        user: user,
        isAuthenticated: true,
        isLoading: false,
      });
      startSessionExpiryTimer();
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginMFA: async (mfaToken: string, code: string) => {
    set({ isLoading: true });
    try {
      const response = await authManualApi.loginMFA({ mfa_token: mfaToken, code });
      const { access_token, user } = response.data;
      localStorage.setItem('seedream_partner_logged_in', Date.now().toString());
      set({ token: access_token, user, isAuthenticated: true, isLoading: false });
      startSessionExpiryTimer();
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      await authManualApi.register(data);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authManualApi.logout();
    } catch {
      // Logout failure — still clear local state
    } finally {
      localStorage.removeItem('seedream_partner_logged_in');
      set({ token: null, user: null, isAuthenticated: false });
    }
  },

  refresh: async () => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const response = await authManualApi.refresh();
        const { access_token, user } = response.data;
        set({
          token: access_token,
          user: user,
          isAuthenticated: true,
        });
        startSessionExpiryTimer();
      } catch (error) {
        set({ token: null, user: null, isAuthenticated: false });
        throw error;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  checkAuth: async () => {
    set({ isLoading: true });

    const hasToken = !!get().token;
    const loginTimestamp = localStorage.getItem('seedream_partner_logged_in');
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const wasLoggedIn = loginTimestamp != null && (
      loginTimestamp === 'true' ||
      (Date.now() - Number(loginTimestamp)) < SEVEN_DAYS_MS
    );
    if (!hasToken && !wasLoggedIn) {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      await get().refresh();
      set({ isLoading: false });
    } catch {
      localStorage.removeItem('seedream_partner_logged_in');
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

// Multi-tab session sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'seedream_partner_logged_in') {
      if (!event.newValue) {
        useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
      } else if (event.newValue && !useAuthStore.getState().isAuthenticated) {
        useAuthStore.getState().refresh().catch(() => {});
      }
    }
  });
}
