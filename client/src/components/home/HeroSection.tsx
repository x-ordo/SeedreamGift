/**
 * @file HeroSection.tsx
 * @description 히어로 섹션 - 홈페이지 메인 배너 (Premium Design)
 * @module components/home
 *
 * Features:
 * - Aurora background effect (lazy loaded for LCP optimization)
 * - Floating particles (lazy loaded)
 * - Animated typography (BlurText, GradientText)
 * - Motion-enhanced CTA buttons
 * - prefers-reduced-motion: Aurora/particles/BlurText disabled
 */
import React, { memo, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { Button, BlurText, FadeIn, GradientText } from '../../design-system';
import { COLORS } from '../../constants/designTokens';
import siteConfig from '../../../../site.config.json';

// Lazy load heavy motion components for LCP improvement
const Aurora = lazy(() => import('../../design-system/molecules/Aurora'));
const FloatingParticles = lazy(() => import('./FloatingParticles'));

interface HeroSectionProps {
  navigate: ReturnType<typeof useNavigate>;
}

const getPrefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const HeroSection = memo(({ navigate }: HeroSectionProps) => {
  const prefersReducedMotion = useMemo(() => getPrefersReducedMotion(), []);

  return (
    <div className="hero-wrapper">
      <section className="hero-section">
        {/* Aurora 배경 - lazy loaded, reduced-motion 시 비활성화 */}
        {!prefersReducedMotion && (
          <Suspense fallback={null}>
            <Aurora
              colors={[
                'rgba(49, 130, 246, 0.35)',
                'rgba(255, 187, 0, 0.25)',
                'rgba(100, 168, 255, 0.3)',
              ]}
              speed={12}
              blur={120}
              opacity={0.6}
            />
          </Suspense>
        )}

        {/* 떠다니는 파티클 - lazy loaded, reduced-motion 시 비활성화 */}
        {!prefersReducedMotion && (
          <Suspense fallback={null}>
            <FloatingParticles
              count={8}
              colors={[COLORS.primary, COLORS.point, COLORS.success, '#64a8ff']}
              minSize={6}
              maxSize={16}
            />
          </Suspense>
        )}

        <div className="container-custom hero-content">
          <div className="hero-text">
            {/* BlurText로 헤드라인 애니메이션 - reduced-motion 시 정적 텍스트 */}
            <h1 className="hero-title">
              {prefersReducedMotion ? (
                <span className="hero-title-line">믿을 수 있는 상품권</span>
              ) : (
                <BlurText
                  text="믿을 수 있는 상품권"
                  delay={80}
                  animateBy="words"
                  direction="bottom"
                  className="hero-title-line"
                />
              )}
              <br />
              <GradientText
                colors={['var(--color-point)', 'var(--color-yellow-300)', 'var(--color-point)']}
                animationSpeed={prefersReducedMotion ? 0 : 5}
                className="hero-gradient-text"
              >
                {siteConfig.company.nameShort}에서 안전하게
              </GradientText>
            </h1>

            {/* 서브타이틀 fade-in */}
            <FadeIn delay={prefersReducedMotion ? 0 : 0.4} direction="up" distance={20}>
              <p className="hero-subtitle">
                복잡한 절차 없이 30초면 즉시 발급<br className="hidden sm:block" />
                정품 보장 백화점 상품권 직거래 플랫폼
              </p>
            </FadeIn>

            {/* CTA 버튼 그룹 */}
            <FadeIn delay={0.6} direction="up" distance={20}>
              <div className="hero-cta-group">
                <motion.div className="hero-cta-btn" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="point"
                    size="xl"
                    fullWidth
                    onClick={() => navigate('/products')}
                    icon={<ShoppingBag size={18} aria-hidden="true" />}
                  >
                    지금 구매하기
                  </Button>
                </motion.div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>
    </div>
  );
});

HeroSection.displayName = 'HeroSection';
