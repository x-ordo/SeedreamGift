/**
 * @file purchase-flow-detailed.e2e-spec.ts
 * @description 판매(구매) 플로우 상세 E2E 테스트
 *
 * 시나리오:
 * 1. 상품 조회 (목록, 상세, 가격 검증)
 * 2. 장바구니 CRUD (추가, 중복 추가=수량 증가, 수량 변경, 삭제, 비우기)
 * 3. 주문 생성 및 바우처 할당 (단일/복수 상품, PIN 복호화 확인)
 * 4. 주문 조회 (상세, 내 주문 목록, 통계)
 * 5. 재고 차감 검증
 * 6. 에러 케이스 (재고 부족, 비활성 상품, 수량 초과, 비인증)
 * 7. 타 사용자 접근 차단
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getData,
  getItems,
  HTTP_STATUS,
  TEST_TIMEOUT,
} from '../helpers/test-setup';
import { createAndLoginUser, loginAsSeededUser } from '../helpers/test-users';
import {
  createTestProduct,
  createTestVouchers,
  getVoucherStock,
} from '../helpers/test-data';
import { PrismaService } from '../../src/shared/prisma/prisma.service';

describe('Purchase Flow Detailed (판매 플로우 상세 테스트)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let buyerToken: string;
  let buyerUserId: number;
  let otherBuyerToken: string;

  // 테스트 상품 IDs
  let productA: { id: number; name: string; price: number; buyPrice: number };
  let productB: { id: number; name: string; price: number; buyPrice: number };
  let inactiveProductId: number;

  // 바우처 PIN 추적
  let productAPins: string[];
  let productBPins: string[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // Admin 로그인
    const admin = await loginAsSeededUser(app, 'admin');
    adminToken = admin.token;

    // 구매자 생성
    const buyer = await createAndLoginUser(app, 'purchase-buyer');
    buyerToken = buyer.token;
    buyerUserId = buyer.userId!;

    // 다른 구매자 생성 (접근 제어 테스트용)
    const otherBuyer = await createAndLoginUser(app, 'purchase-other');
    otherBuyerToken = otherBuyer.token;

    // 상품 A: 신세계 5만원권, 3% 할인 → buyPrice 48,500원
    const pA = await createTestProduct(app, adminToken, {
      brandCode: 'SHINSEGAE',
      name: '신세계 5만원권 테스트',
      price: 50000,
      discountRate: 3,
      tradeInRate: 5,
    });
    productA = {
      id: pA.id,
      name: pA.name,
      price: 50000,
      buyPrice: Math.floor(50000 * (1 - 3 / 100)),
    };

    // 상품 B: 현대 10만원권, 2.5% 할인 → buyPrice 97,500원
    const pB = await createTestProduct(app, adminToken, {
      brandCode: 'HYUNDAI',
      name: '현대 10만원권 테스트',
      price: 100000,
      discountRate: 2.5,
      tradeInRate: 4,
    });
    productB = {
      id: pB.id,
      name: pB.name,
      price: 100000,
      buyPrice: Math.floor(100000 * (1 - 2.5 / 100)),
    };

    // 비활성 상품
    const pInactive = await createTestProduct(app, adminToken, {
      name: '비활성 상품 테스트',
      price: 30000,
      discountRate: 2,
      tradeInRate: 3,
    });
    inactiveProductId = pInactive.id;
    // 비활성으로 변경
    await request(app.getHttpServer())
      .patch(`/products/${inactiveProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(HTTP_STATUS.OK);

    // 바우처(재고) 등록: 상품A 10개, 상품B 5개
    const vouchersA = await createTestVouchers(
      app,
      adminToken,
      productA.id,
      10,
    );
    productAPins = vouchersA.pinCodes;
    const vouchersB = await createTestVouchers(app, adminToken, productB.id, 5);
    productBPins = vouchersB.pinCodes;
  }, TEST_TIMEOUT * 2);

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ========================================
  // 1. 상품 조회
  // ========================================
  describe('1. 상품 조회', () => {
    it('상품 목록을 페이지네이션으로 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/products')
        .query({ page: 1, limit: 10 })
        .expect(HTTP_STATUS.OK);

      expect(getData(res).items).toBeDefined();
      expect(Array.isArray(getData(res).items)).toBe(true);
      expect(getData(res).meta).toBeDefined();
      expect(getData(res).meta.total).toBeGreaterThanOrEqual(2);
    });

    it('상품 상세에서 가격 정보가 정확하다 (A: 5만원, 3% 할인)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productA.id}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).id).toBe(productA.id);
      expect(Number(getData(res).price)).toBe(50000);
      expect(Number(getData(res).discountRate)).toBe(3);
      expect(Number(getData(res).buyPrice)).toBe(productA.buyPrice); // 48,500
    });

    it('상품 상세에서 가격 정보가 정확하다 (B: 10만원, 2.5% 할인)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productB.id}`)
        .expect(HTTP_STATUS.OK);

      expect(Number(getData(res).price)).toBe(100000);
      expect(Number(getData(res).discountRate)).toBe(2.5);
      expect(Number(getData(res).buyPrice)).toBe(productB.buyPrice); // 97,500
    });

    it('비활성 상품도 상세 조회는 가능하다', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${inactiveProductId}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).isActive).toBe(false);
    });

    it('인증 없이도 상품 조회 가능하다', async () => {
      await request(app.getHttpServer())
        .get('/products')
        .expect(HTTP_STATUS.OK);
    });

    it('관리자가 재고(바우처 스톡)를 확인할 수 있다', async () => {
      const stockA = await getVoucherStock(app, adminToken, productA.id);
      expect(stockA.available).toBe(10);

      const stockB = await getVoucherStock(app, adminToken, productB.id);
      expect(stockB.available).toBe(5);
    });
  });

  // ========================================
  // 2. 장바구니 CRUD
  // ========================================
  describe('2. 장바구니 CRUD', () => {
    let cartItemAId: number;
    let cartItemBId: number;

    it('장바구니에 상품 A를 추가할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: productA.id, quantity: 2 })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).productId).toBe(productA.id);
      expect(getData(res).quantity).toBe(2);
      cartItemAId = getData(res).id;
    });

    it('장바구니에 상품 B를 추가할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: productB.id, quantity: 1 })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).productId).toBe(productB.id);
      cartItemBId = getData(res).id;
    });

    it('동일 상품 추가 시 수량이 증가한다 (중복 방지)', async () => {
      const res = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: productA.id, quantity: 1 });

      // POST는 항상 201 (NestJS 기본), 서비스 내부에서 update 처리
      expect([HTTP_STATUS.OK, HTTP_STATUS.CREATED]).toContain(res.status);

      // 기존 2 + 추가 1 = 3
      expect(getData(res).quantity).toBe(3);
    });

    it('장바구니 조회 시 totalAmount가 정확하다', async () => {
      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).items.length).toBe(2);
      expect(getData(res).itemCount).toBe(2);

      // A: 48,500 × 3 = 145,500, B: 97,500 × 1 = 97,500 → 합계: 243,000
      const expectedTotal = productA.buyPrice * 3 + productB.buyPrice * 1;
      expect(getData(res).totalAmount).toBe(expectedTotal);
    });

    it('장바구니 아이템 수량을 변경할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/cart/${cartItemAId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ quantity: 1 })
        .expect(HTTP_STATUS.OK);

      expect(getData(res).quantity).toBe(1);
    });

    it('비활성 상품은 장바구니에 추가할 수 없다', async () => {
      await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: inactiveProductId, quantity: 1 })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });

    it('비로그인 시 장바구니 접근 불가', async () => {
      await request(app.getHttpServer())
        .get('/cart')
        .expect(HTTP_STATUS.UNAUTHORIZED);

      await request(app.getHttpServer())
        .post('/cart')
        .send({ productId: productA.id, quantity: 1 })
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('장바구니 아이템 하나를 삭제할 수 있다', async () => {
      await request(app.getHttpServer())
        .delete(`/cart/${cartItemBId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      // 삭제 후 확인
      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).itemCount).toBe(1);
    });

    it('장바구니를 전체 비울 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).deletedCount).toBeGreaterThanOrEqual(1);

      // 비운 후 확인
      const cartRes = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(cartRes).itemCount).toBe(0);
      expect(getData(cartRes).totalAmount).toBe(0);
    });
  });

  // ========================================
  // 3. 주문 생성 및 바우처 할당
  // ========================================
  describe('3. 주문 생성 및 바우처 할당', () => {
    let order1Id: number;
    let order2Id: number;

    it('단일 상품 주문 시 바우처가 할당된다', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: productA.id, quantity: 1 }],
        })
        .expect(HTTP_STATUS.CREATED);

      const orderData = getData(res);
      order1Id = orderData.id;
      expect(orderData.status).toBe('PAID');
      expect(Number(orderData.totalAmount)).toBe(productA.buyPrice);
      expect(orderData.items).toBeDefined();
      expect(orderData.items.length).toBe(1);
      expect(orderData.items[0].productId).toBe(productA.id);
      expect(orderData.items[0].quantity).toBe(1);

      // 바우처 할당 확인
      expect(orderData.voucherCodes).toBeDefined();
      expect(orderData.voucherCodes.length).toBe(1);
      // PIN이 복호화되어 반환되어야 함 (마스킹 아님)
      expect(orderData.voucherCodes[0].pinCode).not.toBe('****-****-****');
      expect(orderData.voucherCodes[0].pinCode.length).toBeGreaterThan(0);
      expect(orderData.voucherCodes[0].status).toBe('SOLD');
    });

    it('복수 수량 주문 시 수량만큼 바우처가 할당된다', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: productA.id, quantity: 3 }],
        })
        .expect(HTTP_STATUS.CREATED);

      const orderData = getData(res);
      order2Id = orderData.id;
      expect(orderData.voucherCodes.length).toBe(3);
      // 총 금액 = buyPrice × 3
      expect(Number(orderData.totalAmount)).toBe(productA.buyPrice * 3);

      // 각 바우처의 PIN이 고유한지 확인
      const pins = orderData.voucherCodes.map((v: any) => v.pinCode);
      const uniquePins = new Set(pins);
      expect(uniquePins.size).toBe(3);
    });

    it('여러 상품을 동시에 주문할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [
            { productId: productA.id, quantity: 2 },
            { productId: productB.id, quantity: 1 },
          ],
        })
        .expect(HTTP_STATUS.CREATED);

      const orderData = getData(res);
      expect(orderData.items.length).toBe(2);

      // 총 금액: A(48,500×2) + B(97,500×1) = 194,500
      const expectedTotal = productA.buyPrice * 2 + productB.buyPrice * 1;
      expect(Number(orderData.totalAmount)).toBe(expectedTotal);

      // 바우처: A 2개 + B 1개 = 3개
      expect(orderData.voucherCodes.length).toBe(3);
    });

    it('주문 후 재고가 차감되었다', async () => {
      // A: 초기 10 - (1 + 3 + 2) = 4
      const stockA = await getVoucherStock(app, adminToken, productA.id);
      expect(stockA.available).toBe(4);

      // B: 초기 5 - 1 = 4
      const stockB = await getVoucherStock(app, adminToken, productB.id);
      expect(stockB.available).toBe(4);
    });
  });

  // ========================================
  // 4. 주문 조회
  // ========================================
  describe('4. 주문 조회', () => {
    it('내 주문 목록을 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      const orders = getItems(res);
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThanOrEqual(3);

      // 최신순 정렬 확인
      for (let i = 1; i < orders.length; i++) {
        expect(
          new Date(orders[i - 1].createdAt).getTime(),
        ).toBeGreaterThanOrEqual(new Date(orders[i].createdAt).getTime());
      }
    });

    it('주문 상세에서 PIN이 복호화되어 반환된다', async () => {
      // 가장 최근 주문 사용
      const myOrders = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      const orderId = getItems(myOrders)[0].id;

      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      const orderDetail = getData(res);
      expect(orderDetail.id).toBe(orderId);
      expect(orderDetail.items).toBeDefined();
      expect(orderDetail.voucherCodes).toBeDefined();
      expect(orderDetail.voucherCodes.length).toBeGreaterThanOrEqual(1);

      // PIN이 복호화되어 있어야 함
      for (const vc of orderDetail.voucherCodes) {
        expect(vc.pinCode).toBeDefined();
        expect(vc.pinCode).not.toBe('****-****-****');
        expect(vc.pinCode.length).toBeGreaterThan(3);
      }
    });

    it('주문 상세에서 상품 정보가 포함된다', async () => {
      const myOrders = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      const orderId = getItems(myOrders)[0].id;

      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      for (const item of getData(res).items) {
        expect(item.product).toBeDefined();
        expect(item.product.name).toBeDefined();
        expect(item.product.brandCode).toBeDefined();
      }
    });

    it('내 주문 통계를 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my/stats')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).totalCount).toBeGreaterThanOrEqual(3);
      expect(getData(res).statusBreakdown).toBeDefined();
      expect(getData(res).statusBreakdown.PAID).toBeGreaterThanOrEqual(3);
      expect(getData(res).totalSpent).toBeGreaterThan(0);
    });
  });

  // ========================================
  // 5. 에러 케이스 - 재고 부족
  // ========================================
  describe('5. 에러 케이스 - 재고 부족', () => {
    it('재고보다 많은 수량 주문 시 400 에러', async () => {
      // B 재고 = 4, 5개 주문 시도
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: productB.id, quantity: 5 }],
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toContain('재고 부족');
    });

    it('재고가 0인 상품 주문 시 400 에러', async () => {
      // 재고 없는 새 상품 생성
      const noStockProduct = await createTestProduct(app, adminToken, {
        name: '재고 없는 상품',
        price: 10000,
        discountRate: 1,
        tradeInRate: 2,
      });

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: noStockProduct.id, quantity: 1 }],
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toContain('재고 부족');
    });
  });

  // ========================================
  // 6. 에러 케이스 - 상품/수량 검증
  // ========================================
  describe('6. 에러 케이스 - 상품/수량 검증', () => {
    it('비활성 상품 주문 시 400 에러', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: inactiveProductId, quantity: 1 }],
        })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });

    it('존재하지 않는 상품 ID 주문 시 400 에러', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: 999999, quantity: 1 }],
        })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });

    it('상품당 최대 수량(10) 초과 시 400 에러', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: productA.id, quantity: 11 }],
        })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });

    it('빈 items 배열 주문 시 400 에러', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ items: [] })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });

    it('비로그인 시 주문 생성 401', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: productA.id, quantity: 1 }],
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  // ========================================
  // 7. 타 사용자 접근 차단
  // ========================================
  describe('7. 타 사용자 접근 차단', () => {
    it('다른 사용자의 주문은 조회할 수 없다 (404 반환)', async () => {
      // buyer의 주문 목록에서 ID 획득
      const myOrders = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      const orderId = getItems(myOrders)[0].id;

      // 다른 사용자가 해당 주문 조회 시도
      await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherBuyerToken}`)
        .expect(HTTP_STATUS.NOT_FOUND);
    });

    it('다른 사용자의 주문은 내 주문 목록에 나타나지 않는다', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${otherBuyerToken}`)
        .expect(HTTP_STATUS.OK);

      // 다른 사용자는 주문 없으므로 빈 배열
      expect(getItems(res).length).toBe(0);
    });

    it('비로그인 시 내 주문 조회 401', async () => {
      await request(app.getHttpServer())
        .get('/orders/my')
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('비로그인 시 주문 상세 조회 401', async () => {
      await request(app.getHttpServer())
        .get('/orders/1')
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  // ========================================
  // 8. 연속 주문 및 재고 정합성
  // ========================================
  describe('8. 연속 주문 및 재고 정합성', () => {
    it('남은 재고 전부 주문하면 재고가 0이 된다', async () => {
      // B: 현재 4개 남음 → 4개 주문
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: productB.id, quantity: 4 }],
        })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).voucherCodes.length).toBe(4);

      // 재고 확인: 0
      const stock = await getVoucherStock(app, adminToken, productB.id);
      expect(stock.available).toBe(0);
    });

    it('재고 0인 상품 재주문 시 실패한다', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: productB.id, quantity: 1 }],
        })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });

    it('관리자가 바우처를 추가하면 다시 주문 가능하다', async () => {
      // 바우처 3개 추가
      await createTestVouchers(app, adminToken, productB.id, 3);

      const stock = await getVoucherStock(app, adminToken, productB.id);
      expect(stock.available).toBe(3);

      // 다시 주문 성공
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: productB.id, quantity: 2 }],
        })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).voucherCodes.length).toBe(2);

      // 재고: 3 - 2 = 1
      const stockAfter = await getVoucherStock(app, adminToken, productB.id);
      expect(stockAfter.available).toBe(1);
    });
  });

  // ========================================
  // 9. 주문 통계 최종 확인
  // ========================================
  describe('9. 주문 통계 최종 확인', () => {
    it('모든 주문이 통계에 반영되었다', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my/stats')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(HTTP_STATUS.OK);

      // 총 주문: 단일(1) + 복수수량(1) + 복수상품(1) + 재고소진(1) + 재보충후(1) = 5
      expect(getData(res).totalCount).toBeGreaterThanOrEqual(5);
      expect(getData(res).statusBreakdown.PAID).toBeGreaterThanOrEqual(5);
      expect(getData(res).totalSpent).toBeGreaterThan(0);
    });

    it('다른 사용자의 통계는 0이다', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my/stats')
        .set('Authorization', `Bearer ${otherBuyerToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).totalCount).toBe(0);
      expect(getData(res).totalSpent).toBe(0);
    });
  });
});
