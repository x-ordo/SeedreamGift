/**
 * @file app.module.ts
 * @description 애플리케이션 루트 모듈 - 전체 모듈 구성 및 글로벌 설정 정의
 * @module app
 *
 * 사용처:
 * - main.ts: NestFactory.create()에서 앱 부트스트랩 시 진입점
 * - 테스트: createTestApp()에서 테스트용 앱 인스턴스 생성 시 참조
 *
 * 모듈 구성:
 * 1. 인프라 모듈 (Config, ThrottlerModule, ServeStatic)
 * 2. 공유 모듈 (Prisma, Auth, Crypto, Health, Logger, Audit)
 * 3. 비즈니스 모듈 (Users, Product, Orders, Voucher, Cart 등)
 */
import { join } from 'path';

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';

import {
  authConfig,
  rateLimitConfig,
  paginationConfig,
  envValidationSchema,
} from './config';
import { AdminModule } from './modules/admin/admin.module';
import { BrandModule } from './modules/brand/brand.module';
import { CartModule } from './modules/cart/cart.module';
import { EventModule } from './modules/event/event.module';
import { FaqModule } from './modules/faq/faq.module';
import { GiftModule } from './modules/gift/gift.module';
import { InquiryModule } from './modules/inquiry/inquiry.module';
import { KycModule } from './modules/kyc/kyc.module';
import { NoticeModule } from './modules/notice/notice.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductModule } from './modules/product/product.module';
import { SiteConfigModule } from './modules/site-config/site-config.module';
import { TradeInModule } from './modules/trade-in/trade-in.module';
import { UsersModule } from './modules/users/users.module';
import { VoucherModule } from './modules/voucher/voucher.module';
import { AuditModule } from './shared/audit/audit.module';
import { AuthModule } from './shared/auth/auth.module';
import { PasswordModule } from './shared/auth/password.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { HealthModule } from './shared/health/health.module';
import { AuditInterceptor } from './shared/interceptors/audit.interceptor';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { LoggerModule } from './shared/logger/logger.module';
import { LoggerMiddleware } from './shared/middleware/logger.middleware';
import { TraceIdMiddleware } from './shared/middleware/trace-id.middleware';
import { NotificationsModule } from './shared/notifications/notifications.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { SeoModule } from './shared/seo/seo.module';

@Module({
  imports: [
    // ========================================================================
    // 인프라 설정 - 환경변수, 요청 제한, 정적 파일 서빙, 이벤트 기반 아키텍처
    // ========================================================================
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig, rateLimitConfig, paginationConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // 모든 오류 한번에 표시
        allowUnknown: true, // 추가 환경변수 허용
      },
    }),
    // 전역 Rate Limit: 동일 IP에서 설정된 시간 내 최대 요청 수 제한 (기본: 60초/100건)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('rateLimit.ttl', 60000),
          limit: configService.get<number>('rateLimit.limit', 100),
        },
      ],
      inject: [ConfigService],
    }),
    // 이벤트 기반 아키텍처 지원 (Observer Pattern)
    EventEmitterModule.forRoot(),
    // 스케줄러 (크론 잡) — KYC 세션 정리, 감사 로그 아카이브 등
    ScheduleModule.forRoot(),
    // 빌드된 프론트엔드 정적 파일 서빙 (API/Docs 경로는 제외)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api{/*path}', '/docs{/*path}', '/sitemap.xml'],
    }),
    // ========================================================================
    // 공유 모듈 - 모든 비즈니스 모듈에서 공통으로 사용하는 인프라 서비스
    // ========================================================================
    PrismaModule, // DB 접근 (MSSQL)
    AuthModule, // JWT 인증 및 역할 기반 인가
    PasswordModule, // bcrypt 비밀번호 해싱 (Global)
    CryptoModule, // AES-256 암호화 (PIN, 계좌번호 등 민감정보)
    HealthModule, // 헬스체크 엔드포인트
    LoggerModule, // 구조화된 로깅
    AuditModule, // 감사 로그 (변경 이력 추적)
    NotificationsModule, // Telegram 알림 (5xx 에러)
    SeoModule, // sitemap.xml 동적 생성

    // ========================================================================
    // 비즈니스 모듈 - 도메인별 기능 단위
    // ========================================================================
    UsersModule, // 회원가입, 로그인, KYC 인증
    ProductModule, // 상품 관리 (CRUD, 시세 조회)
    OrdersModule, // 주문 생성, 결제, 바우처 발급
    VoucherModule, // PIN 재고 관리 (ADMIN)
    CartModule, // 장바구니
    TradeInModule, // 상품권 매입 (역방향 거래)
    AdminModule, // 관리자 전용 기능
    GiftModule, // 선물 보내기
    InquiryModule, // 1:1 문의
    SiteConfigModule, // 사이트 동적 설정 (key-value)
    NoticeModule, // 공지사항
    BrandModule, // 브랜드 마스터 데이터
    EventModule, // 이벤트/프로모션
    FaqModule, // FAQ
    KycModule, // 1원 인증 (Coocon API)
  ],
  controllers: [],
  providers: [
    // 모든 요청·응답에 감사 로그를 남기기 위해 글로벌 인터셉터로 등록
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // 표준화된 응답 포맷 (success, data, timestamp) 적용
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 모든 라우트에 요청 로깅 및 Trace ID 부여 미들웨어 적용
    consumer.apply(TraceIdMiddleware, LoggerMiddleware).forRoutes('*');
  }
}
