/**
 * @file seed.ts
 * @description 데이터베이스 초기 시드 스크립트 - 개발/데모용 기본 데이터 생성
 * @module prisma
 *
 * 시드 데이터 구성:
 * - 브랜드 6종 (현대, 신세계, 롯데, W상품권, 다이소, CU) + PIN 설정
 * - 사용자 4명 (ADMIN, USER x2, PARTNER)
 * - 상품 22종 (브랜드별 권종)
 * - 사이트 설정 (일일 한도, 배너 공지)
 * - 공지사항 5건, 이벤트 5건, FAQ 10건
 * - 주문 4건 (DELIVERED, PAID, CANCELLED, 선물)
 * - 바우처 코드 (SOLD 4건, AVAILABLE 2건)
 * - 매입 신청 3건 (REQUESTED, VERIFIED, PAID)
 *
 * 실행:
 * - pnpm prisma:push 후 자동 실행 또는 npx ts-node prisma/seed.ts
 *
 * 주의:
 * - 매번 실행 시 기존 데이터를 전부 삭제하고 재생성 (idempotent)
 * - FK 제약 조건 때문에 삭제 순서가 중요 (자식 → 부모)
 * - PIN 코드는 CryptoService와 동일한 AES-256-CBC로 암호화
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../src/shared/prisma/generated/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// ============================================================================
// 암호화 헬퍼 (CryptoService와 동일한 로직)
// ============================================================================
// 시드 스크립트는 NestJS 컨텍스트 밖에서 실행되므로 CryptoService를 직접 사용할 수 없다.
// 동일한 AES-256-CBC 알고리즘으로 PIN과 계좌번호를 암호화한다.
const envKey = process.env.ENCRYPTION_KEY;
if (!envKey) {
  throw new Error(
    'ENCRYPTION_KEY environment variable is required for seed script',
  );
}
const encKey = Buffer.from(envKey.slice(0, 32));

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Prisma 7.x driver adapter 방식은 CONNECTION_STRING을 직접 파싱해야 한다
function parseDatabaseUrl(url: string) {
  const params: any = {};

  // Extract host:port first
  const hostMatch = url.match(/sqlserver:\/\/([^;]+)/);
  if (hostMatch) {
    const [host, port] = hostMatch[1].split(':');
    params.server = host;
    params.port = parseInt(port || '1433', 10);
  }

  // Extract key=value pairs
  const kvPairs = url.split(';');
  kvPairs.forEach((pair) => {
    const [key, ...values] = pair.split('=');
    if (key && values.length > 0) {
      const value = values.join('='); // Rejoin in case value has =
      if (key.toLowerCase() === 'database') params.database = value;
      if (key.toLowerCase() === 'user') params.user = value;
      if (key.toLowerCase() === 'password') params.password = value;
    }
  });

  if (!params.server || !params.database || !params.user || !params.password) {
    console.error('Failed to parse (partial):', params);
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    server: params.server,
    port: params.port,
    database: params.database,
    user: params.user,
    password: params.password,
    options: { encrypt: true, trustServerCertificate: true },
    pool: { min: 2, max: 10 },
  };
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const config = parseDatabaseUrl(dbUrl);
const adapter = new PrismaMssql(config);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // ============================================================================
  // 기존 데이터 전체 삭제 (FK 자식 → 부모 순서 엄수)
  // ============================================================================
  // VoucherCode → OrderItem → Order 순서로 삭제해야 FK 위반이 발생하지 않는다
  console.log('Deleting existing data...');
  await prisma.auditLog.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  const deletedVouchers = await prisma.voucherCode.deleteMany({});
  console.log(`  - Deleted ${deletedVouchers.count} voucher codes`);
  const deletedGifts = await prisma.gift.deleteMany({});
  console.log(`  - Deleted ${deletedGifts.count} gifts`);
  const deletedOrderItems = await prisma.orderItem.deleteMany({});
  console.log(`  - Deleted ${deletedOrderItems.count} order items`);
  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`  - Deleted ${deletedOrders.count} orders`);
  const deletedCartItems = await prisma.cartItem.deleteMany({});
  console.log(`  - Deleted ${deletedCartItems.count} cart items`);
  const deletedTradeIns = await prisma.tradeIn.deleteMany({});
  console.log(`  - Deleted ${deletedTradeIns.count} trade-ins`);
  const deletedProducts = await prisma.product.deleteMany({});
  console.log(`  - Deleted ${deletedProducts.count} products`);
  const deletedBrands = await prisma.brand.deleteMany({});
  console.log(`  - Deleted ${deletedBrands.count} brands`);
  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`  - Deleted ${deletedUsers.count} users`);
  await prisma.siteConfig.deleteMany({});
  await prisma.notice.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.faq.deleteMany({});
  console.log('✓ Existing data deleted');

  // ============================================================================
  // 브랜드 마스터 데이터 (PIN 설정 포함)
  // ============================================================================
  // 각 브랜드마다 PIN 길이, 구분 패턴, 보안코드 유무 등이 다르다
  // 프론트엔드 매입 폼에서 pinConfig를 읽어 입력 필드를 동적 생성한다
  const brands = [
    {
      code: 'HYUNDAI',
      name: '현대',
      color: '#00703C',
      order: 1,
      description: '현대백화점 전 지점에서 사용 가능',
      imageUrl: '/images/brands/hyundai.jpg',
      isActive: true,
      pinConfig: JSON.stringify({
        pinLength: 16,
        pinPattern: [4, 4, 4, 4],
        hasSecurityCode: true,
        securityCodeLength: 4,
        hasGiftNumber: false,
        labels: { pin: 'PIN 번호', securityCode: '보안코드' },
      }),
    },
    {
      code: 'SHINSEGAE',
      name: '신세계',
      color: '#E31837',
      order: 2,
      description: '신세계백화점 전 지점에서 사용 가능',
      imageUrl: '/images/brands/shinsegae.jpg',
      isActive: true,
      pinConfig: JSON.stringify({
        pinLength: 6,
        pinPattern: [6],
        hasSecurityCode: true,
        securityCodeLength: 3,
        hasGiftNumber: true,
        giftNumberLength: 13,
        labels: {
          pin: 'PIN 번호',
          securityCode: '보안코드',
          giftNumber: '권번호',
        },
      }),
    },
    {
      code: 'LOTTE',
      name: '롯데',
      color: '#ED1C24',
      order: 3,
      description: '롯데백화점, 롯데마트에서 사용 가능',
      imageUrl: '/images/brands/lotte.png',
      isActive: true,
      pinConfig: JSON.stringify({
        pinLength: 16,
        pinPattern: [4, 4, 4, 4],
        hasSecurityCode: false,
        hasGiftNumber: false,
        labels: { pin: 'PIN 번호' },
      }),
    },
    {
      code: 'WGIFT',
      name: 'W상품권',
      color: '#6366F1',
      order: 4,
      description: '씨드림기프트 자체 상품권',
      imageUrl: null, // No image yet
      isActive: true,
      pinConfig: JSON.stringify({
        pinLength: 16,
        pinPattern: [4, 4, 4, 4],
        hasSecurityCode: false,
        hasGiftNumber: false,
        labels: { pin: 'PIN 번호' },
      }),
    },
    {
      code: 'DAISO',
      name: '다이소',
      color: '#FF6B00',
      order: 5,
      description: '다이소 전국 매장에서 사용 가능',
      imageUrl: '/images/brands/daiso.jpg',
      isActive: true,
      pinConfig: JSON.stringify({
        pinLength: 12,
        pinPattern: [4, 4, 4],
        hasSecurityCode: false,
        hasGiftNumber: false,
        labels: { pin: 'PIN 번호' },
      }),
    },
    {
      code: 'CU',
      name: 'CU',
      color: '#00A651',
      order: 6,
      description: 'CU 편의점 전국 매장에서 사용 가능',
      imageUrl: null, // No image yet
      isActive: true,
      pinConfig: JSON.stringify({
        pinLength: 12,
        pinPattern: [4, 4, 4],
        allowedLengths: [12, 16],
        hasSecurityCode: false,
        hasGiftNumber: false,
        labels: { pin: 'PIN 번호' },
      }),
    },
  ];

  for (const b of brands) {
    await prisma.brand.create({ data: b });
  }
  console.log(`✓ Created ${brands.length} brands`);

  // ============================================================================
  // 사용자 시드 (ADMIN, USER, PARTNER)
  // ============================================================================
  // 테스트 비밀번호: 일반 사용자 test1234, 관리자 admin1234
  const userPassword = await bcrypt.hash('test1234', 10);
  const adminPassword = await bcrypt.hash('admin1234', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Super Admin',
      phone: '010-0000-0000',
      password: adminPassword,
      role: 'ADMIN',
      kycStatus: 'VERIFIED',
    },
  });
  console.log('✓ Admin User created: admin@example.com / admin1234');

  const user1 = await prisma.user.create({
    data: {
      email: 'user@example.com',
      name: '홍길동',
      phone: '010-1234-5678',
      password: userPassword,
      role: 'USER',
      kycStatus: 'VERIFIED',
    },
  });
  console.log('✓ User1 created: user@example.com / test1234');

  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      name: '김선물',
      phone: '010-2345-6789',
      password: userPassword,
      role: 'USER',
      kycStatus: 'VERIFIED',
    },
  });
  console.log('✓ User2 created: user2@example.com / test1234');

  const partnerUser = await prisma.user.create({
    data: {
      email: 'partner@example.com',
      name: '파트너상사',
      phone: '010-9876-5432',
      password: userPassword,
      role: 'PARTNER',
      kycStatus: 'VERIFIED',
    },
  });
  console.log('✓ Partner created: partner@example.com / test1234');

  // ============================================================================
  // 상품(권종) 시드 - PRD 요구사항에 맞는 브랜드별 권종 구성
  // ============================================================================
  // buyPrice는 price * (1 - discountRate/100) 공식으로 자동 계산
  // tradeInRate는 매입 시 적용되는 수수료율
  const products = [
    // 현대: 1만, 5만, 10만, 50만
    {
      brandCode: 'HYUNDAI',
      name: '현대백화점 상품권 1만원',
      price: 10000,
      discountRate: 2,
      tradeInRate: 5,
    },
    {
      brandCode: 'HYUNDAI',
      name: '현대백화점 상품권 5만원',
      price: 50000,
      discountRate: 2.5,
      tradeInRate: 5,
    },
    {
      brandCode: 'HYUNDAI',
      name: '현대백화점 상품권 10만원',
      price: 100000,
      discountRate: 3,
      tradeInRate: 5,
    },
    {
      brandCode: 'HYUNDAI',
      name: '현대백화점 상품권 50만원',
      price: 500000,
      discountRate: 3.5,
      tradeInRate: 5,
    },

    // 신세계: 1만, 5만, 10만, 30만, 50만
    {
      brandCode: 'SHINSEGAE',
      name: '신세계 상품권 1만원',
      price: 10000,
      discountRate: 2,
      tradeInRate: 5,
    },
    {
      brandCode: 'SHINSEGAE',
      name: '신세계 상품권 5만원',
      price: 50000,
      discountRate: 2.5,
      tradeInRate: 5,
    },
    {
      brandCode: 'SHINSEGAE',
      name: '신세계 상품권 10만원',
      price: 100000,
      discountRate: 3,
      tradeInRate: 5,
    },
    {
      brandCode: 'SHINSEGAE',
      name: '신세계 상품권 30만원',
      price: 300000,
      discountRate: 3.2,
      tradeInRate: 5,
    },
    {
      brandCode: 'SHINSEGAE',
      name: '신세계 상품권 50만원',
      price: 500000,
      discountRate: 3.5,
      tradeInRate: 5,
    },

    // 롯데: 1만, 3만, 5만, 10만, 30만, 50만
    {
      brandCode: 'LOTTE',
      name: '롯데 상품권 1만원',
      price: 10000,
      discountRate: 2,
      tradeInRate: 4,
    },
    {
      brandCode: 'LOTTE',
      name: '롯데 상품권 3만원',
      price: 30000,
      discountRate: 2.2,
      tradeInRate: 4,
    },
    {
      brandCode: 'LOTTE',
      name: '롯데 상품권 5만원',
      price: 50000,
      discountRate: 2.5,
      tradeInRate: 4,
    },
    {
      brandCode: 'LOTTE',
      name: '롯데 상품권 10만원',
      price: 100000,
      discountRate: 3,
      tradeInRate: 4,
    },
    {
      brandCode: 'LOTTE',
      name: '롯데 상품권 30만원',
      price: 300000,
      discountRate: 3.2,
      tradeInRate: 4,
    },
    {
      brandCode: 'LOTTE',
      name: '롯데 상품권 50만원',
      price: 500000,
      discountRate: 3.5,
      tradeInRate: 4,
    },

    // W상품권: 1만
    {
      brandCode: 'WGIFT',
      name: 'W상품권 1만원',
      price: 10000,
      discountRate: 1,
      tradeInRate: 3,
    },

    // 다이소: 1천, 5천, 1만
    {
      brandCode: 'DAISO',
      name: '다이소 상품권 1천원',
      price: 1000,
      discountRate: 1,
      tradeInRate: 3,
    },
    {
      brandCode: 'DAISO',
      name: '다이소 상품권 5천원',
      price: 5000,
      discountRate: 1.5,
      tradeInRate: 3,
    },
    {
      brandCode: 'DAISO',
      name: '다이소 상품권 1만원',
      price: 10000,
      discountRate: 2,
      tradeInRate: 3,
    },

    // CU: 1천, 5천, 1만
    {
      brandCode: 'CU',
      name: 'CU 상품권 1천원',
      price: 1000,
      discountRate: 1,
      tradeInRate: 3,
    },
    {
      brandCode: 'CU',
      name: 'CU 상품권 5천원',
      price: 5000,
      discountRate: 1.5,
      tradeInRate: 3,
    },
    {
      brandCode: 'CU',
      name: 'CU 상품권 1만원',
      price: 10000,
      discountRate: 2,
      tradeInRate: 3,
    },
  ];

  let created = 0;
  let existed = 0;
  for (const p of products) {
    const buyPrice = Math.round(p.price * (1 - p.discountRate / 100));
    try {
      await prisma.product.create({
        data: {
          brandCode: p.brandCode,
          name: p.name,
          price: p.price,
          discountRate: p.discountRate,
          buyPrice: buyPrice,
          tradeInRate: p.tradeInRate,
          allowTradeIn: true,
          isActive: true,
        },
      });
      created++;
    } catch (e: unknown) {
      // P2002 = unique constraint violation (product already exists)
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
        existed++;
      } else {
        throw e;
      }
    }
  }
  console.log(`✓ Products: ${created} created, ${existed} already existed`);

  // ============================================================================
  // 사이트 설정 (SiteConfig)
  // ============================================================================
  const configs = [
    {
      key: 'GLOBAL_LIMIT_PER_DAY',
      value: '10000000',
      type: 'NUMBER',
      description: '일일 글로벌 구매 한도 (원)',
    },
    {
      key: 'NOTICE_BANNER',
      value: '{"text":"설 연휴 배송 안내","link":"/notice/1"}',
      type: 'JSON',
      description: '메인 배너 공지',
    },
    {
      key: 'PAYMENT_BANK_NAME',
      value: '신한은행',
      type: 'STRING',
      description: '무통장입금 은행명',
    },
    {
      key: 'PAYMENT_BANK_ACCOUNT',
      value: '110-123-456789',
      type: 'STRING',
      description: '무통장입금 계좌번호',
    },
    {
      key: 'PAYMENT_BANK_HOLDER',
      value: '주식회사 더블유에이아이씨',
      type: 'STRING',
      description: '무통장입금 예금주',
    },
  ];

  for (const c of configs) {
    try {
      await prisma.siteConfig.upsert({
        where: { key: c.key },
        update: {},
        create: c,
      });
    } catch (e) {
      console.error(`Failed to seed config ${c.key}:`, e);
    }
  }
  console.log('✓ Site Configs seeded');

  // ============================================================================
  // 공지사항 시드
  // ============================================================================
  const notices = [
    {
      title: '씨드림기프트 서비스 정식 오픈 안내',
      content:
        '안녕하세요, 씨드림기프트입니다.\n\n상품권 구매 및 매입 서비스가 정식 오픈되었습니다. 신세계, 현대, 롯데, 다이소, 올리브영 상품권을 가장 저렴하게 구매하고, 보유한 상품권을 최고가에 판매해보세요.\n\n많은 이용 부탁드립니다.',
      isActive: true,
      viewCount: 120,
      createdAt: new Date('2025-01-29T09:00:00'),
    },
    {
      title: '[이벤트] 첫 구매 회원 5% 추가 할인',
      content:
        '씨드림기프트에서 처음 상품권을 구매하시는 회원님께 5% 추가 할인을 드립니다!\n\n- 기간: 2025.01.29 ~ 2025.02.28\n- 대상: 첫 구매 회원\n- 혜택: 결제 금액 5% 즉시 할인\n\n많은 참여 부탁드립니다.',
      isActive: true,
      viewCount: 450,
      createdAt: new Date('2025-01-29T10:00:00'),
    },
    {
      title: '시스템 정기 점검 안내 (2/5)',
      content:
        '안녕하세요. 씨드림기프트입니다.\n\n안정적인 서비스 제공을 위해 시스템 정기 점검이 진행될 예정입니다.\n\n- 일시: 2025년 2월 5일 (수) 02:00 ~ 04:00 (2시간)\n- 내용: 서버 안정화 및 보안 업데이트\n\n점검 시간 동안 서비스 이용이 제한되오니 양해 부탁드립니다.',
      isActive: true,
      viewCount: 80,
      createdAt: new Date('2025-02-01T14:00:00'),
    },
    {
      title: '[업데이트] 개인정보처리방침 개정 안내',
      content:
        '개인정보처리방침이 일부 개정되었습니다.\n\n주요 변경 내용:\n- 개인정보 보유 기간 명확화\n- 제3자 제공 동의 항목 추가\n\n시행일: 2025.02.01\n\n자세한 내용은 개인정보처리방침 페이지에서 확인해주세요.',
      isActive: true,
      viewCount: 55,
      createdAt: new Date('2025-01-20T11:30:00'),
    },
    {
      title: '설 연휴 배송 및 고객센터 운영 안내',
      content:
        '설 연휴 기간 동안 상품권 PIN 발급은 24시간 정상적으로 자동 발급됩니다.\n\n단, 매입 관련 입금 및 고객센터 상담 업무는 연휴 후 순차 처리될 예정입니다.\n\n- 연휴 기간: 2025.01.28 ~ 2025.01.30\n- PIN 발급: 정상 운영 (자동)\n- 매입 입금: 1/31(금)부터 순차 처리\n\n새해 복 많이 받으세요.',
      isActive: false, // 지난 공지
      viewCount: 210,
      createdAt: new Date('2025-01-25T09:00:00'),
    },
  ];

  console.log('Seeding Notices...');
  for (const n of notices) {
    await prisma.notice.create({ data: n });
  }
  console.log(`✓ Notices: ${notices.length} created`);

  // ============================================================================
  // 이벤트 시드
  // ============================================================================
  const events = [
    {
      title: '설 맞이 상품권 할인 대축제',
      description:
        '새해를 맞아 전 상품권 최대 5% 추가 할인! 신세계, 현대, 롯데 백화점 상품권을 특별 가격에 만나보세요.',
      imageUrl: null,
      startDate: new Date('2025-01-20'),
      endDate: new Date('2025-02-15'),
      isActive: true,
      isFeatured: true,
      viewCount: 1250,
    },
    {
      title: '첫 구매 회원 특별 혜택',
      description:
        '씨드림기프트에서 처음 상품권을 구매하시는 회원님께 5% 추가 할인을 드립니다. 지금 바로 가입하고 혜택을 받아보세요!',
      imageUrl: null,
      startDate: new Date('2025-01-29'),
      endDate: new Date('2025-02-28'),
      isActive: true,
      isFeatured: false,
      viewCount: 890,
    },
    {
      title: '매입 수수료 0원 이벤트',
      description:
        '보유하신 상품권을 씨드림기프트에서 매입하시면 수수료 0원! 최고가 매입 보장.',
      imageUrl: null,
      startDate: new Date('2025-02-01'),
      endDate: new Date('2025-02-20'),
      isActive: true,
      isFeatured: false,
      viewCount: 560,
    },
    {
      title: '친구 초대 이벤트',
      description:
        '친구를 초대하면 나도 친구도 5,000원 상품권 증정! 초대할수록 혜택이 쌓입니다.',
      imageUrl: null,
      startDate: new Date('2025-02-10'),
      endDate: new Date('2025-03-10'),
      isActive: true,
      isFeatured: false,
      viewCount: 320,
    },
    {
      title: '크리스마스 특별 할인 (종료)',
      description:
        '연말 크리스마스 시즌을 맞아 진행되었던 특별 할인 이벤트입니다.',
      imageUrl: null,
      startDate: new Date('2024-12-20'),
      endDate: new Date('2024-12-31'),
      isActive: true,
      isFeatured: false,
      viewCount: 2100,
    },
  ];

  console.log('Seeding Events...');
  for (const e of events) {
    await prisma.event.create({ data: e });
  }
  console.log(`✓ Events: ${events.length} created`);

  // ============================================================================
  // FAQ 시드 (카테고리별: PAYMENT, GENERAL, TRADE_IN, ACCOUNT, SHIPPING)
  // ============================================================================
  const faqs = [
    // PAYMENT 카테고리
    {
      question: '결제 수단은 어떤 것이 있나요?',
      answer:
        '씨드림기프트에서는 다음 결제 수단을 지원합니다:\n\n• 신용카드 (국내 모든 카드사)\n• 계좌이체 (실시간)\n• 무통장입금\n• 카카오페이, 네이버페이\n\n결제 수단에 따라 추가 할인 혜택이 적용될 수 있습니다.',
      category: 'PAYMENT',
      order: 1,
      isActive: true,
      helpfulCount: 45,
    },
    {
      question: '환불은 어떻게 신청하나요?',
      answer:
        '환불 신청 방법:\n\n1. 마이페이지 > 주문내역에서 환불 신청\n2. 미사용 상품권만 환불 가능\n3. 결제 후 7일 이내 신청 가능\n\n환불 처리는 신청 후 1-3영업일 소요되며, 원 결제 수단으로 환불됩니다.',
      category: 'PAYMENT',
      order: 2,
      isActive: true,
      helpfulCount: 38,
    },
    // GENERAL 카테고리
    {
      question: '상품권 구매 후 PIN 번호는 어디서 확인하나요?',
      answer:
        '구매한 상품권의 PIN 번호는 다음 방법으로 확인 가능합니다:\n\n• 마이페이지 > 구매내역 > 상세보기\n• 결제 완료 후 발송되는 이메일\n• 알림톡 (카카오톡)\n\nPIN 번호는 보안을 위해 일부 가려져 표시되며, 전체 확인 시 본인인증이 필요합니다.',
      category: 'GENERAL',
      order: 1,
      isActive: true,
      helpfulCount: 120,
    },
    {
      question: '구매한 상품권의 유효기간은 어떻게 되나요?',
      answer:
        '상품권 유효기간:\n\n• 신세계: 발행일로부터 5년\n• 현대: 발행일로부터 5년\n• 롯데: 발행일로부터 5년\n• 다이소: 발행일로부터 5년\n\n유효기간 만료 전 사용하시기 바랍니다.',
      category: 'GENERAL',
      order: 2,
      isActive: true,
      helpfulCount: 85,
    },
    // TRADE_IN 카테고리
    {
      question: '상품권 매입 신청은 어떻게 하나요?',
      answer:
        '상품권 매입 신청 방법:\n\n1. 매입하기 페이지 접속\n2. 상품권 종류 및 권종 선택\n3. PIN 번호 입력\n4. 입금받을 계좌 정보 입력\n5. 매입 신청 완료\n\n매입 금액은 신청 후 24시간 이내 입금됩니다.',
      category: 'TRADE_IN',
      order: 1,
      isActive: true,
      helpfulCount: 92,
    },
    {
      question: '매입 수수료는 얼마인가요?',
      answer:
        '매입 수수료는 상품권 종류와 권종에 따라 다릅니다.\n\n• 신세계/현대/롯데: 액면가의 3-5%\n• 다이소/CU: 액면가의 5-7%\n\n정확한 매입가는 매입하기 페이지에서 실시간으로 확인하실 수 있습니다.',
      category: 'TRADE_IN',
      order: 2,
      isActive: true,
      helpfulCount: 67,
    },
    // ACCOUNT 카테고리
    {
      question: '회원가입 시 본인인증이 필요한가요?',
      answer:
        '네, 안전한 거래를 위해 본인인증이 필요합니다.\n\n• 휴대폰 본인인증\n• 만 14세 이상 가입 가능\n\n본인인증 완료 후 모든 서비스 이용이 가능합니다.',
      category: 'ACCOUNT',
      order: 1,
      isActive: true,
      helpfulCount: 33,
    },
    {
      question: '비밀번호를 잊어버렸어요',
      answer:
        '비밀번호 찾기 방법:\n\n1. 로그인 페이지에서 "비밀번호 찾기" 클릭\n2. 가입 시 등록한 이메일 입력\n3. 이메일로 발송된 링크 클릭\n4. 새 비밀번호 설정\n\n이메일을 받지 못한 경우 스팸함을 확인해주세요.',
      category: 'ACCOUNT',
      order: 2,
      isActive: true,
      helpfulCount: 28,
    },
    // SHIPPING 카테고리
    {
      question: '상품권은 실물 배송되나요?',
      answer:
        '아니요, 씨드림기프트에서 판매하는 상품권은 모두 모바일 상품권(PIN 번호)입니다.\n\n• 결제 완료 즉시 PIN 번호 발급\n• 마이페이지에서 즉시 확인 가능\n• 별도 배송 없음\n\n실물 상품권이 필요하신 경우 백화점 고객센터에 문의해주세요.',
      category: 'SHIPPING',
      order: 1,
      isActive: true,
      helpfulCount: 55,
    },
    {
      question: 'PIN 번호 발급이 지연되고 있어요',
      answer:
        'PIN 번호는 결제 완료 후 즉시 발급됩니다.\n\n발급이 지연되는 경우:\n• 결제 승인 대기 중일 수 있습니다\n• 무통장입금의 경우 입금 확인 후 발급\n\n10분 이상 지연 시 고객센터(1544-0000)로 문의해주세요.',
      category: 'SHIPPING',
      order: 2,
      isActive: true,
      helpfulCount: 41,
    },
  ];

  console.log('Seeding FAQs...');
  for (const f of faqs) {
    await prisma.faq.create({ data: f });
  }
  console.log(`✓ FAQs: ${faqs.length} created`);

  // ============================================================================
  // 트랜잭션 시드 데이터 (주문, 바우처, 선물, 매입)
  // ============================================================================
  // 실제 거래 흐름을 재현하여 마이페이지, 관리자 대시보드 등에서 바로 확인 가능하도록 구성

  // 주문/매입 시드에서 참조할 상품을 미리 조회
  const hyundai50k = await prisma.product.findFirst({
    where: { brandCode: 'HYUNDAI', price: 50000 },
  });
  const shinsegae100k = await prisma.product.findFirst({
    where: { brandCode: 'SHINSEGAE', price: 100000 },
  });
  const lotte10k = await prisma.product.findFirst({
    where: { brandCode: 'LOTTE', price: 10000 },
  });
  const lotte50k = await prisma.product.findFirst({
    where: { brandCode: 'LOTTE', price: 50000 },
  });

  if (!hyundai50k || !shinsegae100k || !lotte10k || !lotte50k) {
    console.error('Required products not found for transactional seed data');
    return;
  }

  // --- Order 1: user1, DELIVERED, 현대 5만원 x2 ---
  const order1 = await prisma.order.create({
    data: {
      userId: user1.id,
      totalAmount: 97500, // 50000*2 * (1-2.5%) = 97500
      status: 'DELIVERED',
      paymentMethod: 'CARD',
      createdAt: new Date('2025-01-20T10:30:00'),
      items: {
        create: [{ productId: hyundai50k.id, quantity: 2, price: 48750 }],
      },
    },
  });
  // Vouchers for order1
  const pin1 = '1234-5678-9012-3456';
  const pin2 = '2345-6789-0123-4567';
  await prisma.voucherCode.create({
    data: {
      productId: hyundai50k.id,
      pinCode: encrypt(pin1),
      pinHash: hash(pin1),
      status: 'SOLD',
      orderId: order1.id,
      soldAt: new Date('2025-01-20T10:30:00'),
    },
  });
  await prisma.voucherCode.create({
    data: {
      productId: hyundai50k.id,
      pinCode: encrypt(pin2),
      pinHash: hash(pin2),
      status: 'SOLD',
      orderId: order1.id,
      soldAt: new Date('2025-01-20T10:30:00'),
    },
  });
  console.log('✓ Order 1 (DELIVERED) + 2 vouchers created');

  // --- Order 2: user1, PAID, 신세계 10만원 x1 ---
  const order2 = await prisma.order.create({
    data: {
      userId: user1.id,
      totalAmount: 97000, // 100000 * (1-3%) = 97000
      status: 'PAID',
      paymentMethod: 'BANK',
      createdAt: new Date('2025-01-25T14:00:00'),
      items: {
        create: [{ productId: shinsegae100k.id, quantity: 1, price: 97000 }],
      },
    },
  });
  const pin3 = '3456-7890-1234-5678';
  await prisma.voucherCode.create({
    data: {
      productId: shinsegae100k.id,
      pinCode: encrypt(pin3),
      pinHash: hash(pin3),
      status: 'SOLD',
      orderId: order2.id,
      soldAt: new Date('2025-01-25T14:00:00'),
    },
  });
  console.log('✓ Order 2 (PAID) + 1 voucher created');

  // --- Order 3: user1, CANCELLED, 롯데 1만원 x1 ---
  await prisma.order.create({
    data: {
      userId: user1.id,
      totalAmount: 9800, // 10000 * (1-2%) = 9800
      status: 'CANCELLED',
      paymentMethod: 'CARD',
      createdAt: new Date('2025-01-28T09:00:00'),
      items: {
        create: [{ productId: lotte10k.id, quantity: 1, price: 9800 }],
      },
    },
  });
  console.log('✓ Order 3 (CANCELLED) created');

  // --- Gift: user2 → user1 (롯데 5만원) ---
  const giftOrder = await prisma.order.create({
    data: {
      userId: user2.id,
      totalAmount: 48750, // 50000 * (1-2.5%) = 48750
      status: 'DELIVERED',
      paymentMethod: 'CARD',
      createdAt: new Date('2025-01-22T16:00:00'),
      items: {
        create: [{ productId: lotte50k.id, quantity: 1, price: 48750 }],
      },
    },
  });
  const giftPin = '9876-5432-1098-7654';
  await prisma.voucherCode.create({
    data: {
      productId: lotte50k.id,
      pinCode: encrypt(giftPin),
      pinHash: hash(giftPin),
      status: 'SOLD',
      orderId: giftOrder.id,
      soldAt: new Date('2025-01-22T16:00:00'),
    },
  });
  await prisma.gift.create({
    data: {
      senderId: user2.id,
      receiverId: user1.id,
      orderId: giftOrder.id,
    },
  });
  console.log('✓ Gift (user2 → user1) + order + voucher created');

  // --- 매입(Trade-In) 시드: user1의 다양한 상태 매입 건 ---
  // TradeIn 1: REQUESTED, 현대 5만원
  const tiPin1 = '1111-2222-3333-4444';
  const tiAcct1 = '110-123-456789';
  await prisma.tradeIn.create({
    data: {
      userId: user1.id,
      productId: hyundai50k.id,
      productBrand: 'HYUNDAI',
      productName: '현대백화점 상품권 5만원',
      productPrice: 50000,
      pinCode: encrypt(tiPin1),
      pinHash: hash(tiPin1),
      bankName: '국민은행',
      accountNum: encrypt(tiAcct1),
      accountHolder: '홍길동',
      payoutAmount: 47500, // 50000 * (1-5%) = 47500
      status: 'REQUESTED',
      createdAt: new Date('2025-01-30T11:00:00'),
    },
  });

  // TradeIn 2: VERIFIED, 신세계 10만원
  const tiPin2 = '5555-6666-7777-8888';
  const tiAcct2 = '110-987-654321';
  await prisma.tradeIn.create({
    data: {
      userId: user1.id,
      productId: shinsegae100k.id,
      productBrand: 'SHINSEGAE',
      productName: '신세계 상품권 10만원',
      productPrice: 100000,
      pinCode: encrypt(tiPin2),
      pinHash: hash(tiPin2),
      bankName: '신한은행',
      accountNum: encrypt(tiAcct2),
      accountHolder: '홍길동',
      payoutAmount: 95000, // 100000 * (1-5%) = 95000
      status: 'VERIFIED',
      createdAt: new Date('2025-01-27T15:30:00'),
    },
  });

  // TradeIn 3: PAID, 롯데 5만원
  const tiPin3 = '9999-0000-1111-2222';
  const tiAcct3 = '352-0123-4567-01';
  await prisma.tradeIn.create({
    data: {
      userId: user1.id,
      productId: lotte50k.id,
      productBrand: 'LOTTE',
      productName: '롯데 상품권 5만원',
      productPrice: 50000,
      pinCode: encrypt(tiPin3),
      pinHash: hash(tiPin3),
      bankName: '우리은행',
      accountNum: encrypt(tiAcct3),
      accountHolder: '홍길동',
      payoutAmount: 48000, // 50000 * (1-4%) = 48000
      status: 'PAID',
      createdAt: new Date('2025-01-15T09:00:00'),
    },
  });
  console.log('✓ Trade-Ins: 3 created (REQUESTED, VERIFIED, PAID)');

  // 미판매 바우처 (재고) - 구매 테스트 시 할당 가능한 AVAILABLE 상태
  const avPin1 = 'AVAIL-1234-5678-9012';
  const avPin2 = 'AVAIL-2345-6789-0123';
  await prisma.voucherCode.create({
    data: {
      productId: hyundai50k.id,
      pinCode: encrypt(avPin1),
      pinHash: hash(avPin1),
      status: 'AVAILABLE',
    },
  });
  await prisma.voucherCode.create({
    data: {
      productId: shinsegae100k.id,
      pinCode: encrypt(avPin2),
      pinHash: hash(avPin2),
      status: 'AVAILABLE',
    },
  });
  console.log('✓ Available vouchers: 2 created');

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
