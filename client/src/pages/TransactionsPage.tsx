/**
 * @file TransactionsPage.tsx
 * @description 시세 조회 페이지 — 브랜드별 상품권 시세 (URL: /rates)
 * @style Swift Trust 2.0 (Toss Design System)
 */
import './TransactionsPage.css';
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Coins, Gift, TrendingUp, ChevronRight } from 'lucide-react';
import SEO from '../components/common/SEO';
import { Skeleton, FadeIn, PageHeader } from '../design-system';
import { BRAND_THEMES, BRAND_NAMES, type BrandCode } from '../constants';
import { useLiveRates } from '../hooks';

// ============================================================================
// Sub-components
// ============================================================================

function GuideSection() {
  const navigate = useNavigate();
  const guides = [
    {
      icon: <ShoppingCart size={18} aria-hidden="true" />,
      title: '할인 구매',
      desc: '시세표에서 원하는 상품권을 골라 할인 구매하세요.',
      action: () => navigate('/products'),
      accent: 'primary' as const,
    },
    {
      icon: <Coins size={18} aria-hidden="true" />,
      title: '상품권 판매',
      desc: '미사용 상품권을 즉시 정산해 드려요.',
      action: () => navigate('/trade-in'),
      accent: 'success' as const,
    },
    {
      icon: <Gift size={18} aria-hidden="true" />,
      title: '선물하기',
      desc: '상품권으로 마음을 전하세요.',
      action: () => navigate('/products'),
      accent: 'warning' as const,
    },
  ] as const;

  return (
    <FadeIn direction="up" distance={20} delay={0.05}>
      <div className="rates-guide" role="region" aria-label="이용 안내">
        {guides.map((g) => (
          <button key={g.title} type="button" className={`rates-guide-item rates-guide-item--${g.accent}`} onClick={g.action}>
            <span className="rates-guide-item-icon">{g.icon}</span>
            <span className="rates-guide-item-text">
              <span className="rates-guide-item-title">{g.title}</span>
              <span className="rates-guide-item-desc">{g.desc}</span>
            </span>
            <ChevronRight size={16} className="rates-guide-item-arrow" aria-hidden="true" />
          </button>
        ))}
      </div>
    </FadeIn>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function RatesPage() {
  const navigate = useNavigate();
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const { data: products = [], isLoading } = useLiveRates();

  const formatAmount = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount);
  const getBrandColor = useCallback((brandCode: string): string => {
    const theme = BRAND_THEMES[brandCode as BrandCode];
    return theme?.primary ?? 'var(--color-grey-400)';
  }, []);
  const getBrandName = useCallback((brandCode: string): string => {
    return BRAND_NAMES[brandCode as BrandCode] || brandCode;
  }, []);

  const deduplicatedProducts = useMemo(() => {
    const seen = new Set<string>();
    return products.filter(p => {
      const key = `${p.brandCode}-${p.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (brandFilter === 'all') return deduplicatedProducts;
    return deduplicatedProducts.filter(p => p.brandCode === brandFilter);
  }, [deduplicatedProducts, brandFilter]);

  const brandChips = useMemo(() => {
    const seen = new Map<string, string>();
    deduplicatedProducts.forEach(p => {
      if (!seen.has(p.brandCode)) seen.set(p.brandCode, BRAND_NAMES[p.brandCode as BrandCode] || p.brandCode);
    });
    return Array.from(seen.entries()).map(([code, name]) => ({ code, name }));
  }, [deduplicatedProducts]);

  const maxDiscount = useMemo(() => {
    if (deduplicatedProducts.length === 0) return 0;
    return Math.max(...deduplicatedProducts.map(p => Number(p.discountRate) || 0));
  }, [deduplicatedProducts]);

  const maxTradeIn = useMemo(() => {
    if (deduplicatedProducts.length === 0) return 0;
    return Math.max(...deduplicatedProducts.map(p => Number(p.tradeInRate) || 0));
  }, [deduplicatedProducts]);

  return (
    <div className="page-container">
      <SEO title="시세 조회" description="백화점 상품권 실시간 시세를 확인하고 할인 구매하세요" />
      <div className="page-content">
        <PageHeader
          title="시세 조회"
          subtitle="상품권 시세를 한눈에 확인하세요"
          icon={TrendingUp}
          meta={<span>{new Date().toLocaleDateString()} 기준</span>}
        />

        <GuideSection />

        {/* Stats Strip */}
        <FadeIn delay={0.1} direction="up" distance={20}>
          <div className="rates-stats">
            <div className="rates-stat">
              <span className="rates-stat-label">전체 권종</span>
              <span className="rates-stat-value tabular-nums">{deduplicatedProducts.length}개</span>
            </div>
            <div className="rates-stat">
              <span className="rates-stat-label">취급 브랜드</span>
              <span className="rates-stat-value tabular-nums">{brandChips.length}개</span>
            </div>
            <div className="rates-stat rates-stat--success">
              <span className="rates-stat-label">최대 구매 할인</span>
              <span className="rates-stat-value tabular-nums">{maxDiscount}%</span>
            </div>
            <div className="rates-stat rates-stat--primary">
              <span className="rates-stat-label">최대 매입율</span>
              <span className="rates-stat-value tabular-nums">{maxTradeIn}%</span>
            </div>
          </div>
        </FadeIn>

        {/* Rate Table */}
        <FadeIn delay={0.15} direction="up" distance={20}>
          <div className="rates-table-wrap">
            {/* Brand Filter */}
            <div className="rates-filter" role="radiogroup" aria-label="브랜드 필터">
              <button
                type="button"
                className={`rates-chip ${brandFilter === 'all' ? 'rates-chip--active' : ''}`}
                aria-pressed={brandFilter === 'all'}
                onClick={() => setBrandFilter('all')}
              >
                전체
              </button>
              {brandChips.map(brand => (
                <button
                  key={brand.code}
                  type="button"
                  className={`rates-chip ${brandFilter === brand.code ? 'rates-chip--active' : ''}`}
                  aria-pressed={brandFilter === brand.code}
                  onClick={() => setBrandFilter(brand.code)}
                >
                  <span className="rates-chip-dot" style={{ background: getBrandColor(brand.code) }} />
                  {brand.name.replace(/\s*상품권$/, '')}
                </button>
              ))}
            </div>

            {/* Table */}
            <table className="rates-table" aria-label="상품권 시세표">
              <thead>
                <tr className="rates-table-head">
                  <th scope="col" className="rates-col-brand">브랜드</th>
                  <th scope="col" className="rates-col-face">액면가</th>
                  <th scope="col" className="rates-col-buy">
                    <span className="rates-col-dot rates-col-dot--success" />
                    구매가
                  </th>
                  <th scope="col" className="rates-col-sell">
                    <span className="rates-col-dot rates-col-dot--primary" />
                    매입가
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <RateTableSkeleton />
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="rates-empty">시세 데이터가 없습니다</td>
                  </tr>
                ) : (
                  filteredProducts.map((rate) => (
                    <tr
                      key={rate.id}
                      className="rates-row"
                      onClick={() => navigate(`/voucher-types/${rate.brandCode}`)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/voucher-types/${rate.brandCode}`); }}
                    >
                      <td className="rates-col-brand">
                        <span className="rates-brand-bar" style={{ background: getBrandColor(rate.brandCode) }} />
                        <span className="rates-brand-info">
                          <span className="rates-brand-name">{getBrandName(rate.brandCode)}</span>
                          <span className="rates-brand-face-mobile tabular-nums">{formatAmount(rate.price)}원</span>
                        </span>
                      </td>
                      <td className="rates-col-face tabular-nums">
                        {formatAmount(rate.price)}원
                      </td>
                      <td className="rates-col-buy">
                        <span className="rates-price rates-price--success tabular-nums">{formatAmount(rate.buyPrice)}원</span>
                        <span className="rates-discount rates-discount--success tabular-nums">{rate.discountRate}%</span>
                      </td>
                      <td className="rates-col-sell">
                        <span className="rates-price rates-price--primary tabular-nums">{formatAmount(rate.tradeInPrice ?? Math.round(rate.price * (1 - (rate.tradeInRate || 0) / 100)))}원</span>
                        <span className="rates-discount rates-discount--primary tabular-nums">{rate.tradeInRate}%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Footer */}
            {!isLoading && deduplicatedProducts.length > 0 && (
              <div className="rates-table-footer tabular-nums">
                {brandFilter !== 'all'
                  ? <>{filteredProducts.length}개 / 총 <strong>{deduplicatedProducts.length}</strong>개</>
                  : <>총 <strong>{deduplicatedProducts.length}</strong>개 상품</>
                }
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function RateTableSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="rates-row rates-row--skeleton">
          <td className="rates-col-brand"><Skeleton width="60%" height={14} /></td>
          <td className="rates-col-face"><Skeleton width="70%" height={14} /></td>
          <td className="rates-col-buy"><Skeleton width="80%" height={14} /></td>
          <td className="rates-col-sell"><Skeleton width="80%" height={14} /></td>
        </tr>
      ))}
    </>
  );
}
