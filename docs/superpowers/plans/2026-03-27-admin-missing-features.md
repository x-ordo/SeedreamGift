# Admin Missing Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 25 missing backend API endpoints in the admin frontend across 7 feature areas.

**Architecture:** All backend APIs already exist. Work is frontend-only: add API wrapper functions in `manual.ts`, create 2 new tab components, extend 5 existing tabs with new sections. Follow existing patterns (useAdminList + AdminTable + ConfirmModal).

**Tech Stack:** React 18 + TypeScript, Zustand, custom design system (Button, Badge, AdminTable), lucide-react icons, Axios

---

### Task 1: Add all missing API functions to manual.ts

**Files:**
- Modify: `admin/src/api/manual.ts` (before closing `};` at line 1029)

- [ ] **Step 1: Add cash receipt API functions**

Insert before the closing `};` at line 1029:

```typescript
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
```

- [ ] **Step 2: Add partner price API functions**

```typescript
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
```

- [ ] **Step 3: Add partner business info API functions**

```typescript
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
```

- [ ] **Step 4: Add notification channel API functions**

```typescript
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
```

- [ ] **Step 5: Add remaining API functions (system, site config CRUD, user create, voucher stock)**

```typescript
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
```

- [ ] **Step 6: TypeScript check**

Run: `pnpm --filter admin exec tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add admin/src/api/manual.ts
git commit -m "feat(admin): add 25 missing API wrapper functions"
```

---

### Task 2: Create CashReceiptsTab

**Files:**
- Create: `admin/src/pages/Admin/tabs/CashReceiptsTab.tsx`
- Modify: `admin/src/pages/Admin/constants.ts` (add tab to AdminTab type + ADMIN_TABS array)
- Modify: `admin/src/pages/Admin/AdminPage.tsx` (add lazy import)

- [ ] **Step 1: Add 'cash-receipts' to AdminTab type and ADMIN_TABS**

In `constants.ts`, add `'cash-receipts'` to the `AdminTab` union type. Add tab config to `ADMIN_TABS` array in the transactions group (after `'settlements'`). Import `ReceiptText` from lucide-react.

- [ ] **Step 2: Add lazy import in AdminPage.tsx**

```typescript
'cash-receipts': lazy(() => import('./tabs/CashReceiptsTab')),
```

- [ ] **Step 3: Create CashReceiptsTab.tsx**

Full tab component with:
- AdminTable listing cash receipts (id, orderId, type, identityNumber masked, amount, status, popbillNtsConfirmNum, createdAt)
- Row detail expansion or modal for viewing single receipt
- Action buttons: 취소, 재발행, 팝빌 동기화 (each with ConfirmModal)
- Status filter dropdown
- Follow FraudTab/OrdersTab pattern exactly

- [ ] **Step 4: TypeScript check + commit**

---

### Task 3: Create PartnerPricesTab

**Files:**
- Create: `admin/src/pages/Admin/tabs/PartnerPricesTab.tsx`
- Modify: `admin/src/pages/Admin/constants.ts` (add tab)
- Modify: `admin/src/pages/Admin/AdminPage.tsx` (add lazy import)

- [ ] **Step 1: Add 'partner-prices' to AdminTab and ADMIN_TABS**

Add in the `products` group. Import `BadgeDollarSign` from lucide-react.

- [ ] **Step 2: Add lazy import in AdminPage.tsx**

- [ ] **Step 3: Create PartnerPricesTab.tsx**

Full tab with:
- AdminTable listing all partner prices (partner name, product name, custom price, custom discount rate, createdAt)
- Partner filter dropdown (load partners from getAllUsers with role=PARTNER)
- "단가 설정" button → modal form (partner select, product select, price input)
- Delete button with ConfirmModal

- [ ] **Step 4: TypeScript check + commit**

---

### Task 4: Add Partner Business Info section to PartnersTab

**Files:**
- Modify: `admin/src/pages/Admin/tabs/PartnersTab.tsx`

- [ ] **Step 1: Read current PartnersTab to understand structure**

- [ ] **Step 2: Add business info section**

Below the existing partner management section, add:
- "사업자 정보" section header
- Button to load business info for selected partner
- Business info detail card (companyName, bizNumber, representative, address, verified status)
- "검증" button (PATCH verify) with ConfirmModal
- "삭제" button with ConfirmModal

- [ ] **Step 3: TypeScript check + commit**

---

### Task 5: Add Notification Channels + Site Config CRUD to ConfigsTab

**Files:**
- Modify: `admin/src/pages/Admin/tabs/ConfigsTab.tsx`

- [ ] **Step 1: Add notification channels section**

Below the existing site configs table, add:
- "알림 채널 관리" section header
- Card grid (email, kakao, telegram, popbill) — each card shows:
  - Channel name + icon
  - Enabled/Disabled toggle (calls toggleNotificationChannel)
  - "설정" button → modal for editing channel config
  - "테스트 발송" button → calls testNotificationChannel

- [ ] **Step 2: Add site config create/delete**

- "설정 추가" button at top → modal with key, value, type, description fields
- Delete button on each config row → ConfirmModal

- [ ] **Step 3: TypeScript check + commit**

---

### Task 6: Add System Info + Stock Alerts to DashboardTab

**Files:**
- Modify: `admin/src/pages/Admin/tabs/DashboardTab.tsx`

- [ ] **Step 1: Add system info card**

At the bottom of DashboardTab, add a "시스템 정보" section:
- Calls `adminApi.getSystemInfo()` on mount
- Displays: Go version, uptime, memory usage, DB connection pool stats, API version, build time
- Simple key-value grid layout

- [ ] **Step 2: Add stock alerts card**

- Calls `adminApi.getStockAlerts()` on mount
- Displays products with low voucher stock as warning badges
- Each alert shows: product name, available count, threshold

- [ ] **Step 3: TypeScript check + commit**

---

### Task 7: Add User Create + Voucher Stock to existing tabs

**Files:**
- Modify: `admin/src/pages/Admin/tabs/UsersTab.tsx`
- Modify: `admin/src/pages/Admin/tabs/VouchersTab.tsx`

- [ ] **Step 1: Add "사용자 추가" to UsersTab**

- "사용자 추가" button in page header
- Modal with form: email (required), password (required), name, role (select: USER/PARTNER/ADMIN)
- Calls `adminApi.createUser(data)` → reload list → success toast

- [ ] **Step 2: Add product-level voucher stock to VouchersTab**

- "상품별 재고 조회" section or dropdown at top
- Product selector → calls `adminApi.getVoucherStock(productId)`
- Displays: total, available, sold, expired counts for that product

- [ ] **Step 3: TypeScript check + commit**

---

### Task 8: Final verification

- [ ] **Step 1: Full TypeScript check**

Run: `pnpm --filter admin exec tsc --noEmit`

- [ ] **Step 2: Verify all 25 endpoints are now called**

Grep for each API function name in the admin source to confirm usage.

- [ ] **Step 3: Final commit**
