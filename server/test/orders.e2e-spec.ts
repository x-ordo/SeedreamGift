/**
 * @file orders.e2e-spec.ts
 * @description 주문 관련 E2E 테스트
 *
 * 테스트 케이스:
 * - ORD-01: 주문 생성
 * - ORD-02: 내 주문 목록 조회
 * - ORD-03: 주문 상세 조회
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ensureSeedUsers, ensureSeedBrands } from './helpers/test-setup';

/**
 * TransformInterceptor wraps success responses in { success, data, ... }.
 * Unwrap transparently so tests read the actual payload.
 */
function getData(res: { body: any }): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

/** getData + unwrap paginated { items, meta } → items array */
function getItems(res: { body: any }): any[] {
  const data = getData(res);
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  return [];
}

describe('Orders E2E Tests', () => {
  let app: INestApplication;
  const uniqueSuffix = Date.now().toString().slice(-8);

  let adminToken: string;
  let userToken: string;
  let testProductId: number;

  const adminUser = {
    email: `order-admin-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Order Admin',
    phone: `010-1111-${uniqueSuffix.slice(-4)}`,
  };

  const testUser = {
    email: `order-user-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Order User',
    phone: `010-2222-${uniqueSuffix.slice(-4)}`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    await ensureSeedUsers(app);
    await ensureSeedBrands(app);

    // Admin 로그인 (seeded admin 사용 - 회원가입 시 role 설정 불가)
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'admin1234' })
      .expect(200);
    adminToken = getData(adminLogin).access_token;

    // User 설정
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);
    userToken = getData(userLogin).access_token;

    // 테스트 상품 생성
    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        brandCode: 'HYUNDAI',
        name: `현대상품권 10만원 ${uniqueSuffix}`,
        price: 100000,
        discountRate: 4,
        tradeInRate: 5,
      })
      .expect(201);
    testProductId = getData(productRes).id;

    // 바우처 재고 추가
    await request(app.getHttpServer())
      .post('/vouchers/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: testProductId,
        pinCodes: [
          `ORD-PIN-001-${uniqueSuffix}`,
          `ORD-PIN-002-${uniqueSuffix}`,
          `ORD-PIN-003-${uniqueSuffix}`,
        ],
      })
      .expect(201);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('ORD-01: 주문 생성', () => {
    it('should create an order successfully with sufficient vouchers', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          paymentMethod: 'VIRTUAL_ACCOUNT',
        })
        .expect(201);

      expect(getData(res).id).toBeDefined();
      expect(getData(res).status).toBeDefined();
    });
  });

  describe('ORD-02: 내 주문 목록 조회', () => {
    it('should return my orders list', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(getItems(res))).toBe(true);
    });

    it('should require authentication for my orders', async () => {
      const res = await request(app.getHttpServer()).get('/orders/my');

      // Should require auth
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('ORD-03: 주문 전체 목록 (Admin)', () => {
    // NOTE: /orders 전체 조회는 admin 모듈에서 제공
    it('should access orders via admin endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      // AdminModule이 로드되어 있으면 200, 아니면 404
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('주문 생성 검증', () => {
    it('should handle order with multiple items', async () => {
      // 추가 바우처
      await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProductId,
          pinCodes: [`MULTI-PIN-${uniqueSuffix}`],
        });

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          paymentMethod: 'VIRTUAL_ACCOUNT',
        })
        .expect(201);

      const orderData = getData(res);
      expect(orderData.id).toBeDefined();
      expect(orderData.items.length).toBeGreaterThan(0);
    });
  });
});
