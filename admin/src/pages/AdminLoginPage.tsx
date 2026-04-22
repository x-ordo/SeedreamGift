/**
 * 관리자 전용 로그인 페이지 (admin.seedreamgift.com/login)
 */
import React, { useState, useCallback } from 'react';
import siteConfig from '../../../site.config.json';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { ShieldCheck, Fingerprint } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAuthStore, MFARequiredError } from '../store/useAuthStore';
import { isWebAuthnSupported, startWebAuthnAuthentication } from '../utils/webauthn';
import { webauthnApi } from '../api';

const MAIN_SITE = import.meta.env.VITE_MAIN_URL || 'https://seedreamgift.com';

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role !== 'ADMIN') {
        await logout();
        setError('접근 권한이 없습니다. (관리자 전용)');
        return;
      }
      navigate('/');
    } catch (err) {
      if (err instanceof MFARequiredError) {
        setMfaToken(err.mfaToken);
        setMfaCode('');
        setLoading(false);
        return;
      }
      const axiosErr = err as AxiosError<{ error?: string }>;
      setError(axiosErr.response?.data?.error || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [email, password, login, logout, navigate]);

  const handleMfaSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await useAuthStore.getState().loginMFA(mfaToken, mfaCode);
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role !== 'ADMIN') {
        await logout();
        setError('접근 권한이 없습니다. (관리자 전용)');
        return;
      }
      navigate('/');
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      setError(axiosErr.response?.data?.error || 'OTP 코드가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  }, [mfaToken, mfaCode, logout, navigate]);

  const handleWebAuthnLogin = useCallback(async () => {
    if (!email) {
      setError('이메일을 먼저 입력해주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const options = await webauthnApi.loginBegin(email);
      const assertion = await startWebAuthnAuthentication(options);
      const response = await webauthnApi.loginComplete(assertion);
      const { access_token, user } = response.data;
      localStorage.setItem('wgift_admin_logged_in', Date.now().toString());
      useAuthStore.setState({ token: access_token, user, isAuthenticated: true, isLoading: false });
      if (user?.role !== 'ADMIN') {
        await logout();
        setError('접근 권한이 없습니다. (관리자 전용)');
        return;
      }
      navigate('/');
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      setError(axiosErr.response?.data?.error || '패스키 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [email, logout, navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f5f6f8', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', background: '#fff',
        borderRadius: '12px', borderTop: '4px solid #4e5968',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '32px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            backgroundColor: '#f2f4f6', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <ShieldCheck size={28} style={{ color: '#4e5968' }} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#191f28', margin: 0 }}>
            관리자 포털
          </h1>
          <p style={{ fontSize: '14px', color: '#8b95a1', marginTop: '4px' }}>
            {siteConfig.company.nameShort} Admin Console
          </p>
        </div>

        {error && (
          <div role="alert" style={{
            padding: '12px 16px', backgroundColor: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: '8px',
            color: '#dc2626', fontSize: '14px', marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {mfaToken ? (
          <form onSubmit={handleMfaSubmit}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#3182f6', fontWeight: 600, marginBottom: '4px' }}>
                2단계 인증이 필요합니다
              </div>
              <p style={{ fontSize: '13px', color: '#8b95a1' }}>
                Google Authenticator 앱의 6자리 코드를 입력하세요
              </p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="000000"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{
                  width: '100%', padding: '14px', fontSize: '24px', fontWeight: 700,
                  textAlign: 'center', letterSpacing: '8px',
                  border: '2px solid #3182f6', borderRadius: '10px',
                  boxSizing: 'border-box', fontFamily: 'var(--font-family-mono, monospace)',
                }}
              />
            </div>
            <button
              type="submit" disabled={loading || mfaCode.length !== 6}
              style={{
                width: '100%', padding: '12px', fontSize: '15px', fontWeight: 600,
                color: '#fff', backgroundColor: (loading || mfaCode.length !== 6) ? '#8b95a1' : '#3182f6',
                border: 'none', borderRadius: '10px',
                cursor: (loading || mfaCode.length !== 6) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '인증 중...' : '인증하기'}
            </button>
            <button
              type="button"
              onClick={() => { setMfaToken(''); setMfaCode(''); setError(''); }}
              style={{
                width: '100%', padding: '10px', fontSize: '13px', fontWeight: 500,
                color: '#8b95a1', backgroundColor: 'transparent',
                border: 'none', cursor: 'pointer', marginTop: '12px',
              }}
            >
              다른 계정으로 로그인
            </button>
          </form>
        ) : (
          <>
            {/* Email input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#4e5968', marginBottom: '6px' }}>
                이메일 주소
              </label>
              <input
                type="email" name="email" required autoComplete="email"
                placeholder="admin@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', fontSize: '15px',
                  border: '1px solid #d1d6db', borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Passkey login (recommended) */}
            {isWebAuthnSupported() && (
              <>
                <button
                  type="button"
                  onClick={handleWebAuthnLogin}
                  disabled={loading || !email}
                  style={{
                    width: '100%', padding: '12px', fontSize: '15px', fontWeight: 600,
                    color: '#fff', backgroundColor: (loading || !email) ? '#8b95a1' : '#3182f6',
                    border: 'none', borderRadius: '10px',
                    cursor: (loading || !email) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <Fingerprint size={18} />
                  패스키로 로그인 (권장)
                </button>
                <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 16px', gap: '12px' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e8eb' }} />
                  <span style={{ fontSize: '12px', color: '#8b95a1', fontWeight: 500 }}>또는</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e8eb' }} />
                </div>
              </>
            )}

            {/* Password login */}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#4e5968', marginBottom: '6px' }}>
                  비밀번호
                </label>
                <input
                  type="password" name="password" required autoComplete="current-password"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: '15px',
                    border: '1px solid #d1d6db', borderRadius: '8px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '12px', fontSize: '15px', fontWeight: 600,
                  color: '#fff', backgroundColor: loading ? '#8b95a1' : '#3182f6',
                  border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          </>
        )}
      </div>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <a
          href={MAIN_SITE}
          style={{ fontSize: '13px', color: '#8b95a1', textDecoration: 'none' }}
        >
          ← 사용자 사이트로 이동
        </a>
      </div>
    </div>
  );
};

export default AdminLoginPage;
