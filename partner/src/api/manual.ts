/**
 * @file manual.ts
 * @description Partner-specific API endpoints
 */
import { axiosInstance } from '../lib/axios';

// =====================
// Auth Types
// =====================

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: string;
  kycStatus?: string;
  emailNotification?: boolean;
  pushNotification?: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  user: AuthUser;
}

// =====================
// Auth API
// =====================

export const authManualApi = {
  login: async (data: { email: string; password: string }) => {
    const response = await axiosInstance.post<any>('/auth/login', data);
    return response;
  },
  loginMFA: async (data: { mfa_token: string; code: string }) => {
    const response = await axiosInstance.post<AuthTokenResponse>('/auth/login/mfa', data);
    return response;
  },
  register: async (data: { email: string; password: string; name: string; phone: string }) => {
    const response = await axiosInstance.post('/auth/register', data);
    return response;
  },
  refresh: async () => {
    const response = await axiosInstance.post<AuthTokenResponse>('/auth/refresh');
    return response;
  },
  logout: async () => {
    const response = await axiosInstance.post('/auth/logout');
    return response;
  },
  getMe: async () => {
    const response = await axiosInstance.get<AuthUser>('/auth/me');
    return response;
  },
};

// =====================
// WebAuthn (Passkey) API
// =====================

export interface WebAuthnCredential {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export const webauthnApi = {
  registerBegin: async () => {
    const response = await axiosInstance.post('/auth/webauthn/register/begin');
    return response.data;
  },
  registerComplete: async (data: { name: string; credential: any }) => {
    const response = await axiosInstance.post('/auth/webauthn/register/complete', data);
    return response.data;
  },
  loginBegin: async (email: string) => {
    const response = await axiosInstance.post('/auth/webauthn/login/begin', { email });
    return response.data;
  },
  loginComplete: async (data: any) => {
    const response = await axiosInstance.post<AuthTokenResponse>('/auth/webauthn/login/complete', data);
    return response;
  },
  getCredentials: async (): Promise<WebAuthnCredential[]> => {
    const response = await axiosInstance.get<WebAuthnCredential[]>('/auth/webauthn/credentials');
    return response.data;
  },
  deleteCredential: async (id: string) => {
    const response = await axiosInstance.delete(`/auth/webauthn/credentials/${id}`);
    return response.data;
  },
  renameCredential: async (id: string, name: string) => {
    const response = await axiosInstance.patch(`/auth/webauthn/credentials/${id}`, { name });
    return response.data;
  },
};

// =====================
// MFA (OTP) API
// =====================

export const mfaApi = {
  setup: async () => {
    const response = await axiosInstance.post('/auth/mfa/setup');
    return response.data;
  },
  verify: async (code: string) => {
    const response = await axiosInstance.post('/auth/mfa/verify', { code });
    return response.data;
  },
  disable: async (code: string) => {
    const response = await axiosInstance.post('/auth/mfa/disable', { code });
    return response.data;
  },
  getStatus: async () => {
    const response = await axiosInstance.get('/auth/mfa/status');
    return response.data;
  },
};

// =====================
// Password Change API
// =====================

export const passwordApi = {
  change: async (currentPassword: string, newPassword: string) => {
    const response = await axiosInstance.patch('/auth/password', { currentPassword, newPassword });
    return response.data;
  },
};

// =====================
// Paginated Response
// =====================

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// =====================
// Partner API
// =====================

export const partnerApi = {
  // Dashboard
  getDashboard: async () => {
    const response = await axiosInstance.get('/partner/dashboard');
    return response.data;
  },

  // Products (available for partner stock — AllowPartnerStock=true)
  getAvailableProducts: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/partner/products', { params });
    return response.data;
  },

  // Orders
  getMyOrders: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/partner/orders', { params });
    return response.data;
  },
  getMyOrderDetail: async (id: number) => {
    const response = await axiosInstance.get(`/partner/orders/${id}`);
    return response.data;
  },

  // Vouchers
  getMyVouchers: async (params?: { page?: number; limit?: number; productId?: number; status?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/partner/vouchers', { params });
    return response.data;
  },
  bulkUploadVouchers: async (data: {
    productId: number;
    pinCodes?: string[];
    vouchers?: { pin: string; giftNumber?: string; securityCode?: string }[];
  }) => {
    const response = await axiosInstance.post('/partner/vouchers/bulk', data);
    return response.data;
  },
  getVoucherInventory: async () => {
    const response = await axiosInstance.get('/partner/vouchers/inventory');
    return response.data;
  },

  // Settlements (replaces payouts)
  getMySettlements: async (params?: { page?: number; limit?: number; from?: string; to?: string; status?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/partner/settlements', { params });
    return response.data;
  },
  getSettlementSummary: async (from: string, to: string) => {
    const response = await axiosInstance.get(`/partner/settlements/summary?from=${from}&to=${to}`);
    return response.data;
  },

  // Profile
  getProfile: async () => {
    const response = await axiosInstance.get('/partner/profile');
    return response.data;
  },
  updateProfile: async (data: { name?: string; phone?: string }) => {
    const response = await axiosInstance.patch('/partner/profile', data);
    return response.data;
  },

  // Business Info
  getBusinessInfo: async () => {
    const response = await axiosInstance.get('/partner/business-info');
    return response.data;
  },
  updateBusinessInfo: async (data: {
    businessName: string;
    businessRegNo: string;
    representativeName: string;
    telecomSalesNo?: string;
    businessAddress?: string;
    businessType?: string;
    businessCategory?: string;
  }) => {
    const response = await axiosInstance.put('/partner/business-info', data);
    return response.data;
  },

  // IP Whitelist
  getIPWhitelist: async () => {
    const response = await axiosInstance.get('/partner/ip-whitelist');
    return response.data;
  },
  addIPWhitelist: async (ipAddress: string, description: string) => {
    const response = await axiosInstance.post('/partner/ip-whitelist', { ipAddress, description });
    return response.data;
  },
  deleteIPWhitelist: async (id: number) => {
    const response = await axiosInstance.delete(`/partner/ip-whitelist/${id}`);
    return response.data;
  },
  toggleIPWhitelist: async (enabled: boolean) => {
    const response = await axiosInstance.patch('/partner/ip-whitelist/toggle', { enabled });
    return response.data;
  },
  getCurrentIP: async () => {
    const response = await axiosInstance.get('/partner/ip-whitelist/current-ip');
    return response.data;
  },

  // Documents (read-only)
  getMyDocuments: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get('/partner/documents', { params });
    return response.data;
  },
  downloadDocument: async (id: number) => {
    return axiosInstance.get(`/partner/documents/${id}/download`, { responseType: 'blob' });
  },
};

// ── Partner Purchase (구매) ──────────────────────
export const partnerOrderApi = {
  getPurchasableProducts: (params?: { page?: number; limit?: number }) =>
    axiosInstance.get('/partner/products/purchasable', { params }),

  createOrder: (data: { items: { productId: number; quantity: number }[]; idempotencyKey?: string }) =>
    axiosInstance.post('/partner/orders', data),

  getMyPurchases: (params?: { status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/partner/orders/purchases', { params }),

  cancelOrder: (orderId: number) =>
    axiosInstance.post(`/partner/orders/${orderId}/cancel`),

  exportPins: (orderId: number) =>
    axiosInstance.get(`/partner/orders/${orderId}/export`, { responseType: 'blob' }),
};

// ── Partner Trade-in (매입) ──────────────────────
export const partnerTradeInApi = {
  create: (data: { productId: number; pinCodes: string[]; securityCode?: string; giftNumber?: string }) =>
    axiosInstance.post('/partner/trade-ins', data),

  getMyTradeIns: (params?: { status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/partner/trade-ins', { params }),

  getDetail: (id: number) =>
    axiosInstance.get(`/partner/trade-ins/${id}`),
};
