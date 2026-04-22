import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { Modal, TextField, Stack, Button } from '../../design-system';
import { useToast } from '../../contexts/ToastContext';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  saving: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  onWithdraw: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen, onClose, saving, password, onPasswordChange, error, onWithdraw,
}) => {
  const { showToast } = useToast();

  // Watch for errors and show toast instead of inline layout shifting
  React.useEffect(() => {
    if (error) {
      showToast({ message: error, type: 'error' });
    }
  }, [error, showToast]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="회원 탈퇴"
      footer={
        <div className="flex gap-3 w-full">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            disabled={saving}
          >
            취소하기
          </Button>
          <Button
            onClick={onWithdraw}
            variant="danger"
            className="flex-1"
            disabled={saving || !password}
            loading={saving}
          >
            {saving ? '탈퇴 처리중...' : '탈퇴 접수하기'}
          </Button>
        </div>
      }
    >
      <Stack gap={3}>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 text-warning text-xs sm:text-sm" role="alert">
          <TriangleAlert size={16} aria-hidden="true" className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">회원 탈퇴 시 주의사항</p>
            <ul className="list-disc list-inside space-y-0.5 text-base-content/60">
              <li>모든 개인정보가 영구 삭제됩니다</li>
              <li>미완료 주문이 있으면 탈퇴가 제한될 수 있습니다</li>
            </ul>
          </div>
        </div>
        <TextField.Password
          label="비밀번호 확인"
          variant="box"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="현재 비밀번호를 입력하세요 (필수)"
          autoComplete="current-password"
        />
      </Stack>
    </Modal>
  );
};
