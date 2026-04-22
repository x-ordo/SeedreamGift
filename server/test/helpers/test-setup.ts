/**
 * @file test-setup.ts
 * @description 공통 테스트 설정 및 앱 초기화 헬퍼
 */
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '../../src/shared/prisma/prisma.service';

/**
 * 시드 사용자 보장 - admin, user, partner가 DB에 존재하도록 upsert
 * E2E 테스트 실행 전에 호출하여 loginAsSeededUser()가 동작하도록 보장
 */
export async function ensureSeedUsers(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const userPassword = await bcrypt.hash('test1234', 10);
  const adminPassword = await bcrypt.hash('admin1234', 10);

  const seedUsers = [
    {
      email: 'admin@example.com',
      name: 'Super Admin',
      phone: '010-0000-0000',
      password: adminPassword,
      role: 'ADMIN' as const,
      kycStatus: 'VERIFIED' as const,
    },
    {
      email: 'user@example.com',
      name: '홍길동',
      phone: '010-1234-5678',
      password: userPassword,
      role: 'USER' as const,
      kycStatus: 'VERIFIED' as const,
    },
    {
      email: 'partner@example.com',
      name: '파트너상사',
      phone: '010-9876-5432',
      password: userPassword,
      role: 'PARTNER' as const,
      kycStatus: 'VERIFIED' as const,
    },
  ];

  for (const u of seedUsers) {
    const existing = await prisma.user.findFirst({ where: { email: u.email } });
    if (!existing) {
      await prisma.user.create({ data: u });
    } else if (existing.role !== u.role) {
      // role이 다르면 업데이트 (예: USER → ADMIN)
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: u.role, password: u.password },
      });
    }
  }
}

/**
 * 시드 브랜드 보장 - 테스트에서 상품 생성 시 필요한 브랜드가 존재하도록
 */
export async function ensureSeedBrands(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);

  const brands = [
    {
      code: 'HYUNDAI',
      name: '현대',
      color: '#00703C',
      order: 1,
      isActive: true,
    },
    {
      code: 'SHINSEGAE',
      name: '신세계',
      color: '#E31837',
      order: 2,
      isActive: true,
    },
    { code: 'LOTTE', name: '롯데', color: '#ED1C24', order: 3, isActive: true },
    {
      code: 'DAISO',
      name: '다이소',
      color: '#FF6B00',
      order: 5,
      isActive: true,
    },
    { code: 'CU', name: 'CU', color: '#00A651', order: 6, isActive: true },
  ];

  for (const b of brands) {
    const existing = await prisma.brand.findFirst({ where: { code: b.code } });
    if (!existing) {
      await prisma.brand.create({ data: b });
    }
  }
}

/**
 * 테스트용 NestJS 앱 초기화 + 시드 데이터 보장
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());

  // 전역 미들웨어: E2E 테스트 시 connectip 헤더 강제 주입 (IP 필터링 대응)
  app.use((req: any, res: any, next: any) => {
    req.headers['connectip'] = req.headers['connectip'] || '127.0.0.1';
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  // 시드 유저/브랜드 보장
  await ensureSeedUsers(app);
  await ensureSeedBrands(app);

  return app;
}

/**
 * 테스트 앱 종료
 */
export async function closeTestApp(app: INestApplication): Promise<void> {
  if (app) {
    await app.close();
  }
}

/**
 * 고유한 접미사 생성 (테스트 데이터 충돌 방지)
 */
export function generateUniqueSuffix(): string {
  return `${Date.now().toString().slice(-8)}-${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * 테스트 타임아웃 설정 값
 */
export const TEST_TIMEOUT = 30000;

/**
 * TransformInterceptor 래핑된 응답에서 data를 추출하는 헬퍼
 * 성공 응답: { success, data, statusCode, timestamp, traceId } → data 반환
 * 에러 응답: { statusCode, message, error } → body 그대로 반환
 */
export function getData(res: { body: any }): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

/** getData + unwrap paginated { items, meta } → items array */
export function getItems(res: { body: any }): any[] {
  const data = getData(res);
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  return [];
}

/**
 * API 응답 상태 코드 상수
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;
