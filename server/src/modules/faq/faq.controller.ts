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

import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';
import { FaqService } from './faq.service';
import { BaseCrudController } from '../../base/base-crud.controller';
import { BaseEntity } from '../../base/base.entity';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { Roles } from '../../shared/auth/roles.guard';
import { RolesGuard } from '../../shared/auth/roles.guard';
import { UserThrottleGuard } from '../../shared/guards/user-throttle.guard';
import { Faq } from '../../shared/prisma/generated/client';

// BaseEntity 호환을 위한 래퍼 클래스
class FaqEntity extends BaseEntity implements Faq {
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  helpfulCount: number;
}

@ApiTags('FAQs')
@Controller('faqs')
export class FaqController extends BaseCrudController<
  FaqEntity,
  CreateFaqDto,
  UpdateFaqDto
> {
  constructor(private readonly faqService: FaqService) {
    super(faqService as any);
  }

  @Get('active')
  @ApiOperation({ summary: '활성화된 FAQ 목록 조회 (사용자용)' })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'FAQ 카테고리 필터',
  })
  getActiveFaqs(@Query('category') category?: string) {
    return this.faqService.getActiveFaqs(category);
  }

  @Get('categories')
  @ApiOperation({ summary: '활성화된 FAQ 카테고리 목록 조회' })
  getCategories() {
    return this.faqService.getCategories();
  }

  @Patch(':id/helpful')
  @UseGuards(UserThrottleGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '도움됨 카운트 증가' })
  incrementHelpfulCount(@Param('id', ParseIntPipe) id: number) {
    return this.faqService.incrementHelpfulCount(id);
  }

  // --- Override for Roles (관리자 전용) ---

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'FAQ 생성 (관리자)' })
  create(@Body() createDto: CreateFaqDto) {
    return super.create(createDto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'FAQ 수정 (관리자)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateFaqDto,
  ) {
    return super.update(id, updateDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'FAQ 삭제 (관리자)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
