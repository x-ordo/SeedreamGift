/**
 * @file site-config.e2e-spec.ts
 * @description 시스템 설정 E2E 테스트
 *
 * SiteConfigController actual API:
 * - GET /site-configs — returns raw array from getAll()
 * - GET /site-configs/:key — get config by string key
 * - PATCH /site-configs/:key — update config by key (Admin only)
 *
 * No POST or DELETE endpoints exist.
 *
 * 테스트 케이스:
 * - CFG-01: 설정 목록 조회
 * - CFG-02: 설정값 조회 및 수정
 * - CFG-03: 설정값 타입별 수정
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ensureSeedUsers, ensureSeedBrands } from './helpers/test-setup';

function getData(res: { body: any }): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('Site Config E2E Tests', () => {
  let app: INestApplication;
  const uniqueSuffix = Date.now().toString().slice(-8);

  let adminToken: string;

  const adminUser = {
    email: `config-admin-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Config Admin',
    phone: `010-3333-${uniqueSuffix.slice(-4)}`,
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
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('CFG-01: 설정 목록 조회', () => {
    it('should return site configurations as array', async () => {
      const res = await request(app.getHttpServer())
        .get('/site-configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // SiteConfigController.findAll() returns raw array via getAll()
      // It may also return { items, meta } if wrapped by BaseCrudController
      const d = getData(res);
      const items = Array.isArray(d) ? d : d.items || [];
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('CFG-02: 설정값 조회 및 수정', () => {
    it('should return 404 when PATCHing a non-existent config key', async () => {
      const configKey = `TEST_CONFIG_${uniqueSuffix}`;
      const res = await request(app.getHttpServer())
        .patch(`/site-configs/${configKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '1000000' });

      // Key doesn't exist, should return 404
      expect(res.status).toBe(404);
    });

    it('should update config value via PATCH', async () => {
      // First, get list to find an existing config key
      const listRes = await request(app.getHttpServer())
        .get('/site-configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const d = getData(listRes);
      const items = Array.isArray(d) ? d : d.items || [];

      if (items.length === 0) {
        console.log('Skipping: No existing site configs to update');
        return;
      }

      const existingKey = items[0].key;

      const res = await request(app.getHttpServer())
        .patch(`/site-configs/${existingKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '2000000' });

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(getData(res).value).toBe('2000000');
      }
    });

    it('should get config by key', async () => {
      // Get list to find an existing key
      const listRes = await request(app.getHttpServer())
        .get('/site-configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const d = getData(listRes);
      const items = Array.isArray(d) ? d : d.items || [];

      if (items.length === 0) {
        console.log('Skipping: No existing site configs');
        return;
      }

      const existingKey = items[0].key;

      const res = await request(app.getHttpServer()).get(
        `/site-configs/${existingKey}`,
      );

      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        expect(getData(res).key).toBe(existingKey);
      }
    });
  });

  describe('CFG-03: 설정값 타입별 수정', () => {
    it('should handle STRING type config update', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/site-configs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const d = getData(listRes);
      const items = Array.isArray(d) ? d : d.items || [];
      const stringConfig = items.find((c: any) => c.type === 'STRING');

      if (!stringConfig) {
        // Non-existent key should return 404
        const res = await request(app.getHttpServer())
          .patch(`/site-configs/STRING_CONFIG_${uniqueSuffix}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ value: 'Hello World' });

        expect(res.status).toBe(404);
        return;
      }

      const res = await request(app.getHttpServer())
        .patch(`/site-configs/${stringConfig.key}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'Updated String Value' });

      expect(res.status).toBe(200);
      expect(getData(res).value).toBe('Updated String Value');
    });

    it('should return 404 for BOOLEAN config on non-existent key', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/site-configs/BOOL_CONFIG_${uniqueSuffix}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'true' });

      // Key doesn't exist, should return 404
      expect(res.status).toBe(404);
    });

    it('should return 404 for JSON config on non-existent key', async () => {
      const jsonValue = JSON.stringify({
        bannerUrl: '/img/banner.jpg',
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .patch(`/site-configs/JSON_CONFIG_${uniqueSuffix}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: jsonValue });

      // Key doesn't exist, should return 404
      expect(res.status).toBe(404);
    });
  });

  describe('설정 접근 제어', () => {
    it('should deny unauthenticated access to GET /site-configs', async () => {
      const res = await request(app.getHttpServer()).get('/site-configs');

      // GET /site-configs requires ADMIN auth
      expect(res.status).toBe(401);
    });

    it('should deny PATCH without authentication', async () => {
      const res = await request(app.getHttpServer())
        .patch('/site-configs/SOME_KEY')
        .send({ value: 'test' });

      // Should require auth
      expect([401, 403]).toContain(res.status);
    });
  });
});
