import { randomUUID } from 'crypto';

import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AxiosResponse } from 'axios';
import { Observable, firstValueFrom } from 'rxjs';

import { BankVerifyConfirmDto } from './dto/bank-verify-confirm.dto';
import { BankVerifyRequestDto } from './dto/bank-verify-request.dto';
import { KYC_STATUS, KYC_LIMITS } from '../../shared/constants';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UsersService } from '../users/users.service';

/** Coocon API 기본 URL (fallback) */
const DEFAULT_COOCON_URL = 'http://103.97.209.176:8091/api/coocon';

/** Coocon Issue 응답 타입 */
interface CooconIssueResponse {
  success: boolean;
  rc: string;
  rm: string;
  verify_tr_dt?: string;
  verify_tr_no?: string;
  rqDtime?: string;
  tno?: string;
}

/** Coocon Confirm 응답 타입 */
interface CooconConfirmResponse {
  success: boolean;
  rc: string;
  rm: string;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly cooconBaseUrl: string;
  private readonly cooconServerUrl: string;
  private readonly cooconCompany: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.cooconBaseUrl = this.configService.get<string>(
      'COOCON_API_URL',
      DEFAULT_COOCON_URL,
    );
    this.cooconServerUrl = this.configService.get<string>(
      'kyc.coocon.serverUrl',
      DEFAULT_COOCON_URL.replace(/\/api\/coocon\/?$/, ''),
    );
    this.cooconCompany = this.configService.get<string>(
      'kyc.coocon.company',
      'gift',
    );
    this.maxRetries = this.configService.get<number>(
      'kyc.coocon.maxRetries',
      3,
    );
    this.retryDelayMs = this.configService.get<number>(
      'kyc.coocon.retryDelayMs',
      1000,
    );
  }

  /**
   * Coocon API — 1원 발송 요청
   */
  async requestVerification(
    bankCode: string,
    accountNumber: string,
    accountHolder: string,
  ): Promise<{ verifyTrDt: string; verifyTrNo: string }> {
    const url = `${this.cooconBaseUrl}/issue/etc`;
    const params = {
      fnni_cd: bankCode,
      acct_no: accountNumber,
      memb_nm: accountHolder,
    };

    const maskedHolder =
      accountHolder.length > 1
        ? accountHolder[0] + '*'.repeat(accountHolder.length - 1)
        : '***';
    this.logger.log(
      `Coocon issue request: bankCode=${bankCode}, holder=${maskedHolder}`,
    );

    try {
      const data = await this.callWithRetry(() =>
        this.httpService.get<CooconIssueResponse>(url, { params }),
      );

      if (!data.success || !data.verify_tr_dt || !data.verify_tr_no) {
        this.logger.warn(`Coocon issue failed: ${data.rm}`);
        throw new BadRequestException(
          data.rm || '1원 인증 요청에 실패했습니다.',
        );
      }

      return {
        verifyTrDt: data.verify_tr_dt,
        verifyTrNo: data.verify_tr_no,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Coocon issue API error', error);
      throw new InternalServerErrorException(
        '1원 인증 요청 중 오류가 발생했습니다.',
      );
    }
  }

  /**
   * Coocon API — 인증번호 확인
   */
  async confirmVerification(
    verifyTrDt: string,
    verifyTrNo: string,
    verifyVal: string,
  ): Promise<boolean> {
    const url = `${this.cooconBaseUrl}/confirm/etc`;
    const params = {
      verify_tr_dt: verifyTrDt,
      verify_tr_no: verifyTrNo,
      verify_val: verifyVal,
    };

    this.logger.log(`Coocon confirm request: verifyTrNo=${verifyTrNo}`);

    try {
      const data = await this.callWithRetry(() =>
        this.httpService.get<CooconConfirmResponse>(url, { params }),
      );

      if (!data.success) {
        this.logger.warn(`Coocon confirm failed: ${data.rm}`);
        throw new BadRequestException(
          data.rm || '인증번호가 일치하지 않습니다.',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Coocon confirm API error', error);
      throw new InternalServerErrorException(
        '인증 확인 중 오류가 발생했습니다.',
      );
    }
  }

  /**
   * 1원 인증 발송 요청 + 시도 횟수 증가 + 세션 저장
   */
  async issueBankVerification(
    userId: number | null,
    dto: BankVerifyRequestDto,
  ) {
    // 로그인 상태면 시도 횟수 확인 및 증가
    // UsersService에 위임하여 도메인 경계 유지
    if (userId) {
      const user = await this.usersService.findById(userId);
      if (user && user.verifyAttemptCount >= KYC_LIMITS.MAX_VERIFY_ATTEMPTS) {
        throw new BadRequestException(
          `최대 인증 시도 횟수(${KYC_LIMITS.MAX_VERIFY_ATTEMPTS}회)를 초과했습니다. 고객센터에 문의해주세요.`,
        );
      }
      await this.usersService.updateKycStatus(userId, {
        verifyAttemptCount: { increment: 1 },
      });
    }

    const result = await this.requestVerification(
      dto.bankCode,
      dto.accountNumber,
      dto.accountHolder,
    );

    // TOCTOU 방지: 원본 은행 정보를 DB에 저장 (클러스터 안전)
    // 계좌번호는 암호화하여 저장 (세션 테이블에도 평문 저장 금지)
    const encryptedAccountNumber = this.cryptoService.encrypt(
      dto.accountNumber,
    );
    await this.prisma.kycVerifySession.upsert({
      where: { verifyTrNo: result.verifyTrNo },
      update: {
        verifyTrDt: result.verifyTrDt,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber: encryptedAccountNumber,
        accountHolder: dto.accountHolder,
        expiresAt: new Date(Date.now() + KYC_LIMITS.VERIFY_SESSION_TTL_MS),
      },
      create: {
        verifyTrNo: result.verifyTrNo,
        verifyTrDt: result.verifyTrDt,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber: encryptedAccountNumber,
        accountHolder: dto.accountHolder,
        expiresAt: new Date(Date.now() + KYC_LIMITS.VERIFY_SESSION_TTL_MS),
      },
    });

    return result;
  }

  /**
   * 인증 확인 + 계좌 정보 저장 + KYC 상태 업데이트
   * 은행 정보는 서버 세션에서 가져옴 (TOCTOU 방지)
   */
  async confirmBankVerification(
    userId: number | null,
    dto: BankVerifyConfirmDto,
  ) {
    // DB에서 인증 세션 조회 (클러스터 안전)
    const session = await this.prisma.kycVerifySession.findUnique({
      where: { verifyTrNo: dto.verifyTrNo },
    });
    if (!session) {
      throw new BadRequestException(
        '인증 세션이 만료되었거나 존재하지 않습니다. 다시 1원 인증을 요청해주세요.',
      );
    }

    // 세션 유효시간 확인
    if (new Date() > session.expiresAt) {
      await this.prisma.kycVerifySession.delete({
        where: { verifyTrNo: dto.verifyTrNo },
      });
      throw new BadRequestException(
        '인증 시간이 초과되었습니다. 다시 1원 인증을 요청해주세요.',
      );
    }

    // Use session's verifyTrDt (not client's) for security
    await this.confirmVerification(
      session.verifyTrDt,
      dto.verifyTrNo,
      dto.verifyVal,
    );

    // 로그인 상태면 유저 정보 업데이트 후 세션 삭제
    if (userId) {
      // 세션의 계좌번호는 암호화 상태이므로 복호화
      const decryptedAccountNumber = this.cryptoService.decrypt(
        session.accountNumber,
      );

      // UsersService에 위임하여 도메인 경계 유지
      await this.usersService.updateKycStatus(userId, {
        bankName: session.bankName,
        bankCode: session.bankCode,
        accountNumber: session.accountNumber, // 이미 암호화된 상태
        accountHolder: session.accountHolder,
        bankVerifiedAt: new Date(),
        kycStatus: KYC_STATUS.VERIFIED,
        kycVerifiedBy: 'BANK_API',
        kycVerifiedByAdminId: null,
      });

      await this.prisma.kycVerifySession.delete({
        where: { verifyTrNo: dto.verifyTrNo },
      });

      return {
        success: true,
        bankName: session.bankName,
        bankCode: session.bankCode,
        accountNumber: this.maskAccountNumber(decryptedAccountNumber),
        accountHolder: session.accountHolder,
      };
    }

    // 비로그인(회원가입) 상태면 세션 유지 + isVerified=true 설정
    // 이후 회원가입 API에서 verificationId(verifyTrNo)로 조회하여 사용
    await this.prisma.kycVerifySession.update({
      where: { verifyTrNo: dto.verifyTrNo },
      data: { isVerified: true },
    });

    const decryptedAccountNumber = this.cryptoService.decrypt(
      session.accountNumber,
    );

    return {
      success: true,
      bankName: session.bankName,
      bankCode: session.bankCode,
      accountNumber: this.maskAccountNumber(decryptedAccountNumber),
      accountHolder: session.accountHolder,
    };
  }

  /**
   * 계좌 변경 (마이페이지 — JWT 필수)
   * 1원 인증 + 새 계좌 저장
   */
  async changeBankAccount(userId: number, dto: BankVerifyConfirmDto) {
    return this.confirmBankVerification(userId, dto);
  }

  /**
   * 사용자의 계좌 정보 조회 (마스킹된 계좌번호 반환)
   */
  async getBankAccount(userId: number) {
    // UsersService에 위임하여 도메인 경계 유지
    const user = await this.usersService.findById(userId);

    if (!user || !user.accountNumber) {
      return null;
    }

    return {
      bankName: user.bankName,
      bankCode: user.bankCode,
      accountNumber: this.maskAccountNumber(
        this.cryptoService.decrypt(user.accountNumber),
      ),
      accountHolder: user.accountHolder,
      bankVerifiedAt: user.bankVerifiedAt,
    };
  }

  /**
   * 외부 API 호출 재시도 (지수 백오프)
   * 일시적 네트워크 오류 시 자동 재시도, 비즈니스 에러(BadRequestException)는 즉시 전파
   */
  private async callWithRetry<T>(
    fn: () => Observable<AxiosResponse<T>>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const { data } = await firstValueFrom(fn());
        return data;
      } catch (error) {
        // 비즈니스 에러는 재시도하지 않음
        if (error instanceof BadRequestException) throw error;
        if (attempt === this.maxRetries) throw error;
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        this.logger.warn(
          `External API call failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new InternalServerErrorException('외부 API 호출에 실패했습니다.');
  }

  /** 계좌번호 마스킹 (앞 3자리 + *** + 뒤 3자리) */
  private maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 6) return '***';
    return accountNumber.slice(0, 3) + '***' + accountNumber.slice(-3);
  }

  /**
   * KCB PASS 인증 시작 — company-check 후 팝업 URL 생성
   * 프론트엔드에서 이 URL을 window.open()으로 바로 열어 PASS 인증 팝업을 표시
   */
  async startKcbAuth(): Promise<{ kcbAuthId: string; popupUrl: string }> {
    // 1. 회사 유효성 확인
    const checkUrl = `${this.cooconBaseUrl}/company-check`;
    try {
      const checkData = await this.callWithRetry(() =>
        this.httpService.get<{ success: boolean; message?: string }>(checkUrl, {
          params: { company: this.cooconCompany },
        }),
      );

      if (!checkData.success) {
        this.logger.warn(
          `Company check failed: ${checkData.message || 'unknown'}`,
        );
        throw new BadRequestException(
          '본인 인증 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Company check API error', error);
      throw new InternalServerErrorException(
        '본인 인증 서비스 연결에 실패했습니다.',
      );
    }

    // 2. kcbAuthId 생성 + 팝업 URL 조립
    const kcbAuthId = randomUUID();
    const popupUrl = `${this.cooconServerUrl}/api/kcb/phone/start?kcbAuthId=${kcbAuthId}&company=${this.cooconCompany}`;

    this.logger.log(`KCB auth started: kcbAuthId=${kcbAuthId}`);

    return { kcbAuthId, popupUrl };
  }

  /**
   * KCB PASS 인증 상태 확인 — 클라이언트 폴링용 단일 요청 프록시
   * Coocon /api/kcb/checkStatus 를 그대로 전달
   *
   * @returns { status: 'pending' | 'success' | 'expired', result?: {...} }
   */
  async checkKcbStatus(kcbAuthId: string): Promise<{
    status: string;
    result?: {
      RSLT_NAME?: string;
      TEL_NO?: string;
      CI?: string;
      RSLT_BIRTHDAY?: string;
      RSLT_SEX_CD?: string;
      RSLT_NTV_FRNR_CD?: string;
      TELECOM?: string;
    };
  }> {
    const statusUrl = `${this.cooconServerUrl}/api/kcb/checkStatus`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{
          status: string;
          result?: {
            RSLT_NAME?: string;
            TEL_NO?: string;
            CI?: string;
            RSLT_BIRTHDAY?: string;
            RSLT_SEX_CD?: string;
            RSLT_NTV_FRNR_CD?: string;
            TELECOM?: string;
          };
        }>(statusUrl, { params: { kcbAuthId } }),
      );

      return data;
    } catch (error) {
      this.logger.warn(
        `KCB status check failed: kcbAuthId=${kcbAuthId}`,
        error,
      );
      // 일시적 오류 시 pending으로 반환하여 클라이언트가 재시도
      return { status: 'pending' };
    }
  }

  /**
   * KCB PASS 인증 완료 — 클라이언트가 전달한 결과로 kyc-log 기록
   * 서버 사이드 폴링 제거됨 — 클라이언트가 check-status 폴링 후 결과와 함께 호출
   *
   * @returns verified=true 시 name, phone, ci 포함
   */
  async completeKcbAuth(
    kcbAuthId: string,
    resultData?: {
      name?: string;
      phone?: string;
      ci?: string;
      birth?: string;
      gender?: string;
      nationality?: string;
      telco?: string;
    },
  ): Promise<{
    verified: boolean;
    name?: string;
    phone?: string;
    ci?: string;
  }> {
    if (!resultData?.name || !resultData?.phone) {
      this.logger.warn(
        `KCB auth complete called without result data: kcbAuthId=${kcbAuthId}`,
      );
      return { verified: false };
    }

    // kyc-log 호출하여 SMS_VERIFICATION 테이블에 INSERT
    // 실패 시 회원가입 단계에서 SMS_VERIFICATION 조회가 안 되므로 반드시 성공해야 함
    try {
      await firstValueFrom(
        this.httpService.post(`${this.cooconBaseUrl}/kyc-log`, {
          company: this.cooconCompany,
          name: resultData.name || '',
          birth: resultData.birth || '',
          gender: resultData.gender || '',
          nationality: resultData.nationality || '',
          ci: resultData.ci || '',
          telco: resultData.telco || '',
          phone: resultData.phone || '',
        }),
      );
    } catch (logError) {
      this.logger.error(
        'kyc-log 호출 실패 — SMS_VERIFICATION INSERT 불가, 인증 실패 처리',
        logError,
      );
      throw new InternalServerErrorException(
        '본인 인증 결과 저장에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    }

    this.logger.log(
      `KCB auth completed: kcbAuthId=${kcbAuthId}, name=${resultData.name}`,
    );

    return {
      verified: true,
      name: resultData.name || undefined,
      phone: resultData.phone || undefined,
      ci: resultData.ci || undefined,
    };
  }

  /**
   * Coocon KYC 본인인증 결과 검증
   * SMS_VERIFICATION 테이블에서 최근 10분 이내 인증 기록 조회
   *
   * @param phone 하이픈 없는 전화번호 (예: 01012345678)
   */
  async verifyIdentity(phone: string) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const record = await this.prisma.smsVerification.findFirst({
      where: {
        phone,
        datetime: { gte: tenMinutesAgo },
      },
      orderBy: { datetime: 'desc' },
    });

    if (!record) {
      return { verified: false };
    }

    return {
      verified: true,
      name: record.bankUser || undefined,
      ci: record.ci || undefined,
    };
  }

  /**
   * KYC 본인인증 데이터 제출
   * 실명, 신분증 이미지 등 민감 정보가 포함되므로 반드시 암호화 저장
   */
  async submitKyc(userId: number, kycData: any) {
    // UsersService에 위임하여 도메인 경계 유지
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    if (user.kycStatus === KYC_STATUS.VERIFIED) {
      throw new BadRequestException('이미 인증이 완료된 계정입니다.');
    }

    const encryptedData = this.cryptoService.encrypt(JSON.stringify(kycData));

    await this.usersService.updateKycStatus(userId, {
      kycData: encryptedData,
      kycStatus: KYC_STATUS.PENDING,
    });

    return this.usersService.findById(userId);
  }

  /**
   * 관리자용 KYC 데이터 복호화 조회
   */
  async getDecryptedKycData(userId: number) {
    // UsersService에 위임하여 도메인 경계 유지
    const user = await this.usersService.findById(userId);

    if (!user || !user.kycData) return null;

    try {
      const decrypted = this.cryptoService.decrypt(user.kycData);
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }
}
