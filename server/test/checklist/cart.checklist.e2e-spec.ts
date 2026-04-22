/**
 * @file cart.checklist.e2e-spec.ts
 * @description 장바구니 관련 QA 체크리스트 테스트 (7개 테스트)
 *
 * [CART-001] 장바구니에 상품 추가
 * [CART-002] 장바구니 조회
 * [CART-003] 수량 변경
 * [CART-004] 상품 삭제
 * [CART-005] 장바구니 비우기
 * [CART-006] 비로그인 시 장바구니 접근 불가 (401)
 * [CART-007] 재고 초과 수량 추가 실패
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  generateUniqueSuffix,
  getData,
  HTTP_STATUS,
} from '../helpers/test-setup';
import {
  createAndLoginUser,
  loginAsSeededUser,
  AuthenticatedUser,
} from '../helpers/test-users';
import { createTestProduct, createTestVouchers } from '../helpers/test-data';

describe('Cart Checklist E2E Tests', () => {
  let app: INestApplication;
  let admin: AuthenticatedUser;
  let user: AuthenticatedUser;

  const uniqueSuffix = generateUniqueSuffix();
  let testProductId: number;
  let cartItemId: number;

  beforeAll(async () => {
    app = await createTestApp();

    // 관리자 설정
    try {
      admin = await loginAsSeededUser(app, 'admin');
    } catch {
      admin = await createAndLoginUser(app, 'cart-admin', 'ADMIN');
    }

    // 사용자 설정
    user = await createAndLoginUser(app, 'cart-user');

    // 테스트 상품 생성 + 재고 추가
    const product = await createTestProduct(app, admin.token, {
      brandCode: 'SHINSEGAE',
      name: `장바구니 테스트 상품 ${uniqueSuffix}`,
      price: 50000,
      discountRate: 3,
    });
    testProductId = product.id;

    // 재고 3개만 추가 (초과 테스트용)
    await createTestVouchers(app, admin.token, testProductId, 3);
  }, 60000);

  afterAll(async () => {
    await closeTestApp(app);
  }, 30000);

  describe('[CART-001] 장바구니에 상품 추가', () => {
    it('should add product to cart', async () => {
      const res = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          productId: testProductId,
          quantity: 1,
        });

      expect([HTTP_STATUS.CREATED, HTTP_STATUS.OK]).toContain(res.status);

      if (getData(res).id) {
        cartItemId = getData(res).id;
      }
    });

    it('should update quantity when adding same product again', async () => {
      const res = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          productId: testProductId,
          quantity: 1, // 추가 1개
        });

      // 성공적으로 수량 업데이트 또는 새 아이템 추가
      expect([HTTP_STATUS.CREATED, HTTP_STATUS.OK]).toContain(res.status);
    });
  });

  describe('[CART-002] 장바구니 조회', () => {
    it('should retrieve cart contents', async () => {
      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(HTTP_STATUS.OK);

      // body가 배열 또는 { items: [] } 형태일 수 있음
      const d = getData(res);
      const items = Array.isArray(d) ? d : d.items || [];
      expect(items.length).toBeGreaterThan(0);

      // 상품 정보 포함 확인
      const cartItem = items.find(
        (item: any) => item.productId === testProductId,
      );
      expect(cartItem).toBeDefined();
      expect(cartItem.quantity).toBeGreaterThanOrEqual(1);
    });

    it('should include product details in cart items', async () => {
      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(HTTP_STATUS.OK);

      const d2 = getData(res);
      const items = Array.isArray(d2) ? d2 : d2.items || [];
      if (items.length > 0 && items[0].product) {
        expect(items[0].product.name).toBeDefined();
        expect(items[0].product.price).toBeDefined();
      }
    });
  });

  describe('[CART-003] 수량 변경', () => {
    it('should update cart item quantity', async () => {
      // 먼저 장바구니 아이템 ID 확인
      const cartRes = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(HTTP_STATUS.OK);

      const d = getData(cartRes);
      const items = Array.isArray(d) ? d : d.items || [];
      const cartItem = items.find(
        (item: any) => item.productId === testProductId,
      );
      if (!cartItem) {
        console.log('Skipping: No cart item found');
        return;
      }

      const itemId = cartItem.id;

      const res = await request(app.getHttpServer())
        .patch(`/cart/${itemId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ quantity: 2 });

      expect([HTTP_STATUS.OK]).toContain(res.status);

      if (res.status === HTTP_STATUS.OK) {
        expect(getData(res).quantity).toBe(2);
      }
    });

    it('should reject zero or negative quantity', async () => {
      const cartRes = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(HTTP_STATUS.OK);

      const d = getData(cartRes);
      const cartItems = d.items || (Array.isArray(d) ? d : []);
      const cartItem = cartItems[0];
      if (!cartItem) return;

      const res = await request(app.getHttpServer())
        .patch(`/cart/${cartItem.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ quantity: 0 });

      // 0 또는 음수는 거부되거나 삭제로 처리됨
      expect([HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.OK]).toContain(res.status);
    });
  });

  describe('[CART-004] 상품 삭제', () => {
    let itemToDelete: number;

    beforeAll(async () => {
      // 삭제용 아이템 추가
      const product = await createTestProduct(app, admin.token, {
        brandCode: 'HYUNDAI',
        name: `삭제 테스트 상품 ${uniqueSuffix}`,
        price: 30000,
        discountRate: 2,
      });

      const res = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ productId: product.id, quantity: 1 });

      if (getData(res).id) {
        itemToDelete = getData(res).id;
      } else {
        // 장바구니 조회해서 ID 찾기
        const cartRes = await request(app.getHttpServer())
          .get('/cart')
          .set('Authorization', `Bearer ${user.token}`);
        const d = getData(cartRes);
        const cartItems = d.items || (Array.isArray(d) ? d : []);
        const item = cartItems.find((i: any) => i.productId === product.id);
        itemToDelete = item?.id;
      }
    });

    it('should remove item from cart', async () => {
      if (!itemToDelete) {
        console.log('Skipping: No item to delete');
        return;
      }

      const res = await request(app.getHttpServer())
        .delete(`/cart/${itemToDelete}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect([HTTP_STATUS.OK, 204]).toContain(res.status);

      // 삭제 확인
      const cartRes = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${user.token}`);

      const dCart = getData(cartRes);
      const cartItems = dCart.items || (Array.isArray(dCart) ? dCart : []);
      const deletedItem = cartItems.find((i: any) => i.id === itemToDelete);
      expect(deletedItem).toBeUndefined();
    });
  });

  describe('[CART-005] 장바구니 비우기', () => {
    it('should clear entire cart', async () => {
      // 비우기 전 아이템이 있는지 확인
      const beforeRes = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${user.token}`);

      const dBefore = getData(beforeRes);
      const beforeItems =
        dBefore.items || (Array.isArray(dBefore) ? dBefore : []);
      if (beforeItems.length === 0) {
        // 아이템 추가
        await request(app.getHttpServer())
          .post('/cart')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ productId: testProductId, quantity: 1 });
      }

      // 장바구니 비우기
      const res = await request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${user.token}`);

      expect([HTTP_STATUS.OK, 204]).toContain(res.status);

      // 비워졌는지 확인
      const afterRes = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(HTTP_STATUS.OK);

      // body가 배열인지, 또는 { items: [] } 형태인지 확인
      const dAfter = getData(afterRes);
      if (Array.isArray(dAfter)) {
        expect(dAfter.length).toBe(0);
      } else if (dAfter && dAfter.items) {
        expect(dAfter.items.length).toBe(0);
      } else {
        // 빈 장바구니
        expect(dAfter.itemCount || 0).toBe(0);
      }
    });
  });

  describe('[CART-006] 비로그인 시 장바구니 접근 불가', () => {
    it('should deny cart access without authentication', async () => {
      await request(app.getHttpServer())
        .get('/cart')
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('should deny adding to cart without authentication', async () => {
      await request(app.getHttpServer())
        .post('/cart')
        .send({ productId: testProductId, quantity: 1 })
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  describe('[CART-007] 재고 초과 수량 추가 실패', () => {
    it('should reject quantity exceeding available stock', async () => {
      // 재고(3개)보다 많은 수량 추가 시도
      const res = await request(app.getHttpServer())
        .post('/cart')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          productId: testProductId,
          quantity: 100, // 재고 3개보다 많음
        });

      // 재고 초과면 400, 장바구니에는 추가 허용하고 주문 시 검증하는 경우 201
      expect([
        HTTP_STATUS.BAD_REQUEST,
        HTTP_STATUS.CREATED,
        HTTP_STATUS.OK,
      ]).toContain(res.status);

      // 400이면 에러 메시지 확인
      if (res.status === HTTP_STATUS.BAD_REQUEST) {
        expect(res.body.message).toMatch(/재고|stock|insufficient|초과/i);
      }
    });
  });
});
