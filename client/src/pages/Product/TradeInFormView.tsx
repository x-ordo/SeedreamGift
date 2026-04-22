/**
 * @file TradeInFormView.tsx
 * @description 상품권 매입(판매) 신청 폼 - 배송 기반 3단계 위자드 UI
 * @module pages/Product
 * @route /trade-in?brand=XXX (ProductListPage 내부 뷰)
 *
 * 사용처:
 * - ProductListPage: sell 모드 + 브랜드 선택 완료 시 렌더링
 *
 * 단계별 구성:
 * - Step 1: 권종 선택 + 수량 (예상 정산액 표시)
 * - Step 2: 신청자 정보 + 입금 계좌 정보
 * - Step 3: 발송 정보 (배송 방법, 일정, 메시지)
 *
 * 주요 특징:
 * - 실물 상품권 배송 기반 운영
 * - 로그인 사용자의 이름/이메일을 자동 프리필하여 입력 부담 감소
 *
 * 주요 함수:
 * - handleNextStep(): 현재 단계 유효성 검증 후 다음 단계 이동
 * - handlePrevStep(): 이전 단계 이동 또는 브랜드 선택으로 복귀
 * - handleSubmit(): 매입 신청 API 호출 (/trade-ins POST)
 */
import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Truck, Building2, Copy } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { Card, Button, TableRow, StepIndicator, Result, Border, ListHeader, TextField, PageHeader } from '../../design-system';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { Product, Brand } from '../../types';
import { TRADEIN_FORM_STEPS, SHIPPING_METHODS } from '../../constants';
import { TRADEIN_RECEIVING_ADDRESS } from '../../constants/site';
import { formatPrice } from '../../utils';
import { getProductImage } from '../../constants/voucherTypes';

interface BankAccountInfo {
  bankName: string | null;
  bankCode: string | null;
  accountNumber: string | null;  // 마스킹된 계좌번호
  accountHolder: string | null;
  bankVerifiedAt: string | null;
}

type TradeInStep = 1 | 2 | 3;

interface TradeInFormViewProps {
  brand: string;
  brandInfo: Brand | null;
  products: Product[];
  onBack: () => void;
}

const TradeInFormView: React.FC<TradeInFormViewProps> = memo(({ brand, brandInfo, products, onBack }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated, user } = useAuth();

  const [currentStep, setCurrentStep] = useState<TradeInStep>(1);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [step1Touched, setStep1Touched] = useState(false);

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [shippingMethod, setShippingMethod] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [message, setMessage] = useState('');

  // 등록 계좌 정보 (서버가 자동 사용)
  const [bankAccount, setBankAccount] = useState<BankAccountInfo | null>(null);
  const [isBankLoading, setIsBankLoading] = useState(true);

  const steps = TRADEIN_FORM_STEPS;

  // 비로그인 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!isAuthenticated) {
      showToast({ message: '로그인 후 이용 가능해요', type: 'error' });
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate, showToast]);

  // 로그인 사용자 정보로 프리필
  useEffect(() => {
    if (user) {
      if (user.name) setSenderName(user.name);
      if (user.email) setSenderEmail(user.email);
    }
  }, [user]);

  // 등록 계좌 정보 로드
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get('/kyc/bank-account');
        if (!cancelled) setBankAccount(res.data);
      } catch {
        if (!cancelled) setBankAccount(null);
      } finally {
        if (!cancelled) setIsBankLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const selectedProduct = useMemo(() =>
    products.find(p => p.id === Number(selectedProductId)),
    [products, selectedProductId],
  );

  // 예상 정산액 = 액면가 × (1 - 매입수수료율) × 수량
  const estimatedPayout = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.price * (1 - selectedProduct.tradeInRate / 100) * quantity;
  }, [selectedProduct, quantity]);

  const handlePrevStep = useCallback(() => {
    if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 1) {
      onBack();
    }
  }, [currentStep, onBack]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await axiosInstance.post('/trade-ins', {
        productId: Number(selectedProductId),
        quantity,
        senderName: senderName || undefined,
        senderPhone: senderPhone || undefined,
        senderEmail: senderEmail || undefined,
        shippingMethod: shippingMethod || undefined,
        shippingDate: shippingDate || undefined,
        arrivalDate: arrivalDate || undefined,
        message: message || undefined,
      });

      setIsSuccess(true);
      showToast({ message: '판매 신청이 완료되었습니다', type: 'success' });
    } catch (error: unknown) {
      const errMsg = (error as any)?.response?.data?.error || (error instanceof Error ? error.message : '') || '판매 신청에 실패했습니다. 잠시 후 다시 시도해주세요';
      const isPolicy = errMsg.includes('한도') || errMsg.includes('KYC') || errMsg.includes('본인 인증') || errMsg.includes('계좌 인증');
      showToast({
        message: errMsg,
        type: 'error',
        duration: isPolicy ? 5000 : 3000,
        ...(errMsg.includes('본인 인증') || errMsg.includes('계좌 인증') ? {
          action: { label: '인증하기', onClick: () => navigate('/mypage?tab=settings') }
        } : {}),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedProductId, quantity,
    senderName, senderPhone, senderEmail, shippingMethod, shippingDate, arrivalDate, message,
    showToast,
  ]);

  const handleNextStep = useCallback(() => {
    if (currentStep === 1) {
      setStep1Touched(true);
      if (!selectedProductId) {
        // disabled button is the primary guard; this is a safety net
        return;
      }
      if (quantity < 1) {
        // disabled button is the primary guard; this is a safety net
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!bankAccount?.accountNumber) {
        showToast({ message: '등록된 계좌가 없습니다. 마이페이지에서 계좌를 먼저 등록해주세요', type: 'error' });
        return;
      }
      setCurrentStep(3);
    }
  }, [currentStep, selectedProductId, quantity, bankAccount, showToast]);

  const handleCopyAddress = useCallback(async () => {
    const addressText = `${TRADEIN_RECEIVING_ADDRESS.recipient}\n(${TRADEIN_RECEIVING_ADDRESS.zipCode}) ${TRADEIN_RECEIVING_ADDRESS.address}\n${TRADEIN_RECEIVING_ADDRESS.phone}`;
    try {
      await navigator.clipboard.writeText(addressText);
      showToast({ message: '발송 주소가 복사되었습니다', type: 'success' });
    } catch {
      showToast({ message: '복사에 실패했어요', type: 'error' });
    }
  }, [showToast]);

  const displayName = brandInfo?.name || brand;

  // KYC/계좌 미인증 시 사전 안내 배너 (서버 에러 전에 차단)
  const needsKyc = user && user.kycStatus !== 'VERIFIED';
  const needsBank = user && !bankAccount && !isBankLoading;

  if (needsKyc || needsBank) {
    return (
      <div className="page-wrapper product-list-page product-list-page--sell">
        <div className="tradein-container">
          <PageHeader title={`${displayName} 상품권 판매`} />
          <div style={{
            padding: 'var(--space-5)',
            background: 'color-mix(in oklch, var(--color-orange-600) 6%, white)',
            border: '1px solid color-mix(in oklch, var(--color-orange-600) 15%, var(--color-grey-200))',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>🔐</div>
            <h3 style={{ fontSize: 'var(--text-headline)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
              {needsKyc ? '본인 인증이 필요합니다' : '계좌 인증이 필요합니다'}
            </h3>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-grey-600)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              {needsKyc
                ? '상품권 판매를 위해 본인 인증(KYC)을 먼저 완료해주세요.'
                : '정산 계좌를 등록하고 1원 인증을 완료해주세요.'}
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/mypage?tab=settings')}
            >
              {needsKyc ? '본인 인증하기' : '계좌 등록하기'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="page-wrapper product-list-page product-list-page--sell">
        <div className="tradein-container">
          <Result
            icon="success"
            title="판매 신청 완료!"
            description={<>상품권 수령 확인 후 영업일 1~2일 내에<br />입금될 예정입니다.</>}
            animated
          />

          <Card className="tradein-result-card">
            <TableRow left="상품" right={selectedProduct?.name || '-'} withBorder />
            <TableRow left="수량" right={`${quantity}매`} withBorder />
            <TableRow
              left="예상 정산액"
              right={<span className="text-success tabular-nums">{formatPrice(estimatedPayout)}</span>}
              numeric
              withBorder
            />
            <TableRow left="입금 계좌" right={bankAccount ? `${bankAccount.bankName} ${bankAccount.accountNumber}` : '-'} withBorder />
            {shippingMethod && (
              <TableRow left="발송방법" right={shippingMethod} withBorder />
            )}
            {shippingDate && (
              <TableRow left="발송 예정일" right={shippingDate} withBorder />
            )}
            {arrivalDate && (
              <TableRow left="도착 예정일" right={arrivalDate} />
            )}
          </Card>

          {/* 정산 진행 타임라인 */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-base-content tracking-tight">정산 진행 상황</span>
            </div>
            <ol className="space-y-3 pl-1" aria-label="정산 진행 단계">
              {[
                { done: true, label: '신청 접수', sub: '완료' },
                { done: false, active: true, label: '상품권 발송', sub: '수령지로 발송해주세요' },
                { done: false, label: '수령 확인', sub: '영업일 1~2일' },
                { done: false, label: '검수 완료', sub: '' },
                { done: false, label: '계좌 입금', sub: '' },
              ].map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                    step.done
                      ? 'bg-success text-white'
                      : step.active
                        ? 'bg-primary/10 text-primary border-2 border-primary'
                        : 'bg-grey-100 text-base-content/30'
                  }`}>
                    {step.done ? '\u2713' : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${step.done ? 'text-success' : step.active ? 'text-primary' : 'text-base-content/40'}`}>
                      {step.label}
                    </span>
                    {step.sub && (
                      <p className={`text-xs mt-0.5 ${step.done ? 'text-success/60' : 'text-base-content/40'}`}>{step.sub}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="tradein-receiving-address-card">
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                  상품권 수령지
                </ListHeader.TitleParagraph>
              }
            />
            <TableRow left="수령인" right={TRADEIN_RECEIVING_ADDRESS.recipient} withBorder />
            <TableRow left="주소" right={`(${TRADEIN_RECEIVING_ADDRESS.zipCode}) ${TRADEIN_RECEIVING_ADDRESS.address}`} withBorder />
            <TableRow left="연락처" right={TRADEIN_RECEIVING_ADDRESS.phone} />
            <div style={{ padding: '12px 16px 0' }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCopyAddress}
                aria-label="발송 주소 복사하기"
              >
                <Copy size={14} aria-hidden="true" className="mr-1" />
                주소 복사
              </Button>
            </div>
            <p className="tradein-receiving-notice">
              {TRADEIN_RECEIVING_ADDRESS.notice}
            </p>
          </Card>

          <div className="tradein-action-buttons">
            <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/')}>
              홈으로
            </Button>
            <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/mypage?tab=tradeins')}>
              내역 확인
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper product-list-page product-list-page--sell">
      <div className="tradein-container">
        <PageHeader
          title={`${displayName} 상품권 판매`}
          onBack={handlePrevStep}
        />

        {/* 안내 배너 */}
        <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-base-200/50 text-base-content/60 text-xs mb-4" role="note">
          <Truck size={14} aria-hidden="true" className="shrink-0 text-primary" />
          <span>실물 상품권을 택배로 보내주시면 확인 후 계좌 입금해드립니다</span>
        </div>

        {/* Step Indicator */}
        <StepIndicator
          steps={steps.map(s => ({ id: s.step, label: s.label }))}
          currentStep={currentStep}
          ariaLabel="판매 진행 단계"
          className="tradein-step-indicator"
        />

        {/* Step 1: 권종 선택 + 수량 */}
        {currentStep === 1 && (
          <section className="tradein-step-section">
            {!isBankLoading && !bankAccount && (
              <div className="flex items-center gap-3 p-4 mb-4 rounded-2xl bg-warning/5 text-warning text-sm font-medium border border-warning/20" role="alert">
                <span>정산 계좌가 등록되지 않았습니다.</span>
                <button type="button" onClick={() => navigate('/mypage?tab=settings')} className="text-xs font-bold underline shrink-0">등록하기</button>
              </div>
            )}
            <Card className="overflow-hidden p-4 sm:p-6">
              <ListHeader
                title={
                  <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                    <span className="tradein-step-badge">1</span>
                    상품권 정보를 선택하세요
                  </ListHeader.TitleParagraph>
                }
              />

              <fieldset className="form-control w-full mb-6 border-0 p-0 m-0 min-w-0">
                <legend className="label label-text font-medium mb-1">권종 선택</legend>
                <div className="products-toss-grid">
                  {products.map(p => {
                    const isSelected = selectedProductId === p.id;
                    const payoutPerCard = Math.round(p.price * (1 - p.tradeInRate / 100));
                    const imageUrl = p.imageUrl || brandInfo?.imageUrl || getProductImage(p.brandCode, p.price);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProductId(p.id)}
                        className={`product-card-toss ${isSelected ? 'product-card-toss--selected' : ''}`}
                      >
                        {/* 수수료율 뱃지 (좌상단) */}
                        <div className="product-card-toss__discount-badge">
                          -{p.tradeInRate}%
                        </div>

                        {/* 정산액 뱃지 (우상단) */}
                        <span className="product-card-toss__savings">{formatPrice(payoutPerCard)} 정산</span>

                        {/* 이미지 */}
                        <div className="product-card-toss__image-area" style={{ cursor: 'pointer' }}>
                          <div className="product-card-toss__image-wrapper">
                            {imageUrl ? (
                              <img src={imageUrl} alt={`${brandInfo?.name || p.brandCode} ${formatPrice(p.price)}`} className="product-card-toss__image" loading="lazy" decoding="async" width={120} height={120} />
                            ) : (
                              <span className="product-card-toss__image-fallback">{p.brandCode.charAt(0)}</span>
                            )}
                          </div>
                        </div>

                        {/* 상품 정보 */}
                        <div className="product-card-toss__info">
                          <span className="product-card-toss__brand">{brandInfo?.name || p.brandCode}</span>
                          <div className="product-card-toss__price-area">
                            <span className="product-card-toss__price tabular-nums">{formatPrice(p.price)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!selectedProductId && step1Touched && (
                  <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-error)', marginTop: '8px' }} role="alert">
                    권종을 선택해주세요
                  </p>
                )}
              </fieldset>

              <fieldset className="form-control w-full border-0 p-0 m-0">
                <legend className="label label-text font-medium">수량</legend>
                <input
                  id="quantity-input"
                  name="quantity"
                  type="number"
                  className="input input-bordered rounded-field w-full"
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  inputMode="numeric"
                  aria-describedby="quantity-helper"
                  aria-invalid={step1Touched && quantity < 1 ? true : undefined}
                />
                <p id="quantity-helper" className="tradein-field-helper">
                  최소 1개, 최대 100개까지 신청 가능합니다
                </p>
              </fieldset>

              {selectedProduct && (
                <div className="tradein-payout-box">
                  <div className="tradein-payout-label">예상 정산액</div>
                  <div className="tradein-payout-amount">
                    {formatPrice(estimatedPayout)}
                  </div>
                  <div className="tradein-payout-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                    <span>액면가 {formatPrice(selectedProduct.price)} x {quantity}매</span>
                    <span>수수료 {selectedProduct.tradeInRate}% 차감 (매입율 {100 - selectedProduct.tradeInRate}%)</span>
                    <span>매당 {formatPrice(Math.round(selectedProduct.price * (1 - selectedProduct.tradeInRate / 100)))} x {quantity}매</span>
                  </div>
                  {/* 정산 안내 */}
                  <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '12px', background: 'color-mix(in oklch, var(--color-success) 5%, white)', border: '1px solid color-mix(in oklch, var(--color-success) 12%, transparent)' }}>
                    <div className="flex items-start gap-2 text-xs text-base-content/60 leading-relaxed">
                      <span className="shrink-0 mt-px" style={{ color: 'var(--color-success)' }} aria-hidden="true">&#9201;</span>
                      <div className="space-y-1">
                        <p className="font-medium text-base-content/70">정산 예상: 상품권 수령 확인 후 영업일 1~2일 이내</p>
                        <p>입금 계좌: 등록된 계좌로 자동 입금</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="tradein-cta-buttons">
                <Button variant="ghost" size="lg" className="flex-1" onClick={handlePrevStep} leftIcon={<ArrowLeft size={16} />}>
                  이전
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  disabled={!selectedProductId || quantity < 1}
                  onClick={handleNextStep}
                  rightIcon={<ArrowRight size={16} />}
                >
                  다음 단계
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* Step 2: 신청자 및 계좌 정보 */}
        {currentStep === 2 && (
          <section className="tradein-step-section">
            <Card className="p-0 overflow-hidden border-none shadow-none bg-transparent">
              <ListHeader
                title={
                  <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                    <span className="tradein-step-badge">2</span>
                    신청자 정보 및 계좌 확인
                  </ListHeader.TitleParagraph>
                }
                description={
                  <ListHeader.DescriptionParagraph>
                    정확한 입금을 위해 본인 정보를 확인해주세요
                  </ListHeader.DescriptionParagraph>
                }
              />

              <div className="space-y-4 mb-8">
                <Card className="p-6 border-grey-100 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField
                      variant="box"
                      label="이름"
                      labelOption="sustain"
                      placeholder="신청자 이름"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      autoComplete="name"
                    />
                    <TextField
                      variant="box"
                      label="핸드폰 번호"
                      labelOption="sustain"
                      placeholder="010-0000-0000"
                      value={senderPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                        let formatted = digits;
                        if (digits.length > 7) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                        else if (digits.length > 3) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                        setSenderPhone(formatted);
                      }}
                      autoComplete="tel"
                      inputMode="tel"
                    />
                  </div>
                  <div className="mt-4">
                    <TextField
                      variant="box"
                      label="이메일"
                      labelOption="sustain"
                      placeholder="example@email.com"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>
                </Card>

                {/* 등록 계좌 정보 (읽기전용) */}
                <Card className="p-6 border-grey-100 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-base-content">입금 계좌 정보</span>
                    <button 
                      type="button" 
                      onClick={() => navigate('/mypage?tab=settings')}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      정보 수정
                    </button>
                  </div>
                  
                  {isBankLoading ? (
                    <div className="skeleton h-24 w-full rounded-2xl" />
                  ) : bankAccount?.accountNumber ? (
                    <div className="p-5 rounded-2xl bg-base-200/50 border border-base-200 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <Building2 size={24} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-base-content/50 mb-0.5">{bankAccount.bankName}</div>
                        <div className="text-lg font-bold tracking-tight text-base-content tabular-nums leading-none">
                          {bankAccount.accountNumber}
                        </div>
                        <div className="text-xs text-base-content/60 mt-1">예금주: {bankAccount.accountHolder}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-error/5 border border-error/10 text-center">
                      <p className="text-sm text-error mb-4 font-medium">등록된 입금 계좌가 없습니다</p>
                      <Button variant="primary" size="md" onClick={() => navigate('/mypage?tab=settings')}>
                        계좌 등록하러 가기
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-base-content/40 mt-4 leading-relaxed">
                    * 회원가입 시 인증된 본인 계좌로만 정산이 가능합니다.<br />
                    * 계좌 변경은 마이페이지 설정에서 실명 인증과 함께 진행됩니다.
                  </p>
                </Card>
              </div>

              <div className="flex gap-3 mt-10">
                <Button 
                  variant="ghost" 
                  size="lg" 
                  className="flex-1 h-14 font-bold border border-base-300" 
                  onClick={handlePrevStep} 
                  leftIcon={<ArrowLeft size={18} />}
                >
                  이전
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-[2] h-14 font-bold shadow-primary text-lg"
                  onClick={handleNextStep}
                  disabled={!senderName || !senderPhone || !bankAccount?.accountNumber}
                  rightIcon={<ArrowRight size={18} />}
                >
                  확인 및 다음으로
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* Step 3: 발송 정보 */}
        {currentStep === 3 && (
          <section className="tradein-step-section">
            <Card>
              <ListHeader
                title={
                  <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                    <span className="tradein-step-badge">3</span>
                    발송 정보를 입력하세요
                  </ListHeader.TitleParagraph>
                }
              />

              <fieldset className="form-control w-full border-0 p-0 m-0 mb-4">
                <legend className="label label-text font-medium">발송(배송) 방법 선택</legend>
                <select
                  id="shipping-method-select"
                  name="shippingMethod"
                  className="select select-bordered rounded-field w-full"
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                >
                  <option value="">발송방법을 선택하세요</option>
                  {SHIPPING_METHODS.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </fieldset>

              <div className="form-control w-full">
                <label htmlFor="shipping-date" className="label label-text font-medium">발송 예정일</label>
                <input
                  id="shipping-date"
                  name="shippingDate"
                  type="date"
                  className="input input-bordered rounded-field w-full"
                  value={shippingDate}
                  onChange={(e) => setShippingDate(e.target.value)}
                />
              </div>

              <div className="form-control w-full">
                <label htmlFor="arrival-date" className="label label-text font-medium">도착 예정일</label>
                <input
                  id="arrival-date"
                  name="arrivalDate"
                  type="date"
                  className="input input-bordered rounded-field w-full"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                />
              </div>

              <div className="form-control w-full">
                <label htmlFor="trade-in-message" className="label label-text font-medium">전달 메시지</label>
                <textarea
                  id="trade-in-message"
                  name="message"
                  className="textarea textarea-bordered rounded-field w-full"
                  placeholder="훼손정도나 특이사항을 기재해주세요."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </div>

              <Border variant="padding24" />

              <Card className="tradein-receiving-address-card">
                <ListHeader
                  title={
                    <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                      상품권 수령지 (보내실 곳)
                    </ListHeader.TitleParagraph>
                  }
                />
                <TableRow left="수령인" right={TRADEIN_RECEIVING_ADDRESS.recipient} withBorder />
                <TableRow left="주소" right={`(${TRADEIN_RECEIVING_ADDRESS.zipCode}) ${TRADEIN_RECEIVING_ADDRESS.address}`} withBorder />
                <TableRow left="연락처" right={TRADEIN_RECEIVING_ADDRESS.phone} />
                <p className="tradein-receiving-notice">
                  {TRADEIN_RECEIVING_ADDRESS.notice}
                </p>
              </Card>

              <Border variant="padding24" />

              <Card className="tradein-summary-card">
                <ListHeader
                  title={
                    <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                      신청 요약
                    </ListHeader.TitleParagraph>
                  }
                />
                <TableRow
                  left="상품"
                  right={selectedProduct?.name || '-'}
                  emphasized
                  withBorder
                />
                <TableRow
                  left="수량"
                  right={`${quantity}매`}
                  emphasized
                  withBorder
                />
                <TableRow
                  left="예상 정산액"
                  right={<span className="text-success tabular-nums">{formatPrice(estimatedPayout)}</span>}
                  emphasized
                  numeric
                  withBorder
                />
                <TableRow
                  left="입금 계좌"
                  right={bankAccount ? `${bankAccount.bankName} ${bankAccount.accountNumber}` : '-'}
                  emphasized
                  withBorder
                />
                {shippingMethod && (
                  <TableRow
                    left="발송방법"
                    right={shippingMethod}
                    emphasized
                  />
                )}
              </Card>

              <div className="tradein-cta-buttons">
                <Button variant="ghost" size="lg" className="flex-1" onClick={handlePrevStep} leftIcon={<ArrowLeft size={16} />}>
                  이전
                </Button>
                <Button
                  variant="cta"
                  size="lg"
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? '신청 중\u2026' : '판매 신청하기'}
                </Button>
              </div>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
});

TradeInFormView.displayName = 'TradeInFormView';

export default TradeInFormView;
