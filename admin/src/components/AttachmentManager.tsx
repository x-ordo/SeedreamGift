import React, { useState, useEffect, useRef, useCallback } from 'react';
import { adminApi } from '../api';
import { COLORS, SPACING, RADIUS } from '../constants/designTokens';
import { ConfirmModal } from '../pages/Admin/components/ConfirmModal';

// =====================
// Types
// =====================

interface Attachment {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export interface AttachmentManagerProps {
  targetType: 'NOTICE' | 'EVENT' | 'INQUIRY';
  targetId: number;
}

// =====================
// Helpers
// =====================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);

function isImageType(fileType: string): boolean {
  return IMAGE_TYPES.has(fileType.toLowerCase());
}

function getAttachmentUrl(id: number): string {
  return `/api/v1/attachments/${id}`;
}

function getFileIcon(fileType: string): string {
  if (isImageType(fileType)) return '🖼';
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileType.includes('xlsx')) return '📊';
  if (fileType.includes('word') || fileType.includes('docx') || fileType.includes('document')) return '📝';
  return '📎';
}

// =====================
// Component
// =====================

const AttachmentManager: React.FC<AttachmentManagerProps> = ({ targetType, targetId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ open: boolean; id: number; name: string }>({ open: false, id: 0, name: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    if (targetId <= 0) return;
    setLoading(true);
    try {
      const data = await adminApi.getAttachments(targetType, targetId);
      const list = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
      setAttachments(list);
    } catch {
      // silently fail — admin can retry
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetType', targetType);
    formData.append('targetId', String(targetId));

    setUploading(true);
    try {
      await adminApi.uploadAttachment(formData);
      await fetchAttachments();
    } catch {
      // fall through — user will see the list unchanged
    } finally {
      setUploading(false);
      // reset so same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    try {
      await adminApi.deleteAttachment(deleteTarget.id);
      setAttachments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch {
      // silently fail
    } finally {
      setDeleteTarget({ open: false, id: 0, name: '' });
    }
  };

  if (targetId <= 0) return null;

  return (
    <div style={{ borderTop: `1px solid ${COLORS.grey200}`, paddingTop: SPACING[3] }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: SPACING[2],
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.grey700 }}>
          첨부 파일 {attachments.length > 0 ? `(${attachments.length})` : ''}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2] }}>
          {uploading && (
            <span style={{ fontSize: '12px', color: COLORS.grey500 }}>업로드 중...</span>
          )}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              color: uploading ? COLORS.grey400 : COLORS.primary,
              border: `1px solid ${uploading ? COLORS.grey300 : COLORS.primary}`,
              borderRadius: RADIUS.sm,
              cursor: uploading ? 'not-allowed' : 'pointer',
              background: 'transparent',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            <span aria-hidden="true">+</span>
            파일 추가
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.xlsx,.docx"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={uploading}
              aria-label="첨부 파일 선택"
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div
          style={{ fontSize: '12px', color: COLORS.grey400, padding: `${SPACING[2]} 0` }}
          role="status"
          aria-busy="true"
        >
          불러오는 중...
        </div>
      ) : attachments.length === 0 ? (
        <div
          style={{
            fontSize: '13px',
            color: COLORS.grey400,
            padding: `${SPACING[3]} 0`,
            textAlign: 'center',
          }}
        >
          첨부 파일이 없습니다
        </div>
      ) : (
        <ul
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: SPACING[2] }}
          aria-label="첨부 파일 목록"
        >
          {attachments.map((att) => (
            <li
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: SPACING[2],
                padding: SPACING[2],
                background: COLORS.grey50,
                borderRadius: RADIUS.sm,
                border: `1px solid ${COLORS.grey200}`,
              }}
            >
              {isImageType(att.fileType) ? (
                <div style={{ flex: '0 0 auto' }}>
                  <img
                    src={getAttachmentUrl(att.id)}
                    alt={att.fileName}
                    style={{
                      width: '64px',
                      height: '64px',
                      objectFit: 'cover',
                      borderRadius: RADIUS.xs,
                      display: 'block',
                    }}
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <span style={{ fontSize: '24px', flex: '0 0 auto', lineHeight: 1 }} aria-hidden="true">
                  {getFileIcon(att.fileType)}
                </span>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: COLORS.grey800,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={att.fileName}
                >
                  {att.fileName}
                </div>
                <div style={{ fontSize: '11px', color: COLORS.grey400, marginTop: '2px' }}>
                  {formatFileSize(att.fileSize)}
                  {' · '}
                  {new Date(att.createdAt).toLocaleDateString('ko-KR')}
                </div>

                {!isImageType(att.fileType) && (
                  <a
                    href={getAttachmentUrl(att.id)}
                    download={att.fileName}
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      fontSize: '11px',
                      color: COLORS.primary,
                      textDecoration: 'none',
                    }}
                  >
                    다운로드
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDeleteTarget({ open: true, id: att.id, name: att.fileName })}
                aria-label={`${att.fileName} 삭제`}
                style={{
                  flex: '0 0 auto',
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  color: COLORS.grey400,
                  fontSize: '16px',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.error; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.grey400; }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        isOpen={deleteTarget.open}
        onClose={() => setDeleteTarget({ open: false, id: 0, name: '' })}
        onConfirm={handleDelete}
        title="첨부파일 삭제"
        confirmLabel="삭제"
        danger
      >
        <p style={{ fontSize: '14px', color: 'var(--color-grey-700)' }}>
          &ldquo;{deleteTarget.name}&rdquo; 파일을 삭제하시겠습니까?
        </p>
      </ConfirmModal>
    </div>
  );
};

export default AttachmentManager;
