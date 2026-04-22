/**
 * @file LiveDashboard.tsx
 * @description 홈 화면 시세 테이블 - 상품별 액면가/판매가/매입가를 정적으로 표시
 * @module components/home
 *
 * 사용처:
 * - HomePage: 메인 페이지 사이드바에 시세 테이블 카드 표시
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { TextButton, ListHeader, ListHeaderTitleParagraph, Skeleton } from '../../design-system';
import { axiosInstance } from '../../lib/axios';
import { BRAND_THEMES, BRAND_NAMES, type BrandCode } from '../../constants';
import './LiveDashboard.css';
import './Rates.css';

// ============================================================================
// 타입 정의
// ============================================================================

interface ProductRate {
  id: number;
  name: string;
  brandCode: string;
  price: number;
  buyPrice: number;
  discountRate: number;
  tradeInPrice: number;
  tradeInRate: number;
}

export interface LiveDashboardProps {
  className?: string;
  /** 표시할 최대 상품 수. 미지정 시 전체 표시 */
  maxItems?: number;
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

const formatAmount = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount);

const getBrandColor = (brandCode: string): string => {
  const theme = BRAND_THEMES[brandCode as BrandCode];
  return theme?.primary ?? 'var(--color-grey-400)';
};

const getBrandName = (brandCode: string): string => {
  return BRAND_NAMES[brandCode as BrandCode] || brandCode;
};

// ============================================================================
// 서브 컴포넌트
// ============================================================================

/** Skeleton rows for rate table loading */
function RateTableSkeleton() {
  return (
    <div aria-busy="true" role="status" aria-label="시세 데이터 불러오는 중">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="table-data-row">
          <div className="col-brand"><Skeleton width="70%" height={14} /></div>
          <div className="col-face"><Skeleton width="60%" height={14} /></div>
          <div className="col-sale"><Skeleton width="70%" height={14} /></div>
          <div className="col-buy"><Skeleton width="70%" height={14} /></div>
        </div>
      ))}
    </div>
  );
}

/** 시세 테이블 - 전체 상품을 정적으로 표시 */
const RateTableContent: React.FC<{
  products: ProductRate[];
  onRateClick: (brandCode: string) => void;
}> = memo(({ products, onRateClick }) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent, brandCode: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRateClick(brandCode);
    }
  }, [onRateClick]);

  return (
    <div role="table" aria-label="실시간 시세 테이블">
      <div className="table-header-row" role="row">
        <div className="col-brand" role="columnheader">브랜드</div>
        <div className="col-face" role="columnheader">액면가</div>
        <div className="col-sale col-header-tip" role="columnheader" data-tooltip="구매 시 결제 금액">사실때</div>
        <div className="col-buy col-header-tip" role="columnheader" data-tooltip="판매 시 받으실 금액">파실때</div>
      </div>
      {products.map((rate) => (
        <div
          key={rate.id}
          className="table-data-row table-data-row--clickable"
          role="row"
          tabIndex={0}
          aria-label={`${getBrandName(rate.brandCode)} ${formatAmount(rate.price)}원 사실때 ${formatAmount(rate.buyPrice)}원`}
          onClick={() => onRateClick(rate.brandCode)}
          onKeyDown={(e) => handleKeyDown(e, rate.brandCode)}
        >
          <div className="col-brand" role="cell">
            <span
              className="brand-color-dot"
              style={{ background: getBrandColor(rate.brandCode) }}
              aria-hidden="true"
            />
            <span className="product-name">{getBrandName(rate.brandCode)}</span>
          </div>
          <div className="col-face" role="cell">
            <span className="price-value">{formatAmount(rate.price)}원</span>
          </div>
          <div className="col-sale" role="cell">
            <span className="rate-value sell">{formatAmount(rate.buyPrice)}원</span>
          </div>
          <div className="col-buy" role="cell">
            <span className="rate-value buy">{formatAmount(rate.tradeInPrice ?? Math.round(rate.price * (1 - (rate.tradeInRate || 0) / 100)))}원</span>
          </div>
        </div>
      ))}
    </div>
  );
});

RateTableContent.displayName = 'RateTableContent';

export const LiveDashboard: React.FC<LiveDashboardProps> = memo(({ className, maxItems }) => {
  const navigate = useNavigate();

  const [products, setProducts] = useState<ProductRate[]>([]);
  const [isRateLoading, setIsRateLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const handleRateClick = useCallback((brandCode: string) => {
    navigate(`/voucher-types/${brandCode}`);
  }, [navigate]);

  const handleNavigateToLive = useCallback(() => {
    navigate('/rates');
  }, [navigate]);

  // API에서 시세 데이터를 가져온다 (마운트 시 1회)
  useEffect(() => {
    let cancelled = false;
    axiosInstance.get('/products/live-rates').then((res) => {
      if (!cancelled && res.data) {
        const data = res.data;
        if (Array.isArray(data)) {
          setProducts(data);
        } else if (data.rates && Array.isArray(data.rates)) {
          setProducts(data.rates);
          if (data.lastUpdatedAt) setLastUpdatedAt(new Date(data.lastUpdatedAt));
        }
      }
    }).catch(() => { /* silent fallback */ }).finally(() => {
      if (!cancelled) setIsRateLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const displayProducts = maxItems ? products.slice(0, maxItems) : products;
  const isTruncated = maxItems != null && products.length > maxItems;

  return (
    <div className={`live-dashboard-container${className ? ` ${className}` : ''}`}>
      <section className="dashboard-card card">
        <ListHeader
          title={
            <ListHeaderTitleParagraph typography="t5" fontWeight="bold">
              실시간 시세
            </ListHeaderTitleParagraph>
          }
          right={
            <TextButton
              size="sm"
              variant="arrow"
              color="tertiary"
              onClick={handleNavigateToLive}
            >
              전체보기
            </TextButton>
          }
          className="dashboard-card-header"
        />

        {isRateLoading ? (
          <RateTableSkeleton />
        ) : products.length === 0 ? (
          <div className="empty-state" role="status">
            <Inbox size={24} aria-hidden="true" />
            <span>시세 데이터가 없습니다</span>
          </div>
        ) : (
          <RateTableContent
            products={displayProducts}
            onRateClick={handleRateClick}
          />
        )}

        <div className="dashboard-card-footer">
          <div className="footer-stat">
            {isTruncated
              ? <>상위 <strong>{maxItems}</strong>개 / 총 {products.length}개</>
              : <>총 <strong>{products.length}</strong>개 상품</>
            }
          </div>
          {lastUpdatedAt && (
            <div className="footer-stat footer-stat--time">
              기준: {lastUpdatedAt.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});

LiveDashboard.displayName = 'LiveDashboard';
