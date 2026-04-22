/**
 * @file RateTicker.tsx
 * @description 브랜드별 할인율/매입율을 자동 순환하며 보여주는 시세 티커
 * @module components/home
 *
 * 사용처:
 * - Header: 컴팩트 모드로 헤더 우측에 시세 요약 표시
 * - HomePage: 풀 사이즈로 메인 페이지 상단에 배치
 *
 * 동작 방식:
 * - React Query로 브랜드별 시세 데이터를 캐싱하여 가져옴 (staleTime: 60초)
 * - setInterval로 currentIndex를 순환시키며 Framer Motion 슬라이드 전환
 * - hover/focus 시 자동 전환 일시정지 (접근성 준수)
 * - 인디케이터 점 클릭으로 특정 브랜드 시세 직접 선택 가능
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import axiosInstance from '../../lib/axios';
import { STALE_TIMES } from '../../constants/cache';
import './RateTicker.css';

interface RateInfo {
    brandName: string;
    brandCode: string;
    discountRate: number;
    tradeInRate?: number;
}

export interface RateTickerProps {
    /** 자동 전환 간격 (ms, 기본: 4000) */
    interval?: number;
    /** 표시 모드 */
    mode?: 'discount' | 'tradeIn' | 'both';
    /** 컴팩트 모드 (헤더용) */
    compact?: boolean;
    /** 추가 클래스 */
    className?: string;
}

export const RateTicker: React.FC<RateTickerProps> = ({
    interval = 4000,
    mode = 'both',
    compact = false,
    className = '',
}) => {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const prefersReducedMotion = useReducedMotion();

    // API에서 브랜드별 시세 데이터를 가져온다 (실패 시 하드코딩 폴백)
    const { data: rates, isLoading, error } = useQuery<RateInfo[]>({
        queryKey: ['product-rates'],
        queryFn: async () => {
            try {
                const response = await axiosInstance.get('/products/rates');
                const raw = Array.isArray(response.data) ? response.data : response.data?.items || [];
                // 브랜드별 대표 시세 (중복 제거)
                const seen = new Set<string>();
                return raw.filter((p: any) => {
                    if (seen.has(p.brandCode)) return false;
                    if (!p.brandCode || p.name?.includes('재고 없는') || p.name?.includes('품절')) return false;
                    seen.add(p.brandCode);
                    return true;
                }).map((p: any) => ({
                    brandName: p.brand?.name || p.name || p.brandCode,
                    brandCode: p.brandCode,
                    discountRate: Number(p.discountRate) || 0,
                    tradeInRate: Number(p.tradeInRate) || 0,
                }));
            } catch {
                return [];
            }
        },
        staleTime: STALE_TIMES.REALTIME,
    });

    // 일정 간격으로 다음 브랜드 시세로 자동 전환
    useEffect(() => {
        if (!rates || rates.length <= 1 || isPaused) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % rates.length);
        }, interval);

        return () => clearInterval(timer);
    }, [rates, interval, isPaused]);

    // hover/focus 시 자동 전환을 멈춰 사용자가 내용을 읽을 수 있게 한다
    const handlePause = useCallback(() => setIsPaused(true), []);
    const handleResume = useCallback(() => setIsPaused(false), []);

    if (isLoading) {
        return (
            <div className={`rate-ticker ${compact ? 'rate-ticker-compact' : ''} ${className} loading`}>
                <div className="rate-ticker-inner">
                    <span className="rate-ticker-dot pulse" />
                    <span>실시간 시세 로드 중...</span>
                </div>
            </div>
        );
    }

    if (error || !rates || rates.length === 0) return null;

    const currentRate = rates[currentIndex];

    return (
        <div
            className={`rate-ticker ${compact ? 'rate-ticker-compact' : ''} ${className}`}
            onMouseEnter={handlePause}
            onMouseLeave={handleResume}
            onFocus={handlePause}
            onBlur={handleResume}
            role="region"
            aria-label="실시간 상품권 시세"
        >
            <div className="rate-ticker-inner">
                <span className="rate-ticker-icon" aria-hidden="true">📊</span>
                
                <div className="rate-ticker-slider-container">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={currentIndex}
                            initial={prefersReducedMotion ? false : { y: '60%', opacity: 0 }}
                            animate={{ y: '0%', opacity: 1 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { y: '-60%', opacity: 0 }}
                            transition={prefersReducedMotion ? { duration: 0 } : {
                                duration: 0.3,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                            className="rate-ticker-content cursor-pointer"
                            onClick={() => navigate(`/voucher-types/${currentRate.brandCode}`)}
                            role="link"
                            aria-label={`${currentRate.brandName} 시세 상세 보기`}
                        >
                            <span className="rate-ticker-brand">{currentRate.brandName}</span>
                            {(mode === 'discount' || mode === 'both') && (
                                <span className="rate-ticker-rate rate-ticker-discount">
                                    <span className="rate-label">할인</span>
                                    <span className="rate-value">{currentRate.discountRate.toFixed(1)}%</span>
                                </span>
                            )}
                            {(mode === 'tradeIn' || mode === 'both') && (
                                <span className="rate-ticker-rate rate-ticker-tradein">
                                    <span className="rate-label">매입</span>
                                    <span className="rate-value">{currentRate.tradeInRate?.toFixed(1)}%</span>
                                </span>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="rate-ticker-indicators">
                    {rates.map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className={`rate-ticker-dot ${idx === currentIndex ? 'active' : ''}`}
                            onClick={() => setCurrentIndex(idx)}
                            aria-label={`${rates[idx].brandName} 시세 보기`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RateTicker;
