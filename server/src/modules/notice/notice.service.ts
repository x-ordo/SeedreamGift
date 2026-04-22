import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateNoticeDto, UpdateNoticeDto } from './dto/notice.dto';
import { BaseCrudService } from '../../base/base-crud.service';
import { Notice } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class NoticeService extends BaseCrudService<
  Notice,
  CreateNoticeDto,
  UpdateNoticeDto
> {
  constructor(private prisma: PrismaService) {
    super(prisma.notice);
  }

  /**
   * [의도] 공개 상세 조회 시 비활성 콘텐츠 접근 차단
   * - BaseCrudController의 GET /:id가 이 메서드를 호출
   * - isActive=false인 비공개 공지는 404 반환
   */
  async findOne(id: number): Promise<Notice> {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice || !notice.isActive) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }
    return notice;
  }

  /**
   * [의도] 활성화된 공지사항 목록 제공
   * - 비공개(isActive: false) 상태인 공지사항을 필터링하여 사용자 노출 제어
   * - 최신 소식을 상단에 배치하기 위해 작성일 기준 내림차순 정렬
   */
  async getActiveNotices() {
    return this.prisma.notice.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * [의도] 콘텐츠 인기 지표 측정
   * - 특정 공지사항의 가시성을 파악하기 위해 조회수 증가 처리
   * @param id 공지사항 ID
   */
  async incrementViewCount(id: number) {
    return this.prisma.notice.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }
}
