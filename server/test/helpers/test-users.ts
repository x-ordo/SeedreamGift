/**
 * @file test-users.ts
 * @description 테스트 사용자 생성 및 인증 헬퍼
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { generateUniqueSuffix, getData } from './test-setup';

export interface TestUserCredentials {
  email: string;
  password: string;
  name: string;
  phone: string;
  role?: 'USER' | 'PARTNER' | 'ADMIN';
}

export interface AuthenticatedUser {
  user: TestUserCredentials;
  token: string;
  cookies?: string[];
  userId?: number;
}

/**
 * 테스트 사용자 생성용 템플릿
 */
export function createTestUserData(
  prefix: string,
  role: 'USER' | 'PARTNER' | 'ADMIN' = 'USER',
): TestUserCredentials {
  const suffix = generateUniqueSuffix();
  return {
    email: `${prefix}-${suffix}@test.com`,
    password: 'Password123!',
    name: `${prefix} Test User`,
    phone: `010-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}`,
    role,
  };
}

/**
 * 사용자 회원가입
 * 보안: role 필드는 회원가입 시 전송하지 않음 (모든 사용자는 USER로 생성)
 */
export async function registerUser(
  app: INestApplication,
  userData: TestUserCredentials,
): Promise<{ id: number; email: string; name: string; role: string }> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { role, ...registrationData } = userData;
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send(registrationData)
    .expect(201);

  return getData(res);
}

/**
 * set-cookie 헤더를 string[]로 정규화
 */
function normalizeCookies(setCookie: string | string[] | undefined): string[] {
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

/**
 * 사용자 로그인 후 토큰 반환
 */
export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ token: string; cookies: string[] }> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    token: getData(res).access_token,
    cookies: normalizeCookies(res.headers['set-cookie']),
  };
}

/**
 * 회원가입 + 로그인 한 번에 처리
 * 보안: role 필드는 회원가입 시 전송하지 않음 (모든 사용자는 USER로 생성)
 * ADMIN/PARTNER가 필요한 경우 loginAsSeededUser() 사용 권장
 */
export async function createAndLoginUser(
  app: INestApplication,
  prefix: string,
  role: 'USER' | 'PARTNER' | 'ADMIN' = 'USER',
): Promise<AuthenticatedUser> {
  const userData = createTestUserData(prefix, role);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { role: _role, ...registrationData } = userData;

  // 회원가입 - role 필드 제외 (보안: 권한 상승 방지)
  const registerRes = await request(app.getHttpServer())
    .post('/auth/register')
    .send(registrationData);

  // 로그인
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: userData.email, password: userData.password });

  return {
    user: userData,
    token: getData(loginRes).access_token,
    cookies: normalizeCookies(loginRes.headers['set-cookie']),
    userId: getData(registerRes)?.id,
  };
}

/**
 * 기존 시드 사용자로 로그인 (seeded data)
 */
export async function loginAsSeededUser(
  app: INestApplication,
  type: 'user' | 'admin' | 'partner' = 'user',
): Promise<AuthenticatedUser> {
  const credentials = {
    user: { email: 'user@example.com', password: 'test1234' },
    admin: { email: 'admin@example.com', password: 'admin1234' },
    partner: { email: 'partner@example.com', password: 'test1234' },
  };

  const cred = credentials[type];
  const res = await request(app.getHttpServer()).post('/auth/login').send(cred);

  if (res.status !== 200) {
    // admin2 시도 (테스트 코드에서 admin2@example.com 사용하는 경우)
    if (type === 'admin') {
      const res2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin2@example.com', password: 'user1234' });

      if (res2.status === 200) {
        return {
          user: {
            email: 'admin2@example.com',
            password: 'user1234',
            name: 'Admin2',
            phone: '010-0000-0000',
            role: 'ADMIN',
          },
          token: getData(res2).access_token,
          cookies: normalizeCookies(res2.headers['set-cookie']),
        };
      }
    }
    throw new Error(`Failed to login as seeded ${type}: ${res.status}`);
  }

  return {
    user: {
      email: cred.email,
      password: cred.password,
      name: `Seeded ${type}`,
      phone: '010-0000-0000',
      role: type.toUpperCase() as 'USER' | 'PARTNER' | 'ADMIN',
    },
    token: getData(res).access_token,
    cookies: normalizeCookies(res.headers['set-cookie']),
  };
}

/**
 * 인증 헤더 생성 헬퍼
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
