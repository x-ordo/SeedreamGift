/**
 * @file main.ts
 * @description 서버 부트스트랩 - NestJS 애플리케이션 진입점
 */
import 'dotenv/config'; // 환경 변수 로드 (최상단)

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import hpp from 'hpp';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters';
import {
  DecimalSerializerInterceptor,
  EtagInterceptor,
} from './shared/interceptors';
import { TelegramAlertService } from './shared/notifications/telegram-alert.service';
import { TrimStringsPipe } from './shared/pipes/trim-strings.pipe';

/**
 * 애플리케이션 부트스트랩 함수
 */
async function bootstrap() {
  // 프로덕션 환경에서 필수 환경변수 검증
  // 누락 시 서버 시작 중단 (fail-fast)
  if (process.env.NODE_ENV === 'production') {
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(
          `FATAL: Missing required environment variable: ${envVar}`,
        );
        process.exit(1);
      }
    }
  }

  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // 리버스 프록시 (nginx) 뒤에서 실행 시 X-Forwarded-* 헤더 신뢰
  // 클라이언트 실제 IP, 프로토콜(https) 정보를 정확하게 가져오기 위해 필요
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  expressApp.set('trust proxy', 1);

  // Winston 로거를 전역 Nest 로거로 설정
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // ========================================================================
  // 보안 미들웨어 (순서 중요: helmet → hpp → cookieParser)
  // ========================================================================

  // 봇/스캐너 차단: 비표준 HTTP 메서드 + 민감 경로 조기 차단
  app.use(
    (
      req: { method: string; url: string },
      res: { status: (code: number) => { end: () => void } },
      next: () => void,
    ) => {
      // PROPFIND, TRACE 등 비표준 메서드 즉시 차단
      const allowed = new Set([
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
        'HEAD',
      ]);
      if (!allowed.has(req.method)) {
        res.status(405).end();
        return;
      }

      const path = req.url.toLowerCase();
      if (
        /\.env($|\b|[./])/.test(path) ||
        /\.php($|\?)/.test(path) ||
        /\.git(\/|$)/.test(path) ||
        /\.(htaccess|htpasswd|DS_Store)/.test(path) ||
        /\/(backup|dump)\.(zip|tar|gz|sql)/i.test(path) ||
        /\/(aws-secret|credentials|config)\.(json|yml|yaml)/i.test(path) ||
        /\/(debug|info\.php|phpinfo|adminer|phpmyadmin)/i.test(path) ||
        /\/wp-(admin|login|content|includes)/i.test(path) ||
        /\/php-cgi/i.test(path)
      ) {
        res.status(404).end();
        return;
      }
      next();
    },
  );

  // Helmet: HTTP 보안 헤더 설정
  // - X-Content-Type-Options: nosniff (MIME 타입 스니핑 방지)
  // - X-Frame-Options: SAMEORIGIN (클릭재킹 방지)
  // - X-XSS-Protection (레거시 XSS 필터)
  // - Strict-Transport-Security (HSTS, nginx 뒤 HTTPS 운영)
  // - Content-Security-Policy 등
  app.use(
    helmet({
      // CSP: Swagger UI 등 인라인 스크립트가 필요한 경우를 위해 조정
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: [
                "'self'",
                "'unsafe-inline'",
                'https://cdn.jsdelivr.net',
              ],
              imgSrc: ["'self'", 'data:'],
              connectSrc: [
                "'self'",
                'https://cdn.jsdelivr.net',
                'https://pf.kakao.com',
                'https://*.kakao.com',
                'https://api.seedreamgift.com',
              ],
              fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              formAction: ["'self'"],
              baseUri: ["'self'"],
            },
          }
        : false, // 개발 환경에서는 CSP 비활성화 (HMR, Swagger UI 등)
      // HSTS: nginx에서도 설정하지만, 이중 방어 (max-age: 1년)
      strictTransportSecurity: isProduction
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
      // X-Frame-Options: 클릭재킹 방지
      frameguard: { action: 'deny' },
    }),
  );

  // HPP: HTTP Parameter Pollution 방지
  // 중복 쿼리 파라미터 공격 차단 (예: ?id=1&id=2)
  app.use(hpp());

  // 응답 압축 (Gzip/Brotli)
  app.use(compression());

  // Cookie Parser 미들웨어 적용
  app.use(cookieParser());

  // 정적 자산 Cache-Control 헤더
  // Vite 빌드 결과물은 파일명에 content hash 포함 → 장기 캐시 안전
  // ServeStaticModule이 파일을 서빙하고, 이 미들웨어는 헤더만 추가
  if (isProduction) {
    app.use((req: any, res: any, next: any) => {
      if (req.url.startsWith('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      next();
    });
  }

  // Prisma Graceful Shutdown 활성화
  // Best Practice: NestJS 10+에서는 app.enableShutdownHooks() 사용
  // PrismaService.onModuleDestroy()가 자동 호출됨
  app.enableShutdownHooks();

  // 글로벌 API 프리픽스 설정
  app.setGlobalPrefix('api', {
    exclude: ['/', '/sitemap.xml'], // 루트 경로 및 SEO 엔드포인트 제외
  });

  // API 버저닝 활성화
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS 설정 (환경별 화이트리스트)
  const allowedOrigins = isProduction
    ? [
        process.env.FRONTEND_URL || 'https://seedreamgift.com',
        'https://www.seedreamgift.com',
      ]
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5140',
        'http://127.0.0.1:5173',
        'http://localhost:4173',
      ];

  // 추가 CORS origins (환경변수)
  const additionalOrigins = process.env.ADDITIONAL_CORS_ORIGINS;
  if (additionalOrigins) {
    allowedOrigins.push(
      ...additionalOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    );
  }

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-trace-id'],
    exposedHeaders: ['x-trace-id', 'X-Response-Time', 'ETag'],
    credentials: true,
  });

  // 전역 Exception Filter (일관된 에러 응답 + 5xx Telegram 알림)
  const telegramAlert = app.get(TelegramAlertService);
  app.useGlobalFilters(new HttpExceptionFilter(telegramAlert));

  // 전역 Response Interceptors
  // DecimalSerializer: Prisma Decimal → number 변환
  // TransformInterceptor는 app.module.ts에서 APP_INTERCEPTOR로 등록됨 (중복 방지)
  app.useGlobalInterceptors(
    new DecimalSerializerInterceptor(),
    new EtagInterceptor(),
  );

  // 전역 ValidationPipe 설정
  // - whitelist: DTO에 정의되지 않은 필드 자동 제거
  // - forbidNonWhitelisted: 정의되지 않은 필드 있으면 400 에러
  // - transform: 타입 자동 변환 (예: string → number)
  // - stopAtFirstError: 첫 번째 에러에서 중단 (성능 최적화)
  app.useGlobalPipes(
    new TrimStringsPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  // Swagger API 문서 설정 (개발 환경에서만 노출)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('w-gift Certificate API')
      .setDescription(
        'Gift certificate shop API - Auto-generated spec for FE client generation',
      )
      .setVersion('2.0')
      .addBearerAuth() // JWT Bearer 토큰 인증 추가
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // 서버 시작
  const port = process.env.PORT ?? 5140;
  await app.listen(port, '0.0.0.0');

  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`Server running on port ${port}`);
  if (!isProduction) {
    logger.log(`Swagger docs: http://localhost:${port}/docs`);
  }

  // PM2 클러스터 모드: 프로세스 준비 완료 신호
  if (typeof process.send === 'function') {
    process.send('ready');
  }
}
bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
