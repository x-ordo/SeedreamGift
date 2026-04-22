/**
 * @file TrustSection.tsx
 * @description 홈페이지 신뢰 배지 섹션 - 서비스 핵심 강점을 아이콘과 함께 표시
 * @module components/home
 *
 * 사용처:
 * - HomePage: 히어로 섹션 하단에 신뢰도를 높이는 배지들을 가로로 나열
 *
 * 특징:
 * - 정적 데이터로 React.memo 최적화
 * - Lucide React 아이콘 사용 (즉시 발송, 수수료 0원, SSL 보안, 안전 결제)
 */
import React, { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Zap, Coins, ShieldCheck, CreditCard } from 'lucide-react';

interface TrustBadge {
    icon: LucideIcon;
    text: string;
}

/** 신뢰 배지 섹션 - 서비스 핵심 강점 표시 */
export const TrustSection = memo(() => {
    const badges: TrustBadge[] = [
        { icon: Zap, text: '즉시 발송' },
        { icon: Coins, text: '수수료 0원' },
        { icon: ShieldCheck, text: 'SSL 보안' },
        { icon: CreditCard, text: '안전 결제' },
    ];

    return (
        <section className="trust-section-compact">
            {badges.map((badge) => {
                const BadgeIcon = badge.icon;
                return (
                <div key={badge.text} className="trust-badge-compact">
                    <BadgeIcon size={18} aria-hidden="true" />
                    <span>{badge.text}</span>
                </div>
                );
            })}
        </section>
    );
});

TrustSection.displayName = 'TrustSection';
