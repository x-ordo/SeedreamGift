/**
 * @file GiftPage.tsx
 * @description 선물하기 랜딩 페이지 - 상품권 선물 안내 및 CTA
 * @module pages
 * @route /gift
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Cake, Briefcase, PartyPopper, ArrowRight, HelpCircle } from 'lucide-react';
import SEO from '../components/common/SEO';
import siteConfig from '../../../site.config.json';
import { Button, Card, FadeIn, Stagger } from '../design-system';

const giftScenarios = [
  {
    icon: Cake,
    label: '생일',
    description: '신세계/현대 상품권으로 특별한 생일 선물을',
    color: 'var(--color-error)',
    bg: 'var(--color-error)',
  },
  {
    icon: Briefcase,
    label: '감사',
    description: '고급 백화점 상품권으로 진심을 전하세요',
    color: 'var(--color-primary)',
    bg: 'var(--color-primary)',
  },
  {
    icon: PartyPopper,
    label: '축하',
    description: '올리브영/다이소 상품권으로 실용적인 선물을',
    color: 'var(--color-point)',
    bg: 'var(--color-point)',
  },
];

const faqs = [
  {
    q: '선물은 어떻게 받나요?',
    a: '수신자 이메일로 PIN 번호가 전송됩니다. 별도 앱 설치 없이 이메일에서 바로 확인할 수 있어요.',
  },
  {
    q: '유효기간은 얼마나 되나요?',
    a: '상품권 종류에 따라 다르며, 일반적으로 발급일로부터 5년입니다. 상세 유효기간은 상품 페이지에서 확인해주세요.',
  },
  {
    q: '선물 취소할 수 있나요?',
    a: '수신자가 PIN을 사용하지 않았다면 구매 후 7일 이내에 전액 환불이 가능합니다. 마이페이지에서 취소 신청해주세요.',
  },
];

const GiftPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <SEO
        title="선물하기 - 상품권으로 마음을 전하세요"
        description={`생일, 감사, 축하 등 모든 상황에 딱 맞는 상품권 선물. ${siteConfig.company.nameShort}에서 간편하게 보내세요.`}
      />
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 md:py-16">
        {/* Hero */}
        <FadeIn direction="up" distance={20}>
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[var(--color-gift-light,#FFF0F6)] mb-5">
              <Gift size={32} className="text-[var(--color-gift,#E91E8C)]" aria-hidden="true" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-base-content tracking-tight mb-3">
              상품권으로 마음을 전하세요
            </h1>
            <p className="text-base text-base-content/50 leading-relaxed">
              번거로운 포장 없이, 이메일 한 통으로<br className="sm:hidden" />
              소중한 사람에게 선물하세요
            </p>
          </div>
        </FadeIn>

        {/* Scenario Cards */}
        <Stagger className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12" staggerDelay={0.1} direction="up" distance={20}>
          {giftScenarios.map(({ icon: Icon, label, description, color, bg }) => (
            <Card
              key={label}
              className="p-6 text-center hover:shadow-md transition-[box-shadow,transform] hover:-translate-y-0.5"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `color-mix(in oklch, ${bg} 8%, white)` }}
              >
                <Icon size={24} style={{ color }} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-base text-base-content mb-1">{label}</h3>
              <p className="text-sm text-base-content/50 leading-relaxed">{description}</p>
            </Card>
          ))}
        </Stagger>

        {/* CTA */}
        <FadeIn direction="up" distance={15} delay={0.3}>
          <div className="text-center mb-16">
            <Button
              variant="primary"
              size="xl"
              onClick={() => navigate('/products?gift=true')}
              rightIcon={<ArrowRight size={18} aria-hidden="true" />}
            >
              선물하기
            </Button>
            <p className="text-xs text-base-content/40 mt-3">
              상품 선택 후 수신자 정보를 입력하면 바로 발송됩니다
            </p>
          </div>
        </FadeIn>

        {/* FAQ */}
        <FadeIn direction="up" distance={20} delay={0.4}>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <HelpCircle size={18} className="text-primary" aria-hidden="true" />
              <h2 className="text-lg font-bold text-base-content tracking-tight">자주 묻는 질문</h2>
            </div>
            <div className="space-y-4">
              {faqs.map(({ q, a }) => (
                <Card key={q} className="p-5">
                  <h3 className="text-sm font-bold text-base-content mb-2">Q. {q}</h3>
                  <p className="text-sm text-base-content/50 leading-relaxed">{a}</p>
                </Card>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
};

export default GiftPage;
