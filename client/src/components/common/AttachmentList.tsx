import React, { useState, useEffect } from 'react';
import { contentAttachmentApi, type ContentAttachment } from '../../api/manual';

// =====================
// Types
// =====================

export interface AttachmentListProps {
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

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

function isImageType(fileType: string): boolean {
  return IMAGE_MIME_TYPES.has(fileType.toLowerCase());
}

function getAttachmentUrl(id: number): string {
  return `/api/v1/attachments/${id}`;
}

// =====================
// Component
// =====================

const AttachmentList: React.FC<AttachmentListProps> = ({ targetType, targetId }) => {
  const [attachments, setAttachments] = useState<ContentAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchList = async () => {
      setLoading(true);
      try {
        const list = await contentAttachmentApi.getList(targetType, targetId);
        if (!cancelled) setAttachments(list);
      } catch {
        // silently fail — attachments are supplementary content
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchList();

    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  // Don't render anything while loading or when there are no attachments
  if (loading || attachments.length === 0) return null;

  const imageAttachments = attachments.filter((a) => isImageType(a.fileType));
  const fileAttachments = attachments.filter((a) => !isImageType(a.fileType));

  return (
    <div className="attachment-list" style={{ marginTop: '16px' }}>
      {imageAttachments.length > 0 && (
        <div className="attachment-list__images" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {imageAttachments.map((att) => (
            <figure key={att.id} style={{ margin: 0 }}>
              <img
                src={getAttachmentUrl(att.id)}
                alt={att.fileName}
                style={{
                  maxWidth: '100%',
                  borderRadius: '8px',
                  display: 'block',
                }}
                loading="lazy"
                decoding="async"
              />
              <figcaption
                style={{
                  fontSize: '11px',
                  color: 'var(--color-neutral-400, #b0b8c1)',
                  marginTop: '4px',
                }}
              >
                {att.fileName}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {fileAttachments.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: imageAttachments.length > 0 ? '12px 0 0' : '0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
          aria-label="첨부 파일"
        >
          {fileAttachments.map((att) => (
            <li key={att.id}>
              <a
                href={getAttachmentUrl(att.id)}
                download={att.fileName}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  color: 'var(--color-primary, #3182F6)',
                  textDecoration: 'none',
                  padding: '4px 0',
                }}
              >
                <span aria-hidden="true">📎</span>
                <span>{att.fileName}</span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-neutral-400, #b0b8c1)',
                  }}
                >
                  ({formatFileSize(att.fileSize)})
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AttachmentList;
