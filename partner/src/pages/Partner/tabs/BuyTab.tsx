/**
 * @file BuyTab.tsx
 * @description Partner purchase tab — browse purchasable products, place orders, download PIN CSVs
 */
import { useState, useMemo, useCallback } from 'react';
import { ShoppingCart, Download, X, Plus, Minus } from 'lucide-react';
import { partnerOrderApi } from '@/api/manual';
import { usePartnerList } from '../hooks/usePartnerList';
import { useToast } from '@/contexts/ToastContext';
import { ORDER_STATUS_MAP, PARTNER_PAGINATION, BRAND_LABEL_MAP } from '../constants';

interface CartItem {
  productId: number;
  productName: string;
  partnerPrice: number;
  quantity: number;
}

const EXPORTABLE_STATUSES = new Set(['PAID', 'DELIVERED', 'COMPLETED']);

const BuyTab: React.FC = () => {
  const { showToast } = useToast();

  // ── Purchasable products list ──
  const { items: products, loading: productsLoading } = usePartnerList<any>(
    (params) => partnerOrderApi.getPurchasableProducts(params).then(r => r.data),
    { errorMessage: '구매 가능 상품 목록을 불러오는데 실패했습니다.' }
  );

  // ── Purchase history list ──
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const historyFilters = useMemo(() => ({
    status: historyStatusFilter || undefined,
  }), [historyStatusFilter]);

  const { items: purchases, loading: purchasesLoading, page, total, setPage, reload } = usePartnerList<any>(
    (params) => partnerOrderApi.getMyPurchases(params).then(r => r.data),
    { filters: historyFilters, errorMessage: '구매 내역을 불러오는데 실패했습니다.' }
  );

  const totalPages = Math.ceil(total / PARTNER_PAGINATION.DEFAULT_PAGE_SIZE);

  // ── Cart state ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ordering, setOrdering] = useState(false);

  const addToCart = useCallback((product: any) => {
    const partnerPrice = Number(product.partnerPrice ?? product.buyPrice ?? product.price ?? 0);
    setCart(prev => {
      const existing = prev.find(c => c.productId === product.id);
      if (existing) {
        return prev.map(c =>
          c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        partnerPrice,
        quantity: 1,
      }];
    });
  }, []);

  const updateQty = useCallback((productId: number, delta: number) => {
    setCart(prev =>
      prev
        .map(c => c.productId === productId ? { ...c, quantity: c.quantity + delta } : c)
        .filter(c => c.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(c => c.productId !== productId));
  }, []);

  const cartTotal = useMemo(
    () => cart.reduce((sum, c) => sum + c.partnerPrice * c.quantity, 0),
    [cart]
  );

  const handleOrder = async () => {
    if (cart.length === 0) {
      showToast({ message: '구매할 상품을 선택해주세요.', type: 'warning' });
      return;
    }
    setOrdering(true);
    try {
      await partnerOrderApi.createOrder({
        items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
      });
      showToast({ message: '주문이 완료되었습니다.', type: 'success' });
      setCart([]);
      reload();
    } catch {
      showToast({ message: '주문에 실패했습니다.', type: 'error' });
    } finally {
      setOrdering(false);
    }
  };

  // ── CSV export ──
  const [exporting, setExporting] = useState<number | null>(null);

  const handleExport = async (orderId: number) => {
    setExporting(orderId);
    try {
      const response = await partnerOrderApi.exportPins(orderId);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${orderId}-pins.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast({ message: 'PIN 내보내기에 실패했습니다.', type: 'error' });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="partner-tab">

      {/* ── Purchasable Products Grid ── */}
      <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>구매 가능 상품</h3>
      <div className="partner-table-card">
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption className="sr-only">구매 가능 상품 목록</caption>
          <thead>
            <tr>
              <th scope="col">상품명</th>
              <th scope="col">브랜드</th>
              <th scope="col">액면가</th>
              <th scope="col">파트너 단가</th>
              <th scope="col">재고</th>
              <th scope="col">담기</th>
            </tr>
          </thead>
          <tbody>
            {productsLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>
                  <span role="status" aria-busy="true">로딩 중...</span>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>
                  구매 가능한 상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product: any) => {
                const partnerPrice = Number(product.partnerPrice ?? product.buyPrice ?? product.price ?? 0);
                const faceValue = Number(product.price ?? 0);
                const stock = product.availableStock ?? product.stock ?? 0;
                const inCart = cart.find(c => c.productId === product.id);
                return (
                  <tr key={product.id}>
                    <td style={{ fontWeight: 500 }}>{product.name}</td>
                    <td>{BRAND_LABEL_MAP.get(product.brandCode || product.brand) || product.brandCode || '-'}</td>
                    <td className="tabular-nums">{faceValue.toLocaleString()}원</td>
                    <td className="tabular-nums" style={{ color: 'var(--color-error)', fontWeight: 600 }}>
                      {partnerPrice.toLocaleString()}원
                    </td>
                    <td className="tabular-nums" style={{ color: stock > 0 ? 'var(--color-success)' : 'var(--color-grey-400)' }}>
                      {stock > 0 ? `${stock.toLocaleString()}개` : '품절'}
                    </td>
                    <td>
                      {inCart ? (
                        <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600 }}>
                          {inCart.quantity}개 담김
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="partner-btn-primary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => addToCart(product)}
                          disabled={stock === 0}
                          aria-label={`${product.name} 장바구니에 담기`}
                        >
                          <ShoppingCart size={14} /> 담기
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Cart / Order Section ── */}
      {cart.length > 0 && (
        <div>
          <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>주문 내역</h3>
          <div className="partner-info-card">
            {cart.map(item => (
              <div key={item.productId} className="partner-info-row" style={{ alignItems: 'center' }}>
                <span className="partner-info-label" style={{ fontWeight: 500 }}>{item.productName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="partner-btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '12px' }}
                    onClick={() => updateQty(item.productId, -1)}
                    aria-label={`${item.productName} 수량 감소`}
                  >
                    <Minus size={12} />
                  </button>
                  <span className="tabular-nums" style={{ minWidth: '32px', textAlign: 'center', fontWeight: 600 }}>
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="partner-btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '12px' }}
                    onClick={() => updateQty(item.productId, 1)}
                    aria-label={`${item.productName} 수량 증가`}
                  >
                    <Plus size={12} />
                  </button>
                  <span className="tabular-nums" style={{ minWidth: '80px', textAlign: 'right', color: 'var(--color-grey-700)' }}>
                    {(item.partnerPrice * item.quantity).toLocaleString()}원
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.productId)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-grey-400)', padding: '2px' }}
                    aria-label={`${item.productName} 제거`}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--color-grey-100)', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>합계</span>
              <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-primary)' }}>
                {cartTotal.toLocaleString()}원
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                className="partner-btn-primary"
                onClick={handleOrder}
                disabled={ordering}
                style={{ minWidth: '120px' }}
              >
                {ordering ? '주문 중...' : '주문하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Purchase History ── */}
      <div>
        <h3 className="partner-section-title" style={{ marginBottom: '12px' }}>구매 내역</h3>

        <div className="partner-filter-card">
          <select
            className="partner-filter-select"
            value={historyStatusFilter}
            onChange={e => setHistoryStatusFilter(e.target.value)}
            aria-label="구매 상태 필터"
          >
            <option value="">전체 상태</option>
            {Object.entries(ORDER_STATUS_MAP).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="partner-table-card">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <caption className="sr-only">구매 내역 목록</caption>
            <thead>
              <tr>
                <th scope="col">주문번호</th>
                <th scope="col">상품</th>
                <th scope="col">수량</th>
                <th scope="col">결제금액</th>
                <th scope="col">상태</th>
                <th scope="col">주문일</th>
                <th scope="col">PIN 다운로드</th>
              </tr>
            </thead>
            <tbody>
              {purchasesLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>
                    <span role="status" aria-busy="true">로딩 중...</span>
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-400)' }}>
                    구매 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                purchases.map((order: any) => {
                  const status = ORDER_STATUS_MAP[order.status] || { label: order.status || '-', color: 'gray' };
                  const canExport = EXPORTABLE_STATUSES.has(order.status);
                  return (
                    <tr key={order.id}>
                      <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: 'var(--color-purple-500)' }}>
                        #{order.id}
                      </td>
                      <td>{order.productName || order.items?.[0]?.productName || '-'}</td>
                      <td className="tabular-nums">{order.quantity ?? order.itemCount ?? 0}</td>
                      <td className="tabular-nums">{Number(order.totalAmount ?? 0).toLocaleString()}원</td>
                      <td>
                        <span className={`partner-badge ${status.color}`}>{status.label}</span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--color-grey-500)' }}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td>
                        {canExport ? (
                          <button
                            type="button"
                            className="partner-btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleExport(order.id)}
                            disabled={exporting === order.id}
                            aria-label={`주문 #${order.id} PIN CSV 다운로드`}
                          >
                            <Download size={14} />
                            {exporting === order.id ? ' ...' : ' CSV'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-grey-300)' }}>-</span>
                        )}
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
    </div>
  );
};

export default BuyTab;
