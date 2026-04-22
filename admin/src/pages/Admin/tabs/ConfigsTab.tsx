import { useState, useEffect, useCallback } from 'react';
import { Settings, RefreshCw, Save, Bell, Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Skeleton, Modal } from '../../../design-system';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAdminList } from '../hooks';

interface SiteConfig {
  id: number;
  key: string;
  value: string;
  type: string;
  description?: string;
}

interface NotificationChannel {
  channel: string;
  name?: string;
  enabled: boolean;
}

interface PendingSave {
  config: SiteConfig;
  newValue: string;
}

// Boolean으로 해석 가능한 키 패턴
const isBooleanConfig = (cfg: SiteConfig) =>
  cfg.type === 'BOOLEAN' || cfg.value === 'true' || cfg.value === 'false';

const ConfigsTab = () => {
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const { items: configs, loading, reload } = useAdminList<SiteConfig>(
    () => adminApi.getAllSiteConfigs(),
  );

  // ─── 설정 추가 / 삭제 ─────────────────────────────
  const [createModal, setCreateModal] = useState(false);
  const [newConfig, setNewConfig] = useState({ key: '', value: '', type: 'STRING', description: '' });
  const [createSaving, setCreateSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ open: boolean; id: number; key: string }>({
    open: false, id: 0, key: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCreateConfig = async () => {
    if (!newConfig.key.trim()) {
      showToast({ message: '설정 키를 입력해주세요.', type: 'error' });
      return;
    }
    setCreateSaving(true);
    try {
      await adminApi.createSiteConfig({
        key: newConfig.key.trim(),
        value: newConfig.value,
        type: newConfig.type,
        description: newConfig.description.trim() || undefined,
      });
      showToast({ message: '설정이 추가되었습니다.', type: 'success' });
      setNewConfig({ key: '', value: '', type: 'STRING', description: '' });
      setCreateModal(false);
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '설정 추가에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setCreateSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    setDeleting(true);
    try {
      await adminApi.deleteSiteConfig(deleteTarget.id);
      showToast({ message: `'${deleteTarget.key}' 설정이 삭제되었습니다.`, type: 'success' });
      reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '설정 삭제에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setDeleteTarget({ open: false, id: 0, key: '' });
      setDeleting(false);
    }
  };

  // ─── 알림 채널 ────────────────────────────────────
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const data = await adminApi.getNotificationChannels();
      setChannels(Array.isArray(data) ? data : data?.items ?? []);
    } catch {
      // 알림 채널 로드 실패는 비중요 오류
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const handleToggleChannel = async (channel: string) => {
    try {
      await adminApi.toggleNotificationChannel(channel);
      showToast({ message: `${channel} 채널이 변경되었습니다.`, type: 'success' });
      loadChannels();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '채널 변경에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    }
  };

  const handleTestChannel = async (channel: string) => {
    try {
      await adminApi.testNotificationChannel(channel);
      showToast({ message: `${channel} 테스트 메시지가 전송되었습니다.`, type: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || `${channel} 테스트 전송에 실패했습니다.`;
      showToast({ message: msg, type: 'error' });
    }
  };

  const handleToggle = async (cfg: SiteConfig) => {
    const newValue = cfg.value === 'true' ? 'false' : 'true';
    try {
      await adminApi.updateSiteConfig(cfg.key, newValue);
      showToast({ message: '설정이 변경되었습니다', type: 'success' });
      reload();
    } catch {
      showToast({ message: '설정 변경에 실패했습니다', type: 'error' });
    }
  };

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
    setSaving(true);
    try {
      await adminApi.updateSiteConfig(pendingSave.config.key, pendingSave.newValue);
      showToast({ message: '저장되었습니다', type: 'success' });
      setEditedValues(prev => { const next = { ...prev }; delete next[pendingSave.config.key]; return next; });
      reload();
    } catch {
      showToast({ message: '설정 저장에 실패했습니다', type: 'error' });
    } finally {
      setPendingSave(null);
      setSaving(false);
    }
  };

  const isDirty = (key: string, currentValue: string) =>
    editedValues[key] !== undefined && editedValues[key] !== currentValue;

  // Boolean 설정과 텍스트 설정 분리
  const boolConfigs = configs.filter(isBooleanConfig);
  const textConfigs = configs.filter(c => !isBooleanConfig(c));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height={40} style={{ borderRadius: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Skeleton height={120} style={{ borderRadius: 12 }} />
          <Skeleton height={120} style={{ borderRadius: 12 }} />
        </div>
        <Skeleton height={200} style={{ borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
            <Settings size={18} className="text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">시스템 설정</h2>
            <p className="text-xs text-slate-500">플랫폼 전체 설정값을 관리합니다</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <button
            type="button"
            className="admin-btn-primary"
            onClick={() => setCreateModal(true)}
          >
            <Plus size={14} />
            설정 추가
          </button>
          <button type="button" onClick={reload} className="admin-btn-secondary">
            <RefreshCw size={14} />
            새로고침
          </button>
        </div>
      </div>

      {/* Boolean 설정 — Switch 토글 카드 */}
      {boolConfigs.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">기능 제어</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {boolConfigs.map(cfg => (
              <div
                key={cfg.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{cfg.description || cfg.key}</p>
                  <p className="mt-0.5 text-xs text-slate-400 font-mono">{cfg.key}</p>
                </div>
                <button
                  type="button"
                  className="admin-btn-danger"
                  style={{ fontSize: '11px', padding: '2px 7px', flexShrink: 0 }}
                  onClick={() => setDeleteTarget({ open: true, id: cfg.id, key: cfg.key })}
                >
                  삭제
                </button>
                <label className="inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={cfg.value === 'true'}
                    onChange={() => handleToggle(cfg)}
                    className="sr-only"
                    aria-label={`${cfg.key} 토글`}
                  />
                  <div
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: cfg.value === 'true' ? 'var(--color-primary)' : 'var(--color-grey-300)',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: 'white',
                        position: 'absolute',
                        top: 2,
                        left: cfg.value === 'true' ? 22 : 2,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }}
                    />
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 텍스트/숫자 설정 — 테이블 */}
      {textConfigs.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">설정값</h3>
          <div className="admin-table-card">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>설정 키</th>
                  <th>값</th>
                  <th>타입</th>
                  <th>설명</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {textConfigs.map(cfg => (
                  <tr key={cfg.key}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600, fontSize: 12, color: 'var(--color-purple-500)' }}>
                        {cfg.key}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          className="admin-search-input"
                          style={{
                            width: 180,
                            borderColor: isDirty(cfg.key, cfg.value) ? 'var(--color-primary)' : undefined,
                          }}
                          value={editedValues[cfg.key] ?? cfg.value}
                          onChange={e => handleValueChange(cfg.key, e.target.value)}
                        />
                        {isDirty(cfg.key, cfg.value) && (
                          <button type="button" className="admin-btn-primary" onClick={() => requestSave(cfg)}>
                            <Save size={12} />
                            저장
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="admin-badge gray">{cfg.type}</span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--color-grey-500)' }}>
                      {cfg.description || '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn-danger"
                        style={{ fontSize: '12px', padding: '3px 8px' }}
                        onClick={() => setDeleteTarget({ open: true, id: cfg.id, key: cfg.key })}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={pendingSave !== null}
        onClose={() => setPendingSave(null)}
        onConfirm={handleConfirmSave}
        title="설정 변경 확인"
        confirmLabel="변경"
        loading={saving}
      >
        <p className="text-sm text-slate-700">
          <strong>{pendingSave?.config.key}</strong> 설정을{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{pendingSave?.config.value}</code>
          {' → '}
          <code className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{pendingSave?.newValue}</code>
          (으)로 변경하시겠습니까?
        </p>
      </ConfirmModal>

      {/* ── 알림 채널 관리 ── */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 'var(--radius-sm)',
            background: 'var(--color-grey-100)',
          }}>
            <Bell size={18} style={{ color: 'var(--color-grey-600)' }} aria-hidden="true" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-grey-900)', margin: 0 }}>알림 채널 관리</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-grey-500)', margin: 0 }}>알림 전송 채널별 활성화 상태를 관리합니다</p>
          </div>
        </div>

        {channelsLoading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-grey-400)', fontSize: '14px' }}>
            불러오는 중...
          </div>
        ) : channels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-grey-400)', fontSize: '14px' }}>
            등록된 알림 채널이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {channels.map((ch) => (
              <div
                key={ch.channel ?? ch.name ?? ch.id}
                style={{
                  background: 'white',
                  border: '1px solid var(--color-grey-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-grey-900)', textTransform: 'capitalize' }}>
                    {ch.channel ?? ch.name ?? '알 수 없음'}
                  </span>
                  {ch.enabled ? (
                    <span className="admin-badge green" style={{ fontSize: '11px' }}>활성</span>
                  ) : (
                    <span className="admin-badge red" style={{ fontSize: '11px' }}>비활성</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className={ch.enabled ? 'admin-btn-secondary' : 'admin-btn-primary'}
                    style={{ flex: 1, fontSize: '12px', padding: '5px 0' }}
                    onClick={() => handleToggleChannel(ch.channel ?? ch.name)}
                  >
                    {ch.enabled ? '비활성화' : '활성화'}
                  </button>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    style={{ flex: 1, fontSize: '12px', padding: '5px 0' }}
                    onClick={() => handleTestChannel(ch.channel ?? ch.name)}
                  >
                    테스트
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 설정 추가 모달 ── */}
      <Modal
        isOpen={createModal}
        onClose={() => { setCreateModal(false); setNewConfig({ key: '', value: '', type: 'STRING', description: '' }); }}
        title="설정 추가"
        size="small"
      >
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label htmlFor="cfg-key" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-grey-600)', display: 'block', marginBottom: '4px' }}>
                설정 키 *
              </label>
              <input
                id="cfg-key"
                type="text"
                className="admin-search-input"
                style={{ width: '100%' }}
                value={newConfig.key}
                onChange={e => setNewConfig(prev => ({ ...prev, key: e.target.value }))}
                placeholder="예: MAINTENANCE_MODE"
                aria-label="설정 키"
              />
            </div>
            <div>
              <label htmlFor="cfg-value" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-grey-600)', display: 'block', marginBottom: '4px' }}>
                값
              </label>
              <input
                id="cfg-value"
                type="text"
                className="admin-search-input"
                style={{ width: '100%' }}
                value={newConfig.value}
                onChange={e => setNewConfig(prev => ({ ...prev, value: e.target.value }))}
                placeholder="설정값 입력"
                aria-label="설정 값"
              />
            </div>
            <div>
              <label htmlFor="cfg-type" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-grey-600)', display: 'block', marginBottom: '4px' }}>
                타입
              </label>
              <select
                id="cfg-type"
                className="admin-search-input"
                style={{ width: '100%' }}
                value={newConfig.type}
                onChange={e => setNewConfig(prev => ({ ...prev, type: e.target.value }))}
                aria-label="설정 타입"
              >
                <option value="STRING">STRING</option>
                <option value="NUMBER">NUMBER</option>
                <option value="BOOLEAN">BOOLEAN</option>
              </select>
            </div>
            <div>
              <label htmlFor="cfg-desc" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-grey-600)', display: 'block', marginBottom: '4px' }}>
                설명
              </label>
              <input
                id="cfg-desc"
                type="text"
                className="admin-search-input"
                style={{ width: '100%' }}
                value={newConfig.description}
                onChange={e => setNewConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="설정에 대한 설명 (선택)"
                maxLength={200}
                aria-label="설정 설명"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setCreateModal(false); setNewConfig({ key: '', value: '', type: 'STRING', description: '' }); }}
            >
              취소
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateConfig}
              loading={createSaving}
              disabled={!newConfig.key.trim()}
            >
              추가
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* ── 설정 삭제 확인 ── */}
      <ConfirmModal
        isOpen={deleteTarget.open}
        onClose={() => setDeleteTarget({ open: false, id: 0, key: '' })}
        onConfirm={handleDeleteConfig}
        title="설정 삭제 확인"
        confirmLabel="삭제"
        danger
        loading={deleting}
      >
        <p className="text-sm text-slate-700">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{deleteTarget.key}</code> 설정을 삭제하시겠습니까?
          <br />
          <span style={{ fontSize: '12px', color: 'var(--color-error)' }}>이 작업은 되돌릴 수 없습니다.</span>
        </p>
      </ConfirmModal>
    </div>
  );
};

export default ConfigsTab;
