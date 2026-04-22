import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import { SiteConfigService } from '../../site-config/site-config.service';

@Injectable()
export class AdminConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteConfigService: SiteConfigService,
  ) {}

  // ========================================
  // SiteConfigs CRUD
  // ========================================

  async findAll() {
    return this.siteConfigService.getAll();
  }

  async update(id: number, value: string) {
    return this.prisma.siteConfig.update({ where: { id }, data: { value } });
  }
}
