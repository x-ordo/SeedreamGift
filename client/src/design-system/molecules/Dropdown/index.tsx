/**
 * @file Dropdown.tsx
 * @description 접근성을 준수하는 커스텀 드롭다운 메뉴 컴포넌트
 * @module design-system/molecules
 *
 * 기능:
 * - 버튼 트리거로 메뉴 열기/닫기
 * - Portal 렌더링 (z-index 문제 해결)
 * - 외부 클릭 시 닫기
 * - 키보드 내비게이션 (Escape, 화살표 키)
 *
 * 접근성:
 * - aria-expanded, aria-haspopup="menu"
 * - role="menu", role="menuitem"
 * - Escape 키로 닫기
 * - 포커스 트랩 및 복원
 */
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  createContext,
  useContext,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Dropdown.module.css';

// ============================================
// Dropdown Context
// ============================================

interface DropdownContextValue {
  isOpen: boolean;
  closeMenu: () => void;
  menuId: string;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

const useDropdownContext = () => {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown 컴포넌트 내부에서만 사용 가능합니다');
  }
  return context;
};

// ============================================
// Dropdown Component
// ============================================

export interface DropdownProps {
  /** 드롭다운 트리거 (render prop 패턴) */
  trigger: (props: {
    ref: React.RefObject<HTMLButtonElement>;
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
    'aria-controls': string | undefined;
    disabled: boolean;
  }) => React.ReactNode;
  /** 메뉴 아이템들 */
  children: React.ReactNode;
  /** 열림 상태 (제어 모드) */
  isOpen?: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange?: (isOpen: boolean) => void;
  /** 메뉴 정렬 방향 */
  align?: 'start' | 'end';
  /** 추가 클래스명 */
  className?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  isOpen: controlledIsOpen,
  onOpenChange,
  align = 'start',
  className = '',
  disabled = false,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // 메뉴 위치 상태
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, rightOffset: 0 });

  // 메뉴 열기/닫기
  const setIsOpen = useCallback(
    (value: boolean) => {
      if (isControlled) {
        onOpenChange?.(value);
      } else {
        setInternalIsOpen(value);
      }
    },
    [isControlled, onOpenChange]
  );

  const openMenu = useCallback(() => {
    if (disabled) return;
    setIsAnimatingOut(false);
    setIsOpen(true);
  }, [disabled, setIsOpen]);

  const closeMenu = useCallback(() => {
    if (!isOpen) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsOpen(false);
    } else {
      setIsAnimatingOut(true);
    }
  }, [isOpen, setIsOpen]);

  // Handle exit animation end
  const handleAnimationEnd = useCallback(() => {
    if (isAnimatingOut) {
      setIsAnimatingOut(false);
      setIsOpen(false);
    }
  }, [isAnimatingOut, setIsOpen]);

  const toggleMenu = useCallback(() => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [isOpen, openMenu, closeMenu]);

  // 포커스 복원 (메뉴가 닫힐 때)
  useEffect(() => {
    if (!isOpen && !isAnimatingOut) {
      // 메뉴가 닫힐 때 트리거에 포커스 복원
      triggerRef.current?.focus();
    }
  }, [isOpen, isAnimatingOut]);

  // 메뉴 위치 계산
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollX = window.scrollX || document.documentElement.scrollLeft;

      const viewportWidth = document.documentElement.clientWidth;
      setMenuPosition({
        top: rect.bottom + scrollY + 4, // 4px gap
        left: align === 'end' ? rect.right + scrollX : rect.left + scrollX,
        width: rect.width,
        rightOffset: viewportWidth - rect.right,
      });
    }
  }, [isOpen, align]);

  // 외부 클릭 감지
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeMenu]);

  // Escape 키 처리
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  // render prop에 전달할 트리거 props
  const triggerProps = {
    ref: triggerRef,
    onClick: toggleMenu,
    'aria-expanded': isOpen,
    'aria-haspopup': 'menu' as const,
    'aria-controls': isOpen ? menuId : undefined,
    disabled,
  };

  // Portal 메뉴 렌더링
  const showMenu = isOpen || isAnimatingOut;
  const menuContent = showMenu && (
    <DropdownContext.Provider value={{ isOpen, closeMenu, menuId }}>
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-orientation="vertical"
        className={`${styles.menu} ${styles[align]} ${isAnimatingOut ? styles.menuExiting : ''} ${className}`}
        style={{
          position: 'absolute',
          top: menuPosition.top,
          left: align === 'end' ? 'auto' : menuPosition.left,
          right: align === 'end' ? menuPosition.rightOffset : 'auto',
          minWidth: menuPosition.width,
        }}
        onAnimationEnd={handleAnimationEnd}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );

  return (
    <>
      {trigger(triggerProps)}
      {typeof document !== 'undefined' && createPortal(menuContent, document.body)}
    </>
  );
};

// ============================================
// DropdownItem Component
// ============================================

export interface DropdownItemProps {
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 위험 동작 여부 (빨간색 표시) */
  danger?: boolean;
  /** 아이콘 */
  icon?: React.ReactNode;
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 클래스명 */
  className?: string;
}

export const DropdownItem = forwardRef<HTMLButtonElement, DropdownItemProps>(
  ({ onClick, disabled = false, danger = false, icon, children, className = '' }, ref) => {
    const { closeMenu } = useDropdownContext();
    const itemRef = useRef<HTMLButtonElement>(null);

    // forwardRef와 내부 ref 통합
    const mergedRef = useCallback(
      (node: HTMLButtonElement | null) => {
        itemRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    const handleClick = useCallback(() => {
      if (disabled) return;
      onClick?.();
      closeMenu();
    }, [disabled, onClick, closeMenu]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      },
      [handleClick]
    );

    // 화살표 키 내비게이션
    const handleArrowNavigation = useCallback((e: React.KeyboardEvent) => {
      const menu = itemRef.current?.closest('[role="menu"]');
      if (!menu) return;

      const items = Array.from(
        menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      );
      const currentIndex = itemRef.current ? items.indexOf(itemRef.current) : -1;

      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      items[nextIndex]?.focus();
    }, []);

    return (
      <button
        ref={mergedRef}
        type="button"
        role="menuitem"
        onClick={handleClick}
        onKeyDown={(e) => {
          handleKeyDown(e);
          handleArrowNavigation(e);
        }}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className={`${styles.item} ${danger ? styles.danger : ''} ${disabled ? styles.disabled : ''} ${className}`}
      >
        {icon && <span className={styles.itemIcon} aria-hidden="true">{icon}</span>}
        <span className={styles.itemLabel}>{children}</span>
      </button>
    );
  }
);

DropdownItem.displayName = 'DropdownItem';

// ============================================
// DropdownDivider Component
// ============================================

export const DropdownDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div role="separator" className={`${styles.divider} ${className}`} />
);

DropdownDivider.displayName = 'DropdownDivider';

// ============================================
// DropdownLabel Component
// ============================================

export interface DropdownLabelProps {
  children: React.ReactNode;
  className?: string;
}

export const DropdownLabel: React.FC<DropdownLabelProps> = ({ children, className = '' }) => (
  <div className={`${styles.label} ${className}`}>{children}</div>
);

DropdownLabel.displayName = 'DropdownLabel';

Dropdown.displayName = 'Dropdown';

export default Dropdown;
