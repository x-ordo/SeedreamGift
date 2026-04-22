/**
 * @file RefundPolicyPage.tsx
 * @description 환불/교환 정책 페이지
 * @module pages/Legal
 * @route /legal/refund
 */
import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../components/common/SEO';
import { Card, FadeIn } from '../../design-system';
import { SUPPORT_CONTACT, siteConfig } from '../../constants/site';

const RefundPolicyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 mt-8 sm:mt-12 mb-12">
      <SEO title="환불/교환 정책" description={`${siteConfig.company.brand} 환불/교환 정책 안내`} />
      <FadeIn direction="up" distance={20}>
        <Card className="p-4 sm:p-6 shadow-md rounded-2xl">
          <h1 className="font-bold mb-1" style={{ fontSize: 'var(--text-title, 22px)' }}>
            환불/교환 정책
          </h1>
          <p className="text-base-content/50 text-xs sm:text-sm mb-6">시행일: 2025년 1월 1일</p>

          <article className="space-y-8">
            {/* 1. 디지털 상품권 */}
            <section>
              <h2 className="text-base font-bold text-base-content mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                디지털 상품권 (PIN)
              </h2>
              <ul className="space-y-2 pl-8">
                <li className="text-sm text-base-content/70 leading-relaxed list-disc">
                  <strong>PIN 미사용 시:</strong> 구매 후 7일 이내 전액 환불
                </li>
                <li className="text-sm text-base-content/70 leading-relaxed list-disc">
                  <strong>PIN 사용 후:</strong> 환불 불가
                </li>
                <li className="text-sm text-base-content/70 leading-relaxed list-disc">
                  <strong>PIN 오류 시:</strong> 즉시 재발급 또는 환불
                </li>
              </ul>
            </section>

            {/* 2. 매입 취소 */}
            <section>
              <h2 className="text-base font-bold text-base-content mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                매입 (판매) 취소
              </h2>
              <ul className="space-y-2 pl-8">
                <li className="text-sm text-base-content/70 leading-relaxed list-disc">
                  <strong>발송 전:</strong> 즉시 취소 가능
                </li>
                <li className="text-sm text-base-content/70 leading-relaxed list-disc">
                  <strong>발송 후 ~ 검수 전:</strong> 반송 후 취소
                </li>
                <li className="text-sm text-base-content/70 leading-relaxed list-disc">
                  <strong>검수 완료 후:</strong> 취소 불가
                </li>
              </ul>
            </section>

            {/* 3. 환불 처리 시간 */}
            <section>
              <h2 className="text-base font-bold text-base-content mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                환불 처리 시간
              </h2>
              <ul className="space-y-2 pl-8">
                <li className="text-sm text-base-content/70 leading-relaxed list-disc">
                  <strong>카드 결제:</strong> 3~5 영업일
                </li>
                <li className="text-sm text-base-content/70 leading-relaxed list-disc">
                  <strong>무통장입금:</strong> 1~2 영업일
                </li>
              </ul>
            </section>

            {/* 4. 문의 */}
            <section>
              <h2 className="text-base font-bold text-base-content mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                문의
              </h2>
              <div className="pl-8 space-y-1.5">
                <p className="text-sm text-base-content/70">
                  이메일: <a href={SUPPORT_CONTACT.emailHref} className="text-primary hover:underline">{SUPPORT_CONTACT.email}</a>
                </p>
                <p className="text-sm text-base-content/70">
                  전화: <a href={SUPPORT_CONTACT.phoneHref} className="text-primary hover:underline tabular-nums">{SUPPORT_CONTACT.phone}</a>
                  <span className="text-xs text-base-content/40 ml-1">({SUPPORT_CONTACT.phoneHours})</span>
                </p>
              </div>
            </section>
          </article>

          <div className="mt-8 pt-6 border-t border-grey-50 text-center">
            <Link to="/" className="no-underline text-base-content/50 text-xs sm:text-sm hover:underline">
              홈으로 돌아가기
            </Link>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
};

export default RefundPolicyPage;
