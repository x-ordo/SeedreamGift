/**
 * @file NoticeSection.tsx
 * @description 홈페이지 공지사항 섹션 - Toss TableRow 스타일 공지 목록
 * @module components/home
 *
 * 사용처:
 * - HomePage: 메인 페이지에서 최신 공지사항 4건을 간략히 표시
 */
import React, { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListHeader, ListHeaderTitleParagraph, TextButton, Skeleton } from '../../design-system';
import { axiosInstance } from '../../lib/axios';
import './NoticeSection.css';

interface Notice {
  id: number;
  title: string;
  createdAt: string;
  isActive: boolean;
}

export const NoticeSection: React.FC = memo(() => {
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axiosInstance.get('/notices/active')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) {
          setNotices(res.data.slice(0, 4));
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleNoticeClick = (id: number) => {
    navigate(`/notices?expand=${id}`);
  };

  const handleViewAll = () => {
    navigate('/support?tab=notice');
  };

  // 공지사항이 없으면 섹션 자체를 숨김 (로딩 중에는 스켈레톤 표시 유지)
  if (!loading && notices.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const isNew = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  return (
    <section className="notice-section">

      <ListHeader
        title={
          <ListHeaderTitleParagraph typography="t4" fontWeight="bold">
            공지사항
          </ListHeaderTitleParagraph>
        }
        right={
          <TextButton
            size="sm"
            variant="arrow"
            color="tertiary"
            onClick={handleViewAll}
          >
            전체보기
          </TextButton>
        }
      />

      <div className="notice-table">
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="notice-row cursor-default">
              <div className="notice-row-left">
                <Skeleton width="70%" height={14} />
              </div>
              <Skeleton width={80} height={12} />
            </div>
          ))
        ) : notices.length === 0 ? (
          <div className="notice-row cursor-default justify-center">
            <span className="text-base-content/50">등록된 공지사항이 없습니다</span>
          </div>
        ) : (
          notices.map((notice, idx) => (
            <button
              key={notice.id}
              type="button"
              className="notice-row"
              onClick={() => handleNoticeClick(notice.id)}
            >
              <div className="notice-row-left">
                {idx === 0 && (
                  <span className="notice-badge notice-badge-important">중요</span>
                )}
                {idx !== 0 && isNew(notice.createdAt) && (
                  <span className="notice-badge notice-badge-new">NEW</span>
                )}
                <span className="notice-title">{notice.title}</span>
              </div>
              <span className="notice-date">{formatDate(notice.createdAt)}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
});

NoticeSection.displayName = 'NoticeSection';

export default NoticeSection;
