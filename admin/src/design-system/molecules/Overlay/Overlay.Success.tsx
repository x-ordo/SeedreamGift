/**
 * @file Overlay.Success
 * @description 작업 완료 축하 화면 오버레이
 */
import React, { useEffect, lazy, Suspense, memo } from 'react';
import { Check } from 'lucide-react';

// Lottie 동적 임포트 (번들 크기 최적화)
const LottiePlayer = lazy(() => import('lottie-react'));

// 체크 표시 성공 애니메이션
const successAnimation = {
  v: "5.5.7", fr: 30, ip: 0, op: 60, w: 200, h: 200, nm: "Success", ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: "Check", sr: 1,
      ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ t: 0, s: [0, 0, 100] }, { t: 20, s: [110, 110, 100] }, { t: 30, s: [100, 100, 100] }] } },
      shapes: [
        {
          ty: "gr", nm: "Path",
          it: [
            { ty: "sh", nm: "Path 1", ks: { a: 1, k: [{ t: 10, s: [{ i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-40, 0], [-40, 0], [-40, 0]], c: false }] }, { t: 30, s: [{ i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-40, 0], [-10, 30], [40, -30]], c: false }] }] } },
            { ty: "st", nm: "Stroke", c: { a: 0, k: [0.19, 0.51, 0.96, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 12 }, lc: 2, lj: 2 },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
          ]
        }
      ]
    }
  ]
};

/** CSS 체크 아이콘 (Lottie 로딩 전 fallback) */
function CheckIcon() {
  return (
    <div className="overlay-check-icon">
      <Check size={48} aria-hidden="true" />
    </div>
  );
}

export interface SuccessProps {
  /** 표시할 메시지 */
  message?: string;
  /** 보조 메시지 */
  subMessage?: string;
  /** 애니메이션 완료 후 콜백 */
  onComplete?: () => void;
  /** 자동 완료 딜레이 (ms) */
  autoCompleteDelay?: number;
}

const Success = memo(function Success({
  message = "완료되었습니다!",
  subMessage = "잠시 후 이동합니다.",
  onComplete,
  autoCompleteDelay = 2200
}: SuccessProps) {
  useEffect(() => {
    if (onComplete) {
      const timer = setTimeout(onComplete, autoCompleteDelay);
      return () => clearTimeout(timer);
    }
  }, [onComplete, autoCompleteDelay]);

  return (
    <div
      className="overlay overlay-success"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="overlay-animation overlay-animation-large" aria-hidden="true">
        <Suspense fallback={<CheckIcon />}>
          <LottiePlayer animationData={successAnimation} loop={false} />
        </Suspense>
      </div>
      <h2 className="overlay-title overlay-title-primary">{message}</h2>
      <p className="overlay-subtitle">{subMessage}</p>
    </div>
  );
});

export default Success;
