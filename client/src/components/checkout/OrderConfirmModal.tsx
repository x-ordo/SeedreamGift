import React from 'react';
import { Gift } from 'lucide-react';
import { Modal, Button, TableRow, Border } from '../../design-system';
import { formatPrice } from '../../utils';
import type { CheckoutItem } from '../../store/useCheckoutStore';

interface OrderConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: CheckoutItem[];
  totalPrice: number;
  paymentMethod: string;
  bankInfo: { bankName: string; accountNumber: string; accountHolder: string };
  giftTarget?: { email: string; name: string; message?: string } | null;
  isSubmitting?: boolean;
}

export const OrderConfirmModal: React.FC<OrderConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  items,
  totalPrice,
  paymentMethod,
  bankInfo,
  giftTarget,
  isSubmitting,
}) => {
  const paymentLabel = paymentMethod === 'CASH' ? '무통장입금' : paymentMethod;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="주문 확인"
      size="medium"
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button variant="cta" size="lg" fullWidth onClick={onConfirm} disabled={isSubmitting} loading={isSubmitting}>
            {giftTarget ? '선물하기' : '주문하기'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* 주문 상품 목록 */}
        <div>
          <p className="font-bold mb-2 text-xs sm:text-sm">
            주문 상품 ({items.length}건)
          </p>
          {items.map((item) => (
            <TableRow
              key={item.id}
              left={`${item.name} x${item.quantity}`}
              right={formatPrice((Number(item.buyPrice) || 0) * item.quantity)}
              numeric
              withBorder
            />
          ))}
        </div>

        <Border variant="full" />

        {/* 결제 정보 */}
        <div>
          <TableRow left="결제 수단" right={paymentLabel} withBorder />
          {paymentMethod === 'CASH' && (
            <TableRow left="입금 계좌" right={`${bankInfo.bankName} ${bankInfo.accountNumber}`} withBorder />
          )}
          <div style={{ fontWeight: 700 }}>
            <TableRow
              left="총 결제 금액"
              right={formatPrice(totalPrice)}
              emphasized
              numeric
              size="large"
            />
          </div>
        </div>

        {/* 선물 대상 */}
        {giftTarget && (
          <>
            <Border variant="full" />
            <div>
              <p className="font-bold mb-2 text-xs sm:text-sm text-error">
                <Gift size={16} className="mr-1" aria-hidden="true" />
                선물 받는 분
              </p>
              <TableRow left="이름" right={giftTarget.name} withBorder />
              <TableRow left="이메일" right={giftTarget.email} withBorder={!!giftTarget.message} />
              {giftTarget.message && (
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--color-grey-50, #f9fafb)',
                  borderRadius: 'var(--input-radius)',
                  marginTop: '8px',
                  fontSize: '13px',
                  color: 'var(--color-grey-600, #6b7280)',
                  fontStyle: 'italic',
                }}>
                  &ldquo;{giftTarget.message}&rdquo;
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
