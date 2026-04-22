/**
 * @file ShippingForm.tsx
 * @description 배송 정보 입력 폼 - 택배 배송 / 방문 수령 선택
 * @module components/checkout
 */
import React from 'react';
import { Package, Store } from 'lucide-react';
import { Alert, Card, Button, ListHeader, ListHeaderTitleParagraph } from '../../design-system';
import { Truck } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { TRADEIN_RECEIVING_ADDRESS } from '../../constants/site';
import type { ShippingInfo } from '../../store/useCheckoutStore';

interface ShippingFormProps {
  shippingInfo: ShippingInfo | null;
  onShippingInfoChange: (info: ShippingInfo) => void;
}

export function ShippingForm({ shippingInfo, onShippingInfoChange }: ShippingFormProps) {
  const { showToast } = useToast();

  return (
    <section id="shipping-form" className="checkout-section">
      <Card padding="md" shadow="md">
        <ListHeader
          title={
            <ListHeaderTitleParagraph typography="t5" fontWeight="bold">
              <Truck size={18} className="mr-2 text-primary" aria-hidden="true" />
              배송 정보
            </ListHeaderTitleParagraph>
          }
        />

        <div className="checkout-shipping-method mb-4">
          <div className="grid-2">
            <label className={`checkout-payment-option ${shippingInfo?.method === 'DELIVERY' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="shippingMethod"
                value="DELIVERY"
                checked={shippingInfo?.method === 'DELIVERY'}
                onChange={() => onShippingInfoChange({ ...shippingInfo, method: 'DELIVERY' })}
                className="checkout-payment-radio"
                aria-label="택배 배송 선택"
              />
              <Package size={18} aria-hidden="true" />
              <span className="checkout-payment-label">택배 배송</span>
            </label>
            <label className={`checkout-payment-option ${shippingInfo?.method === 'PICKUP' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="shippingMethod"
                value="PICKUP"
                checked={shippingInfo?.method === 'PICKUP'}
                onChange={() => onShippingInfoChange({ ...shippingInfo, method: 'PICKUP' })}
                className="checkout-payment-radio"
                aria-label="방문 수령 선택"
              />
              <Store size={18} aria-hidden="true" />
              <span className="checkout-payment-label">방문 수령</span>
            </label>
          </div>
        </div>

        {shippingInfo?.method === 'DELIVERY' ? (
          <div className="checkout-address-form">
            <div className="flex flex-col gap-2 mb-3">
              <label htmlFor="shipping-name" className="text-xs sm:text-sm font-medium text-base-content">
                수령인 <span aria-label="필수">*</span>
              </label>
              <input
                type="text"
                id="shipping-name"
                className="input input-bordered w-full"
                placeholder="이름을 입력하세요"
                value={shippingInfo?.recipientName || ''}
                onChange={(e) => onShippingInfoChange({ ...shippingInfo, recipientName: e.target.value })}
                required
                aria-required="true"
              />
            </div>
            <div className="flex flex-col gap-2 mb-3">
              <label htmlFor="shipping-phone" className="text-xs sm:text-sm font-medium text-base-content">
                연락처 <span aria-label="필수">*</span>
              </label>
              <input
                type="tel"
                id="shipping-phone"
                inputMode="numeric"
                className="input input-bordered w-full"
                placeholder="010-0000-0000"
                value={shippingInfo?.recipientPhone || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  let formatted = digits;
                  if (digits.length > 7) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                  else if (digits.length > 3) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                  onShippingInfoChange({ ...shippingInfo, recipientPhone: formatted });
                }}
                required
                aria-required="true"
              />
            </div>
            <div className="flex flex-col gap-2 mb-3">
              <label htmlFor="shipping-address" className="text-xs sm:text-sm font-medium text-base-content">
                주소 <span aria-label="필수">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="우편번호"
                  aria-label="우편번호"
                  value={shippingInfo?.recipientZip || ''}
                  readOnly
                  style={{ maxWidth: '120px' }}
                />
                <Button variant="secondary" size="sm" onClick={() => showToast({ message: '주소 검색 기능은 준비중입니다. 직접 입력해주세요', type: 'info' })}>
                  주소 검색
                </Button>
              </div>
              <input
                type="text"
                id="shipping-address"
                className="input input-bordered w-full"
                placeholder="상세 주소를 입력하세요"
                value={shippingInfo?.recipientAddr || ''}
                onChange={(e) => onShippingInfoChange({ ...shippingInfo, recipientAddr: e.target.value, recipientZip: '00000' })}
                required
                aria-required="true"
              />
            </div>
          </div>
        ) : (
          <Alert variant="info">
            방문 수령 시 매장에서 상품을 직접 수령하셔야 합니다.<br/>
            (매장 위치: {TRADEIN_RECEIVING_ADDRESS.address})
          </Alert>
        )}
      </Card>
    </section>
  );
}
