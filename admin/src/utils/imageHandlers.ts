/**
 * @file imageHandlers.ts
 * @description 이미지 관련 유틸리티 함수
 * @module utils
 *
 * 사용처:
 * - ProductCard: 상품 이미지 에러 핸들링
 * - CheckoutPage: 상품 이미지 에러 핸들링
 */
import React from 'react';

/**
 * 기본 상품 이미지 경로
 */
export const DEFAULT_PRODUCT_IMAGE = '/assets/img/product/shin_5.svg';

/**
 * 기본 브랜드 이미지 경로
 */
export const DEFAULT_BRAND_IMAGE = '/images/brands/shinsegae.svg';

/**
 * 이미지 로드 에러 시 기본 이미지로 대체
 *
 * @param e - 이미지 에러 이벤트
 * @param fallbackSrc - 대체할 이미지 경로 (기본: DEFAULT_PRODUCT_IMAGE)
 *
 * @example
 * <img
 *   src={product.imageUrl}
 *   onError={(e) => handleImageError(e)}
 * />
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement>,
  fallbackSrc: string = DEFAULT_PRODUCT_IMAGE
): void => {
  e.currentTarget.src = fallbackSrc;
  // 무한 루프 방지: onerror 핸들러 제거
  e.currentTarget.onerror = null;
};

/**
 * 이미지 에러 핸들러 팩토리
 * - 다양한 fallback 이미지를 지원하는 핸들러 생성
 *
 * @param fallbackSrc - 대체할 이미지 경로
 * @returns 이벤트 핸들러 함수
 *
 * @example
 * <img onError={createImageErrorHandler('/assets/img/brand/default.png')} />
 */
export const createImageErrorHandler = (
  fallbackSrc: string
): ((e: React.SyntheticEvent<HTMLImageElement>) => void) => {
  return (e: React.SyntheticEvent<HTMLImageElement>) => handleImageError(e, fallbackSrc);
};

/**
 * 이미지 URL 유효성 검사 및 기본값 반환
 *
 * @param url - 확인할 이미지 URL
 * @param fallback - 기본값 (기본: DEFAULT_PRODUCT_IMAGE)
 * @returns 유효한 URL 또는 기본값
 */
export const getValidImageUrl = (
  url: string | null | undefined,
  fallback: string = DEFAULT_PRODUCT_IMAGE
): string => {
  if (!url || url.trim() === '') {
    return fallback;
  }
  return url;
};
