/**
 * @file users.controller.ts
 * @description 사용자 관리 API 컨트롤러 (관리자 전용)
 * @module modules/users
 *
 * @summary 회원 관리를 위한 REST API 컨트롤러 (ADMIN 권한 필수)
 *
 * API 엔드포인트:
 * - GET /users - 사용자 목록 조회 (관리자, 페이지네이션)
 * - GET /users/:id - 사용자 상세 조회 (관리자)
 * - POST /users - 사용자 생성 (관리자)
 * - PATCH /users/:id - 사용자 수정 (관리자)
 * - DELETE /users/:id - 사용자 삭제 (관리자)
 *
 * 사용처:
 * - AdminPage: 관리자 대시보드에서 회원 관리 CRUD
 * - AuthModule: 일반 사용자 등록은 /auth/register를 사용하므로 이 컨트롤러와 분리됨
 *
 * 보안:
 * - 모든 엔드포인트에 JwtAuthGuard + RolesGuard('ADMIN') 적용
 * - BaseCrudController를 상속하되, 각 메서드를 override하여 Guard 데코레이터 부착
 *
 * 역할(Role):
 * - USER: 일반 사용자
 * - PARTNER: 파트너 (대량 구매 할인)
 * - ADMIN: 관리자 (전체 접근)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { UsersService } from './users.service';
import { BaseCrudController } from '../../base/base-crud.controller';
import { BaseEntity } from '../../base/base.entity';
import { PaginationQueryDto } from '../../base/pagination.dto';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../shared/auth/roles.guard';
import { User } from '../../shared/prisma/generated/client';

// Prisma User 타입과 BaseEntity를 연결하기 위한 어댑터 클래스
// BaseCrudController 제네릭 제약을 만족시키면서 Prisma 스키마 필드를 그대로 노출한다
class UserEntity extends BaseEntity implements User {
  email: string;
  password: string;
  name: string | null;
  phone: string | null;
  zipCode: string;
  address: string;
  addressDetail: string;
  role: string;
  kycStatus: string;
  kycData: string | null;
  customLimitPerTx: any; // Decimal
  customLimitPerDay: any; // Decimal
  emailNotification: boolean;
  pushNotification: boolean;
  partnerTier: string | null;
  totalTradeInVolume: any; // Decimal
  partnerSince: Date | null;
  bankName: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  bankVerifiedAt: Date | null;
  verifyAttemptCount: number;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordResetToken: string | null;
  passwordResetExpiry: Date | null;
  mfaEnabled: boolean;
  totpSecret: string | null;
  kycVerifiedBy: string | null;
  kycVerifiedByAdminId: number | null;
  deletedAt: Date | null;
}

@ApiTags('Users')
@Controller('users')
export class UsersController extends BaseCrudController<
  UserEntity,
  CreateUserDto,
  UpdateUserDto
> {
  constructor(private readonly usersService: UsersService) {
    super(usersService as any);
  }

  /**
   * [의도] 회원 탈퇴 (본인 계정 소프트 삭제)
   * - JWT 인증 필수, 비밀번호 재확인
   */
  @Delete('me')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '회원 탈퇴 (본인)' })
  async withdraw(@Request() req: any, @Body() dto: WithdrawDto) {
    await this.usersService.softDelete(req.user.id, dto.password);
    return { message: '탈퇴가 완료되었습니다.' };
  }

  /**
   * 사용자 목록 조회 (관리자 전용)
   *
   * 페이지네이션 지원, 최신순 정렬
   *
   * @param {PaginationQueryDto} query - 페이지네이션 파라미터
   * @param {number} [query.page=1] - 페이지 번호
   * @param {number} [query.limit=20] - 페이지당 항목 수 (최대 100)
   * @returns {Promise<{items: User[], meta: PaginationMeta}>} 사용자 목록
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 목록 조회 (관리자)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '페이지 번호 (기본값: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '페이지당 항목 수 (기본값: 20, 최대: 100)',
  })
  override async findAll(@Query() query: PaginationQueryDto) {
    return super.findAll(query);
  }

  /**
   * 사용자 상세 조회 (관리자 전용)
   *
   * @param {number} id - 사용자 ID
   * @returns {Promise<User>} 사용자 정보 (password 제외)
   * @throws {NotFoundException} 사용자 없음
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 상세 조회 (관리자)' })
  override async findOne(@Param('id', ParseIntPipe) id: number) {
    return super.findOne(id);
  }

  /**
   * 사용자 생성 (관리자 전용)
   *
   * NOTE: 일반 사용자 등록은 /auth/register 사용
   * 관리자가 직접 특정 역할의 사용자를 생성할 때 사용
   *
   * @param {CreateUserDto} createDto - 사용자 생성 데이터
   * @param {string} createDto.email - 이메일 (고유)
   * @param {string} createDto.password - 비밀번호
   * @param {string} [createDto.name] - 이름
   * @param {string} [createDto.role='USER'] - 역할 (USER/PARTNER/ADMIN)
   * @returns {Promise<User>} 생성된 사용자 정보
   * @throws {ConflictException} 이메일 중복
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 생성 (관리자)' })
  override async create(@Body() createDto: CreateUserDto) {
    return super.create(createDto);
  }

  /**
   * 사용자 수정 (관리자 전용)
   *
   * 역할 변경, KYC 상태 변경 등 관리자 권한 작업
   *
   * @param {number} id - 수정할 사용자 ID
   * @param {UpdateUserDto} updateDto - 수정할 필드 (부분 업데이트)
   * @returns {Promise<User>} 수정된 사용자 정보
   * @throws {NotFoundException} 사용자 없음
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 수정 (관리자)' })
  override async update(
    @Param('id') id: number,
    @Body() updateDto: UpdateUserDto,
  ) {
    return super.update(id, updateDto);
  }

  /**
   * 사용자 삭제 (관리자 전용)
   *
   * 주의: 실제 DB에서 삭제됨 (소프트 삭제 아님)
   * 주문/매입 이력이 있는 사용자는 삭제 시 FK 제약에 걸릴 수 있음
   *
   * @param {number} id - 삭제할 사용자 ID
   * @returns {Promise<User>} 삭제된 사용자 정보
   * @throws {NotFoundException} 사용자 없음
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 삭제 (관리자)' })
  override async remove(@Param('id') id: number) {
    return super.remove(id);
  }
}
