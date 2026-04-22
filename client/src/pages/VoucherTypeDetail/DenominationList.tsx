import { memo } from 'react';
import { Badge, NumericSpinner } from '../../design-system';
import { formatPrice } from '../../utils';
import type { Product } from '../../types';

/**
 * 금액권 목록 — 수량 선택 그리드
 * 데스크탑 본문과 모바일 BottomSheet 양쪽에서 재사용
 */
export const DenominationList = memo(({ products, quantities, onQuantityChange }: {
  products: Product[];
  quantities: Record<number, number>;
  onQuantityChange: (id: number, qty: number) => void;
}) => (
  <div className="vt-denomination-list">
    {products.map((product) => {
      const qty = quantities[product.id] || 0;
      return (
        <div key={product.id} className={`vt-denomination-item ${qty > 0 ? 'selected' : ''}`}>
          <div className="vt-denom-left">
            {product.discountRate > 0 ? (
              <>
                <span className="vt-denom-face">{formatPrice(Number(product.price))}</span>
                <div className="vt-denom-price-row">
                  <span className="vt-denom-buy">{formatPrice(Number(product.buyPrice))}</span>
                  <Badge color="red" size="sm" variant="weak">{product.discountRate}%</Badge>
                </div>
              </>
            ) : (
              <span className="vt-denom-buy">{formatPrice(Number(product.price))}</span>
            )}
          </div>
          <div className="vt-denom-right">
            <NumericSpinner
              number={qty}
              onNumberChange={(n) => onQuantityChange(product.id, n)}
              minNumber={0}
              maxNumber={99}
              size="md"
            />
          </div>
        </div>
      );
    })}
  </div>
));
DenominationList.displayName = 'DenominationList';
