/**
 * @file PaymentSection.tsx
 * @description 결제 수단 선택 + 입금 계좌 정보 표시
 * @module components/checkout
 */
import React, { useCallback } from 'react';
import { Clipboard, CreditCard, Coins, PlusCircle, Building, Info } from 'lucide-react';
import { Card, Button, ListHeader, ListHeaderTitleParagraph } from '../../design-system';
import { useToast } from '../../contexts/ToastContext';
import { SUPPORT_CONTACT } from '../../constants/site';

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
}

export function PaymentSection({ paymentMethod, onPaymentMethodChange, bankInfo, userName }: PaymentSectionProps) {
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

              <div className="checkout-payment-upcoming" role="group" aria-label="출시 예정 결제 수단">
                <PlusCircle size={16} aria-hidden="true" />
                <span>가상계좌, 전용계좌, 오픈뱅킹</span>
                <span className="checkout-payment-badge">출시 예정</span>
              </div>
            </div>
          </fieldset>
        </Card>
      </section>

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
