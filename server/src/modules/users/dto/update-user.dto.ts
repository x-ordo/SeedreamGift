/**
 * @file update-user.dto.ts
 * @description 사용자 수정 DTO - 사용자 정보 업데이트 API 요청 데이터 검증
 * @module users/dto
 *
 * CreateUserDto의 모든 필드를 선택적(Optional)으로 상속
 * 변경하고 싶은 필드만 포함하여 요청 가능
 */
import { PartialType } from '@nestjs/swagger';

import { CreateUserDto } from './create-user.dto';

/**
 * 사용자 수정 DTO
 * - PATCH /users/:id 요청 본문
 * - 모든 필드 선택적 (PartialType으로 자동 생성)
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
