/**
 * @file PinCodeDisplay/index.tsx
 * @description 상품권 PIN 정보 표시 컴포넌트
 * @module design-system/molecules
 *
 * 두 가지 상품권 형식 지원:
 * 1. 단순 PIN (pinCode만 존재) — PIN + 복사 버튼
 * 2. 카드번호 + 인증코드 (giftNumber + pinCode) — 2줄 + 2개 복사 버튼
 *
 * 사용처: CheckoutPage (주문 완료), MyPage (주문/선물 내역)
 */
import React, { useCallback } from 'react';
import { Clipboard } from 'lucide-react';

import { Button } from '../../atoms/Button';

export interface VoucherDisplayItem {
  id?: number;
  pinCode: string;
  giftNumber?: string | null;
  productName?: string;
}

export interface PinCodeDisplayProps {
  /** 표시할 바우처 목록 */
  vouchers: VoucherDisplayItem[];
  /** 클립보드 복사 콜백 */
  onCopy: (text: string) => void;
  /** 컴팩트 모드 (MyPage 등 좁은 영역) */
  compact?: boolean;
  /** 각 항목 상단 라벨 표시 여부 */
  showLabel?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

export function PinCodeDisplay({
  vouchers,
  onCopy,
  compact = false,
  showLabel = false,
  className = '',
}: PinCodeDisplayProps) {
  const handleCopy = useCallback(
    (text: string) => {
      onCopy(text);
    },
    [onCopy],
  );

  if (vouchers.length === 0) return null;

  const btnSize = compact ? 'sm' : 'md';
  const labelSize = compact ? '11px' : '12px';
  const gapSize = compact ? '4px' : '8px';

  return (
    <div className={`pin-code-display ${className}`}>
      {vouchers.map((vc, index) => (
        <div
          key={vc.id ?? vc.pinCode}
          className="pin-code-display__item"
          role="group"
          aria-label={`상품권 ${index + 1}`}
        >
          {showLabel && vc.productName && (
            <span className="pin-code-display__product-label">
              {vc.productName}
            </span>
          )}

          {vc.giftNumber ? (
            <div style={{ flex: 1 }}>
              <span
                className="pin-code-display__label"
                style={{ fontSize: labelSize }}
              >
                카드번호
              </span>
              <code
                className="pin-code-display__code"
                aria-label={`카드번호: ${vc.giftNumber}`}
              >
                {vc.giftNumber}
              </code>
              <span
                className="pin-code-display__label"
                style={{ fontSize: labelSize, marginTop: gapSize }}
              >
                인증코드
              </span>
              <code
                className="pin-code-display__code"
                aria-label={`인증코드: ${vc.pinCode}`}
              >
                {vc.pinCode}
              </code>
              <div
                className="pin-code-display__actions"
                style={{ gap: gapSize, marginTop: gapSize }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(vc.giftNumber!)}
                  icon={<Clipboard size={14} aria-hidden="true" />}
                  aria-label={`카드번호 ${vc.giftNumber} 복사`}
                >
                  카드번호 복사
                </Button>
                <Button
                  variant={compact ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => handleCopy(vc.pinCode)}
                  icon={<Clipboard size={14} aria-hidden="true" />}
                  aria-label={`인증코드 ${vc.pinCode} 복사`}
                >
                  인증코드 복사
                </Button>
              </div>
            </div>
          ) : (
            <>
              <code
                className="pin-code-display__code"
                aria-label={`PIN: ${vc.pinCode}`}
              >
                {vc.pinCode}
              </code>
              <Button
                variant={compact ? 'secondary' : 'primary'}
                size={btnSize}
                onClick={() => handleCopy(vc.pinCode)}
                icon={<Clipboard size={compact ? 14 : 16} aria-hidden="true" />}
                aria-label={`PIN 번호 ${vc.pinCode} 복사하기`}
              >
                복사{compact ? '' : '하기'}
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
