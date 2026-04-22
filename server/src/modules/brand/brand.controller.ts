import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { BrandService } from './brand.service';

@ApiTags('Brands')
@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: '브랜드 목록 조회 (메타데이터 포함)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll() {
    return this.brandService.findAll();
  }
}
