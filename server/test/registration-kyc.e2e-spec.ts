import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AppModule } from '../src/app.module';

function getData(res: { body: any }): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('Secure Registration with KYC (Full Flow)', () => {
  let app: INestApplication;
  let httpService: HttpService;
  const uniqueSuffix = Date.now().toString().slice(-6);

  // Mocks
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

  function mockConfirmSuccess() {
    return of({
      data: { success: true, rc: '0000', rm: '정상처리' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  afterAll(async () => {
    if (app) await app.close();
  });

  it('Step 1: Raw bank info registration should FAIL (400 Bad Request)', async () => {
    const fakeUser = {
      email: `reject-${uniqueSuffix}@test.com`,
      password: 'Password123!',
      name: 'Reject User',
      phone: `010-9999-${uniqueSuffix.slice(-4)}`,
      bankName: 'Fake Bank',
      bankCode: '999',
      accountNumber: '1234567890',
      accountHolder: 'Reject User',
    };

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(fakeUser)
      .expect(400);

    expect(res.body.message).toMatch(/1원 인증/);
  });

  it('Step 2: Full Flow - Issue -> Confirm -> Register with Token should SUCCEED', async () => {
    const trNo = `REG_TR_${uniqueSuffix}`;
    const validUser = {
      email: `secure-${uniqueSuffix}@test.com`,
      password: 'Password123!',
      name: 'Secure User',
      phone: `010-8888-${uniqueSuffix.slice(-4)}`,
      // verificationId will be added
    };

    // 1. Issue 1-won verification (No Auth)
    jest.spyOn(httpService, 'get').mockReturnValueOnce(mockIssueSuccess(trNo));

    const issueRes = await request(app.getHttpServer())
      .post('/kyc/bank-verify/request')
      .send({
        bankCode: '004',
        bankName: '국민은행',
        accountNumber: '1234567890123',
        accountHolder: '홍길동',
      })
      .expect(201);

    const issueData = getData(issueRes);
    expect(issueData.verifyTrNo).toBe(trNo);

    // 2. Confirm verification (No Auth) -> Sets isVerified=true in session
    jest.spyOn(httpService, 'get').mockReturnValueOnce(mockConfirmSuccess());

    const confirmRes = await request(app.getHttpServer())
      .post('/kyc/bank-verify/confirm')
      .send({
        verifyTrDt: issueData.verifyTrDt,
        verifyTrNo: trNo,
        verifyVal: '123',
      })
      .expect(201);

    expect(getData(confirmRes).success).toBe(true);

    // 3. Register with verificationId
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...validUser,
        verificationId: trNo, // verification proof
        accountHolder: '홍길동', // Optional, verified against session? No, session data is used.
      })
      .expect(201);

    const userData = getData(registerRes);
    expect(userData.email).toBe(validUser.email);
    expect(userData.kycStatus).toBe('VERIFIED');
    expect(userData.bankName).toBe('국민은행');
    expect(userData.bankCode).toBe('004');
    // Account number is encrypted in DB, but may or may not be returned depending on AuthService.
    // In AuthService.register, we return rest of newUser. Check schema/DTO.
  });
});
