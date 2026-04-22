import React, { useState } from 'react';
import { Modal, TextField, Stack, Button } from '../../design-system';
import BankVerification, { type BankVerifiedData } from '../auth/BankVerification';
import PasswordStrengthMeter from '../auth/PasswordStrengthMeter';
import { axiosInstance } from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number;
  onSuccess?: () => void;
}

/**
 * 비밀번호 변경 모달 — 2-step flow:
 * Step 1: 현재 비밀번호 + 새 비밀번호 입력
 * Step 2: KYC 1원 인증 → 완료 시 API 호출
 */
export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen, onClose, userId, onSuccess,
}) => {
  const { showToast } = useToast();
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    onClose();
    setStep(1);
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleNext = () => {
    if (!passwordForm.oldPassword.trim()) {
      showToast({ message: '현재 비밀번호를 입력해주세요', type: 'error' });
      return;
    }
    if (!passwordForm.newPassword.trim()) {
      showToast({ message: '새 비밀번호를 입력해주세요', type: 'error' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showToast({ message: '새 비밀번호는 8자 이상이어야 합니다', type: 'error' });
      return;
    }
    if (!passwordForm.confirmPassword.trim()) {
      showToast({ message: '새 비밀번호를 다시 한번 입력해주세요', type: 'error' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast({ message: '새 비밀번호가 일치하지 않습니다', type: 'error' });
      return;
    }
    if (passwordForm.oldPassword === passwordForm.newPassword) {
      showToast({ message: '현재 비밀번호와 다른 비밀번호를 입력해주세요', type: 'error' });
      return;
    }
    setStep(2);
  };

  const handleChangePassword = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await axiosInstance.patch('/auth/password', {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      handleClose();
      showToast({ message: '비밀번호가 변경되었습니다', type: 'success' });
      onSuccess?.();
    } catch (e: any) {
      const status = e.response?.status;
      const serverMsg = e.response?.data?.error || e.response?.data?.message || '';
      let msg = '비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.';
      if (status === 400 && serverMsg.toLowerCase().includes('password')) {
        msg = '현재 비밀번호가 올바르지 않습니다.';
      } else if (status === 401) {
        msg = '로그인이 만료되었습니다. 다시 로그인해주세요.';
      } else if (serverMsg) {
        msg = serverMsg;
      }
      showToast({ message: msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleKycVerified = async (_bankData: BankVerifiedData) => {
    await handleChangePassword();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`비밀번호 변경 (${step}/2)`}
      footer={step === 1 ? (
        <Button variant="cta" onClick={handleNext} fullWidth>계속하기 (계좌 인증)</Button>
      ) : undefined}
    >
      {step === 1 ? (
        <Stack gap={3}>
          <TextField.Password
            label="현재 비밀번호"
            variant="box"
            value={passwordForm.oldPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
          />
          <div>
            <TextField.Password
              label="새 비밀번호"
              variant="box"
              placeholder="8자 이상, 영문/숫자/특수문자 포함"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
            <PasswordStrengthMeter password={passwordForm.newPassword} />
          </div>
          <div>
            <TextField.Password
              label="새 비밀번호 확인"
              variant="box"
              placeholder="비밀번호를 다시 입력하세요"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
            {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <div role="alert" className="text-xs text-error mt-1 flex items-center gap-1">
                <span aria-hidden="true">{'\u2717'}</span> 비밀번호가 일치하지 않습니다
              </div>
            )}
          </div>
        </Stack>
      ) : (
        <div>
          <div className="p-3 rounded-xl mb-4" style={{ background: 'color-mix(in oklch, var(--color-primary) 4%, var(--color-grey-50))', border: '1px solid color-mix(in oklch, var(--color-primary) 8%, var(--color-grey-100))' }}>
            <p className="text-xs sm:text-sm text-base-content/60 leading-relaxed">
              보안을 위해 본인 계좌로 <strong className="text-primary">1원 인증</strong>을 진행합니다.<br />
              인증 완료 후 비밀번호가 즉시 변경됩니다.
            </p>
          </div>
          <BankVerification
            onVerified={handleKycVerified}
            userId={userId}
          />
          {saving && (
            <div className="text-center mt-3">
              <span className="loading loading-spinner loading-md text-primary" role="status" aria-label="처리 중" />
              <p className="text-xs sm:text-sm text-base-content/50 mt-2">비밀번호 변경 중…</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
