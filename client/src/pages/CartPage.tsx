import './Cart.css';
import React, { memo } from 'react';
import { ShoppingBag, X, Gift, Shield } from 'lucide-react';
import SEO from '../components/common/SEO';
import { Button, NumericSpinner, FixedBottomCTA, FadeIn, Checkbox, Badge, Modal } from '../design-system';
import { formatPrice, handleImageError, getValidImageUrl } from '../utils';
import { BRAND_NAMES } from '../constants/brandTheme';
import { GiftTargetModal } from '../components/gift/GiftTargetModal';
import { useCartPage } from './CartPage.hooks';
import { CartItem } from '../types';

// ============================================================
// Sub-components
// ============================================================

/**
 * 장바구니가 비어있을 때 표시되는 뷰 컴포넌트입니다.
 * 사용자를 상품 목록 페이지로 유도하는 콜 투 액션(CTA)을 포함합니다.
 */
const EmptyCartView = memo(({ onNavigate }: { onNavigate: (path: string) => void }) => (
  <div className="page-container">
    <SEO title="장바구니" description="장바구니가 비어있습니다" />
    <div className="cart-toss-empty">
      <FadeIn direction="up" distance={24}>
        <div className="cart-toss-empty__icon">
          <ShoppingBag size={32} strokeWidth={1.5} />
        </div>
        <h2 className="cart-toss-empty__title">장바구니가 비어있어요</h2>
        <p className="cart-toss-empty__desc">원하는 상품권을 담아보세요</p>
        <Button
          variant="primary"
          size="lg"
          onClick={() => onNavigate('/products')}
          style={{ minWidth: 180, borderRadius: 14 }}
        >
          상품권 둘러보기
        </Button>
      </FadeIn>
    </div>
  </div>
));
EmptyCartView.displayName = 'EmptyCartView';

/**
 * 장바구니 상단 툴바 컴포넌트입니다.
 * 전체 선택/해제 및 선택된 항목의 일괄 삭제 기능을 제공합니다.
 */
const CartToolbar = memo(({
  isAllSelected,
  onToggleAll,
  selectedCount,
  totalCount,
  onDeleteSelected,
  isDeleting
}: {
  isAllSelected: boolean,
  onToggleAll: () => void,
  selectedCount: number,
  totalCount: number,
  onDeleteSelected: () => void,
  isDeleting: boolean
}) => (
  <div className="cart-toss-toolbar">
    <Checkbox
      id="select-all"
      checked={isAllSelected}
      onChange={onToggleAll}
      label={
        <span className="cart-toss-toolbar__label">
          전체선택 <span className="cart-toss-toolbar__count">{selectedCount}/{totalCount}</span>
        </span>
      }
    />
    {selectedCount > 0 && (
      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={isDeleting}
        className="cart-toss-toolbar__delete"
      >
        선택 삭제
      </button>
    )}
  </div>
));
CartToolbar.displayName = 'CartToolbar';

/**
 * 개별 장바구니 품목을 표시하는 카드 컴포넌트입니다.
 * 품절 상태 처리, 수량 조절, 항목 삭제, 선택 상태 관리 로직을 포함합니다.
 * React.memo를 통해 장바구니 리스트 갱신 시 불필요한 리렌더링을 방지합니다.
 */
const CartItemCard = memo(({
  item,
  isSelected,
  onToggle,
  onRemove,
  onQuantityChange,
  isDeleting
}: {
  item: CartItem,
  isSelected: boolean,
  onToggle: () => void,
  onRemove: (id: number, name: string) => void,
  onQuantityChange: (id: number, qty: number) => void,
  isDeleting: boolean
}) => {
  const brandName = BRAND_NAMES[item.brandCode as keyof typeof BRAND_NAMES] || item.brandCode;
  const buyPrice = Number(item.buyPrice) || 0;
  const faceValue = Number(item.price) || 0;
  const subtotal = buyPrice * item.quantity;
  const isSoldOut = item.availableStock === 0;

  return (
    <div
      className={`cart-toss-item ${isSelected ? 'cart-toss-item--selected' : ''} ${isSoldOut ? 'cart-toss-item--soldout' : ''}`}
      style={isDeleting && isSelected ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      {/* 상단: 체크박스 + 브랜드 + 삭제 */}
      <div className="cart-toss-item__top">
        <div className="cart-toss-item__check">
          <Checkbox id={`item-${item.id}`} checked={isSelected} onChange={onToggle} />
        </div>
        <span className="cart-toss-item__brand">{brandName}</span>
        {isSoldOut && <Badge variant="error" size="sm" font="bold">품절</Badge>}
        <button
          type="button"
          className="cart-toss-item__remove"
          onClick={() => onRemove(item.id, item.name)}
          aria-label={`${item.name} 삭제`}
        >
          <X size={18} />
        </button>
      </div>

      {/* 중단: 이미지 + 상품정보 */}
      <div className="cart-toss-item__body">
        <div className="cart-toss-item__image">
          <img
            src={getValidImageUrl(item.imageUrl)}
            alt={item.name}
            onError={handleImageError}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="cart-toss-item__info">
          <h3 className="cart-toss-item__name">{item.name}</h3>
          <div className="cart-toss-item__price-row">
            <span className="cart-toss-item__price">{formatPrice(buyPrice)}</span>
            {item.discountRate > 0 && (
              <span className="cart-toss-item__original">{formatPrice(faceValue)}</span>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 수량 + 소계 */}
      <div className="cart-toss-item__bottom">
        {isSoldOut ? (
          <span className="cart-toss-item__soldout-text">재입고 시 알려드릴게요</span>
        ) : (
          <>
            <NumericSpinner
              number={item.quantity}
              onNumberChange={(qty) => onQuantityChange(item.id, qty)}
              minNumber={1}
              maxNumber={item.availableStock ?? 99}
              size="sm"
            />
            <span className="cart-toss-item__subtotal">{formatPrice(subtotal)}</span>
          </>
        )}
      </div>
    </div>
  );
});
CartItemCard.displayName = 'CartItemCard';

/**
 * 데스크탑 환경에서 우측에 고정되는 결제 요약 패널입니다.
 * 총 상품 금액, 할인 금액, 최종 결제 금액을 계산하여 보여주며 주문/선물하기 진입점을 제공합니다.
 */
const CartSummaryPanel = memo(({
  totalOriginalPrice,
  totalDiscount,
  totalPrice,
  selectedCount,
  onCheckout,
  onGift,
  disabled
}: {
  totalOriginalPrice: number,
  totalDiscount: number,
  totalPrice: number,
  selectedCount: number,
  onCheckout: () => void,
  onGift: () => void,
  disabled: boolean
}) => (
  <div className="cart-toss-summary">
    <h3 className="cart-toss-summary__title">결제 정보</h3>

    <div className="cart-toss-summary__rows">
      <div className="cart-toss-summary__row">
        <span>상품 금액</span>
        <span>{formatPrice(totalOriginalPrice)}</span>
      </div>
      {totalDiscount > 0 && (
        <div className="cart-toss-summary__row cart-toss-summary__row--discount">
          <span>할인</span>
          <span>-{formatPrice(totalDiscount)}</span>
        </div>
      )}
    </div>

    <div className="cart-toss-summary__total-row">
      <span>총 결제금액</span>
      <span className="cart-toss-summary__total-price">{formatPrice(totalPrice)}</span>
    </div>

    <div className="cart-toss-summary__actions">
      <Button variant="primary" size="lg" fullWidth onClick={onCheckout} disabled={disabled}>
        {selectedCount > 0 ? `${selectedCount}개 주문하기` : '주문하기'}
      </Button>
      <Button variant="secondary" size="lg" fullWidth onClick={onGift} disabled={disabled} leftIcon={<Gift size={16} />}>
        선물하기
      </Button>
    </div>

    <div className="cart-toss-summary__notice">
      <p>결제 완료 즉시 PIN 번호가 발급됩니다</p>
      <p>상품권 특성상 발급 후 취소 불가</p>
    </div>

    <div className="cart-toss-summary__secure">
      <Shield size={12} />
      <span>SSL 암호화 보호</span>
    </div>
  </div>
));
CartSummaryPanel.displayName = 'CartSummaryPanel';

/**
 * 모바일 환경에서 하단에 고정되는 결제 요약 및 액션 바입니다.
 * 화면 공간을 효율적으로 사용하기 위해 축약된 정보와 핵심 버튼을 제공합니다.
 */
const CartMobileFooter = memo(({
  totalPrice,
  purchasableCount,
  onCheckout,
  onGift,
  disabled
}: {
  totalPrice: number,
  purchasableCount: number,
  onCheckout: () => void,
  onGift: () => void,
  disabled: boolean
}) => (
  <FixedBottomCTA.Double
    topAccessory={
      <div className="cart-toss-mobile-summary">
        <div className="cart-toss-mobile-summary__left">
          <span className="cart-toss-mobile-summary__label">결제금액</span>
          <span className="cart-toss-mobile-summary__count">{purchasableCount}개</span>
        </div>
        <span className="cart-toss-mobile-summary__price">{formatPrice(totalPrice)}</span>
      </div>
    }
    leftButton={
      <Button variant="secondary" size="lg" onClick={onGift} disabled={disabled}>
        선물
      </Button>
    }
    rightButton={
      <Button variant="primary" size="lg" onClick={onCheckout} disabled={disabled}>
        주문하기
      </Button>
    }
  />
));
CartMobileFooter.displayName = 'CartMobileFooter';

// ============================================================
// Main Component
// ============================================================

/**
 * 장바구니 페이지 메인 컴포넌트입니다.
 * 
 * 주요 설계 포인트:
 * 1. 로직 관심사 분리: `useCartPage` 커스텀 훅을 통해 장바구니 비즈니스 로직(CRUD, 계산, 모달 상태 등)을 분리하여 UI 복잡도를 낮췄습니다.
 * 2. 조건부 렌더링: 장바구니가 비었을 때와 상품이 있을 때를 구분하여 최적의 사용자 경험을 제공합니다.
 * 3. 반응형 레이아웃: 데스크탑에서는 사이드바 형태의 요약을, 모바일에서는 하단 고정 바(CTA)를 사용하여 접근성을 높였습니다.
 * 4. 일괄 처리: 여러 항목을 선택하여 한꺼번에 삭제하거나 결제할 수 있는 상태 관리 로직(selectedIds)을 포함합니다.
 */
const CartPage: React.FC = () => {
  const {
    items,
    isMobile,
    isDeletingBatch,
    showGiftModal,
    setShowGiftModal,
    showDeleteConfirm,
    setShowDeleteConfirm,
    selectedIds,
    isAllSelected,
    purchasableItems,
    totalOriginalPrice,
    totalDiscount,
    totalPrice,
    handleToggleAll,
    handleToggleItem,
    handleDeleteSelected,
    handleConfirmDelete,
    handleQuantitySet,
    handleRemoveItem,
    handleCheckout,
    handleGiftClick,
    handleGiftConfirm,
    navigate,
  } = useCartPage();

  if (items.length === 0) {
    return <EmptyCartView onNavigate={navigate} />;
  }

  return (
    <div className="page-container">
      <SEO title="장바구니" description="장바구니에 담긴 상품권을 확인하세요" />
      <div className="cart-toss-container">
        {/* Header */}
        <FadeIn direction="up" distance={16}>
          <h1 className="cart-toss-title">장바구니</h1>
        </FadeIn>

        <div className="cart-toss-layout">
          {/* 좌측: 상품 목록 */}
          <div className="cart-toss-left">
            <CartToolbar
              isAllSelected={isAllSelected}
              onToggleAll={handleToggleAll}
              selectedCount={selectedIds.size}
              totalCount={items.length}
              onDeleteSelected={handleDeleteSelected}
              isDeleting={isDeletingBatch}
            />

            <section className="cart-toss-items">
              {items.map((item, index) => (
                <FadeIn key={item.id} direction="up" distance={12} delay={0.03 + index * 0.02}>
                  <CartItemCard
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    onToggle={() => handleToggleItem(item.id)}
                    onRemove={handleRemoveItem}
                    onQuantityChange={handleQuantitySet}
                    isDeleting={isDeletingBatch}
                  />
                </FadeIn>
              ))}
            </section>
          </div>

          {/* 우측: 결제 요약 (데스크탑) */}
          <div className="cart-toss-right">
            <CartSummaryPanel
              totalOriginalPrice={totalOriginalPrice}
              totalDiscount={totalDiscount}
              totalPrice={totalPrice}
              selectedCount={purchasableItems.length}
              onCheckout={handleCheckout}
              onGift={handleGiftClick}
              disabled={purchasableItems.length === 0}
            />
          </div>
        </div>
      </div>

      {/* 모바일 하단 CTA */}
      {isMobile && selectedIds.size > 0 && (
        <CartMobileFooter
          totalPrice={totalPrice}
          purchasableCount={purchasableItems.length}
          onCheckout={handleCheckout}
          onGift={handleGiftClick}
          disabled={purchasableItems.length === 0}
        />
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="선택 삭제"
        size="small"
        footer={
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button variant="secondary" fullWidth onClick={() => setShowDeleteConfirm(false)}>취소</Button>
            <Button variant="danger" fullWidth onClick={handleConfirmDelete} isLoading={isDeletingBatch}>삭제</Button>
          </div>
        }
      >
        <div className="text-center py-2">
          <p className="text-sm font-bold text-base-content mb-1">
            {selectedIds.size}개 상품을 삭제할까요?
          </p>
          <p className="text-xs text-base-content/50">삭제된 상품은 다시 담아야 합니다</p>
        </div>
      </Modal>

      {/* 선물하기 모달 */}
      <GiftTargetModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        onConfirm={handleGiftConfirm}
        itemCount={purchasableItems.length}
        totalAmount={totalPrice}
      />
    </div>
  );
};

export default CartPage;

