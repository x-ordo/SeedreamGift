/**
 * @file HowToGuide.tsx
 * @description 이용 방법 안내 섹션 - 3단계 스텝 가이드 (첫 구매자 안내 강화)
 * @module components/home
 */
import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, CreditCard, Zap, ArrowRight } from 'lucide-react';
import { Button, FadeIn, Stagger } from '../../design-system';

const steps = [
  {
    icon: ShoppingBag,
    number: 1,
    title: '상품권 선택',
    description: '브랜드와 금액을 고르세요',
    accent: 'var(--color-primary)',
  },
  {
    icon: CreditCard,
    number: 2,
    title: '결제',
    description: '무통장입금으로 결제하세요',
    accent: 'var(--color-point)',
  },
  {
    icon: Zap,
    number: 3,
    title: 'PIN 즉시 발급',
    description: '마이페이지에서 바로 확인!',
    accent: 'var(--color-success)',
  },
];

export const HowToGuide = memo(() => {
  const navigate = useNavigate();

  return (
    <section className="howto-section py-10">
      <FadeIn direction="up" distance={20}>
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/5 text-primary text-xs font-bold mb-3 tracking-wide">
            이용 안내
          </span>
          <h3 className="text-xl md:text-2xl font-bold text-base-content tracking-tight">
            3단계로 끝!
          </h3>
          <p className="text-sm text-base-content/50 mt-2">처음이셔도 30초면 충분해요</p>
        </div>
      </FadeIn>

      <Stagger className="grid grid-cols-1 sm:grid-cols-3 gap-6" staggerDelay={0.12} direction="up" distance={20}>
        {steps.map(({ icon: Icon, number, title, description, accent }) => (
          <div
            key={number}
            className="howto-step-card flex flex-col items-center text-center p-6 rounded-3xl bg-white border border-base-200/60 shadow-sm transition-[background-color,transform,box-shadow] duration-200 hover:shadow-md hover:-translate-y-1"
          >
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: accent, boxShadow: `0 4px 14px ${accent}33` }}>
              <Icon size={24} className="text-white" aria-hidden="true" />
              <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border-2 text-xs font-bold flex items-center justify-center shadow-sm" style={{ borderColor: accent, color: accent }}>
                {number}
              </span>
            </div>
            {number < 3 && (
              <div className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-base-content/15">
                <ArrowRight size={20} aria-hidden="true" />
              </div>
            )}
            <h4 className="font-bold text-base text-base-content mb-1">{title}</h4>
            <p className="text-sm text-base-content/50 leading-relaxed">{description}</p>
          </div>
        ))}
      </Stagger>

      <FadeIn direction="up" distance={15} delay={0.4}>
        <div className="flex justify-center mt-8">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/products')}
            rightIcon={<ArrowRight size={16} aria-hidden="true" />}
          >
            지금 구매하기
          </Button>
        </div>
      </FadeIn>
    </section>
  );
});

HowToGuide.displayName = 'HowToGuide';
