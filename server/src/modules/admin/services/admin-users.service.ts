import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginatedQuery } from '../../../base/paginated-query';
import { PaginationQueryDto } from '../../../base/pagination.dto';
import { PasswordService } from '../../../shared/auth/password.service';
import { KycStatus, UserRole } from '../../../shared/constants/statuses';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AdminUpdateUserDto } from '../dto/admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  // ========================================
  // Users CRUD
  // ========================================

  async findAll(
    paginationDto: PaginationQueryDto,
    filters?: { search?: string; kycStatus?: string; role?: string },
  ) {
    const where: any = { deletedAt: null };

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { email: { contains: filters.search } },
        { phone: { contains: filters.search } },
      ];
    }
    if (filters?.kycStatus) {
      where.kycStatus = filters.kycStatus;
    }
    if (filters?.role) {
      where.role = filters.role;
    }

    return paginatedQuery(this.prisma.user, {
      pagination: paginationDto,
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        kycStatus: true,
        customLimitPerTx: true,
        customLimitPerDay: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        kycStatus: true,
        kycData: true,
        kycVerifiedBy: true,
        kycVerifiedByAdminId: true,
        verifyAttemptCount: true,
        bankName: true,
        bankCode: true,
        accountNumber: true,
        accountHolder: true,
        bankVerifiedAt: true,
        customLimitPerTx: true,
        customLimitPerDay: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            tradeIns: true,
            cart: true,
            sentGifts: true,
            receivedGifts: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // 전화번호 정규화 (하이픈 제거 — 회원가입과 동일 규칙)
    if (dto.phone) {
      dto.phone = dto.phone.replace(/-/g, '');
    }

    const result = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        kycStatus: true,
        customLimitPerTx: true,
        customLimitPerDay: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 권한 관련 필드 변경 시 세션 무효화
    const privilegeChanged =
      (dto.role && dto.role !== user.role) ||
      (dto.kycStatus && dto.kycStatus !== user.kycStatus);
    if (privilegeChanged) {
      await this.invalidateSessions(id);
    }

    return result;
  }

  async delete(id: number, requestingAdminId: number) {
    if (id === requestingAdminId) {
      throw new BadRequestException('자기 자신은 삭제할 수 없습니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: { role: 'ADMIN', deletedAt: null },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('마지막 관리자는 삭제할 수 없습니다.');
      }
    }

    // [의도] 관리자 회원 삭제 cascade — 트랜잭션 원자성이 필수이므로
    // 타 모듈 서비스 위임 대신 직접 Prisma 접근 유지
    // 관련 도메인: Auth(refreshToken), Cart(cartItem), TradeIn(tradeIn)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          email: `withdrawn_${id}@deleted.local`,
          name: null,
          phone: null,
          accountNumber: null,
          accountHolder: null,
          bankName: null,
          bankCode: null,
          kycData: null,
          kycStatus: 'NONE',
          kycVerifiedBy: null,
          kycVerifiedByAdminId: null,
          passwordResetToken: null,
          passwordResetExpiry: null,
          mfaEnabled: false,
          totpSecret: null,
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.cartItem.deleteMany({ where: { userId: id } }),
      this.prisma.tradeIn.updateMany({
        where: { userId: id },
        data: {
          senderName: null,
          senderPhone: null,
          senderEmail: null,
          accountHolder: null,
          bankName: null,
          accountNum: null,
        },
      }),
    ]);

    return { message: '사용자가 삭제되었습니다.' };
  }

  /**
   * 사용자 KYC 상태 변경 — 세션 무효화 + 소스 추적 포함
   */
  async updateKycStatus(userId: number, status: KycStatus, adminId?: number) {
    if (adminId && userId === adminId) {
      throw new BadRequestException(
        '자기 자신의 KYC 상태는 변경할 수 없습니다.',
      );
    }

    const data: any = {
      kycStatus: status,
      kycVerifiedBy: 'ADMIN_OVERRIDE',
      kycVerifiedByAdminId: adminId ?? null,
    };
    const result = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    await this.invalidateSessions(userId);
    return result;
  }

  /**
   * 사용자 역할(Role) 변경 — 세션 무효화 포함
   */
  async updateRole(userId: number, role: UserRole, requestingAdminId?: number) {
    if (requestingAdminId && userId === requestingAdminId) {
      throw new BadRequestException('자기 자신의 역할은 변경할 수 없습니다.');
    }

    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    await this.invalidateSessions(userId);
    return result;
  }

  /**
   * 사용자 비밀번호 리셋 — 세션 무효화 포함
   */
  async resetUserPassword(userId: number, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const hashedPassword = await this.passwordService.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    await this.invalidateSessions(userId);
    return { message: '비밀번호가 변경되었습니다.' };
  }

  // ========================================
  // Sessions (RefreshToken) Management
  // ========================================

  async findAllSessions(paginationDto: PaginationQueryDto) {
    return paginatedQuery(this.prisma.refreshToken, {
      pagination: paginationDto,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async deleteSession(id: number) {
    const session = await this.prisma.refreshToken.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.refreshToken.delete({ where: { id } });
  }

  async deleteUserSessions(userId: number) {
    return this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  // ========================================
  // Private Helpers
  // ========================================

  /** 사용자의 모든 세션(리프레시 토큰) 무효화 */
  private async invalidateSessions(userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
