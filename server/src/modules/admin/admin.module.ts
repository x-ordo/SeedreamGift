import { Module } from '@nestjs/common';

import {
  AdminUsersController,
  AdminProductsController,
  AdminOrdersController,
  AdminContentController,
  AdminSystemController,
} from './admin.controller';
import {
  AdminDashboardService,
  AdminUsersService,
  AdminProductsService,
  AdminVouchersService,
  AdminTradeInService,
  AdminOrdersService,
  AdminContentService,
  AdminGiftsService,
  AdminConfigService,
  AuditArchiveService,
} from './services';
import { AuthModule } from '../../shared/auth/auth.module';
import { CryptoModule } from '../../shared/crypto/crypto.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { CartModule } from '../cart/cart.module';
import { EventModule } from '../event/event.module';
import { FaqModule } from '../faq/faq.module';
import { InquiryModule } from '../inquiry/inquiry.module';
import { NoticeModule } from '../notice/notice.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductModule } from '../product/product.module';
import { RefundModule } from '../refund/refund.module';
import { SiteConfigModule } from '../site-config/site-config.module';
import { TradeInModule } from '../trade-in/trade-in.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CartModule,
    CryptoModule,
    EventModule,
    FaqModule,
    InquiryModule,
    NoticeModule,
    OrdersModule,
    ProductModule,
    RefundModule,
    SiteConfigModule,
    TradeInModule,
  ],
  controllers: [
    AdminUsersController,
    AdminProductsController,
    AdminOrdersController,
    AdminContentController,
    AdminSystemController,
  ],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminProductsService,
    AdminVouchersService,
    AdminTradeInService,
    AdminOrdersService,
    AdminContentService,
    AdminGiftsService,
    AdminConfigService,
    AuditArchiveService,
  ],
})
export class AdminModule {}
