import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { CreateInquiryDto, UpdateInquiryDto } from './dto/inquiry.dto';
import { InquiryService } from './inquiry.service';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';

@ApiTags('Inquiries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inquiries')
export class InquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  @Get()
  @ApiOperation({ summary: '내 문의 목록 조회' })
  findMyInquiries(@Request() req: any) {
    return this.inquiryService.findMyInquiries(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: '문의 등록' })
  createInquiry(@Request() req: any, @Body() dto: CreateInquiryDto) {
    return this.inquiryService.createInquiry(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '문의 수정 (PENDING 상태만)' })
  updateInquiry(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInquiryDto,
  ) {
    return this.inquiryService.updateMyInquiry(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '문의 삭제' })
  deleteInquiry(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.inquiryService.deleteMyInquiry(req.user.id, id);
  }
}
