import { Injectable } from '@nestjs/common';

import { PaginationQueryDto } from '../../../base/pagination.dto';
import { EventService } from '../../event/event.service';
import { FaqService } from '../../faq/faq.service';
import { InquiryService } from '../../inquiry/inquiry.service';
import { CreateNoticeDto, UpdateNoticeDto } from '../../notice/dto/notice.dto';
import { NoticeService } from '../../notice/notice.service';
import {
  AdminCreateEventDto,
  AdminUpdateEventDto,
} from '../dto/admin-event.dto';
import { AdminCreateFaqDto, AdminUpdateFaqDto } from '../dto/admin-faq.dto';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly noticeService: NoticeService,
    private readonly eventService: EventService,
    private readonly faqService: FaqService,
    private readonly inquiryService: InquiryService,
  ) {}

  // ========================================
  // Notices CRUD — delegated to NoticeService
  // ========================================

  async findAllNotices(paginationDto: PaginationQueryDto) {
    return this.noticeService.findAllPaginated({
      page: paginationDto.page,
      limit: paginationDto.limit,
      sort: paginationDto.sort,
      order: paginationDto.order,
    });
  }

  async findOneNotice(id: number) {
    return this.noticeService.findOne(id);
  }

  async createNotice(dto: CreateNoticeDto) {
    return this.noticeService.create(dto);
  }

  async updateNotice(id: number, dto: UpdateNoticeDto) {
    return this.noticeService.update(id, dto);
  }

  async deleteNotice(id: number) {
    return this.noticeService.remove(id);
  }

  // ========================================
  // Events CRUD — date conversion handled here
  // ========================================

  async findAllEvents(paginationDto: PaginationQueryDto) {
    return this.eventService.findAllPaginated({
      page: paginationDto.page,
      limit: paginationDto.limit,
      sort: paginationDto.sort,
      order: paginationDto.order,
    });
  }

  async findOneEvent(id: number) {
    return this.eventService.findOne(id);
  }

  async createEvent(dto: AdminCreateEventDto) {
    return this.eventService.create({
      ...dto,
      startDate: new Date(dto.startDate) as any,
      endDate: new Date(dto.endDate) as any,
    });
  }

  async updateEvent(id: number, dto: AdminUpdateEventDto) {
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    return this.eventService.update(id, data);
  }

  async deleteEvent(id: number) {
    return this.eventService.remove(id);
  }

  // ========================================
  // FAQs CRUD — delegated to FaqService
  // ========================================

  async findAllFaqs(paginationDto: PaginationQueryDto, category?: string) {
    return this.faqService.findAllPaginated({
      page: paginationDto.page,
      limit: paginationDto.limit,
      sort: paginationDto.sort ?? 'order',
      order: paginationDto.order ?? 'asc',
      where: category ? { category } : undefined,
    });
  }

  async findOneFaq(id: number) {
    return this.faqService.findOne(id);
  }

  async createFaq(dto: AdminCreateFaqDto) {
    return this.faqService.create(dto);
  }

  async updateFaq(id: number, dto: AdminUpdateFaqDto) {
    return this.faqService.update(id, dto);
  }

  async deleteFaq(id: number) {
    return this.faqService.remove(id);
  }

  // ========================================
  // Inquiries CRUD — delegated to InquiryService
  // ========================================

  async findAllInquiries(
    paginationDto: PaginationQueryDto,
    status?: string,
    category?: string,
  ) {
    // InquiryService에 위임하여 도메인 경계 유지
    return this.inquiryService.findAllPaginatedForAdmin(paginationDto, {
      status,
      category,
    });
  }

  async findOneInquiry(id: number) {
    // InquiryService에 위임하여 도메인 경계 유지
    return this.inquiryService.findOneWithUser(id);
  }

  async answerInquiry(id: number, answer: string, adminId: number) {
    return this.inquiryService.answerInquiry(id, answer, adminId);
  }

  async closeInquiry(id: number) {
    return this.inquiryService.closeInquiry(id);
  }

  async deleteInquiry(id: number) {
    return this.inquiryService.remove(id);
  }
}
