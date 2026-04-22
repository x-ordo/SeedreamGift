/**
 * @file BrandFilterChips.tsx
 * @description 브랜드 필터 칩 — 크로스브랜드 쇼핑용 상단 필터
 *
 * [전체] 칩 + 브랜드별 칩. selectedCodes가 비어있으면 "전체" 활성 (필터 없음).
 * 접근성: role="group" + aria-label, 각 칩 role="checkbox" + aria-checked
 */
import React, { memo } from 'react';
import { Check } from 'lucide-react';
import { Brand } from '../../types';
import './BrandFilterChips.css';

interface BrandFilterChipsProps {
  brands: Brand[];
  selectedCodes: string[];
  onToggle: (code: string) => void;
  onSelectAll: () => void;
  productCounts?: Record<string, number>;
}

export const BrandFilterChips: React.FC<BrandFilterChipsProps> = memo(({
  brands,
  selectedCodes,
  onToggle,
  onSelectAll,
  productCounts = {},
}) => {
  const isAllSelected = selectedCodes.length === 0;

  return (
    <div className="brand-filter-chips" role="group" aria-label="브랜드 필터">
      {/* 전체 칩 */}
      <button
        type="button"
        className="brand-filter-chip"
        role="checkbox"
        aria-checked={isAllSelected}
        onClick={onSelectAll}
      >
        전체
        {!isAllSelected && selectedCodes.length > 0 && (
          <span style={{
            marginLeft: '4px',
            padding: '1px 6px',
            background: 'var(--color-primary)',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: 600,
          }}>
            {selectedCodes.length}
          </span>
        )}
      </button>

      {brands.map((brand) => {
        const isSelected = selectedCodes.includes(brand.code);
        const count = productCounts[brand.code];

        return (
          <button
            key={brand.code}
            type="button"
            className="brand-filter-chip"
            role="checkbox"
            aria-checked={isSelected}
            onClick={() => onToggle(brand.code)}
          >
            {isSelected && <Check size={12} aria-hidden="true" style={{ marginRight: '2px' }} />}
            {brand.imageUrl && (
              <img
                src={brand.imageUrl}
                alt=""
                className="brand-filter-chip__logo"
                loading="lazy"
                decoding="async"
              />
            )}
            {brand.name}
            {count !== undefined && (
              <span className="brand-filter-chip__count">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
});

BrandFilterChips.displayName = 'BrandFilterChips';
