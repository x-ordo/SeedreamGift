/**
 * @file a11yUtils.ts
 * @description 접근성(Accessibility) 유틸리티 함수
 * @module utils
 *
 * 주요 기능:
 * - 키보드 활성화 핸들러 (Enter/Space)
 * - 포커스 트랩 (모달, 대화상자)
 * - 스크린 리더 알림 (aria-live)
 * - 동작 감소 모드 지원
 * - 터치 타겟 크기 검증
 *
 * 사용 예시:
 * ```tsx
 * // 키보드 핸들러
 * <div
 *   tabIndex={0}
 *   onKeyDown={createKeyboardHandler(() => setOpen(true))}
 *   onClick={() => setOpen(true)}
 * >
 *   클릭 또는 Enter/Space로 열기
 * </div>
 *
 * // 스크린 리더 알림
 * announceToScreenReader('장바구니에 추가되었습니다', 'polite');
 *
 * // 포커스 트랩 (모달)
 * const trap = createFocusTrap(modalRef);
 * trap.activate();
 * ```
 */

import { KEYBOARD_KEYS, isActivationKey } from '../constants/a11y';

/**
 * 키보드 활성화 핸들러 생성
 * Enter 또는 Space 키로 클릭 동작 트리거
 *
 * @param onClick - 활성화 시 실행할 함수
 * @returns 키보드 이벤트 핸들러
 */
export const createKeyboardHandler = (onClick: () => void) => {
  return (e: React.KeyboardEvent) => {
    if (isActivationKey(e.key)) {
      e.preventDefault();
      onClick();
    }
  };
};

/**
 * 포커스 트랩 설정 (모달, 대화상자용)
 *
 * @param containerRef - 포커스를 가둘 컨테이너 ref
 * @returns activate/deactivate 메서드를 가진 객체
 */
export const createFocusTrap = (containerRef: React.RefObject<HTMLElement>) => {
  const focusableSelectors = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== KEYBOARD_KEYS.TAB || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(focusableSelectors);
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey) {
      // Shift + Tab: 첫 번째 요소에서 마지막으로
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab: 마지막 요소에서 첫 번째로
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  return {
    activate: () => document.addEventListener('keydown', handleKeyDown),
    deactivate: () => document.removeEventListener('keydown', handleKeyDown),
  };
};

/**
 * 스크린 리더 알림 발송
 * aria-live 영역에 메시지를 추가하여 스크린 리더가 읽도록 함
 *
 * @param message - 알림 메시지
 * @param priority - 우선순위 ('polite': 현재 읽기 완료 후, 'assertive': 즉시)
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'visually-hidden';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // 1초 후 제거
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * 포커스 가능한 첫 번째 요소로 포커스 이동
 *
 * @param container - 검색할 컨테이너 요소
 */
export const focusFirstElement = (container: HTMLElement | null) => {
  if (!container) return;

  const focusable = container.querySelector<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  focusable?.focus();
};

/**
 * 요소가 화면에 보이는지 확인 (display, visibility, opacity 검사)
 *
 * @param element - 검사할 요소
 * @returns 화면에 보이면 true
 */
export const isElementVisible = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
};

/**
 * 탭 패널 ID 생성 (aria-controls 연결용)
 *
 * @param baseId - 기본 ID
 * @param tabId - 탭 식별자
 * @returns 탭 패널 ID 문자열
 */
export const createTabPanelId = (baseId: string, tabId: string): string => {
  return `${baseId}-tabpanel-${tabId}`;
};

/**
 * 탭 ID 생성 (aria-labelledby 연결용)
 *
 * @param baseId - 기본 ID
 * @param tabId - 탭 식별자
 * @returns 탭 ID 문자열
 */
export const createTabId = (baseId: string, tabId: string): string => {
  return `${baseId}-tab-${tabId}`;
};

/**
 * 동작 감소 모드에 따른 애니메이션 지속시간 반환
 *
 * @param normalDuration - 일반 모드 지속시간 (ms)
 * @returns 동작 감소 모드면 0, 아니면 normalDuration
 */
export const getReducedMotionDuration = (normalDuration: number): number => {
  if (typeof window === 'undefined') return normalDuration;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return prefersReduced ? 0 : normalDuration;
};

/**
 * 터치 타겟 크기 검증 (WCAG 2.5.5 기준)
 *
 * @param element - 검사할 요소
 * @returns 최소 44x44px 이상이면 true
 */
export const validateTouchTarget = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  const minSize = 44; // WCAG 최소 권장 크기
  return rect.width >= minSize && rect.height >= minSize;
};
