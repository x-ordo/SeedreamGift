/**
 * @file users.module.ts
 * @description 사용자 모듈 - 회원 관리 및 파트너 등급 기능 번들
 * @module users
 *
 * 포함 기능:
 * - 사용자 CRUD (생성, 조회, 수정, 삭제)
 * - 이메일 중복 검사
 * - 프로필 조회/수정
 * - 파트너 등급(Tier) 자동 산정
 *
 * 외부 노출:
 * - UsersService: AuthModule에서 사용자 조회/생성에 사용
 * - PartnerTierService: 매입 모듈에서 파트너 등급 조회/갱신에 사용
 * - USER_AUTH_REPOSITORY: AuthModule에서 인터페이스 기반 의존성 주입용
 */
import { Module } from '@nestjs/common';

import { PartnerTierService } from './partner-tier.service';
import { UserAuthRepositoryImpl } from './user-auth.repository.impl';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { USER_AUTH_REPOSITORY } from '../../shared/auth/interfaces/user-auth.repository';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    PartnerTierService,
    {
      provide: USER_AUTH_REPOSITORY,
      useClass: UserAuthRepositoryImpl,
    },
  ],
  exports: [UsersService, PartnerTierService, USER_AUTH_REPOSITORY],
})
export class UsersModule {}
