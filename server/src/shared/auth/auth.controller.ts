/**
 * @file auth.controller.ts
 * @description 인증 API 컨트롤러 - 회원가입, 로그인, 현재 사용자 조회 엔드포인트
 * @module auth
 *
 * 엔드포인트:
 * - POST /auth/register - 회원가입 (5회/분 제한)
 * - POST /auth/login - 로그인 (10회/분 제한)
 * - GET /auth/me - 현재 로그인 사용자 정보 조회 (인증 필요)
 * - POST /auth/refresh - 토큰 갱신 (쿠키 기반, JWT 불필요)
 * - POST /auth/logout - 로그아웃 (인증 필요)
 */
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
  UnauthorizedException,
  Res,
  HttpCode,
  Patch,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AuditService } from '../audit/audit.service';
import { AUTH_ERRORS } from '../constants/errors';
import { UserThrottleGuard } from '../guards/user-throttle.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto, MfaLoginDto } from './dto/mfa.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateUserDto } from '../../modules/users/dto/create-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly sessionDurationMs: number;

  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.sessionDurationMs =
      this.configService.get<number>('auth.jwt.sessionDurationMinutes', 60) *
      60 *
      1000;
  }

  private getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure:
        process.env.COOKIE_SECURE === 'true' ||
        (process.env.NODE_ENV === 'production' &&
          process.env.COOKIE_SECURE !== 'false'),
      sameSite: 'lax' as const,
      path: '/',
      maxAge: this.sessionDurationMs,
    };
  }

  /**
   * [의도] 신규 회원 가입
   * - Rate Limit 적용으로 무분별한 계정 생성 방지
   */
  @Post('register')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  /**
   * [의도] 로그인 및 보안 쿠키 발급
   * - Access Token: Body로 반환하여 FE 메모리(Zustand)에 저장
   * - Refresh Token: HttpOnly 쿠키로 설정하여 XSS로부터 보호
   */
  @Post('login')
  @HttpCode(200)
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login user' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      await this.auditService.log({
        action: 'AUTH_LOGIN_FAILED',
        resource: 'auth',
        newValue: { email: loginDto.email },
        ip,
        userAgent: ua,
      });
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    const result = await this.authService.login(user, ip, ua);

    // MFA가 필요한 경우 토큰 없이 반환
    if ('mfa_required' in result) {
      return result;
    }

    // Refresh Token을 HttpOnly Cookie로 설정 (XSS 방지)
    res.cookie(
      'refresh_token',
      result.refresh_token,
      this.getRefreshCookieOptions(),
    );

    return { access_token: result.access_token, user: result.user };
  }

  /**
   * [의도] MFA 2단계 인증 — TOTP 코드 검증 후 토큰 발급
   */
  @Post('login/mfa')
  @HttpCode(200)
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'MFA 2단계 인증' })
  async loginMfa(
    @Body() dto: MfaLoginDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.authService.loginWithMfa(
      dto.mfaToken,
      dto.token,
      ip,
      ua,
    );

    res.cookie(
      'refresh_token',
      result.refresh_token,
      this.getRefreshCookieOptions(),
    );

    return { access_token: result.access_token, user: result.user };
  }

  /**
   * [의도] 현재 세션 정보 조회
   * - JWT Strategy를 통해 추출된 user.id 사용
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }

  /**
   * [의도] 토큰 갱신 (Silent Refresh)
   * - 쿠키에서 RT를 읽어 AT 재발급
   * - 토큰 로테이션(RT 갱신) 포함
   *
   * [보안] JWT 가드를 의도적으로 적용하지 않음
   * - Access Token이 만료된 상태에서 호출되는 엔드포인트이므로 JWT 인증 불가
   * - 대신 HttpOnly 쿠키의 Refresh Token으로 인증 (DB에서 유효성 검증)
   * - Refresh Token 로테이션으로 토큰 재사용 공격 방지
   */
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token using cookie' })
  async refresh(@Request() req: any, @Res({ passthrough: true }) res: any) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_NOT_FOUND);
    }

    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    const {
      access_token,
      refresh_token: newRefreshToken,
      user,
    } = await this.authService.refresh(refreshToken, ip, ua);

    // 새 Refresh Token으로 갱신
    res.cookie(
      'refresh_token',
      newRefreshToken,
      this.getRefreshCookieOptions(),
    );

    return { access_token, user };
  }

  /**
   * [의도] 안전한 로그아웃
   * - 서버측 세션(DB) 무효화 및 클라이언트 쿠키 삭제
   * - JWT 인증 필수: 익명 로그아웃 요청 차단
   */
  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Request() req: any, @Res({ passthrough: true }) res: any) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Logged out successfully' };
  }

  /**
   * [의도] 비밀번호 분실 시 재설정 링크 요청
   */
  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Request password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /**
   * [의도] 토큰 기반 비밀번호 재설정
   */
  @Post('reset-password')
  @HttpCode(200)
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  /**
   * [의도] 프로필 수정 (이름, 이메일, 휴대폰, 알림 설정)
   */
  @Patch('profile')
  @UseGuards(AuthGuard('jwt'), UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @Request() req: any,
    @Body() updateDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.id, updateDto);
  }

  /**
   * [의도] 비밀번호 변경
   */
  @Patch('password')
  @UseGuards(AuthGuard('jwt'), UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @Request() req: any,
    @Body() changeDto: ChangePasswordDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    const { access_token, refresh_token, user } =
      await this.authService.changePassword(req.user.id, changeDto, ip, ua);

    // 새 Refresh Token 쿠키 설정
    res.cookie('refresh_token', refresh_token, this.getRefreshCookieOptions());

    return { access_token, user, message: 'Password changed successfully' };
  }

  // =========================================================
  // Session Management
  // =========================================================

  /**
   * [의도] 활성 세션 목록 조회
   */
  @Get('sessions')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions' })
  async listSessions(@Request() req: any) {
    const refreshToken = req.cookies['refresh_token'];
    return this.authService.getActiveSessions(req.user.id, refreshToken);
  }

  /**
   * [의도] 현재 세션 외 모든 세션 종료
   */
  @Delete('sessions')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all other sessions' })
  async revokeAllSessions(@Request() req: any) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_NOT_FOUND);
    }
    return this.authService.revokeOtherSessions(req.user.id, refreshToken);
  }

  /**
   * [의도] 특정 세션 종료
   */
  @Delete('sessions/:id')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(
    @Request() req: any,
    @Param('id', ParseIntPipe) sessionId: number,
  ) {
    return this.authService.revokeSession(req.user.id, sessionId);
  }

  // =========================================================
  // MFA (Multi-Factor Authentication)
  // =========================================================

  /**
   * [의도] MFA 설정 시작 — TOTP 비밀키 및 QR URI 반환
   */
  @Post('mfa/setup')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'MFA 설정 시작' })
  async setupMfa(@Request() req: any) {
    return this.mfaService.setupMfa(req.user.id);
  }

  /**
   * [의도] MFA 활성화 확인 — TOTP 코드 검증 후 활성화
   */
  @Post('mfa/verify')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'MFA 활성화 확인' })
  async verifyMfa(@Request() req: any, @Body() dto: MfaVerifyDto) {
    return this.mfaService.verifyAndEnableMfa(req.user.id, dto.token);
  }

  /**
   * [의도] MFA 비활성화 — 현재 TOTP 코드 검증 후 비활성화
   */
  @Post('mfa/disable')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'MFA 비활성화' })
  async disableMfa(@Request() req: any, @Body() dto: MfaVerifyDto) {
    return this.mfaService.disableMfa(req.user.id, dto.token);
  }

  /**
   * [의도] MFA 상태 확인
   */
  @Get('mfa/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'MFA 상태 확인' })
  async getMfaStatus(@Request() req: any) {
    const enabled = await this.mfaService.isMfaEnabled(req.user.id);
    return { mfaEnabled: enabled };
  }
}
