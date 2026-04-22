import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { CreateInquiryDto, UpdateInquiryDto } from './dto/inquiry.dto';
import { BaseCrudService } from '../../base/base-crud.service';
import { paginatedQuery } from '../../base/paginated-query';
import { PaginationQueryDto } from '../../base/pagination.dto';
import { INQUIRY_STATUS } from '../../shared/constants/statuses';
import { Inquiry } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class InquiryService extends BaseCrudService<
  Inquiry,
  CreateInquiryDto,
  UpdateInquiryDto
> {
  constructor(private prisma: PrismaService) {
    super(prisma.inquiry);
  }

  /** 내 문의 목록 (최신순) */
  async findMyInquiries(userId: number): Promise<Inquiry[]> {
    return this.prisma.inquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** userId 주입하여 문의 생성 */
  async createInquiry(userId: number, dto: CreateInquiryDto): Promise<Inquiry> {
    return this.prisma.inquiry.create({
      data: {
        userId,
        category: dto.category,
        subject: dto.subject,
        content: dto.content,
        status: INQUIRY_STATUS.PENDING,
      },
    });
  }

  /** PENDING 상태인 내 문의만 수정 가능 */
  async updateMyInquiry(
    userId: number,
    id: number,
    dto: UpdateInquiryDto,
  ): Promise<Inquiry> {
    const inquiry = await this.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    if (inquiry.userId !== userId) {
      throw new ForbiddenException('본인의 문의만 수정할 수 있습니다.');
    }
    if (inquiry.status !== INQUIRY_STATUS.PENDING) {
      throw new BadRequestException(
        '답변대기 상태인 문의만 수정할 수 있습니다.',
      );
    }
    return this.prisma.inquiry.update({
      where: { id },
      data: dto,
    });
  }

  /** 내 문의만 삭제 */
  async deleteMyInquiry(userId: number, id: number): Promise<Inquiry> {
    const inquiry = await this.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    if (inquiry.userId !== userId) {
      throw new ForbiddenException('본인의 문의만 삭제할 수 있습니다.');
    }
    return this.prisma.inquiry.delete({ where: { id } });
  }

  /**
   * 관리자용 문의 페이지네이션 조회 (유저 정보 포함)
   *
   * AdminContentService 도메인 경계 메서드.
   */
  async findAllPaginatedForAdmin(
    paginationDto: PaginationQueryDto,
    filters?: { status?: string; category?: string },
  ) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;

    return paginatedQuery(this.prisma.inquiry, {
      pagination: paginationDto,
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  /**
   * 관리자용 문의 상세 조회 (유저 정보 포함)
   *
   * AdminContentService 도메인 경계 메서드.
   */
  async findOneWithUser(id: number) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!inquiry) throw new NotFoundException('문의를 찾을 수 없습니다.');
    return inquiry;
  }

  /** 관리자 답변 등록 */
  async answerInquiry(
    id: number,
    answer: string,
    adminId: number,
  ): Promise<Inquiry> {
    const inquiry = await this.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    return this.prisma.inquiry.update({
      where: { id },
      data: {
        answer,
        answeredBy: adminId,
        answeredAt: new Date(),
        status: INQUIRY_STATUS.ANSWERED,
      },
    });
  }

  /** 문의 종료 */
  async closeInquiry(id: number): Promise<Inquiry> {
    const inquiry = await this.prisma.inquiry.findUnique({ where: { id } });
    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    return this.prisma.inquiry.update({
      where: { id },
      data: { status: INQUIRY_STATUS.CLOSED },
    });
  }
}
