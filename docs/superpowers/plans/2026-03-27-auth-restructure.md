# WebAuthn + OTP 인증 체계 재구조화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 패스키 우선 로그인 + OTP를 비밀번호 로그인 2차 인증으로 재배치 + 3앱(클라이언트/어드민/파트너) 보안 설정 일관화

**Architecture:** 백엔드 auth_service의 MFA 조건을 변경하고, 패스키 직접 로그인 라우트를 복원하며, 주문 OTP를 제거한다. 프론트엔드 3개 앱의 로그인 페이지를 패스키 우선 + 비밀번호 폴백 구조로 통일하고, 보안 설정에 패스키 이름변경/OTP 관리/비밀번호 변경을 추가한다.

**Tech Stack:** Go (Gin + GORM + MSSQL), React 18 + TypeScript (Vite), WebAuthn, TOTP

**Spec:** `docs/superpowers/specs/2026-03-27-auth-restructure-design.md`

---

## 파일 구조

### 백엔드 수정

| 파일 | 변경 |
|------|------|
| `go-server/internal/app/services/auth_service.go` | Login() MFA 조건: OTP만 트리거 (WebAuthn은 패스키 로그인으로 분리) |
| `go-server/internal/app/services/order_service.go` | OTP 검증 제거, mfaService 의존성 제거 |
| `go-server/internal/app/services/webauthn_service.go` | RenameCredential 메서드 추가 |
| `go-server/internal/app/services/admin_user_svc.go` | ResetUserWebAuthn, GetUserWebAuthnCredentials 추가 |
| `go-server/internal/api/handlers/webauthn_handler.go` | RenameCredential 핸들러 추가 |
| `go-server/internal/api/handlers/admin_user_handler.go` | WebAuthn 초기화/조회 핸들러 추가 |
| `go-server/internal/routes/register.go` | 패스키 직접 로그인 라우트 복원 |
| `go-server/internal/routes/admin.go` | 관리자 WebAuthn 라우트 추가 |
| `go-server/internal/routes/container.go` | OrderService에서 mfaService 제거 |

### 클라이언트 수정

| 파일 | 변경 |
|------|------|
| `client/src/pages/Auth/LoginPage.tsx` | 패스키 직접 로그인 복원 + OTP MFA + 에러 처리 + 폴백 |
| `client/src/pages/Auth/RegisterPage.tsx` | Step 3 패스키 등록 프롬프트 (이미 구현, 유지) |
| `client/src/pages/MyPage.tsx` | 패스키 이름변경 UI + OTP 재설정 버튼 + 설명 업데이트 |
| `client/src/pages/MyPage.hooks.ts` | handleRenamePasskey 추가 |
| `client/src/pages/CheckoutPage.hooks.ts` | OTP 모달 제거 |
| `client/src/pages/CheckoutPage.tsx` | OTP 모달 UI 제거 |
| `client/src/api/manual.ts` | webauthnApi.renameCredential 추가 |

### 어드민 수정

| 파일 | 변경 |
|------|------|
| `admin/src/pages/AdminLoginPage.tsx` | 패스키 직접 로그인으로 통일 + 비밀번호 폴백 + OTP MFA |
| `admin/src/pages/Admin/tabs/SecurityTab.tsx` | 패스키 이름변경 + OTP 관리 섹션 + 비밀번호 변경 추가 |
| `admin/src/pages/Admin/tabs/UsersTab.tsx` | 사용자 보안 관리 (패스키 초기화/OTP 해제/비번 재설정) |
| `admin/src/api/manual.ts` | renameCredential + resetUserWebAuthn + getUserWebAuthn 추가 |

### 파트너 수정

| 파일 | 변경 |
|------|------|
| `partner/src/pages/PartnerLoginPage.tsx` | 패스키 직접 로그인 + 비밀번호 폴백 + OTP MFA |
| `partner/src/pages/Partner/tabs/ProfileTab.tsx` | 패스키 이름변경 + OTP 관리 섹션 + 비밀번호 변경 추가 |
| `partner/src/api/manual.ts` | MFA setup/verify/disable + renameCredential 추가 |

---

## Task 1: 백엔드 — Login MFA 변경 + 패스키 로그인 라우트 복원

**Files:**
- Modify: `go-server/internal/app/services/auth_service.go`
- Modify: `go-server/internal/routes/register.go`

- [ ] **Step 1: auth_service.go Login() 메서드 변경**

현재 코드 (라인 ~136):
```go
hasWebAuthn := user.WebAuthnEnabled && s.hasWebAuthnCredentials(user.ID)
if hasWebAuthn {
    methods := []string{"webauthn"}
```

변경: MfaEnabled(OTP) 조건을 다시 추가하되 WebAuthn과 분리:
```go
hasWebAuthn := user.WebAuthnEnabled && s.hasWebAuthnCredentials(user.ID)

// OTP가 활성화된 사용자: 비밀번호 로그인 시 OTP 2차 인증
// WebAuthn은 별도 패스키 로그인 흐름으로 분리됨 (이 메서드는 비밀번호 로그인만 처리)
if user.MfaEnabled {
    mfaToken, err := jwt.GenerateMFAToken(user.ID, s.cfg.JWTSecret, s.cfg.MFATokenExpiry)
    if err != nil {
        return nil, "", apperror.Internal("MFA 토큰 생성 실패", err)
    }
    return &MFARequiredResponse{
        MFARequired:     true,
        MFAToken:        mfaToken,
        MFAMethods:      []string{"totp"},
        WebAuthnEnabled: hasWebAuthn,
    }, "", nil
}
```

핵심: `hasWebAuthn` 조건 제거, `user.MfaEnabled`만 MFA 트리거. 패스키 로그인은 별도 엔드포인트(`/webauthn/login/begin,complete`)로 처리.

- [ ] **Step 2: register.go에 패스키 직접 로그인 라우트 복원**

현재 `waPublic` 그룹에 `/mfa/begin`, `/mfa/complete`만 있음. 패스키 직접 로그인 라우트 추가:

```go
waPublic.POST("/login/begin", h.WebAuthn.BeginAuthentication)
waPublic.POST("/login/complete", h.WebAuthn.FinishAuthentication)
```

`/mfa/begin`, `/mfa/complete`도 유지 (OTP 사용자가 WebAuthn MFA를 선택할 수 있도록).

- [ ] **Step 3: 빌드 확인**

Run: `cd go-server && go build ./...`

- [ ] **Step 4: 커밋**

```bash
git add go-server/internal/app/services/auth_service.go go-server/internal/routes/register.go
git commit -m "feat: restore passkey direct login, OTP-only MFA for password login"
```

---

## Task 2: 백엔드 — 주문 OTP 제거 + 패스키 이름변경 + 관리자 WebAuthn 초기화

**Files:**
- Modify: `go-server/internal/app/services/order_service.go`
- Modify: `go-server/internal/routes/container.go`
- Modify: `go-server/internal/app/services/webauthn_service.go`
- Modify: `go-server/internal/api/handlers/webauthn_handler.go`
- Modify: `go-server/internal/routes/register.go`
- Modify: `go-server/internal/app/services/admin_user_svc.go`
- Modify: `go-server/internal/api/handlers/admin_user_handler.go`
- Modify: `go-server/internal/routes/admin.go`

- [ ] **Step 1: order_service.go에서 OTP 검증 제거**

- `CreateOrderInput`에서 `OTPCode string` 필드 제거
- `CreateOrder()` 시작 부분의 OTP 검증 블록 제거 (user.MfaEnabled 체크 + VerifyTOTP 호출)
- `OrderService` struct에서 `mfaService *MfaService` 필드 제거
- `NewOrderService` 생성자에서 `mfaService` 파라미터 제거

- [ ] **Step 2: container.go에서 OrderService 생성 수정**

```go
// 변경 전: orderService := services.NewOrderService(db, pp, cfg, configProvider, mfaService)
// 변경 후: orderService := services.NewOrderService(db, pp, cfg, configProvider)
```

- [ ] **Step 3: webauthn_service.go에 RenameCredential 추가**

```go
// RenameCredential은 패스키의 표시 이름을 변경합니다.
func (s *WebAuthnService) RenameCredential(userID, credentialID int, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return apperror.Validation("패스키 이름을 입력해주세요")
	}
	if len([]rune(name)) > 50 {
		return apperror.Validation("패스키 이름은 50자 이내로 입력해주세요")
	}
	result := s.db.Model(&domain.WebAuthnCredential{}).
		Where("Id = ? AND UserId = ?", credentialID, userID).
		Update("Name", name)
	if result.RowsAffected == 0 {
		return apperror.NotFound("패스키를 찾을 수 없습니다")
	}
	return result.Error
}
```

`"strings"` import 필요 시 추가.

- [ ] **Step 4: webauthn_handler.go에 RenameCredential 핸들러 추가**

```go
// RenameCredential은 패스키의 표시 이름을 변경합니다.
func (h *WebAuthnHandler) RenameCredential(c *gin.Context) {
	userID := c.GetInt("userId")
	credID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "이름을 입력해주세요")
		return
	}
	if err := h.service.RenameCredential(userID, credID, req.Name); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "패스키 이름이 변경되었습니다"})
}
```

- [ ] **Step 5: register.go에 PATCH 라우트 추가**

`waAuthed` 그룹에:
```go
waAuthed.PATCH("/credentials/:id", h.WebAuthn.RenameCredential)
```

- [ ] **Step 6: admin_user_svc.go에 WebAuthn 관리 메서드 추가**

```go
// GetUserWebAuthnCredentials는 관리자가 특정 사용자의 패스키 목록을 조회합니다.
func (s *AdminUserService) GetUserWebAuthnCredentials(userID int) ([]domain.WebAuthnCredential, error) {
	var creds []domain.WebAuthnCredential
	err := s.db.Where("UserId = ?", userID).Order("CreatedAt DESC").Find(&creds).Error
	return creds, err
}

// ResetUserWebAuthn은 관리자가 특정 사용자의 모든 패스키를 삭제합니다.
func (s *AdminUserService) ResetUserWebAuthn(userID int) error {
	if err := s.db.Where("UserId = ?", userID).Delete(&domain.WebAuthnCredential{}).Error; err != nil {
		return apperror.Internal("패스키 초기화 실패", err)
	}
	s.db.Model(&domain.User{}).Where("Id = ?", userID).Update("WebAuthnEnabled", false)
	return nil
}
```

- [ ] **Step 7: admin_user_handler.go에 핸들러 추가**

```go
func (h *AdminUserHandler) GetUserWebAuthn(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 사용자 ID입니다")
		return
	}
	creds, err := h.service.GetUserWebAuthnCredentials(userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, creds)
}

func (h *AdminUserHandler) ResetUserWebAuthn(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 사용자 ID입니다")
		return
	}
	if err := h.service.ResetUserWebAuthn(userID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "사용자의 모든 패스키가 초기화되었습니다"})
}
```

- [ ] **Step 8: admin.go에 라우트 추가**

admin 그룹에:
```go
admin.GET("/users/:id/webauthn", h.AdminUser.GetUserWebAuthn)
admin.DELETE("/users/:id/webauthn", h.AdminUser.ResetUserWebAuthn)
```

- [ ] **Step 9: 빌드 확인 + 커밋**

Run: `cd go-server && go build ./...`

```bash
git add go-server/
git commit -m "feat: remove order OTP, add passkey rename, admin WebAuthn reset"
```

---

## Task 3: 클라이언트 — LoginPage 패스키 직접 로그인 복원 + OTP 폴백

**Files:**
- Modify: `client/src/pages/Auth/LoginPage.tsx`
- Modify: `client/src/api/manual.ts`

- [ ] **Step 1: manual.ts — webauthnApi에 loginBegin/loginComplete 확인**

이미 존재해야 함. 없으면 추가:
```typescript
loginBegin: async (email: string) => {
  const response = await axiosInstance.post('/auth/webauthn/login/begin', { email });
  return response.data;
},
loginComplete: async (assertion: any) => {
  const response = await axiosInstance.post('/auth/webauthn/login/complete', assertion);
  return response;
},
```

`renameCredential`도 추가:
```typescript
renameCredential: async (id: string, name: string) => {
  const response = await axiosInstance.patch(`/auth/webauthn/credentials/${id}`, { name });
  return response.data;
},
```

- [ ] **Step 2: LoginPage.tsx 재구조화**

현재 상태: 패스키 직접 로그인 버튼이 제거된 상태 (이전 세션에서 삭제). 복원 필요.

로그인 페이지 UI 구조:
1. 이메일 입력 (공통)
2. "패스키로 로그인" 버튼 (`isWebAuthnSupported()` 시만 표시)
3. "또는" 구분선
4. 비밀번호 입력 + "로그인" 버튼
5. "비밀번호를 잊으셨나요?" 링크

패스키 로그인 핸들러 (복원):
```typescript
const handlePasskeyLogin = async () => {
  if (!formData.email.trim()) {
    showToast({ message: '이메일을 입력해주세요', type: 'error' });
    return;
  }
  setIsLoading(true);
  try {
    const options = await webauthnApi.loginBegin(formData.email);
    const assertion = await startWebAuthnAuthentication(options);
    const res = await webauthnApi.loginComplete(assertion);
    const data = res.data?.data || res.data;
    localStorage.setItem('was_logged_in', Date.now().toString());
    useAuthStore.setState({ token: data.access_token, user: data.user, isAuthenticated: true, isLoading: false });
    await handleLoginSuccess();
  } catch (err) {
    const msg = getErrorMessage(err, '패스키 인증에 실패했습니다');
    if (msg.includes('등록된 패스키') || msg.includes('not found')) {
      showToast({ message: '등록된 패스키가 없습니다. 비밀번호로 로그인해주세요.', type: 'info' });
    } else {
      showToast({ message: msg, type: 'error' });
    }
  } finally {
    setIsLoading(false);
  }
};
```

비밀번호 로그인 후 MFA 처리:
- `err.mfaMethods.includes('totp')` → OTP 6자리 입력 UI 표시
- `err.mfaMethods.includes('webauthn')` → WebAuthn ceremony 자동 시작 (비밀번호+WebAuthn MFA 케이스)
- 패스키 실패 시: "비밀번호로 로그인" 폴백 링크

패스키 인증 중 UI:
```tsx
{passkeyLoading && (
  <div style={{ textAlign: 'center', padding: '32px' }}>
    <Fingerprint size={48} style={{ color: 'var(--color-primary)', margin: '0 auto 16px' }} />
    <p style={{ fontWeight: 600 }}>패스키로 본인 확인 중...</p>
    <p style={{ fontSize: '13px', color: 'var(--color-grey-500)', marginTop: '8px' }}>
      기기의 지문 인식 또는 얼굴 인식을 사용하여 인증해주세요.
    </p>
  </div>
)}
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/pages/Auth/LoginPage.tsx client/src/api/manual.ts
git commit -m "feat: restore passkey direct login with password+OTP fallback on client LoginPage"
```

---

## Task 4: 클라이언트 — MyPage 보안설정 업데이트 + Checkout OTP 제거

**Files:**
- Modify: `client/src/pages/MyPage.tsx`
- Modify: `client/src/pages/MyPage.hooks.ts`
- Modify: `client/src/pages/CheckoutPage.hooks.ts`
- Modify: `client/src/pages/CheckoutPage.tsx`
- Modify: `client/src/hooks/mutations/useCreateOrder.ts`

- [ ] **Step 1: MyPage.hooks.ts에 handleRenamePasskey 추가**

```typescript
const handleRenamePasskey = useCallback(async (credId: string, newName: string) => {
  try {
    await webauthnApi.renameCredential(credId, newName);
    showToast({ message: '패스키 이름이 변경되었습니다', type: 'success' });
    await loadPasskeyCredentials();
  } catch (err) {
    showToast({ message: getErrorMessage(err, '패스키 이름 변경에 실패했습니다'), type: 'error' });
  }
}, [loadPasskeyCredentials, showToast]);
```

return 객체에 `handleRenamePasskey` 추가.

- [ ] **Step 2: MyPage.tsx 패스키 목록에 이름변경 UI 추가**

각 패스키 항목에 연필 아이콘 버튼 추가. 클릭 시 인라인 편집 모드:
- `editingPasskeyId` state 추가
- `editingPasskeyName` state 추가
- 연필 클릭 → input 표시 + 저장/취소 버튼
- 저장 → `handleRenamePasskey(credId, editingPasskeyName)` 호출

OTP 설명은 이미 업데이트됨 (이전 커밋). "OTP 재설정" 버튼 추가:
- OTP가 활성화된 상태에서만 표시
- 클릭 → 현재 OTP 코드 확인 → 비활성화 → 재설정(QR 모달)

- [ ] **Step 3: CheckoutPage에서 OTP 관련 제거**

`CheckoutPage.hooks.ts`:
- `showOtpModal`, `otpCode`, `setOtpCode`, `handleOtpConfirm` 상태/핸들러 제거
- `handleOrderClick`에서 `user?.mfaEnabled` OTP 체크 제거
- `handleOrderConfirm`에서 `otpCode` 전달 제거

`CheckoutPage.tsx`:
- OTP `<Modal>` 컴포넌트 제거
- `showOtpModal` 등 destructure 제거

`useCreateOrder.ts`:
- `CreateOrderParams`에서 `otpCode` 제거
- mutation body에서 `otpCode` 제거

- [ ] **Step 4: 커밋**

```bash
git add client/src/pages/MyPage.tsx client/src/pages/MyPage.hooks.ts client/src/pages/CheckoutPage.hooks.ts client/src/pages/CheckoutPage.tsx client/src/hooks/mutations/useCreateOrder.ts
git commit -m "feat: add passkey rename, OTP reset to MyPage; remove checkout OTP"
```

---

## Task 5: 어드민 — 로그인 통일 + SecurityTab 업데이트 + 사용자 보안 관리

**Files:**
- Modify: `admin/src/pages/AdminLoginPage.tsx`
- Modify: `admin/src/pages/Admin/tabs/SecurityTab.tsx`
- Modify: `admin/src/pages/Admin/tabs/UsersTab.tsx` (또는 PartnersTab.tsx의 사용자 모달)
- Modify: `admin/src/api/manual.ts`

- [ ] **Step 1: admin manual.ts API 함수 추가**

```typescript
// WebAuthn 관리
renameCredential: async (id: string, name: string) =>
  axiosInstance.patch(`/auth/webauthn/credentials/${id}`, { name }),

// 관리자: 사용자 WebAuthn 관리
getUserWebAuthn: async (userId: number) =>
  axiosInstance.get(`/admin/users/${userId}/webauthn`),
resetUserWebAuthn: async (userId: number) =>
  axiosInstance.delete(`/admin/users/${userId}/webauthn`),

// MFA (OTP) — 관리자 본인용
mfaSetup: async () => axiosInstance.post('/auth/mfa/setup'),
mfaVerify: async (code: string) => axiosInstance.post('/auth/mfa/verify', { code }),
mfaDisable: async (code: string) => axiosInstance.post('/auth/mfa/disable', { code }),
```

- [ ] **Step 2: AdminLoginPage.tsx — 패스키 직접 로그인 구조로 통일**

클라이언트 LoginPage와 동일한 구조:
1. 이메일 + "패스키로 로그인" 버튼 (권장)
2. "또는" + 비밀번호 + "로그인" 버튼
3. MFA 시: OTP 입력 UI
4. 패스키 실패 → "비밀번호로 로그인" 폴백
5. 에러 메시지 통일

기존 어드민 로그인에 이미 WebAuthn 코드가 있으나, MFA 경로로 되어있음. 패스키 직접 로그인(`loginBegin/loginComplete`)으로 변경.

- [ ] **Step 3: SecurityTab.tsx — 패스키 이름변경 + OTP + 비밀번호**

패스키 이름변경:
- 각 credential 옆에 연필 아이콘 추가
- 클릭 → 인라인 편집 (기존 인라인 패턴 활용)
- `renameCredential(id, name)` 호출

OTP 관리 섹션 추가 (패스키 섹션 아래):
- ListRow with Switch toggle (client MyPage 패턴 따라)
- ON → QR 모달 (`mfaSetup` → QR URL → `mfaVerify`)
- OFF → 코드 확인 모달 (`mfaDisable`)
- 설명: "비밀번호 로그인 시 추가 인증"

비밀번호 변경 섹션 추가:
- ListRow with arrow → 모달 (현재 비밀번호 + 새 비밀번호 + 확인)
- `PATCH /auth/password`

- [ ] **Step 4: UsersTab.tsx — 사용자 보안 관리 섹션**

사용자 상세 모달에 보안 정보 추가:
- 패스키 목록 (`getUserWebAuthn(userId)`)
- "WebAuthn 초기화" 버튼 → 확인 모달 → `resetUserWebAuthn(userId)`
- OTP 상태 표시 + "강제 비활성화" → `updateUser(id, {mfaEnabled: false})`
- "비밀번호 재설정 메일" → `resetUserPassword(id)` (기존 기능 활용)

- [ ] **Step 5: 커밋**

```bash
git add admin/src/
git commit -m "feat: admin passkey direct login, security tab OTP/password, user WebAuthn management"
```

---

## Task 6: 파트너 — 로그인 통일 + ProfileTab OTP/비밀번호 추가

**Files:**
- Modify: `partner/src/pages/PartnerLoginPage.tsx`
- Modify: `partner/src/pages/Partner/tabs/ProfileTab.tsx`
- Modify: `partner/src/api/manual.ts`
- Modify: `partner/src/store/useAuthStore.ts` (필요시)

- [ ] **Step 1: partner manual.ts API 함수 추가**

```typescript
// MFA (OTP)
mfaSetup: async () => axiosInstance.post('/auth/mfa/setup'),
mfaVerify: async (code: string) => axiosInstance.post('/auth/mfa/verify', { code }),
mfaDisable: async (code: string) => axiosInstance.post('/auth/mfa/disable', { code }),

// 패스키 이름변경
renameCredential: async (id: string, name: string) =>
  axiosInstance.patch(`/auth/webauthn/credentials/${id}`, { name }),

// 비밀번호 변경
changePassword: async (currentPassword: string, newPassword: string) =>
  axiosInstance.patch('/auth/password', { currentPassword, newPassword }),
```

- [ ] **Step 2: PartnerLoginPage.tsx — 패스키 직접 로그인 구조**

클라이언트/어드민과 동일한 구조:
1. 이메일 + "패스키로 로그인" (권장)
2. "또는" + 비밀번호 + "로그인"
3. MFA: OTP 6자리 입력 (비밀번호 로그인 + MfaEnabled 시)
4. 패스키 실패 → 비밀번호 폴백
5. 에러 메시지 통일

기존 파트너 로그인에 이미 패스키 MFA 경로가 있음. `loginBegin/loginComplete` 직접 로그인으로 변경.

- [ ] **Step 3: ProfileTab.tsx — OTP 관리 + 패스키 이름변경 + 비밀번호 변경**

OTP 섹션 추가 (패스키 섹션 아래):
- Switch toggle + 설명 텍스트 (기존 클라이언트 패턴 따라)
- QR 모달 (setup → verify), 비활성화 모달 (현재 코드 필요)
- "OTP 재설정" 버튼 (활성 시)

패스키 이름변경:
- 각 credential에 연필 아이콘 추가
- 인라인 편집 → `renameCredential(id, name)` 호출

비밀번호 변경:
- ListRow → 모달 (현재 + 새 비밀번호)
- `changePassword(current, new)` 호출

- [ ] **Step 4: partner useAuthStore.ts — MFARequiredError 동기화**

클라이언트와 동일한 `MFARequiredError` 클래스 확인:
```typescript
export class MFARequiredError extends Error {
  mfaToken: string;
  mfaMethods: string[];
  webAuthnEnabled: boolean;
  // ...
}
```

- [ ] **Step 5: 커밋**

```bash
git add partner/src/
git commit -m "feat: partner passkey direct login, OTP/password management in ProfileTab"
```

---

## Task 7: 최종 빌드 확인 + 에러 메시지 검증

**Files:** (모든 수정 파일 대상)

- [ ] **Step 1: Go 빌드**

Run: `cd go-server && go build ./...`

- [ ] **Step 2: Client TS 체크**

Run: `cd client && npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "LoginPage|MyPage|Checkout|manual" | head -10`

- [ ] **Step 3: Admin TS 체크**

Run: `cd admin && npx tsc --noEmit 2>&1 | grep -E "LoginPage|SecurityTab|UsersTab|manual" | head -10`

- [ ] **Step 4: Partner TS 체크**

Run: `cd partner && npx tsc --noEmit 2>&1 | grep -E "LoginPage|ProfileTab|manual|useAuth" | head -10`

- [ ] **Step 5: 에러 메시지 일관성 확인**

3앱에서 동일한 에러 메시지를 사용하는지 grep 확인:
- "패스키 인증이 취소되었습니다"
- "등록된 패스키가 없습니다"
- "인증 코드가 일치하지 않습니다"
- "비밀번호 로그인 시 추가 인증"

- [ ] **Step 6: 최종 커밋**

```bash
git add -A
git commit -m "chore: verify builds and error message consistency across all apps"
```
