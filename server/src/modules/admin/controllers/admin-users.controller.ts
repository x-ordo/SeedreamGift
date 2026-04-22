import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import {
  UpdateKycStatusDto,
  UpdateUserRoleDto,
  ResetPasswordDto,
} from '../dto/admin-actions.dto';
import { AdminUsersQueryDto } from '../dto/admin-query.dto';
import { AdminUpdateUserDto } from '../dto/admin-user.dto';
import { AdminUsersService } from '../services';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  // ========================================
  // Users Management
  // ========================================

  @Get('users')
  @ApiOperation({ summary: '사용자 목록 조회' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'kycStatus', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  findAllUsers(@Query() query: AdminUsersQueryDto) {
    const { page, limit, sort, order, search, kycStatus, role } = query;
    return this.usersService.findAll(
      { page, limit, sort, order },
      { search, kycStatus, role },
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: '사용자 상세 조회' })
  findOneUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: '사용자 정보 수정' })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Patch('users/:id/kyc')
  @ApiOperation({ summary: '사용자 KYC 상태 변경' })
  updateKycStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKycStatusDto,
    @Request() req: RequestWithUser,
  ) {
    return this.usersService.updateKycStatus(id, dto.status, req.user.id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '사용자 역할 변경' })
  updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
    @Request() req: RequestWithUser,
  ) {
    return this.usersService.updateRole(id, dto.role, req.user.id);
  }

  @Patch('users/:id/password')
  @ApiOperation({ summary: '사용자 비밀번호 리셋' })
  resetUserPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetUserPassword(id, dto.password);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '사용자 삭제' })
  deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.usersService.delete(id, req.user.id);
  }

  // ========================================
  // Sessions (RefreshToken) Management
  // ========================================

  @Get('sessions')
  @ApiOperation({ summary: '활성 세션 목록 조회' })
  findAllSessions(@Query() paginationDto: PaginationQueryDto) {
    return this.usersService.findAllSessions(paginationDto);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: '세션 강제 종료' })
  deleteSession(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteSession(id);
  }

  @Delete('sessions/user/:userId')
  @ApiOperation({ summary: '사용자 전체 세션 종료' })
  deleteUserSessions(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.deleteUserSessions(userId);
  }
}
