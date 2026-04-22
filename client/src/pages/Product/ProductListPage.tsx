import './ProductList.css';
import React, { memo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Info } from 'lucide-react';
import SEO from '../../components/common/SEO';
import { Product, Brand } from '../../types';
import {
  Badge,
  Card,
  Result,
  Button,
  FixedBottomCTA,
  NumericSpinner,
  FadeIn,
  Stagger,
  PageHeader,
} from '../../design-system';
import { formatPrice } from '../../utils';
import { getProductImage } from '../../constants/voucherTypes';
import { GiftTargetModal } from '../../components/gift/GiftTargetModal';
import { BrandFilterChips } from '../../components/product/BrandFilterChips';
import TradeInFormView from './TradeInFormView';
import { useProductListPage } from './ProductListPage.hooks';

// ============================================================
// Sub-components
// ============================================================

const SellModeView = memo(({ 
  selectedBrandParam, 
  currentBrand, 
  sellProducts, 
  sellBrands, 
  clearBrand, 
  navigate, 
  isAuthenticated, 
  loading, 
  brandsLoading, 
  brandPriceRanges 
}: { 
  selectedBrandParam: string | null,
  currentBrand: Brand | null,
  sellProducts: Product[],
  sellBrands: { brands: Brand[]; counts: Record<string, number> },
  clearBrand: () => void,
  navigate: NavigateFunction,
  isAuthenticated: boolean,
  loading: boolean,
  brandsLoading: boolean,
  brandPriceRanges: Record<string, { min: number; max: number }>
}) => {
  if (selectedBrandParam) {
    return (
      <TradeInFormView
        brand={selectedBrandParam}
        brandInfo={currentBrand}
        products={sellProducts}
        onBack={sellBrands.brands.length === 1 ? () => navigate('/') : clearBrand}
      />
    );
  }

  return (
    <div className="page-container">
      <SEO title="상품권 판매" description="보유 상품권을 최고가에 판매하세요" />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <PageHeader title="상품권 판매" subtitle="판매할 상품권 브랜드를 선택하세요" />

        {!isAuthenticated && (
          <div className="flex items-center justify-between gap-3 py-3.5 px-4 rounded-2xl text-sm mb-6" style={{ background: 'color-mix(in oklch, var(--color-primary) 5%, white)', border: '1px solid color-mix(in oklch, var(--color-primary) 10%, var(--color-grey-200))', color: 'var(--color-primary)', boxShadow: '0 1px 3px rgba(49,130,246,0.04)' }}>
            <div className="flex items-center gap-2.5">
              <Info size={16} aria-hidden="true" className="shrink-0" />
              <span className="font-medium">상품권 판매는 로그인 후 이용할 수 있어요</span>
            </div>
            <Link to="/login" state={{ from: '/trade-in' }} className="text-xs font-bold text-primary hover:underline shrink-0 whitespace-nowrap">로그인</Link>
          </div>
        )}

        <div className="mt-6">
          {(loading || brandsLoading) ? (
            <div className="brand-selection-grid">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="brand-card-vertical skeleton-card">
                  <div className="brand-card-top"><div className="skeleton" style={{ width: 64, height: 64 }} /></div>
                  <div className="brand-card-bottom"><div className="skeleton" style={{ width: '60%', height: 24 }} /></div>
                </Card>
              ))}
            </div>
          ) : sellBrands.brands.length === 0 ? (
            <Result icon="info" title="현재 판매 가능한 브랜드가 없어요" />
          ) : (
            <Stagger className="brand-selection-grid" staggerDelay={0.08} direction="up" distance={16}>
              {sellBrands.brands.map((brand: Brand) => {
                const count = sellBrands.counts[brand.code] || 0;
                return (
                  <BrandCard
                    key={brand.code}
                    displayName={brand.name}
                    color={brand.color}
                    description={brand.description}
                    image={brand.imageUrl}
                    productCount={count}
                    priceRange={brandPriceRanges[brand.code]}
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate('/login', { state: { from: `/trade-in?brand=${brand.code}` } });
                        return;
                      }
                      navigate(`/trade-in?brand=${brand.code}`);
                    }}
                    isSellMode
                  />
                );
              })}
            </Stagger>
          )}
        </div>
      </div>
    </div>
  );
});
SellModeView.displayName = 'SellModeView';

// ============================================================
// Virtualized Grid — 상품 수가 많을 때 DOM 노드를 최소화
// 반응형 열 수에 맞춰 행 단위로 가상화 (화면 밖 행은 렌더링하지 않음)
// ============================================================
function useResponsiveCols() {
  const [cols, setCols] = useState(() => {
    if (typeof window === 'undefined') return 2;
    if (window.innerWidth >= 768) return 4;
    if (window.innerWidth >= 576) return 3;
    return 2;
  });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setCols(w >= 768 ? 4 : w >= 576 ? 3 : 2);
    };
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  return cols;
}

const ROW_HEIGHT_EST = 340; // 예상 행 높이 (px)

const VirtualizedProductGrid = memo(({
  items,
  brandMap,
  quantities,
  handleQuantityChange,
  navigate,
}: {
  items: { product: Product; stockCount: number }[];
  brandMap: Record<string, Brand>;
  quantities: Record<number, number>;
  handleQuantityChange: (id: number, q: number) => void;
  navigate: NavigateFunction;
}) => {
  const COLS = useResponsiveCols();
  const rowCount = Math.ceil(items.length / COLS);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    if (listRef.current) {
      setScrollMargin(listRef.current.offsetTop);
    }
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ROW_HEIGHT_EST,
    overscan: 3,
    scrollMargin,
  });

  return (
    <div ref={listRef} style={{ position: 'relative', width: '100%', minHeight: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const rowStart = virtualRow.index * COLS;
        const rowItems = items.slice(rowStart, rowStart + COLS);
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="products-toss-grid"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {rowItems.map(({ product, stockCount }) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  brandInfo={brandMap[product.brandCode]}
                  quantity={quantities[product.id] || 0}
                  onQuantityChange={(q) => handleQuantityChange(product.id, q)}
                  onNavigate={() => navigate(`/voucher-types/${product.brandCode}`)}
                  stockCount={stockCount}
                />
            ))}
          </div>
        );
      })}
    </div>
  );
});
VirtualizedProductGrid.displayName = 'VirtualizedProductGrid';

const BuyModeView = memo(({
  buyBrands,
  selectedBrands,
  toggleBrand,
  clearBrands,
  productCounts,
  loading,
  brandsLoading,
  groupedProducts,
  brandMap,
  quantities,
  handleQuantityChange,
  navigate
}: {
  buyBrands: Brand[],
  selectedBrands: string[],
  toggleBrand: (c: string) => void,
  clearBrands: () => void,
  productCounts: Record<string, number>,
  loading: boolean,
  brandsLoading: boolean,
  groupedProducts: { product: Product; stockCount: number }[],
  brandMap: Record<string, Brand>,
  quantities: Record<number, number>,
  handleQuantityChange: (id: number, q: number) => void,
  navigate: NavigateFunction
}) => (
  <div className="page-container">
    <SEO title="상품권 구매" description="백화점 상품권을 최저가에 구매하세요" />
    <div className="page-content">

      <PageHeader title="상품권 구매" subtitle="원하는 브랜드와 금액을 선택하세요" />

      {/* Brand Filter */}
      <FadeIn direction="up" distance={15} delay={0.05}>
        <div className="products-toss-filter">
          <BrandFilterChips
            brands={buyBrands}
            selectedCodes={selectedBrands}
            onToggle={toggleBrand}
            onSelectAll={clearBrands}
            productCounts={productCounts}
          />
        </div>
      </FadeIn>

      {/* Product Grid */}
      {loading || brandsLoading ? (
        <div className="products-toss-grid">
          {Array.from({length: 8}).map((_, i) => (
            <div key={i} className="product-card-toss product-card-toss--skeleton">
              <div className="product-card-toss__image-area">
                <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 16 }} />
              </div>
              <div className="product-card-toss__info">
                <div className="skeleton" style={{ width: '40%', height: 12, borderRadius: 6 }} />
                <div className="skeleton" style={{ width: '60%', height: 20, borderRadius: 6 }} />
              </div>
              <div className="product-card-toss__action">
                <div className="skeleton" style={{ width: '100%', height: 36, borderRadius: 12 }} />
              </div>
            </div>
          ))}
        </div>
      ) : groupedProducts.length === 0 ? (
        <Result icon="info" title="검색 결과가 없습니다" description="필터를 초기화하거나 다른 브랜드를 선택해보세요" />
      ) : (
        <VirtualizedProductGrid
          items={groupedProducts}
          brandMap={brandMap}
          quantities={quantities}
          handleQuantityChange={handleQuantityChange}
          navigate={navigate}
        />
      )}
    </div>
  </div>
));
BuyModeView.displayName = 'BuyModeView';



// ============================================================
// Main Component
// ============================================================

const ProductListPage: React.FC<{ mode?: 'buy' | 'sell' }> = ({ mode = 'buy' }) => {
  const {
    selectedBrandParam,
    clearBrand,
    selectedBrands,
    toggleBrand,
    clearBrands,
    brandsLoading,
    navigate,
    isAuthenticated,
    loading,
    showGiftModal,
    setShowGiftModal,
    quantities,
    currentBrand,
    groupedProducts,
    sellProducts,
    brandPriceRanges,
    sellBrands,
    buyBrands,
    productCounts,
    brandMap,
    selectedCount,
    totalPrice,
    discountAmount,
    handleQuantityChange,
    handleAddToCart,
    handleBuyNow,
    handleGiftClick,
    handleGiftConfirm,
  } = useProductListPage(mode);

  return (
    <>
      {mode === 'sell' ? (
        <SellModeView 
          selectedBrandParam={selectedBrandParam} 
          currentBrand={currentBrand} 
          sellProducts={sellProducts} 
          sellBrands={sellBrands} 
          clearBrand={clearBrand} 
          navigate={navigate} 
          isAuthenticated={isAuthenticated} 
          loading={loading} 
          brandsLoading={brandsLoading} 
          brandPriceRanges={brandPriceRanges} 
        />
      ) : (
        <BuyModeView 
          buyBrands={buyBrands} 
          selectedBrands={selectedBrands} 
          toggleBrand={toggleBrand} 
          clearBrands={clearBrands} 
          productCounts={productCounts} 
          loading={loading} 
          brandsLoading={brandsLoading} 
          groupedProducts={groupedProducts} 
          brandMap={brandMap} 
          quantities={quantities} 
          handleQuantityChange={handleQuantityChange} 
          navigate={navigate} 
        />
      )}

      {selectedCount > 0 && (
        <FixedBottomCTA.Double
          topAccessory={
            <div className="cta-summary-toss">
              <div className="cta-summary-toss__left">
                <span className="cta-summary-toss__count">{selectedCount}개 선택</span>
                {discountAmount > 0 && (
                  <span className="cta-summary-toss__discount">
                    {formatPrice(discountAmount)} 할인
                  </span>
                )}
                <button type="button" onClick={handleGiftClick} className="cta-summary-toss__gift-link">
                  선물하기
                </button>
              </div>
              <span className="cta-summary-toss__total">{formatPrice(totalPrice)}</span>
            </div>
          }
          leftButton={
            <Button variant="secondary" onClick={handleAddToCart}>
              장바구니 담기
            </Button>
          }
          rightButton={
            <Button variant="primary" onClick={handleBuyNow} className="shadow-primary">
              바로 구매
            </Button>
          }
        />
      )}

      <GiftTargetModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        onConfirm={handleGiftConfirm}
        itemCount={selectedCount}
        totalAmount={totalPrice}
      />
    </>
  );
};

// ============================================================
// Internal Helper Components
// ============================================================

interface BrandCardProps {
  displayName: string;
  color?: string;
  description?: string;
  image?: string;
  productCount: number;
  priceRange?: { min: number; max: number };
  onClick: () => void;
  isSellMode?: boolean;
  maxDiscount?: number;
}

const BrandCard = memo(function BrandCard({ displayName, color, image, productCount, priceRange, onClick, isSellMode }: BrandCardProps) {
  const brandColor = color || 'var(--color-primary)';
  return (
    <button type="button" onClick={onClick} className="brand-card-toss">
      {/* 브랜드 이미지 영역 */}
      <div className="brand-card-toss__visual" style={{ background: `linear-gradient(160deg, color-mix(in oklch, ${brandColor} 6%, white), color-mix(in oklch, ${brandColor} 12%, var(--color-grey-50)))` }}>
        {image ? (
          <img src={image} alt={displayName} loading="lazy" decoding="async" className="brand-card-toss__image" />
        ) : (
          <span className="brand-card-toss__image-fallback" style={{ color: brandColor }}>
            {displayName.charAt(0)}
          </span>
        )}
      </div>

      {/* 정보 영역 */}
      <div className="brand-card-toss__body">
        <span className="brand-card-toss__name">{displayName}</span>
        <span className="brand-card-toss__count">{productCount}개 권종</span>
        {priceRange && (
          <span className="brand-card-toss__price tabular-nums">
            {formatPrice(priceRange.min, false)}
            {priceRange.min !== priceRange.max ? ` ~ ${formatPrice(priceRange.max, false)}` : ''}원
          </span>
        )}
        <span className="brand-card-toss__cta">
          {isSellMode ? '판매하기' : '구매하기'} →
        </span>
      </div>
    </button>
  );
});
BrandCard.displayName = 'BrandCard';

interface ProductTableRowProps {
  product: Product;
  brandInfo?: Brand | null;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onNavigate?: () => void;
  stockCount?: number;
}

const ProductCard = memo(function ProductCard({ product, brandInfo, quantity, onQuantityChange, onNavigate, stockCount = 1 }: ProductTableRowProps) {
  const faceValue = Number(product.price) || 0;
  const userBuyPrice = Number(product.buyPrice) || 0;
  const imageUrl = product.imageUrl || brandInfo?.imageUrl || getProductImage(product.brandCode, faceValue);
  const isSelected = quantity > 0;
  const discountRate = Number(product.discountRate) || 0;
  const brandName = brandInfo?.name || product.brandCode;
  const savingsAmount = faceValue - userBuyPrice;

  return (
    <div className={`product-card-toss ${isSelected ? 'product-card-toss--selected' : ''}`}>
      {/* 상품 이미지 영역 */}
      <button type="button" onClick={onNavigate} className="product-card-toss__image-area">
        {imageUrl ? (
          <img src={imageUrl} alt={`${brandName} ${formatPrice(faceValue, false)}원`} className="product-card-toss__image" loading="lazy" decoding="async" width={120} height={120} />
        ) : (
          <div className="product-card-toss__image-placeholder" style={{ color: brandInfo?.color || 'var(--color-primary)' }}>
            {product.brandCode.charAt(0)}
          </div>
        )}
        {discountRate > 0 && (
          <span className="product-card-toss__discount-badge">{discountRate}%</span>
        )}
      </button>

      {/* 상품 정보 */}
      <div className="product-card-toss__info">
        <span className="product-card-toss__brand">{brandName}</span>
        <div className="product-card-toss__face">
          <span className="product-card-toss__face-value tabular-nums">{formatPrice(faceValue, false)}<small>원</small></span>
        </div>
        <div className="product-card-toss__price-section">
          <span className="product-card-toss__buy-price tabular-nums">{formatPrice(userBuyPrice)}</span>
          {savingsAmount > 0 && (
            <span className="product-card-toss__savings tabular-nums">{formatPrice(savingsAmount, false)}원 절약</span>
          )}
        </div>
      </div>

      {/* 수량 선택 */}
      <div className="product-card-toss__action">
        <NumericSpinner
          number={quantity}
          onNumberChange={onQuantityChange}
          minNumber={0}
          maxNumber={stockCount}
          size="sm"
        />
        {isSelected && (
          <div className="product-card-toss__subtotal tabular-nums">
            {formatPrice(userBuyPrice * quantity)}
          </div>
        )}
      </div>
    </div>
  );
});
ProductCard.displayName = 'ProductCard';


export default ProductListPage;
