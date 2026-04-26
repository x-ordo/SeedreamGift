import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Pencil, Trash2, CheckCircle, RefreshCw } from 'lucide-react';
import { adminApi } from '@/api';
import { Button, Badge, Modal, Skeleton } from '@/design-system';

interface Policy {
  id: number;
  type: string;
  title: string;
  content: string;
  version: string;
  isCurrent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const POLICY_TYPES = [
  { value: 'TERMS', label: '이용약관' },
  { value: 'PRIVACY', label: '개인정보처리방침' },
  { value: 'MARKETING', label: '마케팅 이용약관' },
];

const PoliciesTab = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [form, setForm] = useState({
    type: 'TERMS',
    title: '',
    content: '',
    version: '1.0',
    isCurrent: true,
    isActive: true,
  });

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAllPolicies({ page: 1, limit: 100 });
      setPolicies(res?.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const handleCreate = () => {
    setEditingPolicy(null);
    setForm({ type: 'TERMS', title: '', content: '', version: '1.0', isCurrent: true, isActive: true });
    setIsModalOpen(true);
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setForm({
      type: policy.type,
      title: policy.title,
      content: policy.content,
      version: policy.version,
      isCurrent: policy.isCurrent,
      isActive: policy.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.content || !form.version) return;
    setSaving(true);
    try {
      if (editingPolicy) {
        await adminApi.updatePolicy(editingPolicy.id, form);
      } else {
        await adminApi.createPolicy(form);
      }
      setIsModalOpen(false);
      fetchPolicies();
    } catch {
      // error handled by axios interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrent = async (id: number) => {
    try {
      await adminApi.setCurrentPolicy(id);
      fetchPolicies();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await adminApi.deletePolicy(id);
      fetchPolicies();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height={40} style={{ borderRadius: 12 }} />
        <Skeleton height={300} style={{ borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
            <FileText size={18} className="text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">약관 및 정책 관리</h2>
            <p className="text-xs text-slate-500">이용약관, 개인정보처리방침 등을 관리합니다</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchPolicies}
            className="admin-btn-secondary"
          >
            <RefreshCw size={14} />
            새로고침
          </button>
          <button type="button" onClick={handleCreate} className="admin-btn-primary">
            <Plus size={14} />
            새 정책 등록
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="admin-table-card">
        <table className="table w-full">
          <thead>
            <tr>
              <th>유형</th>
              <th>제목</th>
              <th>버전</th>
              <th>상태</th>
              <th>등록일</th>
              <th style={{ textAlign: 'right' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-grey-500)' }}>
                  등록된 정책이 없습니다
                </td>
              </tr>
            ) : (
              policies.map(policy => (
                <tr key={policy.id}>
                  <td>
                    <span className="admin-badge blue">
                      {POLICY_TYPES.find(t => t.value === policy.type)?.label || policy.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--color-grey-900)' }}>{policy.title}</td>
                  <td style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, color: 'var(--color-grey-500)' }}>{policy.version}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {policy.isCurrent && (
                        <span className="admin-badge blue" style={{ fontWeight: 600 }}>현재 버전</span>
                      )}
                      {policy.isActive ? (
                        <span className="admin-badge green">활성</span>
                      ) : (
                        <span className="admin-badge gray">비활성</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-grey-500)' }}>
                    {new Date(policy.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      {!policy.isCurrent && (
                        <button
                          type="button"
                          className="admin-row-action-btn"
                          onClick={() => handleSetCurrent(policy.id)}
                          title="현재 버전으로 설정"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-row-action-btn"
                        onClick={() => handleEdit(policy)}
                        title="수정"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-row-action-btn"
                        onClick={() => handleDelete(policy.id)}
                        title="삭제"
                        style={{ color: 'var(--color-error)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPolicy ? '정책 수정' : '새 정책 등록'}
        size="large"
        footer={
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button variant="secondary" fullWidth onClick={() => setIsModalOpen(false)}>취소</Button>
            <Button variant="primary" fullWidth onClick={handleSubmit} isLoading={saving} disabled={!form.title || !form.content}>
              저장
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="admin-stat-label" style={{ marginBottom: 6, display: 'block' }}>유형</label>
              <select
                className="admin-filter-select"
                style={{ width: '100%' }}
                value={form.type}
                onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
              >
                {POLICY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-stat-label" style={{ marginBottom: 6, display: 'block' }}>버전</label>
              <input
                className="admin-search-input"
                style={{ width: '100%' }}
                value={form.version}
                onChange={e => setForm(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0"
              />
            </div>
          </div>

          <div>
            <label className="admin-stat-label" style={{ marginBottom: 6, display: 'block' }}>제목</label>
            <input
              className="admin-search-input"
              style={{ width: '100%' }}
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="정책 제목"
            />
          </div>

          <div>
            <label className="admin-stat-label" style={{ marginBottom: 6, display: 'block' }}>내용 (Markdown 지원)</label>
            <textarea
              style={{
                width: '100%',
                minHeight: 250,
                padding: '10px 14px',
                border: '1px solid var(--color-grey-200)',
                borderRadius: 10,
                fontSize: 13,
                fontFamily: 'var(--font-family-mono)',
                resize: 'vertical',
                lineHeight: 1.6,
              }}
              value={form.content}
              onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="# 약관 내용..."
            />
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isCurrent}
                onChange={e => setForm(prev => ({ ...prev, isCurrent: e.target.checked }))}
              />
              현재 버전으로 설정
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
              />
              활성화
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PoliciesTab;
