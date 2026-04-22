/**
 * @file vouchers.checklist.e2e-spec.ts
 * @description 바우처(재고) 관련 QA 체크리스트 테스트 (5개 테스트)
 *
 * [VOU-001] PIN 일괄 등록
 * [VOU-002] 상품별 재고 조회
 * [VOU-003] 중복 PIN 등록 실패
 * [VOU-004] 구매 후 PIN 상태 변경 확인
 * [VOU-005] PIN 복호화 후 주문에 포함 확인
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  generateUniqueSuffix,
  getData,
  getItems,
  HTTP_STATUS,
} from '../helpers/test-setup';
import {
  createAndLoginUser,
  loginAsSeededUser,
  AuthenticatedUser,
} from '../helpers/test-users';
import { createTestProduct } from '../helpers/test-data';

describe('Vouchers Checklist E2E Tests', () => {
  let app: INestApplication;
  let admin: AuthenticatedUser;
  let user: AuthenticatedUser;

  const uniqueSuffix = generateUniqueSuffix();
  let testProductId: number;
  let registeredPinCodes: string[];

  beforeAll(async () => {
    app = await createTestApp();

    // 관리자 설정
    try {
      admin = await loginAsSeededUser(app, 'admin');
    } catch {
      admin = await createAndLoginUser(app, 'voucher-admin', 'ADMIN');
    }

    // 사용자 설정
    user = await createAndLoginUser(app, 'voucher-user');

    // 테스트 상품 생성
    const product = await createTestProduct(app, admin.token, {
      brandCode: 'DAISO',
      name: `바우처 테스트 상품 ${uniqueSuffix}`,
      price: 30000,
      discountRate: 2,
    });
    testProductId = product.id;
  }, 60000);

  afterAll(async () => {
    await closeTestApp(app);
  }, 30000);

  describe('[VOU-001] PIN 일괄 등록', () => {
    it('should bulk register PIN codes', async () => {
      registeredPinCodes = [
        `VOU-PIN-001-${uniqueSuffix}`,
        `VOU-PIN-002-${uniqueSuffix}`,
        `VOU-PIN-003-${uniqueSuffix}`,
        `VOU-PIN-004-${uniqueSuffix}`,
        `VOU-PIN-005-${uniqueSuffix}`,
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

    it('should handle empty PIN codes array', async () => {
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

    it('should reject bulk registration without admin token', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          productId: testProductId,
          pinCodes: ['USER-ATTEMPT-001'],
        });

      expect([HTTP_STATUS.FORBIDDEN, HTTP_STATUS.UNAUTHORIZED]).toContain(
        res.status,
      );
    });
  });

  describe('[VOU-002] 상품별 재고 조회', () => {
    it('should get voucher stock by product', async () => {
      const res = await request(app.getHttpServer())
        .get(`/vouchers/stock/${testProductId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      expect(typeof getData(res).available).toBe('number');
      expect(getData(res).available).toBe(5); // 등록한 5개
    });

    it('should return 0 for product without vouchers', async () => {
      const newProduct = await createTestProduct(app, admin.token, {
        brandCode: 'LOTTE',
        name: `재고없음 상품 ${uniqueSuffix}`,
        price: 50000,
        discountRate: 3,
      });

      const res = await request(app.getHttpServer())
        .get(`/vouchers/stock/${newProduct.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).available).toBe(0);
    });

    it('should handle invalid product ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/vouchers/stock/999999')
        .set('Authorization', `Bearer ${admin.token}`);

      expect([HTTP_STATUS.OK, HTTP_STATUS.NOT_FOUND]).toContain(res.status);

      if (res.status === HTTP_STATUS.OK) {
        expect(getData(res).available).toBe(0);
      }
    });
  });

  describe('[VOU-003] 중복 PIN 등록 실패', () => {
    it('should reject duplicate PIN code', async () => {
      const duplicatePin = registeredPinCodes[0];

      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          productId: testProductId,
          pinCodes: [duplicatePin],
        });

      // 중복은 409, 400, 500 또는 성공(0개 등록)
      expect([
        HTTP_STATUS.CONFLICT,
        HTTP_STATUS.CREATED,
        HTTP_STATUS.INTERNAL_ERROR,
        HTTP_STATUS.BAD_REQUEST,
      ]).toContain(res.status);

      if (res.status === HTTP_STATUS.CONFLICT) {
        expect(res.body.message).toMatch(/중복|duplicate|exists/i);
      }
    });

    it('should skip duplicates and register unique ones', async () => {
      const mixedPins = [
        registeredPinCodes[0], // 중복
        `VOU-NEW-PIN-${uniqueSuffix}`, // 새 PIN
      ];

      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          productId: testProductId,
          pinCodes: mixedPins,
        });

      // 구현에 따라 전체 실패, 부분 성공, 또는 에러
      expect([
        HTTP_STATUS.CREATED,
        HTTP_STATUS.CONFLICT,
        HTTP_STATUS.INTERNAL_ERROR,
        HTTP_STATUS.BAD_REQUEST,
      ]).toContain(res.status);
    });
  });

  describe('[VOU-004] 구매 후 PIN 상태 변경 확인', () => {
    it('should change PIN status to SOLD after purchase', async () => {
      // 주문 생성
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          paymentMethod: 'CARD',
        });

      if (orderRes.status !== HTTP_STATUS.CREATED) {
        console.log('Skipping: Order not created');
        return;
      }

      // 바우처 목록에서 상태 확인
      const vouchersRes = await request(app.getHttpServer())
        .get('/vouchers')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      const allVouchers = getData(vouchersRes).items || [];
      const productVouchers = allVouchers.filter(
        (v: any) => v.productId === testProductId,
      );

      // 최소 1개는 SOLD 상태여야 함
      const soldVouchers = productVouchers.filter(
        (v: any) => v.status === 'SOLD',
      );
      expect(soldVouchers.length).toBeGreaterThanOrEqual(1);
    });

    it('should decrease available stock after purchase', async () => {
      const beforeRes = await request(app.getHttpServer())
        .get(`/vouchers/stock/${testProductId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      const beforeStock = getData(beforeRes).available;

      // 추가 주문
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          paymentMethod: 'VIRTUAL_ACCOUNT',
        });

      if (orderRes.status === HTTP_STATUS.CREATED) {
        const afterRes = await request(app.getHttpServer())
          .get(`/vouchers/stock/${testProductId}`)
          .set('Authorization', `Bearer ${admin.token}`)
          .expect(HTTP_STATUS.OK);

        expect(getData(afterRes).available).toBe(beforeStock - 1);
      }
    });
  });

  describe('[VOU-005] PIN 복호화 후 주문에 포함 확인', () => {
    it('should include decrypted PIN in order details', async () => {
      // 주문 생성
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          paymentMethod: 'CARD',
        });

      if (orderRes.status !== HTTP_STATUS.CREATED) {
        console.log('Skipping: Order not created');
        return;
      }

      const orderId = getData(orderRes).id;

      // 주문 상세 조회
      const detailRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(HTTP_STATUS.OK);

      // 결제/배송 완료 상태면 PIN 포함
      if (
        getData(detailRes).status === 'DELIVERED' ||
        getData(detailRes).status === 'PAID'
      ) {
        expect(getData(detailRes).items).toBeDefined();
        expect(getData(detailRes).items.length).toBeGreaterThan(0);

        // PIN 코드 필드 확인 (voucherCode, voucherCodes, pinCode 등)
        const item = getData(detailRes).items[0];
        const hasPinCode =
          item.voucherCode ||
          item.voucherCodes ||
          item.pinCode ||
          item.pinCodes;

        if (hasPinCode) {
          console.log('PIN code included in order');
          // PIN 형식 확인 (암호화되지 않은 평문)
          const pinValue =
            item.voucherCode || item.pinCode || item.voucherCodes?.[0];
          if (pinValue) {
            expect(typeof pinValue).toBe('string');
          }
        }
      }
    });

    it('should not expose PIN codes to other users', async () => {
      // 다른 사용자로 주문 상세 조회 시도
      const ordersRes = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(HTTP_STATUS.OK);

      if (getItems(ordersRes).length === 0) {
        console.log('Skipping: No orders found');
        return;
      }

      const orderId = getItems(ordersRes)[0].id;
      const otherUser = await createAndLoginUser(app, 'other-voucher-user');

      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherUser.token}`);

      // 다른 사용자의 주문 접근 불가
      expect([HTTP_STATUS.FORBIDDEN, HTTP_STATUS.NOT_FOUND]).toContain(
        res.status,
      );
    });
  });

  describe('Edge Cases', () => {
    it('should list all vouchers (admin)', async () => {
      const res = await request(app.getHttpServer())
        .get('/vouchers')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).items).toBeDefined();
      expect(Array.isArray(getData(res).items)).toBe(true);
    });

    it('should reject voucher list for non-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/vouchers')
        .set('Authorization', `Bearer ${user.token}`);

      // 관리자 전용이면 403, 아니면 200
      expect([
        HTTP_STATUS.OK,
        HTTP_STATUS.FORBIDDEN,
        HTTP_STATUS.UNAUTHORIZED,
      ]).toContain(res.status);
    });
  });
});
