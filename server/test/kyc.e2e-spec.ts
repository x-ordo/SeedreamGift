/**
 * @file kyc.e2e-spec.ts
 * @description KYC 1원 인증 엔드포인트 직접 테스트
 *
 * Coocon 외부 API를 모킹하여 /kyc/* 엔드포인트를 직접 호출합니다.
 * 테스트 범위:
 *  - DTO 유효성 검사 (bankCode 3자리, accountNumber 10~20자리, verifyVal 3자리)
 *  - 인증/비인증 접근 제어 (bank-account JWT 필수, request/confirm 비인증 허용)
 *  - 1원 인증 전체 플로우: request → confirm → bank-account 조회
 *  - 인증 세션 만료 / 존재하지 않는 세션
 *  - Coocon API 에러 처리
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { of, throwError } from 'rxjs';

import { AppModule } from '../src/app.module';
import { getData, HTTP_STATUS } from './helpers/test-setup';
import { createAndLoginUser, authHeader } from './helpers/test-users';

describe('KYC 1원 인증 (kyc.e2e)', () => {
  let app: INestApplication;
  let httpService: HttpService;

  /** 유효한 은행 인증 요청 데이터 */
  const VALID_REQUEST_DTO = {
    bankCode: '004',
    bankName: '국민은행',
    accountNumber: '1234567890123',
    accountHolder: '홍길동',
  };

  /** Coocon issue 성공 응답 생성 */
  function mockIssueSuccess(trNo: string) {
    return of({
      data: {
        success: true,
        rc: '0000',
        rm: '정상처리',
        verify_tr_dt: '20260214',
        verify_tr_no: trNo,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
  }

  /** Coocon confirm 성공 응답 */
  function mockConfirmSuccess() {
    return of({
      data: { success: true, rc: '0000', rm: '정상처리' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
  }

  /** Coocon confirm 실패 응답 */
  function mockConfirmFail() {
    return of({
      data: { success: false, rc: '9999', rm: '인증번호가 일치하지 않습니다.' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    httpService = moduleFixture.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // =========================================
  // 1. DTO 유효성 검사 (Validation)
  // =========================================
  describe('DTO Validation', () => {
    it('POST /kyc/bank-verify/request — bankCode 3자리 아닌 값 거부', async () => {
      const res = await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .send({ ...VALID_REQUEST_DTO, bankCode: '04' })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toBeDefined();
    });

    it('POST /kyc/bank-verify/request — accountNumber 숫자 아닌 값 거부', async () => {
      const res = await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .send({ ...VALID_REQUEST_DTO, accountNumber: 'abc-123' })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toBeDefined();
    });

    it('POST /kyc/bank-verify/request — 필수 필드 누락 시 거부', async () => {
      await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .send({ bankCode: '004' })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });

    it('POST /kyc/bank-verify/confirm — verifyVal 3자리 아닌 값 거부', async () => {
      const res = await request(app.getHttpServer())
        .post('/kyc/bank-verify/confirm')
        .send({
          verifyTrDt: '20260214',
          verifyTrNo: 'TEST123',
          verifyVal: '12',
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toBeDefined();
    });

    it('POST /kyc/bank-verify/confirm — 필수 필드 누락 시 거부', async () => {
      await request(app.getHttpServer())
        .post('/kyc/bank-verify/confirm')
        .send({ verifyVal: '123' })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });
  });

  // =========================================
  // 2. 접근 제어 (Auth)
  // =========================================
  describe('Access Control', () => {
    it('GET /kyc/bank-account — JWT 없으면 401', async () => {
      await request(app.getHttpServer())
        .get('/kyc/bank-account')
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('POST /kyc/bank-account — JWT 없으면 401', async () => {
      await request(app.getHttpServer())
        .post('/kyc/bank-account')
        .send({
          verifyTrDt: '20260214',
          verifyTrNo: 'TEST123',
          verifyVal: '123',
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('POST /kyc/bank-verify/request — JWT 없이 호출 가능 (비인증 허용)', async () => {
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(mockIssueSuccess('AUTH_TEST'));

      const res = await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .send(VALID_REQUEST_DTO);

      expect(res.status).not.toBe(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  // =========================================
  // 3. 1원 인증 전체 플로우 (비인증 — 회원가입용)
  // =========================================
  describe('1원 인증 Full Flow (비인증 — 회원가입용)', () => {
    it('request → confirm 전체 플로우 성공', async () => {
      const trNo = `FLOW_TR_${Date.now()}`;

      // Step 1: 1원 발송 요청
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(mockIssueSuccess(trNo));

      const issueRes = await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .send(VALID_REQUEST_DTO);

      const issueData = getData(issueRes);
      expect(issueData.verifyTrDt).toBe('20260214');
      expect(issueData.verifyTrNo).toBe(trNo);

      // Step 2: 인증번호 확인 (비인증 → 계좌 저장 안 됨, 정보만 반환)
      jest.spyOn(httpService, 'get').mockReturnValueOnce(mockConfirmSuccess());

      const confirmRes = await request(app.getHttpServer())
        .post('/kyc/bank-verify/confirm')
        .send({
          verifyTrDt: issueData.verifyTrDt,
          verifyTrNo: trNo,
          verifyVal: '123',
        });

      const confirmData = getData(confirmRes);
      expect(confirmData.success).toBe(true);
      expect(confirmData.bankName).toBe('국민은행');
      expect(confirmData.accountHolder).toBe('홍길동');
      // 계좌번호는 마스킹된 상태 (앞3 + *** + 뒤3)
      expect(confirmData.accountNumber).toMatch(/^\d{3}\*{3}\d{3}$/);
    });
  });

  // =========================================
  // 4. 1원 인증 전체 플로우 (로그인 사용자 — 마이페이지)
  //    POST /kyc/bank-account (AuthGuard 있음) 사용
  // =========================================
  describe('1원 인증 Full Flow (로그인 사용자)', () => {
    it('request → POST /kyc/bank-account → GET /kyc/bank-account 플로우 성공', async () => {
      const authUser = await createAndLoginUser(app, 'kyc-flow');
      const trNo = `USER_TR_${Date.now()}`;

      // Step 1: 1원 발송 요청
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(mockIssueSuccess(trNo));

      const issueRes = await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .set(authHeader(authUser.token))
        .send(VALID_REQUEST_DTO);

      const issueData = getData(issueRes);
      expect(issueData.verifyTrNo).toBe(trNo);

      // Step 2: 계좌 변경/저장 via POST /kyc/bank-account (JWT 필수)
      // 이 엔드포인트는 AuthGuard가 있어 req.user.id가 존재 → 계좌 DB 저장
      jest.spyOn(httpService, 'get').mockReturnValueOnce(mockConfirmSuccess());

      const confirmRes = await request(app.getHttpServer())
        .post('/kyc/bank-account')
        .set(authHeader(authUser.token))
        .send({
          verifyTrDt: issueData.verifyTrDt,
          verifyTrNo: trNo,
          verifyVal: '456',
        });

      const confirmData = getData(confirmRes);
      expect(confirmData.success).toBe(true);
      expect(confirmData.bankName).toBe('국민은행');
      expect(confirmData.accountHolder).toBe('홍길동');

      // Step 3: 계좌 정보 조회 → 저장된 계좌 반환
      const bankRes = await request(app.getHttpServer())
        .get('/kyc/bank-account')
        .set(authHeader(authUser.token))
        .expect(HTTP_STATUS.OK);

      const bankData = getData(bankRes);
      expect(bankData).not.toBeNull();
      expect(bankData.bankName).toBe('국민은행');
      expect(bankData.accountHolder).toBe('홍길동');
      expect(bankData.bankVerifiedAt).toBeDefined();
    });

    it('계좌정보 전체 필드 저장 검증 (bankName, bankCode, accountNumber, accountHolder, kycStatus, bankVerifiedAt)', async () => {
      const authUser = await createAndLoginUser(app, 'kyc-allfields');
      const trNo = `ALLF_TR_${Date.now()}`;

      // Step 1: 인증 전 — kycStatus = NONE, 계좌 없음
      const beforeRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set(authHeader(authUser.token))
        .expect(HTTP_STATUS.OK);
      const beforeUser = getData(beforeRes);
      expect(beforeUser.kycStatus).toBe('NONE');
      expect(beforeUser.bankName).toBeNull();
      expect(beforeUser.bankCode).toBeNull();
      expect(beforeUser.accountHolder).toBeNull();
      expect(beforeUser.bankVerifiedAt).toBeNull();

      // Step 2: 1원 발송
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(mockIssueSuccess(trNo));
      await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .set(authHeader(authUser.token))
        .send({
          bankCode: '088',
          bankName: '신한은행',
          accountNumber: '11022033044055',
          accountHolder: '박영희',
        });

      jest.restoreAllMocks();

      // Step 3: 인증 확인 → 계좌 저장
      jest.spyOn(httpService, 'get').mockReturnValueOnce(mockConfirmSuccess());
      const confirmRes = await request(app.getHttpServer())
        .post('/kyc/bank-account')
        .set(authHeader(authUser.token))
        .send({ verifyTrDt: '20260214', verifyTrNo: trNo, verifyVal: '777' });

      // confirm 응답에서 bankCode 확인
      const confirmData = getData(confirmRes);
      expect(confirmData.success).toBe(true);
      expect(confirmData.bankCode).toBe('088');
      expect(confirmData.bankName).toBe('신한은행');
      expect(confirmData.accountHolder).toBe('박영희');
      expect(confirmData.accountNumber).toMatch(/^\d{3}\*{3}\d{3}$/); // 마스킹

      // Step 4: GET /kyc/bank-account — 저장된 계좌 전체 필드 확인
      const bankRes = await request(app.getHttpServer())
        .get('/kyc/bank-account')
        .set(authHeader(authUser.token))
        .expect(HTTP_STATUS.OK);
      const bankData = getData(bankRes);
      expect(bankData.bankCode).toBe('088');
      expect(bankData.bankName).toBe('신한은행');
      expect(bankData.accountHolder).toBe('박영희');
      expect(bankData.accountNumber).toMatch(/^\d{3}\*{3}\d{3}$/);
      expect(bankData.bankVerifiedAt).toBeDefined();

      // Step 5: GET /auth/me — kycStatus VERIFIED 확인 + 전체 유저 필드
      const afterRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set(authHeader(authUser.token))
        .expect(HTTP_STATUS.OK);
      const afterUser = getData(afterRes);
      expect(afterUser.kycStatus).toBe('VERIFIED');
      expect(afterUser.bankName).toBe('신한은행');
      expect(afterUser.bankCode).toBe('088');
      expect(afterUser.accountHolder).toBe('박영희');
      expect(afterUser.bankVerifiedAt).toBeDefined();
      // accountNumber는 암호화 상태로 저장 — /auth/me에서 반환 여부 확인
      // (암호화된 값이므로 원본과 다름)
      if (afterUser.accountNumber) {
        expect(afterUser.accountNumber).not.toBe('11022033044055'); // 원본이 아님 (암호화됨)
      }
    });

    it('인증 전 bank-account 조회 → null 반환', async () => {
      const freshUser = await createAndLoginUser(app, 'kyc-nobank');

      const res = await request(app.getHttpServer())
        .get('/kyc/bank-account')
        .set(authHeader(freshUser.token))
        .expect(HTTP_STATUS.OK);

      const data = getData(res);
      expect(data).toBeNull();
    });
  });

  // =========================================
  // 5. 인증 실패 케이스
  // =========================================
  describe('인증 실패 케이스', () => {
    it('Coocon confirm 실패 시 → 400 에러', async () => {
      const trNo = `FAIL_TR_${Date.now()}`;

      // Issue 성공
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(mockIssueSuccess(trNo));

      await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .send(VALID_REQUEST_DTO);

      jest.restoreAllMocks();

      // Confirm 실패
      jest.spyOn(httpService, 'get').mockReturnValueOnce(mockConfirmFail());

      const res = await request(app.getHttpServer())
        .post('/kyc/bank-verify/confirm')
        .send({
          verifyTrDt: '20260214',
          verifyTrNo: trNo,
          verifyVal: '999',
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toContain('인증번호');
    });

    it('존재하지 않는 세션으로 confirm 시 → 400 에러', async () => {
      const res = await request(app.getHttpServer())
        .post('/kyc/bank-verify/confirm')
        .send({
          verifyTrDt: '20260214',
          verifyTrNo: 'NONEXISTENT_TR_NO_' + Date.now(),
          verifyVal: '123',
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toContain('세션');
    });
  });

  // =========================================
  // 6. 계좌 변경 (마이페이지 — 다른 은행으로 변경)
  // =========================================
  describe('계좌 변경 (POST /kyc/bank-account)', () => {
    it('로그인 사용자 계좌 변경 성공', async () => {
      const authUser = await createAndLoginUser(app, 'kyc-change');
      const trNo = `CHANGE_TR_${Date.now()}`;

      // Step 1: 새 계좌로 1원 인증 발송
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(mockIssueSuccess(trNo));

      await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .set(authHeader(authUser.token))
        .send({
          bankCode: '011',
          bankName: '농협',
          accountNumber: '9876543210123',
          accountHolder: '김철수',
        });

      jest.restoreAllMocks();

      // Step 2: POST /kyc/bank-account (changeBankAccount)
      jest.spyOn(httpService, 'get').mockReturnValueOnce(mockConfirmSuccess());

      const changeRes = await request(app.getHttpServer())
        .post('/kyc/bank-account')
        .set(authHeader(authUser.token))
        .send({
          verifyTrDt: '20260214',
          verifyTrNo: trNo,
          verifyVal: '789',
        });

      const changeData = getData(changeRes);
      expect(changeData.success).toBe(true);
      expect(changeData.bankName).toBe('농협');
      expect(changeData.accountHolder).toBe('김철수');

      // Step 3: 변경된 계좌 확인
      const bankRes = await request(app.getHttpServer())
        .get('/kyc/bank-account')
        .set(authHeader(authUser.token))
        .expect(HTTP_STATUS.OK);

      const bankData = getData(bankRes);
      expect(bankData.bankName).toBe('농협');
      expect(bankData.accountHolder).toBe('김철수');
    });
  });

  // =========================================
  // 7. Coocon API 에러 처리
  // =========================================
  describe('Coocon API 에러 처리', () => {
    it('Coocon issue API 실패 응답 시 → BadRequest 전파', async () => {
      jest.spyOn(httpService, 'get').mockReturnValueOnce(
        of({
          data: { success: false, rc: '1001', rm: '유효하지 않은 계좌입니다.' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as any),
      );

      const res = await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .send(VALID_REQUEST_DTO)
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toContain('유효하지 않은 계좌');
    });

    it('Coocon API 네트워크 오류 시 → 500 에러 (재시도 후)', async () => {
      // callWithRetry: 3번 모두 실패
      const spy = jest.spyOn(httpService, 'get');
      spy.mockImplementation(() => throwError(() => new Error('ECONNREFUSED')));

      const res = await request(app.getHttpServer())
        .post('/kyc/bank-verify/request')
        .send(VALID_REQUEST_DTO)
        .expect(HTTP_STATUS.INTERNAL_ERROR);

      expect(res.body.message).toBeDefined();
    }, 30000);
  });
});
