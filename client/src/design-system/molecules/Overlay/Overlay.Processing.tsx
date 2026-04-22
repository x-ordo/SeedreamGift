/**
 * @file Overlay.Processing
 * @description 비동기 작업 진행 중 오버레이
 */
import React, { lazy, Suspense, memo } from 'react';

// Lottie 동적 임포트 (번들 크기 최적화)
const LottiePlayer = lazy(() => import('lottie-react'));

// 점이 움직이는 로딩 애니메이션
const dotLoadingAnimation = {
  v: "5.5.7", fr: 30, ip: 0, op: 60, w: 100, h: 100, nm: "Dots", ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: "Dot 1", sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [30, 50, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ t: 0, s: [100, 100, 100] }, { t: 20, s: [150, 150, 100] }, { t: 40, s: [100, 100, 100] }] } },
      shapes: [{ ty: "el", nm: "Circle", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [15, 15] } }, { ty: "fl", nm: "Fill", c: { a: 0, k: [0.19, 0.51, 0.96, 1] }, o: { a: 0, k: 100 } }]
    },
    {
      ddd: 0, ind: 2, ty: 4, nm: "Dot 2", sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [50, 50, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ t: 10, s: [100, 100, 100] }, { t: 30, s: [150, 150, 100] }, { t: 50, s: [100, 100, 100] }] } },
      shapes: [{ ty: "el", nm: "Circle", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [15, 15] } }, { ty: "fl", nm: "Fill", c: { a: 0, k: [0.19, 0.51, 0.96, 1] }, o: { a: 0, k: 100 } }]
    },
    {
      ddd: 0, ind: 3, ty: 4, nm: "Dot 3", sr: 1, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [70, 50, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 1, k: [{ t: 20, s: [100, 100, 100] }, { t: 40, s: [150, 150, 100] }, { t: 60, s: [100, 100, 100] }] } },
      shapes: [{ ty: "el", nm: "Circle", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [15, 15] } }, { ty: "fl", nm: "Fill", c: { a: 0, k: [0.19, 0.51, 0.96, 1] }, o: { a: 0, k: 100 } }]
    }
  ]
};

/** CSS 스피너 (Lottie 로딩 전 fallback) */
function DotSpinner() {
  return (
    <div className="overlay-dots">
      {[0, 1, 2].map(i => (
        <div key={i} className="overlay-dot" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

export interface ProcessingProps {
  /** 메인 메시지 */
  message?: string;
  /** 보조 메시지 */
  subMessage?: string;
}

const Processing = memo(function Processing({
  message = "처리 중입니다",
  subMessage = "창을 닫지 말고 잠시만 기다려 주세요."
}: ProcessingProps) {
  return (
    <div
      className="overlay overlay-processing"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="overlay-animation" aria-hidden="true">
        <Suspense fallback={<DotSpinner />}>
          <LottiePlayer animationData={dotLoadingAnimation} loop={true} />
        </Suspense>
      </div>
      <h4 className="overlay-title">{message}</h4>
      <p className="overlay-subtitle">{subMessage}</p>
    </div>
  );
});

export default Processing;
