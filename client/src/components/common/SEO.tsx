/**
 * @file SEO.tsx
 * @description 페이지별 메타 태그를 동적으로 주입하는 SEO 컴포넌트
 * @module components/common
 *
 * 사용처:
 * - 각 페이지 컴포넌트: 페이지 타이틀, OG 태그, 트위터 카드 등을 개별 설정
 *
 * react-helmet-async를 사용하여 SSR 호환 가능한 방식으로 <head> 태그를 관리한다.
 * title이 없으면 기본 사이트 타이틀을, 있으면 "페이지명 | 씨드림기프트" 형식으로 조합한다.
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';
import siteConfig from '../../../../site.config.json';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
    url?: string;
}

const SEO: React.FC<SEOProps> = ({
    title,
    description = '신세계, 현대, 롯데 백화점 상품권 최저가 판매 및 고가 매입 플랫폼',
    keywords = '상품권, 백화점상품권, 신세계상품권, 현대백화점상품권, 롯데상품권, 상품권현금화, 상품권매입, 상품권판매',
    image,
    url
}) => {
    const metaTitle = title ? `${title} | ${siteConfig.company.brand}` : `${siteConfig.company.brand} - 상품권 거래 플랫폼`;

    return (
        <Helmet>
            <title>{metaTitle}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            <meta property="og:title" content={metaTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:type" content="website" />
            <meta property="og:image" content={image || `${import.meta.env.VITE_OG_IMAGE_URL || '/og-image.png'}`} />
            <meta property="og:url" content={url || (typeof window !== 'undefined' ? window.location.href : '')} />
            <meta property="og:site_name" content={siteConfig.company.nameShort} />
            <meta property="og:locale" content="ko_KR" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={metaTitle} />
            <meta name="twitter:description" content={description} />
        </Helmet>
    );
};

export default SEO;
