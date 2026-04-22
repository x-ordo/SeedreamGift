/**
 * @file test-data.ts
 * @description 테스트 데이터 생성 팩토리
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { generateUniqueSuffix, getData, getItems } from './test-setup';

/**
 * 브랜드 상수
 */
export const BRANDS = [
  'SHINSEGAE',
  'HYUNDAI',
  'LOTTE',
  'DAISO',
  'OLIVEYOUNG',
] as const;
export type Brand = (typeof BRANDS)[number];

/**
 * 상품 생성 데이터
 */
export interface CreateProductData {
  brandCode: Brand;
  name: string;
  price: number;
  discountRate: number;
  tradeInRate: number;
  isActive?: boolean;
  allowTradeIn?: boolean;
}

/**
 * 테스트 상품 생성
 */
export async function createTestProduct(
  app: INestApplication,
  adminToken: string,
  overrides: Partial<CreateProductData> = {},
): Promise<{ id: number; brandCode: string; name: string; price: number }> {
  const suffix = generateUniqueSuffix();
  const defaultData: CreateProductData = {
    brandCode: 'HYUNDAI',
    name: `테스트 상품권 ${suffix}`,
    price: 50000,
    discountRate: 3,
    tradeInRate: 5,
    allowTradeIn: true,
    ...overrides,
  };

  const res = await request(app.getHttpServer())
    .post('/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(defaultData)
    .expect(201);

  return getData(res);
}

/**
 * 테스트 바우처(PIN 코드) 일괄 등록
 */
export async function createTestVouchers(
  app: INestApplication,
  adminToken: string,
  productId: number,
  count: number = 5,
): Promise<{ count: number; pinCodes: string[] }> {
  const suffix = generateUniqueSuffix();
  const pinCodes = Array.from(
    { length: count },
    (_, i) => `PIN-${suffix}-${String(i + 1).padStart(3, '0')}`,
  );

  const res = await request(app.getHttpServer())
    .post('/vouchers/bulk')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ productId, pinCodes })
    .expect(201);

  return { count: getData(res).count, pinCodes };
}

/**
 * 재고 확인
 */
export async function getVoucherStock(
  app: INestApplication,
  adminToken: string,
  productId: number,
): Promise<{ available: number; total: number }> {
  const res = await request(app.getHttpServer())
    .get(`/vouchers/stock/${productId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  return getData(res);
}

/**
 * 주문 생성 데이터
 */
export interface CreateOrderData {
  items: Array<{ productId: number; quantity: number }>;
  paymentMethod: 'CARD' | 'VIRTUAL_ACCOUNT' | 'BANK_TRANSFER';
}

/**
 * 테스트 주문 생성
 */
export async function createTestOrder(
  app: INestApplication,
  userToken: string,
  orderData: CreateOrderData,
): Promise<{ id: number; status: string; totalAmount: number; items: any[] }> {
  const res = await request(app.getHttpServer())
    .post('/orders')
    .set('Authorization', `Bearer ${userToken}`)
    .send(orderData);

  // 주문 생성은 재고, KYC 등 조건에 따라 실패할 수 있음
  if (res.status !== 201) {
    throw new Error(
      `Order creation failed: ${res.status} - ${JSON.stringify(res.body)}`,
    );
  }

  return getData(res);
}

/**
 * 매입 신청 데이터
 */
export interface CreateTradeInData {
  productId: number;
  pinCode: string;
  bankName: string;
  accountNum: string;
  accountHolder: string;
}

/**
 * 테스트 매입 신청
 */
export async function createTestTradeIn(
  app: INestApplication,
  userToken: string,
  data: Partial<CreateTradeInData> & { productId: number },
): Promise<{ id: number; status: string; productId: number }> {
  const suffix = generateUniqueSuffix();
  const defaultData: CreateTradeInData = {
    productId: data.productId,
    pinCode: data.pinCode || `TRADEIN-PIN-${suffix}`,
    bankName: data.bankName || '테스트은행',
    accountNum: data.accountNum || `123-456-${suffix.slice(0, 4)}`,
    accountHolder: data.accountHolder || '홍길동',
  };

  const res = await request(app.getHttpServer())
    .post('/trade-ins')
    .set('Authorization', `Bearer ${userToken}`)
    .send(defaultData);

  if (res.status !== 201) {
    throw new Error(
      `TradeIn creation failed: ${res.status} - ${JSON.stringify(res.body)}`,
    );
  }

  return getData(res);
}

/**
 * 상품 목록 조회
 * NOTE: /products now returns { items, meta } paginated format
 */
export async function getProducts(app: INestApplication): Promise<
  Array<{
    id: number;
    brandCode: string;
    name: string;
    price: number;
    isActive: boolean;
  }>
> {
  const res = await request(app.getHttpServer()).get('/products').expect(200);
  // Handle paginated { items, meta } format
  const data = getData(res);
  return data.items || data;
}

/**
 * 내 주문 목록 조회
 */
export async function getMyOrders(
  app: INestApplication,
  userToken: string,
): Promise<
  Array<{ id: number; status: string; totalAmount: number; items: any[] }>
> {
  const res = await request(app.getHttpServer())
    .get('/orders/my')
    .set('Authorization', `Bearer ${userToken}`)
    .expect(200);

  return getItems(res);
}

/**
 * 내 매입 내역 조회
 */
export async function getMyTradeIns(
  app: INestApplication,
  userToken: string,
): Promise<Array<{ id: number; status: string; productId: number }>> {
  const res = await request(app.getHttpServer())
    .get('/trade-ins/my')
    .set('Authorization', `Bearer ${userToken}`)
    .expect(200);

  return getData(res);
}

/**
 * 테스트 데이터 세트 (상품 + 재고)
 */
export async function createCompleteTestDataSet(
  app: INestApplication,
  adminToken: string,
): Promise<{
  product: { id: number; brandCode: string; name: string; price: number };
  vouchers: { count: number; pinCodes: string[] };
}> {
  const product = await createTestProduct(app, adminToken);
  const vouchers = await createTestVouchers(app, adminToken, product.id, 10);

  return { product, vouchers };
}
