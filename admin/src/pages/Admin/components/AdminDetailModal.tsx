/**
 * @file AdminDetailModal.tsx
 * @description 어드민 상세/편집 모달 공통 컴포넌트
 *
 * 사용법:
 *   <AdminDetailModal isOpen={...} onClose={...} title="주문 상세" loading={loading}>
 *     <AdminDetailModal.Section title="고객 정보">
 *       <AdminDetailModal.InfoRow label="이름" value={order.name} />
 *       <AdminDetailModal.InfoRow label="이메일" value={order.email} />
 *     </AdminDetailModal.Section>
 *     <AdminDetailModal.ActionBar>
 *       <Button variant="ghost" onClick={onClose}>닫기</Button>
 *     </AdminDetailModal.ActionBar>
 *   </AdminDetailModal>
 */
import React from 'react';
import { Modal, Badge, Loader } from '../../../design-system';
import styles from './AdminDetailModal.module.css';

// ─── Main Modal ──────────────────────────────────────

interface AdminDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  loading?: boolean;
  children: React.ReactNode;
  width?: string;
}

function AdminDetailModal({ isOpen, onClose, title, loading, children, width }: AdminDetailModalProps) {
  // children에서 ActionBar를 분리하여 Modal footer 슬롯으로 전달
  // → 콘텐츠가 길어도 ActionBar(닫기 버튼 등)가 항상 화면 하단에 고정됨
  const childArray = React.Children.toArray(children);
  const actionBar = childArray.find(
    (child) => React.isValidElement(child) && child.type === ActionBar,
  );
  const bodyChildren = childArray.filter(
    (child) => !(React.isValidElement(child) && child.type === ActionBar),
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={actionBar || undefined}>
      <div style={width ? { width } : undefined}>
        {loading ? (
          <div role="status" aria-busy="true" className={styles.loadingWrapper}>
            <Loader size="medium" label="불러오는 중..." />
          </div>
        ) : (
          <div className={styles.contentWrapper}>
            {bodyChildren}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Section ─────────────────────────────────────────

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'highlight' | 'error';
}

const sectionVariantMap = {
  default: styles.sectionDefault,
  highlight: styles.sectionHighlight,
  error: styles.sectionError,
} as const;

function Section({ title, icon, children, variant = 'default' }: SectionProps) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>
        {icon}
        {title}
      </h4>
      <div className={`${styles.sectionBody} ${sectionVariantMap[variant]}`}>
        {children}
      </div>
    </div>
  );
}

// ─── InfoGrid (2-column) ─────────────────────────────

interface InfoGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}

const gridColumnMap = {
  1: styles.infoGrid1,
  2: styles.infoGrid2,
  3: styles.infoGrid3,
} as const;

function InfoGrid({ children, columns = 2 }: InfoGridProps) {
  return (
    <div className={`${styles.infoGrid} ${gridColumnMap[columns]}`}>
      {children}
    </div>
  );
}

// ─── InfoRow ─────────────────────────────────────────

interface InfoRowProps {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  fullWidth?: boolean;
}

function InfoRow({ label, value, mono, fullWidth }: InfoRowProps) {
  const valueClasses = [
    styles.infoValue,
    value == null ? styles.infoValueEmpty : '',
    mono ? styles.infoValueMono : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`${styles.infoRow} ${fullWidth ? styles.infoRowFull : ''}`}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={valueClasses}>
        {value != null ? value : '—'}
      </span>
    </div>
  );
}

// ─── StatusRow ───────────────────────────────────────

interface StatusRowProps {
  label: string;
  status: string;
  color: string;
}

function StatusRow({ label, status, color }: StatusRowProps) {
  return (
    <div className={styles.statusRow}>
      <span className={styles.statusLabel}>{label}</span>
      <Badge color={color as any} variant="weak">{status}</Badge>
    </div>
  );
}

// ─── Timeline ────────────────────────────────────────

interface TimelineItem {
  label: string;
  date?: string | null;
  active?: boolean;
}

interface TimelineProps {
  items: TimelineItem[];
}

function Timeline({ items }: TimelineProps) {
  return (
    <div className={styles.timeline}>
      {items.map((item, i) => (
        <div key={i} className={styles.timelineItem}>
          <div className={`${styles.timelineDot} ${item.date ? styles.timelineDotActive : styles.timelineDotInactive}`} />
          <div>
            <span className={`${styles.timelineLabel} ${!item.date ? styles.timelineLabelInactive : ''} ${item.active ? styles.timelineLabelBold : ''}`}>
              {item.label}
            </span>
            {item.date && (
              <div className={styles.timelineDate}>{item.date}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────

function Divider() {
  return <hr className={styles.divider} />;
}

// ─── ActionBar ───────────────────────────────────────

interface ActionBarProps {
  children: React.ReactNode;
}

function ActionBar({ children }: ActionBarProps) {
  return (
    <div className={styles.actionBar}>
      {children}
    </div>
  );
}

// ─── Compound Export ─────────────────────────────────

AdminDetailModal.Section = Section;
AdminDetailModal.InfoGrid = InfoGrid;
AdminDetailModal.InfoRow = InfoRow;
AdminDetailModal.StatusRow = StatusRow;
AdminDetailModal.Timeline = Timeline;
AdminDetailModal.Divider = Divider;
AdminDetailModal.ActionBar = ActionBar;

export default AdminDetailModal;
