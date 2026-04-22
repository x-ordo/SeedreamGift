/**
 * @file ConfirmModal.tsx
 * @description 어드민 공통 확인 모달 — 상태 변경, 삭제 등 위험 액션 확인용
 *
 * 사용법:
 *   <ConfirmModal
 *     isOpen={confirm.open}
 *     onClose={handleClose}
 *     onConfirm={handleConfirm}
 *     title="주문 상태 변경"
 *     confirmLabel="변경"
 *     danger={false}
 *   >
 *     <p>정말 변경하시겠습니까?</p>
 *   </ConfirmModal>
 */
import React from 'react';
import { Modal, Button } from '../../../design-system';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger=true 이면 확인 버튼이 빨간색 */
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            className={danger ? styles.dangerButton : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {children}
      </div>
    </Modal>
  );
}

export default ConfirmModal;
