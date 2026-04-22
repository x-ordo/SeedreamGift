# W Gift Design System

Swift Trust 디자인 철학 기반의 컴포넌트 라이브러리입니다. Toss Design System에서 영감을 받아 일관된 사용자 경험과 접근성을 제공합니다.

## 설치 및 사용

```tsx
// 컴포넌트 임포트
import { Button, Card, Modal, Input, Switch } from "@/design-system";

// 레이아웃 컴포넌트 임포트
import { Stack, Inline, PageContainer, Center } from "@/design-system";

// 디자인 토큰 임포트 (런타임 접근 필요시)
import { COLORS, SPACING, RADIUS, SHADOWS } from "@/constants/designTokens";
```

---

## 디자인 토큰

### 색상 (Colors)

CSS 변수로 정의되어 있으며, 브랜드별 오버라이드를 지원합니다.

#### Primary Colors

| 변수                     | 값        | 용도            |
| ------------------------ | --------- | --------------- |
| `--color-primary`        | `#3182F6` | 주요 액션, 링크 |
| `--color-primary-hover`  | `#2272EB` | 호버 상태       |
| `--color-primary-active` | `#1B64DA` | 클릭 상태       |
| `--color-primary-light`  | `#E8F3FF` | 배경 강조       |

#### Point Colors (Gold Accent)

| 변수                   | 값        | 용도      |
| ---------------------- | --------- | --------- |
| `--color-point`        | `#FFC342` | 골드 강조 |
| `--color-point-hover`  | `#FFB331` | 호버 상태 |
| `--color-point-active` | `#FAA131` | 클릭 상태 |

#### Semantic Colors

| 변수              | 값        | 용도       |
| ----------------- | --------- | ---------- |
| `--color-success` | `#03B26C` | 성공, 완료 |
| `--color-error`   | `#F04452` | 오류, 삭제 |
| `--color-warning` | `#FE9800` | 경고       |
| `--color-info`    | `#17A2B8` | 정보       |

#### Neutral Scale (Grey)

```css
--color-grey-50: #f9fafb /* 가장 밝음 */ --color-grey-100: #f2f4f6 /* 배경 */
  --color-grey-200: #e5e8eb /* 테두리 */ --color-grey-300: #d1d6db
  /* 비활성 테두리 */ --color-grey-400: #b0b8c1 /* placeholder */
  --color-grey-500: #8b95a1 /* 보조 텍스트 */ --color-grey-600: #6b7684
  /* 설명 텍스트 */ --color-grey-700: #4e5968 /* 본문 텍스트 */
  --color-grey-800: #333d4b /* 강조 텍스트 */ --color-grey-900: #191f28
  /* 제목 텍스트 */;
```

---

### 간격 (Spacing)

8pt 그리드 시스템을 기반으로 합니다.

| 토큰         | 값   | 용도           |
| ------------ | ---- | -------------- |
| `--space-1`  | 4px  | 아이콘 간격    |
| `--space-2`  | 8px  | 작은 요소 간격 |
| `--space-3`  | 12px | 컴팩트 패딩    |
| `--space-4`  | 16px | 기본 패딩      |
| `--space-5`  | 20px | 카드 패딩      |
| `--space-6`  | 24px | 섹션 간격      |
| `--space-8`  | 32px | 큰 섹션 간격   |
| `--space-10` | 40px | 페이지 여백    |
| `--space-12` | 48px | 큰 페이지 여백 |
| `--space-16` | 64px | 히어로 섹션    |
| `--space-20` | 80px | 대형 여백      |

```tsx
// TypeScript에서 사용
import { SPACING, SPACING_VALUES } from "@/constants/designTokens";

// CSS 값으로 사용
const padding = SPACING[4]; // "16px"

// 숫자 값으로 계산
const height = SPACING_VALUES[4] * 2; // 32
```

---

### 타이포그래피 (Typography)

Pretendard Variable 폰트를 사용하며, 반응형 크기를 지원합니다.

#### Font Sizes

| 토큰              | 값               | 용도           |
| ----------------- | ---------------- | -------------- |
| `--text-xs`       | 11px             | 아주 작은 캡션 |
| `--text-small`    | 12px             | 서브 캡션      |
| `--text-caption`  | 13px             | 캡션, 레이블   |
| `--text-body`     | 14-16px (반응형) | 본문 텍스트    |
| `--text-body-lg`  | 16-18px (반응형) | 큰 본문        |
| `--text-title`    | 18-22px (반응형) | 소제목         |
| `--text-headline` | 20-26px (반응형) | 제목           |
| `--text-display`  | 24-32px (반응형) | 대제목         |
| `--text-hero`     | 28-40px (반응형) | 히어로 텍스트  |
| `--text-jumbo`    | 36-52px (반응형) | PIN 번호 등    |

#### Font Weights

| 토큰                      | 값  | 용도   |
| ------------------------- | --- | ------ |
| `--font-weight-regular`   | 400 | 본문   |
| `--font-weight-medium`    | 500 | 강조   |
| `--font-weight-semibold`  | 600 | 소제목 |
| `--font-weight-bold`      | 700 | 제목   |
| `--font-weight-extrabold` | 800 | 히어로 |

---

### 반경 (Border Radius)

| 토큰            | 값     | 용도                         |
| --------------- | ------ | ---------------------------- |
| `--radius-xs`   | 4px    | 드래그 핸들, 프로그레스바    |
| `--radius-sm`   | 8px    | 버튼, 인풋                   |
| `--radius-md`   | 14px   | 카드, 모달                   |
| `--radius-lg`   | 18px   | 큰 카드                      |
| `--radius-xl`   | 24px   | 바텀시트                     |
| `--radius-full` | 9999px | 원형, 뱃지                   |

---

### 그림자 (Shadows)

#### Neutral Shadows

| 토큰          | 값                             | 용도           |
| ------------- | ------------------------------ | -------------- |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.04)`   | 카드 기본      |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)`  | 호버 상태      |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.08)` | 모달, 드롭다운 |
| `--shadow-xl` | `0 20px 60px rgba(0,0,0,0.2)`  | 오버레이       |

#### Colored Shadows (버튼용)

| 토큰               | 용도              |
| ------------------ | ----------------- |
| `--shadow-primary` | Primary 버튼 호버 |
| `--shadow-point`   | Point 버튼 호버   |
| `--shadow-success` | Success 버튼 호버 |
| `--shadow-error`   | Danger 버튼 호버  |

---

### Z-Index 레이어

| 토큰                 | 값    | 용도          |
| -------------------- | ----- | ------------- |
| `--z-base`           | 0     | 기본 레이어   |
| `--z-dropdown`       | 100   | 드롭다운 메뉴 |
| `--z-sticky`         | 500   | 고정 헤더     |
| `--z-fixed`          | 1000  | 고정 요소     |
| `--z-modal-backdrop` | 10000 | 모달 배경     |
| `--z-modal`          | 11000 | 모달 콘텐츠   |
| `--z-tooltip`        | 12000 | 툴팁          |
| `--z-toast`          | 13000 | 토스트 알림   |

---

## 컴포넌트

### Atoms

기본 UI 요소들입니다.

#### Button

다양한 스타일과 크기를 지원하는 버튼 컴포넌트입니다.

```tsx
import { Button } from '@/design-system';

// 기본 사용
<Button>기본 버튼</Button>

// 변형 (variant)
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>
<Button variant="success">Success</Button>
<Button variant="point">Point (Gold)</Button>

// 크기 (size)
<Button size="sm">Small</Button>
<Button size="md">Medium (기본)</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>

// 전체 너비
<Button fullWidth>전체 너비 버튼</Button>

// 로딩 상태
<Button isLoading>처리중...</Button>

// 아이콘 포함
import { ShoppingCart, ArrowRight } from 'lucide-react';

<Button leftIcon={<ShoppingCart size={20} />}>장바구니</Button>
<Button rightIcon={<ArrowRight size={20} />}>다음</Button>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'danger' \| 'success' \| 'point'` | `'primary'` | 버튼 스타일 |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 버튼 크기 |
| `fullWidth` | `boolean` | `false` | 전체 너비 |
| `isLoading` | `boolean` | `false` | 로딩 상태 |
| `leftIcon` | `ReactNode` | - | 왼쪽 아이콘 |
| `rightIcon` | `ReactNode` | - | 오른쪽 아이콘 |
| `disableRipple` | `boolean` | `false` | 리플 효과 비활성화 |

---

#### TextButton

텍스트 형태의 버튼으로 링크나 보조 액션에 사용합니다.

```tsx
import { TextButton } from '@/design-system';

<TextButton size="medium">더보기</TextButton>
<TextButton size="medium" variant="arrow">전체보기</TextButton>
<TextButton size="small" variant="underline" color="secondary">취소</TextButton>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `size` | `'xsmall' \| 'small' \| 'medium' \| 'large' \| 'xlarge' \| 'xxlarge'` | - | 크기 (필수) |
| `variant` | `'clear' \| 'arrow' \| 'underline'` | `'clear'` | 스타일 변형 |
| `color` | `'primary' \| 'secondary' \| 'tertiary' \| 'point' \| 'success' \| 'error'` | `'primary'` | 텍스트 색상 |

---

#### Card

컨텐츠를 담는 컨테이너 컴포넌트입니다.

```tsx
import { Card } from '@/design-system';

// 기본 사용
<Card>카드 내용</Card>

// 인터랙티브 (hover 효과)
<Card interactive onClick={handleClick}>클릭 가능한 카드</Card>

// 패딩 조절
<Card padding="none">패딩 없음</Card>
<Card padding="sm">작은 패딩</Card>
<Card padding="lg">큰 패딩</Card>

// 그림자 조절
<Card shadow="none">그림자 없음</Card>
<Card shadow="lg">큰 그림자</Card>

// 반경 조절
<Card radius="xl">둥근 모서리</Card>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `interactive` | `boolean` | `false` | 호버 효과 |
| `compact` | `boolean` | `false` | 컴팩트 모드 |
| `padding` | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | - | 내부 패딩 |
| `shadow` | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg'` | - | 그림자 |
| `radius` | `'none' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | - | 모서리 반경 |

---

#### Input

기본 입력 필드 컴포넌트입니다.

```tsx
import { Input } from '@/design-system';

<Input
  label="이메일"
  placeholder="example@email.com"
  type="email"
/>

// 에러 상태
<Input
  label="비밀번호"
  type="password"
  error="비밀번호는 8자 이상이어야 합니다"
/>

// 도움말
<Input
  label="닉네임"
  helperText="2-20자의 한글, 영문, 숫자"
/>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `label` | `string` | - | 레이블 |
| `error` | `string` | - | 에러 메시지 |
| `helperText` | `string` | - | 도움말 |
| `fullWidth` | `boolean` | `true` | 전체 너비 |

---

#### TextField

TDS 스타일의 고급 텍스트 입력 컴포넌트입니다.

```tsx
import { TextField } from '@/design-system';

// Box 스타일 (기본)
<TextField
  variant="box"
  label="이름"
  placeholder="이름을 입력하세요"
/>

// Line 스타일
<TextField variant="line" label="전화번호" />

// Big 스타일 (큰 글씨)
<TextField variant="big" placeholder="금액 입력" suffix="원" />

// Hero 스타일 (대형)
<TextField variant="hero" placeholder="PIN 입력" />

// Clearable (지우기 버튼)
<TextField.Clearable
  variant="box"
  label="검색"
  onClear={() => setValue('')}
/>

// Password (비밀번호 표시 토글)
<TextField.Password
  variant="box"
  label="비밀번호"
/>

// Button (클릭 가능한 필드)
<TextField.Button
  variant="box"
  label="은행 선택"
  value={selectedBank}
  placeholder="은행을 선택하세요"
  onClick={openBankSheet}
/>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `variant` | `'box' \| 'line' \| 'big' \| 'hero'` | - | 스타일 (필수) |
| `label` | `string` | - | 레이블 |
| `labelOption` | `'appear' \| 'sustain'` | `'appear'` | 레이블 표시 옵션 |
| `help` | `ReactNode` | - | 도움말 |
| `hasError` | `boolean` | `false` | 에러 상태 |
| `prefix` | `string` | - | 앞쪽 문자열 |
| `suffix` | `string` | - | 뒤쪽 문자열 |
| `right` | `ReactNode` | - | 오른쪽 요소 |

---

#### Switch

토글 스위치 컴포넌트입니다.

```tsx
import { Switch } from '@/design-system';

const [enabled, setEnabled] = useState(false);

<Switch
  checked={enabled}
  onChange={setEnabled}
  label="알림 받기"
/>

// 비활성화
<Switch
  checked={true}
  onChange={() => {}}
  label="필수 설정"
  disabled
/>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `checked` | `boolean` | - | 활성화 상태 (필수) |
| `onChange` | `(checked: boolean) => void` | - | 변경 핸들러 (필수) |
| `label` | `string` | - | 레이블 (필수) |
| `disabled` | `boolean` | `false` | 비활성화 |

---

#### NumericSpinner

숫자 증감 컴포넌트입니다.

```tsx
import { NumericSpinner } from '@/design-system';

// 제어 모드
const [quantity, setQuantity] = useState(1);

<NumericSpinner
  number={quantity}
  onNumberChange={setQuantity}
  minNumber={1}
  maxNumber={99}
/>

// 비제어 모드
<NumericSpinner
  defaultNumber={1}
  size="large"
/>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `number` | `number` | - | 현재 값 (제어 모드) |
| `defaultNumber` | `number` | `0` | 초기값 (비제어 모드) |
| `minNumber` | `number` | `0` | 최소값 |
| `maxNumber` | `number` | `999` | 최대값 |
| `step` | `number` | `1` | 증가 단위 |
| `size` | `'tiny' \| 'small' \| 'medium' \| 'large'` | `'medium'` | 크기 |
| `onNumberChange` | `(value: number) => void` | - | 값 변경 콜백 |

---

#### Badge

상태 표시용 뱃지 컴포넌트입니다.

```tsx
import { Badge } from '@/design-system';

<Badge color="blue" size="small" variant="fill">신규</Badge>
<Badge color="green" size="medium" variant="weak">완료</Badge>
<Badge color="red" size="small" variant="fill">긴급</Badge>
<Badge color="yellow" size="xsmall" dot />  // 점 형태
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `color` | `'blue' \| 'teal' \| 'green' \| 'red' \| 'yellow' \| 'elephant'` | - | 색상 (필수) |
| `size` | `'xsmall' \| 'small' \| 'medium' \| 'large'` | - | 크기 (필수) |
| `variant` | `'fill' \| 'weak'` | - | 스타일 (필수) |
| `dot` | `boolean` | `false` | 점 형태 |
| `icon` | `ReactNode` | - | 아이콘 |

---

#### StatusBadge

주문/매입/KYC 상태 표시용 뱃지입니다.

```tsx
import { StatusBadge } from '@/design-system';

// 주문 상태
<StatusBadge type="order" status="PENDING" />    // 결제 대기
<StatusBadge type="order" status="DELIVERED" />  // 발급 완료

// 매입 상태
<StatusBadge type="tradein" status="REQUESTED" /> // 신청완료
<StatusBadge type="tradein" status="PAID" />      // 입금완료

// KYC 상태
<StatusBadge type="kyc" status="VERIFIED" />  // 인증완료
<StatusBadge type="kyc" status="PENDING" />   // 인증필요

// 역할
<StatusBadge type="role" status="ADMIN" />
```

---

#### Loader

로딩 인디케이터 컴포넌트입니다.

```tsx
import { Loader } from '@/design-system';

// 기본 로더
<Loader />

// 레이블 포함
<Loader label="로딩중..." size="large" />

// 타입별
<Loader type="primary" />
<Loader type="dark" />
<Loader type="brand" />  // W 로고 애니메이션

// 전체 화면 오버레이
<Loader.Overlay label="결제 처리중..." />
<Loader.Overlay dark />
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 크기 |
| `type` | `'primary' \| 'dark' \| 'light' \| 'point' \| 'brand'` | `'primary'` | 색상 타입 |
| `label` | `string` | - | 레이블 텍스트 |
| `fadeIn` | `boolean` | `false` | 페이드인 효과 |
| `inline` | `boolean` | `false` | 인라인 모드 |

---

#### ListRow

리스트 아이템 컴포넌트입니다. Compound Pattern으로 유연한 구성이 가능합니다.

```tsx
import { ListRow } from '@/design-system';

// 기본 사용
<ListRow
  title="신세계 상품권 5만원"
  subtitle="47,500원"
  withArrow
  onClick={handleClick}
/>

// 아이콘과 함께
import { Gift } from 'lucide-react';

<ListRow
  left={<ListRow.AssetIcon icon={Gift} shape="squircle" />}
  title="상품권 구매"
  description="최대 5% 할인"
  withArrow
/>

// 이미지와 함께
<ListRow
  left={<ListRow.AssetImage src="/voucher.png" shape="card" />}
  contents={
    <ListRow.Texts
      type="2RowTypeA"
      top="신세계 상품권"
      bottom="5만원권"
    />
  }
  right={<ListRow.IconButton icon={ShoppingCart} variant="fill" />}
/>

// 스켈레톤 로딩
<ListRow.Loader rows={3} leftShape="square" />
```

**주요 서브 컴포넌트:**

- `ListRow.AssetIcon` - 아이콘 표시
- `ListRow.AssetImage` - 이미지 표시
- `ListRow.Texts` - 멀티라인 텍스트
- `ListRow.IconButton` - 액션 버튼
- `ListRow.Loader` - 스켈레톤

---

#### TableRow

키-값 형태의 테이블 행 컴포넌트입니다.

```tsx
import { TableRow } from '@/design-system';

<TableRow left="상품명" right="신세계 상품권 5만원" />
<TableRow left="수량" right="2개" />
<TableRow left="결제금액" right="95,000원" emphasized numeric />
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `left` | `ReactNode` | - | 왼쪽 레이블 (필수) |
| `right` | `ReactNode` | - | 오른쪽 값 (필수) |
| `align` | `'left' \| 'space-between'` | `'space-between'` | 정렬 |
| `emphasized` | `boolean` | `false` | 강조 (오른쪽 굵게) |
| `numeric` | `boolean` | `false` | 숫자 정렬 |
| `withBorder` | `boolean` | `false` | 하단 테두리 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 크기 |

---

#### Border

구분선/디바이더 컴포넌트입니다.

```tsx
import { Border } from '@/design-system';

<Border />                           // 전체 너비 선
<Border variant="padding24" />       // 양쪽 24px 여백
<Border variant="height16" />        // 16px 높이 섹션 구분
<Border spacing="large" />           // 큰 상하 여백
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `variant` | `'full' \| 'padding24' \| 'height16'` | `'full'` | 형태 |
| `spacing` | `'none' \| 'small' \| 'medium' \| 'large'` | `'medium'` | 상하 여백 |
| `height` | `string` | - | 커스텀 높이 (height16) |

---

#### Paragraph

단락 텍스트 컴포넌트입니다.

```tsx
import { Paragraph } from '@/design-system';

<Paragraph size="medium">기본 텍스트입니다.</Paragraph>
<Paragraph size="large" weight="semibold">강조 텍스트</Paragraph>
<Paragraph size="small" color="var(--color-grey-500)">보조 텍스트</Paragraph>
```

---

### Molecules

Atoms를 조합한 복합 컴포넌트입니다.

#### Modal

모달 다이얼로그 컴포넌트입니다. 포커스 트랩, 스와이프 닫기를 지원합니다.

```tsx
import { Modal } from "@/design-system";

const [isOpen, setIsOpen] = useState(false);

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="알림"
  footer={
    <Button onClick={() => setIsOpen(false)} fullWidth>
      확인
    </Button>
  }
>
  <p>모달 내용입니다.</p>
</Modal>;
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `isOpen` | `boolean` | - | 열림 상태 (필수) |
| `onClose` | `() => void` | - | 닫기 핸들러 (필수) |
| `title` | `string` | - | 제목 |
| `footer` | `ReactNode` | - | 하단 영역 |
| `closeOnOverlayClick` | `boolean` | `true` | 오버레이 클릭시 닫기 |
| `enableSwipeClose` | `boolean` | `true` | 모바일 스와이프 닫기 |
| `swipeThreshold` | `number` | `100` | 스와이프 임계값 (px) |

---

#### BottomSheet

하단에서 올라오는 시트 컴포넌트입니다.

```tsx
import { BottomSheet, Button } from "@/design-system";

<BottomSheet
  open={isOpen}
  onClose={() => setIsOpen(false)}
  header={<BottomSheet.Header>은행 선택</BottomSheet.Header>}
  headerDescription={
    <BottomSheet.HeaderDescription>
      입금받을 은행을 선택하세요
    </BottomSheet.HeaderDescription>
  }
  cta={
    <BottomSheet.DoubleCTA
      leftButton={
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
      }
      rightButton={<Button onClick={onConfirm}>확인</Button>}
    />
  }
>
  {/* 은행 목록 */}
</BottomSheet>;
```

**서브 컴포넌트:**

- `BottomSheet.Header` - 제목
- `BottomSheet.HeaderDescription` - 설명
- `BottomSheet.CTA` - 단일 CTA
- `BottomSheet.DoubleCTA` - 두 개 CTA

---

#### BottomCTA

하단 고정 CTA 버튼 컴포넌트입니다.

```tsx
import { BottomCTA, FixedBottomCTA, CTAButton } from '@/design-system';

// 단일 버튼 (sticky)
<BottomCTA onClick={handleSubmit}>다음</BottomCTA>

// 단일 버튼 (고정)
<FixedBottomCTA onClick={handleSubmit} loading={isLoading}>
  결제하기
</FixedBottomCTA>

// 두 개 버튼
<BottomCTA.Double
  leftButton={<CTAButton variant="secondary" onClick={onCancel}>취소</CTAButton>}
  rightButton={<CTAButton onClick={onConfirm}>확인</CTAButton>}
/>

// 상단 악세서리 포함
<BottomCTA.Single
  topAccessory={<NumericSpinner number={qty} onNumberChange={setQty} />}
  onClick={handleAddToCart}
>
  장바구니 담기
</BottomCTA.Single>
```

---

#### Accordion

아코디언 컴포넌트입니다. HTML5 details/summary 기반으로 네이티브 접근성을 지원합니다.

```tsx
import { Accordion, AccordionItem, AccordionItemControlled } from '@/design-system';

// 기본 (비제어)
<Accordion>
  <AccordionItem title="배송 안내" defaultOpen>
    <p>주문 후 1-2일 내 발송됩니다.</p>
  </AccordionItem>
  <AccordionItem title="교환/환불 안내">
    <p>상품 수령 후 7일 이내 가능합니다.</p>
  </AccordionItem>
</Accordion>

// 제어 모드
<AccordionItemControlled
  title="자주 묻는 질문"
  isOpen={isOpen}
  onToggle={setIsOpen}
>
  답변 내용
</AccordionItemControlled>
```

---

#### TabNavigation

탭 네비게이션 컴포넌트입니다. WCAG 2.1 AA 접근성을 준수합니다.

```tsx
import { TabNavigation, TabPanel, Tabs } from '@/design-system';

import { ShoppingBag, Coins, Settings } from 'lucide-react';

const tabs = [
  { id: 'orders', label: '구매내역', icon: ShoppingBag },
  { id: 'tradeins', label: '매입내역', icon: Coins },
  { id: 'settings', label: '설정', icon: Settings },
];

// TabNavigation만 사용
<TabNavigation
  tabs={tabs}
  activeTab={activeTab}
  onChange={setActiveTab}
  variant="underline"
  ariaLabel="마이페이지 메뉴"
/>

// TabPanel과 함께
<TabNavigation tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
<TabPanel id="orders" tabId="orders" active={activeTab === 'orders'}>
  주문 내역 컨텐츠
</TabPanel>

// Tabs (통합 컴포넌트)
<Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
  <TabPanel id="orders" tabId="orders" active={activeTab === 'orders'}>
    주문 내역
  </TabPanel>
</Tabs>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `tabs` | `TabConfig[]` | - | 탭 목록 (필수) |
| `activeTab` | `string` | - | 활성 탭 ID (필수) |
| `onChange` | `(tabId: string) => void` | - | 변경 핸들러 (필수) |
| `variant` | `'default' \| 'pills' \| 'underline' \| 'card'` | `'default'` | 스타일 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 크기 |
| `fullWidth` | `boolean` | `false` | 전체 너비 |

---

#### StepIndicator

멀티스텝 진행 상태 표시 컴포넌트입니다.

```tsx
import { StepIndicator, SimpleStepIndicator, ProgressStepIndicator } from '@/design-system';

const steps = [
  { id: '1', label: '상품 선택' },
  { id: '2', label: 'PIN 입력' },
  { id: '3', label: '계좌 입력' },
];

// 기본
<StepIndicator
  steps={steps}
  currentStep="2"
  ariaLabel="매입 진행 단계"
/>

// 간단한 형태 (숫자만)
<SimpleStepIndicator
  totalSteps={3}
  currentStep={2}
  labels={['선택', '입력', '완료']}
/>

// 진행률 바 포함
<ProgressStepIndicator
  steps={steps}
  currentStep="2"
  showProgress
/>
```

---

#### Skeleton

스켈레톤 로딩 컴포넌트입니다.

```tsx
import { Skeleton, CardSkeleton, ListSkeleton, TextSkeleton, ProductCardSkeleton } from '@/design-system';

// 기본 스켈레톤
<Skeleton width="100px" height="20px" />
<Skeleton width={40} height={40} circle />

// 카드 스켈레톤
<CardSkeleton count={3} showImage />

// 리스트 스켈레톤
<ListSkeleton rows={5} showAvatar />

// 텍스트 스켈레톤
<TextSkeleton lines={3} lastLineWidth={60} />

// 상품 카드 스켈레톤
<ProductCardSkeleton count={4} />

// 주문 아이템 스켈레톤
<OrderItemSkeleton count={2} />
```

---

#### Result

결과 페이지 컴포넌트입니다.

```tsx
import { Result } from '@/design-system';

<Result
  icon="success"
  title="결제가 완료되었습니다"
  description="주문 내역은 마이페이지에서 확인하실 수 있습니다."
  button={<Button onClick={goHome}>홈으로 이동</Button>}
/>

<Result
  icon="error"
  title="결제에 실패했습니다"
  description="잠시 후 다시 시도해주세요."
  button={<Button onClick={retry}>다시 시도</Button>}
/>

// 커스텀 그래픽
<Result
  figure={<img src="/custom-image.svg" />}
  title="커스텀 결과"
/>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `icon` | `'success' \| 'error' \| 'warning' \| 'info'` | - | 아이콘 타입 |
| `figure` | `ReactNode` | - | 커스텀 그래픽 |
| `title` | `ReactNode` | - | 제목 (필수) |
| `description` | `ReactNode` | - | 설명 |
| `button` | `ReactNode` | - | 버튼 영역 |
| `extra` | `ReactNode` | - | 추가 콘텐츠 |
| `fullHeight` | `boolean` | `false` | 전체 높이 |

---

#### EmptyState

데이터 없음 상태 표시 컴포넌트입니다.

```tsx
import { EmptyState } from '@/design-system';

<EmptyState
  variant="cart"
  title="장바구니가 비어있습니다"
  description="원하는 상품을 담아보세요"
  action={<Button>쇼핑하러 가기</Button>}
/>

<EmptyState
  variant="search"
  title="검색 결과가 없습니다"
  description="다른 검색어로 시도해보세요"
/>

// 에러 상태 (아이콘)
<EmptyState
  icon={Frown}
  title="검색 결과가 없습니다"
  description="다른 검색어로 시도해보세요."
/>

// 커스텀 아이콘
<EmptyState
  variant="custom"
  icon={<i className="bi bi-emoji-frown" />}
  title="오류가 발생했습니다"
/>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `variant` | `'search' \| 'cart' \| 'order' \| 'error' \| 'custom'` | `'search'` | 변형 |
| `icon` | `ReactNode` | - | 커스텀 아이콘 (custom) |
| `title` | `string` | - | 제목 (필수) |
| `description` | `string` | - | 설명 |
| `action` | `ReactNode` | - | 액션 버튼 |

---

### Layout

레이아웃 유틸리티 컴포넌트입니다.

#### Stack

수직(세로) 정렬 레이아웃입니다.

```tsx
import { Stack } from '@/design-system';

<Stack gap={4}>
  <Card>아이템 1</Card>
  <Card>아이템 2</Card>
  <Card>아이템 3</Card>
</Stack>

// 정렬
<Stack gap={4} align="center">
  <Button>중앙 정렬된 버튼</Button>
</Stack>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `gap` | `1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10 \| 12 \| 16 \| 20` | `4` | 간격 |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch'` | `'stretch'` | 수평 정렬 |
| `as` | `'div' \| 'section' \| 'article' \| 'main' \| 'aside' \| 'nav' \| 'ul' \| 'ol'` | `'div'` | HTML 태그 |

---

#### Inline

수평(가로) 정렬 레이아웃입니다.

```tsx
import { Inline } from '@/design-system';

<Inline gap={2}>
  <Badge color="blue" size="small" variant="fill">신규</Badge>
  <Badge color="green" size="small" variant="fill">인기</Badge>
</Inline>

// 양쪽 정렬
<Inline justify="between" align="center">
  <span>왼쪽</span>
  <Button>오른쪽</Button>
</Inline>

// 줄바꿈 허용
<Inline gap={2} wrap>
  {tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
</Inline>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `gap` | `1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10 \| 12 \| 16 \| 20` | `2` | 간격 |
| `justify` | `'start' \| 'center' \| 'end' \| 'between' \| 'around' \| 'evenly'` | `'start'` | 수평 정렬 |
| `align` | `'start' \| 'center' \| 'end' \| 'baseline' \| 'stretch'` | `'center'` | 수직 정렬 |
| `wrap` | `boolean` | `false` | 줄바꿈 |

---

#### PageContainer

페이지 래퍼 컴포넌트입니다. 반응형 max-width와 패딩을 제공합니다.

```tsx
import { PageContainer } from '@/design-system';

<PageContainer size="lg">
  <h1>페이지 제목</h1>
  <p>페이지 내용...</p>
</PageContainer>

// 크기별
<PageContainer size="sm">작은 컨테이너 (640px)</PageContainer>
<PageContainer size="md">중간 컨테이너 (800px)</PageContainer>
<PageContainer size="lg">큰 컨테이너 (1200px)</PageContainer>
<PageContainer size="xl">매우 큰 컨테이너 (1400px)</PageContainer>
<PageContainer size="full">전체 너비</PageContainer>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'lg'` | 최대 너비 |
| `withVerticalPadding` | `boolean` | `true` | 세로 패딩 |
| `centered` | `boolean` | `true` | 중앙 정렬 |
| `as` | `'div' \| 'main' \| 'section' \| 'article'` | `'div'` | HTML 태그 |

---

#### Center

중앙 정렬 래퍼 컴포넌트입니다.

```tsx
import { Center } from '@/design-system';

<Center>
  <Loader />
</Center>

// 전체 높이
<Center fullHeight>
  <EmptyState title="데이터 없음" />
</Center>
```

**Props:**
| Prop | Type | Default | 설명 |
|------|------|---------|------|
| `fullHeight` | `boolean` | `false` | 전체 높이 (100vh) |
| `inline` | `boolean` | `false` | 인라인 중앙 정렬 |

---

## 접근성 (Accessibility)

이 디자인 시스템은 WCAG 2.1 AA 기준을 준수합니다.

### 키보드 네비게이션

- 모든 인터랙티브 요소는 `Tab` 키로 접근 가능
- `Enter` 또는 `Space`로 버튼/스위치 활성화
- 모달/바텀시트에서 `Escape`로 닫기
- 탭 네비게이션에서 화살표 키로 이동
- 아코디언에서 `Enter`/`Space`로 펼치기/접기

### 스크린 리더 지원

- 모든 컴포넌트에 적절한 ARIA 속성 적용
- `role`, `aria-label`, `aria-expanded`, `aria-selected` 등
- 로딩 상태에 `aria-busy="true"` 적용
- 에러 메시지에 `role="alert"` 적용

### 포커스 관리

- 포커스 링 스타일: `--a11y-focus-ring-shadow`
- 모달 열릴 때 포커스 트랩 적용
- 모달 닫힐 때 이전 포커스 복원
- `:focus-visible`을 사용한 키보드 전용 포커스 표시

### 모션 감소 지원

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 터치 타겟

- 최소 터치 타겟: 44x44px (WCAG 2.5.5)
- 권장 터치 타겟: 48x48px

---

## 브랜드 테마

`data-brand` 속성으로 브랜드별 컬러를 오버라이드할 수 있습니다.

```tsx
// 컴포넌트에 브랜드 적용
<Card data-brand="SHINSEGAE">
  신세계 테마 적용
</Card>

// 페이지 전체에 적용
<div data-brand="HYUNDAI">
  {/* 전체 페이지에 현대 테마 적용 */}
</div>
```

### 지원 브랜드

| 브랜드   | data-brand 값 | Primary Color |
| -------- | ------------- | ------------- |
| 신세계   | `SHINSEGAE`   | `#E4002B`     |
| 현대     | `HYUNDAI`     | `#003366`     |
| 롯데     | `LOTTE`       | `#D40029`     |
| 컬쳐랜드 | `CULTURELAND` | `#4EC1D2`     |
| 다이소   | `DAISO`       | `#FF6B00`     |
| 올리브영 | `OLIVEYOUNG`  | `#00A651`     |

### 브랜드 테마 CSS 변수

```css
[data-brand="SHINSEGAE"] {
  --brand-primary: #e4002b;
  --brand-accent: #ffd700;
  --brand-light: rgba(228, 0, 43, 0.08);
  --brand-gradient: linear-gradient(135deg, #e4002b 0%, #8b0000 100%);
}
```

---

## CSS 변수 사용법

### JavaScript에서 사용

```tsx
import {
  getCssVariable,
  setCssVariable,
  COLORS,
} from "@/constants/designTokens";

// CSS 변수 값 가져오기
const primaryColor = getCssVariable("color-primary");

// CSS 변수 값 설정하기
setCssVariable("color-primary", "#FF0000");

// TypeScript 상수 사용
const bgColor = COLORS.primary; // '#3182F6'
```

### 반응형 브레이크포인트 확인

```tsx
import { matchesBreakpoint, BREAKPOINTS } from "@/constants/designTokens";

// 현재 화면이 md 이상인지 확인
if (matchesBreakpoint("md")) {
  // 태블릿 이상
}

// 브레이크포인트 값
console.log(BREAKPOINTS.md); // '768px'
```

### 인라인 스타일에서 사용

```tsx
<div
  style={{
    padding: "var(--space-4)",
    backgroundColor: "var(--color-grey-100)",
    borderRadius: "var(--radius-md)",
  }}
>
  CSS 변수를 인라인 스타일에서 사용
</div>
```

---

## 개발 가이드라인

### CSS 작성 규칙

1. **transition: all 금지**

   ```css
   /* Bad */
   transition: all 0.2s ease;

   /* Good */
   transition:
     background 0.2s ease,
     transform 0.2s ease;
   ```

2. **outline: none 단독 사용 금지**

   ```css
   /* Bad */
   button:focus {
     outline: none;
   }

   /* Good */
   button:focus-visible {
     outline: none;
     box-shadow: var(--a11y-focus-ring-shadow);
   }
   ```

3. **compositor-friendly 애니메이션**
   ```css
   /* Good - transform, opacity만 사용 */
   .animated {
     transition:
       transform 0.2s ease,
       opacity 0.2s ease;
   }
   ```

### 컴포넌트 사용 모범 사례

1. **버튼에 type 명시**

   ```tsx
   <Button type="button">일반 버튼</Button>
   <Button type="submit">폼 제출</Button>
   ```

2. **아이콘 전용 버튼에 aria-label**

   ```tsx
   import { ShoppingCart } from "lucide-react";

   <Button aria-label="장바구니">
     <Button leftIcon={<ShoppingCart size={16} />}>구매하기</Button>
   </Button>;
   ```

3. **에러 상태 폼 필드**

   ```tsx
   <Input
     id="email"
     error="유효한 이메일을 입력하세요"
     aria-invalid={true}
     aria-describedby="email-error"
   />
   ```

4. **로딩 상태 표시**
   ```tsx
   <div aria-busy={isLoading} aria-live="polite">
     {isLoading ? <Loader /> : <Content />}
   </div>
   ```
