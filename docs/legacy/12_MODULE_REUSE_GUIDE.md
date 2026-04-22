# NestJS 모듈 재사용 가이드

> 본 문서는 W기프트 백엔드의 핵심 모듈을 다른 프로젝트에서 재사용하기 위한 전략과 구현 방법을 설명합니다.

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [재사용 가능한 모듈](#2-재사용-가능한-모듈)
3. [Core 패키지 구조](#3-core-패키지-구조)
4. [AuthModule 재사용](#4-authmodule-재사용)
5. [Config 외부화](#5-config-외부화)
6. [BaseCrudService 활용](#6-basecrudservice-활용)
7. [테스트 전략](#7-테스트-전략)
8. [새 프로젝트 설정 가이드](#8-새-프로젝트-설정-가이드)
9. [트러블슈팅](#9-트러블슈팅)
10. [향후 개선 방향](#10-향후-개선-방향)

---

## 1. 아키텍처 개요

### 1.1 의존성 역전 원칙 (DIP)

핵심 모듈이 구체적인 구현에 의존하지 않고 **인터페이스에 의존**하도록 설계되었습니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         새 프로젝트                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────┐         ┌──────────────────┐                 │
│   │  MembersModule   │         │  ProductModule   │  ← 비즈니스 모듈 │
│   │  (구현체 제공)    │         │                  │                 │
│   └────────┬─────────┘         └──────────────────┘                 │
│            │                                                         │
│            │ implements IUserAuthRepository                          │
│            ▼                                                         │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      Core 모듈 (재사용)                       │   │
│   │                                                              │   │
│   │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │   │
│   │   │ AuthModule  │   │ConfigModule │   │ CryptoModule│       │   │
│   │   │ (인터페이스) │   │  (동적설정)  │   │             │       │   │
│   │   └─────────────┘   └─────────────┘   └─────────────┘       │   │
│   │                                                              │   │
│   │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │   │
│   │   │ AuditModule │   │HealthModule │   │BaseCrudSvc  │       │   │
│   │   │             │   │             │   │             │       │   │
│   │   └─────────────┘   └─────────────┘   └─────────────┘       │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 설계 원칙

| 원칙 | 적용 방식 |
|------|----------|
| **의존성 역전** | AuthModule이 IUserAuthRepository 인터페이스에 의존 |
| **설정 외부화** | 하드코딩 값 → 환경변수 + ConfigService |
| **단일 책임** | 각 모듈이 하나의 도메인만 담당 |
| **개방-폐쇄** | 확장에 열려있고 수정에 닫혀있음 |

---

## 2. 재사용 가능한 모듈

### 2.1 모듈별 재사용성 평가

| 모듈 | 재사용성 | 의존성 | 커스터마이징 |
|------|:--------:|--------|-------------|
| **AuthModule** | ⭐⭐⭐ | IUserAuthRepository 구현체 | 인터페이스 구현 교체 |
| **CryptoModule** | ⭐⭐⭐ | 환경변수(ENCRYPTION_KEY) | 없음 |
| **ConfigModule** | ⭐⭐⭐ | 없음 | config 파일 추가 |
| **AuditModule** | ⭐⭐⭐ | PrismaModule, AuditLog 스키마 | 로그 필드 확장 |
| **HealthModule** | ⭐⭐⭐ | 없음 | 그대로 사용 |
| **LoggerModule** | ⭐⭐⭐ | 없음 | 로그 포맷 설정 |
| **PrismaModule** | ⭐⭐ | Prisma 스키마 | 스키마 확장 |
| **BaseCrudService** | ⭐⭐⭐ | 없음 (추상 클래스) | 상속하여 확장 |

### 2.2 의존성 그래프

```
AuthModule
├── IUserAuthRepository (interface) ← 외부에서 구현체 주입
├── JwtModule
├── PassportModule
├── ConfigModule (auth.config.ts)
└── PrismaModule (RefreshToken만 직접 접근)

CryptoModule
└── ConfigService (ENCRYPTION_KEY)

AuditModule
└── PrismaModule (AuditLog)

BaseCrudService
└── CrudDelegate<T> (Prisma 모델 delegate)
```

---

## 3. Core 패키지 구조

### 3.1 권장 디렉토리 구조

Core 모듈을 별도 패키지로 분리할 경우:

```
@myorg/nestjs-core/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Public exports
│   │
│   ├── auth/
│   │   ├── index.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── jwt.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   └── ...
│   │   └── interfaces/
│   │       └── user-auth.repository.ts  # 핵심 인터페이스
│   │
│   ├── config/
│   │   ├── index.ts
│   │   ├── auth.config.ts
│   │   ├── rate-limit.config.ts
│   │   ├── pagination.config.ts
│   │   └── env.validation.ts
│   │
│   ├── crypto/
│   │   ├── index.ts
│   │   ├── crypto.module.ts
│   │   └── crypto.service.ts
│   │
│   ├── audit/
│   │   ├── index.ts
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts
│   │   └── audit.interceptor.ts
│   │
│   ├── health/
│   │   ├── index.ts
│   │   ├── health.module.ts
│   │   └── health.controller.ts
│   │
│   ├── logger/
│   │   ├── index.ts
│   │   ├── logger.module.ts
│   │   └── logger.middleware.ts
│   │
│   └── base/
│       ├── index.ts
│       ├── base-crud.service.ts
│       └── pagination.dto.ts
│
└── prisma/
    └── schema.prisma               # 공통 스키마 (RefreshToken, AuditLog)
```

### 3.2 Public API (index.ts)

```typescript
// src/index.ts
// Auth
export { AuthModule } from './auth/auth.module';
export { AuthService } from './auth/auth.service';
export { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
export { RolesGuard } from './auth/guards/roles.guard';
export { Roles } from './auth/decorators/roles.decorator';
export { CurrentUser } from './auth/decorators/current-user.decorator';
export {
  IUserAuthRepository,
  USER_AUTH_REPOSITORY,
  UserAuthData,
  CreateUserData,
  UpdateProfileData,
} from './auth/interfaces/user-auth.repository';

// Config
export { authConfig, AuthConfig } from './config/auth.config';
export { rateLimitConfig, RateLimitConfig } from './config/rate-limit.config';
export { paginationConfig, PaginationConfig } from './config/pagination.config';
export { envValidationSchema } from './config/env.validation';

// Crypto
export { CryptoModule } from './crypto/crypto.module';
export { CryptoService } from './crypto/crypto.service';

// Audit
export { AuditModule } from './audit/audit.module';
export { AuditService } from './audit/audit.service';
export { AuditInterceptor } from './audit/audit.interceptor';

// Health
export { HealthModule } from './health/health.module';

// Logger
export { LoggerModule } from './logger/logger.module';
export { LoggerMiddleware } from './logger/logger.middleware';

// Base
export {
  BaseCrudService,
  CrudDelegate,
  PAGINATION,
} from './base/base-crud.service';
export {
  PaginatedResponse,
  createPaginatedResponse,
} from './base/pagination.dto';
```

---

## 4. AuthModule 재사용

### 4.1 인터페이스 정의

```typescript
// shared/auth/interfaces/user-auth.repository.ts

/**
 * 인증에 필요한 사용자 데이터
 * 프로젝트별 User 엔티티가 이 인터페이스를 만족해야 함
 */
export interface UserAuthData {
  id: number;
  email: string;
  password: string;
  name: string | null;
  phone: string | null;
  role: string;
  kycStatus: string;
  canReceiveGift: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 사용자 생성 데이터
 */
export interface CreateUserData {
  email: string;
  password: string;  // 해시된 비밀번호
  name?: string;
  phone?: string;
}

/**
 * 프로필 업데이트 데이터
 */
export interface UpdateProfileData {
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * 사용자 인증 저장소 인터페이스
 * AuthService가 이 인터페이스에 의존
 */
export interface IUserAuthRepository {
  findById(id: number): Promise<UserAuthData | null>;
  findByEmail(email: string): Promise<UserAuthData | null>;
  findByPhone(phone: string): Promise<UserAuthData | null>;
  create(data: CreateUserData): Promise<UserAuthData>;
  updatePassword(userId: number, hashedPassword: string): Promise<void>;
  updateProfile(userId: number, data: UpdateProfileData): Promise<UserAuthData>;
}

/**
 * 의존성 주입 토큰
 */
export const USER_AUTH_REPOSITORY = Symbol('USER_AUTH_REPOSITORY');
```

### 4.2 새 프로젝트에서 구현체 작성

```typescript
// 새 프로젝트: modules/members/member-auth.repository.ts
import { Injectable } from '@nestjs/common';
import type { IUserAuthRepository, UserAuthData, CreateUserData, UpdateProfileData } from '@myorg/nestjs-core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemberAuthRepository implements IUserAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<UserAuthData | null> {
    const member = await this.prisma.member.findUnique({ where: { id } });
    return member ? this.toUserAuthData(member) : null;
  }

  async findByEmail(email: string): Promise<UserAuthData | null> {
    const member = await this.prisma.member.findUnique({ where: { email } });
    return member ? this.toUserAuthData(member) : null;
  }

  async findByPhone(phone: string): Promise<UserAuthData | null> {
    const member = await this.prisma.member.findUnique({ where: { phone } });
    return member ? this.toUserAuthData(member) : null;
  }

  async create(data: CreateUserData): Promise<UserAuthData> {
    const member = await this.prisma.member.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone,
        // 프로젝트별 추가 필드 기본값
        memberType: 'REGULAR',
        status: 'ACTIVE',
      },
    });
    return this.toUserAuthData(member);
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.prisma.member.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async updateProfile(userId: number, data: UpdateProfileData): Promise<UserAuthData> {
    const member = await this.prisma.member.update({
      where: { id: userId },
      data,
    });
    return this.toUserAuthData(member);
  }

  /**
   * 프로젝트별 Member 엔티티를 UserAuthData로 변환
   */
  private toUserAuthData(member: any): UserAuthData {
    return {
      id: member.id,
      email: member.email,
      password: member.password,
      name: member.name,
      phone: member.phone,
      role: member.memberType,  // 필드명 매핑
      kycStatus: member.verificationStatus || 'NOT_SUBMITTED',
      canReceiveGift: member.canReceiveGift ?? true,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}
```

### 4.3 모듈에서 토큰 바인딩

```typescript
// 새 프로젝트: modules/members/members.module.ts
import { Module } from '@nestjs/common';
import { USER_AUTH_REPOSITORY } from '@myorg/nestjs-core';
import { MemberAuthRepository } from './member-auth.repository';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';

@Module({
  controllers: [MembersController],
  providers: [
    MembersService,
    {
      provide: USER_AUTH_REPOSITORY,
      useClass: MemberAuthRepository,
    },
  ],
  exports: [MembersService, USER_AUTH_REPOSITORY],
})
export class MembersModule {}
```

### 4.4 AppModule 구성

```typescript
// 새 프로젝트: app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  AuthModule,
  CryptoModule,
  AuditModule,
  HealthModule,
  LoggerModule,
  authConfig,
  rateLimitConfig,
  paginationConfig,
  envValidationSchema,
} from '@myorg/nestjs-core';

import { PrismaModule } from './prisma/prisma.module';
import { MembersModule } from './modules/members/members.module';
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    // 1. 인프라 설정
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig, rateLimitConfig, paginationConfig],
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRootAsync({
      useFactory: (configService) => [{
        ttl: configService.get('rateLimit.ttl', 60000),
        limit: configService.get('rateLimit.limit', 100),
      }],
      inject: [ConfigService],
    }),

    // 2. 공유 모듈 (Core)
    PrismaModule,
    CryptoModule,
    HealthModule,
    LoggerModule,
    AuditModule,

    // 3. USER_AUTH_REPOSITORY 제공 모듈 (AuthModule보다 먼저!)
    MembersModule,

    // 4. Auth 모듈 (MembersModule에서 토큰 주입받음)
    AuthModule,

    // 5. 비즈니스 모듈
    ProductsModule,
  ],
})
export class AppModule {}
```

---

## 5. Config 외부화

### 5.1 제공되는 설정

| Config 파일 | 네임스페이스 | 환경변수 |
|------------|-------------|----------|
| `auth.config.ts` | `auth` | JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY_DAYS, BCRYPT_SALT_ROUNDS |
| `rate-limit.config.ts` | `rateLimit` | RATE_LIMIT_TTL, RATE_LIMIT_MAX |
| `pagination.config.ts` | `pagination` | PAGINATION_DEFAULT, PAGINATION_MAX |

### 5.2 환경변수 기본값

```typescript
// config/auth.config.ts
export default registerAs('auth', (): AuthConfig => ({
  jwt: {
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '1d',
    refreshExpiryDays: parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7', 10),
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  },
}));
```

### 5.3 환경별 설정 예시

#### 개발 환경 (.env.development)
```bash
# 필수
DATABASE_URL="sqlserver://localhost:1433;database=myapp_dev;..."
JWT_SECRET=dev-secret-key-change-in-production
ENCRYPTION_KEY=dev-encryption-key-32-bytes-hex

# 개발 편의 설정
JWT_ACCESS_EXPIRY=7d          # 자주 재로그인 방지
BCRYPT_SALT_ROUNDS=8          # 빠른 테스트
RATE_LIMIT_MAX=10000          # 개발 중 제한 완화
```

#### 프로덕션 환경 (.env.production)
```bash
# 필수
DATABASE_URL="sqlserver://prod-server:1433;database=myapp;..."
JWT_SECRET=<64자-hex-문자열>
ENCRYPTION_KEY=<64자-hex-문자열>

# 보안 강화 설정
JWT_ACCESS_EXPIRY=1h          # 짧은 만료
JWT_REFRESH_EXPIRY_DAYS=7
BCRYPT_SALT_ROUNDS=12         # 강력한 해싱
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100
COOKIE_SECURE=true
```

#### 테스트 환경 (.env.test)
```bash
DATABASE_URL="sqlserver://localhost:1433;database=myapp_test;..."
JWT_SECRET=test-secret
ENCRYPTION_KEY=test-encryption-key-32bytes-hex

# 테스트 최적화
BCRYPT_SALT_ROUNDS=4          # 테스트 속도
RATE_LIMIT_MAX=100000         # 제한 해제
```

### 5.4 프로젝트별 설정 확장

```typescript
// 새 프로젝트: config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'MyApp',
  version: process.env.APP_VERSION || '1.0.0',

  features: {
    enableSms: process.env.ENABLE_SMS === 'true',
    enablePush: process.env.ENABLE_PUSH === 'true',
    enableEmailVerification: process.env.ENABLE_EMAIL_VERIFICATION !== 'false',
  },

  external: {
    smsApiKey: process.env.SMS_API_KEY,
    pushServerKey: process.env.PUSH_SERVER_KEY,
  },
}));
```

```typescript
// ConfigModule에 추가
ConfigModule.forRoot({
  load: [
    authConfig,        // Core
    rateLimitConfig,   // Core
    paginationConfig,  // Core
    appConfig,         // 프로젝트별
  ],
}),
```

### 5.5 서비스에서 설정 사용

```typescript
@Injectable()
export class NotificationService {
  constructor(private readonly configService: ConfigService) {}

  async sendSms(phone: string, message: string) {
    // 기능 플래그 확인
    if (!this.configService.get<boolean>('app.features.enableSms')) {
      this.logger.warn('SMS feature is disabled');
      return;
    }

    const apiKey = this.configService.get<string>('app.external.smsApiKey');
    // SMS 전송 로직...
  }
}
```

---

## 6. BaseCrudService 활용

### 6.1 기본 사용법

```typescript
// modules/products/products.service.ts
import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '@myorg/nestjs-core';
import { PrismaService } from '../prisma/prisma.service';
import { Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService extends BaseCrudService<
  Product,
  CreateProductDto,
  UpdateProductDto
> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.product);
  }

  // 기본 CRUD는 상속으로 제공:
  // - create(data)
  // - findAll(params)
  // - findAllPaginated(params)
  // - findOne(id)
  // - update(id, data)
  // - remove(id)
  // - count(where)
}
```

### 6.2 커스텀 메서드 추가

```typescript
@Injectable()
export class ProductsService extends BaseCrudService<Product, CreateProductDto, UpdateProductDto> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.product);
  }

  /**
   * 활성 상품만 조회 (커스텀 필터)
   */
  async findActiveProducts(params?: {
    page?: number;
    limit?: number;
    category?: string;
  }) {
    return this.findAllPaginated({
      page: params?.page,
      limit: params?.limit,
      where: {
        isActive: true,
        deletedAt: null,
        ...(params?.category && { category: params.category }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 브랜드별 상품 그룹 조회 (복잡한 쿼리)
   */
  async getProductsByBrand() {
    return this.prisma.product.groupBy({
      by: ['brandCode'],
      _count: { id: true },
      _avg: { price: true },
      where: { isActive: true },
    });
  }

  /**
   * 트랜잭션 예시
   */
  async createWithInventory(data: CreateProductDto, initialStock: number) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data });
      await tx.inventory.create({
        data: { productId: product.id, quantity: initialStock },
      });
      return product;
    });
  }
}
```

### 6.3 타입 안전한 쿼리

```typescript
import { Prisma } from '@prisma/client';
import { BaseCrudService, CrudQueryArgs } from '@myorg/nestjs-core';

// Prisma 타입으로 쿼리 인자 좁히기
interface ProductQueryArgs extends CrudQueryArgs {
  where?: Prisma.ProductWhereInput;
  orderBy?: Prisma.ProductOrderByWithRelationInput;
}

@Injectable()
export class ProductsService extends BaseCrudService<
  Product,
  CreateProductDto,
  UpdateProductDto,
  ProductQueryArgs  // 4번째 제네릭으로 쿼리 타입 지정
> {
  // 이제 where, orderBy에 타입 자동완성 지원
}
```

---

## 7. 테스트 전략

### 7.1 Mock Repository 생성

```typescript
// test/mocks/user-auth.repository.mock.ts
import type { IUserAuthRepository, UserAuthData, CreateUserData, UpdateProfileData } from '@myorg/nestjs-core';

export const createMockUserAuthRepository = (): jest.Mocked<IUserAuthRepository> => ({
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByPhone: jest.fn(),
  create: jest.fn(),
  updatePassword: jest.fn(),
  updateProfile: jest.fn(),
});

// 테스트용 사용자 데이터 팩토리
export const createMockUser = (overrides: Partial<UserAuthData> = {}): UserAuthData => ({
  id: 1,
  email: 'test@example.com',
  password: '$2b$10$hashedpassword',
  name: 'Test User',
  phone: '010-1234-5678',
  role: 'USER',
  kycStatus: 'NOT_SUBMITTED',
  canReceiveGift: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
```

### 7.2 단위 테스트 예시

```typescript
// auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, USER_AUTH_REPOSITORY } from '@myorg/nestjs-core';
import { createMockUserAuthRepository, createMockUser } from '../mocks/user-auth.repository.mock';

describe('AuthService', () => {
  let service: AuthService;
  let mockRepo: ReturnType<typeof createMockUserAuthRepository>;
  let mockJwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    mockRepo = createMockUserAuthRepository();
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: USER_AUTH_REPOSITORY,
          useValue: mockRepo,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: any) => defaultValue),
          },
        },
        {
          provide: 'PrismaService',
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should create a new user', async () => {
      const newUser = createMockUser({ id: 1, email: 'new@example.com' });
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.findByPhone.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(newUser);

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result.email).toBe('new@example.com');
      expect(result).not.toHaveProperty('password');
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      mockRepo.findByEmail.mockResolvedValue(createMockUser());

      await expect(
        service.register({ email: 'test@example.com', password: '1234' }),
      ).rejects.toThrow('Email already in use');
    });
  });

  describe('validateUser', () => {
    it('should return user without password if credentials valid', async () => {
      const user = createMockUser({
        password: '$2b$10$validhash', // bcrypt.compare가 true 반환하도록 모킹 필요
      });
      mockRepo.findByEmail.mockResolvedValue(user);
      // bcrypt.compare 모킹 필요...

      // 테스트 로직
    });
  });
});
```

### 7.3 E2E 테스트 설정

```typescript
// test/helpers/test-setup.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // 프로덕션과 동일한 설정
  app.setGlobalPrefix('api');
  app.enableCors();

  await app.init();
  return app;
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}
```

---

## 8. 새 프로젝트 설정 가이드

### 8.1 체크리스트

#### Phase 1: 기본 설정

- [ ] **1.1 패키지 설치**
  ```bash
  pnpm add @myorg/nestjs-core
  pnpm add @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
  pnpm add joi bcrypt
  pnpm add -D @types/bcrypt @types/passport-jwt
  ```

- [ ] **1.2 환경변수 설정**
  ```bash
  # .env 생성
  DATABASE_URL="sqlserver://..."
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  ```

- [ ] **1.3 Prisma 스키마 확장**
  ```prisma
  // 필수 모델 추가
  model RefreshToken {
    id        Int      @id @default(autoincrement()) @map("Id")
    token     String   @map("Token") @db.VarChar(64)
    userId    Int      @map("UserId")
    expiresAt DateTime @map("ExpiresAt")
    createdAt DateTime @default(now()) @map("CreatedAt")

    user      Member   @relation(fields: [userId], references: [id])

    @@map("RefreshTokens")
  }

  model AuditLog {
    id         Int      @id @default(autoincrement()) @map("Id")
    createdAt  DateTime @default(now()) @map("CreatedAt")
    userId     Int?     @map("UserId")
    action     String   @map("Action") @db.VarChar(100)
    resource   String   @map("Resource") @db.VarChar(100)
    // ... 기타 필드

    @@map("AuditLogs")
  }
  ```

#### Phase 2: 모듈 구성

- [ ] **2.1 IUserAuthRepository 구현체 작성**
  - `member-auth.repository.ts` 생성
  - 6개 메서드 모두 구현

- [ ] **2.2 MembersModule에서 토큰 export**
  ```typescript
  providers: [{ provide: USER_AUTH_REPOSITORY, useClass: MemberAuthRepository }],
  exports: [USER_AUTH_REPOSITORY],
  ```

- [ ] **2.3 AppModule import 순서 확인**
  - MembersModule → AuthModule (순서 중요!)

#### Phase 3: 테스트

- [ ] **3.1 Mock Repository 작성**
- [ ] **3.2 단위 테스트 실행**
- [ ] **3.3 E2E 테스트 실행**
  ```bash
  pnpm test -- --testPathPattern=auth
  ```

#### Phase 4: 검증

- [ ] **4.1 회원가입 테스트**
  ```bash
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"1234"}'
  ```

- [ ] **4.2 로그인 테스트**
  ```bash
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"1234"}'
  ```

- [ ] **4.3 토큰 갱신 테스트**
- [ ] **4.4 Rate Limit 테스트**

### 8.2 빠른 시작 템플릿

```bash
# 1. 프로젝트 생성
nest new my-project
cd my-project

# 2. Core 패키지 설치
pnpm add @myorg/nestjs-core

# 3. 필수 의존성
pnpm add @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add @prisma/client joi bcrypt ms
pnpm add -D prisma @types/bcrypt @types/passport-jwt

# 4. Prisma 초기화
npx prisma init

# 5. 스키마 작성 및 마이그레이션
npx prisma db push

# 6. 환경변수 설정
cp .env.example .env
# JWT_SECRET, ENCRYPTION_KEY 생성

# 7. 개발 서버 시작
pnpm start:dev
```

---

## 9. 트러블슈팅

### 9.1 일반적인 오류

#### `USER_AUTH_REPOSITORY` 주입 실패

```
Error: Nest can't resolve dependencies of the AuthService
```

**원인**: MembersModule이 AuthModule보다 나중에 import됨

**해결**:
```typescript
// AppModule imports 순서 확인
imports: [
  MembersModule,  // USER_AUTH_REPOSITORY 제공
  AuthModule,     // 위 토큰 사용
]
```

#### JWT 토큰 만료 타입 오류

```
Type 'string' is not assignable to type 'StringValue'
```

**원인**: jsonwebtoken 패키지의 엄격한 타입

**해결**:
```typescript
import type { StringValue } from 'ms';
signOptions: { expiresIn: accessExpiry as StringValue }
```

#### Joi 스키마 검증 실패

```
Error: Config validation error: "JWT_SECRET" is required
```

**원인**: 환경변수 누락

**해결**:
```bash
# 필수 환경변수 확인
echo $JWT_SECRET
echo $ENCRYPTION_KEY
echo $DATABASE_URL
```

### 9.2 테스트 관련

#### E2E 테스트에서 DB 연결 오류

```
PrismaClientKnownRequestError: Connection is closed
```

**원인**: 테스트 종료 후 연결 정리 타이밍

**해결**:
```typescript
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500)); // 대기
  await app.close();
});
```

#### Mock Repository 타입 오류

```
Type 'Mock' is not assignable to type 'IUserAuthRepository'
```

**해결**:
```typescript
// jest.Mocked 타입 사용
const mockRepo: jest.Mocked<IUserAuthRepository> = {
  findById: jest.fn(),
  // ...
};
```

### 9.3 성능 관련

#### bcrypt 해싱이 느림

**원인**: saltRounds가 너무 높음

**해결**:
```bash
# 테스트 환경
BCRYPT_SALT_ROUNDS=4

# 개발 환경
BCRYPT_SALT_ROUNDS=8

# 프로덕션
BCRYPT_SALT_ROUNDS=10~12
```

---

## 10. 향후 개선 방향

### 10.1 Repository 패턴 확장

현재 AuthModule만 인터페이스로 분리되어 있습니다. 전체 서비스에 Repository 패턴을 적용하면:

```typescript
// base/repository/base.repository.interface.ts
export interface IBaseRepository<T, CreateDto, UpdateDto> {
  findById(id: number): Promise<T | null>;
  findAll(params: FindParams): Promise<T[]>;
  findAllPaginated(params: PaginatedParams): Promise<PaginatedResponse<T>>;
  create(data: CreateDto): Promise<T>;
  update(id: number, data: UpdateDto): Promise<T>;
  delete(id: number): Promise<T>;
  count(where?: any): Promise<number>;
}
```

**장점**:
- 서비스가 Prisma에 직접 의존하지 않음
- 다른 ORM(TypeORM, MikroORM)으로 교체 용이
- 캐싱 레이어(Redis) 추가 용이
- 완전한 단위 테스트 격리

### 10.2 이벤트 기반 아키텍처

```typescript
// 도메인 이벤트 발행
export class UserRegisteredEvent {
  constructor(
    public readonly userId: number,
    public readonly email: string,
    public readonly registeredAt: Date,
  ) {}
}

// AuthService에서 이벤트 발행
async register(dto: CreateUserDto) {
  const user = await this.userAuthRepository.create(dto);

  // 이벤트 발행 - 구독자가 후속 작업 처리
  this.eventEmitter.emit('user.registered', new UserRegisteredEvent(
    user.id,
    user.email,
    new Date(),
  ));

  return user;
}
```

### 10.3 Multi-tenancy 지원

```typescript
// 테넌트별 데이터 격리
export interface ITenantAware {
  tenantId: string;
}

export interface IUserAuthRepository {
  findById(id: number, tenantId?: string): Promise<UserAuthData | null>;
  // ...
}
```

---

## 11. 5축 검증 결과 및 아키텍처 결정 기록

### 11.1 검증 개요

재사용 가능한 모듈의 품질을 5축(응집도/일관성/유연성/확장성/독립성)으로 평가하고, 발견된 이슈를 P0~P2로 분류하여 개선하였습니다.

### 11.2 개선 완료 (P0/P1)

| 우선순위 | 축 | 이슈 | 수정 내용 |
|:--------:|:--:|------|----------|
| P0 | 일관성 | Auth 에러 메시지 영어 하드코딩 | `AUTH_ERRORS` 상수로 교체 (12개 메시지) |
| P0 | 응집도 | Cookie 설정 객체 중복 (login/refresh) | `getRefreshCookieOptions()` 헬퍼 추출 |
| P1 | 유연성 | `validateUser(): Promise<any>`, `login(user: any)` | `SafeUserPayload` 타입 명시 |
| P1 | 독립성 | CryptoService에서 `process.env` 직접 접근 | `ConfigService` 주입으로 변경 |

### 11.3 의도적 설계 결정 (P2 — 코드 변경 없음)

| 항목 | 위치 | 유지 이유 |
|------|------|----------|
| BaseCrudService `process.env` | `base-crud.service.ts` | 추상 클래스의 기본값. 하위 모듈에 ConfigModule 의존을 강제하지 않기 위함. 상속 클래스에서 override 가능 |
| AuthService PrismaService 직접 사용 | `auth.service.ts` (RefreshToken) | refresh/logout은 auth 전용 CRUD. Repository 추출은 과도한 추상화. `IUserAuthRepository`로 User만 분리하면 충분 |
| TradeIn raw SQL | `trade-in.service.ts` L311-320 | MSSQL `FORMAT()` 함수 사용. Prisma ORM으로 대체 불가. 성능 최적화 |
| CORS 부분 하드코딩 | `main.ts` | 프로덕션 도메인 고정. 환경변수화하면 오히려 설정 오류 위험 증가 |

### 11.4 5축 점수 요약

| 축 | 점수 | 비고 |
|:--:|:----:|------|
| 응집도 | 9/10 | Cookie 중복 제거 완료 |
| 일관성 | 10/10 | 에러 메시지 전량 상수화 |
| 유연성 | 9/10 | any 타입 제거, SafeUserPayload 적용 |
| 확장성 | 9/10 | IUserAuthRepository DIP 패턴 적용 완료 |
| 독립성 | 9/10 | CryptoService ConfigService 주입 완료. BaseCrudService는 의도적 유지 |

---

## 관련 문서

- [02_ARCHITECTURE.md](./02_ARCHITECTURE.md) - 시스템 아키텍처
- [05_API_SPEC.md](./05_API_SPEC.md) - API 명세
- [08_TEST_SPEC.md](./08_TEST_SPEC.md) - 테스트 명세
- [11_DDD_IMPLEMENTATION_ROADMAP.md](./11_DDD_IMPLEMENTATION_ROADMAP.md) - DDD 적용 로드맵
