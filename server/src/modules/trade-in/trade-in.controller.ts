/**
 * @file trade-in.controller.ts
 * @description 상품권 매입 API 컨트롤러 - 사용자가 보유한 상품권 PIN을 등록하여 현금화
 * @module modules/trade-in
 *
 * @summary 상품권 매입 신청 및 조회를 위한 REST API 컨트롤러
 *
 * API 엔드포인트:
 * - POST /trade-ins - 단건 매입 신청 (10회/분 제한)
 * - POST /trade-ins/bulk - 대량 매입 신청 (최대 50건, 5회/분 제한)
 * - GET /trade-ins/my - 내 매입 내역 조회
 * - GET /trade-ins/my/stats - 내 매입 통계 조회
 *
 * 사용처:
 * - 클라이언트 매입 페이지: 단건/대량 PIN 매입 신청, 내 매입 내역 조회
 *
 * 매입 플로우:
 * 1. 사용자가 PIN 번호 + 계좌 정보 입력하여 매입 신청
 * 2. 서버에서 PIN 중복 확인 → 정산 금액 자동 계산 → 암호화 후 저장
 * 3. 관리자가 PIN 유효성 검증 후 정산 처리 (AdminController에서 처리)
 *
 * 보안:
 * - 모든 엔드포인트 JWT 인증 필수
 * - 매입 신청에 Rate Limiting 적용 (악용 방지)
 * - PIN, 보안코드, 계좌번호는 AES-256으로 암호화하여 저장
 */
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CreateBulkTradeInDto } from './dto/create-bulk-trade-in.dto';
import { CreateTradeInDto } from './dto/create-trade-in.dto';
import { TradeInService } from './trade-in.service';
import { PaginationQueryDto } from '../../base/pagination.dto';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';

@ApiTags('Trade-Ins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trade-ins')
export class TradeInController {
  constructor(private readonly tradeInService: TradeInService) {}

  /**
   * 단건 매입 신청
   *
   * PIN 하나씩 개별 신청 (일반 사용자 대상)
   * Rate Limiting: 10회/분
   *
   * @param {CreateTradeInDto} dto - 매입 신청 데이터
   * @param {number} dto.productId - 상품 ID
   * @param {string} dto.pinCode - PIN 번호 (암호화 저장)
   * @param {string} [dto.securityCode] - 보안 코드 (암호화 저장)
   * @param {string} dto.accountNum - 정산 계좌번호 (암호화 저장)
   * @param {string} dto.bankName - 은행명
   * @param {string} dto.accountHolder - 예금주
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @returns {Promise<TradeIn>} 생성된 매입 신청 정보
   * @throws {NotFoundException} 상품 없음
   * @throws {BadRequestException} 매입 불가능한 상품
   * @throws {ConflictException} 중복 PIN
   */
  @Post()
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '매입 신청' })
  @ApiResponse({ status: 201, description: '매입 신청 성공' })
  @ApiResponse({ status: 400, description: '매입 불가능한 상품' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 404, description: '상품 없음' })
  @ApiResponse({ status: 409, description: '중복 PIN' })
  @ApiResponse({ status: 429, description: '요청 횟수 초과 (10회/분)' })
  create(@Body() dto: CreateTradeInDto, @Request() req: any) {
    const userId = req.user.id;
    return this.tradeInService.create({ ...dto, userId });
  }

  /**
   * 대량 매입 신청 (최대 50건)
   *
   * 파트너/대량 거래자 대상, 여러 PIN을 한 번에 신청
   * Rate Limiting: 5회/분 (단건보다 엄격, 서버 부하 방지)
   *
   * @param {CreateBulkTradeInDto} dto - 대량 매입 신청 데이터
   * @param {number} dto.productId - 상품 ID
   * @param {Array} dto.pins - PIN 목록 [{pinCode, securityCode?, giftNumber?}]
   * @param {string} dto.accountNum - 정산 계좌번호
   * @param {string} dto.bankName - 은행명
   * @param {string} dto.accountHolder - 예금주
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @returns {Promise<Object>} 대량 매입 결과
   * @returns {Array} returns.success - 성공한 PIN 목록
   * @returns {Array} returns.failed - 실패한 PIN 목록 (사유 포함)
   * @returns {number} returns.totalPayout - 총 정산 예정 금액
   */
  @Post('bulk')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '대량 매입 신청 (최대 50건)' })
  @ApiResponse({ status: 201, description: '대량 매입 결과' })
  @ApiResponse({ status: 400, description: '매입 불가능한 상품' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 404, description: '상품 없음' })
  @ApiResponse({ status: 429, description: '요청 횟수 초과 (5회/분)' })
  createBulk(@Body() dto: CreateBulkTradeInDto, @Request() req: any) {
    const userId = req.user.id;
    return this.tradeInService.createBulk({ ...dto, userId });
  }

  /**
   * 내 매입 내역 조회
   *
   * JWT에서 추출한 userId로 본인 내역만 조회
   * 최신순 정렬
   *
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @returns {Promise<TradeIn[]>} 매입 내역 목록
   */
  @Get('my')
  @ApiOperation({ summary: '내 매입 내역 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  getMyTradeIns(
    @Request() req: any,
    @Query() paginationDto: PaginationQueryDto,
  ) {
    return this.tradeInService.getMyTradeIns(req.user.id, paginationDto);
  }

  /**
   * 내 매입 통계 조회
   *
   * 상태별 건수, 누적 정산 금액, 월별 추이 등 대시보드 데이터
   *
   * @param {any} req - 요청 객체 (JWT에서 userId 추출)
   * @returns {Promise<Object>} 매입 통계
   * @returns {number} returns.totalCount - 전체 매입 건수
   * @returns {Object} returns.statusBreakdown - 상태별 건수 맵
   * @returns {number} returns.totalPayout - 누적 정산 금액 (VERIFIED/PAID만)
   * @returns {Array} returns.monthlyTrend - 월별 추이 (최근 12개월)
   */
  @Get('my/stats')
  @ApiOperation({ summary: '내 매입 통계 조회' })
  @ApiResponse({ status: 200, description: '통계 조회 성공' })
  getMyStats(@Request() req: any) {
    const userId = req.user.id;
    return this.tradeInService.getMyStats(userId);
  }
}
