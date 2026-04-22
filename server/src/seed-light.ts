import * as path from 'path';

import { NestFactory } from '@nestjs/core';

import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

import { AppModule } from './app.module';
import { PrismaService } from './shared/prisma/prisma.service';

// Load .env explicitly for seed script context
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: seed-light.ts must NOT run in production');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  console.log('Seeding Light (Additive)...');

  try {
    // 1. Admin
    try {
      const password = await bcrypt.hash('admin1234', 10);
      await prisma.user.create({
        data: {
          email: 'admin@example.com',
          name: 'Super Admin',
          password,
          role: 'ADMIN',
          kycStatus: 'VERIFIED',
          phone: '010-0000-0000',
        },
      });
      console.log('✓ Admin created');
    } catch (e: any) {
      console.log('✓ Admin exists or error:', e.code);
    }

    // 1.5 Buyer User
    try {
      const password = await bcrypt.hash('Password123!', 10);
      await prisma.user.create({
        data: {
          email: 'buyer@test.com',
          name: 'Test Buyer',
          password,
          role: 'USER',
          kycStatus: 'VERIFIED',
          phone: '010-1234-5678',
        },
      });
      console.log('✓ Buyer created');
    } catch (e: any) {
      console.log('✓ Buyer exists');
    }

    // 1.6 E2E 테스트 표준 사용자
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

    // 1.7 Receiver User
    try {
      const password = await bcrypt.hash('Password123!', 10);
      await prisma.user.create({
        data: {
          email: 'receiver@test.com',
          name: 'Test Receiver',
          password,
          role: 'USER',
          kycStatus: 'VERIFIED',
          phone: '010-9876-5432',
        },
      });
      console.log('✓ Receiver created');
    } catch (e: any) {
      console.log('✓ Receiver exists');
    }

    // 1.8 Brands
    const brands = [
      { code: 'SHINSEGAE', name: '신세계' },
      { code: 'OLIVEYOUNG', name: '올리브영' },
      { code: 'CULTURELAND', name: '컬쳐랜드' },
      { code: 'HAPPYMONEY', name: '해피머니' },
      { code: 'GOOGLE', name: '구글플레이' },
      { code: 'BOOKNLIFE', name: '북앤라이프' },
    ];

    for (const b of brands) {
      await prisma.brand.upsert({
        where: { code: b.code },
        update: {},
        create: {
          code: b.code,
          name: b.name,
        },
      });
      console.log(`✓ Brand upserted: ${b.name}`);
    }

    // 2. Products (scoped cleanup: only seed products, not all data)
    const products = [
      {
        brandCode: 'SHINSEGAE',
        name: '신세계 상품권 1만원',
        price: 10000,
        discountRate: 0,
        tradeInRate: 5,
      },
      {
        brandCode: 'SHINSEGAE',
        name: '신세계 상품권 5만원',
        price: 50000,
        discountRate: 0,
        tradeInRate: 5,
      },
      {
        brandCode: 'OLIVEYOUNG',
        name: '올리브영 상품권 1만원',
        price: 10000,
        discountRate: 0,
        tradeInRate: 3,
      },
    ];

    const seedProductNames = products.map((p) => p.name);
    const existingSeedProducts = await prisma.product.findMany({
      where: { name: { in: seedProductNames } },
      select: { id: true },
    });

    if (existingSeedProducts.length > 0) {
      const seedProductIds = existingSeedProducts.map((p) => p.id);
      await prisma.voucherCode.deleteMany({
        where: { productId: { in: seedProductIds } },
      });
      console.log(
        `✓ Cleared voucher codes for ${seedProductIds.length} seed products`,
      );
      await prisma.product.deleteMany({
        where: { id: { in: seedProductIds } },
      });
      console.log(`✓ Cleared ${seedProductIds.length} seed products`);
    }

    for (const p of products) {
      await prisma.product.create({
        data: {
          brandCode: p.brandCode,
          name: p.name,
          price: p.price,
          buyPrice: p.price,
          discountRate: p.discountRate,
          tradeInRate: p.tradeInRate,
          allowTradeIn: true,
          isActive: true,
        },
      });
      console.log(`✓ Product created: ${p.name}`);
    }
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('Seed bootstrap failed:', err);
  process.exit(1);
});
