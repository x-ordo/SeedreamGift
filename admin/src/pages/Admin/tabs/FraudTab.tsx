/**
 * @file FraudTab.tsx
 * @description 사기 조회 관리 탭 - FRAUD_HOLD 주문/매입 관리 및 더치트 사기 조회
 * @module pages/Admin/tabs
 *
 * 3개 섹션:
 * 1. FRAUD_HOLD 주문/매입 목록 (보류 해제 가능)
 * 2. 사용자 사기 조회 (더치트 API 연동)
 * 3. 보류 해제 확인 모달
 */
import { useState } from 'react';
import { ShieldAlert, Search, ExternalLink, AlertTriangle, CheckCircle, UserX, UserCheck } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Badge, Button } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { formatPrice, formatRelativeTime, maskEmail } from '../../../utils';
import { COLORS } from '../../../constants/designTokens';
import {
  ORDER_STATUS_COLOR_MAP,
  ORDER_STATUS_OPTIONS,
  TRADEIN_STATUS_COLOR_MAP,
  TRADEIN_STATUS_OPTIONS,
  ADMIN_PAGINATION,
} from '../constants';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList } from '../hooks';

// ── Types ──

interface HoldOrder {
  id: number;
  orderCode?: string | null;
  user?: { id: number; name: string; email: string };
  totalAmount: number;
  status: string;
  createdAt: string;
  adminNote?: string;
}

interface HoldTradeIn {
  id: number;
  user?: { id: number; name: string; email: string };
  brandCode: string;
  productName: string;
  amount: number;
  status: string;
  createdAt: string;
  adminNote?: string;
}

interface FraudCheckResult {
  phoneCaution: string;
  accountCaution: string;
  isFlagged: boolean;
  phoneUrl: string;
  accountUrl: string;
}

interface FraudHistoryItem {
  id: number;
  userId: number;
  checkedAt: string;
  phoneCaution: string;
  accountCaution: string;
  isFlagged: boolean;
}

interface BlacklistScreenResult {
  status: string;       // "BLOCKED" | "CLEARED"
  matchCode: string;    // 5자리 비트맵
  incidentCount: number;
  isBlocked: boolean;   // 이름 기반 매칭 여부
  matchDetail: string;  // "이름 + 전화번호 일치" 등
}

interface ReleaseHoldState {
  open: boolean;
  type: 'order' | 'tradein';
  id: number;
  label: string;
  adminNote: string;
}

// ── Helpers ──

const getOrderStatusLabel = (status: string) =>
  ORDER_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const getTradeInStatusLabel = (status: string) =>
  TRADEIN_STATUS_OPTIONS.find(o => o.value === status)?.label || status;

const RELEASE_INITIAL: ReleaseHoldState = {
  open: false, type: 'order', id: 0, label: '', adminNote: '',
};

// ── Component ──

const FraudTab = () => {
  const { showToast } = useToast();

  // ── FRAUD_HOLD Orders ──
  const {
    items: holdOrders,
    loading: ordersLoading,
    page: ordersPage,
    total: ordersTotal,
    setPage: setOrdersPage,
    reload: reloadOrders,
  } = useAdminList<HoldOrder>(
    (params) => adminApi.getAllOrders({ ...params, status: 'FRAUD_HOLD' }),
    { pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, errorMessage: 'FRAUD_HOLD 주문 목록 로드 실패' },
  );

  // ── FRAUD_HOLD Trade-ins ──
  const {
    items: holdTradeIns,
    loading: tradeInsLoading,
    page: tradeInsPage,
    total: tradeInsTotal,
    setPage: setTradeInsPage,
    reload: reloadTradeIns,
  } = useAdminList<HoldTradeIn>(
    (params) => adminApi.getAllTradeIns({ ...params, status: 'FRAUD_HOLD' }),
    { pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE, errorMessage: 'FRAUD_HOLD 매입 목록 로드 실패' },
  );

  // ── Manual Fraud Check ──
  const [searchUserId, setSearchUserId] = useState('');
  const [fraudResult, setFraudResult] = useState<FraudCheckResult | null>(null);
  const [fraudHistory, setFraudHistory] = useState<FraudHistoryItem[]>([]);
  const [searching, setSearching] = useState(false);

  // ── Blacklist Screening ──
  const [blName, setBlName] = useState('');
  const [blPhone, setBlPhone] = useState('');
  const [blAccount, setBlAccount] = useState('');
  const [blResult, setBlResult] = useState<BlacklistScreenResult | null>(null);
  const [blSearching, setBlSearching] = useState(false);

  const handleBlacklistScreen = async () => {
    if (!blName || blName.length < 2) {
      showToast({ message: '이름을 2자 이상 입력해주세요.', type: 'warning' });
      return;
    }
    if (!blPhone && !blAccount) {
      showToast({ message: '전화번호 또는 계좌번호 중 하나는 입력해주세요.', type: 'warning' });
      return;
    }
    setBlSearching(true);
    setBlResult(null);
    try {
      const result = await adminApi.blacklistScreen(blName, blPhone, blAccount);
      setBlResult(result);
    } catch (err: any) {
      const msg = err?.response?.data?.error || '블랙리스트 스크리닝에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setBlSearching(false);
    }
  };

  // ── Release Hold Modal ──
  const [releaseState, setReleaseState] = useState<ReleaseHoldState>(RELEASE_INITIAL);
  const [releasing, setReleasing] = useState(false);

  const handleFraudCheck = async () => {
    const userId = Number(searchUserId);
    if (!userId || isNaN(userId)) {
      showToast({ message: '유효한 사용자 ID를 입력해주세요.', type: 'warning' });
      return;
    }
    setSearching(true);
    setFraudResult(null);
    setFraudHistory([]);
    try {
      const [result, history] = await Promise.all([
        adminApi.fraudCheckUser(userId),
        adminApi.fraudHistory(userId),
      ]);
      setFraudResult(result);
      setFraudHistory(Array.isArray(history) ? history : history?.items ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || '사기 조회에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setSearching(false);
    }
  };

  const openReleaseModal = (type: 'order' | 'tradein', id: number) => {
    const label = type === 'order' ? `주문 #${id}` : `매입 #${id}`;
    setReleaseState({ open: true, type, id, label, adminNote: '' });
  };

  const handleRelease = async () => {
    if (!releaseState.adminNote.trim()) {
      showToast({ message: '관리자 메모를 입력해주세요.', type: 'warning' });
      return;
    }
    setReleasing(true);
    try {
      if (releaseState.type === 'order') {
        await adminApi.releaseOrderHold(releaseState.id, releaseState.adminNote);
      } else {
        await adminApi.releaseTradeInHold(releaseState.id, releaseState.adminNote);
      }
      showToast({ message: `${releaseState.label} 보류가 해제되었습니다.`, type: 'success' });
      setReleaseState(RELEASE_INITIAL);
      reloadOrders();
      reloadTradeIns();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '보류 해제에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setReleasing(false);
    }
  };

  // ── Columns: FRAUD_HOLD Orders ──
  const orderColumns: Column<HoldOrder>[] = [
    {
      key: 'id', header: '주문 번호',
      render: (o) => (
        <span style={{ fontFamily: o.orderCode ? 'var(--font-mono, monospace)' : 'inherit', fontSize: '13px' }}>
          {o.orderCode || `#${o.id}`}
        </span>
      ),
    },
    {
      key: 'user', header: '고객',
      render: (o) => (
        <div>
          <span style={{ fontWeight: 600 }}>{o.user?.name || 'N/A'}</span>
          <div className="admin-sub-text" title={o.user?.email}>{maskEmail(o.user?.email)}</div>
        </div>
      ),
    },
    {
      key: 'totalAmount', header: '총액', align: 'right',
      render: (o) => (
        <span style={{ fontWeight: 600, color: COLORS.primary }}>
          {formatPrice(Number(o.totalAmount))}
        </span>
      ),
    },
    {
      key: 'status', header: '상태',
      render: (o) => (
        <Badge
          color={ORDER_STATUS_COLOR_MAP.get(o.status) as any || 'red'}
          variant="weak"
          size="small"
        >
          {getOrderStatusLabel(o.status)}
        </Badge>
      ),
    },
    {
      key: 'date', header: '주문일',
      render: (o) => (
        <div>
          <div>{new Date(o.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(o.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (o) => (
        <Button
          variant="primary"
          size="sm"
          onClick={() => openReleaseModal('order', o.id)}
        >
          보류 해제
        </Button>
      ),
    },
  ];

  // ── Columns: FRAUD_HOLD Trade-ins ──
  const tradeInColumns: Column<HoldTradeIn>[] = [
    {
      key: 'id', header: 'ID',
      render: (t) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px' }}>#{t.id}</span>,
    },
    {
      key: 'user', header: '고객',
      render: (t) => (
        <div>
          <span style={{ fontWeight: 600 }}>{t.user?.name || 'N/A'}</span>
          <div className="admin-sub-text" title={t.user?.email}>{maskEmail(t.user?.email)}</div>
        </div>
      ),
    },
    {
      key: 'product', header: '상품',
      render: (t) => (
        <div>
          <div>{t.productName}</div>
          <div className="admin-sub-text">{t.brandCode}</div>
        </div>
      ),
    },
    {
      key: 'amount', header: '금액', align: 'right',
      render: (t) => (
        <span style={{ fontWeight: 600, color: COLORS.primary }}>
          {formatPrice(Number(t.amount))}
        </span>
      ),
    },
    {
      key: 'status', header: '상태',
      render: (t) => (
        <Badge
          color={TRADEIN_STATUS_COLOR_MAP.get(t.status) as any || 'red'}
          variant="weak"
          size="small"
        >
          {getTradeInStatusLabel(t.status)}
        </Badge>
      ),
    },
    {
      key: 'date', header: '신청일',
      render: (t) => (
        <div>
          <div>{new Date(t.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(t.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (t) => (
        <Button
          variant="primary"
          size="sm"
          onClick={() => openReleaseModal('tradein', t.id)}
        >
          보류 해제
        </Button>
      ),
    },
  ];

  return (
    <div className="admin-tab">
      {/* ── Page Header ── */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">사기 조회 관리</h2>
          <p className="admin-page-desc">블랙리스트 스크리닝 · 더치트 사기 조회 · FRAUD_HOLD 보류 관리</p>
        </div>
      </div>

      {/* ── Section 1: FRAUD_HOLD 주문 목록 ── */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{
          fontSize: 'var(--text-subhead)',
          fontWeight: 700,
          marginBottom: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <AlertTriangle size={18} style={{ color: COLORS.error }} />
          FRAUD_HOLD 주문
          {ordersTotal > 0 && (
            <Badge color="red" variant="fill" size="small">{ordersTotal}</Badge>
          )}
        </h3>
        <div className="admin-table-card">
          <AdminTable
            columns={orderColumns}
            data={holdOrders}
            keyField="id"
            isLoading={ordersLoading}
            pagination={{
              currentPage: ordersPage,
              totalItems: ordersTotal,
              itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
              onPageChange: setOrdersPage,
            }}
            emptyMessage="보류 중인 주문이 없습니다."
            caption="FRAUD_HOLD 주문 목록"
          />
        </div>
      </div>

      {/* ── Section 2: FRAUD_HOLD 매입 목록 ── */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{
          fontSize: 'var(--text-subhead)',
          fontWeight: 700,
          marginBottom: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <AlertTriangle size={18} style={{ color: COLORS.error }} />
          FRAUD_HOLD 매입
          {tradeInsTotal > 0 && (
            <Badge color="red" variant="fill" size="small">{tradeInsTotal}</Badge>
          )}
        </h3>
        <div className="admin-table-card">
          <AdminTable
            columns={tradeInColumns}
            data={holdTradeIns}
            keyField="id"
            isLoading={tradeInsLoading}
            pagination={{
              currentPage: tradeInsPage,
              totalItems: tradeInsTotal,
              itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
              onPageChange: setTradeInsPage,
            }}
            emptyMessage="보류 중인 매입 건이 없습니다."
            caption="FRAUD_HOLD 매입 목록"
          />
        </div>
      </div>

      {/* ── Section 3: 블랙리스트 스크리닝 ── */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{
          fontSize: 'var(--text-subhead)',
          fontWeight: 700,
          marginBottom: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <ShieldAlert size={18} />
          블랙리스트 스크리닝
        </h3>
        <p style={{ fontSize: 'var(--text-caption)', color: COLORS.grey600, marginBottom: 'var(--space-3)' }}>
          이름 + 전화번호/계좌번호로 블랙리스트 DB를 검색합니다. 이름이 반드시 포함된 매칭만 차단으로 판정합니다.
        </p>

        {/* 검색 폼 */}
        <div className="admin-filter-card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--text-caption)', fontWeight: 500 }}>이름 *</label>
            <input
              type="text"
              className="admin-search-input"
              placeholder="홍길동"
              value={blName}
              onChange={(e) => setBlName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleBlacklistScreen(); }}
              style={{ width: '140px' }}
              aria-label="블랙리스트 검색 이름"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--text-caption)', fontWeight: 500 }}>전화번호</label>
            <input
              type="text"
              className="admin-search-input"
              placeholder="01012345678"
              value={blPhone}
              onChange={(e) => setBlPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleBlacklistScreen(); }}
              style={{ width: '160px' }}
              aria-label="블랙리스트 검색 전화번호"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--text-caption)', fontWeight: 500 }}>계좌번호</label>
            <input
              type="text"
              className="admin-search-input"
              placeholder="1234567890123"
              value={blAccount}
              onChange={(e) => setBlAccount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleBlacklistScreen(); }}
              style={{ width: '180px' }}
              aria-label="블랙리스트 검색 계좌번호"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleBlacklistScreen}
            loading={blSearching}
          >
            <Search size={14} />
            스크리닝
          </Button>
        </div>

        {/* 결과 표시 */}
        {blResult && (
          <div style={{
            marginTop: 'var(--space-4)',
            border: `1px solid ${blResult.isBlocked ? COLORS.error : COLORS.grey200}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            background: blResult.isBlocked ? 'var(--color-red-50, #FEF2F2)' : 'var(--color-grey-50)',
          }}>
            {/* 판정 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-3)',
              fontWeight: 700,
              fontSize: 'var(--text-subhead)',
              color: blResult.isBlocked ? COLORS.error : COLORS.success,
            }}>
              {blResult.isBlocked ? (
                <>
                  <UserX size={20} />
                  거래 차단 대상
                </>
              ) : (
                <>
                  <UserCheck size={20} />
                  정상 — 차단 대상 아님
                </>
              )}
            </div>

            {/* 상세 정보 그리드 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-3)',
            }}>
              <div style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'white',
                border: `1px solid ${COLORS.grey200}`,
              }}>
                <div style={{ fontSize: 'var(--text-caption)', color: COLORS.grey600, marginBottom: 'var(--space-1)' }}>
                  API 상태
                </div>
                <div style={{ fontWeight: 600 }}>
                  <Badge
                    color={blResult.status === 'BLOCKED' ? 'red' : 'green'}
                    variant="weak"
                    size="small"
                  >
                    {blResult.status}
                  </Badge>
                </div>
              </div>

              <div style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'white',
                border: `1px solid ${COLORS.grey200}`,
              }}>
                <div style={{ fontSize: 'var(--text-caption)', color: COLORS.grey600, marginBottom: 'var(--space-1)' }}>
                  매칭 상세
                </div>
                <div style={{ fontWeight: 600 }}>
                  {blResult.matchDetail}
                </div>
              </div>

              <div style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'white',
                border: `1px solid ${COLORS.grey200}`,
              }}>
                <div style={{ fontSize: 'var(--text-caption)', color: COLORS.grey600, marginBottom: 'var(--space-1)' }}>
                  매치코드
                </div>
                <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>
                  {blResult.matchCode}
                </div>
              </div>

              <div style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'white',
                border: `1px solid ${COLORS.grey200}`,
              }}>
                <div style={{ fontSize: 'var(--text-caption)', color: COLORS.grey600, marginBottom: 'var(--space-1)' }}>
                  사고 건수
                </div>
                <div style={{
                  fontWeight: 600,
                  color: blResult.incidentCount > 0 ? COLORS.error : 'inherit',
                }}>
                  {blResult.incidentCount}건
                </div>
              </div>
            </div>

            {/* 차단 판정 설명 */}
            {blResult.status === 'BLOCKED' && !blResult.isBlocked && (
              <div style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-yellow-50, #FFFBEB)',
                border: `1px solid var(--color-yellow-200, #FDE68A)`,
                fontSize: 'var(--text-caption)',
                color: COLORS.grey700,
              }}>
                <strong>참고:</strong> API는 BLOCKED를 반환했으나, 이름 기반 매칭이 아닙니다 (matchCode: {blResult.matchCode}).
                이름+전화 또는 이름+계좌 조합이 일치해야 거래 차단 대상입니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 4: 사용자 사기 조회 ── */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{
          fontSize: 'var(--text-subhead)',
          fontWeight: 700,
          marginBottom: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <Search size={18} />
          사용자 사기 조회
        </h3>
        <div className="admin-filter-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <label style={{ fontSize: 'var(--text-caption)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            사용자 ID
          </label>
          <input
            type="number"
            className="admin-search-input"
            placeholder="사용자 ID 입력"
            value={searchUserId}
            onChange={(e) => setSearchUserId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFraudCheck(); }}
            style={{ maxWidth: '200px' }}
            aria-label="사용자 ID"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleFraudCheck}
            loading={searching}
          >
            <Search size={14} />
            조회
          </Button>
        </div>

        {/* 조회 결과 */}
        {fraudResult && (
          <div style={{
            marginTop: 'var(--space-4)',
            border: `1px solid ${fraudResult.isFlagged ? COLORS.error : COLORS.grey200}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            background: fraudResult.isFlagged ? 'var(--color-red-50, #FEF2F2)' : 'var(--color-grey-50)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-3)',
              fontWeight: 700,
              fontSize: 'var(--text-subhead)',
              color: fraudResult.isFlagged ? COLORS.error : COLORS.success,
            }}>
              {fraudResult.isFlagged ? (
                <>
                  <ShieldAlert size={20} />
                  사기 의심 사용자
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  사기 이력 없음
                </>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-3)',
            }}>
              {/* 전화번호 조회 결과 */}
              <div style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'white',
                border: `1px solid ${COLORS.grey200}`,
              }}>
                <div style={{ fontSize: 'var(--text-caption)', color: COLORS.grey600, marginBottom: 'var(--space-1)' }}>
                  전화번호 조회
                </div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  {fraudResult.phoneCaution || '결과 없음'}
                </div>
                {fraudResult.phoneUrl && (
                  <a
                    href={fraudResult.phoneUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: 'var(--text-caption)',
                      color: COLORS.primary,
                      textDecoration: 'none',
                    }}
                  >
                    더치트에서 보기 <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* 계좌번호 조회 결과 */}
              <div style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'white',
                border: `1px solid ${COLORS.grey200}`,
              }}>
                <div style={{ fontSize: 'var(--text-caption)', color: COLORS.grey600, marginBottom: 'var(--space-1)' }}>
                  계좌번호 조회
                </div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  {fraudResult.accountCaution || '결과 없음'}
                </div>
                {fraudResult.accountUrl && (
                  <a
                    href={fraudResult.accountUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: 'var(--text-caption)',
                      color: COLORS.primary,
                      textDecoration: 'none',
                    }}
                  >
                    더치트에서 보기 <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 조회 이력 */}
        {fraudHistory.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <h4 style={{
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              marginBottom: 'var(--space-2)',
              color: COLORS.grey700,
            }}>
              조회 이력
            </h4>
            <div style={{
              border: `1px solid ${COLORS.grey200}`,
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: COLORS.grey50 }}>
                    <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>조회일</th>
                    <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>전화번호</th>
                    <th scope="col" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>계좌번호</th>
                    <th scope="col" style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>플래그</th>
                  </tr>
                </thead>
                <tbody>
                  {fraudHistory.map((h) => (
                    <tr key={h.id} style={{ borderTop: `1px solid ${COLORS.grey100}` }}>
                      <td style={{ padding: '8px 12px' }}>
                        {new Date(h.checkedAt).toLocaleString('ko-KR')}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{h.phoneCaution || '-'}</td>
                      <td style={{ padding: '8px 12px' }}>{h.accountCaution || '-'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <Badge
                          color={h.isFlagged ? 'red' : 'green'}
                          variant="weak"
                          size="small"
                        >
                          {h.isFlagged ? '의심' : '정상'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Release Hold Confirm Modal ── */}
      <ConfirmModal
        isOpen={releaseState.open}
        onClose={() => setReleaseState(RELEASE_INITIAL)}
        onConfirm={handleRelease}
        title="FRAUD_HOLD 보류 해제"
        confirmLabel="보류 해제"
        loading={releasing}
      >
        <p style={{ marginBottom: 'var(--space-3)' }}>
          <strong>{releaseState.label}</strong>의 사기의심 보류를 해제하시겠습니까?
        </p>
        <p style={{ fontSize: 'var(--text-caption)', color: COLORS.grey600, marginBottom: 'var(--space-3)' }}>
          {releaseState.type === 'order'
            ? '보류 해제 시 주문 상태가 PENDING으로 변경됩니다.'
            : '보류 해제 시 매입 상태가 REQUESTED로 변경됩니다.'}
        </p>
        <textarea
          value={releaseState.adminNote}
          onChange={(e) => setReleaseState(prev => ({ ...prev, adminNote: e.target.value }))}
          placeholder="보류 해제 사유를 입력해주세요 (필수)"
          rows={3}
          style={{
            width: '100%',
            resize: 'vertical',
            padding: 'var(--space-2)',
            border: `1px solid ${COLORS.grey200}`,
            borderRadius: 'var(--radius-sm, 8px)',
            fontSize: '13px',
          }}
          aria-label="관리자 메모"
          aria-required="true"
        />
      </ConfirmModal>
    </div>
  );
};

export default FraudTab;
