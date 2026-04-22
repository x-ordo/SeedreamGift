/**
 * @file PageHeader/index.tsx
 * @description 통합 페이지 헤더 — 모든 서브페이지에서 일관된 제목/부제목 표시
 * @module design-system/molecules/PageHeader
 *
 * Props:
 * - title: 페이지 제목
 * - subtitle?: 부제목
 * - onBack?: 뒤로 가기 콜백
 * - meta?: 우측 메타 정보 (날짜 등)
 * - icon?: Lucide icon component or Bootstrap icon class name (제목 좌측)
 */
import React, { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/common/Icon';
import { FadeIn } from '../FadeIn';
import './PageHeader.css';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export const PageHeader = memo(function PageHeader({
  title,
  subtitle,
  onBack,
  meta,
  icon,
  className = '',
}: PageHeaderProps) {
  return (
    <FadeIn direction="up" distance={20}>
      <header className={`page-header ${className}`}>
        {onBack && (
          <button
            type="button"
            className="page-header__back"
            onClick={onBack}
            aria-label="뒤로 가기"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        )}
        <div className="page-header__content">
          <h1 className="page-header__title">
            {icon && (
              <Icon icon={icon} size={20} className="page-header__icon" aria-hidden="true" />
            )}
            {title}
          </h1>
          {subtitle && (
            <p className="page-header__subtitle">{subtitle}</p>
          )}
        </div>
        {meta && <div className="page-header__meta">{meta}</div>}
      </header>
    </FadeIn>
  );
});

export default PageHeader;
