/**
 * @file TestimonialCarousel.tsx
 * @description 고객 후기를 가로 스크롤 캐러셀로 보여주는 컴포넌트
 * @module components/home
 */
import React, { useRef, useState, useEffect, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ListHeader, ListHeaderTitleParagraph } from '../../design-system';

/**
 * 고객 후기 데이터 인터페이스
 */
interface Testimonial {
  id: number;
  name: string;
  rating: number;
  text: string;
  brandUsed: string;
  date: string;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    name: '김*현',
    rating: 5,
    text: '주문하고 바로 PIN 번호 받았어요. 다른 곳보다 할인율도 좋고 빠르네요!',
    brandUsed: '신세계',
    date: '2026-01-28',
  },
  {
    id: 2,
    name: '이*수',
    rating: 5,
    text: '상품권 매입 신청했는데 당일 입금 완료! 정산도 정확하고 믿을 수 있어요.',
    brandUsed: '현대',
    date: '2026-01-25',
  },
  {
    id: 3,
    name: '박*진',
    rating: 4,
    text: '사이트가 깔끔하고 시세 확인이 편해요. 자주 이용하게 됩니다.',
    brandUsed: '롯데',
    date: '2026-01-22',
  },
  {
    id: 4,
    name: '최*영',
    rating: 5,
    text: '카카오톡 상담 응대가 빠르고 친절해서 안심하고 거래했습니다.',
    brandUsed: '다이소',
    date: '2026-01-20',
  },
  {
    id: 5,
    name: '정*호',
    rating: 5,
    text: '대량 구매 시 추가 할인도 되고, 파트너 혜택이 좋아요.',
    brandUsed: '올리브영',
    date: '2026-01-18',
  },
];

/** 별점을 SVG 아이콘으로 시각화하는 서브 컴포넌트 */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-[1px]" aria-label={`별점 ${rating}점`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={star <= rating ? 'var(--color-point)' : 'var(--color-grey-200)'}
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export const TestimonialCarousel: React.FC = memo(() => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scroll('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      scroll('right');
    }
  };

  return (
    <section className="mt-6">
      <ListHeader
        title={
          <ListHeaderTitleParagraph typography="t4" fontWeight="bold">
            고객 후기
          </ListHeaderTitleParagraph>
        }
        right={
          <div className="flex gap-1">
            <button
              type="button"
              className="btn btn-square btn-ghost border-base-300 hover:border-primary hover:text-primary transition-colors min-w-[44px] min-h-[44px]"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="이전 후기"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="btn btn-square btn-ghost border-base-300 hover:border-primary hover:text-primary transition-colors min-w-[44px] min-h-[44px]"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="다음 후기"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth py-2 pb-4 scrollbar-hide"
        role="region"
        aria-label="고객 후기 목록 — 좌우 화살표 키로 탐색"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {DEFAULT_TESTIMONIALS.map((t) => (
          <article
            key={t.id}
            className="card card-bordered bg-base-100 p-5 flex-none w-[280px] md:w-[320px] snap-start rounded-2xl hover:border-primary/30 hover:shadow-lg transition-[border-color,box-shadow] duration-300 flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-3">
              <StarRating rating={t.rating} />
              <span className="badge badge-primary badge-soft badge-sm font-medium">
                {t.brandUsed}
              </span>
            </div>
            <p className="text-body text-base-content/80 leading-relaxed mb-4 flex-1 break-keep">
              {t.text}
            </p>
            <div className="flex items-center justify-between pt-3 border-t border-base-200 mt-auto">
              <span className="text-caption font-semibold text-base-content/80">
                {t.name}
              </span>
              <span className="text-caption text-base-content/50">
                {t.date}
              </span>
            </div>
          </article>
        ))}
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </section>
  );
});

TestimonialCarousel.displayName = 'TestimonialCarousel';

export default TestimonialCarousel;
