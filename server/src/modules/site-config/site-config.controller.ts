import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { SiteConfigService } from './site-config.service';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../shared/auth/roles.guard';

@ApiTags('Site Configs')
@Controller('site-configs')
export class SiteConfigController {
  constructor(private readonly configService: SiteConfigService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '전체 설정 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  findAll() {
    return this.configService.getAll();
  }

  @Get(':key')
  @ApiOperation({ summary: '단일 설정 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '설정 키 없음' })
  async findOne(@Param('key') key: string) {
    const value = await this.configService.get(key);
    if (value === null) {
      throw new NotFoundException(`Config key '${key}' not found`);
    }
    return { key, value };
  }

  @Patch(':key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '설정 값 변경 (관리자)' })
  @ApiResponse({ status: 200, description: '변경 성공' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  update(@Param('key') key: string, @Body('value') value: string) {
    return this.configService.set(key, value);
  }
}
