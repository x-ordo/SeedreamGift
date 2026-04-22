/**
 * @file NotificationChannelsTab.tsx
 * @description 알림 채널 관리 탭 — 이메일, 카카오, 텔레그램, 팝빌 외부 서비스 설정
 * @module pages/Admin/tabs
 *
 * 채널 카드별 기능:
 * - ON/OFF 토글 (낙관적 업데이트)
 * - 설정 필드 편집 (비밀값은 마스킹)
 * - 저장 (변경된 필드만)
 * - 테스트 발송 (수신자 입력 선택)
 */
import { useState, useEffect, useCallback } from 'react';
import { Mail, MessageCircle, Send, FileText, Eye, EyeOff, Bell } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, Button, Switch, TextField, Badge, Stack } from '@/design-system';
import { notificationChannelApi } from '@/api/manual';
import { useToast } from '@/contexts/ToastContext';

// ============================================================================
// Types
// ============================================================================

interface ConfigField {
  name: string;
  value: string;
  isSecret: boolean;
  label: string;
}

interface ChannelConfig {
  channel: string;
  enabled: boolean;
  fields: ConfigField[];
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const CHANNEL_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  EMAIL: { label: '이메일 (SMTP)', icon: Mail, color: 'var(--color-primary)' },
  KAKAO: { label: '카카오 알림톡', icon: MessageCircle, color: '#FEE500' },
  TELEGRAM: { label: '텔레그램', icon: Send, color: '#0088CC' },
  POPBILL: { label: '팝빌 (현금영수증)', icon: FileText, color: '#4CAF50' },
};

// ============================================================================
// Component
// ============================================================================

const NotificationChannelsTab: React.FC = () => {
  const { showToast } = useToast();
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedFields, setEditedFields] = useState<Record<string, Record<string, string>>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, Set<string>>>({});
  const [testRecipient, setTestRecipient] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await notificationChannelApi.getChannels();
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setChannels(data);
    } catch {
      // 글로벌 에러 핸들러가 처리
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const handleToggle = async (channel: string, enabled: boolean) => {
    // 낙관적 업데이트
    setChannels(prev => prev.map(ch => ch.channel === channel ? { ...ch, enabled } : ch));
    try {
      await notificationChannelApi.toggleChannel(channel, enabled);
      showToast({
        message: `${CHANNEL_META[channel]?.label || channel} ${enabled ? '활성화' : '비활성화'}됨`,
        type: 'success',
      });
    } catch {
      // 롤백
      setChannels(prev => prev.map(ch => ch.channel === channel ? { ...ch, enabled: !enabled } : ch));
    }
  };

  const handleFieldChange = (channel: string, fieldName: string, value: string) => {
    setEditedFields(prev => ({
      ...prev,
      [channel]: { ...(prev[channel] || {}), [fieldName]: value },
    }));
  };

  const handleSave = async (channel: string) => {
    const fields = editedFields[channel];
    if (!fields || Object.keys(fields).length === 0) return;
    setSaving(channel);
    try {
      await notificationChannelApi.updateConfig(channel, fields);
      showToast({ message: '설정이 저장되었습니다', type: 'success' });
      setEditedFields(prev => { const n = { ...prev }; delete n[channel]; return n; });
      fetchChannels();
    } catch {
      // 글로벌 에러 핸들러가 처리
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (channel: string) => {
    setTesting(channel);
    try {
      const res = await notificationChannelApi.testChannel(channel, testRecipient[channel]);
      const data = res.data;
      if (data?.success === false) {
        showToast({ message: `테스트 실패: ${data.message || '알 수 없는 오류'}`, type: 'error' });
      } else {
        showToast({ message: '테스트 발송 성공', type: 'success' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      showToast({ message: `테스트 실패: ${message}`, type: 'error' });
    } finally {
      setTesting(null);
    }
  };

  const toggleSecretVisibility = (channel: string, fieldName: string) => {
    setShowSecrets(prev => {
      const channelSet = new Set(prev[channel] || []);
      if (channelSet.has(fieldName)) channelSet.delete(fieldName);
      else channelSet.add(fieldName);
      return { ...prev, [channel]: channelSet };
    });
  };

  const getFieldValue = (channel: string, field: ConfigField) => {
    return editedFields[channel]?.[field.name] ?? field.value;
  };

  const isSecretVisible = (channel: string, fieldName: string) => {
    return showSecrets[channel]?.has(fieldName) || false;
  };

  const hasDirtyFields = (channel: string) => {
    const fields = editedFields[channel];
    return fields !== undefined && Object.keys(fields).length > 0;
  };

  if (loading) {
    return (
      <Stack gap={4}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-48 w-full rounded-2xl" />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={4}>
      {channels.map(ch => {
        const meta = CHANNEL_META[ch.channel] || { label: ch.channel, icon: Mail, color: 'var(--color-neutral-400)' };
        const Icon = meta.icon;
        const configFields = ch.fields.filter(f => f.name !== '__enabled__');

        return (
          <Card key={ch.channel} padding="none" shadow="sm">
            {/* 채널 헤더: 아이콘, 이름, 마지막 수정일, ON/OFF 토글 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px',
              borderBottom: '1px solid var(--color-grey-100)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `color-mix(in oklch, ${meta.color} 10%, white)`,
                }}>
                  <Icon size={20} style={{ color: meta.color }} aria-hidden="true" />
                </div>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-grey-900)', margin: 0 }}>
                    {meta.label}
                  </h3>
                  {ch.updatedAt && (
                    <p style={{ fontSize: '12px', color: 'var(--color-grey-400)', margin: 0, marginTop: '2px' }}>
                      마지막 변경: {new Date(ch.updatedAt).toLocaleString('ko-KR')}
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Badge
                  color={ch.enabled ? 'green' : 'elephant'}
                  variant="weak"
                  size="sm"
                >
                  {ch.enabled ? '활성' : '비활성'}
                </Badge>
                <Switch
                  checked={ch.enabled}
                  onChange={(v) => handleToggle(ch.channel, v)}
                  label={`${meta.label} ${ch.enabled ? '비활성화' : '활성화'}`}
                />
              </div>
            </div>

            {/* 설정 필드 영역 */}
            <div style={{ padding: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px',
                marginBottom: '16px',
              }}>
                {configFields.map(field => (
                  <div key={field.name} style={{ position: 'relative' }}>
                    <TextField
                      variant="box"
                      label={field.label}
                      type={field.isSecret && !isSecretVisible(ch.channel, field.name) ? 'password' : 'text'}
                      value={getFieldValue(ch.channel, field)}
                      onChange={(e) => handleFieldChange(ch.channel, field.name, e.target.value)}
                      placeholder={field.isSecret ? '••••••••' : ''}
                    />
                    {field.isSecret && (
                      <button
                        type="button"
                        onClick={() => toggleSecretVisibility(ch.channel, field.name)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '34px',
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-grey-400)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        aria-label={isSecretVisible(ch.channel, field.name) ? '숨기기' : '표시'}
                      >
                        {isSecretVisible(ch.channel, field.name)
                          ? <EyeOff size={16} aria-hidden="true" />
                          : <Eye size={16} aria-hidden="true" />
                        }
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* 테스트 발송 + 저장 버튼 영역 */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--color-grey-50)',
                flexWrap: 'wrap',
              }}>
                {(ch.channel === 'EMAIL' || ch.channel === 'KAKAO') && (
                  <div style={{ flex: '1', maxWidth: '280px' }}>
                    <TextField
                      variant="box"
                      label={ch.channel === 'EMAIL' ? '테스트 수신 이메일' : '테스트 수신 번호'}
                      placeholder={ch.channel === 'EMAIL' ? 'test@example.com' : '01012345678'}
                      value={testRecipient[ch.channel] || ''}
                      onChange={(e) => setTestRecipient(prev => ({ ...prev, [ch.channel]: e.target.value }))}
                    />
                  </div>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleTest(ch.channel)}
                  isLoading={testing === ch.channel}
                  disabled={!ch.enabled}
                >
                  테스트 발송
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleSave(ch.channel)}
                  isLoading={saving === ch.channel}
                  disabled={!hasDirtyFields(ch.channel)}
                >
                  저장
                </Button>
              </div>
            </div>
          </Card>
        );
      })}

      {channels.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-grey-400)' }}>
          <Bell size={40} aria-hidden="true" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <p style={{ fontSize: '14px' }}>등록된 알림 채널이 없습니다.</p>
        </div>
      )}
    </Stack>
  );
};

export default NotificationChannelsTab;
