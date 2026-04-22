/**
 * @file password.service.ts
 * @description 비밀번호 해싱/검증 서비스 - bcrypt 중앙화
 * @module shared/auth
 *
 * 사용처:
 * - AuthService: 회원가입, 로그인, 비밀번호 변경
 * - AdminUsersService: 관리자 비밀번호 리셋
 * - UsersService: 회원 탈퇴 비밀번호 확인
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    this.saltRounds = this.configService.get<number>(
      'auth.bcrypt.saltRounds',
      10,
    );
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
