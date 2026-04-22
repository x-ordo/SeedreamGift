import './MyPage.css';
import React, { memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, User, Bell, Building2, ShieldCheck, LogOut, UserX, Download, ShieldCheck as ShieldCheckIcon, Smartphone, MapPin, Fingerprint, Trash2, Receipt, Pencil, Check, X } from 'lucide-react';
import SEO from '../components/common/SEO';
import { useMyPage } from './MyPage.hooks';
import { formatPrice } from '../utils';
import { getRelativeTime } from '../utils/dateUtils';
import { Card, Button, Badge, ListRow, ListRowAssetIcon, ListRowTexts, TabNavigation, Result, Stack, Modal, Switch, StatusBadge, PageHeader, TextField } from '../design-system';
import { ProfileModal } from '../components/mypage/ProfileModal';
import { PasswordModal } from '../components/mypage/PasswordModal';
import { BankModal } from '../components/mypage/BankModal';
import { WithdrawModal } from '../components/mypage/WithdrawModal';
import { ExportOptionsModal } from '../components/mypage/ExportOptionsModal';
import { MYPAGE_TAB_CONFIG, getMyPageTabsForRole, MyPageTab, type Order, type TradeIn, type MyGift, type MyGiftVoucher, type BankAccount, type NotificationSettings } from '../types';
import type { AuthUser } from '../api/manual';
import type { CashReceipt } from '../types/mypage';
import { cashReceiptApi } from '../api/manual';

// ============================================================
// Sub-components
// ============================================================

/**
 * 마이페이지 전용 사이드바 컴포넌트입니다.
 * 사용자 기본 정보(이름, 이메일, 인증 상태)와 탭 내비게이션을 포함합니다.
 * 데스크탑에서는 좌측 사이드바로, 모바일에서는 상단 탭 바 형태로 변환됩니다.
 */
const MyPageSidebar = memo(({ user, activeTab, onTabChange }: { user: AuthUser | null, activeTab: MyPageTab, onTabChange: (tabId: string) => void }) => (
  <aside className="w-full lg:w-[260px] shrink-0 space-y-3">
    <Card className="p-0 overflow-hidden" shadow="sm">
      <div className="h-1 bg-primary" />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {(user?.name || '회')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-base-content tracking-tight truncate">{user?.name || '회원'}님</h2>
            <p className="text-xs text-base-content/40 truncate">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3 ml-14">
          <Badge variant="secondary" size="sm">{user?.role || 'USER'}</Badge>
          {user?.kycStatus === 'VERIFIED' && (
            <Badge variant="success" size="sm">인증</Badge>
          )}
        </div>
      </div>
    </Card>

    <nav className="rounded-2xl p-1.5 shadow-sm hidden lg:block" style={{ background: 'color-mix(in oklch, var(--color-primary) 2%, white)', border: '1px solid color-mix(in oklch, var(--color-primary) 6%, var(--color-grey-100))' }}>
      {getMyPageTabsForRole(user?.role).map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-sm transition-colors duration-150 ${
              isActive
                ? 'bg-primary text-white font-bold'
                : 'text-base-content/50 hover:bg-grey-50 font-medium'
            }`}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>

    <div className="lg:hidden">
      <TabNavigation
        tabs={getMyPageTabsForRole(user?.role)}
        activeTab={activeTab}
        onChange={onTabChange}
        variant="underline"
        size="md"
        fullWidth
      />
    </div>
  </aside>
));
MyPageSidebar.displayName = 'MyPageSidebar';

/**
 * 주문 내역 탭 뷰 컴포넌트입니다.
 * 구매한 상품권 목록, 결제 상태, 필터 탭, PIN 번호 확인 기능을 제공합니다.
 */
const OrderHistory = memo(({ orders, loading, onCancel, onCopy, onNavigate }: { orders: Order[], loading: boolean, onCancel: (id: number) => void, onCopy: (text: string) => void, onNavigate: (path: string) => void }) => {
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredOrders = statusFilter === 'all'
    ? orders
    : statusFilter === 'CANCELLED'
      ? orders.filter(o => o.status === 'CANCELLED' || o.status === 'REFUNDED')
      : orders.filter(o => o.status === statusFilter);

  const statusCounts = {
    all: orders.length,
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    PAID: orders.filter(o => o.status === 'PAID').length,
    DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
    CANCELLED: orders.filter(o => o.status === 'CANCELLED' || o.status === 'REFUNDED').length,
  };

  return (
    <Stack gap={4}>
      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="skeleton h-28 w-full rounded-2xl" />)
      ) : orders.length === 0 ? (
        <Result
          icon="info"
          title="구매한 상품권이 없어요"
          description="전국 최저가로 상품권을 구매해보세요"
          button={<Button variant="primary" size="lg" onClick={() => onNavigate('/products')}>구매하러 가기</Button>}
        />
      ) : (
        <>
          {/* Status filter chips */}
          <div className="mypage-filter-chips">
            {[
              { key: 'all', label: '전체' },
              { key: 'PENDING', label: '대기' },
              { key: 'PAID', label: '결제완료' },
              { key: 'DELIVERED', label: '발급완료' },
              { key: 'CANCELLED', label: '취소/환불' },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`mypage-filter-chip ${statusFilter === f.key ? 'active' : ''}`}
              >
                {f.label}
                {statusCounts[f.key as keyof typeof statusCounts] > 0 && (
                  <span className="chip-count">{statusCounts[f.key as keyof typeof statusCounts]}</span>
                )}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <Result icon="info" title="해당 상태의 주문이 없어요" description="다른 필터를 선택해보세요" />
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className="mypage-order-card" data-status={order.status}>
                {/* Header bar */}
                <div className="px-5 pt-4 pb-3 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono font-bold text-base-content/30 tracking-wider">{order.orderCode || `#${order.id}`}</span>
                        <span className="text-[11px] text-base-content/30">·</span>
                        <span className="text-[11px] text-base-content/30">{getRelativeTime(order.createdAt)}</span>
                      </div>
                      <h3 className="text-[15px] font-bold text-base-content leading-snug line-clamp-2 break-keep">
                        {order.orderItems?.map(i => `${i.product?.name || '상품권'} × ${i.quantity}`).join(', ')}
                      </h3>
                    </div>
                    <StatusBadge status={order.status} type="order" />
                  </div>
                </div>

                {/* Amount + Actions row */}
                <div className="px-5 pb-4 sm:px-6 flex items-center justify-between">
                  <div className="mypage-order-price">
                    {formatPrice(Number(order.totalAmount))}
                  </div>
                  <div className="flex items-center gap-2">
                    {order.status === 'PENDING' && (
                      <button type="button" onClick={() => onCancel(order.id)} className="text-xs font-semibold text-error/70 hover:text-error transition-colors">
                        주문 취소
                      </button>
                    )}
                    {(order.status === 'PAID' || order.status === 'DELIVERED') && order.orderItems && order.orderItems.length > 0 && order.orderItems[0].product?.brandCode && (
                      <button
                        type="button"
                        onClick={() => onNavigate(`/voucher-types/${order.orderItems![0].product?.brandCode}`)}
                        className="text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
                      >
                        재주문
                      </button>
                    )}
                  </div>
                </div>

                {/* Status description for PENDING */}
                {order.status === 'PENDING' && (
                  <div className="px-5 pb-3 sm:px-6">
                    <p className="text-xs text-warning font-medium">결제가 진행 중입니다</p>
                  </div>
                )}

                {/* PIN Section */}
                {order.voucherCodes && order.voucherCodes.length > 0 && (
                  <div className="mypage-pin-section">
                    <div className="mypage-pin-section-label">
                      <ShieldCheckIcon size={12} />
                      PIN 정보
                    </div>
                    <div>
                      {order.voucherCodes.map((v) => (
                        <div key={v.id} className="mypage-pin-card">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1.5 min-w-0">
                              {v.giftNumber && (
                                <div className="flex items-center gap-2">
                                  <span className="mypage-pin-label">카드번호</span>
                                  <code className="mypage-pin-value mypage-pin-value--secondary">{v.giftNumber}</code>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="mypage-pin-label">인증코드</span>
                                <code className="mypage-pin-value">{v.pinCode}</code>
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {v.giftNumber && (
                                <Button size="xs" variant="secondary" onClick={() => onCopy(v.giftNumber!)} className="rounded-lg text-[11px]">번호복사</Button>
                              )}
                              <Button size="xs" variant="secondary" onClick={() => onCopy(v.pinCode)} className="rounded-lg text-[11px]">PIN복사</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </Stack>
  );
});
OrderHistory.displayName = 'OrderHistory';

/**
 * 선물함 탭 뷰 컴포넌트입니다.
 * 타인으로부터 받은 선물을 확인하고, 수령 대기 중인 상품권을 수령할 수 있습니다.
 */
const GiftBox = memo(({ gifts, loading, claimingGiftId, onClaim, onCopy }: { gifts: MyGift[], loading: boolean, claimingGiftId: number | null, onClaim: (id: number) => void, onCopy: (text: string) => void }) => (
  <Stack gap={4}>
    {loading ? (
      [1, 2, 3].map(i => <div key={i} className="skeleton h-28 w-full rounded-2xl" />)
    ) : gifts.length === 0 ? (
      <Result
        icon="info"
        title="받은 선물이 없어요"
        description="누군가 선물을 보내면 여기에 표시됩니다"
      />
    ) : (
      gifts.map((gift) => {
        const isClaimed = gift.status === 'CLAIMED';
        const isClaiming = claimingGiftId === gift.id;
        const vouchers = gift.order?.voucherCodes || [];

        // Expiry calculation for unclaimed gifts
        const expiryInfo = !isClaimed && gift.expiresAt ? (() => {
          const expiresDate = new Date(gift.expiresAt!);
          const now = new Date();
          const diffMs = expiresDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const isExpired = diffMs < 0;
          const isUrgent = !isExpired && diffDays <= 3;
          const dateStr = expiresDate.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
          return { isExpired, isUrgent, dateStr };
        })() : null;

        return (
          <Card key={gift.id} className="p-5 sm:p-6 shadow-sm hover:shadow-md transition-[box-shadow]">
            <div className="flex flex-col sm:flex-row justify-between gap-3 mb-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs text-base-content/30">{new Date(gift.createdAt).toLocaleDateString('ko-KR')}</div>
                <h3 className="text-sm font-bold text-base-content truncate">
                  {gift.senderName || '알 수 없음'}님의 선물
                </h3>
                {expiryInfo && (
                  <p className={`text-xs font-medium mt-0.5 ${expiryInfo.isExpired || expiryInfo.isUrgent ? 'text-error' : 'text-base-content/40'}`}>
                    {expiryInfo.isExpired ? '수령 기한 만료' : `수령 기한: ${expiryInfo.dateStr}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge color={isClaimed ? 'green' : 'yellow'} variant="weak" size="sm">
                  {isClaimed ? '수령 완료' : '수령 대기'}
                </Badge>
                {!isClaimed && !expiryInfo?.isExpired && (
                  <Button variant="primary" size="sm" onClick={() => onClaim(gift.id)} isLoading={isClaiming} icon={<Gift size={14} />}>
                    수령하기
                  </Button>
                )}
              </div>
            </div>

            {isClaimed && vouchers.length > 0 && (
              <div className="p-4 rounded-xl bg-grey-50 space-y-3">
                <div className="text-xs font-bold text-base-content/30 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldCheckIcon size={12} className="text-success" />
                  선물 PIN 정보
                </div>
                <div className="space-y-2">
                  {vouchers.map((v: MyGiftVoucher) => (
                    <div key={v.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-white shadow-sm">
                      <div className="space-y-0.5">
                        {v.giftNumber && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-base-content/30">카드번호</span>
                            <code className="text-xs font-bold tabular-nums">{v.giftNumber}</code>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-base-content/30">인증코드</span>
                          <code className="text-xs font-bold text-primary tabular-nums">{v.pinCode}</code>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {v.giftNumber && (
                          <Button size="xs" variant="secondary" onClick={() => onCopy(v.giftNumber)} className="rounded-lg text-xs">번호복사</Button>
                        )}
                        <Button size="xs" variant="secondary" onClick={() => onCopy(v.pinCode)} className="rounded-lg text-xs">PIN복사</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })
    )}
  </Stack>
));
GiftBox.displayName = 'GiftBox';

/**
 * 판매 내역 탭 뷰 컴포넌트입니다.
 * 사용자가 플랫폼에 판매한 상품권의 처리 현황, 진행 단계, 정산 금액을 보여줍니다.
 */
const TradeInHistory = memo(({ tradeIns, loading, onNavigate }: { tradeIns: TradeIn[], loading: boolean, onNavigate?: (path: string) => void }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const filteredTradeIns = statusFilter === 'all'
    ? tradeIns
    : statusFilter === 'CANCELLED'
      ? tradeIns.filter(t => t.status === 'REJECTED')
      : tradeIns.filter(t => t.status === statusFilter);

  const tradeInStatusCounts = {
    all: tradeIns.length,
    REQUESTED: tradeIns.filter(t => t.status === 'REQUESTED').length,
    VERIFIED: tradeIns.filter(t => t.status === 'VERIFIED').length,
    PAID: tradeIns.filter(t => t.status === 'PAID').length,
    CANCELLED: tradeIns.filter(t => t.status === 'REJECTED').length,
  };

  const handleNavigateToTradeIn = () => {
    if (onNavigate) onNavigate('/trade-in');
    else window.location.href = '/trade-in';
  };

  return (
    <Stack gap={4}>
      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="skeleton h-20 w-full rounded-2xl" />)
      ) : tradeIns.length === 0 ? (
        <Result icon="info" title="판매 내역이 없어요" description="보유하신 상품권을 최고가에 판매해보세요" button={<Button variant="primary" size="md" onClick={handleNavigateToTradeIn}>판매하러 가기</Button>} />
      ) : (
        <>
          {/* Status filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {[
              { key: 'all', label: '전체' },
              { key: 'REQUESTED', label: '신청' },
              { key: 'VERIFIED', label: '검증완료' },
              { key: 'PAID', label: '입금완료' },
              { key: 'CANCELLED', label: '거절' },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  statusFilter === f.key
                    ? 'bg-primary text-white'
                    : 'bg-grey-100 text-base-content/50 hover:bg-grey-200'
                }`}
              >
                {f.label}{tradeInStatusCounts[f.key as keyof typeof tradeInStatusCounts] > 0 ? ` (${tradeInStatusCounts[f.key as keyof typeof tradeInStatusCounts]})` : ''}
              </button>
            ))}
          </div>

          {filteredTradeIns.length === 0 ? (
            <Result icon="info" title="해당 상태의 판매 내역이 없어요" description="다른 필터를 선택해보세요" />
          ) : (
            filteredTradeIns.map(item => {
              const steps = ['REQUESTED', 'RECEIVED', 'VERIFIED', 'PAID'] as const;
              const currentStep = steps.indexOf(item.status as typeof steps[number]);
              const isRejected = item.status === 'REJECTED';
              const stepLabels: Record<string, string> = { REQUESTED: '신청', RECEIVED: '수령', VERIFIED: '검증', PAID: '입금' };
              const isExpanded = expandedId === item.id;
              const rejectionReason = item.inspectionNote || item.adminNote || '상품권 검증에 실패했습니다';

              return (
                <Card key={item.id} className="p-0 overflow-hidden shadow-sm hover:shadow-md transition-[box-shadow]">
                  {/* Clickable header — toggles expanded view */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="w-full text-left"
                    aria-expanded={isExpanded}
                  >
                    {/* Header */}
                    <div className="px-5 pt-4 pb-3 sm:px-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] text-base-content/30">{getRelativeTime(item.createdAt)}</span>
                          </div>
                          <h3 className="text-[15px] font-bold text-base-content leading-snug">
                            {item.productBrand}{item.productName ? ` · ${item.productName}` : ''}
                            {item.quantity > 1 ? <span className="text-base-content/40 font-medium"> × {item.quantity}매</span> : ''}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.status} type="tradein" />
                          <span className={`text-base-content/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true">
                            ▾
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="px-5 pb-3 sm:px-6">
                      <div className="text-lg font-extrabold text-success tabular-nums tracking-tight">
                        {formatPrice(Number(item.payoutAmount))}
                      </div>
                    </div>
                  </button>

                  {/* Progress Steps (always visible) */}
                  {!isRejected && (
                    <div className="border-t border-grey-100 px-5 py-3 sm:px-6">
                      <div className="flex items-center gap-0">
                        {steps.map((step, idx) => {
                          const isComplete = idx <= currentStep;
                          const isCurrent = idx === currentStep;
                          return (
                            <div key={step} className="flex items-center flex-1">
                              <div className="flex flex-col items-center flex-1">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isComplete ? 'bg-primary text-white' : 'bg-grey-100 text-base-content/30'
                                } ${isCurrent ? 'ring-2 ring-primary/20' : ''}`}>
                                  {isComplete ? '✓' : idx + 1}
                                </div>
                                <span className={`text-[10px] mt-1 ${isComplete ? 'text-primary font-semibold' : 'text-base-content/30'}`}>
                                  {stepLabels[step]}
                                </span>
                              </div>
                              {idx < steps.length - 1 && (
                                <div className={`h-0.5 flex-1 mx-1 -mt-4 ${idx < currentStep ? 'bg-primary' : 'bg-grey-100'}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rejected reason (always visible) */}
                  {isRejected && (
                    <div className="border-t border-red-100 bg-red-50/30 px-5 py-3 sm:px-6">
                      <p className="text-xs text-error/70">거절 사유: {rejectionReason}</p>
                    </div>
                  )}

                  {/* Expanded detail view */}
                  {isExpanded && (
                    <div className="border-t border-grey-100 bg-grey-50/40 px-5 py-4 sm:px-6 space-y-2.5">
                      <div className="text-[11px] font-bold text-base-content/30 uppercase tracking-wider mb-2">상세 정보</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {item.productBrand && (
                          <div>
                            <span className="text-[11px] text-base-content/40 block mb-0.5">브랜드</span>
                            <span className="font-semibold text-base-content">{item.productBrand}</span>
                          </div>
                        )}
                        {item.productName && (
                          <div>
                            <span className="text-[11px] text-base-content/40 block mb-0.5">상품</span>
                            <span className="font-semibold text-base-content">{item.productName}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-[11px] text-base-content/40 block mb-0.5">수량</span>
                          <span className="font-semibold text-base-content">{item.quantity}매</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-base-content/40 block mb-0.5">정산 금액</span>
                          <span className="font-bold text-success text-base">{formatPrice(Number(item.payoutAmount))}</span>
                        </div>
                        {item.tradeInRate != null && (
                          <div>
                            <span className="text-[11px] text-base-content/40 block mb-0.5">적용 매입률</span>
                            <span className="font-semibold text-base-content">{item.tradeInRate}%</span>
                          </div>
                        )}
                        <div>
                          <span className="text-[11px] text-base-content/40 block mb-0.5">신청일</span>
                          <span className="font-semibold text-base-content">{new Date(item.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </>
      )}
    </Stack>
  );
});
TradeInHistory.displayName = 'TradeInHistory';

/**
 * 현금영수증 내역 탭 뷰 컴포넌트입니다.
 * 가상계좌/계좌이체로 결제된 주문에 대한 현금영수증 발급 현황을 보여줍니다.
 */
const CashReceiptHistory = memo(({ receipts, loading, onRequestReceipt }: {
  receipts: CashReceipt[], loading: boolean, onRequestReceipt: () => void
}) => {
  const receiptTypeLabel = (type: string) => type === 'INCOME_DEDUCTION' ? '소득공제' : '지출증빙';
  const statusLabel = (status: string) => {
    switch (status) {
      case 'ISSUED': return '발급완료';
      case 'PENDING': return '처리중';
      case 'FAILED': return '발급실패';
      case 'CANCELLED': return '취소됨';
      default: return status;
    }
  };
  const statusColor = (status: string): 'green' | 'yellow' | 'red' | 'grey' => {
    switch (status) {
      case 'ISSUED': return 'green';
      case 'PENDING': return 'yellow';
      case 'FAILED': return 'red';
      case 'CANCELLED': return 'grey';
      default: return 'grey';
    }
  };

  return (
    <Stack gap={4}>
      {loading ? (
        [1, 2, 3].map(i => <div key={i} className="skeleton h-20 w-full rounded-2xl" />)
      ) : receipts.length === 0 ? (
        <Result
          icon="info"
          title="현금영수증 내역이 없어요"
          description="가상계좌/계좌이체로 결제 시 자동 발급됩니다"
        />
      ) : (
        receipts.map(receipt => (
          <Card key={receipt.id} className="p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-base-content/40">주문 #{receipt.orderId}</span>
                  <span className="text-xs text-base-content/40">{new Date(receipt.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-base-content">
                    {formatPrice(Number(receipt.totalAmount))}
                  </span>
                  <Badge variant="secondary" size="sm">{receiptTypeLabel(receipt.type)}</Badge>
                  {receipt.isAutoIssued && <Badge variant="weak" size="sm" color="yellow">자진발급</Badge>}
                </div>
                <div className="text-xs text-base-content/40">
                  {receipt.maskedIdentity}
                  {receipt.confirmNum && <span className="ml-2">승인번호: {receipt.confirmNum}</span>}
                </div>
              </div>
              <Badge color={statusColor(receipt.status)} variant="weak" size="sm">
                {statusLabel(receipt.status)}
              </Badge>
            </div>
          </Card>
        ))
      )}
    </Stack>
  );
});
CashReceiptHistory.displayName = 'CashReceiptHistory';

/**
 * 설정 탭 뷰 컴포넌트입니다.
 * 프로필 수정, 정산 계좌 관리, 알림 설정, 보안 설정(비밀번호, 패스키 2차인증, 주문 OTP), 로그아웃/탈퇴 기능을 통합 관리합니다.
 */
interface PasskeyCredential {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

const PasskeyCredentialList: React.FC<{
  credentials: PasskeyCredential[];
  loading: boolean;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}> = ({ credentials, loading, onDelete, onRename }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startEdit = useCallback((cred: PasskeyCredential) => {
    setEditingId(cred.id);
    setEditingName(cred.name);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editingName.trim()) return;
    if (editingName.trim().length > 50) return;
    await onRename(editingId, editingName.trim());
    setEditingId(null);
    setEditingName('');
  }, [editingId, editingName, onRename]);

  return (
    <Card className="p-0 overflow-hidden mt-2" shadow="sm">
      {credentials.map((cred) => (
        <div key={cred.id} className="flex items-center justify-between px-4 py-3 border-b border-grey-50 last:border-b-0">
          {editingId === cred.id ? (
            <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
              <TextField
                variant="box"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value.slice(0, 50))}
                autoFocus
                maxLength={50}
                placeholder="패스키 이름 (50자 이내)"
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                style={{ height: 36 }}
              />
              <button type="button" onClick={saveEdit} className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors" aria-label="저장">
                <Check size={16} />
              </button>
              <button type="button" onClick={cancelEdit} className="p-1.5 rounded-lg text-base-content/30 hover:bg-grey-100 transition-colors" aria-label="취소">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-base-content truncate">{cred.name}</p>
              <p className="text-xs text-base-content/40">
                {cred.createdAt ? new Date(cred.createdAt).toLocaleDateString('ko-KR') : ''}
                {cred.lastUsedAt ? ` · 최근 사용: ${new Date(cred.lastUsedAt).toLocaleDateString('ko-KR')}` : ''}
              </p>
            </div>
          )}
          {editingId !== cred.id && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => startEdit(cred)}
                disabled={loading}
                className="p-2 rounded-lg text-base-content/30 hover:text-primary hover:bg-primary/5 transition-colors"
                aria-label={`${cred.name} 이름 변경`}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(cred.id)}
                disabled={loading}
                className="p-2 rounded-lg text-base-content/30 hover:text-error hover:bg-error/5 transition-colors"
                aria-label={`${cred.name} 삭제`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
};

const SettingsView = memo(({
  bankAccount,
  notifications,
  onShowProfile,
  onShowBank,
  onToggleNotification,
  onShowPassword,
  onLogout,
  onShowWithdraw,
  mfaEnabled,
  onMfaToggle,
  passkeyCredentials,
  passkeyLoading,
  onRegisterPasskey,
  onDeletePasskey,
  onRenamePasskey,
}: {
  bankAccount: BankAccount | null,
  notifications: NotificationSettings | null,
  mfaEnabled: boolean,
  onMfaToggle: () => void,
  onShowProfile: () => void,
  onShowBank: () => void,
  onToggleNotification: (key: 'emailNotification' | 'pushNotification', value: boolean) => void,
  onShowPassword: () => void,
  onLogout: () => void,
  onShowWithdraw: () => void,
  passkeyCredentials: PasskeyCredential[],
  passkeyLoading: boolean,
  onRegisterPasskey: () => void,
  onDeletePasskey: (id: string) => void,
  onRenamePasskey: (id: string, name: string) => void,
}) => (
  <Stack gap={6}>
    {/* Section: Profile */}
    <div>
      <h3 className="text-xs font-bold text-base-content/30 uppercase tracking-wider mb-3">프로필 및 정보</h3>
      <Card className="p-0 overflow-hidden" shadow="sm">
        <ListRow
          left={<ListRowAssetIcon icon={MapPin} shape="squircle" size="md" backgroundColor="var(--color-blue-50)" color="var(--color-primary)" />}
          contents={<ListRowTexts type="2RowTypeA" top="배송지 설정" bottom="택배 수령 주소 관리" />}
          withArrow
          onClick={onShowProfile}
          className="hover:bg-grey-50 px-4"
        />
        <ListRow
          left={<ListRowAssetIcon icon={Building2} shape="squircle" size="md" backgroundColor="var(--color-blue-50)" color="var(--color-primary)" />}
          contents={
            <ListRowTexts
              type="2RowTypeA"
              top="정산 계좌 관리"
              bottom={bankAccount?.bankName && bankAccount?.accountNumber
                ? `${bankAccount.bankName} ${bankAccount.accountNumber}`
                : '미등록 (판매 시 등록 필요)'}
            />
          }
          withArrow
          onClick={onShowBank}
          className="hover:bg-grey-50 px-4"
        />
      </Card>
    </div>

    {/* Section: Notifications */}
    <div>
      <h3 className="text-xs font-bold text-base-content/30 uppercase tracking-wider mb-3">알림 및 서비스</h3>
      <Card className="p-0 overflow-hidden" shadow="sm">
        <ListRow
          left={<ListRowAssetIcon icon={Bell} shape="squircle" size="md" backgroundColor="var(--color-yellow-50)" color="var(--color-warning)" />}
          contents={<ListRowTexts type="2RowTypeA" top="이메일 알림" bottom="중요 거래 정보를 메일로 받습니다" />}
          right={
            notifications === null
              ? <div className="w-10 h-6 rounded-full bg-grey-200 animate-pulse" aria-busy="true" role="status" aria-label="로딩 중" />
              : <Switch checked={notifications.emailNotification} onChange={(v) => onToggleNotification('emailNotification', v)} label="이메일 알림" />
          }
          className="px-4"
        />
      </Card>
    </div>

    {/* Section: Security */}
    <div>
      <h3 className="text-xs font-bold text-base-content/30 uppercase tracking-wider mb-3">보안 및 계정</h3>
      <Card className="p-0 overflow-hidden" shadow="sm">
        <ListRow
          left={<ListRowAssetIcon icon={Smartphone} shape="squircle" size="md" backgroundColor="var(--color-blue-50)" color="var(--color-primary)" />}
          contents={<ListRowTexts type="2RowTypeA" top="Google OTP" bottom={mfaEnabled ? '비밀번호 로그인 시 OTP 인증이 적용됩니다' : '비밀번호 로그인 시 추가 인증을 활성화합니다'} />}
          right={<Switch checked={mfaEnabled} onChange={onMfaToggle} label="Google OTP" />}
          className="px-4"
        />
        <ListRow
          left={<ListRowAssetIcon icon={Fingerprint} shape="squircle" size="md" backgroundColor="var(--color-blue-50)" color="var(--color-primary)" />}
          contents={<ListRowTexts type="2RowTypeA" top="패스키 관리" bottom={passkeyCredentials.length > 0 ? `${passkeyCredentials.length}개 등록됨 · 패스키로 빠르게 로그인` : '비밀번호 없이 지문, Face ID로 로그인합니다'} />}
          withArrow
          onClick={onRegisterPasskey}
          className="hover:bg-grey-50 px-4"
        />
      </Card>

      {/* Passkey Credentials List */}
      {passkeyCredentials.length > 0 && (
        <PasskeyCredentialList
          credentials={passkeyCredentials}
          loading={passkeyLoading}
          onDelete={onDeletePasskey}
          onRename={onRenamePasskey}
        />
      )}

      {/* 멀티 기기 안내 */}
      <p className="text-xs text-base-content/40 px-1 mt-2 mb-3">
        💡 여러 기기에 패스키를 등록하면 기기 분실 시에도 안전합니다.
      </p>

      <Card className="p-0 overflow-hidden mt-2" shadow="sm">
        <ListRow
          left={<ListRowAssetIcon icon={ShieldCheck} shape="squircle" size="md" backgroundColor="var(--color-green-50)" color="var(--color-success)" />}
          contents={<ListRowTexts type="2RowTypeA" top="비밀번호 변경" bottom="주기적인 변경으로 계정을 보호하세요" />}
          withArrow
          onClick={onShowPassword}
          className="hover:bg-grey-50 px-4"
        />
        <ListRow
          left={<ListRowAssetIcon icon={LogOut} shape="squircle" size="md" backgroundColor="var(--color-red-50)" color="var(--color-error)" />}
          contents={<ListRowTexts type="1RowTypeA" top="로그아웃" />}
          onClick={onLogout}
          className="hover:bg-red-50/50 px-4"
        />
        <ListRow
          left={<ListRowAssetIcon icon={UserX} shape="squircle" size="md" backgroundColor="var(--color-grey-100)" color="var(--color-grey-400)" />}
          contents={<ListRowTexts type="2RowTypeA" top="회원 탈퇴" bottom="계정 및 모든 정보 영구 삭제" />}
          onClick={onShowWithdraw}
          className="hover:bg-grey-50 px-4"
        />
      </Card>
    </div>
  </Stack>
));
SettingsView.displayName = 'SettingsView';

// ============================================================
// Main Component
// ============================================================

/**
 * 마이페이지 메인 컴포넌트입니다.
 * 
 * 주요 기능 및 설계 패턴:
 * 1. 상태 중심 탭 관리: `activeTab` 상태에 따라 렌더링할 뷰를 결정하며, 각 탭의 데이터(orders, gifts, tradeIns)를 효율적으로 로드합니다.
 * 2. 복합 사이드 이펙트 처리:
 *    - Google OTP: QR 코드 생성, 코드 검증. 비밀번호 로그인 시 2차 인증으로 사용됩니다.
 *    - 데이터 엑셀/증빙 수출: 선택한 기간이나 유형에 따른 파일 생성 및 다운로드 로직.
 *    - 계정 및 인증 관리: KYC 상태 확인, 은행 계좌 점유 인증, 프로필 업데이트 등.
 * 3. 통합 모달 시스템: 다양한 사용자 액션(정보 수정, 보안 설정, 취소 확인 등)을 독립된 모달 컴포넌트로 분리하여 관리합니다.
 * 4. 관심사 분리: `useMyPage` 커스텀 훅이 인증 상태 확인, API 호출, 상태 업데이트 등 비즈니스 로직을 전담합니다.
 */
const MyPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    isLoading,
    activeTab,
    loading,
    orders,
    gifts,
    tradeIns,
    cashReceipts,
    refetchReceipts,
    showProfileModal,
    setShowProfileModal,
    showPasswordModal,
    setShowPasswordModal,
    showBankModal,
    setShowBankModal,
    showWithdrawModal,
    setShowWithdrawModal,
    withdrawPassword,
    setWithdrawPassword,
    withdrawError,
    profileForm,
    setProfileForm,
    notifications,
    saving,
    bankAccount,
    showExportModal,
    setShowExportModal,
    exporting,
    exportingBankSubmission,
    cancelTarget,
    setCancelTarget,
    claimingGiftId,
    cancelOrderMutation,
    handleTabChange,
    copyToClipboard,
    handleCancelOrder,
    handleConfirmCancel,
    handleClaimGift,
    handleExportWithOptions,
    handleExportBankSubmission,
    handleLogout,
    handleUpdateProfile,
    handleToggleNotification,
    handleBankVerified,
    handleWithdraw,
    // MFA
    mfaEnabled,
    showMfaSetupModal, setShowMfaSetupModal,
    mfaQrUrl, setMfaQrUrl, mfaSecret, setMfaSecret,
    handleMfaSetup,
    handleMfaVerify,
    handleMfaDisable,
    mfaProcessing,
    // WebAuthn (Passkey)
    passkeyCredentials,
    passkeyLoading,
    handleRegisterPasskey,
    handleRenamePasskey,
    handleDeletePasskey,
  } = useMyPage();

  const [showMfaDisableModal, setShowMfaDisableModal] = useState(false);
  const [showMfaPasswordModal, setShowMfaPasswordModal] = useState(false);
  const [mfaSetupPassword, setMfaSetupPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPasskeyRegisterModal, setShowPasskeyRegisterModal] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');

  // Cash Receipt Request Modal state
  const [showReceiptRequestModal, setShowReceiptRequestModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ orderId: 0, type: 'INCOME_DEDUCTION' as 'INCOME_DEDUCTION' | 'EXPENSE_PROOF', identityType: 'PHONE' as 'PHONE' | 'BUSINESS_NO' | 'CARD_NO', identityNumber: '' });
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);

  if (isLoading || !isAuthenticated) return null;

  const tabLabel = MYPAGE_TAB_CONFIG.find(t => t.id === activeTab)?.label || '';

  return (
    <div className="page-container">
      <SEO title="마이페이지" description="주문 내역, 선물함, 판매 내역을 확인하세요" />
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 md:py-10">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
          <MyPageSidebar user={user} activeTab={activeTab} onTabChange={handleTabChange} />

          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h1 className="text-xl font-bold text-base-content tracking-tight">
                {tabLabel}
              </h1>

              {!loading && (activeTab === 'orders' || activeTab === 'tradeins') && (
                <div className="flex gap-2">
                  {activeTab === 'orders' && (orders.length > 0) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowExportModal(true)}
                      leftIcon={<Download size={14} />}
                      className="rounded-full bg-white border-grey-200"
                    >
                      엑셀
                    </Button>
                  )}
                  {activeTab === 'tradeins' && tradeIns.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleExportBankSubmission}
                      loading={exportingBankSubmission}
                      leftIcon={<Download size={14} />}
                      className="rounded-full bg-white border-grey-200"
                    >
                      증빙
                    </Button>
                  )}
                  {/* [비활성화] 유가증권은 현금영수증 발급 대상 아님
                  {activeTab === 'receipts' && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setShowReceiptRequestModal(true)}
                      leftIcon={<Receipt size={14} />}
                      className="rounded-full"
                    >
                      사후 신청
                    </Button>
                  )}
                  */}
                </div>
              )}
            </div>

            <div className="support-hub-page__tab-content" key={activeTab}>
              {activeTab === 'orders' && (
                <OrderHistory orders={orders} loading={loading} onCancel={handleCancelOrder} onCopy={copyToClipboard} onNavigate={navigate} />
              )}
              {activeTab === 'gifts' && (
                <GiftBox gifts={gifts} loading={loading} claimingGiftId={claimingGiftId} onClaim={handleClaimGift} onCopy={copyToClipboard} />
              )}
              {activeTab === 'tradeins' && (
                <TradeInHistory tradeIns={tradeIns} loading={loading} onNavigate={navigate} />
              )}
              {/* [비활성화] 유가증권은 현금영수증 발급 대상 아님
              {activeTab === 'receipts' && (
                <CashReceiptHistory receipts={cashReceipts} loading={loading} onRequestReceipt={() => setShowReceiptRequestModal(true)} />
              )}
              */}
              {activeTab === 'settings' && (
                <SettingsView
                  bankAccount={bankAccount}
                  notifications={notifications}
                  onShowProfile={() => setShowProfileModal(true)}
                  onShowBank={() => setShowBankModal(true)}
                  onToggleNotification={handleToggleNotification}
                  onShowPassword={() => setShowPasswordModal(true)}
                  onLogout={handleLogout}
                  onShowWithdraw={() => { setShowWithdrawModal(true); setWithdrawPassword(''); }}
                  mfaEnabled={mfaEnabled}
                  onMfaToggle={() => mfaEnabled ? setShowMfaDisableModal(true) : setShowMfaPasswordModal(true)}
                  passkeyCredentials={passkeyCredentials}
                  passkeyLoading={passkeyLoading}
                  onRegisterPasskey={() => { setPasskeyName(''); setShowPasskeyRegisterModal(true); }}
                  onDeletePasskey={handleDeletePasskey}
                  onRenamePasskey={handleRenamePasskey}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} profileForm={profileForm} onFormChange={setProfileForm} saving={saving} onSave={handleUpdateProfile} />
      <PasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} userId={user?.id} />
      <BankModal isOpen={showBankModal} onClose={() => setShowBankModal(false)} bankAccount={bankAccount} userId={user?.id} onVerified={handleBankVerified} />
      <WithdrawModal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} saving={saving} password={withdrawPassword} onPasswordChange={setWithdrawPassword} error={withdrawError} onWithdraw={handleWithdraw} />
      <ExportOptionsModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onExport={handleExportWithOptions} loading={exporting} />

      {/* MFA Password Confirmation Modal */}
      <Modal isOpen={showMfaPasswordModal} onClose={() => { setShowMfaPasswordModal(false); setMfaSetupPassword(''); }} title="비밀번호 확인" size="small">
        <div className="space-y-4">
          <p className="text-sm text-base-content/60">OTP 설정을 위해 현재 비밀번호를 입력해주세요.</p>
          <TextField.Password
            variant="box"
            label="현재 비밀번호"
            labelOption="sustain"
            value={mfaSetupPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMfaSetupPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
          />
          <Button
            variant="cta"
            fullWidth
            disabled={!mfaSetupPassword}
            onClick={async () => {
              await handleMfaSetup(mfaSetupPassword);
              setShowMfaPasswordModal(false);
              setMfaSetupPassword('');
            }}
          >
            확인
          </Button>
        </div>
      </Modal>

      {/* MFA Setup Modal */}
      <Modal isOpen={showMfaSetupModal} onClose={() => { setShowMfaSetupModal(false); setMfaCode(''); setMfaQrUrl(''); setMfaSecret(''); }} title="Google OTP 설정">
        <div className="space-y-4">
          <div className="p-3 rounded-xl" style={{ background: 'color-mix(in oklch, var(--color-primary) 4%, var(--color-grey-50))', border: '1px solid color-mix(in oklch, var(--color-primary) 8%, var(--color-grey-100))' }}>
            <p className="text-xs sm:text-sm text-base-content/60 leading-relaxed">
              OTP를 활성화하면 비밀번호 로그인 시 추가 인증이 요구됩니다. 패스키 로그인에는 영향이 없습니다. Google Authenticator 앱에서 아래 QR 코드를 스캔하거나 시크릿 키를 직접 입력하세요.
            </p>
          </div>
          {mfaQrUrl && (
            <div className="flex justify-center">
              <img src={mfaQrUrl} alt="OTP QR 코드" className="w-48 h-48 rounded-xl border border-grey-100" width={192} height={192} loading="lazy" decoding="async" />
            </div>
          )}
          {mfaSecret && (
            <div className="text-center">
              <p className="text-xs text-base-content/40 mb-1">시크릿 키 (수동 입력용)</p>
              <code className="text-sm font-mono font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-lg select-all">{mfaSecret}</code>
            </div>
          )}
          <TextField
            label="인증 코드"
            variant="box"
            placeholder="6자리 코드 입력"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <Button variant="cta" fullWidth onClick={() => { handleMfaVerify(mfaCode); setMfaCode(''); }} disabled={mfaCode.length !== 6 || mfaProcessing} loading={mfaProcessing}>
            OTP 활성화
          </Button>
        </div>
      </Modal>

      {/* MFA Disable Modal */}
      <Modal isOpen={showMfaDisableModal} onClose={() => { setShowMfaDisableModal(false); setMfaCode(''); }} title="Google OTP 비활성화" size="small">
        <div className="space-y-4">
          <p className="text-sm text-base-content/60">OTP를 비활성화하면 비밀번호 로그인 시 추가 인증 없이 진행됩니다. 비활성화하려면 현재 인증 코드를 입력해주세요.</p>
          <TextField
            label="인증 코드"
            variant="box"
            placeholder="6자리 코드 입력"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <Button variant="danger" fullWidth onClick={() => { handleMfaDisable(mfaCode); setMfaCode(''); setShowMfaDisableModal(false); }} disabled={mfaCode.length !== 6 || mfaProcessing} loading={mfaProcessing}>
            OTP 비활성화
          </Button>
        </div>
      </Modal>

      {/* Passkey Register Modal */}
      <Modal isOpen={showPasskeyRegisterModal} onClose={() => { setShowPasskeyRegisterModal(false); setPasskeyName(''); }} title="새 패스키 등록" size="small">
        <div className="space-y-4">
          <div className="p-3 rounded-xl" style={{ background: 'color-mix(in oklch, var(--color-primary) 4%, var(--color-grey-50))', border: '1px solid color-mix(in oklch, var(--color-primary) 8%, var(--color-grey-100))' }}>
            <p className="text-xs sm:text-sm text-base-content/60 leading-relaxed">
              패스키를 등록하면 비밀번호 없이 지문, Face ID, 보안 키만으로 빠르고 안전하게 로그인할 수 있습니다.
            </p>
          </div>
          <TextField
            label="패스키 이름"
            variant="box"
            placeholder="예: 내 MacBook, YubiKey"
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
            autoFocus
          />
          <Button
            variant="cta"
            fullWidth
            onClick={() => {
              const name = passkeyName.trim() || `패스키 ${new Date().toLocaleDateString('ko-KR')}`;
              handleRegisterPasskey(name);
              setShowPasskeyRegisterModal(false);
            }}
            disabled={passkeyLoading}
            leftIcon={<Fingerprint size={18} />}
          >
            패스키 등록
          </Button>
        </div>
      </Modal>

      {/* [비활성화] 유가증권은 현금영수증 발급 대상 아님
      <Modal isOpen={showReceiptRequestModal} onClose={() => setShowReceiptRequestModal(false)} title="현금영수증 사후 신청" size="small">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
            <p className="text-xs text-base-content/60 leading-relaxed">
              가상계좌/계좌이체 결제 건에 대해 현금영수증을 신청할 수 있습니다. (결제 후 90일 이내)
            </p>
          </div>
          <TextField
            label="주문 번호"
            variant="box"
            type="number"
            placeholder="주문 ID 입력"
            value={receiptForm.orderId || ''}
            onChange={(e) => setReceiptForm(f => ({ ...f, orderId: Number(e.target.value) }))}
          />
          <div>
            <label className="text-sm font-bold text-base-content mb-2 block">발급 유형</label>
            <div className="flex gap-2">
              <Button size="sm" variant={receiptForm.type === 'INCOME_DEDUCTION' ? 'primary' : 'secondary'} onClick={() => setReceiptForm(f => ({ ...f, type: 'INCOME_DEDUCTION' }))}>소득공제</Button>
              <Button size="sm" variant={receiptForm.type === 'EXPENSE_PROOF' ? 'primary' : 'secondary'} onClick={() => setReceiptForm(f => ({ ...f, type: 'EXPENSE_PROOF' }))}>지출증빙</Button>
            </div>
          </div>
          <TextField
            label={receiptForm.type === 'INCOME_DEDUCTION' ? '휴대폰 번호' : '사업자등록번호'}
            variant="box"
            placeholder={receiptForm.type === 'INCOME_DEDUCTION' ? '01012345678' : '1234567890'}
            value={receiptForm.identityNumber}
            onChange={(e) => setReceiptForm(f => ({ ...f, identityNumber: e.target.value.replace(/\D/g, '') }))}
            inputMode="numeric"
          />
          <Button
            variant="cta"
            fullWidth
            isLoading={receiptSubmitting}
            disabled={!receiptForm.orderId || !receiptForm.identityNumber}
            onClick={async () => {
              setReceiptSubmitting(true);
              try {
                await cashReceiptApi.requestReceipt({
                  orderId: receiptForm.orderId,
                  type: receiptForm.type,
                  identityType: receiptForm.type === 'INCOME_DEDUCTION' ? 'PHONE' : 'BUSINESS_NO',
                  identityNumber: receiptForm.identityNumber,
                });
                setShowReceiptRequestModal(false);
                setReceiptForm({ orderId: 0, type: 'INCOME_DEDUCTION', identityType: 'PHONE', identityNumber: '' });
                refetchReceipts();
              } catch {
                // error is handled by global axios interceptor
              } finally {
                setReceiptSubmitting(false);
              }
            }}
          >
            현금영수증 신청
          </Button>
        </div>
      </Modal>
      */}

      <Modal isOpen={cancelTarget !== null} onClose={() => setCancelTarget(null)} title="주문 취소" size="small" footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" fullWidth onClick={() => setCancelTarget(null)}>돌아가기</Button>
          <Button variant="danger" fullWidth onClick={handleConfirmCancel} isLoading={cancelOrderMutation.isPending}>취소하기</Button>
        </div>
      }>
        <div className="text-center py-2">
          <p className="text-sm font-bold text-base-content mb-1">이 주문을 취소하시겠습니까?</p>
          <p className="text-xs text-base-content/50">취소된 주문은 복구할 수 없습니다.</p>
        </div>
      </Modal>
    </div>
  );
};

export default MyPage;

