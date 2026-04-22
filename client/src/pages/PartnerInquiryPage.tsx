/**
 * @file PartnerInquiryPage.tsx
 * @description 파트너 제휴 문의 — 공개 페이지 (로그인 불필요)
 * @module pages
 * @route /partner-inquiry
 */
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button, Card } from '../design-system';
import { useToast } from '../contexts/ToastContext';
import { businessInquiryApi } from '../api';
import SEO from '../components/common/SEO';
import siteConfig from '../../../site.config.json';
import { getErrorMessage } from '../utils/errorUtils';

interface FormData {
  companyName: string;
  businessRegNo: string;
  businessOpenDate: string;
  repName: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  message: string;
}

const INITIAL_FORM: FormData = {
  companyName: '',
  businessRegNo: '',
  businessOpenDate: '',
  repName: '',
  contactName: '',
  email: '',
  phone: '',
  category: '',
  message: '',
};

const CATEGORY_OPTIONS = [
  { value: '', label: '문의 유형 선택' },
  { value: '제휴문의', label: '제휴문의' },
  { value: '입점문의', label: '입점문의' },
  { value: '대량구매', label: '대량구매' },
  { value: '기타', label: '기타' },
];

const PartnerInquiryPage: React.FC = () => {
  const { showToast } = useToast();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 7) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    else if (digits.length > 3) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    setForm(prev => ({ ...prev, phone: formatted }));
    setErrors(prev => ({ ...prev, phone: undefined }));
  }, []);

  const handleBusinessRegNoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm(prev => ({ ...prev, businessRegNo: digits }));
    setErrors(prev => ({ ...prev, businessRegNo: undefined }));
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!form.companyName.trim()) newErrors.companyName = '회사명을 입력해주세요';
    if (!form.businessRegNo.trim()) {
      newErrors.businessRegNo = '사업자등록번호를 입력해주세요';
    } else if (!/^\d{10}$/.test(form.businessRegNo)) {
      newErrors.businessRegNo = '숫자 10자리를 입력해주세요';
    }
    if (!form.businessOpenDate) newErrors.businessOpenDate = '개업일자를 선택해주세요';
    if (!form.repName.trim()) newErrors.repName = '대표자성명을 입력해주세요';
    if (!form.contactName.trim()) newErrors.contactName = '담당자명을 입력해주세요';
    if (!form.email.trim()) {
      newErrors.email = '이메일을 입력해주세요';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다';
    }
    if (!form.phone.trim()) newErrors.phone = '연락처를 입력해주세요';
    if (!form.category) newErrors.category = '문의 유형을 선택해주세요';
    if (!form.message.trim()) {
      newErrors.message = '문의 내용을 입력해주세요';
    } else if (form.message.trim().length < 10) {
      newErrors.message = '문의 내용은 최소 10자 이상 입력해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await businessInquiryApi.submit({
        companyName: form.companyName.trim(),
        businessRegNo: form.businessRegNo.trim(),
        businessOpenDate: form.businessOpenDate.replace(/-/g, ''),
        repName: form.repName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        category: form.category,
        message: form.message.trim(),
      });
      setIsSubmitted(true);
    } catch (err) {
      showToast({
        message: getErrorMessage(err, '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.'),
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 16px 80px' }}>
      <SEO title="파트너 제휴 문의" description={`${siteConfig.company.nameShort} 파트너 제휴 문의 페이지`} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: 'var(--text-title, 22px)', fontWeight: 800, color: 'var(--color-grey-900)', marginBottom: '8px', letterSpacing: '-0.01em' }}>
          파트너 제휴 문의
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-grey-500)' }}>
          {siteConfig.company.nameShort}와 함께 성장하세요
        </p>
      </div>

      {isSubmitted ? (
        /* 제출 완료 상태 */
        <Card className="p-8 rounded-3xl" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <CheckCircle size={52} strokeWidth={1.5} style={{ color: 'var(--color-success)' }} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-grey-900)', marginBottom: '10px' }}>
            문의가 접수되었습니다
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-grey-500)', lineHeight: 1.6, marginBottom: '8px' }}>
            담당자가 검토 후 입력하신 이메일로 연락드리겠습니다.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-grey-400)', marginBottom: '32px' }}>
            영업일 기준 2~3일 내 회신됩니다.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => { setIsSubmitted(false); setForm(INITIAL_FORM); setErrors({}); }}
              style={{
                padding: '10px 28px',
                borderRadius: '12px',
                background: 'var(--color-grey-100)',
                color: 'var(--color-grey-700)',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              새 문의 작성
            </button>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 28px',
                borderRadius: '12px',
                background: 'var(--color-primary)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              홈으로 돌아가기
            </Link>
          </div>
        </Card>
      ) : (
        /* 문의 폼 */
        <Card className="p-6 rounded-3xl">
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* 회사명 */}
              <div>
                <label htmlFor="companyName" style={labelStyle}>
                  회사명 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="(주)회사명"
                  required
                  aria-required="true"
                  style={inputStyle(!!errors.companyName)}
                  aria-invalid={!!errors.companyName}
                  aria-describedby={errors.companyName ? 'companyName-error' : undefined}
                  autoComplete="organization"
                />
                {errors.companyName && (
                  <p id="companyName-error" role="alert" style={errorStyle}>{errors.companyName}</p>
                )}
              </div>

              {/* 사업자등록번호 */}
              <div>
                <label htmlFor="businessRegNo" style={labelStyle}>
                  사업자등록번호 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="businessRegNo"
                  name="businessRegNo"
                  type="text"
                  inputMode="numeric"
                  value={form.businessRegNo}
                  onChange={handleBusinessRegNoChange}
                  placeholder="1234567890"
                  required
                  aria-required="true"
                  style={inputStyle(!!errors.businessRegNo)}
                  aria-invalid={!!errors.businessRegNo}
                  aria-describedby={errors.businessRegNo ? 'businessRegNo-error' : undefined}
                  maxLength={12}
                />
                {errors.businessRegNo && (
                  <p id="businessRegNo-error" role="alert" style={errorStyle}>{errors.businessRegNo}</p>
                )}
              </div>

              {/* 개업일자 */}
              <div>
                <label htmlFor="businessOpenDate" style={labelStyle}>
                  개업일자 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="businessOpenDate"
                  name="businessOpenDate"
                  type="date"
                  value={form.businessOpenDate}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  style={inputStyle(!!errors.businessOpenDate)}
                  aria-invalid={!!errors.businessOpenDate}
                  aria-describedby={errors.businessOpenDate ? 'businessOpenDate-error' : undefined}
                  max={new Date().toISOString().split('T')[0]}
                />
                {errors.businessOpenDate && (
                  <p id="businessOpenDate-error" role="alert" style={errorStyle}>{errors.businessOpenDate}</p>
                )}
              </div>

              {/* 대표자성명 */}
              <div>
                <label htmlFor="repName" style={labelStyle}>
                  대표자성명 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="repName"
                  name="repName"
                  type="text"
                  value={form.repName}
                  onChange={handleChange}
                  placeholder="대표자명 (외국인은 영문명)"
                  required
                  aria-required="true"
                  style={inputStyle(!!errors.repName)}
                  aria-invalid={!!errors.repName}
                  aria-describedby={errors.repName ? 'repName-error' : undefined}
                  autoComplete="name"
                />
                {errors.repName && (
                  <p id="repName-error" role="alert" style={errorStyle}>{errors.repName}</p>
                )}
              </div>

              {/* 담당자명 */}
              <div>
                <label htmlFor="contactName" style={labelStyle}>
                  담당자명 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="contactName"
                  name="contactName"
                  type="text"
                  value={form.contactName}
                  onChange={handleChange}
                  placeholder="담당자명"
                  required
                  aria-required="true"
                  style={inputStyle(!!errors.contactName)}
                  aria-invalid={!!errors.contactName}
                  aria-describedby={errors.contactName ? 'contactName-error' : undefined}
                  autoComplete="name"
                />
                {errors.contactName && (
                  <p id="contactName-error" role="alert" style={errorStyle}>{errors.contactName}</p>
                )}
              </div>

              {/* 이메일 */}
              <div>
                <label htmlFor="email" style={labelStyle}>
                  이메일 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="example@company.com"
                  required
                  aria-required="true"
                  style={inputStyle(!!errors.email)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  autoComplete="email"
                  spellCheck={false}
                />
                {errors.email && (
                  <p id="email-error" role="alert" style={errorStyle}>{errors.email}</p>
                )}
              </div>

              {/* 연락처 */}
              <div>
                <label htmlFor="phone" style={labelStyle}>
                  연락처 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={handlePhoneChange}
                  placeholder="010-0000-0000"
                  required
                  aria-required="true"
                  style={inputStyle(!!errors.phone)}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? 'phone-error' : undefined}
                  autoComplete="tel"
                />
                {errors.phone && (
                  <p id="phone-error" role="alert" style={errorStyle}>{errors.phone}</p>
                )}
              </div>

              {/* 문의 유형 */}
              <div>
                <label htmlFor="category" style={labelStyle}>
                  문의 유형 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  style={{
                    ...inputStyle(!!errors.category),
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                    paddingRight: '36px',
                    cursor: 'pointer',
                  }}
                  aria-invalid={!!errors.category}
                  aria-describedby={errors.category ? 'category-error' : undefined}
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p id="category-error" role="alert" style={errorStyle}>{errors.category}</p>
                )}
              </div>

              {/* 문의 내용 */}
              <div>
                <label htmlFor="message" style={labelStyle}>
                  문의 내용 <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="문의 내용을 작성해주세요 (10~200자)"
                  maxLength={200}
                  rows={5}
                  required
                  aria-required="true"
                  style={{
                    ...inputStyle(!!errors.message),
                    resize: 'vertical',
                    minHeight: '120px',
                  }}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? 'message-error' : undefined}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  {errors.message ? (
                    <p id="message-error" role="alert" style={errorStyle}>{errors.message}</p>
                  ) : (
                    <span />
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--color-grey-400)' }}>
                    {form.message.length}자
                  </span>
                </div>
              </div>

              {/* 안내 문구 */}
              <p style={{ fontSize: '12px', color: 'var(--color-grey-400)', textAlign: 'center' }}>
                문의는 1분에 5건까지 가능합니다
              </p>

              {/* 제출 버튼 */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="xl"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                문의 접수
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Footer link */}
      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <Link
          to="/support"
          style={{ fontSize: '12px', color: 'var(--color-grey-400)', textDecoration: 'none' }}
        >
          고객센터 바로가기
        </Link>
      </div>
    </div>
  );
};

// ── Shared style helpers ──────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-grey-700)',
  marginBottom: '6px',
};

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '10px 14px',
  fontSize: '14px',
  color: 'var(--color-grey-900)',
  background: 'var(--color-grey-50, #f9fafb)',
  border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--color-grey-200)'}`,
  borderRadius: '10px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
});

const errorStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-error)',
  marginTop: '4px',
};

export default PartnerInquiryPage;
