import { Injectable, NotFoundException } from '@nestjs/common';

import { SiteConfig } from '../../shared/prisma/generated/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SiteConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<SiteConfig[]> {
    return this.prisma.siteConfig.findMany();
  }

  async get(key: string): Promise<string | null> {
    const config = await this.prisma.siteConfig.findUnique({
      where: { key },
    });
    return config ? config.value : null;
  }

  async set(key: string, value: string): Promise<SiteConfig> {
    const existing = await this.prisma.siteConfig.findUnique({
      where: { key },
    });
    if (!existing) {
      throw new NotFoundException(`Config key '${key}' not found`);
    }
    return this.prisma.siteConfig.update({
      where: { key },
      data: { value },
    });
  }

  // 타입 캐스팅 헬퍼
  async getNumber(key: string, defaultValue: number): Promise<number> {
    const val = await this.get(key);
    if (val === null) return defaultValue;
    const num = Number(val);
    return Number.isFinite(num) ? num : defaultValue;
  }

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const val = await this.get(key);
    return val ? val === 'true' : defaultValue;
  }
}
