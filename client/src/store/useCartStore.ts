/**
 * @file useCartStore.ts
 * @description 장바구니 상태 관리 스토어 (Zustand + localStorage 영속화)
 * @module store
 *
 * 주요 기능:
 * - 장바구니 아이템 추가/삭제/수량 변경
 * - 총 결제 금액 계산
 * - localStorage 자동 영속화 (새로고침 시에도 유지)
 *
 * 최적화:
 * - Map 기반 O(1) 조회 (itemsMap)
 * - 버전화된 localStorage 키 (마이그레이션 용이)
 *
 * 영속화:
 * - localStorage 키: 'seedream-gift-cart:v1'
 * - Zustand persist 미들웨어 사용
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, CartItem } from '../types';
import { CART_STORAGE_KEY, CART_TIMESTAMP_KEY } from '../constants';

/**
 * 장바구니 상태 및 액션 타입
 */
interface CartState {
  items: CartItem[];  // 장바구니 아이템 목록
  itemsMap: Map<number, CartItem>;  // O(1) 조회용 Map
  addItem: (product: Product, quantity?: number) => void;     // 아이템 추가
  removeItem: (productId: number) => void;                     // 아이템 삭제
  updateQuantity: (productId: number, quantity: number) => void; // 수량 변경
  clearCart: () => void;      // 장바구니 비우기
  getTotalPrice: () => number; // 총 결제 금액 계산
  getItemCount: () => number;  // 총 아이템 수 계산
  getItem: (productId: number) => CartItem | undefined;  // 단일 아이템 조회 O(1)
  setItems: (items: CartItem[]) => void;  // 서버 동기화용 - 전체 아이템 설정
}

/**
 * 배열에서 Map 생성 헬퍼
 */
const createItemsMap = (items: CartItem[]): Map<number, CartItem> => {
  return new Map(items.map(item => [item.id, item]));
};

/**
 * 장바구니 스토어
 *
 * persist 미들웨어로 localStorage에 자동 저장/복원
 * Map 기반 인덱싱으로 O(1) 조회 성능 보장
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      itemsMap: new Map(),

      /**
       * 장바구니에 상품 추가
       * - 이미 있는 상품이면 수량만 증가 (Map으로 O(1) 조회)
       * - 없는 상품이면 새로 추가
       *
       * @param product - 추가할 상품 정보
       * @param quantity - 추가할 수량 (기본값: 1)
       */
      addItem: (product, quantity = 1) => {
        set((state) => {
          // Map으로 O(1) 조회
          const existingItem = state.itemsMap.get(product.id);

          if (existingItem) {
            // 기존 아이템이 있으면 수량만 증가
            const updatedItems = state.items.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            );
            localStorage.setItem(CART_TIMESTAMP_KEY, Date.now().toString());
            return {
              items: updatedItems,
              itemsMap: createItemsMap(updatedItems),
            };
          }

          // 새 아이템 추가
          const newItem = { ...product, quantity };
          const newItems = [...state.items, newItem];
          localStorage.setItem(CART_TIMESTAMP_KEY, Date.now().toString());
          return {
            items: newItems,
            itemsMap: createItemsMap(newItems),
          };
        });
      },

      /**
       * 장바구니에서 상품 삭제
       *
       * @param productId - 삭제할 상품 ID
       */
      removeItem: (productId) => {
        set((state) => {
          const newItems = state.items.filter((item) => item.id !== productId);
          return {
            items: newItems,
            itemsMap: createItemsMap(newItems),
          };
        });
      },

      /**
       * 상품 수량 변경
       * - 최소 수량: 1 (0 이하로 설정 불가)
       *
       * @param productId - 수량 변경할 상품 ID
       * @param quantity - 새 수량
       */
      updateQuantity: (productId, quantity) => {
        set((state) => {
          const newItems = state.items.map((item) =>
            item.id === productId ? { ...item, quantity: Math.min(99, Math.max(1, quantity)) } : item
          );
          return {
            items: newItems,
            itemsMap: createItemsMap(newItems),
          };
        });
      },

      /**
       * 장바구니 전체 비우기 (결제 완료 후 호출)
       */
      clearCart: () => set({ items: [], itemsMap: new Map() }),

      /**
       * 총 결제 금액 계산
       * - 판매가(buyPrice) × 수량의 합계
       *
       * @returns 총 결제 금액 (원)
       */
      getTotalPrice: () => {
        return get().items.reduce(
          (total, item) => total + (Number(item.buyPrice) || 0) * item.quantity,
          0
        );
      },

      /**
       * 총 아이템 수 계산
       * - 각 아이템의 수량 합계
       *
       * @returns 총 아이템 수
       */
      getItemCount: () => {
        return get().items.length;
      },

      /**
       * 단일 아이템 조회 (O(1) 성능)
       *
       * @param productId - 조회할 상품 ID
       * @returns CartItem 또는 undefined
       */
      getItem: (productId) => {
        return get().itemsMap.get(productId);
      },

      /**
       * 서버 동기화용 - 전체 아이템 설정
       * 로그인 시 서버에서 받은 장바구니로 로컬 상태 업데이트
       *
       * @param items - 서버에서 받은 장바구니 아이템 목록
       */
      setItems: (items) => {
        set({
          items,
          itemsMap: createItemsMap(items),
        });
      },
    }),
    {
      name: CART_STORAGE_KEY, // 버전화된 localStorage 저장 키
      // Map은 JSON 직렬화 불가 - items만 저장하고 복원 시 Map 재생성
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 장바구니 만료 체크 — 7일 이상 미사용 시 초기화
          const cartTimestamp = localStorage.getItem(CART_TIMESTAMP_KEY);
          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
          if (cartTimestamp && (Date.now() - Number(cartTimestamp)) > SEVEN_DAYS_MS) {
            state.items = [];
            state.itemsMap = new Map();
            localStorage.removeItem(CART_TIMESTAMP_KEY);
            // Notify user about expired cart
            window.dispatchEvent(new CustomEvent('cart-expired'));
          } else {
            state.itemsMap = createItemsMap(state.items);
          }
        }
      },
    }
  )
);