/**
 * @file RefundOrderModal.tsx
 * @description 가상계좌 결제 환불 모달 (입금 후, PAID/DELIVERED 상태)
 *
 * 백엔드 POST /payment/seedream/cancel + payMethod=BANK 호출.
 * 키움 환불 정책상 환불 받을 계좌(은행+계좌번호)와 사유를 모두 받아야 함.
 *
 * API_GUIDE.md §17 환불 / 키움 화이트리스트 은행 코드(3자리) 사용.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Wallet } from 'lucide-react';
import { Modal, Button, TextField, Select } from '../../design-system';
import type { SelectOption } from '../../design-system';
import { BANKS } from '../../constants';

interface RefundOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: { cancelReason: string; bankCode: string; accountNo: string }) => void;
  orderCode: string;
  /** 사용자가 KYC 단계에서 등록한 은행 코드 — 환불 계좌 기본값으로 사용 */
  defaultBankCode?: string;
  /** 사용자 등록 계좌 — 기본값으로 사용 (마스킹 해제된 평문 필요) */
  defaultAccountNo?: string;
  isSubmitting?: boolean;
}

const BANK_OPTIONS: SelectOption[] = [
  { value: '', label: '은행 선택', disabled: true },
  ...BANKS.map(b => ({ value: b.code, label: b.name })),
];

const REASON_MIN = 5;
const REASON_MAX = 50;
const ACCOUNT_MIN = 8;
const ACCOUNT_MAX = 20;

export const RefundOrderModal: React.FC<RefundOrderModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  orderCode,
  defaultBankCode,
  defaultAccountNo,
  isSubmitting,
}) => {
  const [reason, setReason] = useState('');
  const [bankCode, setBankCode] = useState(defaultBankCode ?? '');
  const [accountNo, setAccountNo] = useState(defaultAccountNo ?? '');
  const [touched, setTouched] = useState(false);

  const reasonLen = useMemo(() => Array.from(reason).length, [reason]);
  const reasonValid = reasonLen >= REASON_MIN && reasonLen <= REASON_MAX;
  const bankValid = bankCode.length === 3 && /^\d{3}$/.test(bankCode);
  const accountValid = /^\d+$/.test(accountNo) && accountNo.length >= ACCOUNT_MIN && accountNo.length <= ACCOUNT_MAX;
  const isValid = reasonValid && bankValid && accountValid;

  const showReasonError = touched && !reasonValid;
  const showBankError = touched && !bankValid;
  const showAccountError = touched && !accountValid;

  const handleConfirm = useCallback(() => {
    setTouched(true);
    if (!isValid) return;
    onConfirm({ cancelReason: reason.trim(), bankCode, accountNo });
  }, [isValid, reason, bankCode, accountNo, onConfirm]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setReason('');
    setBankCode(defaultBankCode ?? '');
    setAccountNo(defaultAccountNo ?? '');
    setTouched(false);
    onClose();
  }, [isSubmitting, defaultBankCode, defaultAccountNo, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="환불 요청"
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
            환불 요청
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
          <Wallet size={20} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-sm text-base-content/70 leading-relaxed">
            환불 요청 후 입력하신 계좌로 환불 금액이 송금됩니다.<br />
            처리 완료까지 영업일 1~2일 소요될 수 있습니다.
          </div>
        </div>

        <div className="text-xs text-base-content/40 px-1">
          주문번호: <span className="font-mono font-bold">{orderCode}</span>
        </div>

        <Select
          label="환불 받을 은행"
          options={BANK_OPTIONS}
          value={bankCode}
          onChange={(v) => setBankCode(v)}
          error={showBankError}
          errorMessage={showBankError ? '환불 받을 은행을 선택해주세요' : undefined}
        />

        <TextField
          variant="box"
          label="환불 받을 계좌번호"
          labelOption="sustain"
          name="accountNo"
          placeholder="- 없이 숫자만 입력"
          value={accountNo}
          onChange={(e) => {
            setAccountNo(e.target.value.replace(/\D/g, '').slice(0, ACCOUNT_MAX));
            if (touched) setTouched(false);
          }}
          onBlur={() => setTouched(true)}
          inputMode="numeric"
          autoComplete="off"
          maxLength={ACCOUNT_MAX}
          hasError={showAccountError}
          help={
            showAccountError
              ? `계좌번호는 ${ACCOUNT_MIN}~${ACCOUNT_MAX}자리 숫자만 입력 가능해요`
              : undefined
          }
        />

        <TextField
          variant="box"
          label="환불 사유"
          labelOption="sustain"
          name="cancelReason"
          placeholder="예: 상품 미수령, 단순 변심 등"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (touched) setTouched(false);
          }}
          onBlur={() => setTouched(true)}
          maxLength={REASON_MAX + 10}
          help={
            showReasonError
              ? `환불 사유는 ${REASON_MIN}자 이상 ${REASON_MAX}자 이하로 입력해주세요`
              : `${reasonLen}/${REASON_MAX}자`
          }
          hasError={showReasonError}
        />
      </div>
    </Modal>
  );
};
