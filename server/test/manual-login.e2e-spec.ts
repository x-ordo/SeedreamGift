import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

function getData(res: { body: any }): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('Manual Login Test', () => {
  let app: INestApplication;
  const uniqueSuffix = Date.now().toString().slice(-8);

  const testAdmin = {
    email: `manual-admin-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Manual Admin',
    phone: `010-9999-${uniqueSuffix.slice(-4)}`,
  };

  const testUser = {
    email: `manual-user-${uniqueSuffix}@test.com`,
    password: 'Password123!',
    name: 'Manual User',
    phone: `010-8888-${uniqueSuffix.slice(-4)}`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    // Create test users (role field removed for security - all users start as USER)
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testAdmin)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should login successfully with admin credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testAdmin.email,
        password: testAdmin.password,
      })
      .expect(200);

    console.log(
      'Login successful! Token:',
      getData(res).access_token.substring(0, 20) + '...',
    );
    expect(getData(res)).toHaveProperty('access_token');
    expect(getData(res).user.email).toBe(testAdmin.email);
  });

  it('should login successfully with user credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    console.log(
      'User Login successful! Token:',
      getData(res).access_token.substring(0, 20) + '...',
    );
    expect(getData(res)).toHaveProperty('access_token');
    expect(getData(res).user.email).toBe(testUser.email);
  });
});
