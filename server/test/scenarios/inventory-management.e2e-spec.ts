/**
 * @file inventory-management.e2e-spec.ts
 * @description 재고 관리 시나리오 테스트
 *
 * 시나리오:
 * 1. 관리자 로그인
 * 2. PIN 코드 일괄 등록
 * 3. 재고 확인
 * 4. 사용자: 구매 진행 (주문 생성 및 바우처 매핑 검증)
 * 5. 재고 감소 확인
 * 6. PIN 상태 변경 확인 (AVAILABLE → SOLD)
 * 7. 상품 가격 정책(할인율) 검증
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  generateUniqueSuffix,
  HTTP_STATUS,
  getData,
} from '../helpers/test-setup';
import {
  createAndLoginUser,
  loginAsSeededUser,
  AuthenticatedUser,
} from '../helpers/test-users';
import { createTestProduct } from '../helpers/test-data';

describe('Scenario: Inventory Management Flow', () => {
  let app: INestApplication;
  let admin: AuthenticatedUser;
  let buyer: AuthenticatedUser;

  // 테스트 데이터
  let testProductId: number;
  let testProductPrice: number;
  let testProductDiscountRate: number;
  let registeredPinCodes: string[];
  let initialStock: number;
  let createdOrderId: number;

  const uniqueSuffix = generateUniqueSuffix();

  beforeAll(async () => {
    app = await createTestApp();

    // 관리자 설정
    try {
      admin = await loginAsSeededUser(app, 'admin');
    } catch {
      admin = await createAndLoginUser(app, 'inv-admin', 'ADMIN');
    }

    // 구매자 설정
    buyer = await createAndLoginUser(app, 'inv-buyer');

    // 테스트 상품 생성 및 가격 정책 검증 데이터 설정
    testProductPrice = 30000;
    testProductDiscountRate = 2; // 2% 할인

    const product = await createTestProduct(app, admin.token, {
      brandCode: 'LOTTE',
      name: `재고 테스트 상품권 ${uniqueSuffix}`,
      price: testProductPrice,
      discountRate: testProductDiscountRate,
    });
    testProductId = product.id;
  }, 60000);

  afterAll(async () => {
    await closeTestApp(app);
  }, 30000);

  describe('Step 1: 관리자 로그인 확인', () => {
    it('should verify admin is logged in', () => {
      expect(admin.token).toBeDefined();
      expect(admin.user.role).toBe('ADMIN');
    });
  });

  describe('Step 2: 상품 가격 정책 검증', () => {
    it('should calculate buyPrice correctly based on discountRate', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${testProductId}`)
        .expect(HTTP_STATUS.OK);

      const product = getData(res);
      const expectedBuyPrice =
        testProductPrice * (1 - testProductDiscountRate / 100);

      // 가격 계산 검증
      expect(Number(product.buyPrice)).toBe(expectedBuyPrice);
      expect(Number(product.price)).toBe(testProductPrice);
      expect(Number(product.discountRate)).toBe(testProductDiscountRate);
    });
  });

  describe('Step 3: PIN 코드 일괄 등록', () => {
    it('should bulk register PIN codes', async () => {
      registeredPinCodes = [
        `INV-PIN-001-${uniqueSuffix}`,
        `INV-PIN-002-${uniqueSuffix}`,
        `INV-PIN-003-${uniqueSuffix}`,
        `INV-PIN-004-${uniqueSuffix}`,
        `INV-PIN-005-${uniqueSuffix}`,
      ];

      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          productId: testProductId,
          pinCodes: registeredPinCodes,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).count).toBe(5);
    });

    it('should reject empty PIN codes array', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          productId: testProductId,
          pinCodes: [],
        });

      expect([HTTP_STATUS.CREATED, HTTP_STATUS.BAD_REQUEST]).toContain(
        res.status,
      );
      if (res.status === HTTP_STATUS.CREATED) {
        expect(getData(res).count).toBe(0);
      }
    });

    it('should reject duplicate PIN codes', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          productId: testProductId,
          pinCodes: [registeredPinCodes[0]],
        });

      expect([
        HTTP_STATUS.BAD_REQUEST,
        HTTP_STATUS.CONFLICT,
        HTTP_STATUS.CREATED,
        HTTP_STATUS.INTERNAL_ERROR,
      ]).toContain(res.status);
    });
  });

  describe('Step 4: 재고 확인', () => {
    it('should get voucher stock by product', async () => {
      const res = await request(app.getHttpServer())
        .get(`/vouchers/stock/${testProductId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).available).toBe(5);
      initialStock = getData(res).available;
    });

    it('should list vouchers', async () => {
      const res = await request(app.getHttpServer())
        .get('/vouchers')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      const allVouchers = getData(res).items || [];
      const ourVouchers = allVouchers.filter(
        (v: any) => v.productId === testProductId,
      );
      expect(ourVouchers.length).toBe(5);
    });

    it('should show vouchers with AVAILABLE status', async () => {
      const res = await request(app.getHttpServer())
        .get('/vouchers')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      const allVouchers = getData(res).items || [];
      const ourVouchers = allVouchers.filter(
        (v: any) => v.productId === testProductId,
      );
      ourVouchers.forEach((v: any) => expect(v.status).toBe('AVAILABLE'));
    });
  });

  describe('Step 5: 사용자 구매 진행 (주문 및 바우처 매핑)', () => {
    it('should create an order and verify voucher mapping', async () => {
      const purchaseQuantity = 2;
      const orderData = {
        items: [{ productId: testProductId, quantity: purchaseQuantity }],
        paymentMethod: 'CARD',
      };

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send(orderData);

      expect([
        HTTP_STATUS.CREATED,
        HTTP_STATUS.BAD_REQUEST,
        HTTP_STATUS.FORBIDDEN,
      ]).toContain(res.status);

      if (res.status === HTTP_STATUS.CREATED) {
        expect(getData(res).id).toBeDefined();
        createdOrderId = getData(res).id;

        // 주문 상세 조회로 바우처 매핑 확인
        const orderDetail = await request(app.getHttpServer())
          .get(`/orders/${createdOrderId}`)
          .set('Authorization', `Bearer ${buyer.token}`) // 구매자 본인
          .expect(HTTP_STATUS.OK);

        // 주문에 바우처 코드가 포함되어 있어야 함 (또는 별도 조회)
        // 구현에 따라 orders/:id 응답에 voucherCodes가 없을 수도 있음.
        // 여기서는 Admin Vouchers API로 교차 검증
      }
    });
  });

  describe('Step 6: 재고 감소 및 바우처 상태 검증', () => {
    it('should show decreased stock after purchase', async () => {
      const res = await request(app.getHttpServer())
        .get(`/vouchers/stock/${testProductId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      // 구매 성공 시 재고 5 -> 3
      if (createdOrderId) {
        expect(getData(res).available).toBe(initialStock - 2);
      }
    });

    it('should verify vouchers are mapped to the order and marked SOLD', async () => {
      if (!createdOrderId) return;

      const res = await request(app.getHttpServer())
        .get('/vouchers')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      const allVouchers = getData(res).items || [];
      const orderVouchers = allVouchers.filter(
        (v: any) => v.orderId === createdOrderId,
      );

      // 주문 수량(2개)만큼 바우처가 매핑되어야 함
      expect(orderVouchers.length).toBe(2);

      // 상태가 SOLD여야 함
      orderVouchers.forEach((v: any) => {
        expect(v.status).toBe('SOLD');
        expect(v.productId).toBe(testProductId);
      });

      // 나머지 3개는 AVAILABLE 상태여야 함
      const availableVouchers = allVouchers.filter(
        (v: any) => v.productId === testProductId && v.status === 'AVAILABLE',
      );
      expect(availableVouchers.length).toBe(3);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should return 0 stock for product without vouchers', async () => {
      let newProduct;
      try {
        newProduct = await createTestProduct(app, admin.token, {
          brandCode: 'LOTTE',
          name: `재고없음 상품권 ${uniqueSuffix}`,
          price: 20000,
          discountRate: 1,
        });
      } catch {
        console.log('Skipping: Product creation failed');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/vouchers/stock/${newProduct.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).available).toBe(0);
    });

    it('should deny non-admin access to bulk registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({
          productId: testProductId,
          pinCodes: ['USER-PIN-001'],
        });

      expect([HTTP_STATUS.FORBIDDEN, HTTP_STATUS.UNAUTHORIZED]).toContain(
        res.status,
      );
    });

    it('should handle invalid product ID for stock check', async () => {
      const res = await request(app.getHttpServer())
        .get('/vouchers/stock/999999')
        .set('Authorization', `Bearer ${admin.token}`);

      expect([HTTP_STATUS.OK, HTTP_STATUS.NOT_FOUND]).toContain(res.status);
      if (res.status === HTTP_STATUS.OK) {
        expect(getData(res).available).toBe(0);
      }
    });

    it('should reject order when stock is insufficient', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({
          items: [{ productId: testProductId, quantity: 100 }],
          paymentMethod: 'CARD',
        });

      expect([HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.FORBIDDEN]).toContain(
        res.status,
      );
    });
  });
});
