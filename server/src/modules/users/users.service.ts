/**
 * @file users.service.ts
 * @description 사용자 관리 서비스 - 사용자 CRUD 및 조회
 * @module modules/users
 *
 * @summary 사용자 관리 비즈니스 로직
 *
 * 주요 기능:
 * - 사용자 생성 (회원가입 시 호출)
 * - 이메일/휴대폰으로 사용자 조회 (로그인 시 호출)
 * - 사용자 정보 수정/삭제 (BaseCrudService 상속)
 * - KYC 본인인증 데이터 제출/조회
 *
 * 역할(Role):
 * - USER: 일반 사용자 (기본값)
 * - PARTNER: 파트너 (대량 구매 할인)
 * - ADMIN: 관리자 (전체 접근)
 *
 * 보안:
 * - KYC 데이터는 AES-256 암호화 저장
 * - 비밀번호는 bcrypt 해시 저장 (AuthService에서 처리)
 */
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BaseCrudService } from '../../base/base-crud.service';
import { PasswordService } from '../../shared/auth/password.service';
import { USER_ERRORS } from '../../shared/constants/errors';
import { User } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class UsersService extends BaseCrudService<
  User,
  CreateUserDto,
  UpdateUserDto
> {
  protected readonly softDeleteFilter = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {
    super(prisma.user);
  }

  /**
   * 사용자 생성 (회원가입)
   *
   * 비밀번호 해싱은 호출자(AuthService)에서 처리
   * 역할 기본값은 Prisma 스키마에서 'USER'로 설정됨
   *
   * @param {CreateUserDto} data - 사용자 생성 데이터
   * @param {string} data.email - 이메일 (고유)
   * @param {string} data.password - 해시된 비밀번호
   * @param {string} [data.name] - 이름
   * @param {string} [data.phone] - 휴대폰 번호
   * @returns {Promise<User>} 생성된 사용자 정보
   */
  async create(data: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * [의도] 회원 탈퇴 (소프트 삭제)
   * - 비밀번호 확인 → 미처리 주문/매입 확인 → 개인정보 삭제 + 세션 무효화
   */
  async softDelete(userId: number, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new BadRequestException(USER_ERRORS.NOT_FOUND);
    }

    const isPasswordValid = await this.passwordService.compare(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(USER_ERRORS.INVALID_PASSWORD);
    }

    // 미처리 주문 확인 (PENDING 상태)
    const pendingOrders = await this.prisma.order.count({
      where: { userId, status: 'PENDING' },
    });
    if (pendingOrders > 0) {
      throw new BadRequestException(USER_ERRORS.PENDING_ORDERS);
    }

    // 미처리 매입 확인 (REQUESTED / VERIFIED 상태)
    const pendingTradeIns = await this.prisma.tradeIn.count({
      where: { userId, status: { in: ['REQUESTED', 'VERIFIED'] } },
    });
    if (pendingTradeIns > 0) {
      throw new BadRequestException(USER_ERRORS.PENDING_TRADEINS);
    }

    // [의도] 회원 탈퇴 cascade — 트랜잭션 원자성이 필수이므로
    // 타 모듈 서비스 위임 대신 직접 Prisma 접근 유지
    // 관련 도메인: Auth(refreshToken), Cart(cartItem), TradeIn(tradeIn)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: `withdrawn_${userId}@deleted.local`,
          name: null,
          phone: null,
          accountNumber: null,
          accountHolder: null,
          bankName: null,
          bankCode: null,
          kycData: null,
          kycStatus: 'NONE',
          kycVerifiedBy: null,
          kycVerifiedByAdminId: null,
          passwordResetToken: null,
          passwordResetExpiry: null,
          mfaEnabled: false,
          totpSecret: null,
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.cartItem.deleteMany({ where: { userId } }),
      this.prisma.tradeIn.updateMany({
        where: { userId },
        data: {
          senderName: null,
          senderPhone: null,
          senderEmail: null,
          accountHolder: null,
          bankName: null,
          accountNum: null,
        },
      }),
    ]);
  }

  /**
   * 이메일로 사용자 조회
   *
   * 로그인 시 사용자 검증용
   *
   * @param {string} email - 검색할 이메일
   * @returns {Promise<User | null>} 사용자 정보 또는 null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 휴대폰 번호로 사용자 조회
   *
   * 휴대폰 번호 기반 로그인/조회용
   *
   * @param {string} phone - 검색할 휴대폰 번호
   * @returns {Promise<User | null>} 사용자 정보 또는 null
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  /**
   * ID로 사용자 조회
   *
   * KycService 등 타 모듈에서 사용자 정보 읽기용
   *
   * @param {number} id - 사용자 ID
   * @returns {Promise<User | null>} 사용자 정보 또는 null
   */
  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * 선물 수신 가능한 사용자 이메일 조회
   *
   * GiftService 도메인 경계 메서드: 수신자 검증용.
   *
   * @param {string} email - 수신자 이메일
   * @returns 수신 가능 사용자 정보 또는 null
   */
  async findReceivableByEmail(email: string): Promise<{
    id: number;
    name: string | null;
    email: string;
  } | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
  }

  /**
   * 선물 수신 가능한 사용자 검색
   *
   * GiftService 도메인 경계 메서드: 수신자 자동완성용.
   * 이메일/이름 부분 일치, role='USER'만 반환.
   *
   * @param {string} query - 검색어 (최소 3자)
   * @param {number} [limit=10] - 최대 결과 수
   * @returns 수신 가능 사용자 목록
   */
  async searchReceivableUsers(
    query: string,
    limit = 10,
  ): Promise<Array<{ id: number; name: string | null; email: string }>> {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 3) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        OR: [{ email: { contains: trimmed } }, { name: { contains: trimmed } }],
        role: 'USER',
      },
      take: limit,
      select: { id: true, email: true, name: true },
    });
  }

  /**
   * KYC 상태 업데이트
   *
   * KycService 도메인 경계 메서드: 본인인증 결과 저장용.
   * User 테이블의 KYC 관련 필드를 일괄 업데이트.
   *
   * @param {number} userId - 사용자 ID
   * @param {object} data - KYC 업데이트 데이터
   */
  async updateKycStatus(
    userId: number,
    data: {
      kycStatus?: string;
      kycData?: string;
      kycVerifiedBy?: string | null;
      kycVerifiedByAdminId?: number | null;
      bankName?: string;
      bankCode?: string;
      accountNumber?: string;
      accountHolder?: string;
      bankVerifiedAt?: Date;
      verifyAttemptCount?: number | { increment: number };
    },
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
