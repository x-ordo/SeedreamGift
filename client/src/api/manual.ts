import { axiosInstance } from '../lib/axios';
import type { Product, PaginatedResponse, UserRole } from '../types';

/** API 응답에서 배열을 안전하게 추출 (언래핑 실패 방어) */
function toArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

// =====================
// Cart API
// =====================

export interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  product: Product;
  /** 해당 상품의 가용 재고 수량 (0이면 품절) */
  availableStock: number;
}

export interface CartResponse {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
}

export const cartApi = {
  getCart: async (): Promise<CartResponse> => {
    const response = await axiosInstance.get<CartResponse>('/cart');
    return response.data;
  },
  addToCart: async (productId: number, quantity: number) => {
    const response = await axiosInstance.post('/cart', { productId, quantity });
    return response.data;
  },
  updateQuantity: async (productId: number, quantity: number) => {
    // Go 서버가 productId 기반으로 수량 변경
    const response = await axiosInstance.patch(`/cart/${productId}`, { quantity });
    return response.data;
  },
  removeItem: async (cartItemId: number) => {
    const response = await axiosInstance.delete(`/cart/${cartItemId}`);
    return response.data;
  },
  removeItems: async (productIds: number[]): Promise<{ deletedCount: number }> => {
    const response = await axiosInstance.delete<{ deletedCount: number }>('/cart/batch', { data: { productIds } });
    return response.data;
  },
  clearCart: async () => {
    const response = await axiosInstance.delete('/cart');
    return response.data;
  },
};

// =====================
// Event API
// =====================

export interface Event {
  id: number;
  title: string;
  description: string;
  imageUrl?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export const eventApi = {
  getActiveEvents: async (status?: 'ongoing' | 'upcoming' | 'ended'): Promise<Event[]> => {
    const response = await axiosInstance.get('/events/active', {
      params: status ? { status } : undefined,
    });
    return toArray<Event>(response.data);
  },
  getFeaturedEvents: async (): Promise<Event[]> => {
    const response = await axiosInstance.get('/events/featured');
    return toArray<Event>(response.data);
  },
  incrementViewCount: async (id: number) => {
    const response = await axiosInstance.patch(`/events/${id}/view`);
    return response.data;
  },
  getEvent: async (id: number): Promise<Event> => {
    const response = await axiosInstance.get<Event>(`/events/${id}`);
    return response.data;
  },
};

// =====================
// FAQ API
// =====================

export interface Faq {
  id: number;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export const faqApi = {
  getActiveFaqs: async (category?: string): Promise<Faq[]> => {
    const response = await axiosInstance.get('/faqs/active', {
      params: category && category !== 'ALL' ? { category } : undefined,
    });
    return toArray<Faq>(response.data);
  },
  getCategories: async (): Promise<string[]> => {
    const response = await axiosInstance.get<string[]>('/faqs/categories');
    return response.data;
  },
  incrementHelpfulCount: async (id: number) => {
    const response = await axiosInstance.patch(`/faqs/${id}/helpful`);
    return response.data;
  },
};

// =====================
// Notice API
// =====================

export interface Notice {
  id: number;
  title: string;
  content: string;
  isActive?: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt?: string;
}

export const noticeApi = {
  getActiveNotices: async (): Promise<Notice[]> => {
    const response = await axiosInstance.get('/notices/active');
    return toArray<Notice>(response.data);
  },
  getNotice: async (id: number) => {
    const response = await axiosInstance.get<Notice>(`/notices/${id}`);
    return response.data;
  },
  incrementViewCount: async (id: number) => {
    await axiosInstance.patch(`/notices/${id}/view`);
  }
};

// =====================
// Inquiry API (사용자용)
// =====================

export interface Inquiry {
  id: number;
  userId: number;
  category: string;
  subject: string;
  content: string;
  status: 'PENDING' | 'ANSWERED' | 'CLOSED';
  answer?: string;
  answeredAt?: string;
  answeredBy?: number;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string; email: string };
}

export const inquiryApi = {
  getMyInquiries: async (): Promise<Inquiry[]> => {
    const response = await axiosInstance.get('/inquiries');
    return toArray<Inquiry>(response.data);
  },
  createInquiry: async (data: { category: string; subject: string; content: string }): Promise<Inquiry> => {
    const response = await axiosInstance.post<Inquiry>('/inquiries', data);
    return response.data;
  },
  updateInquiry: async (id: number, data: { category?: string; subject?: string; content?: string }): Promise<Inquiry> => {
    const response = await axiosInstance.patch<Inquiry>(`/inquiries/${id}`, data);
    return response.data;
  },
  deleteInquiry: async (id: number) => {
    const response = await axiosInstance.delete(`/inquiries/${id}`);
    return response.data;
  },
};

// =====================
// Auth API
// =====================

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  kycStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  emailNotification?: boolean;
  pushNotification?: boolean;
  zipCode?: string;
  address?: string;
  addressDetail?: string;
  mfaEnabled?: boolean;
  webAuthnEnabled?: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  user: AuthUser;
}

export interface MFARequiredResponse {
  mfa_required: true;
  mfa_token: string;
  mfa_methods?: string[];
  webauthn_enabled?: boolean;
}

// =====================
// Gift API (user-facing)
// =====================

export const giftApi = {
  claimGift: async (giftId: number) => {
    const response = await axiosInstance.post(`/gifts/${giftId}/claim`);
    return response.data;
  },
};

export type PinOption = 'full' | 'masked' | 'none';
export type TransactionType = 'ALL' | 'SALE' | 'PURCHASE';

export const ordersExportApi = {
  /** 내 거래내역 증빙 데이터 조회 (엑셀 내보내기용) */
  getMyTransactionExport: async (params?: {
    pinOption?: PinOption;
    type?: TransactionType;
  }) => {
    const response = await axiosInstance.get('/orders/my/export', { params });
    return response.data;
  },
  /** 은행제출 증빙 데이터 조회 (2-sheet 매입 증빙) */
  getMyBankSubmission: async (params?: {
    type?: TransactionType;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await axiosInstance.get('/orders/my/bank-submission', { params });
    return response.data;
  },
};

export const authManualApi = {
  login: async (data: { email: string; password: string; source?: string }) => {
    const response = await axiosInstance.post<AuthTokenResponse | MFARequiredResponse>('/auth/login', data);
    return response;
  },
  loginMFA: async (data: { mfa_token: string; code: string }) => {
    const response = await axiosInstance.post<AuthTokenResponse>('/auth/login/mfa', data);
    return response;
  },
  register: async (data: {
    email: string;
    password: string;
    name: string;
    phone: string;
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    accountHolder?: string;
  }) => {
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
  /** Start passkey registration (JWT required) */
  registerBegin: async () => {
    const response = await axiosInstance.post('/auth/webauthn/register/begin');
    return response.data;
  },
  /** Complete passkey registration (JWT required) */
  registerComplete: async (data: { name: string; credential: any }) => {
    const response = await axiosInstance.post('/auth/webauthn/register/complete', data);
    return response.data;
  },
  /** Start passkey authentication */
  loginBegin: async (email: string) => {
    const response = await axiosInstance.post('/auth/webauthn/login/begin', { email });
    return response.data;
  },
  /** Complete passkey authentication — returns tokens */
  loginComplete: async (data: any) => {
    const response = await axiosInstance.post<AuthTokenResponse>('/auth/webauthn/login/complete', data);
    return response;
  },
  /** List registered credentials (JWT required) */
  getCredentials: async (): Promise<WebAuthnCredential[]> => {
    const response = await axiosInstance.get<WebAuthnCredential[]>('/auth/webauthn/credentials');
    return response.data;
  },
  /** Delete a credential (JWT required) */
  deleteCredential: async (id: string) => {
    const response = await axiosInstance.delete(`/auth/webauthn/credentials/${id}`);
    return response.data;
  },
  /** Rename a credential (JWT required) */
  renameCredential: async (id: string, name: string) => {
    const response = await axiosInstance.patch(`/auth/webauthn/credentials/${id}`, { name });
    return response.data;
  },
  /** Start WebAuthn MFA ceremony after password login (uses mfa_token) */
  mfaBegin: async (mfaToken: string) => {
    const response = await axiosInstance.post('/auth/webauthn/mfa/begin', { mfa_token: mfaToken });
    return response.data;
  },
  /** Complete WebAuthn MFA ceremony — returns tokens */
  mfaComplete: async (mfaToken: string, assertion: any) => {
    const response = await axiosInstance.post(`/auth/webauthn/mfa/complete?mfa_token=${encodeURIComponent(mfaToken)}`, assertion);
    return response;
  },
};

// =====================
// Admin API - Dashboard & Stats
// =====================

export interface AdminStats {
  userCount: number;
  productCount: number;
  tradeInCount: number;
  pendingKycCount: number;
  pendingTradeInCount: number;
  orderCount: number;
  giftCount: number;
  voucherCount: number;
}

export type { PaginatedResponse };

export const adminApi = {
  // Dashboard
  getStats: async (period?: string): Promise<any> => {
    const response = await axiosInstance.get('/admin/stats', { params: period ? { period } : undefined });
    return response.data;
  },

  // =====================
  // Users Management
  // =====================
  getAllUsers: async (params?: { page?: number; limit?: number; search?: string; kycStatus?: string; role?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/users', { params });
    return response.data;
  },
  getUser: async (id: number) => {
    const response = await axiosInstance.get(`/admin/users/${id}`);
    return response.data;
  },
  updateUser: async (id: number, data: any) => {
    const response = await axiosInstance.patch(`/admin/users/${id}`, data);
    return response.data;
  },
  processKyc: async (id: number, status: string) => {
    const response = await axiosInstance.patch(`/admin/users/${id}/kyc`, { status });
    return response.data;
  },
  updateUserRole: async (id: number, role: string) => {
    const response = await axiosInstance.patch(`/admin/users/${id}/role`, { role });
    return response.data;
  },
  resetUserPassword: async (id: number, password: string) => {
    const response = await axiosInstance.patch(`/admin/users/${id}/password`, { password });
    return response.data;
  },
  deleteUser: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/users/${id}`);
    return response.data;
  },
  createUser: async (data: { email: string; password: string; name: string; phone?: string; role?: string }) => {
    const response = await axiosInstance.post('/admin/users', data);
    return response.data;
  },
  lockUser: async (id: number, until: string) => {
    const response = await axiosInstance.patch(`/admin/users/${id}/lock`, { until: new Date(until).toISOString() });
    return response.data;
  },
  unlockUser: async (id: number) => {
    const response = await axiosInstance.patch(`/admin/users/${id}/unlock`);
    return response.data;
  },

  // =====================
  // Sessions Management
  // =====================
  getAllSessions: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/sessions', { params });
    return response.data;
  },
  deleteSession: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/sessions/${id}`);
    return response.data;
  },
  deleteUserSessions: async (userId: number) => {
    const response = await axiosInstance.delete(`/admin/sessions/user/${userId}`);
    return response.data;
  },

  // =====================
  // Products Management
  // =====================
  getAllProducts: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/products', { params });
    return response.data;
  },
  createProduct: async (data: any) => {
    const response = await axiosInstance.post('/admin/products', data);
    return response.data;
  },
  updateProduct: async (id: number, data: any) => {
    const response = await axiosInstance.patch(`/admin/products/${id}`, data);
    return response.data;
  },
  deleteProduct: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/products/${id}`);
    return response.data;
  },

  // =====================
  // Brands Management
  // =====================
  getAllBrands: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/brands', { params });
    return response.data;
  },
  getBrand: async (code: string) => {
    const response = await axiosInstance.get(`/admin/brands/${code}`);
    return response.data;
  },
  createBrand: async (data: { code: string; name: string; color?: string; order?: number; description?: string; imageUrl?: string }) => {
    const response = await axiosInstance.post('/admin/brands', data);
    return response.data;
  },
  updateBrand: async (code: string, data: { name?: string; color?: string; order?: number; description?: string; imageUrl?: string }) => {
    const response = await axiosInstance.patch(`/admin/brands/${code}`, data);
    return response.data;
  },
  deleteBrand: async (code: string) => {
    const response = await axiosInstance.delete(`/admin/brands/${code}`);
    return response.data;
  },

  // =====================
  // Vouchers Management
  // =====================
  getAllVouchers: async (params?: { page?: number; limit?: number; productId?: number; status?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/vouchers', { params });
    return response.data;
  },
  getVoucher: async (id: number) => {
    const response = await axiosInstance.get(`/admin/vouchers/${id}`);
    return response.data;
  },
  updateVoucher: async (id: number, data: { status?: string; orderId?: number }) => {
    const response = await axiosInstance.patch(`/admin/vouchers/${id}`, data);
    return response.data;
  },
  deleteVoucher: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/vouchers/${id}`);
    return response.data;
  },
  bulkCreateVouchers: async (data: {
    productId: number;
    pinCodes?: string[];
    vouchers?: { pin: string; giftNumber?: string; securityCode?: string }[];
  }) => {
    const response = await axiosInstance.post('/admin/vouchers/bulk', data);
    return response.data;
  },
  getVoucherInventory: async () => {
    const response = await axiosInstance.get('/admin/vouchers/inventory');
    return response.data;
  },

  // =====================
  // TradeIns Management
  // =====================
  getAllTradeIns: async (params?: { page?: number; limit?: number; status?: string; search?: string; brandCode?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/trade-ins', { params });
    return response.data;
  },
  getTradeIn: async (id: number) => {
    const response = await axiosInstance.get(`/admin/trade-ins/${id}`);
    return response.data;
  },
  updateTradeInStatus: async (id: number, data: { status: string; reason?: string }) => {
    const response = await axiosInstance.patch(`/admin/trade-ins/${id}/status`, data);
    return response.data;
  },

  // =====================
  // Orders Management
  // =====================
  getAllOrders: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/orders', { params });
    return response.data;
  },
  getOrder: async (id: number) => {
    const response = await axiosInstance.get(`/admin/orders/${id}`);
    return response.data;
  },
  updateOrderStatus: async (id: number, status: string) => {
    const response = await axiosInstance.patch(`/admin/orders/${id}/status`, { status });
    return response.data;
  },

  // Bank Report
  getBankTransactionReport: async (params: {
    startDate: string;
    endDate: string;
    type?: 'SALE' | 'PURCHASE' | 'ALL';
    status?: string;
    pinOption?: PinOption;
  }) => {
    const response = await axiosInstance.get('/admin/reports/bank-transactions', { params });
    return response.data;
  },

  // Trade-In Payout Report (Admin, 은행제출용)
  getTradeInPayoutReport: async (params: {
    startDate: string;
    endDate: string;
    status?: string;
    userId?: string;
    brandCode?: string;
    pinOption?: PinOption;
  }) => {
    const response = await axiosInstance.get('/admin/reports/trade-in-payouts', { params });
    return response.data;
  },

  // User Transaction Export (Admin)
  getUserTransactionExport: async (
    userId: number,
    params?: { pinOption?: PinOption; type?: TransactionType },
  ) => {
    const response = await axiosInstance.get(`/admin/reports/user-transactions/${userId}`, { params });
    return response.data;
  },

  // =====================
  // Cart Management (Admin)
  // =====================
  getAllCarts: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/carts', { params });
    return response.data;
  },
  getUserCarts: async (userId: number) => {
    const response = await axiosInstance.get(`/admin/carts/user/${userId}`);
    return response.data;
  },
  deleteCartItem: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/carts/${id}`);
    return response.data;
  },
  clearUserCart: async (userId: number) => {
    const response = await axiosInstance.delete(`/admin/carts/user/${userId}/all`);
    return response.data;
  },

  // =====================
  // Notices Management
  // =====================
  getAllNotices: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get<PaginatedResponse<Notice>>('/admin/notices', { params });
    return response.data;
  },
  getNotice: async (id: number) => {
    const response = await axiosInstance.get<Notice>(`/admin/notices/${id}`);
    return response.data;
  },
  createNotice: async (data: { title: string; content: string; isActive?: boolean }) => {
    const response = await axiosInstance.post('/admin/notices', data);
    return response.data;
  },
  updateNotice: async (id: number, data: { title?: string; content?: string; isActive?: boolean }) => {
    const response = await axiosInstance.patch(`/admin/notices/${id}`, data);
    return response.data;
  },
  deleteNotice: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/notices/${id}`);
    return response.data;
  },

  // =====================
  // Events Management
  // =====================
  getAllEvents: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get<PaginatedResponse<Event>>('/admin/events', { params });
    return response.data;
  },
  getEvent: async (id: number) => {
    const response = await axiosInstance.get<Event>(`/admin/events/${id}`);
    return response.data;
  },
  createEvent: async (data: { title: string; description: string; imageUrl?: string; startDate: string; endDate: string; isActive?: boolean; isFeatured?: boolean }) => {
    const response = await axiosInstance.post('/admin/events', data);
    return response.data;
  },
  updateEvent: async (id: number, data: { title?: string; description?: string; imageUrl?: string; startDate?: string; endDate?: string; isActive?: boolean; isFeatured?: boolean }) => {
    const response = await axiosInstance.patch(`/admin/events/${id}`, data);
    return response.data;
  },
  deleteEvent: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/events/${id}`);
    return response.data;
  },

  // =====================
  // FAQs Management
  // =====================
  getAllFaqs: async (params?: { page?: number; limit?: number; category?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<Faq>>('/admin/faqs', { params });
    return response.data;
  },
  getFaq: async (id: number) => {
    const response = await axiosInstance.get<Faq>(`/admin/faqs/${id}`);
    return response.data;
  },
  createFaq: async (data: { question: string; answer: string; category: string; order?: number; isActive?: boolean }) => {
    const response = await axiosInstance.post('/admin/faqs', data);
    return response.data;
  },
  updateFaq: async (id: number, data: { question?: string; answer?: string; category?: string; order?: number; isActive?: boolean }) => {
    const response = await axiosInstance.patch(`/admin/faqs/${id}`, data);
    return response.data;
  },
  deleteFaq: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/faqs/${id}`);
    return response.data;
  },

  // =====================
  // Inquiries Management
  // =====================
  getAllInquiries: async (params?: { page?: number; limit?: number; status?: string; category?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<Inquiry>>('/admin/inquiries', { params });
    return response.data;
  },
  getInquiry: async (id: number) => {
    const response = await axiosInstance.get<Inquiry>(`/admin/inquiries/${id}`);
    return response.data;
  },
  answerInquiry: async (id: number, data: { answer: string }) => {
    const response = await axiosInstance.patch(`/admin/inquiries/${id}/answer`, data);
    return response.data;
  },
  closeInquiry: async (id: number) => {
    const response = await axiosInstance.patch(`/admin/inquiries/${id}/close`);
    return response.data;
  },
  deleteInquiry: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/inquiries/${id}`);
    return response.data;
  },

  // =====================
  // Refunds Management
  // =====================
  getAllRefunds: async (params?: { page?: number; limit?: number; status?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/refunds', { params });
    return response.data;
  },
  getRefund: async (id: number) => {
    const response = await axiosInstance.get(`/admin/refunds/${id}`);
    return response.data;
  },
  approveRefund: async (id: number, adminNote?: string) => {
    const response = await axiosInstance.post(`/admin/refunds/${id}/approve`, { adminNote });
    return response.data;
  },
  rejectRefund: async (id: number, adminNote?: string) => {
    const response = await axiosInstance.post(`/admin/refunds/${id}/reject`, { adminNote });
    return response.data;
  },

  // =====================
  // Gifts Management
  // =====================
  getAllGifts: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/gifts', { params });
    return response.data;
  },
  getGift: async (id: number) => {
    const response = await axiosInstance.get(`/admin/gifts/${id}`);
    return response.data;
  },
  getGiftStats: async () => {
    const response = await axiosInstance.get('/admin/gifts/stats');
    return response.data;
  },

  // =====================
  // AuditLogs Management
  // =====================
  getAllAuditLogs: async (params?: { page?: number; limit?: number; action?: string; resource?: string; userId?: number }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/audit-logs', { params });
    return response.data;
  },
  getAuditLog: async (id: number) => {
    const response = await axiosInstance.get(`/admin/audit-logs/${id}`);
    return response.data;
  },

  // =====================
  // SiteConfigs Management
  // =====================
  getAllSiteConfigs: async () => {
    const response = await axiosInstance.get('/admin/site-configs');
    return response.data;
  },
  updateSiteConfig: async (key: string, value: string) => {
    const response = await axiosInstance.patch(`/admin/site-configs/${key}`, { value });
    return response.data;
  },
};

// ── Cash Receipt API ──

export const cashReceiptApi = {
  /** 내 현금영수증 목록 조회 */
  getMyReceipts: (page = 1, limit = 20) =>
    axiosInstance.get('/cash-receipts/my', { params: { page, limit } }),

  /** 현금영수증 상세 조회 */
  getReceipt: (id: number) =>
    axiosInstance.get(`/cash-receipts/${id}`),

  /** 현금영수증 사후 신청 */
  requestReceipt: (data: {
    orderId: number;
    type: 'INCOME_DEDUCTION' | 'EXPENSE_PROOF';
    identityType: 'PHONE' | 'BUSINESS_NO' | 'CARD_NO';
    identityNumber: string;
  }) => axiosInstance.post('/cash-receipts/request', data),
};

// =====================
// Business Inquiry (public)
// =====================

export const businessInquiryApi = {
  submit: async (data: {
    companyName: string;
    businessRegNo: string;
    businessOpenDate: string;
    repName: string;
    contactName: string;
    email: string;
    phone: string;
    category: string;
    message: string;
  }) => {
    const response = await axiosInstance.post('/business-inquiries', data);
    return response.data;
  },
};

// ── Partner Business Info (Admin) ──

export const adminPartnerBusinessInfoApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    axiosInstance.get('/admin/partner-business-infos', { params }),
  getByPartnerId: (partnerId: number) =>
    axiosInstance.get(`/admin/partner-business-infos/${partnerId}`),
  verify: (id: number, data: { status: 'VERIFIED' | 'REJECTED'; note?: string }) =>
    axiosInstance.patch(`/admin/partner-business-infos/${id}/verify`, data),
};

// =====================
// Content Attachment API (public)
// =====================

export interface ContentAttachment {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export const contentAttachmentApi = {
  getList: async (targetType: string, targetId: number): Promise<ContentAttachment[]> => {
    const response = await axiosInstance.get('/attachments', { params: { targetType, targetId } });
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  },
};

// ── Notification Channel API ──

export const notificationChannelApi = {
  getChannels: () => axiosInstance.get('/admin/notification-channels'),
  getChannel: (channel: string) => axiosInstance.get(`/admin/notification-channels/${channel}`),
  toggleChannel: (channel: string, enabled: boolean) =>
    axiosInstance.patch(`/admin/notification-channels/${channel}/toggle`, { enabled }),
  updateConfig: (channel: string, fields: Record<string, string>) =>
    axiosInstance.patch(`/admin/notification-channels/${channel}/config`, { fields }),
  testChannel: (channel: string, recipient?: string) =>
    axiosInstance.post(`/admin/notification-channels/${channel}/test`, { recipient }),
};
