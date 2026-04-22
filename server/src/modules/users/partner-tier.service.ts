import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../shared/prisma/prisma.service';

export interface TierConfig {
  name: string;
  label: string;
  minVolume: number;
  bonusRate: number;
}

export const PARTNER_TIERS: TierConfig[] = [
  { name: 'BRONZE', label: '브론즈', minVolume: 0, bonusRate: 0 },
  { name: 'SILVER', label: '실버', minVolume: 5_000_000, bonusRate: 0.3 },
  { name: 'GOLD', label: '골드', minVolume: 20_000_000, bonusRate: 0.5 },
  {
    name: 'PLATINUM',
    label: '플래티넘',
    minVolume: 50_000_000,
    bonusRate: 0.8,
  },
  {
    name: 'DIAMOND',
    label: '다이아몬드',
    minVolume: 100_000_000,
    bonusRate: 1.0,
  },
];

@Injectable()
export class PartnerTierService {
  constructor(private readonly prisma: PrismaService) {}

  getTierByVolume(volume: number): TierConfig {
    for (let i = PARTNER_TIERS.length - 1; i >= 0; i--) {
      if (volume >= PARTNER_TIERS[i].minVolume) return PARTNER_TIERS[i];
    }
    return PARTNER_TIERS[0];
  }

  getNextTier(currentTier: string): TierConfig | null {
    const idx = PARTNER_TIERS.findIndex((t) => t.name === currentTier);
    if (idx < 0 || idx >= PARTNER_TIERS.length - 1) return null;
    return PARTNER_TIERS[idx + 1];
  }

  async updateUserVolume(userId: number, amount: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalTradeInVolume: true,
        partnerTier: true,
        partnerSince: true,
      },
    });
    if (!user) return;

    const currentVolume = Number(user.totalTradeInVolume || 0) + amount;
    const newTier = this.getTierByVolume(currentVolume);

    const updateData: any = { totalTradeInVolume: currentVolume };
    if (newTier.name !== (user.partnerTier || 'BRONZE')) {
      updateData.partnerTier = newTier.name;
      if (!user.partnerSince && newTier.name !== 'BRONZE') {
        updateData.partnerSince = new Date();
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async getPartnerInfo(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        partnerTier: true,
        totalTradeInVolume: true,
        partnerSince: true,
      },
    });
    if (!user) return null;

    const volume = Number(user.totalTradeInVolume || 0);
    const currentTier = this.getTierByVolume(volume);
    const nextTier = this.getNextTier(currentTier.name);
    const progress = nextTier
      ? Math.min((volume / nextTier.minVolume) * 100, 100)
      : 100;
    const remaining = nextTier ? Math.max(nextTier.minVolume - volume, 0) : 0;

    return {
      tier: currentTier,
      volume,
      nextTier,
      progress: Math.round(progress * 10) / 10,
      remaining,
      partnerSince: user.partnerSince,
      allTiers: PARTNER_TIERS,
    };
  }
}
