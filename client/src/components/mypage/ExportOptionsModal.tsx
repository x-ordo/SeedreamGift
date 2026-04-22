import { useState, type FC } from 'react';
import { Modal, Button } from '../../design-system';
import type { PinOption, TransactionType } from '../../api/manual';

export interface ExportOptions {
  pinOption: PinOption;
  type: TransactionType;
}

interface ExportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  loading?: boolean;
}

export const ExportOptionsModal: FC<ExportOptionsModalProps> = ({
  isOpen,
  onClose,
  onExport,
  loading = false,
}) => {
  const [pinOption, setPinOption] = useState<PinOption>('masked');
  const [type, setType] = useState<TransactionType>('ALL');

  const handleExport = () => {
    onExport({ pinOption, type });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="거래내역 다운로드 옵션"
      size="small"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button variant="cta" onClick={handleExport} loading={loading}>
            다운로드
          </Button>
        </div>
      }
    >
      <div className="mb-4">
        <div className="text-sm font-semibold mb-2 text-base-content">PIN 번호</div>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="PIN 번호 옵션">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="pinOption"
              value="masked"
              checked={pinOption === 'masked'}
              onChange={() => setPinOption('masked')}
            />
            마스킹 표시 (앞 4자리만)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="pinOption"
              value="none"
              checked={pinOption === 'none'}
              onChange={() => setPinOption('none')}
            />
            제외 (PIN 컬럼 없음)
          </label>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm font-semibold mb-2 text-base-content">거래 유형</div>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="거래 유형 옵션">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="type"
              value="ALL"
              checked={type === 'ALL'}
              onChange={() => setType('ALL')}
            />
            전체
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="type"
              value="SALE"
              checked={type === 'SALE'}
              onChange={() => setType('SALE')}
            />
            구매(판매)만
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="type"
              value="PURCHASE"
              checked={type === 'PURCHASE'}
              onChange={() => setType('PURCHASE')}
            />
            매입(환매)만
          </label>
        </div>
      </div>
    </Modal>
  );
};
