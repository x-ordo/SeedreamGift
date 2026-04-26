/**
 * @file BankVerification.tsx
 * @description 1원 계좌 인증 컴포넌트 (Coocon API)
 * @module components/auth
 *
 * 사용처:
 * - RegisterPage: 회원가입 2단계 (KYC 인증)
 * - MyPage: 계좌 변경 시 모달 내부
 *
 * Props:
 * - onVerified: 인증 성공 콜백 (bankName, bankCode, accountNumber, accountHolder)
 * - userId: 로그인 상태일 때 전달 (시도 횟수 추적용)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Building2, Info } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { BANKS } from '../../constants';
import { Button, TextField, Card, Select } from '../../design-system';
import type { SelectOption } from '../../design-system';

export interface BankVerifiedData {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  verificationId: string;
}

interface BankVerificationProps {
  onVerified: (data: BankVerifiedData) => void;
  userId?: number;
}

type Step = 'input' | 'verify';

/** 인증 유효 시간 (5분) */
const VERIFY_TIMEOUT_SEC = 300;

/** 은행 목록을 Select 옵션으로 변환 */
const bankOptions: SelectOption[] = BANKS.map(b => ({ value: b.code, label: b.name }));

const BankVerification: React.FC<BankVerificationProps> = ({ onVerified, userId }) => {
  // 단계
  const [step, setStep] = useState<Step>('input');

  // 입력 폼
  const [selectedBank, setSelectedBank] = useState<typeof BANKS[number] | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // 인증 코드
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyTrDt, setVerifyTrDt] = useState('');
  const [verifyTrNo, setVerifyTrNo] = useState('');

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 타이머 관리
  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  /** 은행 선택 핸들러 */
  const handleBankChange = useCallback((value: string) => {
    const bank = BANKS.find(b => b.code === value) ?? null;
    setSelectedBank(bank);
  }, []);

  /** 1원 인증 요청 */
  const handleRequest = async () => {
    if (!selectedBank) {
      setError('은행을 선택해주세요.');
      return;
    }
    if (!accountNumber || !/^\d{10,20}$/.test(accountNumber)) {
      setError('계좌번호는 10~20자리 숫자만 입력 가능합니다.');
      return;
    }
    if (!accountHolder.trim()) {
      setError('예금주명을 입력해주세요.');
      return;
    }
    if (!/^[가-힣a-zA-Z\s]{2,10}$/.test(accountHolder.trim())) {
      setError('예금주명은 한글 또는 영문 2~10자만 입력 가능합니다.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await axiosInstance.post('/kyc/bank-verify/request', {
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
        accountNumber,
        accountHolder: accountHolder.trim(),
      });

      setVerifyTrDt(res.data.verifyTrDt);
      setVerifyTrNo(res.data.verifyTrNo);
      setStep('verify');
      setTimer(VERIFY_TIMEOUT_SEC);
    } catch (err: any) {
      const apiError = err.response?.data?.error;
      const msg = (typeof apiError === 'string' && apiError) || '1원 인증 요청에 실패했습니다. 잠시 후 다시 시도해주세요';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /** 인증 확인 */
  const handleConfirm = async () => {
    if (!verifyCode || verifyCode.length !== 3) {
      setError('3자리 인증 코드를 입력해주세요.');
      return;
    }

    if (timer === 0) {
      setError('인증 시간이 만료되었습니다. 다시 요청해주세요.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await axiosInstance.post('/kyc/bank-verify/confirm', {
        verifyTrDt,
        verifyTrNo,
        verifyVal: verifyCode,
      });

      // 타이머 정리
      if (timerRef.current) clearInterval(timerRef.current);

      // 서버 응답에서 원본 bank 정보 사용 (TOCTOU 방지)
      onVerified({
        bankName: res.data.bankName,
        bankCode: res.data.bankCode,
        accountNumber: res.data.accountNumber,
        accountHolder: res.data.accountHolder,
        verificationId: verifyTrNo, // Pass the transaction number as verificationId
      });
    } catch (err: any) {
      const apiError = err.response?.data?.error;
      const msg = (typeof apiError === 'string' && apiError) || '인증에 실패했습니다. 인증번호를 다시 확인해주세요';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /** 재시도 (입력 단계로 복귀) */
  const handleRetry = () => {
    setStep('input');
    setVerifyCode('');
    setVerifyTrDt('');
    setVerifyTrNo('');
    setTimer(0);
    setError('');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="bank-verification">
      {error && (
        <div className="p-4 rounded-2xl bg-error/5 text-error text-xs font-bold border border-error/10 leading-relaxed mb-6 animate-in fade-in zoom-in-95 duration-200" role="alert">
          {error}
        </div>
      )}

      {step === 'input' && (
        <div className="flex flex-col gap-5">
          <Select
            label="은행 선택"
            options={bankOptions}
            value={selectedBank?.code ?? ''}
            onChange={handleBankChange}
            placeholder="입금 받으실 은행을 선택하세요"
            error={!!error && !selectedBank}
          />

          <TextField
            variant="box"
            label="계좌번호"
            labelOption="sustain"
            name="accountNumber"
            placeholder="- 없이 숫자만 입력"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 20))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            help={accountNumber && (accountNumber.length < 10 || accountNumber.length > 20) ? '계좌번호는 10~20자리 숫자입니다' : undefined}
            hasError={!!accountNumber && (accountNumber.length < 10 || accountNumber.length > 20)}
          />

          <TextField
            variant="box"
            label="예금주 (실명)"
            labelOption="sustain"
            name="accountHolder"
            placeholder="통장에 표시된 이름을 입력하세요"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            maxLength={10}
            help={accountHolder && !/^[가-힣a-zA-Z\s]{2,10}$/.test(accountHolder.trim()) ? '한글 또는 영문 2~10자만 가능합니다' : undefined}
            hasError={!!accountHolder && !/^[가-힣a-zA-Z\s]{2,10}$/.test(accountHolder.trim())}
          />

          <Button
            type="button"
            variant="primary"
            fullWidth
            size="xl"
            onClick={handleRequest}
            isLoading={loading}
            className="shadow-primary mt-2"
          >
            1원 인증 요청하기
          </Button>
        </div>
      )}

      {step === 'verify' && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300" role="status" aria-live="polite" aria-label="1원 인증 코드 입력 단계">
          <Card className="p-6 bg-grey-50 border-grey-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
              <Building2 size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-base-content/30 mb-0.5">선택된 계좌</p>
              <p className="text-sm font-bold text-base-content tracking-tight">{selectedBank?.name} {accountNumber}</p>
              <p className="text-xs font-bold text-base-content/50">예금주: {accountHolder}</p>
            </div>
          </Card>

          <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Info size={18} aria-hidden="true" />
              <span className="text-sm font-bold tracking-tight">1원이 입금되었습니다</span>
            </div>
            <p className="text-xs text-base-content/60 leading-relaxed font-medium">
              입금내역(적요)에 표시된 <strong>3자리 숫자</strong>를 아래에 입력해주세요.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <label htmlFor="verify-code" className="text-xs font-bold text-base-content/40">인증 코드</label>
              {timer > 0 && (
                <div className={`flex items-center gap-1.5 text-sm font-bold tabular-nums ${timer <= 60 ? 'text-error animate-pulse' : 'text-primary'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {formatTime(timer)}
                </div>
              )}
            </div>
            <input
              id="verify-code"
              name="verifyCode"
              type="text"
              className="w-full h-20 bg-white border-2 border-grey-200 rounded-[24px] text-center font-bold text-4xl tracking-[16px] text-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-[border-color] shadow-sm"
              maxLength={3}
              pattern="[0-9]*"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              size="xl"
              onClick={handleRetry}
              className="border-grey-200"
            >
              다시 요청
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              size="xl"
              onClick={handleConfirm}
              isLoading={loading}
              disabled={verifyCode.length !== 3 || timer === 0}
              className="shadow-primary"
            >
              인증 완료
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankVerification;
