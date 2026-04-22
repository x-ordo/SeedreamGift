import { Module } from '@nestjs/common';

import { SitemapController } from './sitemap.controller';
import { BrandModule } from '../../modules/brand/brand.module';

@Module({
  imports: [BrandModule],
  controllers: [SitemapController],
})
export class SeoModule {}
