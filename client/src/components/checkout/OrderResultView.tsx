/**
 * @file OrderResultView.tsx
 * @description 결제 완료 화면 - PIN 번호 표시 및 주문 요약
 * @module components/checkout
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Card, Button, TableRow, Result, PinCodeDisplay } from '../../design-system';
import { formatPrice } from '../../utils';

interface VoucherDisplay {
  pinCode: string;
  giftNumber?: string | null;
}

interface OrderResultProps {
  orderId: number;
  vouchers: VoucherDisplay[];
  totalAmount: number;
  giftTarget?: { name: string; email: string } | null;
}

export function OrderResultView({ orderId, vouchers, totalAmount, giftTarget }: OrderResultProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleCopyPin = useCallback((pin: string) => {
    navigator.clipboard.writeText(pin);
    showToast({ message: 'PIN 번호가 복사되었어요', type: 'success' });
  }, [showToast]);

  return (
    <div className="page-wrapper checkout-page">
      <div className="checkout-result-container">
        <Result
          icon="success"
          title={giftTarget ? "선물 주문이 접수되었어요!" : "주문이 접수되었어요!"}
          description={giftTarget ? `입금 확인 후 ${giftTarget.name}님에게 발송됩니다.` : "입금 확인 후 PIN 번호가 발급됩니다. 마이페이지에서 확인해주세요."}
          animated
        />

        {!giftTarget && vouchers.length > 0 && (
          <Card padding="lg" shadow="md" className="checkout-pin-card">
            <div className="checkout-pin-header">
              <Smartphone size={20} aria-hidden="true" />
              <span>상품권 정보</span>
            </div>
            <PinCodeDisplay vouchers={vouchers} onCopy={handleCopyPin} />
          </Card>
        )}

        {giftTarget && (
          <div className="checkout-gift-note">
            선물 주문은 수신자가 직접 PIN 확인이 가능합니다.
          </div>
        )}

        <Card padding="md" shadow="md" className="checkout-summary-card">
          <TableRow left="주문 번호" right={`#${orderId}`} emphasized withBorder />
          <TableRow left="결제 금액" right={formatPrice(totalAmount)} emphasized numeric />
        </Card>

        <div className="checkout-action-buttons">
          <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/')}>
            홈으로
          </Button>
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/mypage?tab=orders')}>
            구매 내역 보기
          </Button>
        </div>
      </div>
    </div>
  );
}
