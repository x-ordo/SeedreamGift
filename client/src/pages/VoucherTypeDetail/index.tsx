/**
 * @file VoucherTypeDetail/index.tsx
 * @description 상품권 종류별 상세 페이지 - 브랜드 정보 + 금액권 선택/구매/선물
 * @module pages
 * @route /voucher-types/:id
 *
 * 레이아웃:
 * - 데스크탑 (>=768px): 2열 (좌: 헤더+상세탭, 우: 금액선택+요약+CTA)
 * - 모바일 (<768px): 1열 (헤더+탭) + 하단 고정 CTA + BottomSheet
 */
import '../Product/ProductList.css';
import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, Gift, ChevronRight } from 'lucide-react';
import SEO from '../../components/common/SEO';
import { motion } from 'motion/react';
import { Skeleton, Button, NumericSpinner, Badge, Result, ListHeader, BottomSheet, Border, FadeIn, Stagger } from '../../design-system';
import { FixedBottomCTA, CTAButton } from '../../design-system/molecules/BottomCTA';
import { formatPrice } from '../../utils';
import { normalizeVoucherType, getProductImage, getVoucherTypeDefaultImage } from '../../constants/voucherTypes';
import { useCart, useIsMobile, useProducts, useBrands } from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { COLORS } from '../../constants/designTokens';
import { GiftTargetModal } from '../../components/gift/GiftTargetModal';
import { DenominationList } from './DenominationList';
import { PaymentSummary } from './PaymentSummary';
import { ProductDetailsTabs } from './ProductDetailsTabs';

export default function VoucherTypeDetailPage() {
  const { id: voucherType } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { addToCart, buyNow } = useCart();
  const { isAuthenticated } = useAuth();
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const isMobile = useIsMobile();

  const { data: allProducts = [], isLoading: productsLoading } = useProducts();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAction, setSheetAction] = useState<'gift' | 'buy'>('buy');
  const [actionLoading, setActionLoading] = useState(false);

  const decodedVoucherType = voucherType ? decodeURIComponent(voucherType) : '';
  const loading = productsLoading;

  // Find brand by code or name
  const brandInfo = useMemo(() => {
    return brands.find(b => b.code === decodedVoucherType || b.name === decodedVoucherType);
  }, [brands, decodedVoucherType]);

  const voucherTypeInfo = useMemo(() => {
    if (brandInfo) {
      return {
        displayName: brandInfo.name,
        color: brandInfo.color || COLORS.primary,
        description: brandInfo.description || '',
        emoji: '🎁',
        image: brandInfo.imageUrl
      };
    }
    return {
      displayName: decodedVoucherType,
      color: COLORS.primary,
      description: '',
      emoji: '🎁'
    };
  }, [brandInfo, decodedVoucherType]);

  // Filter and sort products for this brand
  const products = useMemo(() => {
    if (!decodedVoucherType) return [];
    return allProducts
      .filter((p) => {
        const normalizedBrand = normalizeVoucherType(p.brandCode);
        return normalizedBrand === decodedVoucherType || (brandInfo && p.brandCode === brandInfo.code);
      })
      .sort((a, b) => Number(a.price) - Number(b.price));
  }, [allProducts, decodedVoucherType, brandInfo]);

  // 가격별 중복 제거
  const uniqueProducts = useMemo(() => {
    const seenPrices = new Set<number>();
    return products.filter((product) => {
      const price = Number(product.price);
      if (seenPrices.has(price)) return false;
      seenPrices.add(price);
      return true;
    });
  }, [products]);

  // 대표 이미지
  const productImage = useMemo(() => {
    if (voucherTypeInfo.image) return voucherTypeInfo.image;
    const firstProduct = uniqueProducts[0];
    if (!firstProduct) return getVoucherTypeDefaultImage(decodedVoucherType);
    return getProductImage(decodedVoucherType, Number(firstProduct.price)) || getVoucherTypeDefaultImage(decodedVoucherType);
  }, [uniqueProducts, decodedVoucherType, voucherTypeInfo.image]);

  // 최대 할인율
  const maxDiscount = useMemo(() => {
    return Math.max(...uniqueProducts.map(p => p.discountRate), 0);
  }, [uniqueProducts]);

  // 총 결제금액
  const totalPrice = useMemo(() => {
    return uniqueProducts.reduce((sum, product) => {
      const qty = quantities[product.id] || 0;
      return sum + ((Number(product.buyPrice) || 0) * qty);
    }, 0);
  }, [uniqueProducts, quantities]);

  // 선택된 수량
  const selectedCount = useMemo(() => {
    return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  }, [quantities]);

  // 총 액면가
  const totalFaceValue = useMemo(() => {
    return uniqueProducts.reduce((sum, product) => {
      const qty = quantities[product.id] || 0;
      return sum + ((Number(product.price) || 0) * qty);
    }, 0);
  }, [uniqueProducts, quantities]);

  // 할인 금액
  const discountAmount = totalFaceValue - totalPrice;

  const handleQuantityChange = (productId: number, newQuantity: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: newQuantity }));
  };

  const handleAddToCart = () => {
    if (actionLoading) return;
    const itemsToAdd = uniqueProducts.filter((p) => (quantities[p.id] || 0) > 0);
    if (itemsToAdd.length === 0) {
      showToast({ message: '수량을 선택해주세요', type: 'info' });
      return;
    }
    setActionLoading(true);
    const totalQty = itemsToAdd.reduce((sum, p) => sum + quantities[p.id], 0);
    itemsToAdd.forEach((product, index) => {
      const isLast = index === itemsToAdd.length - 1;
      addToCart(product, quantities[product.id], { showFeedback: isLast });
    });
    if (itemsToAdd.length > 1) {
      showToast({
        message: `${voucherTypeInfo.displayName} 상품권 ${totalQty}개를 장바구니에 담았어요`,
        type: 'success',
        action: {
          label: '보러가기',
          onClick: () => navigate('/cart'),
        },
      });
    }
    setTimeout(() => setActionLoading(false), 1000);
  };

  const handleBuyNow = () => {
    if (actionLoading) return;
    const itemsToAdd = uniqueProducts.filter((p) => (quantities[p.id] || 0) > 0);
    if (itemsToAdd.length === 0) {
      showToast({ message: '수량을 선택해주세요', type: 'info' });
      return;
    }
    setActionLoading(true);
    buyNow(itemsToAdd.map(product => ({ product, quantity: quantities[product.id] })));
  };

  const handleGiftClick = () => {
    if (actionLoading) return;
    if (!isAuthenticated) {
      showToast({ message: '로그인 후 이용해주세요', type: 'info' });
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    const itemsToAdd = uniqueProducts.filter((p) => (quantities[p.id] || 0) > 0);
    if (itemsToAdd.length === 0) {
      showToast({ message: '수량을 선택해주세요', type: 'info' });
      return;
    }
    setShowGiftModal(true);
  };

  const handleGiftConfirm = (receiver: { email: string; name: string; message: string }) => {
    const itemsToAdd = uniqueProducts.filter((p) => (quantities[p.id] || 0) > 0);
    itemsToAdd.forEach((product) => {
      addToCart(product, quantities[product.id], { showFeedback: false, requireAuth: true });
    });
    navigate('/checkout', { state: { giftTarget: receiver } });
  };

  // 모바일 CTA 핸들러
  const handleMobileGift = () => { setSheetAction('gift'); setSheetOpen(true); };
  const handleMobileBuy = () => { setSheetAction('buy'); setSheetOpen(true); };

  // BottomSheet 내부 확인 핸들러
  const handleSheetConfirm = () => {
    setSheetOpen(false);
    if (sheetAction === 'gift') handleGiftClick();
    else handleBuyNow();
  };

  if (loading || brandsLoading) {
    return (
      <div className="page-container">
        <div className="voucher-type-detail-page">
          <div className="vt-header-skeleton">
            <Skeleton width={120} height={120} style={{ borderRadius: 'var(--radius-lg)' }} />
            <div className="vt-header-skeleton-text">
              <Skeleton width="40%" height={16} />
              <Skeleton width="70%" height={28} />
              <Skeleton width="50%" height={16} />
            </div>
          </div>
          <Skeleton width="100%" height={300} style={{ borderRadius: 'var(--radius-lg)', marginTop: 'var(--space-4)' }} />
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="page-container">
        <div className="voucher-type-detail-page">
          <Result
            icon="info"
            title="현재 판매 중인 상품이 없습니다"
            description="다른 브랜드를 선택하거나 나중에 다시 확인해주세요."
            button={<Button variant="secondary" onClick={() => navigate('/products')}>다른 상품 보기</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <SEO
        title={`${voucherTypeInfo.displayName} 상품권`}
        description={`${voucherTypeInfo.displayName} 상품권을 최저가에 구매하세요. ${voucherTypeInfo.description || ''}`}
      />
      <div className="voucher-type-detail-page">
        <nav className="flex items-center gap-1 text-xs text-base-content/50 mb-2" aria-label="현재 위치">
          <Link to="/" className="hover:text-primary">홈</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <Link to="/products" className="hover:text-primary">상품권</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span className="text-base-content/80 font-medium">{voucherTypeInfo?.displayName || voucherType}</span>
        </nav>
        <div className="vt-layout">

          {/* 왼쪽 열 (공통: 헤더 + 탭) */}
          <div className="vt-left-column">
            <FadeIn direction="up" distance={20}>
              <section className="vt-header">
                <div className="vt-header-image">
                  {productImage ? (
                    <img src={productImage} alt={`${voucherTypeInfo.displayName} 상품권`} width={120} height={120} loading="lazy" decoding="async" />
                  ) : (
                    <div className="vt-header-placeholder" style={{ color: voucherTypeInfo.color }}>
                      {voucherTypeInfo.displayName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="vt-header-info">
                  <div className="vt-header-badges">
                    <Badge color="blue" size="sm" variant="weak">모바일 상품권</Badge>
                    {maxDiscount > 0 && (
                      <Badge color="red" size="sm" variant="fill">최대 {Math.round(maxDiscount)}% 할인</Badge>
                    )}
                  </div>
                  <h1 className="vt-header-title">{voucherTypeInfo.displayName} 상품권</h1>
                  <p className="vt-header-desc">{voucherTypeInfo.description}</p>
                </div>
              </section>
            </FadeIn>

            <Border variant="height16" spacing="medium" />

            <ProductDetailsTabs voucherType={decodedVoucherType} voucherTypeInfo={voucherTypeInfo} products={uniqueProducts} maxDiscount={maxDiscount} />
          </div>

          {/* 오른쪽 열 (데스크탑 only) */}
          <div className="vt-right-column">
            <section className="vt-selection">
              <ListHeader
                title={
                  <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                    금액 선택
                  </ListHeader.TitleParagraph>
                }
                description={
                  <ListHeader.DescriptionParagraph>
                    원하는 금액과 수량을 선택하세요
                  </ListHeader.DescriptionParagraph>
                }
                descriptionPosition="bottom"
              />

              <Stagger className="vt-denomination-list" staggerDelay={0.05} direction="up" distance={15}>
                {uniqueProducts.map((product) => {
                  const qty = quantities[product.id] || 0;
                  const isSelected = qty > 0;
                  return (
                    <motion.div
                      key={product.id}
                      className={`vt-denomination-item ${isSelected ? 'selected' : ''}`}
                      layout
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="vt-denom-left">
                        {product.discountRate > 0 ? (
                          <>
                            <span className="vt-denom-face">{formatPrice(Number(product.price))}</span>
                            <div className="vt-denom-price-row">
                              <span className="vt-denom-buy">{formatPrice(Number(product.buyPrice))}</span>
                              <Badge color="red" size="md" variant="weak">{product.discountRate}%</Badge>
                            </div>
                          </>
                        ) : (
                          <span className="vt-denom-buy">{formatPrice(Number(product.price))}</span>
                        )}
                      </div>
                      <div className="vt-denom-right">
                        <NumericSpinner
                          number={qty}
                          onNumberChange={(newQty) => handleQuantityChange(product.id, newQty)}
                          minNumber={0}
                          maxNumber={99}
                          size="md"
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </Stagger>
            </section>

            <section className="vt-summary">
              <PaymentSummary
                selectedCount={selectedCount}
                totalFaceValue={totalFaceValue}
                discountAmount={discountAmount}
                totalPrice={totalPrice}
              />
              <div className="vt-cta-buttons">
                <Button variant="secondary" size="lg" onClick={handleAddToCart} disabled={selectedCount === 0 || actionLoading} leftIcon={<ShoppingCart size={16} />}>
                  장바구니
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleGiftClick}
                  disabled={selectedCount === 0 || actionLoading}
                  className="btn-gift"
                  leftIcon={<Gift size={16} />}
                >
                  선물하기
                </Button>
                <Button variant="cta" size="lg" onClick={handleBuyNow} disabled={selectedCount === 0 || actionLoading}>
                  바로 구매
                </Button>
              </div>
            </section>
          </div>
        </div>

        {/* 모바일: 하단 고정 CTA */}
        {isMobile && (
          <FixedBottomCTA.Double
            leftButton={
              <CTAButton variant="secondary" onClick={handleMobileGift}>
                <Gift size={16} className="mr-2" aria-hidden="true" />
                선물하기
              </CTAButton>
            }
            rightButton={
              <CTAButton variant="cta" onClick={handleMobileBuy}>
                <ShoppingBag size={16} className="mr-2" aria-hidden="true" />
                바로 구매
              </CTAButton>
            }
          />
        )}

        {/* 모바일: BottomSheet */}
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          header={<BottomSheet.Header>금액 선택</BottomSheet.Header>}
          headerDescription={<BottomSheet.HeaderDescription>원하는 금액과 수량을 선택하세요</BottomSheet.HeaderDescription>}
          cta={
            <BottomSheet.DoubleCTA
              leftButton={
                <Button variant="secondary" size="lg" fullWidth onClick={handleAddToCart} disabled={selectedCount === 0 || actionLoading} leftIcon={<ShoppingCart size={16} />}>
                  장바구니
                </Button>
              }
              rightButton={
                <Button
                  variant={sheetAction === 'gift' ? 'secondary' : 'cta'}
                  size="lg"
                  fullWidth
                  onClick={handleSheetConfirm}
                  disabled={selectedCount === 0 || actionLoading}
                  className={sheetAction === 'gift' ? 'btn-gift' : undefined}
                >
                  {sheetAction === 'gift' ? '선물하기' : '바로 구매'}
                </Button>
              }
            />
          }
        >
          <DenominationList products={uniqueProducts} quantities={quantities} onQuantityChange={handleQuantityChange} />
          <PaymentSummary selectedCount={selectedCount} totalFaceValue={totalFaceValue} discountAmount={discountAmount} totalPrice={totalPrice} />
        </BottomSheet>

        <GiftTargetModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          onConfirm={handleGiftConfirm}
          itemCount={selectedCount}
          totalAmount={totalPrice}
        />
      </div>
    </div>
  );
}
