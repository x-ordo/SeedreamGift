/**
 * @file FinalCTASection.tsx
 * @description 홈페이지 하단 최종 CTA(Call-to-Action) 섹션
 * @module components/home
 */
import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, Coins } from 'lucide-react';
import { Button, FadeIn } from '../../design-system';

interface FinalCTASectionProps {
    navigate: ReturnType<typeof useNavigate>;
}

export const FinalCTASection = memo(({ navigate }: FinalCTASectionProps) => {
    return (
        <FadeIn direction="up" distance={20} threshold={0.2}>
            <section className="final-cta-section">
                {/* Background Gradient Blob */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl -z-10" style={{ background: 'rgba(255,255,255,0.06)' }} aria-hidden="true" />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 px-4"
                >
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 tracking-tight break-keep">
                        사용하지 않는 상품권이 있나요?
                    </h2>
                    <p className="text-sm sm:text-base opacity-80 mb-8 max-w-lg mx-auto leading-relaxed">
                        잠들어 있는 상품권을 현금으로 바꾸세요.<br className="hidden sm:block" />
                        최고가 매입 · 즉시 정산 · 간편한 3단계 프로세스
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
                            <Button
                                variant="point"
                                size="xl"
                                onClick={() => navigate('/trade-in')}
                                icon={<Coins size={18} aria-hidden="true" />}
                                style={{ minWidth: 180, borderRadius: 'var(--radius-full)' }}
                            >
                                판매 신청하기
                            </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
                            <Button
                                variant="ghost"
                                size="xl"
                                onClick={() => navigate('/products')}
                                icon={<ShoppingBag size={18} aria-hidden="true" />}
                                style={{ minWidth: 180, borderRadius: 'var(--radius-full)', color: 'white', borderColor: 'rgba(255,255,255,0.5)', borderWidth: '2px', background: 'rgba(255,255,255,0.1)' }}
                            >
                                구매하러 가기
                            </Button>
                        </motion.div>
                    </div>
                </motion.div>
            </section>
        </FadeIn>
    );
});

FinalCTASection.displayName = 'FinalCTASection';
