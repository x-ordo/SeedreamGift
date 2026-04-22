/**
 * @file TradeInTab.tsx
 * @description Partner trade-in tab — submit PIN codes for trade-in, view history
 */
import { useState, useMemo, useEffect } from 'react';
import { partnerOrderApi, partnerTradeInApi } from '@/api/manual';
import { usePartnerList } from '../hooks/usePartnerList';
import { useToast } from '@/contexts/ToastContext';
import { TRADEIN_STATUS_MAP, PARTNER_PAGINATION } from '../constants';

const MAX_PINS = 20;

const TradeInTab: React.FC = () => {
  const { showToast } = useToast();

  // ── Products with allowTradeIn=true ──
  const [tradeInProducts, setTradeInProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await partnerOrderApi.getPurchasableProducts({ limit: 100 });
        const data = res.data;
        const items: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : [];
        setTradeInProducts(items.filter((p: any) => p.allowTradeIn || p.tradeInRate));
      } catch {
        setTradeInProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };
    load();
  }, []);

  // ── Form state ──
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [pinText, setPinText] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [giftNumber, setGiftNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pinCodes = useMemo(
    () => pinText.split('\n').map(s => s.trim()).filter(s => s.length > 0),
    [pinText]
  );

  const selectedProduct = useMemo(
    () => tradeInProducts.find(p => p.id === selectedProductId),
    [tradeInProducts, selectedProductId]
  );

  const tradeInPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const rate = Number(selectedProduct.tradeInRate ?? 0);
    const price = Number(selectedProduct.price ?? 0);
    return rate > 0 ? Math.floor(price * (1 - rate / 100)) : Number(selectedProduct.partnerTradeInPrice ?? 0);
  }, [selectedProduct]);

  const estimatedPayout = tradeInPrice * pinCodes.length;

  const handleSubmit = async () => {
    if (!selectedProductId) {
      showToast({ message: '상품을 선택해주세요.', type: 'warning' });
      return;
    }
    if (pinCodes.length === 0) {
      showToast({ message: 'PIN 코드를 입력해주세요.', type: 'warning' });
      return;
    }
    if (pinCodes.length > MAX_PINS) {
      showToast({ message: `PIN은 최대 ${MAX_PINS}개까지 신청 가능합니다.`, type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await partnerTradeInApi.create({
        productId: selectedProductId,
        pinCodes,
        ...(securityCode.trim() ? { securityCode: securityCode.trim() } : {}),
        ...(giftNumber.trim() ? { giftNumber: giftNumber.trim() } : {}),
      });
      showToast({ message: `${pinCodes.length}개 PIN 매입 신청이 완료되었습니다.`, type: 'success' });
      setPinText('');
      setSecurityCode('');
      setGiftNumber('');
      setSelectedProductId(0);
      reload();
    } catch {
      showToast({ message: '매입 신청에 실패했습니다.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Trade-in history ──
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const historyFilters = useMemo(() => ({
    status: historyStatusFilter || undefined,
  }), [historyStatusFilter]);

  const { items: tradeIns, loading: historyLoading, page, total, setPage, reload } = usePartnerList<any>(
    (params) => partnerTradeInApi.getMyTradeIns(params).then(r => r.data),
    { filters: historyFilters, errorMessage: '매입 내역을 불러오는데 실패했습니다.' }
  );

  const totalPages = Math.ceil(total / PARTNER_PAGINATION.DEFAULT_PAGE_SIZE);

  return (
    <div className="partner-tab">

      {/* ── Trade-in Form ── */}
      <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>매입 신청</h3>
      <div className="partner-info-card" style={{ marginBottom: '24px' }}>

        {/* Product Select */}
        <div className="partner-form-group">
          <label className="partner-form-label" htmlFor="tradein-product">상품 선택</label>
          {productsLoading ? (
            <div style={{ fontSize: '13px', color: 'var(--color-grey-400)' }}>상품 로딩 중...</div>
          ) : tradeInProducts.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--color-grey-400)' }}>매입 가능한 상품이 없습니다.</div>
          ) : (
            <select
              id="tradein-product"
              className="partner-form-select"
              value={selectedProductId}
              onChange={e => setSelectedProductId(Number(e.target.value))}
            >
              <option value={0}>상품을 선택하세요</option>
              {tradeInProducts.map((p: any) => {
                const rate = Number(p.tradeInRate ?? 0);
                const price = Number(p.price ?? 0);
                const buyAmt = rate > 0
                  ? Math.floor(price * (1 - rate / 100))
                  : Number(p.partnerTradeInPrice ?? 0);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} — 매입가 {buyAmt.toLocaleString()}원
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* PIN Code Textarea */}
        <div className="partner-form-group">
          <label className="partner-form-label" htmlFor="tradein-pins">
            PIN 코드 (줄바꿈으로 구분, 최대 {MAX_PINS}개)
          </label>
          <textarea
            id="tradein-pins"
            className="partner-form-textarea"
            style={{ minHeight: '160px', fontFamily: 'var(--font-family-mono)', fontSize: '13px' }}
            value={pinText}
            onChange={e => setPinText(e.target.value)}
            placeholder={`1234-5678-9012-3456\n2345-6789-0123-4567\n\n* 줄바꿈으로 구분\n* 최대 ${MAX_PINS}개`}
            aria-describedby="tradein-pins-help"
          />
          <div
            id="tradein-pins-help"
            style={{ fontSize: '12px', color: pinCodes.length > MAX_PINS ? 'var(--color-error)' : 'var(--color-grey-400)', marginTop: '4px' }}
          >
            입력된 PIN: {pinCodes.length}개
            {pinCodes.length > MAX_PINS && (
              <span style={{ marginLeft: '8px' }}>
                (최대 {MAX_PINS}개 초과)
              </span>
            )}
          </div>
        </div>

        {/* Optional Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="partner-form-group">
            <label className="partner-form-label" htmlFor="tradein-security">보안코드 (선택)</label>
            <input
              id="tradein-security"
              type="text"
              className="partner-search-input"
              value={securityCode}
              onChange={e => setSecurityCode(e.target.value)}
              placeholder="보안코드 입력"
            />
          </div>
          <div className="partner-form-group">
            <label className="partner-form-label" htmlFor="tradein-giftnumber">상품권 번호 (선택)</label>
            <input
              id="tradein-giftnumber"
              type="text"
              className="partner-search-input"
              value={giftNumber}
              onChange={e => setGiftNumber(e.target.value)}
              placeholder="상품권 번호 입력"
            />
          </div>
        </div>

        {/* Estimated Payout */}
        {selectedProduct && pinCodes.length > 0 && (
          <div style={{
            background: 'var(--color-grey-50)',
            border: '1px solid var(--color-grey-100)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '4px',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--color-grey-600)' }}>
              예상 매입가 ({tradeInPrice.toLocaleString()}원 x {pinCodes.length}개)
            </div>
            <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-success)' }}>
              {estimatedPayout.toLocaleString()}원
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            type="button"
            className="partner-btn-primary"
            onClick={handleSubmit}
            disabled={submitting || pinCodes.length === 0 || !selectedProductId || pinCodes.length > MAX_PINS}
            style={{ minWidth: '120px' }}
          >
            {submitting ? '신청 중...' : '매입 신청'}
          </button>
        </div>
      </div>

      {/* ── Trade-in History ── */}
      <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>매입 내역</h3>

      <div className="partner-filter-card">
        <select
          className="partner-filter-select"
          value={historyStatusFilter}
          onChange={e => setHistoryStatusFilter(e.target.value)}
          aria-label="매입 상태 필터"
        >
          <option value="">전체 상태</option>
          {Object.entries(TRADEIN_STATUS_MAP).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="partner-table-card">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption className="sr-only">매입 신청 내역</caption>
          <thead>
            <tr>
              <th scope="col">신청번호</th>
              <th scope="col">상품</th>
              <th scope="col">PIN 수</th>
              <th scope="col">매입금액</th>
              <th scope="col">상태</th>
              <th scope="col">신청일</th>
            </tr>
          </thead>
          <tbody>
            {historyLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>
                  <span role="status" aria-busy="true">로딩 중...</span>
                </td>
              </tr>
            ) : tradeIns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>
                  매입 신청 내역이 없습니다.
                </td>
              </tr>
            ) : (
              tradeIns.map((ti: any) => {
                const status = TRADEIN_STATUS_MAP[ti.status] || { label: ti.status || '-', color: 'gray' };
                return (
                  <tr key={ti.id}>
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: 'var(--color-purple-500)' }}>
                      #{ti.id}
                    </td>
                    <td>{ti.productName || ti.product?.name || '-'}</td>
                    <td className="tabular-nums">{ti.pinCount ?? ti.quantity ?? 0}</td>
                    <td className="tabular-nums">{Number(ti.totalAmount ?? ti.amount ?? 0).toLocaleString()}원</td>
                    <td>
                      <span className={`partner-badge ${status.color}`}>{status.label}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-grey-500)' }}>
                      {ti.createdAt ? new Date(ti.createdAt).toLocaleDateString('ko-KR') : '-'}
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
    </div>
  );
};

export default TradeInTab;
