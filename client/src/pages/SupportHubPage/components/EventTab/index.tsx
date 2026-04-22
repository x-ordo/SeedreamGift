/**
 * @file EventTab/index.tsx
 * @description 이벤트 탭 - 이벤트 카드 그리드
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Gift, Calendar, Eye } from 'lucide-react';
import { Result, Modal } from '../../../../design-system';
import { eventApi, type Event as ApiEvent } from '../../../../api/manual';
import { formatDate } from '../../../../utils/dateUtils';
import AttachmentList from '../../../../components/common/AttachmentList';
import './EventTab.css';

type EventStatus = 'ongoing' | 'upcoming' | 'ended';

interface Event extends Omit<ApiEvent, 'startDate' | 'endDate'> {
  status: EventStatus;
  startDate: string;
  endDate: string;
  /** 원본 Date 객체 (D-Day 계산용) */
  endDateRaw: Date;
}

const STATUS_CONFIG: Record<Event['status'], { label: string }> = {
  ongoing: { label: '진행중' },
  upcoming: { label: '예정' },
  ended: { label: '종료' },
};

const FILTER_OPTIONS = [
  { id: 'all', label: '전체' },
  { id: 'ongoing', label: '진행중' },
  { id: 'upcoming', label: '예정' },
  { id: 'ended', label: '종료' },
];

/** HTML 태그 제거 — DOMParser 기반 (정규식보다 안전) */
const stripHtml = (html: string): string => {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

/**
 * API 이벤트를 컴포넌트 이벤트로 변환
 */
const transformEvent = (apiEvent: ApiEvent): Event => {
  const now = new Date();
  const startDate = new Date(apiEvent.startDate);
  const endDate = new Date(apiEvent.endDate);

  let status: EventStatus = 'ongoing';
  if (now < startDate) {
    status = 'upcoming';
  } else if (now > endDate) {
    status = 'ended';
  }

  return {
    ...apiEvent,
    status,
    endDateRaw: endDate,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
};

interface EventTabProps {
  onEventSelect?: (eventId: number) => void;
}

export const EventTab: React.FC<EventTabProps> = ({ onEventSelect }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'upcoming' | 'ended'>('all');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiEvents = await eventApi.getActiveEvents();
        const transformedEvents = apiEvents.map(transformEvent);
        setEvents(transformedEvents);
      } catch {
        setError('이벤트를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const { featuredEvent, filteredEvents } = useMemo(() => {
    const featured = events.find((e) => e.isFeatured && e.status === 'ongoing');
    let filtered = events.filter((e) => !e.isFeatured || e.status !== 'ongoing');

    if (filter !== 'all') {
      filtered = filtered.filter((e) => e.status === filter);
    }

    return { featuredEvent: featured, filteredEvents: filtered };
  }, [events, filter]);

  const calculateDDay = useCallback((endDateRaw: Date): { text: string; isUrgent: boolean } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const end = new Date(endDateRaw);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: '종료', isUrgent: false };
    if (diffDays === 0) return { text: 'D-DAY', isUrgent: true };
    if (diffDays <= 3) return { text: `D-${diffDays}`, isUrgent: true };
    return { text: `D-${diffDays}`, isUrgent: false };
  }, []);

  const selectedEvent = useMemo(() => {
    if (selectedEventId === null) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const handleEventClick = useCallback(
    (eventId: number) => {
      eventApi.incrementViewCount(eventId).catch(() => { /* 비필수: 조회수 카운트 */ });
      onEventSelect?.(eventId);
      setSelectedEventId(eventId);
    },
    [onEventSelect]
  );

  const handleCloseModal = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  if (loading) {
    return (
      <div className="event-tab">
        <div className="event-tab__skeleton-grid" role="status" aria-busy="true" aria-label="이벤트 로딩 중">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="event-tab__skeleton-card">
              <div className="event-tab__skeleton-image" />
              <div className="event-tab__skeleton-content">
                <div className="event-tab__skeleton-title" />
                <div className="event-tab__skeleton-desc" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-tab">
        <Result
          icon="warning"
          title="이벤트 로드 실패"
          description={error}
        />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="event-tab">
        <Result
          icon="info"
          title="진행중인 이벤트가 없습니다"
          description="새로운 이벤트가 곧 시작될 예정입니다."
        />
      </div>
    );
  }

  // 이벤트 상세 모달 렌더링
  const renderEventModal = () => {
    if (!selectedEvent) return null;

    const statusConfig = STATUS_CONFIG[selectedEvent.status];
    const dday = selectedEvent.status !== 'ended' ? calculateDDay(selectedEvent.endDateRaw) : null;

    return (
      <Modal
        isOpen={!!selectedEvent}
        onClose={handleCloseModal}
        title={selectedEvent.title}
        size="medium"
      >
        <div className="event-modal">
          <div className="event-modal__hero">
            {selectedEvent.imageUrl ? (
              <img
                src={selectedEvent.imageUrl}
                alt={selectedEvent.title}
                className="event-modal__image"
                width={400}
                height={200}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const placeholder = target.parentElement?.querySelector('.event-modal__image-placeholder') as HTMLElement;
                  if (placeholder) placeholder.style.display = '';
                }}
              />
            ) : null}
            <div className="event-modal__image-placeholder" style={selectedEvent.imageUrl ? { display: 'none' } : undefined}>
              <Gift size={32} aria-hidden="true" />
            </div>
          </div>

          <div className="event-modal__content">
            <div className="event-modal__badges">
              <span className={`event-card__status event-card__status--${selectedEvent.status}`}>
                {statusConfig.label}
              </span>
              {dday && (
                <span className={`event-card__dday ${dday.isUrgent ? 'event-card__dday--urgent' : ''}`}>
                  {dday.text}
                </span>
              )}
            </div>

            <div className="event-modal__meta">
              <div className="event-card__period">
                <Calendar size={14} aria-hidden="true" />
                {selectedEvent.startDate} ~ {selectedEvent.endDate}
              </div>
              <div className="event-card__views">
                <Eye size={14} aria-hidden="true" />
                {selectedEvent.viewCount.toLocaleString()}
              </div>
            </div>

            <hr className="event-modal__divider" />

            <div className="event-modal__body">
              {stripHtml(selectedEvent.description).split('\n').map((line, i) => (
                <p key={i}>{line || '\u00A0'}</p>
              ))}
            </div>

            <AttachmentList targetType="EVENT" targetId={selectedEvent.id} />
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div className="event-tab">
      {/* 진행중 하이라이트 배너 */}
      {featuredEvent && (
        <div className="event-tab__featured">
          <button
            type="button"
            className="event-featured-card"
            onClick={() => handleEventClick(featuredEvent.id)}
          >
            <div className="event-featured-card__image">
              {featuredEvent.imageUrl ? (
                <img
                  src={featuredEvent.imageUrl}
                  alt={featuredEvent.title}
                  width={400}
                  height={200}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : null}
            </div>
            <div className="event-featured-card__overlay">
              <div className="event-featured-card__badge">
                <span className="event-card__status event-card__status--ongoing">
                  {STATUS_CONFIG.ongoing.label}
                </span>
                {(() => {
                  const dday = calculateDDay(featuredEvent.endDateRaw);
                  return (
                    <span className={`event-card__dday ${dday.isUrgent ? 'event-card__dday--urgent' : ''}`}>
                      {dday.text}
                    </span>
                  );
                })()}
              </div>
              <h3 className="event-featured-card__title">{featuredEvent.title}</h3>
              <p className="event-featured-card__description">{stripHtml(featuredEvent.description)}</p>
              <div className="event-featured-card__period">
                <Calendar size={14} aria-hidden="true" />
                {featuredEvent.startDate} ~ {featuredEvent.endDate}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* 필터 */}
      <div className="event-tab__filters" role="tablist" aria-label="이벤트 필터">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            className={`event-tab__filter-chip ${
              filter === option.id
                ? 'event-tab__filter-chip--active rounded-full bg-gray-900 text-white border-gray-900 font-semibold'
                : 'rounded-full btn-ghost border border-base-300'
            }`}
            onClick={() => { setFilter(option.id as typeof filter); setVisibleCount(6); }}
            aria-selected={filter === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 이벤트 그리드 */}
      {filteredEvents.length === 0 ? (
        <Result
          icon="info"
          title="해당 조건의 이벤트가 없습니다"
          description="다른 필터를 선택해보세요."
        />
      ) : (
        <div className="event-tab__grid">
          {filteredEvents.slice(0, visibleCount).map((event) => {
            const statusConfig = STATUS_CONFIG[event.status];
            const dday = event.status !== 'ended' ? calculateDDay(event.endDateRaw) : null;

            return (
              <button
                type="button"
                key={event.id}
                className="event-card"
                onClick={() => handleEventClick(event.id)}
              >
                <div className="event-card__image">
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      width={300}
                      height={160}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const placeholder = target.parentElement?.querySelector('.event-card__image-placeholder') as HTMLElement;
                        if (placeholder) placeholder.style.display = '';
                      }}
                    />
                  ) : null}
                  <div className="event-card__image-placeholder" style={event.imageUrl ? { display: 'none' } : undefined}>
                    <Gift size={24} aria-hidden="true" />
                    <span>EVENT</span>
                  </div>
                  <div className="event-card__badge">
                    <span className={`event-card__status event-card__status--${event.status}`}>
                      {statusConfig.label}
                    </span>
                    {dday && (
                      <span className={`event-card__dday ${dday.isUrgent ? 'event-card__dday--urgent' : ''}`}>
                        {dday.text}
                      </span>
                    )}
                  </div>
                </div>
                <div className="event-card__content">
                  <h3 className="event-card__title">{event.title}</h3>
                  <p className="event-card__description">{stripHtml(event.description)}</p>
                  <div className="event-card__meta">
                    <div className="event-card__period">
                      <Calendar size={14} aria-hidden="true" />
                      {event.startDate} ~ {event.endDate}
                    </div>
                    <div className="event-card__views">
                      <Eye size={14} aria-hidden="true" />
                      {event.viewCount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 더보기 */}
      {filteredEvents.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => setVisibleCount(prev => prev + 6)}
            style={{
              padding: '10px 32px',
              borderRadius: '9999px',
              border: '1px solid var(--color-grey-200)',
              background: 'white',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-grey-600)',
              cursor: 'pointer',
            }}
          >
            더보기 ({filteredEvents.length - visibleCount}개)
          </button>
        </div>
      )}

      {/* 이벤트 상세 모달 */}
      {renderEventModal()}
    </div>
  );
};

export default EventTab;
