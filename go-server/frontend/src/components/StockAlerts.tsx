import React, { useState, useEffect } from 'react';
import { Package, RefreshCw, AlertTriangle } from 'lucide-react';
import { GetStockAlerts } from '../../wailsjs/go/gui/App';

/**
 * 재고 부족 알림 항목 인터페이스
 */
interface StockAlert {
  productId: number;
  productName: string;
  brandCode: string;
  available: number;
  threshold: number;
}

/**
 * 브랜드 코드에 따른 표시 색상을 반환합니다.
 */
const brandColor = (code: string): string => {
  const colors: Record<string, string> = {
    SHINSEGAE: '#D4A76A',
    HYUNDAI: '#2E7D32',
    LOTTE: '#CC0000',
    DAISO: '#F57C00',
    OLIVEYOUNG: '#6A1B9A',
  };
  return colors[code?.toUpperCase()] ?? '#555555';
};

/**
 * @component StockAlerts
 * @description 재고 부족 상품 목록을 테이블 형식으로 표시하는 컴포넌트입니다.
 * MinStockAlert이 설정된 상품 중 현재 가용 바우처 수가 기준치 미만인 항목을 조회합니다.
 */
const StockAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await GetStockAlerts();
      setAlerts((data as StockAlert[]) ?? []);
    } catch (e) {
      if (!silent) setError('재고 알림 로드 실패: ' + String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => fetchAlerts(true), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E0E0E0] flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-normal text-[#003399]">재고 부족 알림</h2>
            <p className="text-xs text-[#666666]">
              설정된 최소 재고 기준치보다 가용 바우처가 적은 상품 목록입니다. 30초마다 자동 갱신합니다.
            </p>
          </div>
          <button
            onClick={() => fetchAlerts()}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 text-[12px] border border-[#CCCCCC] bg-[#F5F5F5] hover:bg-[#E0E0E0] rounded disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded px-3 py-1.5 text-xs border bg-[#FFECEC] border-[#CC0000] text-[#CC0000] flex-shrink-0">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#EAEAEA] border-b border-[#D4D4D4]">
              <th className="text-left px-4 py-2 font-semibold text-[11px] text-[#333333]">
                <Package size={11} className="inline mr-1 text-[#0055CC]" />상품명
              </th>
              <th className="text-left px-4 py-2 font-semibold text-[11px] text-[#333333]">브랜드</th>
              <th className="text-right px-4 py-2 font-semibold text-[11px] text-[#333333]">현재 재고</th>
              <th className="text-right px-4 py-2 font-semibold text-[11px] text-[#333333]">기준치</th>
              <th className="text-left px-4 py-2 font-semibold text-[11px] text-[#333333]">상태</th>
            </tr>
          </thead>
          <tbody>
            {loading && alerts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#999999]">
                  재고 알림 로딩 중...
                </td>
              </tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#999999]">
                  재고 부족 상품이 없습니다. 모든 상품이 기준치 이상의 재고를 보유하고 있습니다.
                </td>
              </tr>
            ) : (
              alerts.map((alert, i) => {
                const isZero = alert.available === 0;
                return (
                  <tr
                    key={alert.productId}
                    className={[
                      'border-b border-[#F0F0F0]',
                      isZero ? 'bg-[#FFF5F5]' : i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {isZero && <AlertTriangle size={13} className="text-[#CC0000] flex-shrink-0" />}
                        <span className={isZero ? 'text-[#CC0000] font-semibold' : 'text-[#333333] font-medium'}>
                          {alert.productName}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#999999]">ID: {alert.productId}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border font-medium"
                        style={{
                          color: brandColor(alert.brandCode),
                          borderColor: brandColor(alert.brandCode) + '40',
                          backgroundColor: brandColor(alert.brandCode) + '10',
                        }}
                      >
                        {alert.brandCode}
                      </span>
                    </td>
                    <td className={[
                      'px-4 py-2.5 text-right font-mono font-semibold',
                      isZero ? 'text-[#CC0000]' : 'text-[#E08800]',
                    ].join(' ')}>
                      {alert.available}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#666666]">
                      {alert.threshold}
                    </td>
                    <td className="px-4 py-2.5">
                      {isZero ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#FFECEC] text-[#CC0000] border border-[#FFCCCC]">
                          품절
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#FFF3CD] text-[#856404] border border-[#FFE082]">
                          부족
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-[#E0E0E0] bg-[#F5F5F5] flex-shrink-0">
        <span className="text-[11px] text-[#666666]">
          {alerts.length > 0 ? (
            <>
              <span className="text-[#CC0000] font-semibold">{alerts.filter((a) => a.available === 0).length}</span> 품절
              {' / '}
              <span className="text-[#E08800] font-semibold">{alerts.filter((a) => a.available > 0).length}</span> 부족
              {' / '}
              총 {alerts.length}개 상품
            </>
          ) : (
            '재고 상태 정상'
          )}
        </span>
      </div>
    </div>
  );
};

export default StockAlerts;
