/**
 * @file confetti-utils.ts
 * @description Confetti 관련 타입, 상수, 유틸 함수
 */

export interface ConfettiOptions {
  /** 파티클 개수 */
  particleCount?: number;
  /** 효과 지속 시간 (ms) */
  duration?: number;
  /** 색상 배열 */
  colors?: string[];
  /** 중력 가속도 */
  gravity?: number;
  /** 초기 속도 범위 */
  velocityRange?: { min: number; max: number };
  /** 스프레드 각도 (deg) */
  spread?: number;
}

export interface ConfettiProps extends ConfettiOptions {
  /** 활성화 여부 */
  active?: boolean;
  /** 완료 콜백 */
  onComplete?: () => void;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'square' | 'circle' | 'rectangle';
  opacity: number;
}

// 전역 컨트롤러 (triggerConfetti 함수용)
let globalController: { trigger: (options?: ConfettiOptions) => void } | null = null;

/**
 * 컨페티 효과를 트리거합니다
 */
export const triggerConfetti = (options?: ConfettiOptions): void => {
  if (globalController) {
    globalController.trigger(options);
  }
};

export const setGlobalController = (controller: typeof globalController) => {
  globalController = controller;
};

export const DEFAULT_COLORS = [
  '#FFD700', // Gold
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#45B7D1', // Sky blue
  '#96CEB4', // Sage
  '#FFEAA7', // Pale yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
];
