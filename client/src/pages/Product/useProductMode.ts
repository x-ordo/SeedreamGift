/**
 * @file useProductMode.ts
 * @description 상품 목록 페이지의 브랜드 선택 상태를 URL 파라미터로 관리하는 훅
 * @module pages/Product
 *
 * URL 파라미터 설계:
 * - /products → 전체 브랜드 (필터 없음)
 * - /products?brand=HYUNDAI → 단일 브랜드 필터 (딥링크 호환)
 * - /products?brand=HYUNDAI,SHINSEGAE → 멀티 브랜드 필터
 *
 * 판매 모드(trade-in)는 기존 단일 브랜드 인터페이스 유지 (selectedBrand, clearBrand)
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useProductMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const brandParam = searchParams.get('brand');

  // 파싱: "HYUNDAI,SHINSEGAE" → ["HYUNDAI", "SHINSEGAE"], null → []
  const selectedBrands: string[] = useMemo(() => {
    if (!brandParam) return [];
    return brandParam.split(',').filter(Boolean);
  }, [brandParam]);

  // 브랜드 토글 (멀티 선택)
  const toggleBrand = useCallback((code: string) => {
    const current = new Set(selectedBrands);
    if (current.has(code)) current.delete(code);
    else current.add(code);

    if (current.size === 0) {
      setSearchParams({});
    } else {
      setSearchParams({ brand: [...current].join(',') });
    }
  }, [selectedBrands, setSearchParams]);

  // 전체 브랜드 선택 해제 (= 전체 표시)
  const clearBrands = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  // 판매 모드 호환용 레거시 인터페이스
  const selectedBrand = selectedBrands[0] || null;
  const clearBrand = clearBrands;

  // 단일 브랜드 설정 (판매 모드용)
  const setBrand = useCallback((brandCode: string) => {
    setSearchParams({ brand: brandCode });
  }, [setSearchParams]);

  return {
    // 멀티브랜드 (구매 모드)
    selectedBrands,
    toggleBrand,
    clearBrands,
    // 레거시 (판매 모드 호환)
    selectedBrand,
    setBrand,
    clearBrand,
  };
}
