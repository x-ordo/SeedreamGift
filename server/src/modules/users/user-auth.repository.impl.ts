/**
 * @file user-auth.repository.impl.ts
 * @description IUserAuthRepository 구현체
 * @module modules/users
 *
 * Prisma를 통해 사용자 인증 데이터에 접근하는 구현체
 * AuthService에서 이 구현체를 주입받아 사용
 */
import { Injectable } from '@nestjs/common';

import {
  IUserAuthRepository,
  UserAuthData,
  CreateUserData,
  UpdateProfileData,
} from '../../shared/auth/interfaces/user-auth.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class UserAuthRepositoryImpl implements IUserAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<UserAuthData | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByEmail(email: string): Promise<UserAuthData | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findByPhone(phone: string): Promise<UserAuthData | null> {
    return this.prisma.user.findFirst({
      where: { phone, deletedAt: null },
    });
  }

  async create(data: CreateUserData): Promise<UserAuthData> {
    return this.prisma.user.create({
      data,
    });
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async updateProfile(
    userId: number,
    data: UpdateProfileData,
  ): Promise<UserAuthData> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
