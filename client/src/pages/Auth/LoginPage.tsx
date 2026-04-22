/**
 * @file LoginPage.tsx
 * @description 일반 사용자 로그인 페이지 - 이메일/비밀번호 인증 + MFA 지원
 * @module pages/Auth
 * @route /login
 */
import '../../components/auth/Auth.css';
import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, ShieldCheck, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button, Card, TextField, Modal } from '../../design-system';
import { useAuthStore, MFARequiredError } from '../../store/useAuthStore';
import { getErrorMessage } from '../../utils/errorUtils';
import { isWebAuthnSupported, startWebAuthnRegistration, startWebAuthnAuthentication } from '../../utils/webauthn';
import { webauthnApi } from '../../api';
import Logo from '../../components/common/Logo';
import siteConfig from '../../../../site.config.json';

const PASSKEY_DISMISS_KEY = 'seedream_passkey_dismiss_until';

/* ── motion presets ────────────────────────── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] } },
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
};
const mfaTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
};

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  // MFA 상태
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [webAuthnError, setWebAuthnError] = useState<string>('');
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [passkeyRegistering, setPasskeyRegistering] = useState(false);

  const { login, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (() => {
    const state = location.state as { from?: string | Location } | null;
    if (!state?.from) return '/';
    if (typeof state.from === 'string') return state.from;
    return (state.from as { pathname: string; search?: string }).pathname + ((state.from as { search?: string }).search || '');
  })();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleLoginSuccess = async () => {
    const currentUser = useAuthStore.getState().user;

    if (currentUser?.role === 'ADMIN') {
      await logout();
      showToast({ message: '관리자 계정은 관리자 포털을 이용해주세요', type: 'warning' });
      return;
    }

    // 패스키 등록 권유: WebAuthn 지원 + 7일 내 거부 이력 없음
    if (isWebAuthnSupported()) {
      const dismissUntil = localStorage.getItem(PASSKEY_DISMISS_KEY);
      const isDismissed = dismissUntil && Date.now() < Number(dismissUntil);
      if (!isDismissed) {
        try {
          // 서버에 패스키 등록 여부 확인 (beginRegistration이 excludeCredentials를 반환하면 이미 등록됨)
          const res = await webauthnApi.registerBegin();
          const options = res.data || res;
          const hasExisting = (options.excludeCredentials?.length ?? 0) > 0;
          if (!hasExisting) {
            setShowPasskeyPrompt(true);
            return; // 모달 닫힌 후 navigate
          }
        } catch {
          // 패스키 확인 실패 — 무시하고 진행
        }
      }
    }

    navigate(from, { replace: true });
  };

  const handlePasskeyRegister = async () => {
    setPasskeyRegistering(true);
    try {
      const res = await webauthnApi.registerBegin();
      const options = res.data || res;
      const attestation = await startWebAuthnRegistration(options.publicKey || options);
      await webauthnApi.registerComplete({ name: '내 패스키', credential: attestation });
      showToast({ message: '패스키가 등록되었습니다! 다음부터 더 빠르게 로그인하세요', type: 'success' });
    } catch {
      showToast({ message: '패스키 등록을 건너뛰었습니다', type: 'info' });
    } finally {
      setPasskeyRegistering(false);
      setShowPasskeyPrompt(false);
      navigate(from, { replace: true });
    }
  };

  const handlePasskeyDismiss = () => {
    // 7일간 다시 안 물어봄
    localStorage.setItem(PASSKEY_DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setShowPasskeyPrompt(false);
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login({ email: formData.email, password: formData.password });
      await handleLoginSuccess();
    } catch (err) {
      if (err instanceof MFARequiredError) {
        setMfaToken(err.mfaToken);
        setMfaMethods(err.mfaMethods);
        setMfaCode('');
        if (err.mfaMethods.includes('webauthn')) {
          handleWebAuthnMFA(err.mfaToken);
        }
        return;
      }
      showToast({ message: getErrorMessage(err, '로그인에 실패했습니다'), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebAuthnMFA = async (token: string) => {
    setIsLoading(true);
    setWebAuthnError('');
    try {
      const beginRes = await webauthnApi.mfaBegin(token);
      const options = beginRes.data || beginRes;
      const assertion = await startWebAuthnAuthentication(options);
      const completeRes = await webauthnApi.mfaComplete(token, assertion);
      const data = completeRes.data?.data || completeRes.data;

      localStorage.setItem('seedream_client_logged_in', Date.now().toString());
      useAuthStore.setState({
        token: data.access_token,
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      handleLoginSuccess();
    } catch (err) {
      setWebAuthnError(getErrorMessage(err, '패스키 인증에 실패했습니다'));
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!formData.email.trim()) {
      showToast({ message: '이메일을 입력해주세요', type: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      const options = await webauthnApi.loginBegin(formData.email);
      const assertion = await startWebAuthnAuthentication(options);
      const res = await webauthnApi.loginComplete(assertion);
      const data = res.data;
      localStorage.setItem('seedream_client_logged_in', Date.now().toString());
      useAuthStore.setState({ token: data.access_token, user: data.user, isAuthenticated: true, isLoading: false });
      await handleLoginSuccess();
    } catch {
      showToast({ message: '등록된 패스키가 없거나 인증에 실패했습니다. 비밀번호로 로그인해주세요.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken || !mfaCode) return;
    setIsLoading(true);
    try {
      await useAuthStore.getState().loginMFA(mfaToken, mfaCode);
      await handleLoginSuccess();
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'MFA 인증에 실패했습니다'), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container flex flex-col justify-center items-center px-4 py-12 md:py-20">
      <motion.div
        className="w-full max-w-[400px]"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Header: 로고 + 타이틀 */}
        <motion.div className="flex flex-col items-center mb-10" variants={fadeUp}>
          <Link to="/" className="mb-6 hover:scale-[1.02] transition-transform">
            <Logo size={48} />
          </Link>
          <h1 className="text-2xl font-black text-base-content tracking-tight mb-2">반가워요!</h1>
          <p className="text-base-content/50 text-sm">{siteConfig.company.nameShort}에 로그인하고 안전하게 거래하세요</p>
        </motion.div>

        {/* Card: 폼 영역 */}
        <motion.div variants={scaleIn}>
          <Card className="p-8 rounded-3xl" style={{ background: 'color-mix(in oklch, var(--color-primary) 2%, white)', border: '1px solid color-mix(in oklch, var(--color-primary) 6%, var(--color-grey-100))', boxShadow: '0 1px 3px rgba(49,130,246,0.04), 0 8px 32px rgba(0,0,0,0.04)' }}>
            <AnimatePresence mode="wait">
              {from !== '/' && !mfaToken && (
                <motion.div
                  key="login-banner"
                  className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-primary/5 text-primary text-sm font-medium"
                  role="status"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <Lock size={18} aria-hidden="true" className="shrink-0" />
                  <span>로그인이 필요한 서비스입니다</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {mfaToken ? (
                /* MFA UI: WebAuthn 우선, TOTP fallback */
                mfaMethods.includes('webauthn') ? (
                  <motion.div
                    key="mfa-webauthn"
                    className="space-y-5 text-center"
                    {...mfaTransition}
                  >
                    <div className="flex items-center gap-3 p-4 mb-2 rounded-2xl bg-success/5 text-success text-sm font-medium" role="status">
                      <ShieldCheck size={18} aria-hidden="true" className="shrink-0" />
                      <span>패스키로 본인 확인 중...</span>
                    </div>

                    <div className="flex flex-col items-center gap-4 py-4">
                      <Fingerprint
                        size={56}
                        style={{ color: 'var(--color-primary)' }}
                        aria-hidden="true"
                      />
                      <p className="text-sm text-base-content/60 leading-relaxed">
                        기기의 패스키로 인증을 완료해주세요
                      </p>
                    </div>

                    {webAuthnError && (
                      <div className="space-y-3">
                        <p className="text-sm text-error font-medium" role="alert">{webAuthnError}</p>
                        <Button
                          type="button"
                          variant="secondary"
                          fullWidth
                          size="xl"
                          onClick={() => handleWebAuthnMFA(mfaToken)}
                          isLoading={isLoading}
                        >
                          다시 시도
                        </Button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => { setMfaToken(null); setMfaMethods([]); setMfaCode(''); setWebAuthnError(''); }}
                      className="w-full text-center text-sm text-base-content/40 hover:text-base-content/60 transition-colors mt-2"
                    >
                      다른 계정으로 로그인
                    </button>
                  </motion.div>
                ) : (
                  /* TOTP fallback */
                  <motion.form
                    key="mfa-totp"
                    onSubmit={handleMFASubmit}
                    className="space-y-5"
                    {...mfaTransition}
                  >
                    <div className="flex items-center gap-3 p-4 mb-2 rounded-2xl bg-success/5 text-success text-sm font-medium" role="status">
                      <ShieldCheck size={18} aria-hidden="true" className="shrink-0" />
                      <span>2단계 인증이 필요합니다</span>
                    </div>

                    <p className="text-sm text-base-content/60 leading-relaxed">
                      인증 앱(Google Authenticator 등)에 표시된 6자리 코드를 입력하세요.
                    </p>

                    <TextField
                      variant="box"
                      label="인증 코드"
                      labelOption="sustain"
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus
                      autoComplete="one-time-code"
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      size="xl"
                      isLoading={isLoading}
                      disabled={mfaCode.length !== 6}
                      className="mt-4"
                    >
                      인증하기
                    </Button>

                    <button
                      type="button"
                      onClick={() => { setMfaToken(null); setMfaMethods([]); setMfaCode(''); }}
                      className="w-full text-center text-sm text-base-content/40 hover:text-base-content/60 transition-colors mt-2"
                    >
                      다른 계정으로 로그인
                    </button>
                  </motion.form>
                )
              ) : (
                /* 일반 로그인 폼 */
                <motion.div key="login" {...mfaTransition}>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <TextField
                      variant="box"
                      label="이메일 주소"
                      labelOption="sustain"
                      name="email"
                      type="email"
                      inputMode="email"
                      placeholder="example@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      autoComplete="email"
                      spellCheck={false}
                      autoFocus
                    />

                    {isWebAuthnSupported() && (
                      <>
                        <Button
                          type="button"
                          variant="primary"
                          fullWidth
                          size="xl"
                          onClick={handlePasskeyLogin}
                          disabled={isLoading || !formData.email.trim()}
                          leftIcon={<Fingerprint size={18} />}
                        >
                          패스키로 로그인 (권장)
                        </Button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
                          <div style={{ flex: 1, height: '1px', background: 'var(--color-grey-200)' }} />
                          <span style={{ fontSize: '12px', color: 'var(--color-grey-400)' }}>또는</span>
                          <div style={{ flex: 1, height: '1px', background: 'var(--color-grey-200)' }} />
                        </div>
                      </>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-bold text-base-content/70">비밀번호</span>
                        <Link to="/forgot-password" className="text-xs text-base-content/40 hover:text-primary font-medium transition-colors">
                          비밀번호 찾기
                        </Link>
                      </div>
                      <TextField.Password
                        variant="box"
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
                      variant="primary"
                      fullWidth
                      size="xl"
                      isLoading={isLoading}
                      className="mt-4"
                    >
                      로그인
                    </Button>
                  </form>

                  <p className="text-xs text-base-content/40 text-center mt-4">
                    개인정보는 암호화되어 안전하게 보관됩니다
                  </p>

                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-grey-100" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-base-content/30 font-medium">또는</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-base-content/50 mb-4">아직 회원이 아니신가요?</p>
                    <Link
                      to="/register"
                      className="inline-flex items-center justify-center w-full h-12 rounded-2xl border border-grey-200 text-sm font-bold text-base-content hover:bg-grey-50 transition-colors"
                    >
                      회원가입 하기
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Footer link */}
        <motion.div className="mt-10 text-center" variants={fadeUp}>
          <Link to="/support" className="text-xs text-base-content/30 hover:text-base-content/60 transition-colors">
            도움이 필요하신가요? 고객센터 바로가기
          </Link>
        </motion.div>
      </motion.div>

      {/* 패스키 등록 권유 모달 */}
      <Modal
        isOpen={showPasskeyPrompt}
        onClose={handlePasskeyDismiss}
        title="패스키를 등록하시겠어요?"
        size="small"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'center', fontSize: '48px', lineHeight: 1 }}>🔐</div>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-grey-700)', lineHeight: 1.6, textAlign: 'center' }}>
            패스키를 등록하면 다음부터<br />
            <strong>비밀번호 없이 지문·Face ID만으로</strong><br />
            빠르고 안전하게 로그인할 수 있어요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <Button
              type="button"
              variant="primary"
              fullWidth
              size="lg"
              onClick={handlePasskeyRegister}
              disabled={passkeyRegistering}
              leftIcon={<Fingerprint size={18} />}
            >
              {passkeyRegistering ? '등록 중...' : '지금 등록하기'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              size="md"
              onClick={handlePasskeyDismiss}
              disabled={passkeyRegistering}
            >
              다음에 할게요
            </Button>
          </div>
          <p style={{ fontSize: 'var(--text-tiny)', color: 'var(--color-grey-400)', textAlign: 'center' }}>
            마이페이지 &gt; 설정에서 언제든 등록할 수 있어요
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default LoginPage;
