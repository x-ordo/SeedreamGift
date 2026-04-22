import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { TriangleAlert, CircleCheck } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { Button, Card, TextField } from '../../design-system';
import Logo from '../../components/common/Logo';
import PasswordStrengthMeter from '../../components/auth/PasswordStrengthMeter';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      await axiosInstance.post('/auth/reset-password', { email, token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      setError(axiosErr.response?.data?.error || axiosErr.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex justify-center items-start px-4 pt-8 sm:pt-[10vh] pb-12 min-h-[calc(100vh-200px)]">
        <div className="w-full max-w-md">
          <Card className="p-5 sm:p-8 shadow-md rounded-2xl border border-base-200 text-center">
            <div className="mb-3">
              <TriangleAlert size={48} className="text-warning" aria-hidden="true" />
            </div>
            <h2 className="font-bold text-base sm:text-lg mb-3">
              유효하지 않은 링크
            </h2>
            <p className="text-base-content/50 mb-4">
              비밀번호 재설정 링크가 유효하지 않습니다. 다시 요청해주세요.
            </p>
            <Link to="/forgot-password" className="text-primary hover:underline">
              비밀번호 찾기로 이동
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-start px-4 pt-8 sm:pt-[10vh] pb-12 min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-md">
        <Card className="p-5 sm:p-8 shadow-md rounded-2xl border border-base-200">
          <div className="flex items-center gap-2 mb-8">
            <Logo size={24} />
            <h1 className="text-base font-bold text-base-content tracking-tight">비밀번호 재설정</h1>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-error/10 text-error text-xs sm:text-sm" role="alert">
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div>
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-success/10 text-success text-xs sm:text-sm" role="status">
                <CircleCheck size={16} aria-hidden="true" className="shrink-0" />
                <span>비밀번호가 변경되었습니다. 잠시 후 로그인 페이지로 이동합니다</span>
              </div>
              <div className="text-center">
                <Link to="/login" className="text-primary hover:underline">
                  로그인으로 돌아가기
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <TextField
                  variant="box"
                  label="이메일 주소"
                  labelOption="sustain"
                  name="email"
                  type="email"
                  placeholder="가입 시 사용한 이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="mb-3">
                <TextField.Password
                  variant="box"
                  label="새 비밀번호"
                  labelOption="sustain"
                  name="newPassword"
                  placeholder="8자 이상, 영문/숫자/특수문자 포함"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <PasswordStrengthMeter password={newPassword} />
              </div>
              <div className="mb-4">
                <TextField.Password
                  variant="box"
                  label="비밀번호 확인"
                  labelOption="sustain"
                  name="confirmPassword"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  hasError={!!confirmPassword && newPassword !== confirmPassword}
                  help={confirmPassword && newPassword !== confirmPassword
                    ? '비밀번호가 일치하지 않습니다'
                    : undefined}
                />
              </div>
              <Button
                type="submit"
                variant="cta"
                fullWidth
                size="lg"
                isLoading={isLoading}
                className="mb-3"
              >
                비밀번호 변경
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
