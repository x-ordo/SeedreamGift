/**
 * @file prismaIncludes.ts
 * @description 중앙화된 Prisma Include 패턴
 * @module shared/constants
 *
 * 반복되는 Prisma include 절을 상수로 관리하여:
 * - 일관성 유지
 * - 타이핑 오류 방지
 * - 쿼리 최적화 중앙 관리
 *
 * 사용 예시:
 * ```typescript
 * const order = await prisma.order.findUnique({
 *   where: { id: orderId },
 *   include: ORDER_INCLUDES.withItemsAndVouchers,
 * });
 * ```
 */

import { Prisma } from '../prisma/generated/client';

// ============================================================================
// Order Includes
// ============================================================================

/**
 * 주문 관련 Include 패턴
 */
export const ORDER_INCLUDES = {
  /** 기본: 주문 아이템 + 바우처 코드 */
  basic: {
    items: true,
    voucherCodes: true,
  } satisfies Prisma.OrderInclude,

  /** 아이템에 상품 정보 포함 */
  withProducts: {
    items: {
      include: {
        product: true,
      },
    },
    voucherCodes: true,
  } satisfies Prisma.OrderInclude,

  /** 바우처에 상품 정보 포함 */
  withVoucherProducts: {
    items: true,
    voucherCodes: {
      include: {
        product: true,
      },
    },
  } satisfies Prisma.OrderInclude,

  /** 전체 관계 포함 (상품 정보 전체) */
  full: {
    items: {
      include: {
        product: true,
      },
    },
    voucherCodes: {
      include: {
        product: true,
      },
    },
  } satisfies Prisma.OrderInclude,

  /** 관리자용: 사용자 정보 포함 */
  withUser: {
    items: true,
    voucherCodes: true,
    user: {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    },
  } satisfies Prisma.OrderInclude,

  /** 관리자용: 전체 정보 */
  adminFull: {
    items: {
      include: {
        product: true,
      },
    },
    voucherCodes: {
      include: {
        product: true,
      },
    },
    user: {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        kycStatus: true,
      },
    },
  } satisfies Prisma.OrderInclude,
} as const;

// ============================================================================
// User Includes
// ============================================================================

/**
 * 사용자 관련 Include 패턴
 */
export const USER_INCLUDES = {
  /** 기본: 주문만 */
  withOrders: {
    orders: true,
  } satisfies Prisma.UserInclude,

  /** 매입 내역 포함 */
  withTradeIns: {
    tradeIns: true,
  } satisfies Prisma.UserInclude,

  /** 전체 거래 내역 */
  withAllTransactions: {
    orders: {
      include: {
        items: true,
      },
    },
    tradeIns: true,
  } satisfies Prisma.UserInclude,

  /** 장바구니 포함 */
  withCart: {
    cart: {
      include: {
        product: true,
      },
    },
  } satisfies Prisma.UserInclude,
} as const;

// ============================================================================
// Product Includes
// ============================================================================

/**
 * 상품 관련 Include 패턴
 */
export const PRODUCT_INCLUDES = {
  /** 재고(바우처) 포함 */
  withVouchers: {
    voucherCodes: true,
  } satisfies Prisma.ProductInclude,

  /** 사용 가능한 재고만 */
  withAvailableVouchers: {
    voucherCodes: {
      where: {
        status: 'AVAILABLE',
      },
    },
  } satisfies Prisma.ProductInclude,

  /** 재고 수량만 (count) - select와 함께 사용 */
  withStockCount: {
    _count: {
      select: {
        voucherCodes: {
          where: {
            status: 'AVAILABLE',
          },
        },
      },
    },
  },
} as const;

// ============================================================================
// TradeIn Includes
// ============================================================================

/**
 * 매입 관련 Include 패턴
 */
export const TRADEIN_INCLUDES = {
  /** 상품 정보 포함 */
  withProduct: {
    product: true,
  } satisfies Prisma.TradeInInclude,

  /** 관리자용: 사용자 정보 포함 */
  withUser: {
    user: {
      select: {
        id: true,
        email: true,
        name: true,
      },
    },
    product: true,
  } satisfies Prisma.TradeInInclude,
} as const;

// ============================================================================
// VoucherCode Includes
// ============================================================================

/**
 * 바우처 관련 Include 패턴
 */
export const VOUCHER_INCLUDES = {
  /** 상품 정보 포함 */
  withProduct: {
    product: true,
  } satisfies Prisma.VoucherCodeInclude,

  /** 주문 정보 포함 */
  withOrder: {
    order: true,
  } satisfies Prisma.VoucherCodeInclude,

  /** 전체 관계 */
  full: {
    product: true,
    order: {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    },
  } satisfies Prisma.VoucherCodeInclude,
} as const;

// ============================================================================
// User Select Patterns (민감 정보 제외)
// ============================================================================

/**
 * 사용자 Select 패턴 (비밀번호 등 민감 정보 제외)
 */
export const USER_SELECTS = {
  /** 기본 공개 정보 */
  public: {
    id: true,
    email: true,
    name: true,
    role: true,
    kycStatus: true,
    createdAt: true,
  } satisfies Prisma.UserSelect,

  /** 관리자용 */
  admin: {
    id: true,
    email: true,
    name: true,
    phone: true,
    role: true,
    kycStatus: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.UserSelect,

  /** 프로필용 (본인 조회) */
  profile: {
    id: true,
    email: true,
    name: true,
    phone: true,
    role: true,
    kycStatus: true,
    createdAt: true,
  } satisfies Prisma.UserSelect,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type OrderIncludeKey = keyof typeof ORDER_INCLUDES;
export type UserIncludeKey = keyof typeof USER_INCLUDES;
export type ProductIncludeKey = keyof typeof PRODUCT_INCLUDES;
export type TradeInIncludeKey = keyof typeof TRADEIN_INCLUDES;
export type VoucherIncludeKey = keyof typeof VOUCHER_INCLUDES;
export type UserSelectKey = keyof typeof USER_SELECTS;
