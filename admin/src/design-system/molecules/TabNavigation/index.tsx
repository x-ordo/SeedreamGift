/**
 * @file TabNavigation/index.tsx
 * @description 탭 네비게이션 컴포넌트 - 재사용 가능한 탭 UI
 * @module design-system/molecules
 *
 * WCAG 2.1 AA 접근성 준수:
 * - role="tablist" / role="tab" / role="tabpanel" 구조
 * - aria-selected, aria-controls 연결
 * - 키보드 네비게이션 (좌우 화살표)
 *
 * 사용 예시:
 * ```tsx
 * const tabs = [
 *   { id: 'orders', label: '구매내역', icon: ShoppingBag },
 *   { id: 'tradeins', label: '매입내역', icon: Coins },
 *   { id: 'settings', label: '설정', icon: Settings },
 * ];
 *
 * <TabNavigation
 *   tabs={tabs}
 *   activeTab={activeTab}
 *   onChange={setActiveTab}
 *   ariaLabel="마이페이지 메뉴"
 * />
 * ```
 */
import React, { memo, useCallback, useRef, KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/common/Icon';
import './TabNavigation.css';

// ============================================================================
// Types
// ============================================================================

export interface TabConfig<T extends string = string> {
  /** 탭 고유 ID */
  id: T;
  /** 탭 라벨 */
  label: string;
  /** 아이콘: Lucide 컴포넌트 */
  icon?: LucideIcon;
  /** 배지 텍스트 (알림 등) */
  badge?: string | number;
  /** 비활성화 여부 */
  disabled?: boolean;
}

export interface TabNavigationProps<T extends string = string> {
  /** 탭 목록 */
  tabs: ReadonlyArray<TabConfig<T>>;
  /** 현재 활성 탭 ID */
  activeTab: T;
  /** 탭 변경 핸들러 */
  onChange: (tabId: T) => void;
  /** 접근성 레이블 */
  ariaLabel?: string;
  /** 스타일 변형 */
  variant?: 'default' | 'pills' | 'underline' | 'card';
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 전체 너비 사용 */
  fullWidth?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 탭 패널 ID 접두사 (aria-controls 연결용) */
  panelIdPrefix?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 탭 네비게이션 컴포넌트
 */
function TabNavigationInner<T extends string = string>({
  tabs = [] as TabConfig<T>[],
  activeTab,
  onChange,
  ariaLabel = '탭 메뉴',
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className = '',
  panelIdPrefix = 'tabpanel',
}: TabNavigationProps<T>): JSX.Element {
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());

  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const enabledTabs = tabs?.filter((t) => !t.disabled) ?? [];
      const currentEnabledIndex = enabledTabs.findIndex((t) => t.id === tabs?.[currentIndex]?.id);

      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = currentEnabledIndex > 0
            ? currentEnabledIndex - 1
            : enabledTabs.length - 1;
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = currentEnabledIndex < enabledTabs.length - 1
            ? currentEnabledIndex + 1
            : 0;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = enabledTabs.length - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        const nextTab = enabledTabs[nextIndex];
        onChange(nextTab.id);
        tabRefs.current.get(nextTab.id)?.focus();
      }
    },
    [tabs, onChange]
  );

  return (
    <div
      className={`tab-navigation tab-navigation--${variant} tab-navigation--${size} ${fullWidth ? 'tab-navigation--full-width' : ''} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs?.map((tab, index) => {
        const isActive = tab.id === activeTab;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            className={`tab-navigation__tab ${isActive ? 'tab-navigation__tab--active' : ''} ${isDisabled ? 'tab-navigation__tab--disabled' : ''}`}
            onClick={() => !isDisabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            aria-selected={isActive}
            aria-controls={`${panelIdPrefix}-${tab.id}`}
            aria-disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            disabled={isDisabled}
          >
            {tab.icon && (
              <Icon icon={tab.icon} size={16} className="tab-navigation__icon" aria-hidden="true" />
            )}
            <span className="tab-navigation__label">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="tab-navigation__badge" aria-label={`${tab.badge}개`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const TabNavigation = memo(TabNavigationInner) as typeof TabNavigationInner;

// ============================================================================
// TabPanel Component
// ============================================================================

export interface TabPanelProps {
  /** 패널 ID (탭과 연결) */
  id: string;
  /** 연결된 탭 ID */
  tabId: string;
  /** 활성 여부 */
  active: boolean;
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 클래스 */
  className?: string;
  /** ID 접두사 */
  idPrefix?: string;
}

/**
 * 탭 패널 컴포넌트
 */
export const TabPanel = memo<TabPanelProps>(({
  id,
  tabId,
  active,
  children,
  className = '',
  idPrefix = 'tabpanel',
}) => {
  if (!active) return null;

  return (
    <div
      id={`${idPrefix}-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${tabId}`}
      className={`tab-panel ${className}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
});

TabPanel.displayName = 'TabPanel';

// ============================================================================
// Compound Tab Component (Alternative API)
// ============================================================================

export interface TabsProps<T extends string = string> {
  /** 탭 목록 */
  tabs: TabConfig<T>[];
  /** 현재 활성 탭 ID */
  activeTab: T;
  /** 탭 변경 핸들러 */
  onChange: (tabId: T) => void;
  /** 자식 요소 (TabPanel들) */
  children: React.ReactNode;
  /** 접근성 레이블 */
  ariaLabel?: string;
  /** 스타일 변형 */
  variant?: 'default' | 'pills' | 'underline' | 'card';
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 클래스 */
  className?: string;
}

/**
 * 탭 컨테이너 컴포넌트 (TabNavigation + TabPanel 조합)
 */
export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  children,
  ariaLabel,
  variant,
  size,
  className = '',
}: TabsProps<T>): JSX.Element {
  return (
    <div className={`tabs ${className}`}>
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onChange={onChange}
        ariaLabel={ariaLabel}
        variant={variant}
        size={size}
      />
      <div className="tabs__content">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Helper: Create Tab Config
// ============================================================================

/**
 * 탭 설정 생성 헬퍼
 */
// eslint-disable-next-line react-refresh/only-export-components
export function createTabConfig<T extends string>(
  tabs: Array<{ id: T; label: string; icon?: LucideIcon; badge?: string | number; disabled?: boolean }>
): TabConfig<T>[] {
  return tabs;
}
