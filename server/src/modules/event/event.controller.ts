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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { EventService } from './event.service';
import { BaseCrudController } from '../../base/base-crud.controller';
import { BaseEntity } from '../../base/base.entity';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { Roles } from '../../shared/auth/roles.guard';
import { RolesGuard } from '../../shared/auth/roles.guard';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';
import { Event } from '../../shared/prisma/generated/client';

// BaseEntity 호환을 위한 래퍼 클래스
class EventEntity extends BaseEntity implements Event {
  title: string;
  description: string;
  imageUrl: string | null;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
}

@ApiTags('Events')
@Controller('events')
export class EventController extends BaseCrudController<
  EventEntity,
  CreateEventDto,
  UpdateEventDto
> {
  constructor(private readonly eventService: EventService) {
    super(eventService as any);
  }

  @Get('active')
  @ApiOperation({ summary: '활성화된 이벤트 목록 조회 (사용자용)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ongoing', 'upcoming', 'ended'],
    description: '이벤트 상태 필터',
  })
  getActiveEvents(@Query('status') status?: string) {
    return this.eventService.getActiveEvents(status);
  }

  @Get('featured')
  @ApiOperation({ summary: '메인 노출 이벤트 조회' })
  getFeaturedEvents() {
    return this.eventService.getFeaturedEvents();
  }

  @Patch(':id/view')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '조회수 증가' })
  incrementViewCount(@Param('id', ParseIntPipe) id: number) {
    return this.eventService.incrementViewCount(id);
  }

  // --- Override for Roles (관리자 전용) ---

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '이벤트 생성 (관리자)' })
  create(@Body() createDto: CreateEventDto) {
    return super.create(createDto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '이벤트 수정 (관리자)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateEventDto,
  ) {
    return super.update(id, updateDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '이벤트 삭제 (관리자)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
