/**
 * @file useCheckoutStore.ts
 * @description 체크아웃 전용 Zustand 스토어 (sessionStorage persist)
 * @module store
 *
 * 장바구니(useCartStore)와 분리하여, "바로구매" / "장바구니에서 선택 주문" 시
 * 체크아웃할 아이템만 별도 관리. 기존 장바구니에 영향을 주지 않음.
 *
 * sessionStorage persist: 새로고침 시에도 유지, 탭/브라우저 종료 시 자동 삭제
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CheckoutItem, GiftTarget, ShippingInfo } from '../types';

interface CheckoutState {
  checkoutItems: CheckoutItem[];
  giftTarget: GiftTarget | null;
  shippingInfo: ShippingInfo | null;
  setCheckoutItems: (items: CheckoutItem[]) => void;
  setGiftTarget: (target: GiftTarget | null) => void;
  setShippingInfo: (info: ShippingInfo | null) => void;
  clear: () => void;
}

/**
 * 주문(체크아웃) 과정을 관리하는 Zustand 스토어입니다.
 * @description
 * 상품 선택, 선물 대상 정보, 배송지 정보 등을 상태로 관리하며,
 * sessionStorage를 통해 페이지 새로고침 시에도 데이터를 유지하고 브라우저 종료 시 초기화됩니다.
 */
export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      checkoutItems: [],
      giftTarget: null,
      shippingInfo: null,

      setCheckoutItems: (items) => set({ checkoutItems: items }),
      setGiftTarget: (target) => set({ giftTarget: target }),
      setShippingInfo: (info) => set({ shippingInfo: info }),
      clear: () => set({ checkoutItems: [], giftTarget: null, shippingInfo: null }),
    }),
    {
      name: 'seedream-gift-checkout:v1',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
