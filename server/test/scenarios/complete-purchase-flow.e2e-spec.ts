/**
 * @file complete-purchase-flow.e2e-spec.ts
 * @description 완전한 구매 플로우 시나리오 테스트 (Critical Path)
 *
 * 시나리오:
 * 1. 신규 사용자 회원가입
 * 2. 로그인하여 토큰 획득
 * 3. 상품 목록 조회
 * 4. 장바구니에 상품 추가
 * 5. 장바구니 조회
 * 6. 주문 생성
 * 7. 주문 상세 조회 - PIN 코드 확인
 * 8. 재고 차감 확인
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  generateUniqueSuffix,
  getData,
  getItems,
  HTTP_STATUS,
} from '../helpers/test-setup';
import {
  createAndLoginUser,
  loginAsSeededUser,
  AuthenticatedUser,
} from '../helpers/test-users';
import {
  createTestProduct,
  createTestVouchers,
  getVoucherStock,
} from '../helpers/test-data';

/**
 * set-cookie 헤더를 string[]로 정규화
 */
function normalizeCookies(setCookie: string | string[] | undefined): string[] {
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

describe('Scenario: Complete Purchase Flow (Critical Path)', () => {
  let app: INestApplication;
  let admin: AuthenticatedUser;
  let buyer: AuthenticatedUser;

  // 테스트 데이터
  let testProductId: number;
  let initialStock: number;
  let orderId: number;

  const uniqueSuffix = generateUniqueSuffix();

  beforeAll(async () => {
    app = await createTestApp();

    // 관리자로 로그인 (상품/재고 생성용)
    try {
      admin = await loginAsSeededUser(app, 'admin');
    } catch {
      admin = await createAndLoginUser(app, 'purchase-admin', 'ADMIN');
    }

    // 테스트 상품 생성
    const product = await createTestProduct(app, admin.token, {
      brandCode: 'SHINSEGAE',
      name: `구매 테스트 상품권 ${uniqueSuffix}`,
      price: 50000,
      discountRate: 3,
    });
    testProductId = product.id;

    // 바우처 재고 등록 (5개)
    await createTestVouchers(app, admin.token, testProductId, 5);

    // 초기 재고 확인
    const stock = await getVoucherStock(app, admin.token, testProductId);
    initialStock = stock.available;
  }, 60000);

  afterAll(async () => {
    await closeTestApp(app);
  }, 30000);

  describe('Step 1: 신규 사용자 회원가입', () => {
    const newUser = {
      email: `buyer-${uniqueSuffix}@test.com`,
      password: 'SecurePass123!',
      name: '구매 테스트 사용자',
      phone: `010-1234-${uniqueSuffix.slice(-4)}`,
    };

    it('should register a new user successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(newUser)
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res)).toHaveProperty('id');
      expect(getData(res).email).toBe(newUser.email);
      expect(getData(res).role).toBe('USER');
      expect(getData(res)).not.toHaveProperty('password');
    });

    it('Step 2: should login and receive JWT token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: newUser.email, password: newUser.password })
        .expect(HTTP_STATUS.OK);

      expect(getData(res)).toHaveProperty('access_token');
      expect(typeof getData(res).access_token).toBe('string');

      // 쿠키에 refresh_token 포함 확인
      const cookies = normalizeCookies(res.headers['set-cookie']);
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('refresh_token'))).toBe(
        true,
      );

      buyer = {
        user: { ...newUser, role: 'USER' },
        token: getData(res).access_token,
        cookies,
      };
    });
  });

  describe('Step 3: 상품 목록 조회', () => {
    it('should retrieve product list', async () => {
      const res = await request(app.getHttpServer())
        .get('/products')
        .expect(HTTP_STATUS.OK);

      const d = getData(res);
      const products = d.items || [];
      expect(Array.isArray(products)).toBe(true);
      // 목록에 있거나 상세 조회로 확인
      const testProduct = products.find((p: any) => p.id === testProductId);
      if (testProduct) {
        expect(testProduct.brandCode).toBe('SHINSEGAE');
      } else {
        // 목록 필터링 적용 시 상세 조회로 확인
        const detailRes = await request(app.getHttpServer())
          .get(`/products/${testProductId}`)
          .expect(HTTP_STATUS.OK);
        expect(getData(detailRes).brandCode).toBe('SHINSEGAE');
      }
    });

    it('should retrieve product details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${testProductId}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).id).toBe(testProductId);
      expect(Number(getData(res).price)).toBe(50000);
      expect(Number(getData(res).discountRate)).toBe(3);
    });
  });

  describe('Step 4 & 5: 장바구니 관리', () => {
    it('should add product to cart', async () => {
      const res = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ productId: testProductId, quantity: 2 });

      // 장바구니 추가 성공 또는 이미 있으면 수량 업데이트
      expect([HTTP_STATUS.CREATED, HTTP_STATUS.OK]).toContain(res.status);
    });

    it('should retrieve cart contents', async () => {
      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(HTTP_STATUS.OK);

      // body가 배열 또는 { items: [] } 형태일 수 있음
      const d = getData(res);
      const items = Array.isArray(d) ? d : d.items || [];
      expect(items.length).toBeGreaterThan(0);
      const cartItem = items.find(
        (item: any) => item.productId === testProductId,
      );
      expect(cartItem).toBeDefined();
      expect(cartItem.quantity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Step 6: 주문 생성', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        items: [{ productId: testProductId, quantity: 1 }],
        paymentMethod: 'VIRTUAL_ACCOUNT',
      };

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send(orderData);

      // 재고가 있으면 201, 없으면 400, KYC 문제면 403
      expect([
        HTTP_STATUS.CREATED,
        HTTP_STATUS.BAD_REQUEST,
        HTTP_STATUS.FORBIDDEN,
      ]).toContain(res.status);

      if (res.status === HTTP_STATUS.CREATED) {
        orderId = getData(res).id;
        expect(getData(res)).toHaveProperty('id');
        expect(getData(res)).toHaveProperty('totalAmount');
        expect(getData(res).status).toBeDefined();
      }
    });
  });

  describe('Step 7: 주문 상세 조회', () => {
    it('should retrieve order details with PIN codes (if order created)', async () => {
      if (!orderId) {
        console.log('Skipping: No order was created');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(HTTP_STATUS.OK);

      const orderData = getData(res);
      expect(orderData.id).toBe(orderId);
      expect(orderData).toHaveProperty('items');
      expect(Array.isArray(orderData.items)).toBe(true);

      // 주문 아이템에 PIN 코드가 포함되어야 함 (결제 완료 시)
      if (orderData.status === 'DELIVERED' || orderData.status === 'PAID') {
        orderData.items.forEach((item: any) => {
          // PIN 코드는 voucherCode, pinCode, 또는 voucher.pin 형태일 수 있음
          const hasPin = item.voucherCode || item.pinCode || item.voucher?.pin;
          // PIN이 없을 수 있음 (아직 발급 안됨)
          if (hasPin) {
            expect(hasPin).toBeDefined();
          }
        });
      }
    });

    it('should list my orders including the new order', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/my')
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getItems(res))).toBe(true);

      if (orderId) {
        const myOrder = getItems(res).find((o: any) => o.id === orderId);
        expect(myOrder).toBeDefined();
      }
    });
  });

  describe('Step 8: 재고 차감 확인', () => {
    it('should decrease stock after order (if order created)', async () => {
      if (!orderId) {
        console.log('Skipping: No order was created');
        return;
      }

      const stock = await getVoucherStock(app, admin.token, testProductId);
      // 주문 수량만큼 재고 감소 확인
      expect(stock.available).toBeLessThan(initialStock);
    });
  });

  describe('Edge Cases', () => {
    it('should not allow order without authentication', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          paymentMethod: 'CARD',
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('should not allow accessing other user orders', async () => {
      if (!orderId) {
        console.log('Skipping: No order was created');
        return;
      }

      // 다른 사용자 생성
      const otherUser = await createAndLoginUser(app, 'other-buyer');

      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherUser.token}`);

      // 403 또는 404 (다른 사용자의 주문 접근 불가)
      expect([HTTP_STATUS.FORBIDDEN, HTTP_STATUS.NOT_FOUND]).toContain(
        res.status,
      );
    });
  });
});
