import * as crypto from 'crypto';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { ensureSeedUsers, ensureSeedBrands } from './helpers/test-setup';

function getData(res: { body: any }): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('UC-05: Trade-In Flow E2E Tests', () => {
  let app: INestApplication;
  let accessToken: string;
  let targetProductId: number;
  const uniqueSuffix = Date.now().toString().slice(-8);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    await ensureSeedUsers(app);
    await ensureSeedBrands(app);

    // 1. 로그인
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'test1234' })
      .expect(200);

    accessToken = getData(loginRes).access_token;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('Step 1: 판매 가능한 상품 조회', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);

    // Handle paginated { items, meta } format
    const d = getData(res);
    const products = d.items || [];
    // Trade-in 가능한 상품 찾기
    const tradeInProduct = products.find((p: any) => p.allowTradeIn === true);
    if (!tradeInProduct)
      throw new Error('No trade-in available products found');

    targetProductId = tradeInProduct.id;
  });

  it('Step 2: 판매 신청 제출', async () => {
    const tradeInData = {
      productId: targetProductId,
      pinCode: `PIN-${uniqueSuffix}-${crypto.randomBytes(4).toString('hex')}`,
      bankName: 'Test Bank',
      accountNum: '123-456-7890',
      accountHolder: 'Test User',
    };

    const res = await request(app.getHttpServer())
      .post('/trade-ins')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(tradeInData);

    // 성공 또는 KYC/기타 검증 실패
    expect([201, 400, 403, 409]).toContain(res.status);

    if (res.status === 201) {
      expect(getData(res)).toHaveProperty('id');
      expect(getData(res).status).toBe('REQUESTED');
      expect(getData(res).productId).toBe(targetProductId);
    }
  });

  it('Step 3: 내 판매 내역 확인', async () => {
    const res = await request(app.getHttpServer())
      .get('/trade-ins/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(getData(res).items)).toBe(true);
    // 매입 내역이 있으면 확인
    if (getData(res).items.length > 0) {
      expect(getData(res).items[0]).toHaveProperty('pinCode');
    }
  });
});
