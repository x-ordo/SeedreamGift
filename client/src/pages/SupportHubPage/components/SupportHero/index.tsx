/**
 * @file SupportHero/index.tsx
 * @description 고객지원 히어로 섹션
 * - 검색 기능 제거됨
 */
import React from 'react';
import './SupportHero.css';

export const SupportHero: React.FC = () => {
  return (
    <section className="support-hero">
      <div className="support-hero__inner">
        <h1 className="support-hero__title">무엇을 도와드릴까요?</h1>
        <p className="support-hero__subtitle">자주 묻는 질문과 공지사항을 확인하세요</p>
      </div>
    </section>
  );
};

export default SupportHero;