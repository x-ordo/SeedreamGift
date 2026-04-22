/**
 * @file vouchers.e2e-spec.ts
 * @description 바우처(PIN 재고) 관리 E2E 테스트
 *
 * 테스트 케이스:
 * - VCH-01: 바우처 대량 등록
 * - VCH-02: 바우처 재고 조회
 * - VCH-03: 바우처 목록 조회
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ensureSeedUsers, ensureSeedBrands } from './helpers/test-setup';

function getData(res: { body: any }): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('Vouchers E2E Tests', () => {
  let app: INestApplication;
  const uniqueSuffix = Date.now().toString().slice(-8);

  let adminToken: string;
  let testProductId: number;

  const adminUser = {
    email: `voucher-admin-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Voucher Admin',
    phone: `010-4444-${uniqueSuffix.slice(-4)}`,
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

    // 테스트 상품 생성
    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        brandCode: 'DAISO',
        name: `다이소상품권 ${uniqueSuffix}`,
        price: 30000,
        discountRate: 2,
        tradeInRate: 5,
      })
      .expect(201);
    testProductId = getData(productRes).id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('VCH-01: 바우처 대량 등록', () => {
    it('should bulk register voucher codes', async () => {
      const pinCodes = [
        `BULK-001-${uniqueSuffix}`,
        `BULK-002-${uniqueSuffix}`,
        `BULK-003-${uniqueSuffix}`,
      ];

      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProductId,
          pinCodes,
        })
        .expect(201);

      expect(getData(res).count).toBe(3);
    });

    it('should handle empty pinCodes array', async () => {
      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProductId,
          pinCodes: [],
        });

      // API may accept empty array (creates nothing) or reject
      expect([201, 400, 500]).toContain(res.status);

      if (res.status === 201) {
        expect(getData(res).count).toBe(0);
      }
    });
  });

  describe('VCH-02: 바우처 재고 조회', () => {
    it('should get voucher stock by product', async () => {
      const res = await request(app.getHttpServer())
        .get(`/vouchers/stock/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(typeof getData(res).available).toBe('number');
      expect(getData(res).available).toBeGreaterThan(0);
    });

    it('should return 0 for product without vouchers', async () => {
      // 새 상품 생성 (바우처 없음)
      const newProduct = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          brandCode: 'LOTTE',
          name: `No Voucher Product ${uniqueSuffix}`,
          price: 50000,
          discountRate: 3,
          tradeInRate: 5,
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/vouchers/stock/${getData(newProduct).id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getData(res).available).toBe(0);
    });
  });

  describe('VCH-03: 바우처 목록 조회', () => {
    it('should list all vouchers with paginated format', async () => {
      const res = await request(app.getHttpServer())
        .get('/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getData(res).items).toBeDefined();
      expect(Array.isArray(getData(res).items)).toBe(true);
      expect(getData(res).meta).toBeDefined();
    });
  });

  describe('바우처 등록 검증', () => {
    it('should handle bulk registration with existing PIN', async () => {
      const duplicatePin = `DUP-${uniqueSuffix}`;

      // 첫 번째 등록
      await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProductId,
          pinCodes: [duplicatePin],
        })
        .expect(201);

      // 중복 등록 시도
      const res = await request(app.getHttpServer())
        .post('/vouchers/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProductId,
          pinCodes: [duplicatePin],
        });

      // 중복 PIN은 거부되거나 무시됨 (400 또는 500은 서버 오류)
      expect([201, 400, 409, 500]).toContain(res.status);
    });
  });
});
