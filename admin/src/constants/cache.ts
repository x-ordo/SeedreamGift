/**
 * @file cache.ts
 * @description React Query staleTime 중앙 관리
 * @module constants
 *
 * 사용처:
 * - 모든 useQuery 훅의 staleTime 값을 여기서 참조
 *
 * 값 기준:
 * - STATIC: 거의 변하지 않는 데이터 (brands, siteConfig, bankInfo)
 * - PRODUCTS: 가끔 변하는 목록 데이터
 * - DETAIL: 개별 상세 정보
 * - USER_DATA: 사용자별 데이터 (orders, tradeIns)
 * - REALTIME: 자주 업데이트되는 데이터 (rate ticker)
 */
export const STALE_TIMES = {
  /** 1시간 — brands, siteConfig, bankInfo 등 준-정적 데이터 */
  STATIC: 60 * 60 * 1000,
  /** 10분 — 상품 목록 */
  PRODUCTS: 10 * 60 * 1000,
  /** 5분 — 단일 상품 상세 */
  DETAIL: 5 * 60 * 1000,
  /** 2분 — 내 주문/매입 내역 */
  USER_DATA: 2 * 60 * 1000,
  /** 1분 — 실시간 시세 */
  REALTIME: 60 * 1000,
} as const;
