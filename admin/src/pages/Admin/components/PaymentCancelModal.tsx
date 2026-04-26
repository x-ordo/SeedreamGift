/**
 * @file PaymentCancelModal.tsx
 * @description 어드민 — VA 주문 입금 전 결제 취소 모달
 *
 * 백엔드: POST /api/v1/admin/orders/{id}/cancel-payment
 *  - cancelReason 5~50 rune (백엔드 binding 검증)
 *  - PENDING/ISSUED 상태 + paymentMethod=VIRTUAL_ACCOUNT 만 허용
 *
 * 상태 전이는 webhook(payment_canceled) 경로로 비동기 — 모달 닫힌 후 잠시 후 목록 갱신.
 */
import React, { useState, useCallback } from 'react';
import { Modal, Button, TextField } from '../../../design-system';

interface PaymentCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cancelReason: string) => void;
  orderCode: string;
  isSubmitting?: boolean;
}

const MIN_LEN = 5;
const MAX_LEN = 50;

export function PaymentCancelModal({
  isOpen,
  onClose,
  onConfirm,
  orderCode,
  isSubmitting,
}: PaymentCancelModalProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // rune length: 한글/이모지 1로 카운트 (백엔드 Go 의 rune count 와 일치)
  const reasonLen = Array.from(reason).length;
  const isValid = reasonLen >= MIN_LEN && reasonLen <= MAX_LEN;
  const showError = touched && !isValid;

  const handleConfirm = useCallback(() => {
    setTouched(true);
    if (!isValid) return;
    onConfirm(reason.trim());
  }, [isValid, reason, onConfirm]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setReason('');
    setTouched(false);
    onClose();
  }, [isSubmitting, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="VA 주문 결제 취소 (입금 전)"
      size="small"
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <Button variant="secondary" fullWidth onClick={handleClose} disabled={isSubmitting}>
            돌아가기
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={handleConfirm}
            disabled={isSubmitting || !isValid}
            loading={isSubmitting}
          >
            취소 진행
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            padding: '12px',
            background: 'var(--color-error-bg, rgba(240,68,82,0.05))',
            border: '1px solid rgba(240,68,82,0.1)',
            borderRadius: '12px',
            fontSize: '13px',
            color: 'var(--color-grey-700)',
            lineHeight: 1.5,
          }}
        >
          입금 전 발급된 가상계좌를 즉시 폐기합니다. 사용자가 입금하더라도 자동 처리되지 않으며, 동일 주문은 복구할 수 없습니다.
        </div>

        <div style={{ fontSize: '12px', color: 'var(--color-grey-500)' }}>
          주문번호: <strong style={{ fontFamily: 'monospace' }}>{orderCode}</strong>
        </div>

        <TextField
          variant="box"
          label="취소 사유"
          labelOption="sustain"
          name="cancelReason"
          placeholder="예: 사용자 요청, 잘못된 발급 등"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (touched) setTouched(false);
          }}
          onBlur={() => setTouched(true)}
          maxLength={MAX_LEN + 10}
          help={
            showError
              ? `취소 사유는 ${MIN_LEN}자 이상 ${MAX_LEN}자 이하로 입력해주세요`
              : `${reasonLen}/${MAX_LEN}자`
          }
          hasError={showError}
        />
      </div>
    </Modal>
  );
}
