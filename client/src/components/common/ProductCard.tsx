/**
 * @file ProductCard.tsx
 * @description 상품 카드 컴포넌트 (BestSellers용 레거시)
 * @module components/common
 *
 * 최적화:
 * - React.memo 적용
 * - 중복 이미지 로드 제거 (CSS hover 효과로 대체)
 * - 이미지 에러 핸들러 모듈 레벨 정의
 *
 * NOTE: 새로운 상품 카드는 HomePage/ProductListPage에 정의됨
 */
import React, { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Eye, Star, StarHalf } from 'lucide-react';
import { IMAGE_PLACEHOLDER_URL } from '../../constants';

interface ProductCardProps {
  id: string;
  title: string;
  price: string;
  image: string;
  tag?: string;
  ratingCount: number;
}

/** 이미지 에러 핸들러 (모듈 레벨) */
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.src = IMAGE_PLACEHOLDER_URL;
};

export const ProductCard: React.FC<ProductCardProps> = memo(({ id, title, price, image, tag, ratingCount }) => {
  const navigate = useNavigate();

  return (
    <div className="product-card">
      <div className="product-image">
        <Link to={`/product/${id}`}>
          {/* 단일 이미지 - CSS hover 효과로 확대/밝기 변경 */}
          <img
            src={image}
            className="img-fluid product-image-hover"
            alt={title}
            loading="lazy"
            decoding="async"
            onError={handleImageError}
            width={200}
            height={200}
          />
        </Link>
        {tag && (
          <div className="product-tags">
            <span className="badge badge-error badge-sm">{tag}</span>
          </div>
        )}
        <div className="product-actions">
          <button className="btn-wishlist" type="button" aria-label="위시리스트에 추가">
            <Heart size={16} aria-hidden="true" />
          </button>
          <button className="btn-quickview" type="button" aria-label="빠른 보기">
            <Eye size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="product-info">
        <h3 className="product-title"><Link to={`/product/${id}`}>{title}</Link></h3>
        <div className="product-price">
          <span className="current-price">{price}</span>
        </div>
        <div className="product-rating" role="img" aria-label={`${ratingCount}개 리뷰`}>
          <Star size={14} fill="currentColor" aria-hidden="true" />
          <Star size={14} fill="currentColor" aria-hidden="true" />
          <Star size={14} fill="currentColor" aria-hidden="true" />
          <Star size={14} fill="currentColor" aria-hidden="true" />
          <StarHalf size={14} fill="currentColor" aria-hidden="true" />
          <span className="rating-count" aria-hidden="true">({ratingCount})</span>
        </div>
        <div className="add-to-cart-container flex gap-2">
          <button
            type="button"
            className="add-to-cart-btn grow"
            onClick={() => navigate(`/product/${id}`)}
            aria-label={`${title} 장바구니에 담기`}
          >
            장바구니
          </button>
          <button
            type="button"
            className="add-to-cart-btn grow"
            onClick={() => navigate(`/product/${id}`)}
            aria-label={`${title} 바로 구매하기`}
          >
            구매하기
          </button>
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
