import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { CircleCheck } from 'lucide-react';
import { axiosInstance } from '../../lib/axios';
import { Button, Card, TextField } from '../../design-system';
import Logo from '../../components/common/Logo';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await axiosInstance.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      setError(axiosErr.response?.data?.error || axiosErr.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-start px-4 pt-8 sm:pt-[10vh] pb-12 min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-md">
        <Card className="p-5 sm:p-8 shadow-md rounded-2xl border border-base-200">
          <div className="flex items-center gap-2 mb-8">
            <Logo size={24} />
            <h1 className="text-base font-bold text-base-content tracking-tight">비밀번호 찾기</h1>
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
                <span>재설정 링크가 이메일로 발송되었습니다</span>
              </div>
              <div className="text-center">
                <Link to="/login" className="text-primary hover:underline">
                  로그인으로 돌아가기
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <TextField
                  variant="box"
                  label="이메일 주소"
                  labelOption="sustain"
                  name="email"
                  type="email"
                  placeholder="이메일을 입력하세요"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  spellCheck={false}
                  autoFocus
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
                재설정 링크 보내기
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-xs sm:text-sm text-base-content/50 hover:text-primary">
                  로그인으로 돌아가기
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
