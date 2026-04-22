import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { BankVerifyConfirmDto } from './dto/bank-verify-confirm.dto';
import { BankVerifyRequestDto } from './dto/bank-verify-request.dto';
import { KcbCompleteDto } from './dto/kcb-complete.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { KycService } from './kyc.service';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';

@ApiTags('KYC')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /**
   * 1원 인증 발송 요청 (비인증 허용 — 회원가입 시)
   * Rate Limit: 3회/분
   */
  @Post('bank-verify/request')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: '1원 인증 발송 요청' })
  async requestBankVerify(
    @Body() dto: BankVerifyRequestDto,
    @Request() req: any,
  ) {
    // 로그인 상태면 userId 전달, 아니면 null
    const userId = req.user?.id ?? null;
    return this.kycService.issueBankVerification(userId, dto);
  }

  /**
   * 인증번호 확인 (비인증 허용 — 회원가입 시)
   * Rate Limit: 5회/분
   */
  @Post('bank-verify/confirm')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '1원 인증 확인' })
  async confirmBankVerify(
    @Body() dto: BankVerifyConfirmDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id ?? null;
    return this.kycService.confirmBankVerification(userId, dto);
  }

  /**
   * KCB PASS 인증 시작 — 팝업 URL 반환
   * Rate Limit: 3회/분
   */
  @Post('kcb/start')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'KCB PASS 인증 시작 (팝업 URL 반환)' })
  async startKcbAuth() {
    return this.kycService.startKcbAuth();
  }

  /**
   * KCB PASS 인증 상태 확인 — 클라이언트 폴링용
   * Rate Limit: 60회/분 (1.5초 간격 폴링 감안)
   */
  @Get('kcb/check-status')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'KCB PASS 인증 상태 확인 (클라이언트 폴링용)' })
  async checkKcbStatus(@Query('kcbAuthId') kcbAuthId: string) {
    return this.kycService.checkKcbStatus(kcbAuthId);
  }

  /**
   * KCB PASS 인증 완료 — 클라이언트가 폴링 결과와 함께 전달
   * Rate Limit: 5회/분
   */
  @Post('kcb/complete')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'KCB PASS 인증 완료 확인' })
  async completeKcbAuth(@Body() dto: KcbCompleteDto) {
    const { kcbAuthId, ...resultData } = dto;
    return this.kycService.completeKcbAuth(kcbAuthId, resultData);
  }

  /**
   * Coocon KYC 본인인증 결과 검증 (비인증 허용 — 회원가입 시)
   * Rate Limit: 5회/분
   */
  @Post('verify-identity')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'KYC 본인인증 결과 검증' })
  async verifyIdentity(@Body() dto: VerifyIdentityDto) {
    return this.kycService.verifyIdentity(dto.phone);
  }

  /**
   * 계좌 정보 조회 (JWT 필수)
   */
  @Get('bank-account')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 계좌 정보 조회' })
  async getBankAccount(@Request() req: any) {
    return this.kycService.getBankAccount(req.user.id);
  }

  /**
   * 계좌 변경 + 1원 인증 (JWT 필수 — MyPage)
   */
  @Post('bank-account')
  @UseGuards(AuthGuard('jwt'), UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: '계좌 변경 (1원 인증 필수)' })
  async changeBankAccount(
    @Body() dto: BankVerifyConfirmDto,
    @Request() req: any,
  ) {
    return this.kycService.changeBankAccount(req.user.id, dto);
  }
}
