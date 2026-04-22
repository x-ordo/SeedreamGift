/**
 * @file KycVerification.tsx
 * @description Coocon KYC 본인인증 팝업 연동 컴포넌트
 * @module components/auth
 *
 * Flow (Coocon 팝업 위임):
 * 1. "본인 인증 시작" 버튼 클릭 → POST /kyc/kcb/start → { popupUrl }
 * 2. window.open(popupUrl) → Coocon KYC 페이지 팝업 오픈
 * 3. Coocon 페이지가 KCB 인증 → SMS_VERIFICATION INSERT 자체 처리
 * 4. 팝업 닫힘 감지 → 최소 대기 후 인증 완료 처리
 *
 * 안정성:
 * - 버튼 디바운스 (연속 클릭 방지)
 * - 팝업 즉시 닫기 시 false positive 방지 (최소 10초 대기)
 * - 이미 열린 팝업 재사용 (중복 팝업 방지)
 * - 5분 타임아웃
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { Button } from '../../design-system';

export interface KycVerifiedData {
  name: string;
  phone: string;
  ci: string;
}

interface KycVerificationProps {
  onVerified: (data: KycVerifiedData) => void;
}

/** 팝업 닫힘 감지 간격 (ms) */
const POPUP_CHECK_INTERVAL = 1000;
/** 최대 대기 시간 (ms) — 5분 */
const MAX_WAIT_MS = 5 * 60 * 1000;
/** 팝업이 열린 후 최소 대기 시간 (ms) — 즉시 닫기 시 false positive 방지 */
const MIN_OPEN_DURATION_MS = 10 * 1000;

const KycVerification: React.FC<KycVerificationProps> = ({ onVerified }) => {
  const [status, setStatus] = useState<'idle' | 'starting' | 'popup' | 'verified' | 'error'>('idle');
  const [error, setError] = useState('');
  const popupRef = useRef<Window | null>(null);
  const checkRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAtRef = useRef<number>(0);

  /** 타이머 정리 */
  const cleanup = useCallback(() => {
    if (checkRef.current) {
      clearInterval(checkRef.current);
      checkRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** 팝업 닫힘 감지 시작 */
  const watchPopupClose = useCallback(() => {
    cleanup();
    openedAtRef.current = Date.now();

    // 5분 타임아웃
    timeoutRef.current = setTimeout(() => {
      cleanup();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;
      setStatus('error');
      setError('인증 시간이 초과되었습니다. 다시 시도해주세요.');
    }, MAX_WAIT_MS);

    // 1초마다 팝업 닫힘 확인
    checkRef.current = setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) {
        cleanup();
        popupRef.current = null;

        const elapsed = Date.now() - openedAtRef.current;
        if (elapsed < MIN_OPEN_DURATION_MS) {
          // 10초 이내에 팝업이 닫힘 → 인증 완료가 아닌 사용자 취소 또는 팝업 차단
          setStatus('error');
          setError('본인 인증이 완료되지 않았습니다. 팝업에서 인증을 끝까지 진행해주세요.');
          return;
        }

        // 충분한 시간이 경과 → Coocon에서 인증 완료 후 닫은 것으로 판단
        setStatus('verified');
        onVerified({ name: '', phone: '', ci: '' });
      }
    }, POPUP_CHECK_INTERVAL);
  }, [cleanup, onVerified]);

  /** 인증 시작: 백엔드에서 Coocon URL 받아 팝업 열기 */
  const openPopup = useCallback(async () => {
    // 이미 열린 팝업이 있으면 포커스
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }

    setError('');
    setStatus('starting');

    try {
      const res = await axiosInstance.post('/kyc/kcb/start');
      const { popupUrl } = res.data;

      const width = 430;
      const height = 640;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      popupRef.current = window.open(
        popupUrl,
        'coocon_kyc_popup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
      );

      if (!popupRef.current) {
        setStatus('error');
        setError('팝업이 차단되었습니다. 팝업 차단을 해제한 후 다시 시도해주세요.');
        return;
      }

      setStatus('popup');
      watchPopupClose();
    } catch {
      setStatus('error');
      setError('본인 인증 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [watchPopupClose]);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-4 rounded-2xl bg-error/5 text-error text-xs font-bold border border-error/10 leading-relaxed animate-in fade-in zoom-in-95 duration-200" role="alert">
          {error}
        </div>
      )}

      {/* 인증 전 / 에러: 인증 버튼 */}
      {(status === 'idle' || status === 'error') && (
        <Button
          type="button"
          variant="primary"
          fullWidth
          onClick={openPopup}
          className="h-12 font-bold"
          leftIcon={<ExternalLink size={18} aria-hidden="true" />}
        >
          {status === 'error' ? '다시 인증하기' : '본인 인증 시작'}
        </Button>
      )}

      {/* 백엔드 요청 중 */}
      {status === 'starting' && (
        <div className="p-6 bg-grey-50 rounded-2xl text-center border border-grey-100 animate-in fade-in duration-300" role="status" aria-busy="true" aria-label="본인 인증 준비 중">
          <span className="loading loading-spinner loading-md text-primary" />
          <p className="text-sm mt-3 font-bold text-base-content/60">
            본인 인증을 준비하고 있습니다...
          </p>
        </div>
      )}

      {/* 팝업 열림 — 닫힘 대기 중 */}
      {status === 'popup' && (
        <div className="p-6 bg-primary/5 rounded-2xl text-center border border-primary/10 animate-pulse duration-[2000ms]" role="status" aria-busy="true" aria-label="본인 인증 팝업 대기 중">
          <span className="loading loading-dots loading-md text-primary" />
          <p className="text-sm mt-3 text-primary font-bold tracking-tight">
            본인 인증 팝업이 열렸습니다
          </p>
          <p className="text-xs text-base-content/40 mt-1 font-medium">
            팝업 창에서 본인 확인을 완료해주세요
          </p>
        </div>
      )}

      {/* 인증 완료 */}
      {status === 'verified' && (
        <div className="p-5 rounded-2xl bg-success/5 border border-success/20 flex items-center justify-between animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
              <ShieldCheck size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-success tracking-tight">본인 인증 완료</p>
              <p className="text-xs font-bold text-success/60">아래에 성함과 연락처를 입력해주세요</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-success text-white text-xs font-bold rounded-lg uppercase shadow-sm">Success</div>
        </div>
      )}
    </div>
  );
};

export default KycVerification;
