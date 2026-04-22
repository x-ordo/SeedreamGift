import React from 'react';
import { Lock } from 'lucide-react';
import { Modal, TextField, Stack, Button } from '../../design-system';
import AddressSearch from '../auth/AddressSearch';

export interface ProfileFormData {
  name: string;
  email: string;
  zipCode: string;
  address: string;
  addressDetail: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileForm: ProfileFormData;
  onFormChange: (form: ProfileFormData) => void;
  saving: boolean;
  onSave: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen, onClose, profileForm, onFormChange, saving, onSave,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="배송지 설정"
    footer={<Button variant="cta" onClick={onSave} fullWidth disabled={saving}>저장</Button>}
  >
    <Stack gap={4}>
      {/* 본인 정보 — 변경 불가 (KYC/회원가입 시 확정) */}
      <div>
        <h4 className="text-xs font-bold text-base-content/30 uppercase tracking-wider mb-3">본인 정보</h4>
        <div className="space-y-3">
          <TextField
            label="이름"
            variant="box"
            value={profileForm.name}
            readOnly
            style={{ backgroundColor: 'var(--color-grey-50)' }}
            rightIcon={<Lock size={14} className="text-base-content/20" />}
          />
          <TextField
            label="이메일"
            variant="box"
            value={profileForm.email}
            readOnly
            style={{ backgroundColor: 'var(--color-grey-50)' }}
            rightIcon={<Lock size={14} className="text-base-content/20" />}
          />
          <p className="text-xs text-base-content/30 flex items-center gap-1">
            <Lock size={10} aria-hidden="true" />
            이름과 이메일은 본인 인증 정보로 변경할 수 없습니다
          </p>
        </div>
      </div>

      {/* 배송지 — 수정 가능 */}
      <div>
        <h4 className="text-xs font-bold text-base-content/30 uppercase tracking-wider mb-3">배송지</h4>
        <AddressSearch
          zipCode={profileForm.zipCode}
          address={profileForm.address}
          addressDetail={profileForm.addressDetail}
          onAddressChange={(data) =>
            onFormChange({ ...profileForm, ...data })
          }
        />
      </div>
    </Stack>
  </Modal>
);
