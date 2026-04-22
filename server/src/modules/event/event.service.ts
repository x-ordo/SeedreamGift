import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { BaseCrudService } from '../../base/base-crud.service';
import { Event } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class EventService extends BaseCrudService<
  Event,
  CreateEventDto,
  UpdateEventDto
> {
  constructor(private prisma: PrismaService) {
    super(prisma.event);
  }

  /**
   * [의도] 공개 상세 조회 시 비활성 콘텐츠 접근 차단
   */
  async findOne(id: number): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event || !event.isActive) {
      throw new NotFoundException('이벤트를 찾을 수 없습니다.');
    }
    return event;
  }

  /**
   * [의도] 활성화된 이벤트 목록 제공
   * - 현재 진행 중인 이벤트만 필터링 (startDate <= now <= endDate)
   * - isActive가 true인 이벤트만 노출
   * - featured 이벤트가 상단에 오도록 정렬
   */
  async getActiveEvents(status?: string) {
    const now = new Date();

    const where: any = {
      isActive: true,
    };

    // 상태별 필터링
    if (status === 'ongoing') {
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    } else if (status === 'upcoming') {
      where.startDate = { gt: now };
    } else if (status === 'ended') {
      where.endDate = { lt: now };
    }

    return this.prisma.event.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { startDate: 'desc' }],
      take: 50,
    });
  }

  /**
   * [의도] 메인 페이지용 featured 이벤트 조회
   */
  async getFeaturedEvents() {
    const now = new Date();
    return this.prisma.event.findMany({
      where: {
        isActive: true,
        isFeatured: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: 'desc' },
      take: 5,
    });
  }

  /**
   * [의도] 콘텐츠 인기 지표 측정
   * - 특정 이벤트의 가시성을 파악하기 위해 조회수 증가 처리
   * @param id 이벤트 ID
   */
  async incrementViewCount(id: number) {
    return this.prisma.event.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }
}
