/**
 * @file Confetti/index.tsx
 * @description Canvas 기반 파티클 컨페티 효과
 * @module design-system/molecules
 *
 * 사용법:
 * import { triggerConfetti } from '@/design-system';
 *
 * // 주문 완료 시
 * triggerConfetti();
 *
 * // 옵션과 함께
 * triggerConfetti({ particleCount: 100, duration: 4000 });
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  type ConfettiOptions,
  type ConfettiProps,
  type Particle,
  DEFAULT_COLORS,
  setGlobalController,
} from './confetti-utils';

// triggerConfetti and types are exported from confetti-utils.ts (separate file for fast refresh)

/**
 * Confetti - Canvas 기반 컨페티 효과
 * 주문 완료 등 축하 이벤트에 사용
 */
export const Confetti: React.FC<ConfettiProps> = ({
  active = false,
  particleCount = 80,
  duration = 3000,
  colors = DEFAULT_COLORS,
  gravity = 0.3,
  velocityRange = { min: 8, max: 15 },
  spread = 70,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const animateFnRef = useRef<(timestamp: number) => void>();
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const createParticles = useCallback(
    (options?: ConfettiOptions) => {
      const count = options?.particleCount ?? particleCount;
      const colorArray = options?.colors ?? colors;
      const velocity = options?.velocityRange ?? velocityRange;
      const spreadAngle = options?.spread ?? spread;

      const particles: Particle[] = [];
      const centerX = window.innerWidth / 2;
      const startY = window.innerHeight * 0.4;

      for (let i = 0; i < count; i++) {
        const angle =
          (Math.PI / 2) + ((Math.random() - 0.5) * (spreadAngle * Math.PI)) / 180;
        const speed = velocity.min + Math.random() * (velocity.max - velocity.min);
        const shapes: Particle['shape'][] = ['square', 'circle', 'rectangle'];

        particles.push({
          x: centerX + (Math.random() - 0.5) * 100,
          y: startY,
          vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
          vy: -Math.sin(angle) * speed,
          color: colorArray[Math.floor(Math.random() * colorArray.length)],
          size: 6 + Math.random() * 6,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          opacity: 1,
        });
      }

      return particles;
    },
    [particleCount, colors, velocityRange, spread]
  );

  // Store animate in a ref to avoid self-reference in useCallback
  useEffect(() => {
    animateFnRef.current = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const elapsed = timestamp - startTimeRef.current;
      const effectDuration = duration;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((particle) => {
        particle.vy += gravity;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.rotationSpeed;

        if (elapsed > effectDuration * 0.67) {
          particle.opacity = Math.max(
            0,
            1 - (elapsed - effectDuration * 0.67) / (effectDuration * 0.33)
          );
        }

        if (
          particle.y > canvas.height + 50 ||
          particle.x < -50 ||
          particle.x > canvas.width + 50 ||
          particle.opacity <= 0
        ) {
          return false;
        }

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate((particle.rotation * Math.PI) / 180);
        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = particle.color;

        switch (particle.shape) {
          case 'square':
            ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            break;
          case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'rectangle':
            ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
            break;
        }

        ctx.restore();
        return true;
      });

      if (elapsed < effectDuration && particlesRef.current.length > 0) {
        animationRef.current = requestAnimationFrame((t) => animateFnRef.current?.(t));
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onComplete?.();
      }
    };
  }, [duration, gravity, onComplete]);

  const trigger = useCallback(
    (options?: ConfettiOptions) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      particlesRef.current = createParticles(options);
      startTimeRef.current = performance.now();

      animationRef.current = requestAnimationFrame((t) => animateFnRef.current?.(t));
    },
    [createParticles]
  );

  // Register global controller
  useEffect(() => {
    setGlobalController({ trigger });
    return () => {
      setGlobalController(null);
    };
  }, [trigger]);

  // Trigger on active prop change
  useEffect(() => {
    if (active) {
      trigger();
    }
  }, [active, trigger]);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 13000, /* --z-toast */
      }}
      aria-hidden="true"
    />
  );
};

export default Confetti;
