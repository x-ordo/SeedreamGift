import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaymentStatus, useResumePayment } from '../../hooks';
import { useToast } from '../../contexts/ToastContext';
import type { PaymentUIStatus } from '../../hooks/usePaymentStatus';
import styles from './PendingPaymentCard.module.css';

interface Props {
  orderId: number;
}

/** 남은 시간 mm:ss 포맷. past 면 00:00 + expired=true. */
function formatCountdown(expiresAt: string | null | undefined, now: number): { text: string; expired: boolean } {
  if (!expiresAt) return { text: '--:--', expired: false };
  const end = new Date(expiresAt).getTime();
  const diff = Math.max(0, end - now);
  const expired = diff === 0;
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return { text: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, expired };
}

function headingText(status: PaymentUIStatus): string {
  switch (status) {
    case 'AWAITING_BANK_SELECTION':
      return '결제창 진입 대기';
    case 'AWAITING_DEPOSIT':
      return '입금 대기';
    case 'AMOUNT_MISMATCH':
      return '입금액 확인 필요';
    case 'FAILED':
      return '결제 실패';
    case 'EXPIRED':
      return '결제 기한 만료';
    case 'CANCELLED':
      return '취소됨';
    default:
      return '결제 진행 중';
  }
}

/**
 * MyPage 주문 탭에서 PENDING/ISSUED 주문 내부에 표시되는 입금 대기 카드.
 *
 * 보여주는 것:
 *  - VA 계좌번호, 은행코드, 입금자명 (있으면)
 *  - 기한 카운트다운 (1초마다 갱신)
 *  - "결제창 다시 열기" 버튼 (canResume=true 일 때)
 *  - AMOUNT_MISMATCH 시 별도 안내
 *
 * 데이터: usePaymentStatus(orderId) — 1분 폴링 (PENDING/ISSUED 상태에서만).
 */
const PendingPaymentCard: React.FC<Props> = ({ orderId }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data, isLoading, error } = usePaymentStatus(orderId, true);
  const resumeMutation = useResumePayment();

  // 1초마다 re-render 해서 카운트다운 갱신.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (isLoading) {
    return <div className={styles.loadingText}>결제 정보 불러오는 중...</div>;
  }
  if (error || !data) {
    return <div className={styles.errorText}>결제 정보를 불러올 수 없어요</div>;
  }

  const { text: countdownText, expired } = formatCountdown(data.expiresAt, now);

  const handleResume = () => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    resumeMutation.mutate(
      { orderId: data.orderId, clientType: isMobile ? 'M' : 'P' },
      {
        onSuccess: (ip) => {
          navigate('/checkout/redirect', {
            state: { targetUrl: ip.targetUrl, formData: ip.formData, orderCode: ip.orderCode },
            replace: false,
          });
        },
        onError: (err) => {
          showToast({ message: (err as Error).message || '결제창을 열 수 없어요', type: 'error' });
        },
      }
    );
  };

  const handleCopy = async (text: string | null | undefined, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: `${label}이(가) 복사되었어요`, type: 'success' });
    } catch {
      showToast({ message: '복사에 실패했어요', type: 'error' });
    }
  };

  // AMOUNT_MISMATCH 는 별도 안내만 (결제창 재시도 의미 없음 — Ops 처리 대기)
  if (data.uiStatus === 'AMOUNT_MISMATCH') {
    return (
      <div className={styles.card}>
        <div className={styles.heading}>
          <span className={styles.headingDot} aria-hidden="true" />
          {headingText(data.uiStatus)}
        </div>
        <div className={styles.amountMismatch}>
          입금액이 주문 금액과 달라 자동 처리가 중단되었어요. 고객센터에 문의하시면
          환불 또는 차액 처리를 도와드립니다.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <span className={styles.headingDot} aria-hidden="true" />
        {headingText(data.uiStatus)}
      </div>

      {/* VA 계좌 정보 (있을 때만) */}
      {data.accountNumber && (
        <>
          <div className={styles.row}>
            <span className={styles.label}>은행</span>
            <span className={styles.value}>{data.bankName || data.bankCode || '-'}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>계좌번호</span>
            <span>
              <span className={`${styles.value} ${styles.accountValue}`}>{data.accountNumber}</span>
              <button
                type="button"
                onClick={() => handleCopy(data.accountNumber, '계좌번호')}
                className={styles.copyBtn}
                aria-label="계좌번호 복사"
              >
                복사
              </button>
            </span>
          </div>
          {data.depositorName && (
            <div className={styles.row}>
              <span className={styles.label}>입금자명</span>
              <span className={styles.value}>{data.depositorName}</span>
            </div>
          )}
        </>
      )}

      <div className={styles.row}>
        <span className={styles.label}>결제 금액</span>
        <span className={styles.value}>{data.totalAmount.toLocaleString()}원</span>
      </div>

      {data.expiresAt && (
        <div className={styles.timerRow} role="timer" aria-live="polite">
          <span className={styles.label}>입금 기한</span>
          <span className={`${styles.timer} ${expired ? styles.timerExpired : ''}`}>
            {expired ? '기한 만료' : `남은 시간 ${countdownText}`}
          </span>
        </div>
      )}

      {/* 재시도 버튼 — canResume && 기한 내 */}
      {data.canResume && !expired && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.resumeBtn}
            onClick={handleResume}
            disabled={resumeMutation.isPending}
          >
            {resumeMutation.isPending ? '결제창 여는 중...' : '결제창 다시 열기'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PendingPaymentCard;
