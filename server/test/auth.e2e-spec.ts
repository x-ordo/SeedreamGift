/**
 * @file auth.e2e-spec.ts
 * @description 인증 관련 E2E 테스트
 *
 * 테스트 케이스:
 * - AUTH-01: 정상 회원가입
 * - AUTH-02: 중복 이메일 가입
 * - AUTH-03: 정상 로그인
 * - AUTH-04: 잘못된 비밀번호
 * - AUTH-05: 토큰으로 내 정보 조회
 * - AUTH-06: 만료/무효 토큰 사용
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

/**
 * TransformInterceptor wraps success responses in { success, data, ... }.
 * Unwrap transparently so tests read the actual payload.
 */
function getData(res: { body: any }): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

/**
 * set-cookie 헤더를 string[]로 정규화
 */
function normalizeCookies(setCookie: string | string[] | undefined): string[] {
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  const uniqueSuffix = Date.now().toString().slice(-8);

  const testUser = {
    email: `auth-test-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Auth Test User',
    phone: `010-9999-${uniqueSuffix.slice(-4)}`,
  };

  let userToken: string;

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
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('AUTH-01: 정상 회원가입', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(getData(res)).toHaveProperty('id');
      expect(getData(res).email).toBe(testUser.email);
      expect(getData(res).name).toBe(testUser.name);
      expect(getData(res).role).toBe('USER');
      expect(getData(res)).not.toHaveProperty('password'); // 비밀번호 미노출
    });
  });

  describe('AUTH-02: 중복 이메일 가입', () => {
    it('should reject duplicate email registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.message).toBeDefined();
    });
  });

  describe('AUTH-03: 정상 로그인', () => {
    it('should login and return JWT token with HttpOnly cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(getData(res)).toHaveProperty('access_token');
      expect(getData(res)).not.toHaveProperty('refresh_token'); // Body에는 없어야 함
      expect(typeof getData(res).access_token).toBe('string');

      // Cookie 확인
      const cookies = normalizeCookies(res.headers['set-cookie']);
      expect(cookies).toBeDefined();
      expect(
        cookies.some(
          (c: string) => c.includes('refresh_token') && c.includes('HttpOnly'),
        ),
      ).toBe(true);

      userToken = getData(res).access_token;
    });
  });

  describe('AUTH-04: 잘못된 비밀번호', () => {
    it('should reject login with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(res.body.message).toBeDefined();
    });

    it('should reject login with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password123!',
        })
        .expect(401);
    });
  });

  describe('AUTH-05: 토큰으로 내 정보 조회', () => {
    it('should return user info with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(getData(res).email).toBe(testUser.email);
      expect(getData(res).name).toBe(testUser.name);
      expect(getData(res)).not.toHaveProperty('password');
    });
  });

  describe('AUTH-06: 무효 토큰 사용', () => {
    it('should reject request without token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with malformed token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'NotBearer token')
        .expect(401);
    });
  });

  describe('AUTH-07: 토큰 갱신 (Cookie)', () => {
    it('should refresh access token using valid cookie', async () => {
      // 1. 로그인하여 쿠키 획득
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const cookies = normalizeCookies(loginRes.headers['set-cookie']);

      // 2. Refresh 요청
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookies)
        .expect(200); // Created (Post default) or 200 depending on controller

      expect(getData(refreshRes)).toHaveProperty('access_token');
      expect(refreshRes.headers['set-cookie']).toBeDefined(); // New cookie (rotated)
    });

    it('should reject refresh without cookie', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });
  });

  describe('회원가입 검증', () => {
    it('should reject registration with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
          name: 'Test',
          phone: '010-1234-5678',
        })
        .expect(400);
    });

    it('should reject registration with weak password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `weak-pass-${uniqueSuffix}@test.com`,
          password: '123', // 너무 짧음
          name: 'Test',
          phone: '010-1234-5678',
        })
        .expect(400);
    });

    it('should reject registration with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `missing-${uniqueSuffix}@test.com`,
          // password 누락
        })
        .expect(400);
    });
  });
});
