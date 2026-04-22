/**
 * @file useAuthStore.ts
 * @description 인증 상태 관리 스토어 (Zustand)
 * @module store
 *
 * 주요 기능:
 * - 로그인/로그아웃/회원가입 처리
 * - JWT 토큰 관리
 * - Silent Refresh (토큰 자동 갱신)
 * - 동시 다중 refresh 요청 방지 (Promise 공유)
 *
 * 사용 예시:
 * ```tsx
 * const { login, logout, isAuthenticated, user } = useAuthStore();
 *
 * // 로그인
 * await login({ email: 'user@example.com', password: '12345678' });
 *
 * // 상태 확인
 * if (isAuthenticated) {
 *   console.log('로그인됨:', user?.name);
 * }
 * ```
 */
import { create } from 'zustand';
import { authManualApi } from '../api';
import type { AuthUser, MFARequiredResponse } from '../api/manual';
import { useCartStore } from './useCartStore';

/**
 * MFA가 필요할 때 throw되는 에러.
 * LoginPage에서 catch하여 MFA 코드 입력 UI를 표시합니다.
 */
export class MFARequiredError extends Error {
    mfaToken: string;
    mfaMethods: string[];
    webAuthnEnabled: boolean;
    constructor(mfaToken: string, mfaMethods: string[] = [], webAuthnEnabled: boolean = false) {
        super('MFA_REQUIRED');
        this.name = 'MFARequiredError';
        this.mfaToken = mfaToken;
        this.mfaMethods = mfaMethods;
        this.webAuthnEnabled = webAuthnEnabled;
    }
}

/**
 * 로그인 데이터 타입
 */
interface LoginData {
    /** 이메일 주소 */
    email: string;
    /** 비밀번호 */
    password: string;
    /** 로그인 소스 ("admin" 시 서버에서 ADMIN 역할 검증) */
    source?: string;
}

/**
 * 회원가입 데이터 타입
 */
interface RegisterData {
    /** 이메일 주소 */
    email: string;
    /** 비밀번호 */
    password: string;
    /** 이름 */
    name: string;
    /** 전화번호 */
    phone: string;
    /** 은행명 (1원 인증 후) */
    bankName?: string;
    /** 은행 코드 (금융결제원 표준) */
    bankCode?: string;
    /** 계좌번호 (평문) */
    accountNumber?: string;
    /** 예금주 */
    accountHolder?: string;
    /** 1원 인증 세션 ID */
    verificationId?: string;
}

/**
 * 인증 스토어 상태 및 액션 타입
 */
interface AuthState {
    /** JWT 액세스 토큰 */
    token: string | null;
    /** 현재 로그인된 사용자 정보 */
    user: AuthUser | null;
    /** 로그인 여부 */
    isAuthenticated: boolean;
    /** 로딩 상태 (초기 인증 확인 중) */
    isLoading: boolean;
    /** 세션 만료 경고 표시 여부 */
    sessionExpiryWarning: boolean;
    /**
     * 로그인
     * @param data - 로그인 데이터 (email, password)
     */
    login: (data: LoginData) => Promise<void>;
    /**
     * 회원가입
     * @param data - 회원가입 데이터
     */
    register: (data: RegisterData) => Promise<void>;
    /** 로그아웃 */
    logout: () => Promise<void>;
    /** MFA 2단계 로그인 (TOTP 코드 입력 후) */
    loginMFA: (mfaToken: string, code: string) => Promise<void>;
    /** 토큰 갱신 (Silent Refresh) */
    refresh: () => Promise<void>;
    /** 인증 상태 확인 (앱 시작 시 호출) */
    checkAuth: () => Promise<void>;
}

/**
 * 동시 다중 refresh 요청 방지용 Promise 캐시
 * - 여러 컴포넌트에서 동시에 refresh 호출 시 하나의 요청만 실행
 */
let refreshPromise: Promise<void> | null = null;

/**
 * 인증 상태 관리 스토어
 *
 * @example
 * // 컴포넌트에서 사용
 * const isAuthenticated = useAuthStore(state => state.isAuthenticated);
 * const login = useAuthStore(state => state.login);
 */
/**
 * 세션 만료 경고 타이머 (모듈 스코프)
 */
let sessionTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 세션 만료 경고 타이머 시작
 * 토큰 획득 후 14분(만료 60초 전)에 경고 이벤트 발생 → 카운트다운 배너 표시
 */
const SESSION_WARNING_BEFORE_MS = 60 * 1000; // 만료 60초 전
const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000; // 15분

const startSessionExpiryTimer = () => {
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('session-expiry-warning'));
    }, ACCESS_TOKEN_LIFETIME_MS - SESSION_WARNING_BEFORE_MS);
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

            // MFA가 활성화된 계정 — 2단계 인증 필요
            if ('mfa_required' in resData && resData.mfa_required) {
                set({ isLoading: false });
                const mfaRes = resData as MFARequiredResponse;
                throw new MFARequiredError(
                    mfaRes.mfa_token,
                    mfaRes.mfa_methods || [],
                    mfaRes.webauthn_enabled || false,
                );
            }

            const { access_token, user } = resData as { access_token: string; user: AuthUser };
            localStorage.setItem('wgift_client_logged_in', Date.now().toString());
            set({
                token: access_token,
                user: user,
                isAuthenticated: true,
                isLoading: false
            });
            startSessionExpiryTimer();
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    loginMFA: async (mfaToken, code) => {
        set({ isLoading: true });
        try {
            const response = await authManualApi.loginMFA({ mfa_token: mfaToken, code });
            const { access_token, user } = response.data;
            localStorage.setItem('wgift_client_logged_in', Date.now().toString());
            set({
                token: access_token,
                user: user,
                isAuthenticated: true,
                isLoading: false
            });
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
        if (sessionTimer) {
            clearTimeout(sessionTimer);
            sessionTimer = null;
        }
        try {
            await authManualApi.logout();
        } catch {
            // 로그아웃 실패해도 로컬 상태는 초기화
        } finally {
            localStorage.removeItem('wgift_client_logged_in');
            set({ token: null, user: null, isAuthenticated: false });
            useCartStore.getState().clearCart();
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
                    isAuthenticated: true
                });
                startSessionExpiryTimer();
                window.dispatchEvent(new CustomEvent('session-restored'));
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

        // 이전에 로그인한 적이 없으면 refresh 시도하지 않음 (불필요한 401 방지)
        // httpOnly 쿠키는 JS에서 접근 불가하므로 localStorage 플래그로 판별
        const hasToken = !!get().token;
        const loginTimestamp = localStorage.getItem('wgift_client_logged_in');
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        // wgift_client_logged_in 플래그: 타임스탬프 기반 만료 (7일), 레거시 'true' 값도 호환
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
            // refresh 실패 = 세션 만료. 플래그 제거
            localStorage.removeItem('wgift_client_logged_in');
            set({ token: null, user: null, isAuthenticated: false, isLoading: false });
        }
    }
}));

// Multi-tab session sync via localStorage events
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === 'wgift_client_logged_in') {
            if (!event.newValue) {
                // Another tab logged out — sync this tab
                useAuthStore.setState({ token: null, user: null, isAuthenticated: false });
            } else if (event.newValue && !useAuthStore.getState().isAuthenticated) {
                // Another tab logged in — try to restore session
                useAuthStore.getState().refresh().catch(() => {});
            }
        }
    });
}
