/**
 * @file FloatingParticles.tsx
 * @description 배경에 떠다니는 파티클 효과를 렌더링하는 순수 장식 컴포넌트
 * @module components/home
 *
 * 사용처:
 * - HomePage: 히어로 섹션 배경에 시각적 생동감을 부여
 *
 * 특징:
 * - useMemo로 파티클 데이터를 초기 렌더링 시 한 번만 생성 (리렌더 방지)
 * - Framer Motion infinite loop으로 GPU 가속 애니메이션 수행
 * - aria-hidden="true"로 스크린 리더에서 제외
 * - prefers-reduced-motion 지원 (CSS 레벨)
 */
import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import './FloatingParticles.css';
import { PARTICLE_COLORS } from '../../constants';

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
    opacity: number;
    color: string;
}

export interface FloatingParticlesProps {
    /** 파티클 수 (기본: 20) */
    count?: number;
    /** 파티클 색상 배열 */
    colors?: string[];
    /** 최소 크기 (기본: 4) */
    minSize?: number;
    /** 최대 크기 (기본: 12) */
    maxSize?: number;
    /** 최소 애니메이션 시간 (기본: 15) */
    minDuration?: number;
    /** 최대 애니메이션 시간 (기본: 30) */
    maxDuration?: number;
}

export const FloatingParticles: React.FC<FloatingParticlesProps> = ({
    count = 20,
    colors = [...PARTICLE_COLORS],
    minSize = 4,
    maxSize = 12,
    minDuration = 15,
    maxDuration = 30,
}) => {
    const prefersReducedMotion = useReducedMotion();

    const particles = useMemo<Particle[]>(() => {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: minSize + Math.random() * (maxSize - minSize),
            duration: minDuration + Math.random() * (maxDuration - minDuration),
            delay: Math.random() * 5,
            opacity: 0.1 + Math.random() * 0.3,
            color: colors[Math.floor(Math.random() * colors.length)],
        }));
    }, [count, colors, minSize, maxSize, minDuration, maxDuration]);

    // Skip rendering entirely when user prefers reduced motion (purely decorative)
    if (prefersReducedMotion) return null;

    return (
        <div className="floating-particles" aria-hidden="true">
            {particles.map((particle) => (
                <motion.div
                    key={particle.id}
                    className="particle"
                    style={{
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        width: particle.size,
                        height: particle.size,
                        backgroundColor: particle.color,
                        opacity: particle.opacity,
                    }}
                    animate={{
                        y: [0, -30, 0, 20, 0],
                        x: [0, 15, -10, 5, 0],
                        scale: [1, 1.2, 0.9, 1.1, 1],
                    }}
                    transition={{
                        duration: particle.duration,
                        delay: particle.delay,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
};

export default FloatingParticles;
