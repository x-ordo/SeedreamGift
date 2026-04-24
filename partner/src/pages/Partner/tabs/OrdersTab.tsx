/**
 * @file OrdersTab.tsx
 * @description Partner orders — read-only view of orders for partner's products
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Eye, X } from 'lucide-react';
import { partnerApi } from '@/api/manual';
import { usePartnerList } from '../hooks/usePartnerList';
import { ORDER_STATUS_MAP, PARTNER_PAGINATION } from '../constants';
import PaymentTimeline from '../components/PaymentTimeline';
import { usePartnerOrderTimeline, partnerEventLabel, partnerEventSummary } from '../hooks/usePartnerOrderTimeline';

const OrdersTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [detailModal, setDetailModal] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { events: timelineEvents, loading: timelineLoading, error: timelineError } =
    usePartnerOrderTimeline(detailModal?.id ?? null);

  // Focus trap for detail modal
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isModalOpen = detailModal !== null;

  useEffect(() => {
    if (isModalOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.[0]?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isModalOpen]);

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    search: searchFilter || undefined,
  }), [statusFilter, searchFilter]);

  const { items, loading, page, total, setPage } = usePartnerList<any>(
    (params) => partnerApi.getMyOrders(params),
    { filters, errorMessage: '주문 목록을 불러오는데 실패했습니다.' }
  );

  const totalPages = Math.ceil(total / PARTNER_PAGINATION.DEFAULT_PAGE_SIZE);

  const openDetail = async (orderId: number) => {
    setDetailLoading(true);
    setDetailModal({});
    try {
      const detail = await partnerApi.getMyOrderDetail(orderId);
      setDetailModal(detail);
    } catch {
      setDetailModal(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="partner-tab">
      {/* Filters */}
      <div className="partner-filter-card">
        <select
          className="partner-filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="주문 상태 필터"
        >
          <option value="">전체 상태</option>
          {Object.entries(ORDER_STATUS_MAP).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          type="text"
          className="partner-search-input"
          placeholder="주문번호 검색..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          aria-label="주문 검색"
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {/* Table */}
      <div className="partner-table-card">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption className="sr-only">주문 목록</caption>
          <thead>
            <tr>
              <th scope="col">주문번호</th>
              <th scope="col">고객</th>
              <th scope="col">상품</th>
              <th scope="col">수량</th>
              <th scope="col">금액</th>
              <th scope="col">상태</th>
              <th scope="col">날짜</th>
              <th scope="col">상세</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}><span role="status" aria-busy="true">로딩 중...</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>주문 내역이 없습니다.</td></tr>
            ) : (
              items.map((order: any) => {
                const status = ORDER_STATUS_MAP[order.status] || { label: order.status || '-', color: 'gray' };
                return (
                  <tr key={order.id}>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: 'var(--color-purple-500)' }}>
                      #{order.id}
                    </td>
                    <td>{order.userName || order.userEmail || '-'}</td>
                    <td>{order.productName || '-'}</td>
                    <td className="tabular-nums">{order.quantity ?? order.itemCount ?? 0}</td>
                    <td className="tabular-nums">{Number(order.totalAmount ?? 0).toLocaleString()}원</td>
                    <td><span className={`partner-badge ${status.color}`}>{status.label}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--color-grey-500)' }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="partner-btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => openDetail(order.id)}
                        aria-label={`주문 #${order.id} 상세 보기`}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="partner-pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</button>
          </div>
        )}
      </div>

      {/* Detail Modal (Read-only) */}
      {detailModal !== null && (
        <div className="partner-modal-overlay" onClick={() => setDetailModal(null)}>
          <div
            ref={modalRef}
            className="partner-modal"
            onClick={e => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="주문 상세"
          >
            <div className="partner-modal-header">
              <h3>주문 상세 #{detailModal?.id || ''}</h3>
              <button type="button" onClick={() => setDetailModal(null)} aria-label="닫기"><X size={20} /></button>
            </div>
            <div className="partner-modal-body">
              {detailLoading ? (
                <div role="status" aria-busy="true" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-grey-400)' }}>로딩 중...</div>
              ) : (
                <>
                  <div className="partner-info-card" style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', margin: '0 0 8px' }}>주문 정보</h4>
                    <div className="partner-info-row">
                      <span className="partner-info-label">주문번호</span>
                      <span className="partner-info-value" style={{ fontFamily: 'var(--font-family-mono)' }}>#{detailModal?.id}</span>
                    </div>
                    <div className="partner-info-row">
                      <span className="partner-info-label">고객</span>
                      <span className="partner-info-value">{detailModal?.userName || detailModal?.userEmail || '-'}</span>
                    </div>
                    <div className="partner-info-row">
                      <span className="partner-info-label">상태</span>
                      <span className="partner-info-value">
                        {(() => {
                          const s = ORDER_STATUS_MAP[detailModal?.status] || { label: detailModal?.status || '-', color: 'gray' };
                          return <span className={`partner-badge ${s.color}`}>{s.label}</span>;
                        })()}
                      </span>
                    </div>
                    <div className="partner-info-row">
                      <span className="partner-info-label">총 금액</span>
                      <span className="partner-info-value tabular-nums">{Number(detailModal?.totalAmount ?? 0).toLocaleString()}원</span>
                    </div>
                    <div className="partner-info-row">
                      <span className="partner-info-label">주문일시</span>
                      <span className="partner-info-value">
                        {detailModal?.createdAt ? new Date(detailModal.createdAt).toLocaleString('ko-KR') : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Order Items */}
                  {detailModal?.items && detailModal.items.length > 0 && (
                    <div className="partner-info-card">
                      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', margin: '0 0 8px' }}>상품 목록</h4>
                      {detailModal.items.map((item: any, i: number) => (
                        <div key={i} className="partner-info-row">
                          <span className="partner-info-label">{item.productName || `상품 ${i + 1}`}</span>
                          <span className="partner-info-value tabular-nums">
                            {item.quantity}개 / {Number(item.price ?? 0).toLocaleString()}원
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment Timeline (결제 시도 이력 — 서버에서 마스킹된 값) */}
                  <div className="partner-info-card" style={{ marginTop: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', margin: '0 0 8px' }}>
                      결제 시도 이력
                    </h4>
                    <PaymentTimeline items={detailModal?.payments} />
                  </div>

                  {/* Order Event Timeline — 발급/입금/취소/환불/바우처 사용 이력 */}
                  <div className="partner-info-card" style={{ marginTop: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', margin: '0 0 8px' }}>
                      주문 진행 이력
                    </h4>
                    {timelineLoading && (
                      <div style={{ fontSize: '12px', color: '#888' }} role="status">
                        이력 불러오는 중...
                      </div>
                    )}
                    {timelineError && (
                      <div style={{ fontSize: '12px', color: '#c33' }} role="alert">
                        {timelineError}
                      </div>
                    )}
                    {!timelineLoading && !timelineError && timelineEvents.length === 0 && (
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        아직 기록된 이력이 없어요
                      </div>
                    )}
                    {!timelineLoading && !timelineError && timelineEvents.length > 0 && (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {timelineEvents.map((e) => {
                          const summary = partnerEventSummary(e);
                          return (
                            <li
                              key={e.id}
                              style={{
                                padding: '8px 0',
                                borderBottom: '1px solid #eee',
                                fontSize: '13px',
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>{partnerEventLabel(e.eventType)}</div>
                              <time
                                dateTime={e.createdAt}
                                style={{ display: 'block', marginTop: '2px', fontSize: '11px', color: '#888' }}
                              >
                                {new Date(e.createdAt).toLocaleString('ko-KR')}
                              </time>
                              {summary && (
                                <div style={{ marginTop: '4px', fontSize: '12px', color: '#555' }}>
                                  {summary}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="partner-modal-footer">
              <button type="button" className="partner-btn-secondary" onClick={() => setDetailModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
