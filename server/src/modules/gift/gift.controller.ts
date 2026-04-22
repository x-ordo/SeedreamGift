/**
 * @file gift.controller.ts
 * @description 선물하기 API 컨트롤러 - 수신자 확인 및 검색 엔드포인트
 * @module modules/gift
 *
 * 사용처:
 * - 클라이언트 주문 페이지: 선물 수신자 이메일 확인, 수신자 검색
 *
 * 선물 플로우 (전체):
 * 1. [이 컨트롤러] 수신자 이메일로 선물 수신 가능 여부 사전 확인
 * 2. [OrdersController] 주문 생성 시 receiverEmail 포함하면 선물 주문으로 처리
 * 3. [OrdersService] 결제 완료 후 Gift 레코드 생성 + 수신자에게 바우처 할당
 *
 * 수신 조건:
 * - 가입된 회원이어야 함
 */
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  HttpCode,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CheckReceiverDto } from './dto/check-receiver.dto';
import { SearchReceiverDto } from './dto/search-receiver.dto';
import { GiftService } from './gift.service';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';

@ApiTags('Gifts')
@Controller('gifts')
export class GiftController {
  constructor(private readonly giftService: GiftService) {}

  // 주문 전에 수신자가 선물을 받을 수 있는 상태인지 미리 확인
  // POST지만 데이터 변경이 없으므로 HttpCode(200) 사용
  @Post('check-receiver')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: '선물 수신자 확인' })
  @ApiResponse({ status: 200, description: '수신 가능' })
  @ApiResponse({
    status: 400,
    description: '수신 불가능 (존재하지 않거나 권한 없음)',
  })
  async checkReceiver(@Body() dto: CheckReceiverDto) {
    return this.giftService.checkReceiver(dto.email);
  }

  // 이메일 부분 일치로 수신 가능한 회원 검색
  // 선물 보내기 UI에서 자동완성 기능에 사용
  @Get('search')
  @UseGuards(JwtAuthGuard, UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: '선물 수신자 검색' })
  @ApiResponse({ status: 200, description: '검색 결과 (List)' })
  async searchReceiver(@Query() dto: SearchReceiverDto) {
    return this.giftService.searchReceiver(dto.query);
  }

  /** 선물 수령 — 수신자가 선물을 수락 (SENT → CLAIMED) */
  @Post(':id/claim')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '선물 수령' })
  @ApiResponse({ status: 200, description: '수령 완료' })
  @ApiResponse({ status: 400, description: '이미 수령/만료됨' })
  @ApiResponse({ status: 403, description: '본인 선물이 아님' })
  async claimGift(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.giftService.claimGift(id, req.user.id);
  }
}
