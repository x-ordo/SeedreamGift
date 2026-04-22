import React from 'react';
import { Building2 } from 'lucide-react';
import { Modal } from '../../design-system';
import BankVerification, { type BankVerifiedData } from '../auth/BankVerification';

interface BankAccount {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  bankVerifiedAt: string | null;
}

interface BankModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccount: BankAccount | null;
  userId?: number;
  onVerified: (data: BankVerifiedData) => void;
}

export const BankModal: React.FC<BankModalProps> = ({
  isOpen, onClose, bankAccount, userId, onVerified,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="계좌 관리"
  >
    {bankAccount?.bankName && bankAccount?.accountNumber ? (
      <div className="p-4 rounded-xl mb-4 flex items-center gap-3" style={{ background: 'color-mix(in oklch, var(--color-primary) 3%, var(--color-grey-50))', border: '1px solid color-mix(in oklch, var(--color-primary) 6%, var(--color-grey-100))' }}>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 size={18} className="text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-base-content/40 mb-0.5">현재 등록된 계좌</div>
          <div className="text-sm font-bold text-base-content tabular-nums">{bankAccount.bankName} {bankAccount.accountNumber}</div>
          <div className="text-xs text-base-content/40">
            예금주: {bankAccount.accountHolder || '-'}
            {bankAccount.bankVerifiedAt && ` · ${new Date(bankAccount.bankVerifiedAt).toLocaleDateString()}`}
          </div>
        </div>
      </div>
    ) : (
      <div className="p-4 rounded-xl mb-4 text-center" style={{ background: 'color-mix(in oklch, var(--color-primary) 3%, var(--color-grey-50))', border: '1px solid color-mix(in oklch, var(--color-primary) 6%, var(--color-grey-100))' }}>
        <p className="text-sm text-base-content/50">등록된 계좌가 없습니다</p>
        <p className="text-xs text-base-content/30 mt-1">아래에서 새 계좌를 등록해주세요</p>
      </div>
    )}
    <div className="p-3 rounded-xl mb-4" style={{ background: 'color-mix(in oklch, var(--color-primary) 4%, var(--color-grey-50))', border: '1px solid color-mix(in oklch, var(--color-primary) 8%, var(--color-grey-100))' }}>
      <p className="text-xs sm:text-sm text-base-content/60 leading-relaxed">
        {bankAccount?.bankName ? '계좌를 변경하려면' : '계좌를 등록하려면'} 아래에서 은행과 계좌번호를 입력하고 <strong className="text-primary">1원 인증</strong>을 완료해주세요.
      </p>
    </div>
    <BankVerification
      onVerified={onVerified}
      userId={userId}
    />
  </Modal>
);
