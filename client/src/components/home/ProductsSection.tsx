/**
 * @file ProductsSection.tsx
 * @description 홈페이지 인기 상품권 그리드 섹션 - Toss GridList 스타일
 * @module components/home
 *
 * 사용처:
 * - HomePage: 메인 페이지에서 브랜드(상품권 타입)별 그리드 카드를 표시
 *
 * 주요 Props:
 * - loading: 데이터 로딩 상태 (true일 때 스켈레톤 표시)
 * - voucherTypeGroups: 브랜드별로 그룹화된 상품 데이터 배열
 * - navigate: 라우터 네비게이션 함수 (부모에서 주입)
 *
 * 구성:
 * - VoucherTypeCard: 개별 브랜드 카드 (이미지/이름/상품 수)
 * - ProductsSection: 전체 섹션 (헤더 + 그리드 + 빈 상태 처리)
 */
import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Skeleton,
    Result,
    ListHeader,
    ListHeaderTitleParagraph,
    TextButton,
    FadeIn
} from '../../design-system';
import { Product } from '../../types';

/* 상품권 카드 - Toss GridList 스타일 */
interface VoucherTypeCardProps {
    displayName: string;
    color: string;
    image?: string;
    onClick: () => void;
}

const VoucherTypeCard = memo(({ displayName, color, image, onClick }: VoucherTypeCardProps) => {
    return (
        <button
            type="button"
            className="grid-list-item"
            onClick={onClick}
            aria-label={`${displayName} 상품권`}
        >
            <div className="grid-list-item-image">
                {image ? (
                    <img src={image} alt={`${displayName} 로고`} loading="lazy" decoding="async" width={56} height={56} />
                ) : (
                    <div className="grid-list-item-fallback" style={{ background: color }}>
                        {displayName.charAt(0)}
                    </div>
                )}
            </div>
            <span className="grid-list-item-text text-sm md:text-base font-bold">{displayName}</span>
        </button>
    );
});

VoucherTypeCard.displayName = 'VoucherTypeCard';

/* Products Section */
interface ProductsSectionProps {
    loading: boolean;
    voucherTypeGroups: Array<{
        voucherType: string;
        products: Product[];
        minPrice: number;
        maxDiscount: number;
        displayName: string;
        color: string;
        image?: string;
    }>;
    navigate: ReturnType<typeof useNavigate>;
}

export const ProductsSection = memo(({ loading, voucherTypeGroups, navigate }: ProductsSectionProps) => {
    return (
        <section className="brands-section">
            <FadeIn direction="up" distance={20}>
                <ListHeader
                    title={
                        <ListHeaderTitleParagraph typography="t5" fontWeight="bold">
                            인기 상품권
                        </ListHeaderTitleParagraph>
                    }
                    right={
                        <TextButton
                            size="sm"
                            variant="arrow"
                            color="tertiary"
                            onClick={() => navigate('/products')}
                        >
                            전체보기
                        </TextButton>
                    }
                />
            </FadeIn>

            {loading ? (
                <div className="brand-grid" role="status" aria-busy="true" aria-label="상품 로딩 중">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="brand-card-vertical skeleton-card">
                            <div className="brand-card-top bg-base-300">
                                <Skeleton width={64} height={64} className="rounded-2xl" />
                            </div>
                            <div className="brand-card-bottom">
                                <Skeleton width="60%" height={24} />
                                <Skeleton width="80%" height={16} className="mt-2" />
                                <Skeleton width="100%" height={1} className="mt-4" />
                                <Skeleton width="50%" height={20} className="mt-3" />
                            </div>
                        </Card>
                    ))}
                </div>
            ) : voucherTypeGroups.length === 0 ? (
                <div className="no-products-found" role="status" aria-live="polite">
                    <Result
                        icon="info"
                        title="현재 판매 중인 상품이 없습니다"
                        description="곧 새로운 상품이 등록될 예정입니다."
                    />
                </div>
            ) : (
                <div className="grid-list">
                    {voucherTypeGroups.map((group) => (
                        <VoucherTypeCard
                            key={group.voucherType}
                            displayName={group.displayName}
                            color={group.color}
                            image={group.image}
                            onClick={() => navigate(`/voucher-types/${encodeURIComponent(group.voucherType)}`)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
});

ProductsSection.displayName = 'ProductsSection';