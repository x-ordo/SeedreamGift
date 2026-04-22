import { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { SiteConfig } from '../../../api/generated';
import { Badge, Button, TextField } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { COLORS } from '../../../constants/designTokens';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList } from '../hooks';

interface PendingSave {
  config: SiteConfig;
  newValue: string;
}

const ConfigsTab = () => {
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const { items: configs, loading, reload } = useAdminList<SiteConfig>(
    () => adminApi.getAllSiteConfigs(),
  );

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const requestSave = (config: SiteConfig) => {
    const newValue = editedValues[config.key];
    if (newValue === undefined || newValue === config.value) return;
    setPendingSave({ config, newValue });
  };

  const handleConfirmSave = async () => {
    if (!pendingSave) return;
    try {
      await adminApi.updateSiteConfig(pendingSave.config.key, pendingSave.newValue);
      showToast({ message: '저장되었습니다.', type: 'success' });
      setEditedValues({});
      reload();
    } catch { showToast({ message: '설정 저장에 실패했습니다.', type: 'error' }); } finally { setPendingSave(null); }
  };

  const isDirty = (key: string, currentValue: string) => {
    return editedValues[key] !== undefined && editedValues[key] !== currentValue;
  };

  const columns: Column<SiteConfig>[] = [
    { key: 'key', header: '설정 키', render: (c) => <span className="admin-mono" style={{ fontWeight: 600 }}>{c.key}</span> },
    {
      key: 'value', header: '값', render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TextField
            variant="box"
            type="text"
            value={editedValues[c.key] ?? c.value}
            onChange={(e) => handleValueChange(c.key, e.target.value)}
            style={{ width: '200px', borderColor: isDirty(c.key, c.value) ? COLORS.primary : undefined }}
          />
          {isDirty(c.key, c.value) && (
            <Button variant="primary" size="sm" onClick={() => requestSave(c)}>저장</Button>
          )}
        </div>
      )
    },
    { key: 'type', header: '타입', render: (c) => <Badge color="elephant" variant="weak" size="sm">{c.type}</Badge> },
    { key: 'description', header: '설명', render: (c) => c.description || '-' },
  ];

  return (
    <div className="admin-tab">
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">시스템 설정</h2>
          <p className="admin-page-desc">플랫폼 설정값을 관리합니다</p>
        </div>
      </div>

      <div className="admin-table-card">
        <AdminTable columns={columns} data={configs} keyField="key" isLoading={loading} />
      </div>

      <ConfirmModal
        isOpen={pendingSave !== null}
        onClose={() => setPendingSave(null)}
        onConfirm={handleConfirmSave}
        title="설정 변경 확인"
        confirmLabel="변경"
      >
        <p style={{ color: COLORS.grey700 }}>
          <strong>{pendingSave?.config.key}</strong> 설정을{' '}
          <code style={{ background: COLORS.grey100, padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{pendingSave?.config.value}</code>에서{' '}
          <code style={{ background: COLORS.grey100, padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{pendingSave?.newValue}</code>(으)로 변경하시겠습니까?
        </p>
      </ConfirmModal>
    </div>
  );
};

export default ConfigsTab;
