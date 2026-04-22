import React, { useEffect, useRef, useId, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react';
import styles from './BottomSheet.module.css';

// ============================================================================
// Types
// ============================================================================

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  header?: React.ReactNode;
  headerDescription?: React.ReactNode;
  cta?: React.ReactNode;
  className?: string;
  enableSwipeClose?: boolean;
  swipeThreshold?: number;
  closeOnOverlayClick?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

const BottomSheetHeader = memo<{ children: React.ReactNode; id?: string }>(({ children, id }) => (
  <h2 id={id} className={styles.headerTitle}>{children}</h2>
));
BottomSheetHeader.displayName = 'BottomSheet.Header';

const BottomSheetHeaderDescription = memo<{ children: React.ReactNode }>(({ children }) => (
  <p className={styles.headerDescription}>{children}</p>
));
BottomSheetHeaderDescription.displayName = 'BottomSheet.HeaderDescription';

const BottomSheetCTA = memo<{ children: React.ReactNode }>(({ children }) => (
  <div className={styles.footer}>{children}</div>
));
BottomSheetCTA.displayName = 'BottomSheet.CTA';

const BottomSheetDoubleCTA = memo<{
  leftButton: React.ReactNode;
  rightButton: React.ReactNode;
}>(({ leftButton, rightButton }) => (
  <div className={styles.footer}>
    <div className={styles.doubleCTA}>
      {leftButton}
      {rightButton}
    </div>
  </div>
));
BottomSheetDoubleCTA.displayName = 'BottomSheet.DoubleCTA';

// ============================================================================
// Main BottomSheet Component
// ============================================================================

const BottomSheetBase = ({
  open,
  onClose,
  children,
  header,
  headerDescription,
  cta,
  className,
  enableSwipeClose = true,
  swipeThreshold = 120,
  closeOnOverlayClick = true,
}: BottomSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [isMobile, setIsMobile] = useState(false);

  // Motion values for swipe gesture
  const y = useMotionValue(0);
  const overlayOpacity = useTransform(y, [0, 300], [1, 0]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement as HTMLElement;

    const mainContent = document.querySelector('main');
    mainContent?.setAttribute('inert', 'true');
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && sheetRef.current) {
        const focusableElements = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    requestAnimationFrame(() => {
      if (sheetRef.current) {
        const firstFocusable = sheetRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      mainContent?.removeAttribute('inert');
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > swipeThreshold || info.velocity.y > 500) {
      onClose();
    }
  };

  const showSwipeHandle = enableSwipeClose && isMobile;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className={styles.overlay}
            onClick={closeOnOverlayClick ? onClose : undefined}
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={showSwipeHandle ? { opacity: overlayOpacity } : undefined}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            className={`${styles.sheet} ${className || ''}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={header ? titleId : undefined}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag={showSwipeHandle ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={showSwipeHandle ? handleDragEnd : undefined}
            style={showSwipeHandle ? { y } : undefined}
          >
            {/* Drag handle */}
            {showSwipeHandle && (
              <div className={styles.dragHandle} aria-hidden="true">
                <div className={styles.dragHandleBar} />
              </div>
            )}

            {/* Header */}
            {header && (
              <div className={styles.header}>
                {React.isValidElement(header) && header.type === BottomSheetHeader
                  ? React.cloneElement(header as React.ReactElement<{ id?: string }>, { id: titleId })
                  : header}
              </div>
            )}

            {/* Header description */}
            {headerDescription && headerDescription}

            {/* Body */}
            <div className={styles.body}>{children}</div>

            {/* CTA footer */}
            {cta && cta}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ============================================================================
// Compound Component Export
// ============================================================================

type BottomSheetComponent = typeof BottomSheetBase & {
  Header: typeof BottomSheetHeader;
  HeaderDescription: typeof BottomSheetHeaderDescription;
  CTA: typeof BottomSheetCTA;
  DoubleCTA: typeof BottomSheetDoubleCTA;
};

export const BottomSheet = BottomSheetBase as BottomSheetComponent;
BottomSheet.Header = BottomSheetHeader;
BottomSheet.HeaderDescription = BottomSheetHeaderDescription;
BottomSheet.CTA = BottomSheetCTA;
BottomSheet.DoubleCTA = BottomSheetDoubleCTA;
