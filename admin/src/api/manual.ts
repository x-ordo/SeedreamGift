import { axiosInstance } from '../lib/axios';
import type { Product } from '../types';

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
  updateQuantity: async (cartItemId: number, quantity: number) => {
    const response = await axiosInstance.patch(`/cart/${cartItemId}`, { quantity });
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
    const response = await axiosInstance.get<Event[]>('/events/active', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },
  getFeaturedEvents: async (): Promise<Event[]> => {
    const response = await axiosInstance.get<Event[]>('/events/featured');
    return response.data;
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
    const response = await axiosInstance.get<Faq[]>('/faqs/active', {
      params: category && category !== 'ALL' ? { category } : undefined,
    });
    return response.data;
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
  getActiveNotices: async () => {
    const response = await axiosInstance.get<Notice[]>('/notices/active');
    return response.data;
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
    const response = await axiosInstance.get<Inquiry[]>('/inquiries');
    return response.data;
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
  role: string;
  kycStatus?: string;
  emailNotification?: boolean;
  pushNotification?: boolean;
  zipCode?: string;
  address?: string;
  addressDetail?: string;
}

export interface AuthTokenResponse {
  access_token: string;
  user: AuthUser;
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

// Unified pagination response interface (matches server { items, meta } format)
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

export const adminApi = {
  // Dashboard
  getStats: async (): Promise<AdminStats> => {
    const response = await axiosInstance.get<AdminStats>('/admin/stats');
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

  // Product Approval
  approveProduct: async (id: number, approvalStatus: string, reason?: string) => {
    const response = await axiosInstance.patch(`/admin/products/${id}/approval`, { approvalStatus, reason });
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
    const response = await axiosInstance.patch(`/admin/trade-ins/${id}/status`, {
      status: data.status,
      adminNote: data.reason,
    });
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

  // =====================
  // Payments Management (결제현황)
  // =====================
  getAllPayments: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    method?: string;
    from?: string;   // YYYY-MM-DD
    to?: string;
    search?: string;
  }) => {
    const response = await axiosInstance.get('/admin/payments', { params });
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
  // VA 주문 수동환불 — Seedream RefundDeposited API 호출
  // BankCode 는 9개 화이트리스트, AccountNo 6~20자 숫자/하이픈, CancelReason 5~50 rune
  seedreamRefund: async (id: number, body: { bankCode: string; accountNo: string; cancelReason: string }) => {
    const response = await axiosInstance.post(`/admin/refunds/${id}/seedream-refund`, body);
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

  // =====================
  // Enhanced Stats with Period
  // =====================
  getStatsWithPeriod: async (period: string = 'all') => {
    const response = await axiosInstance.get(`/admin/stats?period=${period}`);
    return response.data;
  },

  // =====================
  // Order Batch & Auto-Deliver
  // =====================
  batchUpdateOrderStatus: async (ids: number[], status: string) => {
    const response = await axiosInstance.patch('/admin/orders/batch-status', { ids, status });
    return response.data;
  },
  autoDeliverOrder: async (orderId: number) => {
    const response = await axiosInstance.post(`/admin/orders/${orderId}/auto-deliver`);
    return response.data;
  },
  updateOrderNote: async (orderId: number, note: string) => {
    const response = await axiosInstance.patch(`/admin/orders/${orderId}/note`, { adminNote: note });
    return response.data;
  },

  // =====================
  // TradeIn Receive
  // =====================
  receiveTradeIn: async (id: number, trackingNumber: string, carrier: string) => {
    const response = await axiosInstance.patch(`/admin/trade-ins/${id}/receive`, { trackingNumber, carrier });
    return response.data;
  },

  // =====================
  // Voucher Expiring
  // =====================
  getExpiringVouchers: async (days: number = 30) => {
    const response = await axiosInstance.get(`/admin/vouchers/expiring?days=${days}`);
    return response.data;
  },

  // =====================
  // User Lock/Unlock & Partner Tier
  // =====================
  lockUser: async (id: number, until: string, reason: string) => {
    const response = await axiosInstance.patch(`/admin/users/${id}/lock`, { until, reason });
    return response.data;
  },
  unlockUser: async (id: number) => {
    const response = await axiosInstance.patch(`/admin/users/${id}/unlock`);
    return response.data;
  },
  updatePartnerTier: async (id: number, tier: string) => {
    const response = await axiosInstance.patch(`/admin/users/${id}/partner-tier`, { tier });
    return response.data;
  },
  getUserSummary: async (id: number) => {
    const response = await axiosInstance.get(`/admin/users/${id}/summary`);
    return response.data;
  },

  // =====================
  // Reports
  // =====================
  getDailySalesReport: async (from: string, to: string) => {
    const response = await axiosInstance.get(`/admin/reports/daily-sales?startDate=${from}&endDate=${to}`);
    return response.data;
  },
  getBrandPerformance: async (from: string, to: string) => {
    const response = await axiosInstance.get(`/admin/reports/brand-performance?startDate=${from}&endDate=${to}`);
    return response.data;
  },
  getProfitReport: async (from: string, to: string) => {
    const response = await axiosInstance.get(`/admin/reports/profit?startDate=${from}&endDate=${to}`);
    return response.data;
  },
  getTopCustomers: async (limit: number = 20) => {
    const response = await axiosInstance.get(`/admin/reports/top-customers?limit=${limit}`);
    return response.data;
  },

  // =====================
  // Pattern Rules
  // =====================
  getPatternRules: async () => {
    const response = await axiosInstance.get('/admin/pattern-rules');
    return response.data;
  },
  togglePatternRule: async (ruleId: string, enabled: boolean) => {
    const response = await axiosInstance.patch(`/admin/pattern-rules/${ruleId}`, { enabled });
    return response.data;
  },

  // =====================
  // Policies Management
  // =====================
  getAllPolicies: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/policies', { params });
    return response.data;
  },
  getPolicy: async (id: number) => {
    const response = await axiosInstance.get(`/admin/policies/${id}`);
    return response.data;
  },
  createPolicy: async (data: { type: string; title: string; content: string; version: string; isCurrent: boolean; isActive: boolean }) => {
    const response = await axiosInstance.post('/admin/policies', data);
    return response.data;
  },
  updatePolicy: async (id: number, data: Partial<{ type: string; title: string; content: string; version: string; isCurrent: boolean; isActive: boolean }>) => {
    const response = await axiosInstance.patch(`/admin/policies/${id}`, data);
    return response.data;
  },
  setCurrentPolicy: async (id: number) => {
    const response = await axiosInstance.patch(`/admin/policies/${id}/current`, {});
    return response.data;
  },
  deletePolicy: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/policies/${id}`);
    return response.data;
  },

  // =====================
  // Settlements Management
  // =====================
  getSettlements: async (params?: { page?: number; limit?: number; status?: string; partnerId?: number; from?: string; to?: string }) => {
    const response = await axiosInstance.get<PaginatedResponse<any>>('/admin/settlements', { params });
    return response.data;
  },
  getSettlement: async (id: number) => {
    const response = await axiosInstance.get(`/admin/settlements/${id}`);
    return response.data;
  },
  updateSettlementStatus: async (id: number, status: string, transferRef?: string, failureReason?: string) => {
    const response = await axiosInstance.patch(`/admin/settlements/${id}/status`, { status, transferRef, failureReason });
    return response.data;
  },
  createSettlementBatch: async (frequency: string) => {
    const response = await axiosInstance.post('/admin/settlements/batch', { frequency });
    return response.data;
  },

  // =====================
  // Partner Config
  // =====================
  setPartnerCommission: async (userId: number, rate: number) => {
    const response = await axiosInstance.patch(`/admin/users/${userId}/commission`, { commissionRate: rate });
    return response.data;
  },
  setPartnerPayoutFrequency: async (userId: number, frequency: string) => {
    const response = await axiosInstance.patch(`/admin/users/${userId}/payout-frequency`, { payoutFrequency: frequency });
    return response.data;
  },
  setPartnerLimits: async (userId: number, dailyPinLimit: number) => {
    const response = await axiosInstance.patch(`/admin/users/${userId}/partner-limits`, { dailyPinLimit });
    return response.data;
  },

  // =====================
  // IP Whitelist
  // =====================
  getIPWhitelist: async () => {
    const response = await axiosInstance.get('/admin/ip-whitelist');
    return response.data;
  },
  addIPWhitelist: async (ipAddress: string, description: string) => {
    const response = await axiosInstance.post('/admin/ip-whitelist', { ipAddress, description });
    return response.data;
  },
  deleteIPWhitelist: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/ip-whitelist/${id}`);
    return response.data;
  },
  toggleIPWhitelist: async (enabled: boolean) => {
    const response = await axiosInstance.patch('/admin/ip-whitelist/toggle', { enabled });
    return response.data;
  },
  getCurrentIP: async () => {
    const response = await axiosInstance.get('/admin/ip-whitelist/current-ip');
    return response.data;
  },

  // =====================
  // Partner Documents
  // =====================
  getPartnerDocuments: async (partnerId: number, params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get('/admin/partner-documents', { params: { partnerId, ...params } });
    return response.data;
  },
  uploadPartnerDocument: async (formData: FormData) => {
    const response = await axiosInstance.post('/admin/partner-documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  downloadPartnerDocument: async (id: number) => {
    return axiosInstance.get(`/admin/partner-documents/${id}/download`, { responseType: 'blob' });
  },
  deletePartnerDocument: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/partner-documents/${id}`);
    return response.data;
  },

  // =====================
  // Business Inquiries
  // =====================
  getBusinessInquiries: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get('/admin/business-inquiries', { params });
    return response.data;
  },
  getBusinessInquiry: async (id: number) => {
    const response = await axiosInstance.get(`/admin/business-inquiries/${id}`);
    return response.data;
  },
  updateBusinessInquiryStatus: async (id: number, status: string) => {
    const response = await axiosInstance.patch(`/admin/business-inquiries/${id}/status`, { status });
    return response.data;
  },
  deleteBusinessInquiry: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/business-inquiries/${id}`);
    return response.data;
  },

  // =====================
  // Content Attachments
  // =====================
  getAttachments: async (targetType: string, targetId: number) => {
    const response = await axiosInstance.get('/admin/attachments', { params: { targetType, targetId } });
    return response.data;
  },
  uploadAttachment: async (formData: FormData) => {
    const response = await axiosInstance.post('/admin/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  downloadAttachment: async (id: number) => {
    return axiosInstance.get(`/admin/attachments/${id}/download`, { responseType: 'blob' });
  },
  deleteAttachment: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/attachments/${id}`);
    return response.data;
  },

  // =====================
  // User WebAuthn Management (Admin)
  // =====================
  getUserWebAuthn: async (userId: number) => {
    const response = await axiosInstance.get(`/admin/users/${userId}/webauthn`);
    return response.data;
  },
  resetUserWebAuthn: async (userId: number) => {
    const response = await axiosInstance.delete(`/admin/users/${userId}/webauthn`);
    return response.data;
  },

  // =====================
  // Fraud Check (사기 조회)
  // =====================
  fraudCheckUser: async (userId: number) => {
    const response = await axiosInstance.get(`/admin/users/${userId}/fraud-check`);
    return response.data;
  },
  fraudHistory: async (userId: number) => {
    const response = await axiosInstance.get(`/admin/users/${userId}/fraud-history`);
    return response.data;
  },
  releaseOrderHold: async (orderId: number, adminNote: string) => {
    const response = await axiosInstance.post(`/admin/orders/${orderId}/release-hold`, { adminNote });
    return response.data;
  },
  releaseTradeInHold: async (tradeInId: number, adminNote: string) => {
    const response = await axiosInstance.post(`/admin/trade-ins/${tradeInId}/release-hold`, { adminNote });
    return response.data;
  },
  blacklistScreen: async (name: string, phone: string, account: string) => {
    const response = await axiosInstance.post('/admin/blacklist-screen', { name, phone, account });
    return response.data;
  },

  // =====================
  // MFA (OTP) — admin self
  // =====================
  mfaSetup: async () => {
    const response = await axiosInstance.post('/auth/mfa/setup');
    return response.data;
  },
  mfaVerify: async (code: string) => {
    const response = await axiosInstance.post('/auth/mfa/verify', { code });
    return response.data;
  },
  mfaDisable: async (code: string) => {
    const response = await axiosInstance.post('/auth/mfa/disable', { code });
    return response.data;
  },
  getMfaStatus: async () => {
    const response = await axiosInstance.get('/auth/mfa/status');
    return response.data;
  },

  // =====================
  // Password Change (self)
  // =====================
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await axiosInstance.patch('/auth/password', { currentPassword, newPassword });
    return response.data;
  },

  // =====================
  // Cash Receipts (현금영수증)
  // =====================
  getAllCashReceipts: async (params?: Record<string, any>) => {
    const response = await axiosInstance.get('/admin/cash-receipts', { params });
    return response.data;
  },
  getCashReceipt: async (id: number) => {
    const response = await axiosInstance.get(`/admin/cash-receipts/${id}`);
    return response.data;
  },
  cancelCashReceipt: async (id: number) => {
    const response = await axiosInstance.post(`/admin/cash-receipts/${id}/cancel`);
    return response.data;
  },
  reissueCashReceipt: async (id: number) => {
    const response = await axiosInstance.post(`/admin/cash-receipts/${id}/reissue`);
    return response.data;
  },
  syncCashReceipt: async (id: number) => {
    const response = await axiosInstance.post(`/admin/cash-receipts/${id}/sync`);
    return response.data;
  },

  // =====================
  // Partner Prices (파트너 단가)
  // =====================
  getPartnerPrices: async (params?: Record<string, any>) => {
    const response = await axiosInstance.get('/admin/partner-prices', { params });
    return response.data;
  },
  getPartnerPricesByPartner: async (partnerId: number) => {
    const response = await axiosInstance.get(`/admin/partner-prices/${partnerId}`);
    return response.data;
  },
  upsertPartnerPrice: async (data: { partnerId: number; productId: number; customPrice: number; customDiscountRate?: number }) => {
    const response = await axiosInstance.post('/admin/partner-prices', data);
    return response.data;
  },
  deletePartnerPrice: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/partner-prices/${id}`);
    return response.data;
  },

  // =====================
  // Partner Business Info (사업자 정보)
  // =====================
  getAllPartnerBusinessInfos: async (params?: Record<string, any>) => {
    const response = await axiosInstance.get('/admin/partner-business-infos', { params });
    return response.data;
  },
  getPartnerBusinessInfo: async (partnerId: number) => {
    const response = await axiosInstance.get(`/admin/partner-business-infos/${partnerId}`);
    return response.data;
  },
  upsertPartnerBusinessInfo: async (partnerId: number, data: Record<string, any>) => {
    const response = await axiosInstance.put(`/admin/partner-business-infos/${partnerId}`, data);
    return response.data;
  },
  verifyPartnerBusinessInfo: async (id: number, data: { verified: boolean; note?: string }) => {
    const response = await axiosInstance.patch(`/admin/partner-business-infos/${id}/verify`, data);
    return response.data;
  },
  deletePartnerBusinessInfo: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/partner-business-infos/${id}`);
    return response.data;
  },

  // =====================
  // Notification Channels (알림 채널)
  // =====================
  getNotificationChannels: async () => {
    const response = await axiosInstance.get('/admin/notification-channels');
    return response.data;
  },
  getNotificationChannel: async (channel: string) => {
    const response = await axiosInstance.get(`/admin/notification-channels/${channel}`);
    return response.data;
  },
  toggleNotificationChannel: async (channel: string) => {
    const response = await axiosInstance.patch(`/admin/notification-channels/${channel}/toggle`);
    return response.data;
  },
  updateNotificationChannelConfig: async (channel: string, config: Record<string, any>) => {
    const response = await axiosInstance.patch(`/admin/notification-channels/${channel}/config`, config);
    return response.data;
  },
  testNotificationChannel: async (channel: string) => {
    const response = await axiosInstance.post(`/admin/notification-channels/${channel}/test`);
    return response.data;
  },

  // =====================
  // System Monitoring (시스템)
  // =====================
  getSystemInfo: async () => {
    const response = await axiosInstance.get('/admin/system/info');
    return response.data;
  },
  getStockAlerts: async () => {
    const response = await axiosInstance.get('/admin/stock/alerts');
    return response.data;
  },

  // =====================
  // Site Config CRUD (추가)
  // =====================
  createSiteConfig: async (data: { key: string; value: string; type?: string; description?: string }) => {
    const response = await axiosInstance.post('/admin/site-configs', data);
    return response.data;
  },
  deleteSiteConfig: async (id: number) => {
    const response = await axiosInstance.delete(`/admin/site-configs/${id}`);
    return response.data;
  },

  // =====================
  // User Create (관리자 직접 생성)
  // =====================
  createUser: async (data: { email: string; password: string; name?: string; role?: string }) => {
    const response = await axiosInstance.post('/admin/users', data);
    return response.data;
  },

  // =====================
  // Voucher Stock by Product
  // =====================
  getVoucherStock: async (productId: number) => {
    const response = await axiosInstance.get(`/admin/vouchers/stock/${productId}`);
    return response.data;
  },
};
