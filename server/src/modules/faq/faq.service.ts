import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';
import { BaseCrudService } from '../../base/base-crud.service';
import { Faq } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class FaqService extends BaseCrudService<
  Faq,
  CreateFaqDto,
  UpdateFaqDto
> {
  constructor(private prisma: PrismaService) {
    super(prisma.faq);
  }

  /**
   * [의도] 공개 상세 조회 시 비활성 콘텐츠 접근 차단
   */
  async findOne(id: number): Promise<Faq> {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq || !faq.isActive) {
      throw new NotFoundException('FAQ를 찾을 수 없습니다.');
    }
    return faq;
  }

  /**
   * [의도] 활성화된 FAQ 목록 제공
   * - isActive가 true인 FAQ만 노출
   * - 카테고리별 필터링 지원
   * - order 기준으로 정렬
   */
  async getActiveFaqs(category?: string) {
    const where: any = {
      isActive: true,
    };

    if (category && category !== 'ALL') {
      where.category = category;
    }

    return this.prisma.faq.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  /**
   * [의도] 카테고리 목록 조회
   * - 활성화된 FAQ에서 사용 중인 카테고리만 반환
   */
  async getCategories() {
    const faqs = await this.prisma.faq.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });
    return faqs.map((f) => f.category);
  }

  /**
   * [의도] 도움됨 카운트 증가
   * - 사용자 피드백을 통한 FAQ 유용성 측정
   * @param id FAQ ID
   */
  async incrementHelpfulCount(id: number) {
    return this.prisma.faq.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
  }
}
