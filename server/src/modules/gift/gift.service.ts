/**
 * @file gift.service.ts
 * @description 선물하기 서비스 - 선물 수신자 확인 및 검색
 * @module modules/gift
 *
 * @summary 선물 기능의 비즈니스 로직
 *
 * 주요 기능:
 * - 선물 수신자 이메일로 수신 가능 여부 확인
 * - 이름/이메일로 수신 가능한 회원 검색 (자동완성용)
 *
 * 수신 조건:
 * - 가입된 회원이어야 함
 *
 * 사용처:
 * - GiftController: 선물 수신자 사전 확인 API
 * - 주문 생성 시 giftReceiverEmail 검증 (OrdersService에서 호출)
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { GIFT_STATUS } from '../../shared/constants';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class GiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 선물 수신자 확인
   *
   * 이메일로 사용자를 조회하고 선물 수신 가능 여부 확인
   *
   * @param {string} email - 수신자 이메일
   * @returns {Promise<Object>} 수신자 정보
   * @returns {boolean} returns.success - 수신 가능 여부
   * @returns {number} returns.receiverId - 수신자 ID
   * @returns {string | null} returns.name - 수신자 이름
   * @returns {string} returns.email - 수신자 이메일
   * @throws {BadRequestException} 사용자 없음 또는 수신 불가 상태
   */
  async checkReceiver(email: string) {
    // UsersService에 위임하여 도메인 경계 유지
    const user = await this.usersService.findReceivableByEmail(email);

    if (!user) {
      throw new BadRequestException(
        '선물을 받을 수 없는 상태이거나 존재하지 않는 이메일입니다.',
      );
    }

    return {
      success: true,
      receiverId: user.id,
      name: user.name,
      email: user.email,
    };
  }

  /**
   * 선물 수신자 검색
   *
   * 이메일 부분 일치로 수신 가능한 회원 검색
   * 선물 보내기 UI에서 자동완성 기능에 사용
   *
   * @param {string} query - 검색어 (최소 3자 이상)
   * @returns {Promise<Array>} 검색 결과 (최대 10명)
   * @returns {number} returns[].id - 사용자 ID
   * @returns {string} returns[].email - 이메일
   * @returns {string | null} returns[].name - 이름
   */
  async searchReceiver(query: string) {
    // UsersService에 위임하여 도메인 경계 유지
    return this.usersService.searchReceivableUsers(query, 10);
  }

  /**
   * 선물 수령 (claim)
   *
   * 수신자가 선물을 수락하면 SENT → CLAIMED 전이
   * 수령 후 바우처 PIN을 확인할 수 있게 됨
   *
   * @param {number} giftId - 선물 ID
   * @param {number} receiverId - 요청 사용자 ID (수신자 본인 확인)
   * @returns 업데이트된 선물 (order + voucherCodes 포함)
   */
  async claimGift(giftId: number, receiverId: number) {
    const gift = await this.prisma.gift.findUnique({
      where: { id: giftId },
      include: { order: { include: { voucherCodes: true } } },
    });

    if (!gift) throw new NotFoundException('선물을 찾을 수 없습니다.');
    if (gift.receiverId !== receiverId) throw new ForbiddenException();
    if (gift.status !== GIFT_STATUS.SENT) {
      throw new BadRequestException('이미 수령하였거나 만료된 선물입니다.');
    }
    if (gift.expiresAt && gift.expiresAt < new Date()) {
      throw new BadRequestException('만료된 선물입니다.');
    }

    return this.prisma.gift.update({
      where: { id: giftId },
      data: { status: GIFT_STATUS.CLAIMED, claimedAt: new Date() },
      include: { order: { include: { voucherCodes: true } } },
    });
  }
}
