/**
 * @file admin.controller.ts
 * @description Admin 컨트롤러 배럴 파일 — 도메인별 분리된 컨트롤러를 re-export
 *
 * 실제 컨트롤러는 controllers/ 디렉토리에 위치:
 * - AdminUsersController: 사용자/세션 관리
 * - AdminProductsController: 상품/브랜드/바우처 관리
 * - AdminOrdersController: 주문/매입/환불 관리
 * - AdminContentController: 공지/이벤트/FAQ/문의 관리
 * - AdminSystemController: 대시보드/장바구니/선물/감사로그/설정
 */
export {
  AdminUsersController,
  AdminProductsController,
  AdminOrdersController,
  AdminContentController,
  AdminSystemController,
} from './controllers';
