/**
 * @file AdminLoginPage.tsx
 * @description 관리자 전용 로그인 페이지 - ADMIN 역할만 진입 허용
 * @module pages/Auth
 * @route /admin/login
 *
 * 사용처:
 * - AppRouter: /admin/login 경로에서 렌더링 (MainLayout 외부, 독립 레이아웃)
 * - 관리자 로그아웃 후 리다이렉트 대상
 *
 * 인증 플로우:
 * 1. 이메일/비밀번호 입력 → AuthContext.login() 호출 (source: "admin")
 * 2. 서버에서 ADMIN 역할 검증 — 비 ADMIN은 403 반환 (토큰 미발급)
 * 3. ADMIN이면 /admin 대시보드로 이동
 *
 * 레이아웃:
 * - MainLayout 없이 전체 화면 중앙 정렬
 * - 관리자 전용 시각적 구분 (회색 상단 테두리, 쉴드 아이콘)
 * - "사용자 사이트로 이동" 링크 제공
 *
 * 보안:
 * - source:"admin" 파라미터로 서버에서 ADMIN 역할 검증 후 토큰 발급
 * - 비 ADMIN 사용자는 토큰 자체를 받지 못함 (403 Forbidden)
 */
import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, TextField } from '../../design-system';
import { COLORS } from '../../constants/designTokens';
import siteConfig from '../../../../site.config.json';

const AdminLoginPage: React.FC = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login({ email: formData.email, password: formData.password, source: 'admin' });
            navigate('/admin');
        } catch (err) {
            const axiosErr = err as AxiosError<{ error?: string }>;
            setError(axiosErr.response?.data?.error || axiosErr.message || '로그인에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.bgSecondary,
                padding: '24px',
            }}
        >
            <Card
                className="p-4 shadow-sm"
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    borderTop: `4px solid ${COLORS.grey700}`,
                }}
            >
                <div className="text-center mb-4">
                    <div
                        style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: 'var(--radius-lg)',
                            backgroundColor: COLORS.grey100,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}
                    >
                        <ShieldCheck size={28} aria-hidden="true" style={{ color: COLORS.grey700 }} />
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: COLORS.grey900, margin: 0 }}>
                        관리자 포털
                    </h1>
                    <p style={{ fontSize: '14px', color: COLORS.grey500, marginTop: '4px' }}>
                        {siteConfig.company.brand} Admin Console
                    </p>
                </div>

                {error && (
                    <div
                        role="alert"
                        style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--color-red-50)',
                            border: '1px solid var(--color-red-200)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-red-600)',
                            fontSize: '14px',
                            marginBottom: '16px',
                        }}
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <TextField
                            variant="box"
                            label="이메일 주소"
                            labelOption="sustain"
                            name="email"
                            type="email"
                            placeholder="admin@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            autoComplete="email"
                            spellCheck={false}
                        />
                    </div>
                    <div className="mb-4">
                        <TextField.Password
                            variant="box"
                            label="비밀번호"
                            labelOption="sustain"
                            name="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            autoComplete="current-password"
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="cta"
                        fullWidth
                        size="lg"
                        isLoading={isLoading}
                    >
                        로그인
                    </Button>
                </form>
            </Card>

            {/* 사용자 사이트 링크 */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <Link
                    to="/"
                    style={{
                        fontSize: '13px',
                        color: COLORS.grey500,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--icon-gap-md)',
                    }}
                >
                    <ArrowLeft size={14} aria-hidden="true" />
                    사용자 사이트로 이동
                </Link>
            </div>
        </div>
    );
};

export default AdminLoginPage;
