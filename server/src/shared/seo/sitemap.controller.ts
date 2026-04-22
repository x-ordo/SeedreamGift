import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';

import { BrandService } from '../../modules/brand/brand.service';

@ApiExcludeController()
@Controller()
export class SitemapController {
  private readonly baseUrl: string;

  constructor(
    private readonly brandService: BrandService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'https://seedreamgift.com',
    );
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSitemap(): Promise<string> {
    const brands = await this.brandService.findAll();

    const staticUrls = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/products', priority: '0.9', changefreq: 'daily' },
      { loc: '/trade-in', priority: '0.8', changefreq: 'daily' },
      { loc: '/live', priority: '0.7', changefreq: 'hourly' },
      { loc: '/support', priority: '0.5', changefreq: 'weekly' },
      { loc: '/login', priority: '0.3', changefreq: 'monthly' },
      { loc: '/register', priority: '0.3', changefreq: 'monthly' },
    ];

    const brandUrls = brands.map((brand) => ({
      loc: `/voucher/${encodeURIComponent(brand.code)}`,
      priority: '0.8',
      changefreq: 'daily' as const,
    }));

    const today = new Date().toISOString().split('T')[0];

    const urls = [...staticUrls, ...brandUrls]
      .map(
        (url) => `  <url>
    <loc>${this.baseUrl}${url.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  }
}
