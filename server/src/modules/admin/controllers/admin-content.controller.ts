import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { PaginationQueryDto } from '../../../base/pagination.dto';
import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type { RequestWithUser } from '../../../shared/auth/request-with-user.interface';
import { RolesGuard, Roles } from '../../../shared/auth/roles.guard';
import { CreateNoticeDto, UpdateNoticeDto } from '../../notice/dto/notice.dto';
import {
  AdminCreateEventDto,
  AdminUpdateEventDto,
} from '../dto/admin-event.dto';
import { AdminCreateFaqDto, AdminUpdateFaqDto } from '../dto/admin-faq.dto';
import { AdminAnswerInquiryDto } from '../dto/admin-inquiry.dto';
import { AdminInquiriesQueryDto } from '../dto/admin-query.dto';
import { AdminContentService } from '../services';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminContentController {
  constructor(private readonly contentService: AdminContentService) {}

  // ========================================
  // Notices Management
  // ========================================

  @Get('notices')
  @ApiOperation({ summary: '공지사항 목록 조회' })
  findAllNotices(@Query() paginationDto: PaginationQueryDto) {
    return this.contentService.findAllNotices(paginationDto);
  }

  @Get('notices/:id')
  @ApiOperation({ summary: '공지사항 상세 조회' })
  findOneNotice(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.findOneNotice(id);
  }

  @Post('notices')
  @ApiOperation({ summary: '공지사항 생성' })
  createNotice(@Body() dto: CreateNoticeDto) {
    return this.contentService.createNotice(dto);
  }

  @Patch('notices/:id')
  @ApiOperation({ summary: '공지사항 수정' })
  updateNotice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.contentService.updateNotice(id, dto);
  }

  @Delete('notices/:id')
  @ApiOperation({ summary: '공지사항 삭제' })
  deleteNotice(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.deleteNotice(id);
  }

  // ========================================
  // Events Management
  // ========================================

  @Get('events')
  @ApiOperation({ summary: '이벤트 목록 조회' })
  findAllEvents(@Query() paginationDto: PaginationQueryDto) {
    return this.contentService.findAllEvents(paginationDto);
  }

  @Get('events/:id')
  @ApiOperation({ summary: '이벤트 상세 조회' })
  findOneEvent(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.findOneEvent(id);
  }

  @Post('events')
  @ApiOperation({ summary: '이벤트 생성' })
  createEvent(@Body() dto: AdminCreateEventDto) {
    return this.contentService.createEvent(dto);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: '이벤트 수정' })
  updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateEventDto,
  ) {
    return this.contentService.updateEvent(id, dto);
  }

  @Delete('events/:id')
  @ApiOperation({ summary: '이벤트 삭제' })
  deleteEvent(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.deleteEvent(id);
  }

  // ========================================
  // FAQs Management
  // ========================================

  @Get('faqs')
  @ApiOperation({ summary: 'FAQ 목록 조회' })
  @ApiQuery({ name: 'category', required: false, type: String })
  findAllFaqs(@Query() query: AdminInquiriesQueryDto) {
    const { page, limit, sort, order, category } = query;
    return this.contentService.findAllFaqs(
      { page, limit, sort, order },
      category,
    );
  }

  @Get('faqs/:id')
  @ApiOperation({ summary: 'FAQ 상세 조회' })
  findOneFaq(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.findOneFaq(id);
  }

  @Post('faqs')
  @ApiOperation({ summary: 'FAQ 생성' })
  createFaq(@Body() dto: AdminCreateFaqDto) {
    return this.contentService.createFaq(dto);
  }

  @Patch('faqs/:id')
  @ApiOperation({ summary: 'FAQ 수정' })
  updateFaq(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateFaqDto,
  ) {
    return this.contentService.updateFaq(id, dto);
  }

  @Delete('faqs/:id')
  @ApiOperation({ summary: 'FAQ 삭제' })
  deleteFaq(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.deleteFaq(id);
  }

  // ========================================
  // Inquiries Management
  // ========================================

  @Get('inquiries')
  @ApiOperation({ summary: '1:1 문의 목록 조회' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  findAllInquiries(@Query() query: AdminInquiriesQueryDto) {
    const { page, limit, sort, order, status, category } = query;
    return this.contentService.findAllInquiries(
      { page, limit, sort, order },
      status,
      category,
    );
  }

  @Get('inquiries/:id')
  @ApiOperation({ summary: '문의 상세 조회' })
  findOneInquiry(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.findOneInquiry(id);
  }

  @Patch('inquiries/:id/answer')
  @ApiOperation({ summary: '문의 답변 등록' })
  answerInquiry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminAnswerInquiryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.contentService.answerInquiry(id, dto.answer, req.user.id);
  }

  @Patch('inquiries/:id/close')
  @ApiOperation({ summary: '문의 종료 처리' })
  closeInquiry(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.closeInquiry(id);
  }

  @Delete('inquiries/:id')
  @ApiOperation({ summary: '문의 삭제' })
  deleteInquiry(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.deleteInquiry(id);
  }
}
