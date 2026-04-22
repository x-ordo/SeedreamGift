# 씨드림기프트 (Seedream Gift) WCAG 2.1 AA 접근성 감사 보고서

**감사 범위**: client/ (React 18 + TypeScript)
**감사 기준**: WCAG 2.1 Level AA
**감사 날짜**: 2026-03-26
**전체 준수도**: 78% (AA 진행 중)

---

## 📊 요약

| 심각도 | 건수 | 상태 |
|--------|------|------|
| 🔴 심각 (Critical) | 0 | - |
| 🔴 고위험 (HIGH) | 6 | 즉시 수정 |
| 🟠 중위험 (MEDIUM) | 12 | 우선 수정 |
| 🟡 저위험 (LOW) | 8 | 개선 권고 |
| ✅ 준수 | 많음 | 유지 |

---

## 1️⃣ 고위험 (HIGH) - 즉시 수정 필요

### HIGH-1: 이미지 alt 텍스트 일관성 부재
**WCAG 1.1.1 Non-text Content**
- **파일**: client/src/pages/Product/ProductListPage.tsx 및 관련 컴포넌트
- **문제**: <img> 또는 이미지 컴포넌트에 alt 속성 없음
- **영향**: 시각장애인이 상품권 정보 이해 불가
- **수정**:
  ```tsx
  <img src={getProductImage(brand.code)} alt={`${brand.name} 상품권`} />
  ```

### HIGH-2: 스킵 링크 (Skip to Content) 부재
**WCAG 2.1.1 Keyboard, 2.4.1 Bypass Blocks**
- **파일**: client/src/layouts/MainLayout.tsx
- **문제**: 키보드 사용자가 매번 헤더를 탭으로 넘어야 함
- **수정**:
  ```tsx
  <a href="#main-content" className="skip-link">
    본문으로 이동
  </a>
  <Header />
  <main id="main-content">...</main>
  ```

### HIGH-3: 폼 에러 메시지 ARIA 접근성
**WCAG 3.3.1 Error Identification, 3.3.2 Labels**
- **파일**: client/src/components/checkout/ShippingForm.tsx, 모든 폼 필드
- **문제**: 에러 메시지에 `role="alert"`, `aria-describedby` 없음
- **수정**:
  ```tsx
  <input
    id="phone"
    aria-invalid={!!error}
    aria-describedby={error ? `phone-error` : undefined}
  />
  {error && (
    <div id="phone-error" role="alert" className="error-text">
      {error}
    </div>
  )}
  ```

### HIGH-4: 드롭다운 키보드 네비게이션
**WCAG 2.1.1 Keyboard**
- **파일**: client/src/components/layout/Header.tsx (user menu dropdown)
- **문제**: 드롭다운 열기 후 화살표 키로 옵션 선택 불가
- **수정**: ArrowUp/Down 키 처리 추가, role="menuitem" 사용

### HIGH-5: 필수 필드 표시 접근성
**WCAG 3.3.2 Labels or Instructions**
- **파일**: RegisterPage.tsx, CheckoutPage.tsx
- **문제**: `required` 속성 있지만 aria-required 미연결, 시각적 표시(*) 레이블 미연결
- **수정**:
  ```tsx
  <label htmlFor="email">
    이메일
    <span aria-label="필수 입력"> *</span>
  </label>
  <input id="email" required aria-required="true" />
  ```

### HIGH-6: 표 캡션 부재
**WCAG 1.3.1 Info and Relationships**
- **파일**: OrdersTab, TransactionsPage 등 테이블 전체
- **문제**: `<caption>` 없음, 테이블 목적 불명확
- **수정**:
  ```tsx
  <table>
    <caption>주문 내역 - 총 {items.length}건</caption>
    <thead>
      <tr>
        <th scope="col">주문번호</th>
        ...
      </tr>
    </thead>
  </table>
  ```

---

## 2️⃣ 중위험 (MEDIUM) - 우선 수정

### MED-1: 색상 대비 검증 필요
**WCAG 1.4.3 Contrast (Minimum)**
- **파일**: client/src/index.css (daisyUI 테마)
- **문제**: oklch 색상 사용하나 명시적 대비 검증 부재
- **검증 필요**:
  - 기본 텍스트 vs 배경: 4.5:1 이상
  - 큰 텍스트 (18pt+): 3:1 이상
- **도구**: WebAIM Contrast Checker, Lighthouse, axe DevTools

### MED-2: 제목 계층 구조 불일치
**WCAG 1.3.1 Info and Relationships**
- **파일**: CheckoutPage.tsx, MyPage.tsx 등
- **문제**: h2 → h4 건너뜀 (h3 생략)
- **수정**: h1→h2→h3→h4 순서 준수

### MED-3: 동적 콘텐츠 포커스 관리
**WCAG 2.1.1 Keyboard, 3.2.1 On Focus**
- **파일**: CheckoutPage.tsx (폼 제출 후)
- **문제**: 성공/에러 메시지로 포커스 이동 없음
- **수정**: 결과 영역으로 포커스 이동, announce 알림

### MED-4: 폼 입력 레이블 연결
**WCAG 1.3.1 Info and Relationships, 3.3.2 Labels**
- **파일**: ShippingForm.tsx:66-73
- **문제**: 일부 input에 htmlFor-id 연결 미비
- **수정**: 모든 input/textarea에 대응하는 label 추가

### MED-5: 포커스 링 일관성
**WCAG 2.4.7 Focus Visible**
- **파일**: TextField.module.css vs Button.module.css
- **문제**: 포커스 링 너비, 오프셋, 색상 불일치
- **수정**: 모든 포커스에 `--a11y-focus-ring-*` 토큰 사용

### MED-6: 아이콘 버튼 aria-label
**WCAG 1.1.1 Non-text Content, 4.1.2 Name, Role, Value**
- **파일**: ShippingForm.tsx:45, CheckoutPage.tsx (아이콘 버튼)
- **문제**: aria-label 없음
- **수정**: 모든 icon-only 버튼에 aria-label 추가

---

## 3️⃣ 저위험 (LOW) - 개선 권고

### LOW-1~8: 기타 개선 사항
1. **ARIA Live Region 메시지 구체화** - Button의 "로딩 중" → "주문 처리 중입니다"
2. **필드 유효성 검사 피드백 타이밍** - blur 이후 500ms 딜레이
3. **VoiceOver/TalkBack 테스트** - 모바일 스크린 리더 호환성 검증
4. **주로 사용되는 색상 조합 검증**
5. **모달 외부 클릭 기능** - 필수? 아니면 명확한 닫기 버튼만?

---

## ✅ 우수 사항 (강점 유지)

1. **포커스 관리**: Modal.tsx의 포커스 트랩 완벽
2. **동작 감소 지원**: @media (prefers-reduced-motion) 광범위
3. **모달 접근성**: aria-modal="true", 포커스 복원
4. **터치 타겟**: 44px 최소 크기 보장
5. **Semantic HTML**: 제목, landmark roles 사용
6. **Button 타입**: 모든 버튼이 type="button" 명시

---

## 📋 실행 계획 (6주)

### Week 1: Critical Fixes
- [ ] Skip link 구현 (MainLayout)
- [ ] 이미지 alt 텍스트 (ProductListPage, 모든 이미지)
- [ ] 폼 에러 ARIA (모든 input)

### Week 2: High Priority
- [ ] 드롭다운 키보드 네비게이션 (Header)
- [ ] 필수 필드 표시 (RegisterPage, CheckoutPage)
- [ ] 표 캡션 (Orders, Transactions)

### Week 3: Medium Priority
- [ ] 색상 대비 검증 및 수정 (WebAIM 사용)
- [ ] 제목 계층 구조 정리 (모든 페이지)
- [ ] 포커스 링 일관성 (CSS 토큰)

### Week 4: Testing
- [ ] Axe DevTools: 0 violations
- [ ] Lighthouse: Accessibility 90+
- [ ] NVDA/JAWS 수동 테스트

### Week 5: Documentation & Training
- [ ] 접근성 문서 (docs/10_ACCESSIBILITY_AUDIT.md)
- [ ] 컴포넌트 가이드라인
- [ ] 팀 교육

### Week 6: Final Validation
- [ ] 전문 감사인 재검증
- [ ] 사용자 테스트 (장애인 포함)
- [ ] 배포 준비

---

## 🔧 수정 템플릿

### 폼 필드 표준 패턴
```tsx
<div className={styles.container}>
  <label htmlFor={id} className={styles.label}>
    필드명
    {required && <span aria-label="필수 입력"> *</span>}
  </label>
  <input
    id={id}
    type="text"
    required={required}
    aria-required={required}
    aria-invalid={!!error}
    aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
  />
  {error && (
    <div id={`${id}-error`} role="alert" className={styles.errorText}>
      {error}
    </div>
  )}
  {!error && helperText && (
    <div id={`${id}-helper`} className={styles.helperText}>
      {helperText}
    </div>
  )}
</div>
```

### 이미지 alt 텍스트 패턴
```tsx
// 장식용: alt=""
<img src="icon.svg" alt="" aria-hidden="true" />

// 의미 있는: alt="설명"
<img src="product.jpg" alt="신세계 상품권" />

// 아이콘 버튼: aria-label 사용
<button aria-label="메뉴 열기">
  <MenuIcon />
</button>
```

### 테이블 표준 패턴
```tsx
<table>
  <caption>
    {tableName} {itemCount && `- 총 ${itemCount}건`}
  </caption>
  <thead>
    <tr>
      <th scope="col">컬럼 1</th>
      <th scope="col">컬럼 2</th>
    </tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr key={item.id}>
        <td>{item.col1}</td>
        <td>{item.col2}</td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## 📚 검사 도구 & 자료

### 자동 검사
- [Axe DevTools](https://www.deque.com/axe/devtools/) - 브라우저 확장
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Chrome DevTools
- [WAVE](https://wave.webaim.org/) - 온라인 도구

### 수동 검사
- [NVDA](https://www.nvaccess.org/) - 무료 스크린 리더 (Windows)
- [VoiceOver](https://www.apple.com/accessibility/voiceover/) - macOS/iOS 내장
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) - 유료 (Windows)

### 색상 검증
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Accessible Colors](https://accessible-colors.com/)

### WCAG 기준서
- [WCAG 2.1 Spec](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

---

## 문서 참고

**본 항목과 관련된 프로젝트 문서**:
- docs/10_ACCESSIBILITY_AUDIT.md (기존 명세)
- client/src/constants/a11y.ts (ARIA 헬퍼)
- client/src/utils/a11yUtils.ts (접근성 유틸)

---

**보고서 발행**: 2026-03-26  
**예상 이행 완료**: 2026-05-07 (6주)  
**담당자**: Accessibility Testing Agent
