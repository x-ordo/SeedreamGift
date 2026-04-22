/**
 * @file Accordion.tsx
 * @description 접근성을 준수하는 Accordion(아코디언) 컴포넌트 — daisyUI collapse
 * @module design-system/molecules
 *
 * 접근성:
 * - HTML5 details/summary 사용 (기본 접근성 지원)
 * - 키보드 접근 가능 (Enter/Space로 펼치기/접기)
 * - 스크린 리더 호환
 *
 * 사용법:
 * <Accordion>
 *   <AccordionItem title="질문 1">답변 1</AccordionItem>
 *   <AccordionItem title="질문 2">답변 2</AccordionItem>
 * </Accordion>
 */
import React, { useId, useState } from 'react';
import styles from './Accordion.module.css';

// ============ AccordionItem (details/summary 기반 — daisyUI collapse) ============

export interface AccordionItemProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  children,
  defaultOpen = false,
  className = '',
}) => {
  return (
    <details
      className={`collapse collapse-arrow border border-base-300 bg-base-100 rounded-2xl ${className}`}
      open={defaultOpen}
    >
      <summary className="collapse-title font-semibold text-sm sm:text-base">
        {title}
      </summary>
      <div className="collapse-content text-xs sm:text-sm text-base-content/70 leading-relaxed border-t border-base-200 bg-base-200/30">
        {children}
      </div>
    </details>
  );
};

// ============ AccordionItemControlled (ARIA 기반) ============

export interface AccordionItemControlledProps {
  title: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  id?: string;
  className?: string;
}

export const AccordionItemControlled: React.FC<AccordionItemControlledProps> = ({
  title,
  children,
  isOpen: controlledIsOpen,
  onToggle,
  id,
  className = '',
}) => {
  const generatedId = useId();
  const itemId = id || generatedId;
  const headerId = `accordion-header-${itemId}`;
  const panelId = `accordion-panel-${itemId}`;

  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    const newState = !isOpen;
    if (isControlled && onToggle) {
      onToggle(newState);
    } else {
      setInternalIsOpen(newState);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={`collapse collapse-arrow border border-base-300 bg-base-100 rounded-2xl ${isOpen ? 'collapse-open' : 'collapse-close'} ${className}`}>
      <button
        type="button"
        id={headerId}
        className="collapse-title font-semibold text-sm sm:text-base"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        {title}
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!isOpen}
        className={`collapse-content text-xs sm:text-sm text-base-content/70 leading-relaxed border-t border-base-200 bg-base-200/30 ${isOpen ? styles.panelOpen : ''}`}
      >
        <div className="pt-0">{children}</div>
      </div>
    </div>
  );
};

// ============ Accordion Container ============

export interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({ children, className = '' }) => {
  return <div className={`flex flex-col gap-3 ${className}`}>{children}</div>;
};

export default Accordion;
