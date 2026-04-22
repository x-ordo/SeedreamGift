/**
 * @file FaqTab/index.tsx
 * @description FAQ 탭 — BoardRow (TDS) + 카테고리 필터
 */
import React, { useState, useEffect, useMemo, useCallback, createElement } from 'react';
import { LayoutGrid, CreditCard, Info, User, Truck, ArrowLeftRight, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Result, Badge, BoardRow, Board } from '../../../../design-system';
import type { BadgeColor } from '../../../../design-system';
import { faqApi, type Faq } from '../../../../api/manual';

type FaqItem = Faq;

interface FaqCategory {
  id: string;
  label: string;
  icon: LucideIcon;
}

const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'all', label: '전체', icon: LayoutGrid },
  { id: 'payment', label: '결제/환불', icon: CreditCard },
  { id: 'usage', label: '이용 안내', icon: Info },
  { id: 'member', label: '회원/인증', icon: User },
  { id: 'delivery', label: '배송', icon: Truck },
  { id: 'tradein', label: '매입/판매', icon: ArrowLeftRight },
];

const CATEGORY_BADGE: Record<string, { color: BadgeColor; label: string }> = {
  payment: { color: 'blue', label: '결제/환불' },
  usage: { color: 'teal', label: '이용 안내' },
  member: { color: 'yellow', label: '회원/인증' },
  delivery: { color: 'elephant', label: '배송' },
  tradein: { color: 'red', label: '매입/판매' },
};

const CATEGORY_MAP: Record<string, string> = {
  GENERAL: 'usage',
  PAYMENT: 'payment',
  TRADE_IN: 'tradein',
  ACCOUNT: 'member',
  SHIPPING: 'delivery',
};

interface FaqTabProps {
  category?: string;
  expandId?: string | null;
  onCategoryChange?: (category: string) => void;
  onExpandChange?: (id: string | null) => void;
}

export const FaqTab: React.FC<FaqTabProps> = ({
  category = 'all',
  expandId,
  onCategoryChange,
  onExpandChange,
}) => {
  const [faqData, setFaqData] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(
    expandId ? parseInt(expandId, 10) : null
  );
  const [helpfulIds, setHelpfulIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiFaqs = await faqApi.getActiveFaqs();
        const transformedFaqs = apiFaqs.map((faq) => ({
          ...faq,
          category: CATEGORY_MAP[faq.category] || faq.category.toLowerCase(),
        }));
        setFaqData(transformedFaqs);
      } catch {
        setError('FAQ를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchFaqs();
  }, []);

  useEffect(() => {
    if (expandId) setExpandedId(parseInt(expandId, 10));
  }, [expandId]);

  const filteredFaq = useMemo(() => {
    if (category === 'all') return faqData;
    return faqData.filter((item) => item.category === category);
  }, [faqData, category]);

  const handleToggle = useCallback(
    (id: number) => {
      const newId = expandedId === id ? null : id;
      setExpandedId(newId);
      onExpandChange?.(newId?.toString() || null);
    },
    [expandedId, onExpandChange]
  );

  const handleHelpful = useCallback((id: number, helpful: boolean) => {
    setHelpfulIds((prev) => {
      const newSet = new Set(prev);
      if (helpful) {
        newSet.add(id);
        faqApi.incrementHelpfulCount(id).catch(() => { /* 비필수: 도움됨 카운트 */ });
      }
      return newSet;
    });
  }, []);

  if (loading) {
    return (
      <div role="status" aria-busy="true" aria-label="FAQ 로딩 중">
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-14 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <Result icon="warning" title="FAQ 로드 실패" description={error} />;
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* 카테고리 필터 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none py-3" role="tablist" aria-label="FAQ 카테고리">
        {FAQ_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            className={`btn btn-sm gap-1.5 rounded-full min-h-[44px] whitespace-nowrap ${
              category === cat.id
                ? 'bg-grey-900 text-white border-grey-900 font-semibold'
                : 'btn-ghost border border-grey-200 text-base-content/60'
            }`}
            onClick={() => onCategoryChange?.(cat.id)}
            aria-selected={category === cat.id}
          >
            {createElement(cat.icon, { size: 14, 'aria-hidden': true })}
            {cat.label}
          </button>
        ))}
      </div>

      {/* FAQ 목록 — BoardRow (TDS) */}
      {filteredFaq.length === 0 ? (
        <Result icon="info" title="해당 카테고리에 FAQ가 없습니다" description="다른 카테고리를 선택해보세요." />
      ) : (
        <Board>
          {filteredFaq.map((item) => {
            const config = CATEGORY_BADGE[item.category] || { color: 'elephant' as BadgeColor, label: '기타' };
            const isExpanded = expandedId === item.id;
            const isHelpful = helpfulIds.has(item.id);

            return (
              <BoardRow
                key={item.id}
                title={
                  <span className="flex items-center gap-2 flex-wrap">
                    <Badge color={config.color} size="sm" variant="weak">{config.label}</Badge>
                    <span className="break-keep">{item.question}</span>
                  </span>
                }
                prefix={<BoardRow.Prefix color="var(--color-primary)" fontWeight="bold">Q</BoardRow.Prefix>}
                icon={<BoardRow.ArrowIcon />}
                isOpened={isExpanded}
                onOpen={() => handleToggle(item.id)}
                onClose={() => handleToggle(item.id)}
                liAttributes={{}}
              >
                <BoardRow.Text>
                  {item.answer}
                </BoardRow.Text>

                {/* 도움 피드백 */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-grey-50">
                  <button
                    type="button"
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isHelpful ? 'text-primary bg-primary/5' : 'text-base-content/40 hover:text-primary hover:bg-primary/5'
                    }`}
                    onClick={() => handleHelpful(item.id, true)}
                    disabled={isHelpful}
                  >
                    <ThumbsUp size={13} aria-hidden="true" />
                    도움됐어요
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-base-content/40 hover:text-error hover:bg-error/5 transition-colors"
                    onClick={() => handleHelpful(item.id, false)}
                    disabled={isHelpful}
                  >
                    <ThumbsDown size={13} aria-hidden="true" />
                    아니요
                  </button>
                </div>
              </BoardRow>
            );
          })}
        </Board>
      )}
    </div>
  );
};

export default FaqTab;
