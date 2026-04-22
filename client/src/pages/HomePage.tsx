/**
 * @file HomePage.tsx
 * @description 홈 페이지 - 플랫폼 메인 랜딩 페이지
 * @module pages
 * @route / (루트 경로)
 *
 * 레이아웃 구성:
 * - Hero 섹션 (전폭): 메인 배너, CTA 버튼
 * - 2열 레이아웃 (데스크탑):
 *   - 메인 영역: 인기 상품권 그리드, 공지사항, 고객지원 배너
 *   - 사이드바: 실시간 거래 현황 대시보드 (sticky)
 * - Final CTA 섹션 (전폭): 매입 안내 및 신청 유도
 *
 * 주요 기능:
 * - 브랜드별 상품 그룹화 및 가격 범위 표시
 * - 실시간 거래 피드 (LiveDashboard)
 * - 브랜드 카드 클릭 시 /products?brand=XXX로 이동
 *
 * 데이터 흐름:
 * - ProductsApi.findAll() → 전체 상품 목록 조회
 * - useBrands() → DB 정렬 순서대로 브랜드 목록 조회
 * - voucherTypeGroups → 브랜드별 상품 그룹화 (useMemo)
 */
import '../components/home/Home.css';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/common/SEO';
import { FadeIn, Stagger } from '../design-system';
import { Product } from '../types';
import { useBrands, useProducts } from '../hooks';
import { ShoppingBag, Tag, Zap, Shield } from 'lucide-react';
import { COLORS } from '../constants/designTokens';
import siteConfig from '../../../site.config.json';

// Home Components
import {
  LiveDashboard,
  NoticeSection,
  HeroSection,
  ProductsSection,
  FinalCTASection,
  QuickMenu,
  RateTicker,
  HowToGuide
} from '../components/home';


export default function HomePage() {
  const navigate = useNavigate();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const loading = productsLoading;

  const voucherTypeGroups = useMemo(() => {
    if (!brands.length) return [];

    const groups: Record<string, { products: Product[]; minPrice: number; maxDiscount: number }> = {};

    products.forEach((p) => {
      // DB의 Product.brand (예: '신세계')와 Brand.code (예: 'SHINSEGAE') 매칭을 위해 정규화 필요할 수 있음
      const vtype = p.brandCode;
      if (!groups[vtype]) {
        groups[vtype] = { products: [], minPrice: Infinity, maxDiscount: 0 };
      }
      groups[vtype].products.push(p);
      groups[vtype].minPrice = Math.min(groups[vtype].minPrice, Number(p.buyPrice) || 0);
      groups[vtype].maxDiscount = Math.max(groups[vtype].maxDiscount, p.discountRate);
    });

    // DB 정렬 순서(order)대로 정렬된 brands 사용
    return brands
      .filter(brand => groups[brand.name] || groups[brand.code]) // 한글 이름 또는 코드로 매칭
      .map(brand => {
        const group = groups[brand.name] || groups[brand.code];
        return {
          voucherType: brand.code,
          displayName: brand.name,
          color: brand.color || COLORS.primary,
          description: brand.description || '',
          image: brand.imageUrl,
          ...group
        };
      });
  }, [products, brands]);

  return (
    <div className="page-container">
      <SEO title={`${siteConfig.company.nameShort} - 상품권 최저가 구매 · 최고가 판매`} description="신세계, 현대, 롯데 등 백화점 상품권을 최저가에 구매하고 최고가에 판매하세요." />
      <div className="home-page">
        {/* 전체 너비: 히어로 섹션 */}
        <HeroSection navigate={navigate} />

        {/* 모바일 전용: 시세 티커 & 퀵 메뉴 */}
        <div className="md:hidden">
          <RateTicker compact interval={3000} className="border-bottom" />
          <QuickMenu />
        </div>

        {/* 통계 요약 — 전체 너비 스트립 */}
        <div className="home-stats-strip">
          <Stagger className="home-stats-inner" staggerDelay={0.06} direction="up" distance={15}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
              <div className="home-stat-card">
                <div className="home-stat-icon">
                  <ShoppingBag size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="home-stat-label">취급 브랜드</div>
                  <div className="home-stat-value tabular-nums">{voucherTypeGroups.length}개</div>
                </div>
              </div>
              <div className="home-stat-card">
                <div className="home-stat-icon">
                  <Tag size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="home-stat-label">전체 권종</div>
                  <div className="home-stat-value tabular-nums">{products.length}개</div>
                </div>
              </div>
              <div className="home-stat-card home-stat-card--success">
                <div className="home-stat-icon home-stat-icon--success">
                  <Zap size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="home-stat-label">최대 구매 할인</div>
                  <div className="home-stat-value tabular-nums">
                    {voucherTypeGroups.length > 0 ? Math.max(...voucherTypeGroups.map(g => g.maxDiscount)) : 0}%
                  </div>
                </div>
              </div>
              <div className="home-stat-card home-stat-card--primary">
                <div className="home-stat-icon home-stat-icon--primary">
                  <Shield size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="home-stat-label">즉시 PIN 발급</div>
                  <div className="home-stat-value">30초</div>
                </div>
              </div>
            </div>
          </Stagger>
        </div>

        {/* 2열 레이아웃: 데스크탑에서만 */}
        <div className="home-two-column">
          {/* 왼쪽: 상품 선택 영역 */}
          <div className="home-main">
            <ProductsSection loading={loading || brandsLoading} voucherTypeGroups={voucherTypeGroups} navigate={navigate} />
            <NoticeSection />
          </div>

          {/* 오른쪽: 사이드바 (sticky) — 모바일에서 SupportContactBanner보다 상단 */}
          <aside className="home-sidebar">
            <LiveDashboard maxItems={8} />
          </aside>

          {/* 하단: 이용 방법 — 모바일에서 사이드바 아래 */}
          <div className="home-bottom">
            <HowToGuide />
          </div>
        </div>

        {/* 전체 너비: 최종 CTA */}
        <FinalCTASection navigate={navigate} />
      </div>
    </div>
  );
}