/**
 * @file auth.service.ts
 * @description 인증 서비스 - 회원가입, 로그인, JWT 토큰 발급
 * @module auth
 *
 * 주요 기능:
 * - 회원가입 (이메일 중복 검사, 비밀번호 해싱)
 * - 로그인 (비밀번호 검증, JWT 발급)
 * - 사용자 검증 (비밀번호 비교)
 *
 * 보안:
 * - 비밀번호: bcrypt (salt round: 환경변수 BCRYPT_SALT_ROUNDS, 기본 10)
 * - 토큰: JWT (HS256)
 *
 * 환경변수:
 * - BCRYPT_SALT_ROUNDS: bcrypt 해싱 라운드 (기본: 10)
 * - SESSION_DURATION_MINUTES: 세션 절대 만료 시간 (기본: 60분, refresh로 연장 불가)
 */
import * as crypto from 'crypto';

import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcryptjs';

import { MfaService } from './mfa.service';
import { KYC_STATUS, AUTH_SECURITY } from '../constants';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type {
  IUserAuthRepository,
  UserAuthData,
} from './interfaces/user-auth.repository';
import { USER_AUTH_REPOSITORY } from './interfaces/user-auth.repository';
import { PasswordService } from './password.service';
import { CreateUserDto } from '../../modules/users/dto/create-user.dto';
import { AUTH_ERRORS, accountLockedMessage } from '../constants/errors';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';

type SafeUserPayload = Omit<UserAuthData, 'password'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly sessionDurationMinutes: number;
  private readonly maxRefreshTokensPerUser: number;
  private readonly passwordResetExpiryHours: number;
  private readonly kycWindowMs: number;
  private readonly dummyHash: string;

  constructor(
    @Inject(USER_AUTH_REPOSITORY)
    private readonly userAuthRepository: IUserAuthRepository,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly passwordService: PasswordService,
    private readonly mfaService: MfaService,
  ) {
    this.sessionDurationMinutes = this.configService.get<number>(
      'auth.jwt.sessionDurationMinutes',
      60,
    );
    this.maxRefreshTokensPerUser = this.configService.get<number>(
      'auth.maxRefreshTokensPerUser',
      5,
    );
    this.passwordResetExpiryHours = this.configService.get<number>(
      'auth.passwordResetExpiryHours',
      1,
    );
    this.kycWindowMs =
      this.configService.get<number>('auth.kycWindowMinutes', 10) * 60 * 1000;
    // Timing attack 방지용 더미 해시 (정적 문자열 대신 동적 생성)
    const saltRounds = this.configService.get<number>(
      'auth.bcrypt.saltRounds',
      10,
    );
    this.dummyHash = bcrypt.hashSync(
      'dummy-timing-attack-prevention',
      saltRounds,
    );
  }

  /** 하이픈 제거 정규화 (010-1234-5678 → 01012345678) */
  private normalizePhone(phone: string): string {
    return phone.replace(/-/g, '').trim();
  }

  /** 이메일 정규화 (공백 제거 + 소문자) */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * [의도] 신규 사용자 등록 및 보안 처리
   * - 이메일 및 휴대폰 번호 중복을 사전에 차단하여 DB 무결성 보호
   * - 비밀번호는 bcrypt(10 rounds)를 사용하여 단방향 해싱 저장
   * @param createUserDto 회원가입 정보
   */
  async register(createUserDto: CreateUserDto) {
    // 0. 입력 정규화
    createUserDto.email = this.normalizeEmail(createUserDto.email);
    createUserDto.name = createUserDto.name.trim();

    // 1. 이메일 중복 검사
    const existingEmail = await this.userAuthRepository.findByEmail(
      createUserDto.email,
    );
    if (existingEmail) {
      throw new ConflictException(AUTH_ERRORS.EMAIL_EXISTS);
    }

    // 2. 휴대폰 번호 정규화 및 중복 검사
    createUserDto.phone = this.normalizePhone(createUserDto.phone);
    const existingPhone = await this.userAuthRepository.findByPhone(
      createUserDto.phone,
    );
    if (existingPhone) {
      throw new ConflictException(AUTH_ERRORS.PHONE_EXISTS);
    }

    // 3. KYC 본인인증 교차검증 (SMS_VERIFICATION 테이블)
    const kycRecord = await this.prisma.smsVerification.findFirst({
      where: {
        phone: createUserDto.phone,
        datetime: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // 30분 이내
      },
      orderBy: { datetime: 'desc' },
    });
    if (!kycRecord) {
      throw new BadRequestException(
        '본인 인증이 완료되지 않았습니다. 본인 인증을 먼저 진행해주세요.',
      );
    }

    // 4. 비밀번호 해싱 (보안 표준 준수)
    const hashedPassword = await this.passwordService.hash(
      createUserDto.password,
    );

    // 5. 은행 정보 처리 (verificationId 검증)
    let bankData = {};
    const {
      bankName,
      bankCode,
      accountNumber,
      accountHolder,
      verificationId,
      ...userFields
    } = createUserDto;

    if (verificationId) {
      // 5-1. 1원 인증 세션 검증
      const session = await this.prisma.kycVerifySession.findUnique({
        where: { verifyTrNo: verificationId },
      });

      if (!session) {
        throw new BadRequestException('유효하지 않은 인증 세션입니다.');
      }
      if (!session.isVerified) {
        throw new BadRequestException('아직 인증이 완료되지 않았습니다.');
      }
      if (session.expiresAt < new Date()) {
        await this.prisma.kycVerifySession.delete({
          where: { verifyTrNo: verificationId },
        });
        throw new BadRequestException('인증 세션이 만료되었습니다.');
      }

      // 5-2. 세션 정보 사용 (계좌번호는 이미 암호화됨)
      // KycService.issueBankVerification에서 암호화해서 저장함.
      // session.accountNumber를 그대로 사용하면 됨.
      bankData = {
        bankName: session.bankName,
        bankCode: session.bankCode,
        accountNumber: session.accountNumber, // Encrypted
        accountHolder: session.accountHolder,
        bankVerifiedAt: new Date(),
        kycStatus: KYC_STATUS.VERIFIED,
        kycVerifiedBy: 'EXTERNAL_KYC', // Coocon KCB 본인인증 + 1원 계좌인증
      };
    } else if (bankName || bankCode || accountNumber || accountHolder) {
      // 5-4. 직접 입력 차단 (보안)
      throw new BadRequestException(
        '은행 정보는 1원 인증을 통해서만 등록할 수 있습니다.',
      );
    }

    // 6. 사용자 생성 (finally에서 KYC 세션 삭제 — 성공/실패 무관하게 재사용 방지)
    try {
      const newUser = await this.userAuthRepository.create({
        ...userFields,
        ...bankData,
        password: hashedPassword,
      });

      // 7. 응답 시 비밀번호 등 민감 정보 제외 (Security by Default)
      const { password, ...result } = newUser;
      return result;
    } finally {
      if (verificationId) {
        await this.prisma.kycVerifySession
          .delete({ where: { verifyTrNo: verificationId } })
          .catch(() => {});
      }
    }
  }

  /**
   * [의도] 사용자 자격 증명 검증 (계정 잠금 포함)
   * - Timing Attack 방지: 사용자 존재 여부와 관계없이 항상 대략적으로 동일한 시간이 소요되도록 함
   * - Account Lockout: 연속 5회 실패 시 15분 잠금
   * @param email 로그인 이메일
   * @param pass 평문 비밀번호
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<SafeUserPayload | null> {
    email = this.normalizeEmail(email);
    const user = await this.userAuthRepository.findByEmail(email);

    // 계정 잠금 확인
    if (user) {
      const now = new Date();
      if (user.lockedUntil && user.lockedUntil > now) {
        // 잠금 중 — timing attack 방지용 더미 비교 후 거부
        await this.passwordService.compare(pass, user.password);
        const remainingMs = user.lockedUntil.getTime() - now.getTime();
        const remainingMin = Math.ceil(remainingMs / 60000);
        throw new UnauthorizedException(accountLockedMessage(remainingMin));
      }
      // 잠금 시간이 경과한 경우 실패 카운터 리셋
      if (user.lockedUntil && user.lockedUntil <= now) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
      }
    }

    // Timing Attack 방지를 위한 더미 비교
    // 사용자가 없더라도 bcrypt 비교를 수행하여 응답 시간을 비슷하게 맞춤
    const isPasswordValid = await this.passwordService.compare(
      pass,
      user?.password || this.dummyHash,
    );

    if (user && isPasswordValid) {
      // 로그인 성공 — 실패 카운터 리셋, 최종 로그인 시간 기록
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });
      const { password, ...result } = user;
      return result;
    }

    // 로그인 실패 — 실패 카운터 증가
    if (user) {
      const newCount = (user.failedLoginAttempts ?? 0) + 1;
      const lockData: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: newCount,
      };
      if (newCount >= AUTH_SECURITY.MAX_FAILED_ATTEMPTS) {
        lockData.lockedUntil = new Date(
          Date.now() + AUTH_SECURITY.LOCKOUT_DURATION_MINUTES * 60 * 1000,
        );
        this.logger.warn(
          `Account locked: ${email} after ${newCount} failed attempts`,
        );
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: lockData,
      });
    }

    return null;
  }

  /**
   * [의도] 로그인 처리 및 세션 발급
   * - MFA 활성화 시: mfa_required=true + 임시 mfa_token 반환
   * - MFA 비활성화 시: Access Token + Refresh Token 즉시 발급
   * @param user 검증된 사용자 객체
   */
  async login(user: SafeUserPayload, ipAddress?: string, userAgent?: string) {
    // MFA 활성화 여부 확인
    const mfaEnabled = await this.mfaService.isMfaEnabled(user.id);
    if (mfaEnabled) {
      // 임시 MFA 토큰 발급 (5분 유효, 세션 발급 아님)
      const mfaToken = this.jwtService.sign(
        { sub: user.id, purpose: 'mfa' },
        { expiresIn: '5m' },
      );
      return {
        mfa_required: true,
        mfa_token: mfaToken,
        user: { id: user.id, email: user.email },
      };
    }

    return this.issueTokens(user, ipAddress, userAgent);
  }

  /**
   * [의도] MFA 검증 후 토큰 발급
   * - 임시 mfa_token + TOTP 코드 검증 후 실제 세션 발급
   */
  async loginWithMfa(
    mfaToken: string,
    totpCode: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // mfa_token 검증
    let decoded: { sub: number; purpose: string };
    try {
      decoded = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);
    }
    if (decoded.purpose !== 'mfa') {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);
    }

    // TOTP 코드 검증
    const isValid = await this.mfaService.verifyToken(decoded.sub, totpCode);
    if (!isValid) {
      throw new UnauthorizedException('유효하지 않은 인증 코드입니다.');
    }

    // 사용자 조회 후 토큰 발급
    const user = await this.userAuthRepository.findById(decoded.sub);
    if (!user) throw new UnauthorizedException(AUTH_ERRORS.USER_NOT_FOUND);

    const { password, ...safeUser } = user;
    return this.issueTokens(safeUser, ipAddress, userAgent);
  }

  /**
   * [내부] 실제 Access/Refresh 토큰 발급
   */
  private async issueTokens(
    user: SafeUserPayload,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * [의도] Refresh Token을 이용한 세션 연장 (토큰 로테이션 적용)
   * - 보안 강화: 한번 사용된 Refresh Token은 즉시 폐기하고 새로 발급(Rotation)
   * - 탈취 방지: 동일한 RT로 재요청 시 무효화 처리 가능하도록 설계
   * @param refreshToken 클라이언트 쿠키에서 전달받은 토큰
   */
  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    try {
      // [보안 결정] DB 내 토큰 검색을 위해 SHA256 해싱 사용
      // bcrypt는 검색이 불가능하므로, 고유한 Opaque Token을 해싱하여 인덱싱된 필드에서 빠르게 조회
      const hashedToken = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { token: hashedToken },
        include: { user: true },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);
      }

      // 만료 여부 확인
      if (tokenRecord.expiresAt < new Date()) {
        await this.prisma.refreshToken.delete({
          where: { id: tokenRecord.id },
        });
        throw new UnauthorizedException(AUTH_ERRORS.TOKEN_EXPIRED);
      }

      // [핵심] 토큰 로테이션: 기존 사용된 토큰은 삭제하여 재사용 공격(Replay Attack) 방지
      await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });

      const newAccessToken = this.jwtService.sign({
        email: tokenRecord.user.email,
        sub: tokenRecord.user.id,
        role: tokenRecord.user.role,
      });
      // [절대 만료] 원본 expiresAt을 유지하여 세션이 연장되지 않도록 함
      const newRefreshToken = await this.generateRefreshToken(
        tokenRecord.user.id,
        ipAddress,
        userAgent,
        tokenRecord.expiresAt,
      );

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        user: {
          id: tokenRecord.user.id,
          email: tokenRecord.user.email,
          name: tokenRecord.user.name,
          role: tokenRecord.user.role,
        },
      };
    } catch (e) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);
    }
  }

  /**
   * [의도] 세션 강제 종료
   * - DB에서 RT를 삭제하여 해당 세션의 토큰 재발급 권한을 박탈
   */
  async logout(refreshToken: string) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    await this.prisma.refreshToken.deleteMany({
      where: { token: hashedToken },
    });
  }

  /**
   * [의도] 현재 로그인한 사용자 정보 조회
   * @param userId JWT에서 추출된 사용자 ID
   */
  async getMe(userId: number) {
    const user = await this.userAuthRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException(AUTH_ERRORS.USER_NOT_FOUND);
    }
    // 화이트리스트 방식: 클라이언트에 필요한 필드만 반환
    // (failedLoginAttempts, lockedUntil, passwordResetToken, totpSecret 등 내부 필드 노출 방지)
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      kycStatus: user.kycStatus,
      bankName: user.bankName ?? null,
      bankCode: user.bankCode ?? null,
      accountHolder: user.accountHolder ?? null,
      bankVerifiedAt: user.bankVerifiedAt ?? null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  /**
   * [의도] 고유한 Refresh Token 생성 및 DB 저장
   * - 고엔트로피 난수(32 bytes)를 사용하여 예측 불가능한 토큰 생성
   */
  private async generateRefreshToken(
    userId: number,
    ipAddress?: string,
    userAgent?: string,
    inheritedExpiresAt?: Date,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // [절대 만료] refresh 시에는 원본 만료 시각을 그대로 유지 (세션 연장 방지)
    // 최초 로그인 시에는 현재 시각 + sessionDurationMinutes로 새로 계산
    const expiresAt = inheritedExpiresAt
      ? new Date(inheritedExpiresAt)
      : new Date(Date.now() + this.sessionDurationMinutes * 60 * 1000);

    // 사용자당 최대 리프레시 토큰 수 제한 — 가장 오래된 토큰부터 삭제
    const existingTokens = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (existingTokens.length >= this.maxRefreshTokensPerUser) {
      const tokensToDelete = existingTokens.slice(
        0,
        existingTokens.length - this.maxRefreshTokensPerUser + 1,
      );
      await this.prisma.refreshToken.deleteMany({
        where: { id: { in: tokensToDelete.map((t) => t.id) } },
      });
    }

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent ? userAgent.substring(0, 255) : null,
      },
    });

    return token;
  }

  /**
   * [의도] 사용자 프로필 수정
   * - 이메일/휴대폰 변경 시 중복 검사
   */
  async updateProfile(userId: number, updateDto: UpdateProfileDto) {
    // 1. 이메일 변경 시 중복 검사
    if (updateDto.email) {
      const existingUser = await this.userAuthRepository.findByEmail(
        updateDto.email,
      );
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException(AUTH_ERRORS.EMAIL_EXISTS);
      }
    }

    // 2. 휴대폰 변경 시 정규화 + 중복 검사
    if (updateDto.phone) {
      updateDto.phone = this.normalizePhone(updateDto.phone);
      const existingUser = await this.userAuthRepository.findByPhone(
        updateDto.phone,
      );
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException(AUTH_ERRORS.DUPLICATE_INFO);
      }
    }

    const updatedUser = await this.userAuthRepository.updateProfile(
      userId,
      updateDto,
    );

    const { password, ...result } = updatedUser;
    return result;
  }

  /**
   * [의도] 비밀번호 변경
   * - KYC 계좌 인증(10분 이내) 확인
   * - 기존 비밀번호 검증 후 새 비밀번호 해싱 저장
   * - 모든 기존 세션 무효화 후 현재 기기에 새 토큰 발급
   */
  async changePassword(
    userId: number,
    changeDto: ChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.userAuthRepository.findById(userId);
    if (!user) throw new UnauthorizedException(AUTH_ERRORS.USER_NOT_FOUND);

    // 0. KYC 계좌 인증 확인 (10분 이내에 인증 완료되어야 함)
    if (
      !user.bankVerifiedAt ||
      Date.now() - new Date(user.bankVerifiedAt).getTime() > this.kycWindowMs
    ) {
      throw new BadRequestException(
        AUTH_ERRORS.KYC_REQUIRED_FOR_PASSWORD_CHANGE,
      );
    }

    // 1. 기존 비밀번호 검증
    const isPasswordValid = await this.passwordService.compare(
      changeDto.oldPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_OLD_PASSWORD);
    }

    // 2. 새 비밀번호 해싱
    const hashedPassword = await this.passwordService.hash(
      changeDto.newPassword,
    );

    // 3. 비밀번호 업데이트 + 모든 세션 무효화 (트랜잭션)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);

    // 4. 현재 기기에 새 토큰 발급 (MFA 재검증 불필요 — 이미 인증된 세션)
    const { password, ...safeUser } = user;
    return this.issueTokens(safeUser, ipAddress, userAgent);
  }

  /**
   * [의도] 비밀번호 분실 시 재설정 링크 발급
   * - 열거 공격 방지: 유저 존재 여부와 관계없이 동일 응답 반환
   * - 평문 토큰을 SHA256 해시하여 DB에 저장 (비교 검색 가능)
   * - 이메일 연동 전까지 서버 로그로 출력 (placeholder)
   */
  async forgotPassword(email: string) {
    email = this.normalizeEmail(email);
    const message = '비밀번호 재설정 링크가 이메일로 발송되었습니다.';

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });

    // 유저가 없거나 탈퇴한 경우에도 동일 응답 (열거 공격 방지)
    if (!user || user.deletedAt) {
      return { message };
    }

    // 평문 토큰 생성 → SHA256 해시 저장
    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');

    const expiry = new Date(
      Date.now() + this.passwordResetExpiryHours * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: expiry,
      },
    });

    // [Placeholder] 이메일 서비스 연동 전까지 토큰 존재만 기록 (평문 토큰 로그 금지)
    this.logger.log(
      `[Password Reset] Token generated for user ${user.id}, expires at ${expiry.toISOString()}`,
    );

    return { message };
  }

  /**
   * [의도] 토큰 기반 비밀번호 재설정
   * - 토큰 해시로 DB 매칭 → 만료 검증 → 비밀번호 갱신
   * - 성공 시 토큰 및 기존 세션(RefreshToken) 전체 삭제
   */
  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        deletedAt: null,
      },
      select: { id: true, passwordResetExpiry: true },
    });

    if (!user) {
      throw new BadRequestException(AUTH_ERRORS.RESET_TOKEN_INVALID);
    }

    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw new BadRequestException(AUTH_ERRORS.RESET_TOKEN_EXPIRED);
    }

    const hashedPassword = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      }),
      // 기존 세션 전체 무효화
      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return {
      message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.',
    };
  }

  /**
   * [의도] 활성 세션 목록 조회
   * - 현재 사용 중인 Refresh Token 목록 반환
   * - 요청 토큰에 대해 current 플래그 표시
   */
  async getActiveSessions(userId: number, currentRefreshToken?: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        token: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const currentHash = currentRefreshToken
      ? crypto.createHash('sha256').update(currentRefreshToken).digest('hex')
      : null;

    return tokens.map(({ token, ...rest }) => ({
      ...rest,
      current: currentHash ? token === currentHash : false,
    }));
  }

  /**
   * [의도] 특정 세션 강제 종료
   * - 사용자 소유 검증 후 해당 Refresh Token 삭제
   */
  async revokeSession(userId: number, tokenId: number) {
    const token = await this.prisma.refreshToken.findFirst({
      where: { id: tokenId, userId },
    });
    if (!token) {
      throw new BadRequestException(AUTH_ERRORS.SESSION_NOT_FOUND);
    }
    await this.prisma.refreshToken.delete({ where: { id: tokenId } });
    return { message: '세션이 종료되었습니다.' };
  }

  /**
   * [의도] 현재 세션을 제외한 모든 세션 종료
   */
  async revokeOtherSessions(userId: number, currentRefreshToken: string) {
    const currentHash = crypto
      .createHash('sha256')
      .update(currentRefreshToken)
      .digest('hex');

    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        token: { not: currentHash },
      },
    });

    return { message: '다른 모든 세션이 종료되었습니다.' };
  }
}
