/**
 * @file NoticeTab/index.tsx
 * @description 공지사항 탭 — BoardRow (TDS) + Badge
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Pin, Eye } from 'lucide-react';
import { Result, Badge, BoardRow, Board } from '../../../../design-system';
import type { BadgeColor } from '../../../../design-system';
import { noticeApi, Notice as ApiNotice } from '../../../../api/manual';
import AttachmentList from '../../../../components/common/AttachmentList';

interface Notice extends ApiNotice {
  type: 'NOTICE' | 'EVENT' | 'UPDATE';
  isPinned: boolean;
}

const TYPE_BADGE: Record<Notice['type'], { color: BadgeColor; label: string }> = {
  NOTICE: { color: 'blue', label: '공지' },
  EVENT: { color: 'red', label: '이벤트' },
  UPDATE: { color: 'teal', label: '업데이트' },
};

interface NoticeTabProps {
  expandId?: string | null;
  onExpandChange?: (id: string | null) => void;
}

export const NoticeTab: React.FC<NoticeTabProps> = ({ expandId, onExpandChange }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(
    expandId ? parseInt(expandId, 10) : null
  );

  useEffect(() => {
    const fetchNotices = async () => {
      setLoading(true);
      try {
        const data = await noticeApi.getActiveNotices();
        const mappedNotices: Notice[] = data.map((item) => {
          let type: Notice['type'] = 'NOTICE';
          let title = item.title;
          let isPinned = false;

          if (title.startsWith('[이벤트]')) {
            type = 'EVENT';
            title = title.replace('[이벤트]', '').trim();
          } else if (title.startsWith('[업데이트]')) {
            type = 'UPDATE';
            title = title.replace('[업데이트]', '').trim();
          } else if (title.startsWith('[중요]')) {
            isPinned = true;
            title = title.replace('[중요]', '').trim();
          }

          return { ...item, title, type, isPinned };
        });
        setNotices(mappedNotices);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchNotices();
  }, []);

  useEffect(() => {
    if (expandId) setExpandedId(parseInt(expandId, 10));
  }, [expandId]);

  const { pinnedNotices, regularNotices } = useMemo(
    () => ({
      pinnedNotices: notices.filter((n) => n.isPinned),
      regularNotices: notices.filter((n) => !n.isPinned),
    }),
    [notices]
  );

  const handleToggle = useCallback(
    (id: number) => {
      const newId = expandedId === id ? null : id;
      setExpandedId(newId);
      onExpandChange?.(newId?.toString() || null);
    },
    [expandedId, onExpandChange]
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date
      .toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .replace(/\. /g, '.')
      .replace(/\.$/, '');
  };

  const renderNoticeItem = (notice: Notice, isPinned: boolean = false) => {
    const config = TYPE_BADGE[notice.type];
    const isExpanded = expandedId === notice.id;

    return (
      <BoardRow
        key={notice.id}
        title={
          <span className="flex items-center gap-2 flex-wrap">
            {isPinned && (
              <Badge color="yellow" size="sm" variant="weak" icon={<Pin size={10} aria-hidden="true" />}>중요</Badge>
            )}
            <Badge color={config.color} size="sm" variant="weak">{config.label}</Badge>
            <span className="break-keep line-clamp-1">{notice.title}</span>
            <span className="text-xs text-base-content/40 shrink-0 hidden sm:inline ml-auto tabular-nums">
              {formatDate(notice.createdAt)}
            </span>
          </span>
        }
        icon={<BoardRow.ArrowIcon />}
        isOpened={isExpanded}
        onOpen={() => handleToggle(notice.id)}
        onClose={() => handleToggle(notice.id)}
        liAttributes={{}}
        className={isPinned ? 'border-2 border-primary/20 bg-primary/[0.02]' : ''}
      >
        <BoardRow.Text>
          {notice.content}
        </BoardRow.Text>

        <AttachmentList targetType="NOTICE" targetId={notice.id} />

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-grey-50 text-xs text-base-content/40">
          <span className="flex items-center gap-1">
            <Eye size={13} aria-hidden="true" />
            조회 {notice.viewCount.toLocaleString()}
          </span>
          <span>{formatDate(notice.createdAt)}</span>
        </div>
      </BoardRow>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="공지사항 로딩 중">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-14 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (notices.length === 0) {
    return (
      <Result
        icon="info"
        title="등록된 공지사항이 없습니다"
        description="새로운 소식이 곧 등록될 예정입니다."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {pinnedNotices.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Pin size={14} className="text-primary" aria-hidden="true" />
            고정된 공지
          </h3>
          <Board>
            {pinnedNotices.map((notice) => renderNoticeItem(notice, true))}
          </Board>
        </section>
      )}

      {regularNotices.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-3">
            전체 공지 ({regularNotices.length})
          </h3>
          <Board>
            {regularNotices.map((notice) => renderNoticeItem(notice, false))}
          </Board>
        </section>
      )}
    </div>
  );
};

export default NoticeTab;
