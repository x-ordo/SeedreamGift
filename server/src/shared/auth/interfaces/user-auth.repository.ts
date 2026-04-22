/**
 * @file user-auth.repository.ts
 * @description 사용자 인증 저장소 인터페이스
 * @module shared/auth/interfaces
 *
 * AuthService와 UsersModule 사이의 결합을 느슨하게 만들어
 * - 테스트 시 Mock 구현 주입 가능
 * - 다른 프로젝트에서 Auth 모듈 재사용 가능
 */

/**
 * 인증에 필요한 사용자 데이터
 */
export interface UserAuthData {
  id: number;
  email: string;
  password: string;
  name: string | null;
  phone: string | null;
  role: string;
  kycStatus: string;
  bankName: string | null;
  bankCode: string | null;
  accountHolder: string | null;
  bankVerifiedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 사용자 생성 데이터
 */
export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  phone: string;
}

/**
 * 프로필 업데이트 데이터
 */
export interface UpdateProfileData {
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * 사용자 인증 저장소 인터페이스
 *
 * AuthService에서 사용자 데이터에 접근하기 위한 추상화 레이어
 * 구현체는 UsersModule에서 제공
 */
export interface IUserAuthRepository {
  /**
   * ID로 사용자 조회
   * @param id 사용자 ID
   * @returns 사용자 데이터 또는 null
   */
  findById(id: number): Promise<UserAuthData | null>;

  /**
   * 이메일로 사용자 조회
   * @param email 이메일 주소
   * @returns 사용자 데이터 또는 null
   */
  findByEmail(email: string): Promise<UserAuthData | null>;

  /**
   * 휴대폰 번호로 사용자 조회
   * @param phone 휴대폰 번호
   * @returns 사용자 데이터 또는 null
   */
  findByPhone(phone: string): Promise<UserAuthData | null>;

  /**
   * 새 사용자 생성
   * @param data 사용자 생성 데이터 (비밀번호는 해시된 상태)
   * @returns 생성된 사용자 데이터
   */
  create(data: CreateUserData): Promise<UserAuthData>;

  /**
   * 비밀번호 업데이트
   * @param userId 사용자 ID
   * @param hashedPassword 해시된 새 비밀번호
   */
  updatePassword(userId: number, hashedPassword: string): Promise<void>;

  /**
   * 프로필 업데이트
   * @param userId 사용자 ID
   * @param data 업데이트할 프로필 데이터
   * @returns 업데이트된 사용자 데이터
   */
  updateProfile(userId: number, data: UpdateProfileData): Promise<UserAuthData>;
}

/**
 * DI 토큰
 */
export const USER_AUTH_REPOSITORY = Symbol('USER_AUTH_REPOSITORY');
