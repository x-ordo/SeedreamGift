/**
 * @file CancelOrderModal.tsx
 * @description 가상계좌 결제 취소 모달 (입금 전, ISSUED 상태)
 *
 * 백엔드 POST /payment/seedream/cancel + payMethod=VACCOUNT-ISSUECAN 호출.
 * cancelReason 은 백엔드에서 5~50 rune 검증되므로 프론트에서도 동일 가드.
 */
import React, { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, Button, TextField } from '../../design-system';

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cancelReason: string) => void;
  orderCode: string;
  isSubmitting?: boolean;
}

const MIN_LEN = 5;
const MAX_LEN = 50;

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  orderCode,
  isSubmitting,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // rune length (한글 1글자도 1로 카운트). String.length 면 surrogate pair 가 2로 잡혀
  // 백엔드 검증과 어긋날 수 있으므로 Array.from 으로 grapheme 단위 카운트.
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
      title="결제 취소"
      size="medium"
      footer={
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button variant="secondary" size="lg" fullWidth onClick={handleClose} disabled={isSubmitting}>
            돌아가기
          </Button>
          <Button
            variant="danger"
            size="lg"
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
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-2xl bg-error/5 border border-error/10 flex items-start gap-3">
          <AlertTriangle size={20} className="text-error mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-sm text-base-content/70 leading-relaxed">
            결제 취소 시 발급된 가상계좌가 즉시 폐기됩니다.<br />
            취소 후에는 입금하셔도 자동 처리되지 않으며, 동일 주문은 복구할 수 없습니다.
          </div>
        </div>

        <div className="text-xs text-base-content/40 px-1">
          주문번호: <span className="font-mono font-bold">{orderCode}</span>
        </div>

        <TextField
          variant="box"
          label="취소 사유"
          labelOption="sustain"
          name="cancelReason"
          placeholder="예: 단순 변심, 잘못된 상품 선택 등"
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
};
