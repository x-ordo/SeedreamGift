/**
 * @file PaymentSection.tsx
 * @description 결제 수단 선택 + 입금 계좌 정보 표시
 * @module components/checkout
 */
import React, { useCallback } from 'react';
import { Clipboard, CreditCard, Coins, Building, Info, ShieldCheck } from 'lucide-react';
import { Card, Button, Select, ListHeader, ListHeaderTitleParagraph } from '../../design-system';
import type { SelectOption } from '../../design-system';
import { useToast } from '../../contexts/ToastContext';
import { SUPPORT_CONTACT } from '../../constants/site';
import { BANKS } from '../../constants';

type PaymentMethod = 'CASH' | 'VIRTUAL_ACCOUNT' | 'DEDICATED_ACCOUNT' | 'OPEN_BANKING';

interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isLoading: boolean;
}

interface PaymentSectionProps {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  bankInfo: BankInfo;
  userName?: string;
  /** VA 발급 시 선호 은행 코드. 미지정 = 모든 은행 허용 */
  preferredBankCode?: string;
  /** 선호 은행 변경 핸들러 (VA 모드 전용) */
  onPreferredBankChange?: (code: string) => void;
}

const BANK_OPTIONS: SelectOption[] = [
  { value: '', label: '제한 없음 (모든 은행)' },
  ...BANKS.map(b => ({ value: b.code, label: b.name })),
];

export function PaymentSection({
  paymentMethod,
  onPaymentMethodChange,
  bankInfo,
  userName,
  preferredBankCode,
  onPreferredBankChange,
}: PaymentSectionProps) {
  const { showToast } = useToast();

  const handleCopyAccount = useCallback(() => {
    navigator.clipboard.writeText(bankInfo.accountNumber);
    showToast({ message: '계좌번호가 복사되었어요', type: 'success' });
  }, [showToast, bankInfo.accountNumber]);

  return (
    <>
      {/* Payment Method */}
      <section className="checkout-section">
        <Card padding="md" shadow="md">
          <fieldset className="checkout-fieldset">
            <legend className="checkout-section-title">
              <CreditCard size={18} className="text-primary" aria-hidden="true" />
              결제 수단
            </legend>
            <div className="checkout-payment-options grid-2">
              <label
                htmlFor="payment-cash"
                className={`checkout-payment-option ${paymentMethod === 'CASH' ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  id="payment-cash"
                  name="paymentMethod"
                  value="CASH"
                  checked={paymentMethod === 'CASH'}
                  onChange={() => onPaymentMethodChange('CASH')}
                  className="checkout-payment-radio"
                />
                <Coins size={18} aria-hidden="true" />
                <span className="checkout-payment-label">현금</span>
              </label>

              <label
                htmlFor="payment-vaccount"
                className={`checkout-payment-option ${paymentMethod === 'VIRTUAL_ACCOUNT' ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  id="payment-vaccount"
                  name="paymentMethod"
                  value="VIRTUAL_ACCOUNT"
                  checked={paymentMethod === 'VIRTUAL_ACCOUNT'}
                  onChange={() => onPaymentMethodChange('VIRTUAL_ACCOUNT')}
                  className="checkout-payment-radio"
                />
                <Building size={18} aria-hidden="true" />
                <span className="checkout-payment-label">가상계좌</span>
              </label>
            </div>
          </fieldset>
        </Card>
      </section>

      {/* Virtual Account Info (shown when VIRTUAL_ACCOUNT selected) */}
      {paymentMethod === 'VIRTUAL_ACCOUNT' && (
        <section className="checkout-section">
          <Card padding="md" shadow="md" className="checkout-bank-card">
            <ListHeader
              title={
                <ListHeaderTitleParagraph typography="t5" fontWeight="bold">
                  <Building size={18} className="mr-2 text-primary" aria-hidden="true" />
                  가상계좌 결제 안내
                </ListHeaderTitleParagraph>
              }
            />
            <div className="checkout-bank-info" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <ShieldCheck size={16} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-grey-700)', lineHeight: 1.5 }}>
                  주문하기 버튼을 누르면 <strong>키움페이 결제창</strong>이 열려 은행을 선택하실 수 있어요.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <Info size={16} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-grey-500)', lineHeight: 1.5 }}>
                  결제창에서 발급받은 <strong>1회용 가상계좌</strong>로 입금하시면 자동으로 주문이 처리됩니다.
                  발급된 계좌는 <strong>입금 마감 시각까지</strong>만 사용할 수 있어요.
                </div>
              </div>

              {onPreferredBankChange && (
                <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-grey-100)' }}>
                  <Select
                    label="선호 은행 (선택사항)"
                    options={BANK_OPTIONS}
                    value={preferredBankCode ?? ''}
                    onChange={onPreferredBankChange}
                    helperText="자주 사용하시는 은행을 선택하면 해당 은행의 가상계좌로 우선 발급해드립니다."
                  />
                </div>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* Bank Info (shown when CASH selected) */}
      {paymentMethod === 'CASH' && (
        <section className="checkout-section">
          <Card padding="md" shadow="md" className="checkout-bank-card">
            <ListHeader
              title={
                <ListHeaderTitleParagraph typography="t5" fontWeight="bold">
                  <Building size={18} className="mr-2 text-primary" aria-hidden="true" />
                  입금 계좌
                </ListHeaderTitleParagraph>
              }
            />
            <div className="checkout-bank-info">
              {bankInfo.isLoading ? (
                <div className="checkout-bank-details">
                  <div className="skeleton" style={{ width: '60%', height: 16 }} />
                  <div className="skeleton" style={{ width: '80%', height: 16, marginTop: 4 }} />
                  <div className="skeleton" style={{ width: '50%', height: 14, marginTop: 4 }} />
                </div>
              ) : !bankInfo.bankName || !bankInfo.accountNumber ? (
                <div className="checkout-bank-details" role="alert">
                  <div style={{ color: 'var(--color-grey-500)', fontSize: 'var(--text-body)' }}>
                    현재 입금 계좌를 확인 중입니다.
                  </div>
                  <div style={{ color: 'var(--color-grey-400)', fontSize: 'var(--text-caption)', marginTop: 'var(--space-1)' }}>
                    고객센터 <a href={SUPPORT_CONTACT.phoneHref} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>{SUPPORT_CONTACT.phone}</a>로 문의해주세요.
                  </div>
                </div>
              ) : (
                <>
                  <div className="checkout-bank-details">
                    <div className="checkout-bank-name">{bankInfo.bankName}</div>
                    <div className="checkout-bank-account">{bankInfo.accountNumber}</div>
                    <div className="checkout-bank-holder">예금주: {bankInfo.accountHolder}</div>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleCopyAccount}
                    aria-label={`계좌번호 ${bankInfo.accountNumber} 복사하기`}
                  >
                    <Clipboard size={16} className="mr-1" aria-hidden="true" />
                    복사
                  </Button>
                </>
              )}
            </div>
            {bankInfo.bankName && bankInfo.accountNumber && (
              <div className="checkout-bank-notice">
                <Info size={16} aria-hidden="true" />
                <span>입금자명은 <strong>{userName || '주문자명'}</strong>으로 입금해주세요.</span>
              </div>
            )}
          </Card>
        </section>
      )}
    </>
  );
}
