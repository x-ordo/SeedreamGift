/**
 * @file BrandSideNav.tsx
 * @description 데스크탑 전용 좌측 브랜드 네비게이션
 */
import React, { memo } from 'react';
import { Brand } from '../../../types';
import './BrandSideNav.css';

interface BrandSideNavProps {
  brands: Brand[];
  selectedBrandCode: string | null;
  onSelectBrand: (brandCode: string | null) => void;
  productCounts?: Record<string, number>;
}

export const BrandSideNav: React.FC<BrandSideNavProps> = memo(({ brands, selectedBrandCode, onSelectBrand, productCounts = {} }) => {
  return (
    <nav className="brand-sidenav">
      <header className="brand-sidenav-header">
        <h3 className="brand-sidenav-title">브랜드 선택</h3>
      </header>
      <div className="brand-sidenav-list">
        <button
          type="button"
          className={`brand-sidenav-item ${!selectedBrandCode ? 'active' : ''}`}
          onClick={() => onSelectBrand(null)}
        >
          <div className="brand-sidenav-icon-placeholder brand-sidenav-icon-placeholder--primary">ALL</div>
          <span className="brand-sidenav-label">전체 보기</span>
        </button>

        {brands.map((brand) => (
          <button
            key={brand.code}
            type="button"
            className={`brand-sidenav-item ${selectedBrandCode === brand.code ? 'active' : ''}`}
            onClick={() => onSelectBrand(brand.code)}
          >
            {brand.imageUrl ? (
              <img src={brand.imageUrl} alt={brand.name} className="brand-sidenav-icon" loading="lazy" decoding="async" />
            ) : (
              <div className="brand-sidenav-icon-placeholder">{brand.name.charAt(0)}</div>
            )}
            <span className="brand-sidenav-label">{brand.name}</span>
            {productCounts[brand.code] !== undefined && (
              <span className="brand-sidenav-count">{productCounts[brand.code]}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
});

BrandSideNav.displayName = 'BrandSideNav';
