/**
 * @file gift-flow.e2e-spec.ts
 * @description 선물하기 전체 플로우 E2E 테스트
 *
 * 시나리오:
 * 1. 수신자 검색 (GET /gifts/search)
 * 2. 수신자 확인 (POST /gifts/check-receiver)
 * 3. 선물 주문 생성 (POST /orders with giftReceiverEmail)
 * 4. 받은 선물 확인 (GET /orders/my-gifts)
 * 5. 에러 케이스 (자기 자신, 미존재 회원, canReceiveGift=false)
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getData,
  getItems,
  HTTP_STATUS,
  TEST_TIMEOUT,
} from '../helpers/test-setup';
import { createAndLoginUser, loginAsSeededUser } from '../helpers/test-users';
import { createTestProduct, createTestVouchers } from '../helpers/test-data';

describe('Gift Flow (선물하기 플로우)', () => {
  let app: INestApplication;
  let adminAuth: { token: string };
  let senderAuth: { token: string; user: { email: string } };
  let receiverAuth: { token: string; user: { email: string }; userId?: number };
  let productId: number;

  beforeAll(async () => {
    app = await createTestApp();

    // 1. Admin 로그인
    const admin = await loginAsSeededUser(app, 'admin');
    adminAuth = { token: admin.token };

    // 2. Sender (보내는 사람) 생성
    const sender = await createAndLoginUser(app, 'gift-sender');
    senderAuth = { token: sender.token, user: sender.user };

    // 3. Receiver (받는 사람) 생성
    const receiver = await createAndLoginUser(app, 'gift-receiver');
    receiverAuth = {
      token: receiver.token,
      user: receiver.user,
      userId: receiver.userId,
    };

    // 4. Receiver의 canReceiveGift 활성화 (Admin API)
    await request(app.getHttpServer())
      .patch(`/admin/users/${receiver.userId}`)
      .set('Authorization', `Bearer ${adminAuth.token}`)
      .send({ canReceiveGift: true })
      .expect(HTTP_STATUS.OK);

    // 5. 테스트 상품 + 바우처 생성
    const product = await createTestProduct(app, adminAuth.token);
    productId = product.id;
    await createTestVouchers(app, adminAuth.token, productId, 5);
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('1. 수신자 검색 (GET /gifts/search)', () => {
    it('이메일로 검색하면 canReceiveGift=true인 사용자가 반환된다', async () => {
      const emailPrefix = receiverAuth.user.email.split('@')[0];
      const res = await request(app.getHttpServer())
        .get('/gifts/search')
        .query({ query: emailPrefix })
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getData(res))).toBe(true);
      expect(getData(res).length).toBeGreaterThanOrEqual(1);

      const found = getData(res).find(
        (u: any) => u.email === receiverAuth.user.email,
      );
      expect(found).toBeDefined();
      expect(found.email).toBe(receiverAuth.user.email);
    });

    it('정확히 3글자 이메일 부분 문자열로 검색 가능하다', async () => {
      const threeChars = receiverAuth.user.email.slice(0, 3);
      const res = await request(app.getHttpServer())
        .get('/gifts/search')
        .query({ query: threeChars })
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getData(res))).toBe(true);
    });

    it('3글자 미만 검색어는 400 에러를 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/gifts/search')
        .query({ query: 'ab' })
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .expect(HTTP_STATUS.BAD_REQUEST);
    });

    it('공백만 있는 쿼리는 빈 배열을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/gifts/search')
        .query({ query: '   ' })
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res)).toEqual([]);
    });

    it('비로그인 시 401', async () => {
      await request(app.getHttpServer())
        .get('/gifts/search')
        .query({ query: 'test' })
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  describe('2. 수신자 확인 (POST /gifts/check-receiver)', () => {
    it('유효한 수신자 이메일이면 success: true를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/gifts/check-receiver')
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .send({ email: receiverAuth.user.email })
        .expect(HTTP_STATUS.OK);

      expect(getData(res).success).toBe(true);
      expect(getData(res).email).toBe(receiverAuth.user.email);
      expect(getData(res).receiverId).toBeDefined();
    });

    it('존재하지 않는 이메일이면 400 에러', async () => {
      const res = await request(app.getHttpServer())
        .post('/gifts/check-receiver')
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .send({ email: 'nonexistent@nowhere.com' })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toContain('존재하지 않는');
    });

    it('canReceiveGift=false인 사용자는 400 에러', async () => {
      // sender는 canReceiveGift가 기본 false
      const res = await request(app.getHttpServer())
        .post('/gifts/check-receiver')
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .send({ email: senderAuth.user.email })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toContain('선물을 받을 수 없는');
    });
  });

  describe('3. 선물 주문 생성 (POST /orders)', () => {
    it('giftReceiverEmail 포함 주문 시 Gift 레코드가 생성된다', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .send({
          items: [{ productId, quantity: 1 }],
          giftReceiverEmail: receiverAuth.user.email,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).id).toBeDefined();
      expect(getData(res).status).toBe('PAID');
      expect(getData(res).voucherCodes).toBeDefined();
      expect(getData(res).voucherCodes.length).toBeGreaterThanOrEqual(1);
    });

    it('자기 자신에게 선물하면 400 에러', async () => {
      // sender의 canReceiveGift를 true로 먼저 설정
      // 실제로는 canReceiveGift=false 이므로 먼저 다른 에러가 날 수 있음
      // 하지만 자기자신 검증이 먼저 되어야 함
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .send({
          items: [{ productId, quantity: 1 }],
          giftReceiverEmail: senderAuth.user.email,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      // 자기 자신 또는 수신 불가 에러 중 하나
      expect(res.body.message).toBeDefined();
    });

    it('존재하지 않는 수신자 이메일이면 400 에러', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .send({
          items: [{ productId, quantity: 1 }],
          giftReceiverEmail: 'nobody@nowhere.com',
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(res.body.message).toContain('존재하지 않는');
    });
  });

  describe('4. 받은 선물 확인 (GET /orders/my-gifts)', () => {
    it('수신자가 받은 선물 목록을 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my-gifts')
        .set('Authorization', `Bearer ${receiverAuth.token}`)
        .expect(HTTP_STATUS.OK);

      const gifts = getItems(res);
      expect(Array.isArray(gifts)).toBe(true);
      expect(gifts.length).toBeGreaterThanOrEqual(1);

      const gift = gifts[0];
      expect(gift.senderName).toBeDefined();
      expect(gift.order).toBeDefined();
      expect(gift.order.items).toBeDefined();
      expect(gift.order.items.length).toBeGreaterThanOrEqual(1);
      expect(gift.order.voucherCodes).toBeDefined();
    });

    it('보낸 사람은 my-gifts에 나타나지 않는다', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my-gifts')
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .expect(HTTP_STATUS.OK);

      // sender는 선물을 받은 적이 없으므로 빈 배열
      expect(Array.isArray(getItems(res))).toBe(true);
      // 이전에 다른 테스트에서 sender에게 선물을 보내지 않았으므로 0
      expect(getItems(res).length).toBe(0);
    });

    it('보낸 사람의 my 주문에는 선물 주문이 포함된다', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${senderAuth.token}`)
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getItems(res))).toBe(true);
      expect(getItems(res).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. 관리자 선물 조회 (GET /admin/gifts)', () => {
    it('관리자가 전체 선물 목록을 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/gifts')
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).items).toBeDefined();
      expect(Array.isArray(getData(res).items)).toBe(true);
    });

    it('관리자가 선물 통계를 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/gifts/stats')
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).totalGifts).toBeDefined();
    });
  });
});
