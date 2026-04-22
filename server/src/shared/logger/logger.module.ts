/**
 * @file logger.module.ts
 * @description Winston 로거 모듈 - 구조화된 로깅 시스템
 * @module shared/logger
 *
 * 로그 출력:
 * - 콘솔: 개발 환경 debug 레벨, 프로덕션 info 레벨
 * - 파일: logs/error-*.log (에러만), logs/combined-*.log (전체)
 *
 * 파일 로테이션:
 * - 일별 로테이션 (YYYY-MM-DD 패턴)
 * - 최대 파일 크기: 20MB
 * - 보관 기간: 14일
 * - 자동 압축 (zip)
 *
 * 사용처:
 * - app.module.ts: 전역 로거로 등록
 * - 모든 서비스에서 Logger 주입하여 사용
 */
import { Module } from '@nestjs/common';

import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import * as winston from 'winston';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';

/**
 * Winston 로거 모듈
 *
 * nest-winston을 사용한 구조화된 로깅 시스템.
 * 콘솔과 파일에 동시 출력하며, 에러 로그는 별도 파일로 분리됩니다.
 */
@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        // 콘솔 출력 (개발용)
        new winston.transports.Console({
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('W-GIFT', {
              colors: true,
              prettyPrint: true,
            }),
          ),
        }),
        // 에러 로그 파일 저장
        new WinstonDailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        // 모든 로그 파일 저장
        new WinstonDailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
