/**
 * @file RegisterPage.tsx
 * @description 회원가입 페이지 - 2단계 플로우
 * @module pages/Auth
 * @route /register
 *
 * Step 1: 이메일 → 비밀번호 → 주소 → PASS 본인인증 → 이름/전화번호(readonly) → 약관
 * Step 2: 계좌 인증 (1원) → 회원가입 완료
 */
import '../../components/auth/Auth.css';
import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Fingerprint } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { parseLegalText } from '../../utils/parseLegalText';
import { Button, Card, Modal, TextField, StepIndicator, Checkbox } from '../../design-system';
import Logo from '../../components/common/Logo';
import BankVerification, { type BankVerifiedData } from '../../components/auth/BankVerification';
import KycVerification, { type KycVerifiedData } from '../../components/auth/KycVerification';
import PasswordStrengthMeter from '../../components/auth/PasswordStrengthMeter';
import AddressSearch from '../../components/auth/AddressSearch';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '../../constants/legal';
import { startWebAuthnRegistration } from '../../utils/webauthn';
import { webauthnApi } from '../../api';

/** 회원가입 단계 */
const REGISTER_STEPS = [
  { id: 1, label: '정보입력' },
  { id: 2, label: '계좌인증' },
];

const RegisterPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    zipCode: '',
    address: '',
    addressDetail: '',
    verificationId: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isPassVerified, setIsPassVerified] = useState(false);
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [passkeyRegistering, setPasskeyRegistering] = useState(false);

  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
  });
  const [modalContent, setModalContent] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    type: 'terms' | 'privacy' | null;
  }>({
    isOpen: false,
    title: '',
    content: '',
    type: null,
  });

  const { register, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  /** 전화번호 입력 시 자동 하이픈 포맷팅 */
  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setFormData(prev => ({ ...prev, phone: formatted }));
  }, []);

  const openLegalModal = useCallback((type: 'terms' | 'privacy') => {
    setModalContent({
      isOpen: true,
      title: type === 'terms' ? '이용약관' : '개인정보처리방침',
      content: type === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY,
      type,
    });
  }, []);

  const closeModal = useCallback((agree: boolean = false) => {
    if (agree && modalContent.type) {
      setAgreements(prev => ({ ...prev, [modalContent.type!]: true }));
    }
    setModalContent({ isOpen: false, title: '', content: '', type: null });
  }, [modalContent.type]);

  const handleAgreementChange = useCallback((type: 'terms' | 'privacy', checked: boolean) => {
    setAgreements(prev => ({ ...prev, [type]: checked }));
  }, []);

  /** PASS 본인인증 완료 콜백 */
  const handlePassVerified = useCallback((data: KycVerifiedData) => {
    setFormData(prev => ({
      ...prev,
      name: data.name,
      phone: data.phone,
    }));
    setIsPassVerified(true);
  }, []);

  /** Step 1 → Step 2 이동 */
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.name || !formData.phone || !formData.zipCode || !formData.address || !formData.addressDetail) {
      showToast({ message: '모든 필수 항목을 입력해주세요', type: 'error' });
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
      showToast({ message: '올바른 이메일 형식이 아닙니다', type: 'error' });
      return;
    }

    if (!/^[가-힣a-zA-Z\s]{2,}$/.test(formData.name)) {
      showToast({ message: '이름은 한글 또는 영문 2자 이상이어야 합니다', type: 'error' });
      return;
    }

    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(formData.phone)) {
      showToast({ message: '올바른 전화번호 형식이 아닙니다', type: 'error' });
      return;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      showToast({ message: '비밀번호는 8자 이상, 영문·숫자·특수문자를 포함해야 합니다', type: 'error' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showToast({ message: '비밀번호가 일치하지 않습니다', type: 'error' });
      return;
    }

    if (!isPassVerified) {
      showToast({ message: '본인 인증을 완료해주세요', type: 'error' });
      return;
    }

    if (!agreements.terms || !agreements.privacy) {
      showToast({ message: '필수 약관에 동의해주세요', type: 'error' });
      return;
    }

    setCurrentStep(2);
  };

  /** 계좌 인증 완료 → 회원가입 API 호출 */
  const handleBankVerified = async (bankData: BankVerifiedData) => {
    setIsLoading(true);
    try {
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
        bankName: bankData.bankName,
        bankCode: bankData.bankCode,
        accountNumber: bankData.accountNumber,
        accountHolder: bankData.accountHolder,
      });
      // 자동 로그인
      try {
        await login({ email: formData.email, password: formData.password });
        showToast({ message: '회원가입이 완료되었습니다! 환영합니다', type: 'success' });
        setShowPasskeyPrompt(true);
      } catch {
        showToast({ message: '회원가입 완료! 로그인해주세요', type: 'success' });
        navigate('/login');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다';
      showToast({ message: errMsg, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setPasskeyRegistering(true);
    try {
      const optionsRes = await webauthnApi.registerBegin();
      const options = optionsRes.data || optionsRes;
      const attestation = await startWebAuthnRegistration(options);
      await webauthnApi.registerComplete({ name: '내 패스키', credential: attestation });
      showToast({ message: '패스키가 등록되었습니다!', type: 'success' });
      navigate('/');
    } catch {
      showToast({ message: '패스키 등록을 건너뛰었습니다', type: 'info' });
      navigate('/');
    } finally {
      setPasskeyRegistering(false);
    }
  };

  if (showPasskeyPrompt) {
    return (
      <div className="page-container flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <Card className="p-8 rounded-3xl" style={{ textAlign: 'center', background: 'color-mix(in oklch, var(--color-primary) 2%, white)', border: '1px solid color-mix(in oklch, var(--color-primary) 6%, var(--color-grey-100))', boxShadow: '0 1px 3px rgba(49,130,246,0.04), 0 8px 32px rgba(0,0,0,0.04)' }}>
            <Fingerprint size={48} style={{ color: 'var(--color-primary)', margin: '0 auto 16px' }} aria-hidden="true" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>패스키를 등록하시겠어요?</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-grey-500)', marginBottom: '24px', lineHeight: 1.6 }}>
              패스키를 등록하면 로그인 시 비밀번호 외에<br />추가 인증이 적용되어 더 안전합니다.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button variant="secondary" type="button" onClick={() => navigate('/')}>나중에</Button>
              <Button variant="primary" type="button" onClick={handleRegisterPasskey} isLoading={passkeyRegistering}>
                등록하기
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container flex flex-col items-center">
      <div className="w-full max-w-[520px]">
        <div className="flex flex-col items-center mb-8 text-center">
          <Link to="/" className="mb-4 hover:scale-[1.02] transition-transform">
            <Logo size={40} />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-base-content tracking-tight mb-1">회원가입</h1>
          <p className="text-base-content/50 text-xs sm:text-sm">안전한 상품권 거래를 위한 정보를 입력해주세요</p>
        </div>

        <Card className="p-5 sm:p-8 rounded-2xl" style={{ background: 'color-mix(in oklch, var(--color-primary) 2%, white)', border: '1px solid color-mix(in oklch, var(--color-primary) 6%, var(--color-grey-100))', boxShadow: '0 1px 3px rgba(49,130,246,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
          <div className="mb-6 sm:mb-8">
            <StepIndicator steps={REGISTER_STEPS} currentStep={currentStep} />
          </div>

          {/* Step 1: 기본 정보 + 본인 인증 */}
          {currentStep === 1 && (
            <form onSubmit={handleNextStep} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-6">
                {/* Section A: 계정 정보 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-base-content/80 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    로그인 정보
                  </h3>
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
                    aria-required="true"
                    autoComplete="email"
                    spellCheck={false}
                    autoFocus
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <TextField.Password
                        variant="box"
                        label="비밀번호"
                        labelOption="sustain"
                        name="password"
                        placeholder="8자 이상 + 특수문자"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        aria-required="true"
                        autoComplete="new-password"
                      />
                      <PasswordStrengthMeter password={formData.password} />
                    </div>
                    <TextField.Password
                      variant="box"
                      label="비밀번호 확인"
                      labelOption="sustain"
                      name="confirmPassword"
                      placeholder="한 번 더 입력"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      aria-invalid={!!formData.confirmPassword && formData.password !== formData.confirmPassword}
                      aria-describedby={!!formData.confirmPassword && formData.password !== formData.confirmPassword ? 'confirmPassword-error' : undefined}
                      autoComplete="new-password"
                      hasError={!!formData.confirmPassword && formData.password !== formData.confirmPassword}
                      help={formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? '비밀번호가 일치하지 않습니다'
                        : undefined}
                      helpId="confirmPassword-error"
                    />
                  </div>
                </div>

                {/* Section B: 개인 정보 & 주소 */}
                <div className="space-y-4 pt-6 border-t border-primary/8">
                  <h3 className="text-sm font-bold text-base-content/80 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    본인 확인 및 배송지
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField
                      variant="box"
                      label="이름"
                      labelOption="sustain"
                      name="name"
                      placeholder="실명 입력"
                      value={formData.name}
                      onChange={isPassVerified ? undefined : handleChange}
                      readOnly={isPassVerified}
                      required
                      aria-required="true"
                      aria-invalid={!!formData.name && !/^[가-힣a-zA-Z\s]{2,}$/.test(formData.name)}
                      aria-describedby={!!formData.name && !/^[가-힣a-zA-Z\s]{2,}$/.test(formData.name) ? 'name-error' : undefined}
                      autoComplete="name"
                      hasError={!!formData.name && !/^[가-힣a-zA-Z\s]{2,}$/.test(formData.name)}
                      helpId="name-error"
                      style={isPassVerified ? { backgroundColor: 'var(--color-grey-100)' } : undefined}
                    />
                    <TextField
                      variant="box"
                      label="전화번호"
                      labelOption="sustain"
                      name="phone"
                      type="tel"
                      placeholder="010-0000-0000"
                      value={formData.phone}
                      onChange={isPassVerified ? undefined : handlePhoneChange}
                      readOnly={isPassVerified}
                      required
                      aria-required="true"
                      aria-invalid={!!formData.phone && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(formData.phone)}
                      aria-describedby={!!formData.phone && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(formData.phone) ? 'phone-error' : undefined}
                      autoComplete="tel"
                      inputMode="tel"
                      hasError={!!formData.phone && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(formData.phone)}
                      helpId="phone-error"
                      style={isPassVerified ? { backgroundColor: 'var(--color-grey-100)' } : undefined}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <AddressSearch
                      zipCode={formData.zipCode}
                      address={formData.address}
                      addressDetail={formData.addressDetail}
                      onAddressChange={(data) =>
                        setFormData(prev => ({ ...prev, ...data }))
                      }
                    />
                  </div>

                  <div className="p-5 rounded-2xl mt-4" style={{ background: 'color-mix(in oklch, var(--color-primary) 4%, var(--color-grey-50))', border: '1px solid color-mix(in oklch, var(--color-primary) 10%, var(--color-grey-200))' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck size={18} className={isPassVerified ? 'text-success' : 'text-base-content/30'} aria-hidden="true" />
                      <span className="text-sm font-bold text-base-content">PASS 본인 인증</span>
                      {isPassVerified && (
                        <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-md font-bold ml-1">인증완료</span>
                      )}
                    </div>
                    <p className="text-xs text-base-content/50 mb-4 leading-relaxed">
                      PASS 앱으로 실명 인증을 완료해주세요.<br />인증된 정보로 성함과 연락처가 자동 저장됩니다.
                    </p>
                    <KycVerification onVerified={handlePassVerified} />
                  </div>
                </div>

                {/* Section E: 약관 동의 */}
                <div className="space-y-4 pt-6 border-t border-primary/8">
                  <h3 className="text-sm font-bold text-base-content/80 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    약관 동의
                  </h3>
                  <div className="p-5 rounded-2xl space-y-3" style={{ background: 'color-mix(in oklch, var(--color-primary) 3%, var(--color-grey-50))', border: '1px solid color-mix(in oklch, var(--color-primary) 6%, var(--color-grey-100))' }}>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <Checkbox
                          checked={agreements.terms}
                          onChange={(checked) => handleAgreementChange('terms', checked)}
                        />
                        <span className="text-sm text-base-content">
                          <span className="text-primary font-bold mr-1">필수</span>
                          이용약관 동의
                        </span>
                      </label>
                      <button type="button" onClick={() => openLegalModal('terms')} className="text-xs text-base-content/40 hover:underline">보기</button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <Checkbox
                          checked={agreements.privacy}
                          onChange={(checked) => handleAgreementChange('privacy', checked)}
                        />
                        <span className="text-sm text-base-content">
                          <span className="text-primary font-bold mr-1">필수</span>
                          개인정보처리방침 동의
                        </span>
                      </label>
                      <button type="button" onClick={() => openLegalModal('privacy')} className="text-xs text-base-content/40 hover:underline">보기</button>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-4">
                  <div className="flex items-center justify-center gap-3 mb-4 text-xs font-semibold text-base-content/40">
                    <span className={formData.email && formData.password ? 'text-primary' : ''}>정보입력</span>
                    <span className="text-base-content/15">—</span>
                    <span className={isPassVerified ? 'text-primary' : ''}>본인인증</span>
                    <span className="text-base-content/15">—</span>
                    <span className={agreements.terms && agreements.privacy ? 'text-primary' : ''}>약관동의</span>
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    size="lg"
                  >
                    다음 단계로
                  </Button>
                  <p className="text-xs text-base-content/40 text-center mt-3">
                    다음 단계에서 본인 계좌를 인증합니다
                  </p>
                </div>
              </div>
            </form>
          )}

          {/* Step 2: 계좌 인증 */}
          {currentStep === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-6 sm:mb-8 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck size={28} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-base-content tracking-tight mb-1">실계좌 본인인증</h2>
                <p className="text-xs sm:text-sm text-base-content/50">본인 명의의 입금 계좌를 인증해주세요</p>
              </div>

              <div className="p-5 rounded-2xl bg-base-200/30 border border-base-200 mb-8">
                <p className="text-sm font-bold text-base-content mb-1 text-center">1원 송금 인증</p>
                <p className="text-xs text-base-content/50 text-center leading-relaxed">
                  입력하신 계좌로 1원을 보내드립니다.<br />입금자명에 표시된 인증번호 3자리를 입력하세요.
                </p>
              </div>

              <BankVerification onVerified={handleBankVerified} isLoading={isLoading} initialAccountHolder={formData.name} />

              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="mt-6 flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-base-content/40 hover:text-base-content/60 transition-colors"
              >
                <ArrowLeft size={14} />
                이전 단계로
              </button>
            </div>
          )}
        </Card>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-base-content/40 hover:text-primary transition-colors">
            이미 계정이 있으신가요? <span className="font-bold">로그인하기</span>
          </Link>
        </div>
      </div>

      {/* 약관 모달 */}
      <Modal
        isOpen={modalContent.isOpen}
        onClose={() => closeModal(false)}
        title={modalContent.title}
        size="lg"
        actions={[
          <Button key="disagree" variant="secondary" onClick={() => closeModal(false)}>닫기</Button>,
          <Button key="agree" variant="primary" onClick={() => closeModal(true)}>동의합니다</Button>,
        ]}
      >
        <div className="legal-content p-4 bg-grey-50 rounded-2xl max-h-[50vh] overflow-y-auto">
          {parseLegalText(modalContent.content)}
        </div>
      </Modal>
    </div>
  );
};

export default RegisterPage;
