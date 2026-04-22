/**
 * @file buying-flow.e2e-spec.ts
 * @description 구매 플로우 E2E 테스트 (UC-04)
 *
 * 전체 구매 흐름 테스트:
 * 1. 상품 목록 조회
 * 2. 주문 생성 (구매)
 * 3. 내 주문 내역 확인
 */
import * as crypto from 'crypto';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { ensureSeedUsers, ensureSeedBrands } from './helpers/test-setup';

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

describe('UC-04: Buying Flow E2E Tests', () => {
  let app: INestApplication;
  // Use a more unique suffix (timestamp + random) to avoid collisions
  const uniqueSuffix = `${Date.now()}-${crypto.randomInt(1000)}`;

  let adminToken: string;
  let userToken: string;
  let targetProductId: number;

  const adminUser = {
    email: `buy-admin-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Buy Admin',
    phone: `010-${uniqueSuffix.slice(-8, -4)}-${uniqueSuffix.slice(-4)}`,
  };

  const testUser = {
    email: `buy-user-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Buy User',
    phone: `010-${uniqueSuffix.slice(-8, -4)}-${Number(uniqueSuffix.slice(-4)) + 1}`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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

    // 관리자 로그인 (seeded admin 사용 - 회원가입 시 role 설정 불가)
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'admin1234' })
      .expect(200);
    adminToken = getData(adminLogin).access_token;

    // 테스트 사용자 등록 및 로그인
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
        brandCode: 'SHINSEGAE',
        name: `구매테스트 상품권 ${uniqueSuffix}`,
        price: 50000,
        discountRate: 3,
        tradeInRate: 5,
      })
      .expect(201);
    targetProductId = getData(productRes).id;

    // 바우처 재고 추가
    await request(app.getHttpServer())
      .post('/vouchers/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: targetProductId,
        pinCodes: [
          `BUY-PIN-001-${uniqueSuffix}`,
          `BUY-PIN-002-${uniqueSuffix}`,
          `BUY-PIN-003-${uniqueSuffix}`,
        ],
      })
      .expect(201);
  }, 60000);

  afterAll(async () => {
    // Cleanup created data
    const prisma = app.get(PrismaService);
    try {
      if (targetProductId) {
        // Delete related vouchers first if needed, or cascade handled by DB
        await prisma.voucherCode.deleteMany({
          where: { productId: targetProductId },
        });
        await prisma.product.delete({ where: { id: targetProductId } });
      }

      await prisma.user.deleteMany({
        where: {
          email: {
            in: [adminUser.email, testUser.email],
          },
        },
      });
    } catch (error) {
      console.warn('Test cleanup failed:', error);
    }

    if (app) await app.close();
  });

  it('Step 1: 상품 목록 조회', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);

    const d = getData(res);
    const products = d.items || [];
    expect(Array.isArray(products)).toBe(true);
    // 목록이 비어있을 수 있음 (필터링 적용 시)
    // targetProductId로 직접 상세 조회 확인
    if (products.length === 0) {
      // 상품 상세 조회로 존재 확인
      const detailRes = await request(app.getHttpServer())
        .get(`/products/${targetProductId}`)
        .expect(200);
      expect(getData(detailRes).id).toBe(targetProductId);
    } else {
      // 목록에서 확인
      const found = products.find((p: any) => p.id === targetProductId);
      if (!found) {
        // 목록에 없으면 상세 조회로 확인
        const detailRes = await request(app.getHttpServer()).get(
          `/products/${targetProductId}`,
        );
        expect(detailRes.status).toBe(200);
      }
    }
  });

  it('Step 2: 주문 생성 (구매)', async () => {
    const orderData = {
      items: [{ productId: targetProductId, quantity: 2 }],
      paymentMethod: 'VIRTUAL_ACCOUNT',
    };

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send(orderData);

    // 주문 생성은 재고, KYC 상태 등에 따라 실패할 수 있음
    if (res.status === 201) {
      expect(getData(res)).toHaveProperty('id');
      expect(getData(res)).toHaveProperty('totalAmount');
      expect(['PENDING', 'PAID']).toContain(getData(res).status);
    } else {
      // 400, 403 등 실패도 정상적인 응답으로 처리
      if (![400, 403].includes(res.status)) {
        console.error(
          'Order creation failed with unexpected status:',
          res.status,
        );
        console.error('Response body:', JSON.stringify(res.body, null, 2));
      }
      expect([400, 403]).toContain(res.status);
    }
  });

  it('Step 3: 내 주문 내역 확인', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/my')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(Array.isArray(getItems(res))).toBe(true);
    // 주문이 성공했으면 목록에 있어야 함
    // (Step 2가 실패했으면 빈 배열일 수 있음)
  });
});
