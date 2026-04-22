import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
  Post,
  Body,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CreateNoticeDto, UpdateNoticeDto } from './dto/notice.dto';
import { NoticeService } from './notice.service';
import { BaseCrudController } from '../../base/base-crud.controller';
import { BaseEntity } from '../../base/base.entity';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { Roles } from '../../shared/auth/roles.guard';
import { RolesGuard } from '../../shared/auth/roles.guard';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';
import { Notice } from '../../shared/prisma/generated/client';

// BaseEntity 호환을 위한 래퍼 클래스
class NoticeEntity extends BaseEntity implements Notice {
  title: string;
  content: string;
  isActive: boolean;
  viewCount: number;
}

@ApiTags('Notices')
@Controller('notices')
export class NoticeController extends BaseCrudController<
  NoticeEntity,
  CreateNoticeDto,
  UpdateNoticeDto
> {
  constructor(private readonly noticeService: NoticeService) {
    super(noticeService as any);
  }

  @Get('active')
  @ApiOperation({ summary: '활성화된 공지사항 목록 조회 (사용자용)' })
  getActiveNotices() {
    return this.noticeService.getActiveNotices();
  }

  @Patch(':id/view')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '조회수 증가' })
  incrementViewCount(@Param('id', ParseIntPipe) id: number) {
    return this.noticeService.incrementViewCount(id);
  }

  // --- Override for Roles (관리자 전용) ---

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '공지사항 생성 (관리자)' })
  create(@Body() createDto: CreateNoticeDto) {
    return super.create(createDto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '공지사항 수정 (관리자)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateNoticeDto,
  ) {
    return super.update(id, updateDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '공지사항 삭제 (관리자)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
