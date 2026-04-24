import './Checkout.css';
import React, { memo } from 'react';
import DaumPostcodeEmbed from 'react-daum-postcode';
import { Smartphone, Clipboard, Gift, Package, Truck, CreditCard, Coins, PlusCircle, Building, Info, Shield, Zap, CheckCircle, Phone, ChevronDown } from 'lucide-react';
import SEO from '../components/common/SEO';
import { OrderConfirmModal } from '../components/checkout/OrderConfirmModal';
import { Card, Button, TextField, TableRow, Overlay, Result, FadeIn, SegmentedControl } from '../design-system';
import { handleImageError, getValidImageUrl, formatPrice } from '../utils';
import { COMPANY_INFO } from '../constants/site';
import { useCheckoutPage } from './CheckoutPage.hooks';
import type { OrderResultData, GiftTarget, CheckoutItem, ShippingInfo, PaymentMethod, CashReceiptType, VoucherDisplay, BankInfo } from '../types';
import type { AuthUser } from '../api/manual';
import type { Address } from 'react-daum-postcode';

// ============================================================
// Sub-components
// ============================================================

/**
 * @component CheckoutResult
 * @description 주문 완료 후 결과를 표시하는 컴포넌트
 * 
 * @param {Object} props
 * @param {OrderResultData} props.orderResult - 서버로부터 응답받은 주문 결과 데이터 (ID, 금액 등)
 * @param {GiftTarget | null} props.giftTarget - 선물하기 정보 (있을 경우 수신자 정보 표시)
 * @param {Function} props.onCopyPin - PIN 번호 복사 핸들러
 * @param {Function} props.onNavigate - 페이지 이동 핸들러
 * 
 * @why 주문 성공 시 사용자에게 즉시 PIN 번호(디지털 상품권)를 제공하거나 선물 발송 예정 상태를 알립니다.
 */
const CheckoutResult = memo(({
  orderResult,
  giftTarget,
  onCopyPin,
  onNavigate
}: {
  orderResult: OrderResultData,
  giftTarget: GiftTarget | null,
  onCopyPin: (pin: string) => void,
  onNavigate: (path: string) => void
}) => (
  <div className="page-wrapper checkout-page">
    <div className="checkout-result-container">
      <Result
        icon="success"
        title={giftTarget ? "선물 주문이 접수되었어요!" : "주문이 접수되었어요!"}
        description={giftTarget ? `입금 확인 후 ${giftTarget.name}님에게 발송됩니다.` : "입금 확인 후 PIN 번호가 발급됩니다. 마이페이지에서 확인해주세요."}
        animated
      />

      {!giftTarget && orderResult.vouchers?.length > 0 && (
        <Card padding="lg" shadow="md" className="checkout-pin-card">
          <div className="checkout-pin-header">
            <Smartphone size={20} aria-hidden="true" />
            <span>상품권 정보</span>
          </div>
          <div className="checkout-pin-list">
            {orderResult.vouchers.map((vc: VoucherDisplay, index: number) => (
              <div key={vc.pinCode} className="checkout-pin-item" role="group" aria-label={`상품권 ${index + 1}`}>
                {vc.giftNumber ? (
                  <div className="flex-1">
                    <div className="text-xs text-base-content/50 mb-1">카드번호</div>
                    <div className="checkout-pin-code" aria-label={`카드번호: ${vc.giftNumber}`}>{vc.giftNumber}</div>
                    <div className="text-xs text-base-content/50 mb-1 mt-2">인증코드</div>
                    <div className="checkout-pin-code" aria-label={`인증코드: ${vc.pinCode}`}>{vc.pinCode}</div>
                    <div className="flex gap-2 mt-2">
                      <Button variant="secondary" size="sm" onClick={() => onCopyPin(vc.giftNumber!)} icon={<Clipboard size={14} aria-hidden="true" />}>카드번호 복사</Button>
                      <Button variant="secondary" size="sm" onClick={() => onCopyPin(vc.pinCode)} icon={<Clipboard size={14} aria-hidden="true" />}>인증코드 복사</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="checkout-pin-code" aria-label={`PIN: ${vc.pinCode}`}>{vc.pinCode}</div>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => onCopyPin(vc.pinCode)}
                      icon={<Clipboard size={16} aria-hidden="true" />}
                      aria-label={`PIN 번호 ${vc.pinCode} 복사하기`}
                    >
                      복사하기
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {giftTarget && (
        <div className="checkout-gift-note">
          선물 주문은 수신자가 직접 PIN 확인이 가능합니다.
        </div>
      )}

      <Card padding="md" shadow="md" className="checkout-summary-card">
        <TableRow
          left="주문 번호"
          right={orderResult.orderCode || `#${orderResult.orderId}`}
          emphasized
          withBorder
        />
        <TableRow
          left="결제 금액"
          right={formatPrice(orderResult.totalAmount)}
          emphasized
          numeric
        />
      </Card>

      {/* PIN 발급 예상 시간 안내 */}
      <Card padding="md" shadow="sm" className="checkout-eta-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
            <Zap size={16} aria-hidden="true" />
          </div>
          <h3 className="text-sm font-bold text-base-content tracking-tight">PIN 발급 예상 시간</h3>
        </div>
        <div className="space-y-2 pl-10">
          <div className="flex items-start gap-2">
            <Smartphone size={14} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="text-sm font-bold text-base-content">디지털 상품권</span>
              <p className="text-xs text-base-content/50">입금 확인 후 즉시 ~ 1시간 이내</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Package size={14} className="text-base-content/40 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="text-sm font-bold text-base-content">실물 상품</span>
              <p className="text-xs text-base-content/50">영업일 1~2일</p>
            </div>
          </div>
        </div>
        <div className="mt-3 pl-10 flex items-center gap-1.5 text-xs text-base-content/40">
          <Info size={12} className="shrink-0" aria-hidden="true" />
          <span>PIN 발급 시 이메일로 알려드립니다.</span>
        </div>
      </Card>

      <div className="checkout-action-buttons">
        <div className="flex gap-2 w-full">
          <Button variant="secondary" size="lg" fullWidth onClick={() => onNavigate('/')}>
            홈으로
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={() => onNavigate('/products')}>
            계속 쇼핑하기
          </Button>
        </div>
        <Button variant="primary" size="lg" fullWidth onClick={() => onNavigate('/mypage?tab=orders')}>
          구매 내역 보기
        </Button>
      </div>
    </div>
  </div>
));
CheckoutResult.displayName = 'CheckoutResult';

/**
 * @component GiftTargetSection
 * @description 선물하기 주문 시 수신자 정보를 요약해서 보여주는 섹션
 * 
 * @why '선물하기' 모드로 진입했을 때만 렌더링되며, 사용자가 입력한 수신자 정보를 최종 확인하는 용도입니다.
 */
const GiftTargetSection = memo(({ giftTarget }: { giftTarget: GiftTarget }) => (
  <FadeIn direction="up" distance={20} delay={0.05}>
    <Card className="p-6 sm:p-8 rounded-3xl border-none shadow-sm bg-[var(--color-gift-light)] border-2 border-[var(--color-gift-border)]">
      <div className="flex items-center gap-2 mb-6 text-[var(--color-gift)]">
        <Gift size={22} aria-hidden="true" />
        <h2 className="text-lg font-bold tracking-tight">선물 받는 분</h2>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-base-content/40">이름</span>
          <span className="text-base font-bold text-base-content">{giftTarget.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-base-content/40">이메일</span>
          <span className="text-base font-bold text-base-content">{giftTarget.email}</span>
        </div>
        {giftTarget.message && (
          <div className="mt-4 p-4 rounded-2xl bg-white border border-pink-100 text-sm text-pink-700 italic leading-relaxed">
            &ldquo;{giftTarget.message}&rdquo;
          </div>
        )}
      </div>
    </Card>
  </FadeIn>
));
GiftTargetSection.displayName = 'GiftTargetSection';

/**
 * @component OrderItemsSection
 * @description 주문하려는 상품 목록을 보여주는 섹션 (아코디언 스타일)
 * 
 * @param {CheckoutItem[]} items - 주문 대상 상품 배열
 * @param {boolean} isOpen - 아코디언 열림 상태
 * @param {Function} onToggle - 아코디언 토글 핸들러
 */
const OrderItemsSection = memo(({ 
  items, 
  isOpen, 
  onToggle 
}: { 
  items: CheckoutItem[],
  isOpen: boolean,
  onToggle: () => void
}) => (
  <FadeIn direction="up" distance={20} delay={0.1}>
    <Card className="p-0 overflow-hidden rounded-3xl checkout-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full p-6 sm:p-8 bg-transparent border-none cursor-pointer group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
            <Package size={20} aria-hidden="true" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold text-base-content tracking-tight">주문 상품</h2>
            <p className="text-xs font-bold text-base-content/30">{items.length}개 상품</p>
          </div>
        </div>
        <ChevronDown
          size={20}
          className={`text-base-content/35 group-hover:text-primary transition-[color,transform] duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      
      {isOpen && (
        <div className="px-6 sm:px-8 pb-8 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-4 pt-4 border-t border-primary/8">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-grey-50 p-1 shrink-0 border border-grey-100 flex items-center justify-center">
                    <img
                      src={getValidImageUrl(item.imageUrl)}
                      alt={item.name}
                      className="w-full h-full object-contain"
                      onError={handleImageError}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-base-content truncate">{item.name}</h3>
                    <p className="text-xs font-medium text-base-content/40">수량 {item.quantity}개</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-base-content tabular-nums shrink-0">
                  {formatPrice((Number(item.buyPrice) || 0) * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  </FadeIn>
));
OrderItemsSection.displayName = 'OrderItemsSection';

/**
 * @component ShippingSection
 * @description 배송 방식(택배/방문) 및 배송지 정보를 입력받는 섹션
 * 
 * @why 
 * 1. 실물 상품(카드형 등)이 포함된 경우에만 노출됩니다.
 * 2. Daum 우편번호 서비스를 연동하여 정확한 주소 입력을 유도합니다.
 */
const ShippingSection = memo(({ 
  shippingInfo, 
  onSetShippingInfo, 
  showPostcode, 
  onShowPostcode, 
  onPostcodeComplete 
}: { 
  shippingInfo: ShippingInfo | null,
  onSetShippingInfo: (info: ShippingInfo) => void,
  showPostcode: boolean,
  onShowPostcode: (show: boolean) => void,
  onPostcodeComplete: (data: Address) => void
}) => (
  <FadeIn direction="up" distance={20} delay={0.15}>
    <Card className="p-6 sm:p-8 rounded-3xl checkout-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
          <Truck size={20} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-base-content tracking-tight">배송지 정보</h2>
      </div>

      <div className="space-y-6">
        <div className="mb-8">
          <SegmentedControl
            value={shippingInfo?.method || 'DELIVERY'}
            onChange={(method) => onSetShippingInfo({ ...shippingInfo!, method: method as 'DELIVERY' | 'PICKUP' })}
            size="lg"
            aria-label="배송 방식 선택"
          >
            <SegmentedControl.Item value="DELIVERY">택배 배송</SegmentedControl.Item>
            <SegmentedControl.Item value="PICKUP">방문 수령</SegmentedControl.Item>
          </SegmentedControl>
        </div>

        {shippingInfo?.method === 'DELIVERY' ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                variant="box"
                label="수령인"
                labelOption="sustain"
                placeholder="이름"
                value={shippingInfo?.recipientName || ''}
                onChange={(e) => onSetShippingInfo({ ...shippingInfo, recipientName: e.target.value })}
              />
              <TextField
                variant="box"
                label="연락처"
                labelOption="sustain"
                type="tel"
                inputMode="tel"
                placeholder="010-0000-0000"
                autoComplete="tel"
                value={shippingInfo?.recipientPhone || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  let formatted = digits;
                  if (digits.length > 7) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                  else if (digits.length > 3) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                  onSetShippingInfo({ ...shippingInfo, recipientPhone: formatted });
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <TextField
                  variant="box"
                  placeholder="우편번호"
                  value={shippingInfo?.recipientZip || ''}
                  readOnly
                  className="flex-1"
                />
                <Button type="button" variant="secondary" size="md" className="shrink-0 h-[56px] rounded-2xl px-6 border-grey-200" onClick={() => onShowPostcode(true)}>
                  주소 검색
                </Button>
              </div>
              <TextField
                variant="box"
                placeholder="주소를 검색해주세요"
                value={shippingInfo?.recipientAddr || ''}
                readOnly
                onClick={() => onShowPostcode(true)}
              />
              {showPostcode && (
                <div className="mt-4 border-2 border-primary/10 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <DaumPostcodeEmbed onComplete={onPostcodeComplete} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
            <Info size={18} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-primary leading-relaxed">
              매장에서 상품을 직접 수령하셔야 합니다.<br />
              <span className="text-xs opacity-70 font-bold uppercase tracking-wide">Location:</span> {COMPANY_INFO.address}
            </p>
          </div>
        )}
      </div>
    </Card>
  </FadeIn>
));
ShippingSection.displayName = 'ShippingSection';

/**
 * @component PaymentSection
 * @description 결제 수단 선택 및 현금영수증 신청 정보 섹션
 * 
 * @why 현재는 '무통장 입금'만 지원하며, 현금영수증 발행을 위한 정보를 조건부로 입력받습니다.
 */
const PaymentSection = memo(({ 
  paymentMethod, 
  onSetPaymentMethod, 
  cashReceiptType, 
  onSetCashReceiptType, 
  cashReceiptNumber, 
  onSetCashReceiptNumber 
}: { 
  paymentMethod: PaymentMethod,
  onSetPaymentMethod: (m: PaymentMethod) => void,
  cashReceiptType: CashReceiptType,
  onSetCashReceiptType: (t: CashReceiptType) => void,
  cashReceiptNumber: string, 
  onSetCashReceiptNumber: (n: string) => void 
}) => (
  <FadeIn direction="up" distance={20} delay={0.2}>
    <Card className="p-6 sm:p-8 rounded-3xl checkout-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
          <CreditCard size={20} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-base-content tracking-tight">결제 수단</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onSetPaymentMethod('CASH')}
          className={`p-6 rounded-3xl border transition-[border-color,background-color] text-left flex flex-col gap-4 ${paymentMethod === 'CASH' ? 'border-primary bg-primary/5' : 'border-grey-100 hover:border-grey-200'}`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'CASH' ? 'bg-primary text-white' : 'bg-grey-100 text-grey-400'}`}>
            <Coins size={20} />
          </div>
          <div>
            <span className={`block font-bold tracking-tight ${paymentMethod === 'CASH' ? 'text-primary' : 'text-base-content/60'}`}>무통장 입금</span>
            <span className="text-xs font-bold text-base-content/30">계좌이체</span>
          </div>
        </button>

        <div className="p-6 rounded-3xl border border-grey-100 bg-grey-50/30 opacity-60 flex flex-col gap-4 cursor-not-allowed">
          <div className="w-10 h-10 rounded-full bg-grey-100 text-grey-300 flex items-center justify-center">
            <PlusCircle size={20} />
          </div>
          <div>
            <span className="block font-bold text-base-content/30 tracking-tight">기타 결제 수단</span>
            <span className="inline-block px-2 py-0.5 rounded-full bg-grey-100 text-xs font-bold text-grey-400 mt-1">준비 중</span>
          </div>
        </div>
      </div>

      {/* [비활성화] 유가증권은 현금영수증 발급 대상 아님
      {paymentMethod === 'CASH' && (
        <div className="mt-10 pt-8 border-t border-primary/8 space-y-6">
          <h3 className="text-sm font-bold text-base-content/40">현금영수증 신청</h3>
          <div className="flex flex-wrap gap-2">
            {([['NO_RECEIPT', '미발행'], ['PERSONAL', '개인소득공제'], ['BUSINESS', '사업자증빙']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onSetCashReceiptType(val)}
                className={`px-5 py-2 rounded-2xl text-sm font-bold transition-[background-color,color,box-shadow] ${cashReceiptType === val ? 'bg-base-content text-white shadow-md' : 'bg-grey-50 text-base-content/40 hover:bg-grey-100'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {cashReceiptType !== 'NO_RECEIPT' && (
            <TextField
              variant="box"
              label={cashReceiptType === 'PERSONAL' ? "휴대폰 번호" : "사업자 등록번호"}
              labelOption="sustain"
              placeholder={cashReceiptType === 'PERSONAL' ? "01012345678" : "000-00-00000"}
              value={cashReceiptNumber}
              onChange={(e) => onSetCashReceiptNumber(e.target.value)}
              inputMode="tel"
              className="animate-in fade-in slide-in-from-top-2 duration-200"
            />
          )}
        </div>
      )}
      */}
    </Card>
  </FadeIn>
));
PaymentSection.displayName = 'PaymentSection';

/**
 * @component BankInfoSection
 * @description 무통장 입금을 위한 은행 계좌 정보를 안내하는 섹션
 * 
 * @why 입금자명이 회원명과 일치해야 자동 입금 확인 확률이 높아짐을 안내합니다.
 */
const BankInfoSection = memo(({
  bankInfo,
  user,
  onCopyAccount
}: {
  bankInfo: BankInfo,
  user: AuthUser | null,
  onCopyAccount: () => void
}) => (
  <FadeIn direction="up" distance={20} delay={0.25}>
    <Card className="p-6 sm:p-8 rounded-3xl checkout-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
          <Building size={20} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-base-content tracking-tight">입금 계좌 안내</h2>
      </div>

      <div className="p-6 rounded-3xl bg-grey-50 border border-grey-100 relative group">
        {bankInfo.isLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-6 w-3/4" />
          </div>
        ) : !bankInfo.accountNumber || bankInfo.accountNumber.length < 5 ? (
          <div className="text-center py-2">
            <p className="text-sm text-base-content/60">계좌 정보를 불러오지 못했습니다.</p>
            <p className="text-xs text-base-content/40 mt-1">고객센터로 문의해주세요 (02-569-7334)</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <span className="text-xs font-bold text-base-content/30">{bankInfo.bankName || '은행'}</span>
              <div className="text-2xl font-bold text-base-content tabular-nums tracking-tighter">
                {bankInfo.accountNumber}
              </div>
              <p className="text-sm font-bold text-base-content/60">예금주: {bankInfo.accountHolder || '-'}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCopyAccount}
              className="absolute top-6 right-6 rounded-full bg-white border-grey-200 shadow-sm hover:shadow-md"
              leftIcon={<Clipboard size={14} />}
            >
              복사
            </Button>
          </>
        )}
      </div>
      
      <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl bg-warning/5 border border-warning/10 text-xs font-bold text-warning/80 leading-relaxed">
        <Info size={16} className="shrink-0" />
        <span>입금자명은 <strong>{user?.name || '주문자 성함'}</strong>으로 정확히 입금해주세요. 입금자명이 다를 경우 확인이 지연될 수 있습니다.</span>
      </div>
    </Card>
  </FadeIn>
));
BankInfoSection.displayName = 'BankInfoSection';

/**
 * @component OrderSummarySection
 * @description 최종 결제 금액 요약 및 결제하기 버튼 섹션
 * 
 * @why 
 * 1. 복잡한 할인 로직이 적용된 최종 실결제 금액을 사용자에게 확정적으로 보여줍니다.
 * 2. 보안 및 신뢰성 정보를 함께 제공하여 결제 전환율을 높입니다.
 */
const OrderSummarySection = memo(({ 
  totalOriginalPrice, 
  totalDiscount, 
  totalPrice, 
  isSubmitting, 
  paymentMethod, 
  bankInfo, 
  onOrderClick 
}: { 
  totalOriginalPrice: number, 
  totalDiscount: number, 
  totalPrice: number, 
  isSubmitting: boolean, 
  paymentMethod: PaymentMethod,
  bankInfo: BankInfo,
  onOrderClick: () => void
}) => (
  <FadeIn direction="up" distance={20} delay={0.3}>
    <Card className="p-8 sm:p-10 rounded-2xl checkout-card mb-12" style={{ boxShadow: 'var(--shadow-md)' }}>
      <h3 className="text-lg font-bold text-base-content tracking-tight mb-6">최종 결제 금액</h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-base-content/60">
          <span className="text-base font-medium tracking-tight">주문 상품 합계</span>
          <span className="text-lg font-semibold tabular-nums">{formatPrice(totalOriginalPrice)}</span>
        </div>
        <div className="flex justify-between items-center text-error">
          <span className="text-base font-medium tracking-tight">총 할인 금액</span>
          <span className="text-lg font-semibold tabular-nums">-{formatPrice(totalDiscount)}</span>
        </div>
        <div className="pt-8 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderTop: '1px solid color-mix(in oklch, var(--color-primary) 8%, var(--color-grey-100))' }}>
          <span className="text-xl font-black text-base-content tracking-tight">실제 결제할 금액</span>
          <span className="text-3xl font-black text-primary tabular-nums tracking-tighter">
            {formatPrice(totalPrice)}
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {[
          { icon: Shield, label: 'SSL 암호화 보호', color: 'var(--color-primary)' },
          { icon: Zap, label: '5분 내 PIN 발급', color: 'var(--color-point)' },
          { icon: CheckCircle, label: '정품 보장', color: 'var(--color-success)' },
          { icon: Phone, label: '즉시 환불 가능', color: 'var(--color-primary)' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: 'color-mix(in oklch, var(--color-primary) 3%, var(--color-grey-50))' }}>
            <Icon size={16} style={{ color, flexShrink: 0 }} aria-hidden="true" />
            <span className="text-xs font-bold text-base-content/60">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Button
          variant="primary"
          size="2xl"
          fullWidth
          onClick={onOrderClick}
          disabled={isSubmitting || (paymentMethod === 'CASH' && (!bankInfo.accountNumber || bankInfo.isLoading))}
          isLoading={isSubmitting}
          className="shadow-primary"
        >
          결제하기
        </Button>
        <p className="mt-6 text-center text-xs text-base-content/40 leading-relaxed">
          위 주문 내용을 확인하였으며 결제 진행에 동의합니다.<br />
          (전자금융거래 이용약관 및 개인정보 수집 및 이용 동의)
        </p>
        <div className="flex items-center justify-center gap-1.5 text-xs text-base-content/40 mt-3">
          <Shield size={12} className="text-success" aria-hidden="true" />
          <span>결제 정보는 암호화 처리됩니다</span>
        </div>
      </div>
    </Card>
  </FadeIn>
));
OrderSummarySection.displayName = 'OrderSummarySection';

// ============================================================
// Main Component
// ============================================================

/**
 * @page CheckoutPage
 * @description 상품권 주문/결제 프로세스를 관리하는 핵심 페이지
 * 
 * @workflow
 * 1. 진입 시 장바구니/직접구매 아이템 로드 (`useCheckoutPage`)
 * 2. '선물하기' 여부에 따른 UI 분기
 * 3. 실물 상품 포함 시 배송지 입력 단계 활성화
 * 4. 무통장 입금 정보 로드 (관리자 설정 계좌)
 * 5. 결제하기 클릭 시 최종 확인 모달 노출
 * 6. 결제 처리 (API 호출) 및 결과 화면(CheckoutResult) 전환
 * 
 * @state_management
 * - 복잡한 주문 로직은 `useCheckoutPage` 커스텀 훅으로 위임하여 View와 Logic을 분리했습니다.
 * - 주문 중 'Submitting' 상태를 Overlay로 관리하여 중복 클릭을 방지합니다.
 */
const CheckoutPage: React.FC = () => {
  const {
    items,
    giftTarget,
    shippingInfo,
    setShippingInfo,
    user,
    bankInfo,
    cashReceiptType,
    setCashReceiptType,
    cashReceiptNumber,
    setCashReceiptNumber,
    showPostcode,
    setShowPostcode,
    orderItemsOpen,
    setOrderItemsOpen,
    totalPrice,
    hasPhysicalItems,
    paymentMethod,
    setPaymentMethod,
    orderResult,
    showConfirmModal,
    setShowConfirmModal,
    isSubmitting,
    totalOriginalPrice,
    totalDiscount,
    handlePostcodeComplete,
    handleCopyAccount,
    handleCopyPin,
    handleOrderClick,
    handleOrderConfirm,
    navigate,
  } = useCheckoutPage();

  if (items.length === 0 && !orderResult) {
    return (
      <div className="page-wrapper checkout-page">
        <div className="checkout-container">
          <Result
            icon="info"
            title="주문할 상품이 없어요"
            description="원하는 상품을 담아보세요"
            button={
              <Button variant="cta" size="lg" onClick={() => navigate('/')}>
                상품 보러가기
              </Button>
            }
            fullHeight
          />
        </div>
      </div>
    );
  }

  if (orderResult) {
    return (
      <CheckoutResult 
        orderResult={orderResult} 
        giftTarget={giftTarget} 
        onCopyPin={handleCopyPin} 
        onNavigate={navigate} 
      />
    );
  }

  return (
    <div className="page-container bg-base-200/50">
      <SEO title="주문/결제" description="상품권 주문 및 결제 페이지" />
      {isSubmitting && (
        <Overlay.Processing
          message={giftTarget ? "선물을 보내고 있어요" : "결제를 처리하고 있어요"}
          subMessage="창을 닫지 말고 잠시만 기다려 주세요."
        />
      )}

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 md:py-12">
        <FadeIn direction="up" distance={20}>
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-black text-base-content tracking-tight">
              {giftTarget ? '선물 주문' : '주문서 작성'}
            </h1>
            <p className="text-base-content/50 text-base mt-2">
              주문 정보를 확인하고 결제를 진행해주세요
            </p>
          </div>
        </FadeIn>

        <div className="space-y-6">
          {giftTarget && <GiftTargetSection giftTarget={giftTarget} />}

          <OrderItemsSection 
            items={items} 
            isOpen={orderItemsOpen} 
            onToggle={() => setOrderItemsOpen(prev => !prev)} 
          />

          {hasPhysicalItems && (
            <ShippingSection 
              shippingInfo={shippingInfo} 
              onSetShippingInfo={setShippingInfo} 
              showPostcode={showPostcode} 
              onShowPostcode={setShowPostcode} 
              onPostcodeComplete={handlePostcodeComplete} 
            />
          )}

          <PaymentSection 
            paymentMethod={paymentMethod} 
            onSetPaymentMethod={setPaymentMethod} 
            cashReceiptType={cashReceiptType} 
            onSetCashReceiptType={setCashReceiptType} 
            cashReceiptNumber={cashReceiptNumber} 
            onSetCashReceiptNumber={setCashReceiptNumber} 
          />

          {paymentMethod === 'CASH' && (
            <BankInfoSection 
              bankInfo={bankInfo} 
              user={user} 
              onCopyAccount={handleCopyAccount} 
            />
          )}

          <OrderSummarySection 
            totalOriginalPrice={totalOriginalPrice} 
            totalDiscount={totalDiscount} 
            totalPrice={totalPrice} 
            isSubmitting={isSubmitting} 
            paymentMethod={paymentMethod} 
            bankInfo={bankInfo} 
            onOrderClick={handleOrderClick} 
          />
        </div>
      </div>

      <OrderConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleOrderConfirm}
        items={items}
        totalPrice={totalPrice}
        paymentMethod={paymentMethod}
        bankInfo={bankInfo}
        giftTarget={giftTarget}
        isSubmitting={isSubmitting}
      />

    </div>
  );
};

export default CheckoutPage;
