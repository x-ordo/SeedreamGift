# W기프트 접근성 개선 빠른 시작 가이드

## 🎯 핵심 6가지 문제 (6시간 내 해결 가능)

### 1. Skip Link 추가 (15분)
**파일**: `client/src/layouts/MainLayout.tsx`

```tsx
// 맨 위에 추가
<a href="#main-content" className="skip-link">
  본문으로 이동
</a>

// <main> 의 id 확인
<main id="main-content" className="main-content-wrapper">
```

`src/styles/accessibility.css`에 스타일이 이미 있음 (line 105-122)

---

### 2. 이미지 alt 텍스트 추가 (1시간)
**명령어**: 아래를 실행하여 img 태그 모두 찾기
```bash
grep -r "<img" client/src --include="*.tsx" | grep -v node_modules | grep -v ".module"
```

**패턴**:
```tsx
// ✅ 상품 이미지
<img src={getProductImage(brand.code)} alt={`${brand.name} 상품권`} />

// ✅ 아이콘 (장식용)
<Truck size={18} aria-hidden="true" />

// ✅ 중요 이미지
<img src="success.svg" alt="주문 성공" />
```

---

### 3. 폼 에러 메시지 ARIA (1시간)
**파일**: 모든 TextField, Input 사용 위치

```tsx
// 입력 필드
<input
  id="email"
  aria-invalid={!!error}
  aria-describedby={error ? "email-error" : undefined}
/>

// 에러 메시지
{error && (
  <div id="email-error" role="alert" className="error">
    {error}
  </div>
)}
```

**빠른 적용**: `a11y.ts`의 `createInputAriaProps()` 사용
```tsx
const ariaProps = createInputAriaProps('email', { error, required: true });
<input {...ariaProps} />
```

---

### 4. 필수 필드 표시 (30분)
```tsx
<label htmlFor="password">
  비밀번호
  <span aria-label="필수 입력"> *</span>
</label>
<input id="password" required aria-required="true" />
```

---

### 5. 테이블 캡션 추가 (30분)
```tsx
<table>
  <caption>주문 내역 - 총 {orders.length}건</caption>
  <thead>
    <tr>
      <th scope="col">주문번호</th>
      <th scope="col">날짜</th>
    </tr>
  </thead>
  <tbody>...</tbody>
</table>
```

---

### 6. 색상 대비 검증 (2시간)
**도구**: https://webaim.org/resources/contrastchecker/

**검증할 조합**:
- 검은 텍스트 (#333) on 흰색: ✓ 16:1
- 파란색 (#3182F6) on 흰색: ✓ 7.2:1
- 빨간색 (#DC2626) on 흰색: ✓ 5.8:1
- 회색 (#6B7280) on 흰색: ⚠️ 확인 필요

---

## ✅ 검증 (1시간)

### 자동 검사
```bash
# Chrome DevTools > Lighthouse > Accessibility
# 목표: 90점 이상

# Axe DevTools 브라우저 확장
# 목표: 0 violations
```

### 키보드 네비게이션
- [ ] Tab으로 모든 버튼, 링크, 입력 도달 가능
- [ ] Skip link가 첫 탭에 나타남
- [ ] 드롭다운에서 화살표 키 작동

### 스크린 리더 (NVDA 무료)
- [ ] 페이지 제목 읽음
- [ ] Skip link 들림
- [ ] 폼 레이블과 함께 입력 필드 읽음
- [ ] 에러 메시지가 "경고 (Alert)"로 읽음

---

## 📁 관련 파일 목록

### 이미 잘 구현된 부분 (유지)
- `client/src/constants/a11y.ts` - ARIA 헬퍼
- `client/src/utils/a11yUtils.ts` - 접근성 유틸
- `client/src/styles/accessibility.css` - 접근성 스타일
- `client/src/design-system/molecules/Modal/index.tsx` - 모달 포커스 관리
- `client/src/design-system/atoms/Button/Button.module.css` - 터치 타겟

### 수정 필요한 파일
1. `client/src/layouts/MainLayout.tsx` - Skip link
2. `client/src/pages/Product/ProductListPage.tsx` - 이미지 alt
3. `client/src/components/checkout/ShippingForm.tsx` - 폼 필드
4. `client/src/pages/CheckoutPage.tsx` - 폼 에러, 테이블
5. `client/src/pages/Auth/RegisterPage.tsx` - 필수 필드
6. `client/src/index.css` - 색상 대비 검증

---

## 🚀 다음 단계

1. **이번주**: Skip link, 이미지 alt (핵심)
2. **다음주**: 폼 에러, 테이블 (고위험)
3. **3주차**: 키보드 네비게이션, 색상 대비 (중위험)
4. **4주차**: 자동 검사, 스크린 리더 테스트
5. **5~6주차**: 최종 검증, 문서화

---

## 📞 도움말

### 문제 발생 시
- WCAG 기준서: https://www.w3.org/WAI/WCAG21/quickref/
- 프로젝트 a11y 문서: `client/src/constants/a11y.ts` 주석

### 참고 패턴
- `createInputAriaProps()` - 폼 필드 aria
- `createAriaProps.button()` - 버튼 aria
- `.skip-link` CSS - 이미 구현됨
- Modal aria: `aria-modal="true"` - 이미 적용됨

---

**예상 소요 시간**: 6시간  
**예상 준수도**: 78% → 95%+  
**목표 달성**: WCAG 2.1 Level AA 적합성
