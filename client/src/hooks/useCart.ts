/**
 * @file useCart.ts
 * @description 장바구니 액션 훅 - 상태 변경 + 피드백(Toast) 통합
 * @module hooks
 *
 * 설계 원칙:
 * - 컴포넌트는 "무엇(What)을 보여줄지만" 담당
 * - 이 훅이 "어떻게(How) 장바구니에 담기는지" 담당
 * - deps 최소화: 컴포넌트에서는 단일 함수만 호출
 *
 * 사용법:
 * const { addToCart, removeFromCart, updateQuantity } = useCart();
 * addToCart(product, 2); // Toast 알림 자동 표시
 */
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useCartStore } from '../store/useCartStore';
import { useCheckoutStore } from '../store/useCheckoutStore';
import type { CheckoutItem } from '../store/useCheckoutStore';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { cartApi } from '../api';
import type { Product } from '../types';

/**
 * 장바구니 액션 결과 타입
 */
interface CartActionResult {
  success: boolean;
  message?: string;
}

/**
 * 장바구니 액션 옵션
 */
interface AddToCartOptions {
  /** Toast 메시지 표시 여부 (기본: true) */
  showFeedback?: boolean;
  /** 담은 후 수량 리셋 콜백 */
  onSuccess?: () => void;
  /** 비로그인 시 로그인 페이지 이동 여부 (기본: false — 장바구니는 비로그인 허용) */
  requireAuth?: boolean;
}

/**
 * 장바구니 액션 훅
 *
 * 비즈니스 로직을 캡슐화하여 컴포넌트의 deps를 단순화합니다.
 * - Auth 검증
 * - Cart 상태 변경
 * - Toast 피드백
 * - Navigation (선택적)
 *
 * @example
 * // 기본 사용
 * const { addToCart } = useCart();
 * addToCart(product, 2);
 *
 * @example
 * // 피드백 없이 (배치 추가 시)
 * addToCart(product, 1, { showFeedback: false });
 *
 * @example
 * // 성공 후 콜백
 * addToCart(product, qty, { onSuccess: () => setQuantity(1) });
 */
export const useCart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const syncedRef = useRef(false);
  const addLockRef = useRef(false);
  const quantityTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Zustand 스토어에서 액션 + 읽기 전용 상태를 단일 useShallow 셀렉터로 추출
  const {
    addItem: storeAddItem,
    removeItem: storeRemoveItem,
    updateQuantity: storeUpdateQuantity,
    clearCart: storeClearCart,
    setItems: storeSetItems,
    items,
    getItemCount,
    getTotalPrice,
    getItem,
  } = useCartStore(useShallow((s) => ({
    addItem: s.addItem,
    removeItem: s.removeItem,
    updateQuantity: s.updateQuantity,
    clearCart: s.clearCart,
    setItems: s.setItems,
    items: s.items,
    getItemCount: s.getItemCount,
    getTotalPrice: s.getTotalPrice,
    getItem: s.getItem,
  })));

  // Ref to access current items without dependency (prevents re-sync loops)
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  /**
   * 서버와 장바구니 동기화
   * - 로그인 시 서버에서 장바구니 가져옴
   * - 로컬에 있던 아이템과 서버 아이템 병합
   * - items를 ref로 읽어 dependency에서 제외 → 불필요한 재동기화 방지
   */
  const syncCartWithServer = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const serverCart = await cartApi.getCart();
      if (serverCart && serverCart.items) {
        // 서버 장바구니 아이템을 로컬 포맷으로 변환 (재고 정보 포함)
        const serverItems = serverCart.items.map((item) => ({
          ...item.product,
          quantity: item.quantity,
          availableStock: item.availableStock ?? 0,
        }));

        // 현재 로컬 아이템과 병합 (로컬 우선)
        const localItems = itemsRef.current;
        const mergedMap = new Map<number, typeof serverItems[0]>();

        // 서버 아이템 추가
        serverItems.forEach((item) => {
          mergedMap.set(item.id, item);
        });

        // 로컬 아이템으로 덮어쓰기/추가
        localItems.forEach((item) => {
          const existing = mergedMap.get(item.id);
          if (existing) {
            // 로컬 수량이 더 크면 로컬 사용
            mergedMap.set(item.id, {
              ...item,
              quantity: Math.max(item.quantity, existing.quantity),
              availableStock: item.availableStock ?? existing.availableStock ?? 0,
            });
          } else {
            mergedMap.set(item.id, {
              ...item,
              availableStock: item.availableStock ?? 0,
            });
          }
        });

        const mergedItems = Array.from(mergedMap.values());
        storeSetItems(mergedItems);

        // 로컬에만 있던 아이템들을 서버에 병렬 추가 (Promise.all)
        const serverItemIds = new Set(serverItems.map(s => s.id));
        const localOnlyItems = localItems.filter(item => !serverItemIds.has(item.id));

        if (localOnlyItems.length > 0) {
          await Promise.all(
            localOnlyItems.map(item =>
              cartApi.addToCart(item.id, item.quantity).catch(() => {
                // 서버 동기화 실패는 무시 (다음 번에 재시도)
              })
            )
          );
        }
      }
    } catch {
      // 서버 동기화 실패 시 로컬 상태 유지
    }
  }, [isAuthenticated, storeSetItems]);

  // 로그인 상태 변경 시 서버와 동기화
  useEffect(() => {
    if (isAuthenticated && !syncedRef.current) {
      syncedRef.current = true;
      syncCartWithServer();
    } else if (!isAuthenticated) {
      syncedRef.current = false;
    }
  }, [isAuthenticated, syncCartWithServer]);

  /**
   * 장바구니에 상품 추가 (피드백 포함 + 서버 동기화)
   */
  const addToCart = useCallback(
    (
      product: Product,
      quantity: number = 1,
      options: AddToCartOptions = {}
    ): CartActionResult => {
      const { showFeedback = true, onSuccess, requireAuth = false } = options;

      // rapid click 방지 (300ms lock)
      if (addLockRef.current) return { success: false, message: 'THROTTLED' };
      addLockRef.current = true;
      setTimeout(() => { addLockRef.current = false; }, 300);

      // 인증 검증 (옵션 — 장바구니 담기는 기본적으로 비로그인 허용)
      if (requireAuth && !isAuthenticated) {
        showToast({ message: '로그인 후 이용해주세요', type: 'info' });
        navigate('/login', { state: { from: location.pathname + location.search } });
        return { success: false, message: 'AUTH_REQUIRED' };
      }

      // 스토어 업데이트 (optimistic)
      storeAddItem(product, quantity);

      // 서버 동기화 (비동기, 실패해도 로컬은 유지)
      if (isAuthenticated) {
        cartApi.addToCart(product.id, quantity).catch(() => { });
      }

      // 피드백
      if (showFeedback) {
        showToast({
          message: `${product.name} ${quantity}개를 장바구니에 담았어요`,
          type: 'success',
          action: {
            label: '보러가기',
            onClick: () => navigate('/cart'),
          },
        });
      }

      // 성공 콜백
      onSuccess?.();

      return { success: true };
    },
    [isAuthenticated, navigate, location, showToast, storeAddItem]
  );

  /**
   * 여러 상품을 장바구니에 일괄 추가 (피드백 통합 + 서버 동기화)
   */
  const addMultipleToCart = useCallback(
    (
      itemsToAdd: { product: Product; quantity: number }[],
      options: AddToCartOptions = {}
    ): CartActionResult => {
      const { showFeedback = true, onSuccess, requireAuth = false } = options;

      if (requireAuth && !isAuthenticated) {
        showToast({ message: '로그인 후 이용해주세요', type: 'info' });
        navigate('/login', { state: { from: location.pathname + location.search } });
        return { success: false, message: 'AUTH_REQUIRED' };
      }

      if (itemsToAdd.length === 0) return { success: false, message: 'NO_ITEMS' };

      // 스토어 업데이트 (optimistic)
      itemsToAdd.forEach(({ product, quantity }) => {
        storeAddItem(product, quantity);
      });

      // 서버 동기화 (비동기 병렬)
      if (isAuthenticated) {
        Promise.all(
          itemsToAdd.map(({ product, quantity }) => cartApi.addToCart(product.id, quantity).catch(() => { }))
        ).catch(() => { });
      }

      // 피드백
      if (showFeedback) {
        const totalQty = itemsToAdd.reduce((sum, item) => sum + item.quantity, 0);
        const nameStr = itemsToAdd.length === 1
          ? itemsToAdd[0].product.name
          : `${itemsToAdd[0].product.name} 외 ${itemsToAdd.length - 1}건`;

        showToast({
          message: `${nameStr} (총 ${totalQty}개)를 장바구니에 담았어요`,
          type: 'success',
          action: {
            label: '보러가기',
            onClick: () => navigate('/cart'),
          },
        });
      }

      onSuccess?.();
      return { success: true };
    },
    [isAuthenticated, navigate, location, showToast, storeAddItem]
  );

  /**
   * 장바구니에서 상품 삭제 (피드백 포함 + 서버 동기화 + 실패 시 롤백)
   */
  const removeFromCart = useCallback(
    (productId: number, productName?: string, showFeedback: boolean = true): CartActionResult => {
      // 롤백용 아이템 저장 — getState()로 직접 접근하여 items 의존성 제거
      const removedItem = useCartStore.getState().items.find(i => i.id === productId);

      // 로컬 스토어 업데이트 (optimistic)
      storeRemoveItem(productId);

      // 서버 동기화 (비동기) — Go 서버가 productId 기반으로 삭제
      if (isAuthenticated) {
        cartApi.removeItem(productId).catch(() => {
          // 서버 삭제 실패 시 롤백
          if (removedItem) {
            storeAddItem(removedItem, removedItem.quantity);
            showToast({ message: '삭제에 실패했어요. 다시 시도해주세요.', type: 'error' });
          }
        });
      }

      if (showFeedback && productName) {
        showToast({
          message: `${productName}을(를) 장바구니에서 삭제했어요.`,
          type: 'info',
        });
      }

      return { success: true };
    },
    [isAuthenticated, showToast, storeRemoveItem, storeAddItem]
  );

  /**
   * 상품 수량 변경 (피드백 포함 + 서버 동기화 디바운스 + 실패 시 롤백)
   *
   * UI는 즉시 반영하고, 서버 호출은 300ms 디바운스하여
   * 연속 클릭 시 마지막 값만 전송합니다.
   */
  const updateQuantity = useCallback(
    (productId: number, quantity: number): CartActionResult => {
      if (quantity < 1) {
        return { success: false, message: 'INVALID_QUANTITY' };
      }

      // 롤백을 위해 변경 전 수량을 캡처 (storeUpdateQuantity 전에!)
      const prevQty = items.find(i => i.id === productId)?.quantity;

      // 로컬 스토어 업데이트 (optimistic — 즉시 반영)
      storeUpdateQuantity(productId, quantity);

      // 이전 타이머 취소 (같은 productId에 대해)
      if (quantityTimers.current[productId]) {
        clearTimeout(quantityTimers.current[productId]);
      }

      // 서버 동기화 (300ms 디바운스 — 마지막 값만 전송)
      if (isAuthenticated) {
        quantityTimers.current[productId] = setTimeout(() => {
          // Go 서버가 productId 기반으로 수량 변경
          cartApi.updateQuantity(productId, quantity).catch(() => {
            // 서버 수량 변경 실패 시 캡처된 이전 수량으로 롤백
            if (prevQty !== undefined) {
              storeUpdateQuantity(productId, prevQty);
            }
            showToast({ message: '수량 변경에 실패했어요', type: 'error' });
          });
          delete quantityTimers.current[productId];
        }, 300);
      }

      return { success: true };
    },
    [isAuthenticated, items, showToast, storeUpdateQuantity]
  );

  /**
   * 장바구니에서 여러 상품 배치 삭제 (단일 API 호출 + 피드백)
   */
  const removeSelectedItems = useCallback(
    async (productIds: number[]): Promise<CartActionResult> => {
      if (productIds.length === 0) {
        return { success: false, message: 'NO_ITEMS' };
      }

      // 로컬 스토어 optimistic 업데이트
      productIds.forEach((id) => storeRemoveItem(id));

      // 서버 배치 삭제 (단일 요청)
      if (isAuthenticated) {
        try {
          await cartApi.removeItems(productIds);
        } catch {
          // 서버 동기화 실패 시 로컬 상태 유지
        }
      }

      showToast({
        message: `${productIds.length}개 상품이 삭제되었습니다.`,
        type: 'info',
      });

      return { success: true };
    },
    [isAuthenticated, showToast, storeRemoveItem]
  );

  /**
   * 장바구니 비우기 (결제 완료 후 + 서버 동기화)
   */
  const clearCart = useCallback(
    (showFeedback: boolean = false): CartActionResult => {
      // 로컬 스토어 비우기
      storeClearCart();

      // 서버 동기화
      if (isAuthenticated) {
        cartApi.clearCart().catch(() => { });
      }

      if (showFeedback) {
        showToast({ message: '장바구니를 비웠어요', type: 'info' });
      }

      return { success: true };
    },
    [isAuthenticated, showToast, storeClearCart]
  );

  /**
   * 결제 페이지로 이동 (장바구니 전체)
   */
  const goToCheckout = useCallback(() => {
    if (getItemCount() === 0) {
      showToast({ message: '장바구니가 비어있어요', type: 'info' });
      return;
    }
    navigate('/checkout');
  }, [getItemCount, navigate, showToast]);

  // Checkout store 액션
  const setCheckoutItems = useCheckoutStore((s) => s.setCheckoutItems);
  const setGiftTarget = useCheckoutStore((s) => s.setGiftTarget);

  /**
   * 바로구매 — 장바구니에 담지 않고 체크아웃 스토어에만 설정 후 결제 페이지 이동
   */
  const buyNow = useCallback(
    (selections: { product: Product; quantity: number }[]) => {
      const checkoutItems: CheckoutItem[] = selections.map(({ product, quantity }) => ({
        ...product,
        quantity,
      }));
      setCheckoutItems(checkoutItems);
      setGiftTarget(null);
      navigate('/checkout');
    },
    [setCheckoutItems, setGiftTarget, navigate]
  );

  /**
   * 장바구니에서 선택 주문 — CartPage에서 선택한 아이템만 체크아웃 스토어에 설정
   */
  const checkoutFromCart = useCallback(
    (selectedItems: CheckoutItem[], giftTarget?: { email: string; name: string; message?: string } | null) => {
      setCheckoutItems(selectedItems);
      setGiftTarget(giftTarget || null);
      navigate('/checkout');
    },
    [setCheckoutItems, setGiftTarget, navigate]
  );

  return {
    // 액션 (피드백 포함)
    addToCart,
    addMultipleToCart,
    removeFromCart,
    removeSelectedItems,
    updateQuantity,
    clearCart,
    goToCheckout,
    buyNow,
    checkoutFromCart,

    // 읽기 전용 상태
    items,
    itemCount: getItemCount(),
    totalPrice: getTotalPrice(),
    getItem,

    // 유틸리티
    isEmpty: items.length === 0,
  };
};

export type { CartActionResult, AddToCartOptions };
