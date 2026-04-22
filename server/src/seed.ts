import * as crypto from 'crypto';
import { cpus } from 'os';
import * as path from 'path';

import { PrismaMssql } from '@prisma/adapter-mssql';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

import { PrismaClient } from './shared/prisma/generated/client';

// Load .env
dotenv.config({ path: path.join(process.cwd(), '.env'), override: true });

// AES-256 encrypt helper (standalone, no NestJS DI)
function encrypt(text: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function parseDatabaseUrl(url: string) {
  const match = url.match(
    /sqlserver:\/\/([^:]+):(\d+);database=([^;]+);user=([^;]+);password=([^;]+)/,
  );
  if (!match) return null;
  return {
    server: match[1],
    port: parseInt(match[2], 10),
    database: match[3],
    user: match[4],
    password: match[5],
    options: { encrypt: true, trustServerCertificate: true },
    pool: { min: 2, max: Math.max(cpus().length * 2 + 1, 5) },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'FATAL: seed.ts must NOT run in production (destructive deleteMany)',
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL || '';
  const config = parseDatabaseUrl(dbUrl);
  if (!config) throw new Error('DATABASE_URL is missing or invalid');

  const adapter = new PrismaMssql(config);
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();
  console.log('Seeding (direct PrismaClient)...');

  try {
    // ============================================
    // 1. Cleanup (FK 의존성 역순)
    // ============================================
    console.log('Deleting existing data...');
    await prisma.voucherCode.deleteMany({});
    await prisma.gift.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.tradeIn.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.notice.deleteMany({});
    await prisma.faq.deleteMany({});
    await prisma.event.deleteMany({});
    console.log('✓ Cleanup complete');

    // ============================================
    // 2. Users
    // ============================================
    const adminPassword = await bcrypt.hash('admin1234', 10);
    const userPassword = await bcrypt.hash('Password123!', 10);

    let admin: any;
    try {
      admin = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          name: '관리자',
          password: adminPassword,
          role: 'ADMIN',
          kycStatus: 'VERIFIED',
          phone: '010-0000-0000',
        },
      });
      console.log('✓ Admin created');
    } catch (e: any) {
      if (e.code === 'P2002') {
        admin = await prisma.user.findUnique({
          where: { email: 'admin@example.com' },
        });
        console.log('✓ Admin already exists');
      } else throw e;
    }

    // E2E 테스트 표준 사용자
    const testUsers = [
      {
        email: 'user@example.com',
        name: '테스트 사용자',
        phone: '010-0000-0001',
        role: 'USER',
      },
      {
        email: 'partner@example.com',
        name: '테스트 파트너',
        phone: '010-0000-0002',
        role: 'PARTNER',
      },
    ];
    const testPassword = await bcrypt.hash('test1234', 10);

    for (const tu of testUsers) {
      try {
        await prisma.user.create({
          data: { ...tu, password: testPassword, kycStatus: 'VERIFIED' },
        });
        console.log(`✓ Test user created: ${tu.email}`);
      } catch (e: any) {
        if (e.code === 'P2002') console.log(`✓ ${tu.email} already exists`);
        else throw e;
      }
    }

    const userSeeds = [
      { email: 'buyer@test.com', name: '김민현', phone: '010-1234-5678' },
      { email: 'seller@test.com', name: '이지수', phone: '010-2345-6789' },
      { email: 'user3@test.com', name: '박서진', phone: '010-3456-7890' },
      { email: 'user4@test.com', name: '최도영', phone: '010-4567-8901' },
      { email: 'user5@test.com', name: '정승호', phone: '010-5678-9012' },
      { email: 'user6@test.com', name: '강수민', phone: '010-6789-0123' },
      { email: 'user7@test.com', name: '조예서', phone: '010-7890-1234' },
      { email: 'user8@test.com', name: '윤하아', phone: '010-8901-2345' },
      { email: 'user9@test.com', name: '장준혁', phone: '010-9012-3456' },
      { email: 'user10@test.com', name: '임소희', phone: '010-0123-4567' },
    ];

    const users: any[] = [];
    for (const u of userSeeds) {
      try {
        const user = await prisma.user.create({
          data: {
            email: u.email,
            name: u.name,
            password: userPassword,
            role: 'USER',
            kycStatus: 'VERIFIED',
            phone: u.phone,
          },
        });
        users.push(user);
      } catch (e: any) {
        if (e.code === 'P2002') {
          const existing = await prisma.user.findUnique({
            where: { email: u.email },
          });
          if (existing) users.push(existing);
        } else throw e;
      }
    }
    console.log(`✓ ${users.length} users seeded`);

    // ============================================
    // 3. Brands (브랜드 마스터)
    // ============================================
    const brandSeeds = [
      {
        code: 'SHINSEGAE',
        name: '신세계',
        color: '#E31837',
        order: 1,
        description: '신세계백화점 전 지점에서 사용 가능',
        imageUrl: '/images/brands/shinsegae.svg',
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
        code: 'HYUNDAI',
        name: '현대',
        color: '#00703C',
        order: 2,
        description: '현대백화점 전 지점에서 사용 가능',
        imageUrl: '/images/brands/hyundai.svg',
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
        code: 'LOTTE',
        name: '롯데',
        color: '#ED1C24',
        order: 3,
        description: '롯데백화점, 롯데마트에서 사용 가능',
        imageUrl: '/images/brands/lotte.svg',
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
        order: 4,
        description: '다이소 전국 매장에서 사용 가능',
        imageUrl: '/images/brands/daiso.svg',
        pinConfig: JSON.stringify({
          pinLength: 16,
          pinPattern: [4, 4, 4, 4],
          hasSecurityCode: false,
          hasGiftNumber: false,
          labels: { pin: 'PIN 번호' },
        }),
      },
      {
        code: 'CU',
        name: 'CU',
        color: '#00A651',
        order: 5,
        description: 'CU 편의점 전국 매장에서 사용 가능',
        imageUrl: '/images/brands/cu.svg',
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
        order: 6,
        description: '씨드림기프트 자체 상품권',
        imageUrl: '/images/brands/wgift.svg',
        pinConfig: JSON.stringify({
          pinLength: 16,
          pinPattern: [4, 4, 4, 4],
          hasSecurityCode: false,
          hasGiftNumber: false,
          labels: { pin: 'PIN 번호' },
        }),
      },
      {
        code: 'EX',
        name: '이엑스',
        color: '#8B5CF6',
        order: 7,
        description: '이엑스 모바일 상품권',
        imageUrl: '/images/brands/ex.svg',
        pinConfig: JSON.stringify({
          pinLength: 16,
          pinPattern: [16],
          pinAlphanumeric: true,
          hasSecurityCode: false,
          hasGiftNumber: true,
          giftNumberPattern: [3, 4, 5],
          labels: {
            pin: '인증코드',
            giftNumber: '카드번호',
          },
        }),
      },
    ];

    for (const b of brandSeeds) {
      await prisma.brand.upsert({
        where: { code: b.code },
        update: {
          name: b.name,
          color: b.color,
          order: b.order,
          description: b.description,
          imageUrl: b.imageUrl,
          pinConfig: b.pinConfig,
        },
        create: {
          code: b.code,
          name: b.name,
          color: b.color,
          order: b.order,
          description: b.description,
          imageUrl: b.imageUrl,
          pinConfig: b.pinConfig,
          isActive: true,
        },
      });
    }
    console.log(`✓ ${brandSeeds.length} brands seeded`);

    // ============================================
    // 4. Products
    // ============================================
    // 상품권 가격.txt 기준 상품 데이터
    // discountRate = 고객구매가 할인율 (우리가 파는 가격), tradeInRate = 고객판매가 할인율 (우리가 사는 가격)
    const productSeeds = [
      // ── 신세계 (pin13) ──
      {
        brandCode: 'SHINSEGAE',
        name: '신세계백화점 5천원권',
        price: 5000,
        discountRate: 1.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'SHINSEGAE',
        name: '신세계백화점 1만원권',
        price: 10000,
        discountRate: 1.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'SHINSEGAE',
        name: '신세계백화점 5만원권',
        price: 50000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      {
        brandCode: 'SHINSEGAE',
        name: '신세계백화점 10만원권',
        price: 100000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      {
        brandCode: 'SHINSEGAE',
        name: '신세계백화점 50만원권',
        price: 500000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      // ── 롯데 (pin16) ──
      {
        brandCode: 'LOTTE',
        name: '롯데백화점 5천원권',
        price: 5000,
        discountRate: 1.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'LOTTE',
        name: '롯데백화점 1만원권',
        price: 10000,
        discountRate: 1.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'LOTTE',
        name: '롯데백화점 3만원권',
        price: 30000,
        discountRate: 1.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'LOTTE',
        name: '롯데백화점 5만원권',
        price: 50000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      {
        brandCode: 'LOTTE',
        name: '롯데백화점 10만원권',
        price: 100000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      {
        brandCode: 'LOTTE',
        name: '롯데백화점 50만원권',
        price: 500000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      // ── 현대 (pin16) ──
      {
        brandCode: 'HYUNDAI',
        name: '현대백화점 5천원권',
        price: 5000,
        discountRate: 1.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'HYUNDAI',
        name: '현대백화점 1만원권',
        price: 10000,
        discountRate: 1.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'HYUNDAI',
        name: '현대백화점 5만원권',
        price: 50000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      {
        brandCode: 'HYUNDAI',
        name: '현대백화점 10만원권',
        price: 100000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      {
        brandCode: 'HYUNDAI',
        name: '현대백화점 50만원권',
        price: 500000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      // ── 다이소 (pin16) ──
      {
        brandCode: 'DAISO',
        name: '다이소 상품권 1천원권',
        price: 1000,
        discountRate: 3,
        tradeInRate: 12,
      },
      {
        brandCode: 'DAISO',
        name: '다이소 상품권 5천원권',
        price: 5000,
        discountRate: 2.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'DAISO',
        name: '다이소 상품권 1만원권',
        price: 10000,
        discountRate: 2,
        tradeInRate: 8,
      },
      {
        brandCode: 'DAISO',
        name: '다이소 상품권 5만원권',
        price: 50000,
        discountRate: 2,
        tradeInRate: 6,
      },
      {
        brandCode: 'DAISO',
        name: '다이소 상품권 10만원권',
        price: 100000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      // ── CU (pin16) ──
      {
        brandCode: 'CU',
        name: 'CU 상품권 1천원권',
        price: 1000,
        discountRate: 3,
        tradeInRate: 12,
      },
      {
        brandCode: 'CU',
        name: 'CU 상품권 5천원권',
        price: 5000,
        discountRate: 2.5,
        tradeInRate: 10,
      },
      {
        brandCode: 'CU',
        name: 'CU 상품권 1만원권',
        price: 10000,
        discountRate: 2,
        tradeInRate: 8,
      },
      {
        brandCode: 'CU',
        name: 'CU 상품권 5만원권',
        price: 50000,
        discountRate: 2,
        tradeInRate: 6,
      },
      // ── W상품권 (pin16) ──
      {
        brandCode: 'WGIFT',
        name: 'W상품권 1천원권',
        price: 1000,
        discountRate: 3,
        tradeInRate: 12,
      },
      {
        brandCode: 'WGIFT',
        name: 'W상품권 1만원권',
        price: 10000,
        discountRate: 2,
        tradeInRate: 8,
      },
      {
        brandCode: 'WGIFT',
        name: 'W상품권 5만원권',
        price: 50000,
        discountRate: 2,
        tradeInRate: 6,
      },
      {
        brandCode: 'WGIFT',
        name: 'W상품권 10만원권',
        price: 100000,
        discountRate: 1.5,
        tradeInRate: 5,
      },
      {
        brandCode: 'WGIFT',
        name: 'W상품권 50만원권',
        price: 500000,
        discountRate: 1.5,
        tradeInRate: 4,
      },
      // ── 이엑스 (EX) ──
      {
        brandCode: 'EX',
        name: '이엑스 상품권 1만원권',
        price: 10000,
        discountRate: 2,
        tradeInRate: 8,
      },
    ];

    const createdProducts: any[] = [];
    for (const p of productSeeds) {
      const buyPrice = Math.round(p.price * (1 - p.discountRate / 100));
      const product = await prisma.product.create({
        data: {
          brandCode: p.brandCode,
          name: p.name,
          price: p.price,
          discountRate: p.discountRate,
          buyPrice,
          tradeInRate: p.tradeInRate,
          allowTradeIn: true,
          isActive: true,
        },
      });
      createdProducts.push(product);
    }
    console.log(`✓ ${createdProducts.length} products seeded`);

    // ============================================
    // 4. Notices (공지사항)
    // ============================================
    const noticeSeeds = [
      {
        title: '씨드림기프트 그랜드 오픈 안내',
        content:
          '씨드림기프트가 정식 오픈했습니다. 신세계, 현대, 롯데, 다이소, 올리브영 상품권을 최저가로 구매하고 최고가로 판매하세요. 오픈 기념 이벤트도 진행 중이니 많은 이용 바랍니다.',
        isActive: true,
      },
      {
        title: '신세계 상품권 할인율 변경 안내',
        content:
          '2026년 2월 1일부터 신세계 상품권 할인율이 변경됩니다. 1만원권 2%, 5만원권 2.5%, 10만원권 3% 할인이 적용됩니다. 변경 전 구매 건은 기존 할인율이 유지됩니다.',
        isActive: true,
      },
      {
        title: '설날 연휴 배송 및 고객센터 운영 안내',
        content:
          '설날 연휴(1/27~1/30) 기간 중 PIN 발송은 정상 운영되나, 실물 상품권 배송은 1/31(금)부터 순차 발송됩니다. 고객센터는 연휴 기간 중 이메일 문의만 가능하며, 1/31부터 정상 운영됩니다.',
        isActive: true,
      },
      {
        title: '본인인증(KYC) 시스템 업그레이드 안내',
        content:
          '더 안전한 거래를 위해 본인인증 시스템이 업그레이드됩니다. 기존 인증 완료 회원은 재인증이 필요 없으며, 신규 회원은 간편인증으로 빠르게 인증을 완료할 수 있습니다.',
        isActive: true,
      },
      {
        title: '개인정보처리방침 개정 안내',
        content:
          '개인정보 보호법 개정에 따라 개인정보처리방침이 일부 변경됩니다. 주요 변경사항: 개인정보 보유기간 명시, 제3자 제공 동의 절차 강화. 변경된 방침은 2026년 2월 15일부터 적용됩니다.',
        isActive: true,
      },
      {
        title: '서버 점검 안내 (2/10 02:00~06:00)',
        content:
          '서비스 안정화를 위한 정기 점검이 진행됩니다. 점검 시간: 2026년 2월 10일(월) 02:00~06:00 (약 4시간). 점검 중에는 구매, 판매, 회원가입 등 모든 서비스 이용이 불가합니다.',
        isActive: true,
      },
    ];

    for (const n of noticeSeeds) {
      await prisma.notice.create({ data: n });
    }
    console.log(`✓ ${noticeSeeds.length} notices seeded`);

    // ============================================
    // 5. FAQs (자주 묻는 질문)
    // ============================================
    const faqSeeds = [
      // 결제/환불 (PAYMENT)
      {
        question: '결제 수단은 어떤 것이 있나요?',
        answer:
          '현재 무통장입금(가상계좌), 계좌이체를 지원합니다. 신용카드 결제는 추후 지원 예정입니다.',
        category: 'PAYMENT',
        order: 1,
      },
      {
        question: '결제 후 취소가 가능한가요?',
        answer:
          'PIN 발송 전이라면 주문 취소가 가능합니다. 마이페이지 > 주문내역에서 취소 신청해 주세요. PIN이 이미 발송된 경우 취소가 불가하며, 매입(판매) 기능을 이용해 주세요.',
        category: 'PAYMENT',
        order: 2,
      },
      {
        question: '환불은 어떻게 진행되나요?',
        answer:
          '주문 취소 시 결제 수단에 따라 환불됩니다. 가상계좌 결제 시 환불 계좌를 입력해 주시면 1~2영업일 내 환불됩니다.',
        category: 'PAYMENT',
        order: 3,
      },
      {
        question: '입금 확인이 안 됩니다.',
        answer:
          '가상계좌 입금 확인은 평일 기준 10분 이내 자동 처리됩니다. 30분 이상 지연 시 고객센터로 문의해 주세요.',
        category: 'PAYMENT',
        order: 4,
      },

      // 이용안내 (GENERAL)
      {
        question: '상품권 구매 후 어떻게 사용하나요?',
        answer:
          '구매 완료 후 마이페이지 > 주문내역에서 PIN 번호를 확인할 수 있습니다. 해당 브랜드 매장이나 온라인몰에서 PIN 번호를 입력하여 사용하시면 됩니다.',
        category: 'GENERAL',
        order: 1,
      },
      {
        question: 'PIN 번호는 어디서 확인하나요?',
        answer:
          '결제 완료 후 마이페이지 > 주문내역 > 주문 상세에서 확인 가능합니다. PIN 번호는 보안을 위해 마스킹 처리되며, "보기" 버튼을 눌러 확인할 수 있습니다.',
        category: 'GENERAL',
        order: 2,
      },
      {
        question: '상품권 유효기간은 얼마인가요?',
        answer:
          '상품권 유효기간은 브랜드마다 다릅니다. 일반적으로 발행일로부터 5년이며, 구매 시 정확한 유효기간이 안내됩니다.',
        category: 'GENERAL',
        order: 3,
      },
      {
        question: '하루 구매 한도가 있나요?',
        answer:
          '본인인증(KYC) 완료 회원은 1일 500만원, 1회 200만원까지 구매 가능합니다. 파트너 등급에 따라 한도가 상향될 수 있습니다.',
        category: 'GENERAL',
        order: 4,
      },

      // 회원/인증 (ACCOUNT)
      {
        question: '본인인증(KYC)은 필수인가요?',
        answer:
          '상품권 구매 및 판매를 위해서는 본인인증이 필수입니다. 회원가입 후 마이페이지에서 간편하게 인증할 수 있습니다.',
        category: 'ACCOUNT',
        order: 1,
      },
      {
        question: '비밀번호를 잊어버렸어요.',
        answer:
          '로그인 화면의 "비밀번호 찾기"를 통해 가입 이메일로 재설정 링크를 받을 수 있습니다.',
        category: 'ACCOUNT',
        order: 2,
      },
      {
        question: '파트너 등급은 어떻게 올리나요?',
        answer:
          '매입 누적 금액에 따라 자동으로 등급이 상향됩니다. SILVER(100만원), GOLD(500만원), PLATINUM(1,000만원) 기준입니다.',
        category: 'ACCOUNT',
        order: 3,
      },
      {
        question: '회원 탈퇴는 어떻게 하나요?',
        answer:
          '마이페이지 > 계정 설정 > 회원 탈퇴에서 진행할 수 있습니다. 미완료 주문이나 미정산 매입 건이 있는 경우 탈퇴가 제한됩니다.',
        category: 'ACCOUNT',
        order: 4,
      },

      // 배송 (SHIPPING)
      {
        question: 'PIN 번호는 언제 받을 수 있나요?',
        answer:
          '결제 확인 후 즉시 발송됩니다. 입금 확인 시간에 따라 최대 30분까지 소요될 수 있습니다.',
        category: 'SHIPPING',
        order: 1,
      },
      {
        question: '실물 상품권 배송은 가능한가요?',
        answer:
          '현재 실물 상품권 배송은 지원하지 않으며, 모든 상품은 PIN(모바일) 형태로 발송됩니다.',
        category: 'SHIPPING',
        order: 2,
      },

      // 매입/판매 (TRADE_IN)
      {
        question: '상품권 판매(매입)는 어떻게 하나요?',
        answer:
          '메뉴의 "상품권 판매"에서 브랜드와 금액을 선택한 후, PIN 번호를 입력하면 매입 신청이 완료됩니다. 관리자 확인 후 정산금이 입금됩니다.',
        category: 'TRADE_IN',
        order: 1,
      },
      {
        question: '매입 정산은 얼마나 걸리나요?',
        answer:
          'PIN 검증 완료 후 1~2영업일 내 등록된 계좌로 정산됩니다. 주말/공휴일에는 다음 영업일에 처리됩니다.',
        category: 'TRADE_IN',
        order: 2,
      },
      {
        question: '매입 가격은 어떻게 결정되나요?',
        answer:
          '매입 가격은 액면가에서 매입 할인율을 적용하여 산정됩니다. 브랜드와 금액에 따라 할인율이 다르며, 실시간 시세 페이지에서 확인할 수 있습니다.',
        category: 'TRADE_IN',
        order: 3,
      },
      {
        question: '사용한 상품권도 매입이 가능한가요?',
        answer:
          '아닙니다. 미사용 상태의 유효한 상품권만 매입 가능합니다. 잔액이 있는 부분 사용 상품권은 매입이 불가합니다.',
        category: 'TRADE_IN',
        order: 4,
      },
    ];

    for (const f of faqSeeds) {
      await prisma.faq.create({
        data: { ...f, isActive: true },
      });
    }
    console.log(`✓ ${faqSeeds.length} FAQs seeded`);

    // ============================================
    // 6. Events (이벤트)
    // ============================================
    const now = new Date();
    const eventSeeds = [
      {
        title: '그랜드 오픈 기념 전 상품 2% 추가 할인',
        description:
          '씨드림기프트 정식 오픈을 기념하여 모든 상품권 구매 시 2% 추가 할인을 드립니다. 기간 한정 이벤트이니 놓치지 마세요!',
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 28),
        isActive: true,
        isFeatured: true,
      },
      {
        title: '친구 초대 이벤트 - 5,000원 적립금',
        description:
          '친구를 초대하면 초대한 분과 초대받은 분 모두에게 5,000원 적립금을 드립니다. 적립금은 다음 구매 시 사용 가능합니다.',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 2, 28),
        isActive: true,
        isFeatured: true,
      },
      {
        title: '설날 특별 프로모션 - 신세계 상품권 3% 할인',
        description:
          '설날을 맞이하여 신세계 상품권 전 권종 3% 추가 할인! 가족, 친지에게 상품권을 선물하세요.',
        startDate: new Date(2026, 0, 20),
        endDate: new Date(2026, 1, 5),
        isActive: true,
        isFeatured: false,
      },
      {
        title: '매입 수수료 0원 이벤트',
        description:
          '이번 달 한정! 상품권 매입(판매) 시 수수료를 받지 않습니다. 사용하지 않는 상품권을 현금으로 바꿔보세요.',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        isActive: true,
        isFeatured: false,
      },
      {
        title: '첫 구매 고객 특별 혜택',
        description:
          '첫 구매 고객에게 다음 구매 시 사용 가능한 3,000원 할인 쿠폰을 드립니다. 회원가입 후 첫 주문 완료 시 자동 발급됩니다.',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), 11, 31),
        isActive: true,
        isFeatured: true,
      },
    ];

    for (const e of eventSeeds) {
      await prisma.event.create({ data: e });
    }
    console.log(`✓ ${eventSeeds.length} events seeded`);

    // ============================================
    // 7. Orders + OrderItems (주문/거래내역)
    // ============================================
    const orderStatuses = ['PAID', 'DELIVERED'] as const;

    for (let i = 0; i < 30; i++) {
      const user = users[i % users.length];
      const product =
        createdProducts[Math.floor(Math.random() * createdProducts.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const buyPrice = Math.round(
        Number(product.price) * (1 - Number(product.discountRate) / 100),
      );
      const totalAmount = buyPrice * quantity;
      const status =
        orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

      const daysAgo = Math.floor(Math.random() * 30);
      const hoursAgo = Math.floor(Math.random() * 24);
      const orderDate = new Date(
        now.getTime() - daysAgo * 86400000 - hoursAgo * 3600000,
      );

      await prisma.order.create({
        data: {
          userId: user.id,
          totalAmount,
          status,
          paymentMethod: 'BANK_TRANSFER',
          createdAt: orderDate,
          items: {
            create: {
              productId: product.id,
              quantity,
              price: buyPrice,
            },
          },
        },
      });
    }
    console.log('✓ 30 orders seeded');

    // ============================================
    // 8. TradeIns (매입 내역)
    // ============================================
    const tradeInStatuses = ['VERIFIED', 'PAID'] as const;

    for (let i = 0; i < 20; i++) {
      const user = users[i % users.length];
      const product =
        createdProducts[Math.floor(Math.random() * createdProducts.length)];
      const payoutAmount = Math.round(
        Number(product.price) * (1 - Number(product.tradeInRate) / 100),
      );
      const status =
        tradeInStatuses[Math.floor(Math.random() * tradeInStatuses.length)];

      const daysAgo = Math.floor(Math.random() * 30);
      const hoursAgo = Math.floor(Math.random() * 24);
      const tradeDate = new Date(
        now.getTime() - daysAgo * 86400000 - hoursAgo * 3600000,
      );

      const fakePinRaw = `SEED-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
      const pinCode = encrypt(fakePinRaw);
      const pinHash = crypto
        .createHash('sha256')
        .update(fakePinRaw)
        .digest('hex');

      await prisma.tradeIn.create({
        data: {
          userId: user.id,
          productId: product.id,
          productName: product.name,
          productBrand: product.brandCode,
          productPrice: Number(product.price),
          pinCode,
          pinHash,
          payoutAmount,
          status,
          bankName: '국민은행',
          accountNum: encrypt('123-456-789012'),
          accountHolder: user.name || '홍길동',
          createdAt: tradeDate,
        },
      });
    }
    console.log('✓ 20 trade-ins seeded');

    // ============================================
    // 9. SiteConfig (동적 설정)
    // ============================================
    const siteConfigSeeds = [
      {
        key: 'PURCHASE_LIMIT_DAILY',
        value: '2000000',
        type: 'NUMBER',
        description: '일일 구매 한도 (원)',
      },
      {
        key: 'PURCHASE_LIMIT_MONTHLY',
        value: '5000000',
        type: 'NUMBER',
        description: '월간 구매 한도 (원)',
      },
    ];

    for (const sc of siteConfigSeeds) {
      await prisma.siteConfig.upsert({
        where: { key: sc.key },
        update: { value: sc.value, type: sc.type, description: sc.description },
        create: sc,
      });
    }
    console.log(`✓ ${siteConfigSeeds.length} site configs seeded`);

    console.log('\n✅ Seed successful!');
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
