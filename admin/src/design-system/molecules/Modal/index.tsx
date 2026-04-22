import React, { useEffect, useRef, useId, useState, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, PanInfo } from 'motion/react';
import styles from './Modal.module.css';

// ==========================================
// Modal Context (Compound Component 패턴용)
// ==========================================
interface ModalContextValue {
    onClose: () => void;
    titleId: string;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export const useModalContext = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('Modal 서브 컴포넌트는 Modal 내부에서만 사용해야 합니다.');
    }
    return context;
};

// ==========================================
// Modal Component
// ==========================================
export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    closeOnOverlayClick?: boolean;
    /** Modal size: small (400px), medium (500px, default), large (680px) */
    size?: 'small' | 'medium' | 'large';
    /** Enable swipe-to-close on mobile (default: true) */
    enableSwipeClose?: boolean;
    /** Swipe threshold in pixels (default: 100) */
    swipeThreshold?: number;
}

export const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    closeOnOverlayClick = true,
    size = 'medium',
    enableSwipeClose = true,
    swipeThreshold = 100,
}: ModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const [isMobile, setIsMobile] = useState(false);

    // Motion values for swipe gesture
    const y = useMotionValue(0);
    const opacity = useTransform(y, [0, 200], [1, 0.3]);
    const scale = useTransform(y, [0, 200], [1, 0.95]);

    // Check for mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile, { passive: true });
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        // 모달 열릴 때 현재 포커스 저장
        triggerRef.current = document.activeElement as HTMLElement;

        // 배경 콘텐츠 비활성화 — 포털이 body에 렌더링되므로 #root 전체를 inert
        const root = document.getElementById('root');
        root?.setAttribute('inert', 'true');
        document.body.style.overflow = 'hidden';

        // 포커스 가능 요소 계산 및 동기적 포커스 이동 (RAF 제거 — race condition 방지)
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0];
            firstElement.focus();
        } else if (modalRef.current) {
            // 포커스 가능한 요소가 없으면 모달 자체에 포커스
            modalRef.current.focus();
        }

        // 포커스 트랩 및 키보드 핸들링
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                // 모달 내용이 동적으로 변할 수 있으므로 매번 재계산
                const currentFocusable = modalRef.current.querySelectorAll<HTMLElement>(focusableSelector);
                if (currentFocusable.length === 0) {
                    e.preventDefault();
                    return;
                }

                const first = currentFocusable[0];
                const last = currentFocusable[currentFocusable.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first || document.activeElement === modalRef.current) {
                        e.preventDefault();
                        last?.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first?.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
            root?.removeAttribute('inert');
            // 포커스 복원
            triggerRef.current?.focus();
        };
    }, [isOpen, onClose]);

    // Handle drag end for swipe-to-close
    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > swipeThreshold || info.velocity.y > 500) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const showSwipeHandle = enableSwipeClose && isMobile;

    // 하위 호환성: title이나 footer가 prop으로 넘어오면 기존 방식대로 렌더링
    // Compound 방식으로 쓰인다면 자식 컴포넌트가 직접 Header, Body, Footer 렌더링
    const renderContent = () => {
        if (title || footer) {
            return (
                <>
                    {title && <ModalHeader>{title}</ModalHeader>}
                    <ModalBody>{children}</ModalBody>
                    {footer && <ModalFooter>{footer}</ModalFooter>}
                </>
            );
        }
        return children;
    };

    return createPortal(
        <div
            className={styles.overlay}
            onClick={closeOnOverlayClick ? onClose : undefined}
            role="presentation"
        >
            <ModalContext.Provider value={{ onClose, titleId }}>
                <motion.div
                    ref={modalRef}
                    className={`${styles.modal} ${styles[size]} ${showSwipeHandle ? styles.swipeable : ''}`}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    tabIndex={-1}
                    // Swipe gesture props (only on mobile)
                    drag={showSwipeHandle ? 'y' : false}
                    dragConstraints={{ top: 0 }}
                    dragElastic={0.2}
                    onDragEnd={showSwipeHandle ? handleDragEnd : undefined}
                    style={showSwipeHandle ? { y, opacity, scale } : undefined}
                >
                    {/* Drag handle for mobile swipe */}
                    {showSwipeHandle && (
                        <div className={styles.dragHandle} aria-hidden="true">
                            <div className={styles.dragHandleBar} />
                        </div>
                    )}
                    {renderContent()}
                </motion.div>
            </ModalContext.Provider>
        </div>,
        document.body
    );
};

// ==========================================
// Sub Components (Compound Component)
// ==========================================

export interface ModalHeaderProps {
    children: React.ReactNode;
    hideCloseButton?: boolean;
    className?: string;
}

const ModalHeader = ({ children, hideCloseButton = false, className = '' }: ModalHeaderProps) => {
    const { onClose, titleId } = useModalContext();
    return (
        <div className={`${styles.header} ${className}`}>
            <h3 id={titleId} className={styles.title}>{children}</h3>
            {!hideCloseButton && (
                <button className={styles.closeButton} onClick={onClose} aria-label="닫기" type="button">
                    &times;
                </button>
            )}
        </div>
    );
};

export interface ModalBodyProps {
    children: React.ReactNode;
    className?: string;
}

const ModalBody = ({ children, className = '' }: ModalBodyProps) => {
    return <div className={`${styles.body} ${className}`}>{children}</div>;
};

export interface ModalFooterProps {
    children: React.ReactNode;
    className?: string;
}

const ModalFooter = ({ children, className = '' }: ModalFooterProps) => {
    return <div className={`${styles.footer} ${className}`}>{children}</div>;
};

// ==========================================
// Attach to Main Component
// ==========================================
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

