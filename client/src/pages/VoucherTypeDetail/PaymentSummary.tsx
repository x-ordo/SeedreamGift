import { memo } from 'react';
import { ShoppingBag } from 'lucide-react';
import { formatPrice } from '../../utils';

/**
 * 결제 요약 — 선택 수량, 액면가, 할인, 결제 금액
 */
export const PaymentSummary = memo(({ selectedCount, totalFaceValue, discountAmount, totalPrice }: {
  selectedCount: number;
  totalFaceValue: number;
  discountAmount: number;
  totalPrice: number;
}) => (
  <div className="vt-summary-content">
    {selectedCount > 0 ? (
      <>
        <div className="vt-summary-row">
          <span>선택 수량</span>
          <span className="vt-summary-count">{selectedCount}개</span>
        </div>
        <div className="vt-summary-row">
          <span>액면가 합계</span>
          <span>{formatPrice(totalFaceValue)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="vt-summary-row discount">
            <span>할인 금액</span>
            <span>-{formatPrice(discountAmount)}</span>
          </div>
        )}
        <div className="vt-summary-row total">
          <span>결제 금액</span>
          <span className="vt-summary-total">{formatPrice(totalPrice)}</span>
        </div>
      </>
    ) : (
      <div className="vt-summary-empty">
        <ShoppingBag size={20} aria-hidden="true" />
        <span>상품을 선택해주세요</span>
      </div>
    )}
  </div>
));
PaymentSummary.displayName = 'PaymentSummary';
