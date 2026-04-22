import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getData,
  HTTP_STATUS,
  TEST_TIMEOUT,
} from './helpers/test-setup';
import { createAndLoginUser, loginAsSeededUser } from './helpers/test-users';
import { createTestProduct, createTestVouchers } from './helpers/test-data';
import { PrismaService } from '../src/shared/prisma/prisma.service';

describe('Logistics & Shipping Flow (실물 상품 및 배송 테스트)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let buyerToken: string;

  // 상품
  let physicalProduct: { id: number; name: string; price: number };
  let digitalProduct: { id: number; name: string; price: number };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // Admin 로그인
    const admin = await loginAsSeededUser(app, 'admin');
    adminToken = admin.token;

    // 구매자 생성
    const buyer = await createAndLoginUser(app, 'logistics-buyer');
    buyerToken = buyer.token;

    // 1. 실물 상품 생성 (배송 필요)
    const pPhysical = await createTestProduct(app, adminToken, {
      name: '실물 상품 테스트 (배송)',
      price: 50000,
      discountRate: 0,
      // @ts-expect-error - DTO might not differ in test helper yet, but backend accepts it
      type: 'PHYSICAL',
      shippingMethod: 'DELIVERY',
    });
    physicalProduct = { id: pPhysical.id, name: pPhysical.name, price: 50000 };

    // 2. 디지털 상품 생성 (배송 불필요)
    const pDigital = await createTestProduct(app, adminToken, {
      name: '디지털 상품 테스트',
      price: 10000,
      discountRate: 0,
      // @ts-expect-error - DTO might not differ in test helper yet
      type: 'DIGITAL',
      shippingMethod: 'NONE',
    });
    digitalProduct = { id: pDigital.id, name: pDigital.name, price: 10000 };

    // 바우처(재고) 등록 (실물 상품도 재고 관리는 바우처 테이블 사용한다고 가정하거나, bypass)
    // NOTE: 현재 로직상 실물 상품도 VoucherCode가 있어야 주문 가능함 (재고 관리 일원화)
    await createTestVouchers(app, adminToken, physicalProduct.id, 10);
    await createTestVouchers(app, adminToken, digitalProduct.id, 10);
  }, TEST_TIMEOUT * 2);

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('Logistics & Shipping Edge Cases', () => {
    it('L-01: 실물 상품 주문 시 배송 방법이 없으면 400 에러를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: physicalProduct.id, quantity: 1 }],
          paymentMethod: 'VIRTUAL_ACCOUNT',
        });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(JSON.stringify(res.body)).toMatch(/배송 방법|shippingMethod/);
    });

    it('L-02: 실물 상품 주문 시 수령인 정보 누락 시 400 에러를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: physicalProduct.id, quantity: 1 }],
          paymentMethod: 'VIRTUAL_ACCOUNT',
          shippingMethod: 'DELIVERY',
        });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(JSON.stringify(res.body)).toMatch(/수령인|recipientName|recipientAddr|recipientPhone|recipientZip/);
    });

    it('L-03: 실물 상품 정상 조합 요청 시 주문이 생성된다', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: physicalProduct.id, quantity: 1 }],
          paymentMethod: 'VIRTUAL_ACCOUNT',
          shippingMethod: 'DELIVERY',
          recipientName: '홍길동',
          recipientPhone: '010-1234-5678',
          recipientAddr: '서울시 강남구 테헤란로 123',
          recipientZip: '12345',
        })
        .expect(HTTP_STATUS.CREATED);

      const orderData = getData(res);
      expect(orderData.shippingMethod).toBe('DELIVERY');
      expect(orderData.recipientName).toBe('홍길동');
    });

    it('L-04: 디지털 상품은 배송 정보 없이도 주문 가능하다', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{ productId: digitalProduct.id, quantity: 1 }],
          paymentMethod: 'VIRTUAL_ACCOUNT',
        })
        .expect(HTTP_STATUS.CREATED);

      const orderData = getData(res);
      expect(orderData.items.length).toBe(1);
      expect(orderData.shippingMethod).toBeFalsy();
    });

    it('L-05: 실물 + 디지털 혼합 주문 시 배송 정보가 필수이다', async () => {
      // 1. 배송 정보 없이 실패 모의
      const resFail = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [
            { productId: physicalProduct.id, quantity: 1 },
            { productId: digitalProduct.id, quantity: 2 },
          ],
          paymentMethod: 'VIRTUAL_ACCOUNT',
        });

      expect(resFail.status).toBe(HTTP_STATUS.BAD_REQUEST);

      // 2. 배송 정보 포함 시 성공
      const resSuccess = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [
            { productId: physicalProduct.id, quantity: 1 },
            { productId: digitalProduct.id, quantity: 2 },
          ],
          paymentMethod: 'VIRTUAL_ACCOUNT',
          shippingMethod: 'DELIVERY',
          recipientName: '김철수',
          recipientPhone: '010-9876-5432',
          recipientAddr: '부산시 해운대구',
          recipientZip: '54321',
        })
        .expect(HTTP_STATUS.CREATED);

      const orderData = getData(resSuccess);
      expect(orderData.items.length).toBe(2);
      expect(orderData.recipientName).toBe('김철수');
    });
  });
});
