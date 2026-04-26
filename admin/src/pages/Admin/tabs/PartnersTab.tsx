import { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Briefcase } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Badge, Modal } from '../../../design-system';
import { AdminTable, Column } from '../../../components/admin';
import { ConfirmModal } from '../components/ConfirmModal';
import AdminDetailModal from '../components/AdminDetailModal';
import { formatPrice, maskEmail, formatRelativeTime } from '../../../utils';
import { formatDateTime } from '../../../utils/dateUtils';
import { COLORS, SPACING } from '../../../constants/designTokens';
import {
  ADMIN_PAGINATION,
  APPROVAL_STATUS_OPTIONS,
  APPROVAL_STATUS_COLOR_MAP,
  BRAND_LABEL_MAP,
  SETTLEMENT_FREQUENCY_OPTIONS,
} from '../constants';
import { useAdminList, useCheckboxSelect } from '../hooks';

// ─── Types ──────────────────────────────────────────

interface Partner {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
  lockedUntil?: string | null;
  lockedReason?: string | null;
  _count?: {
    orders?: number;
    tradeIns?: number;
  };
}

interface PendingProduct {
  id: number;
  name: string;
  brandCode: string;
  price: number;
  buyPrice: number;
  discountRate: number;
  partnerId?: number | null;
  partnerName?: string | null;
  approvalStatus?: string;
  createdAt: string;
}

interface PartnerDetail {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  partnerTier?: string | null;
  commissionRate?: number | null;
  payoutFrequency?: string | null;
  dailyPinLimit?: number | null;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    orders?: number;
    tradeIns?: number;
    sentGifts?: number;
    receivedGifts?: number;
  };
}

interface PartnerProducts {
  items: PendingProduct[];
  meta?: { total?: number };
}

// ─── Partner Document Types ──────────────────────────

interface PartnerDocument {
  id: number;
  fileName: string;
  category: string;
  note?: string;
  fileSize?: number;
  createdAt: string;
}

const DOCUMENT_CATEGORY_OPTIONS = [
  { value: '사업자등록증', label: '사업자등록증' },
  { value: '신분증', label: '신분증' },
  { value: '통장사본', label: '통장사본' },
  { value: '위임장', label: '위임장' },
  { value: '계약서', label: '계약서' },
  { value: '기타', label: '기타' },
];

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

// ─── PartnerDocumentSection ───────────────────────────

interface PartnerDocumentSectionProps {
  partnerId: number;
}

const PartnerDocumentSection: React.FC<PartnerDocumentSectionProps> = ({ partnerId }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<PartnerDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('사업자등록증');
  const [uploadNote, setUploadNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await adminApi.getPartnerDocuments(partnerId);
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      setDocs(items);
    } catch {
      // non-critical
    } finally {
      setDocsLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast({ message: '파일을 선택해주세요.', type: 'error' });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('partnerId', String(partnerId));
      formData.append('category', uploadCategory);
      if (uploadNote.trim()) formData.append('note', uploadNote.trim());
      await adminApi.uploadPartnerDocument(formData);
      showToast({ message: '문서가 업로드되었습니다.', type: 'success' });
      setSelectedFile(null);
      setUploadNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadDocs();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '문서 업로드에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: PartnerDocument) => {
    try {
      const res = await adminApi.downloadPartnerDocument(doc.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast({ message: '다운로드에 실패했습니다.', type: 'error' });
    }
  };

  const handleDeleteDoc = async () => {
    setDocDeleting(true);
    try {
      await adminApi.deletePartnerDocument(docDeleteTarget.id);
      showToast({ message: '문서가 삭제되었습니다.', type: 'success' });
      loadDocs();
    } catch {
      showToast({ message: '문서 삭제에 실패했습니다.', type: 'error' });
    } finally {
      setDocDeleteTarget({ open: false, id: 0, name: '' });
      setDocDeleting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: '6px',
    border: `1px solid ${COLORS.grey200}`, fontSize: '13px', boxSizing: 'border-box',
  };

  return (
    <div>
      {/* Upload form */}
      <div style={{
        background: COLORS.grey50, borderRadius: 'var(--radius-sm)', padding: '12px',
        marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
      }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: COLORS.grey600, display: 'block', marginBottom: '4px' }}>
            파일 선택 *
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            style={{ fontSize: '12px', width: '100%' }}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: COLORS.grey600, display: 'block', marginBottom: '4px' }}>
            카테고리
          </label>
          <select
            style={inputStyle}
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
          >
            {DOCUMENT_CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: COLORS.grey600, display: 'block', marginBottom: '4px' }}>
            메모 (선택)
          </label>
          <input
            type="text"
            style={inputStyle}
            value={uploadNote}
            onChange={(e) => setUploadNote(e.target.value)}
            placeholder="문서에 대한 메모를 입력하세요"
            maxLength={200}
          />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            size="sm"
            onClick={handleUpload}
            loading={uploading}
            disabled={!selectedFile}
            type="button"
          >
            업로드
          </Button>
        </div>
      </div>

      {/* Document list */}
      {docsLoading ? (
        <div style={{ textAlign: 'center', padding: '16px', color: COLORS.grey400, fontSize: '13px' }}>불러오는 중...</div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px', color: COLORS.grey400, fontSize: '13px' }}>등록된 문서가 없습니다.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <caption className="sr-only">파트너 문서 목록</caption>
            <thead>
              <tr style={{ background: COLORS.grey50 }}>
                <th scope="col" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>파일명</th>
                <th scope="col" style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 500 }}>카테고리</th>
                <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>크기</th>
                <th scope="col" style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 500 }}>등록일</th>
                <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} style={{ borderTop: `1px solid ${COLORS.grey100}` }}>
                  <td style={{ padding: '6px 8px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={doc.fileName}>
                    {doc.fileName}
                    {doc.note && <span style={{ display: 'block', fontSize: '11px', color: COLORS.grey400 }}>{doc.note}</span>}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <Badge color="blue" variant="weak" size="xsmall">{doc.category}</Badge>
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: COLORS.grey500 }}>{formatFileSize(doc.fileSize)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', color: COLORS.grey500 }}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" type="button" onClick={() => handleDownload(doc)}>다운로드</Button>
                      <Button variant="ghost" size="sm" type="button" style={{ color: COLORS.error }} onClick={() => setDocDeleteTarget({ open: true, id: doc.id, name: doc.fileName })}>삭제</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Component ──────────────────────────────────────

const PartnersTab = () => {
  const { showToast } = useToast();

  // --- Partner list ---
  const { items: partners, loading: partnersLoading, page, total, setPage, reload: reloadPartners } = useAdminList<Partner>(
    (params) => adminApi.getAllUsers({ ...params, role: 'PARTNER' }),
    {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      errorMessage: '파트너 목록을 불러오는데 실패했습니다.',
    },
  );

  // --- Pending products queue ---
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(0);

  const loadPendingProducts = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await adminApi.getAllProducts({ page: 1, limit: 50, approvalStatus: 'PENDING' } as any);
      const items = res?.items ?? [];
      setPendingProducts(items);
      setPendingTotal(res?.meta?.total ?? items.length);
    } catch {
      // non-critical
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => { loadPendingProducts(); }, [loadPendingProducts]);

  // --- Stats ---
  const [stats, setStats] = useState<{ partnerCount: number; partnerProducts: number }>({
    partnerCount: 0, partnerProducts: 0,
  });

  useEffect(() => {
    setStats({
      partnerCount: total,
      partnerProducts: pendingTotal,
    });
  }, [total, pendingTotal]);

  // --- Checkbox selection for pending products ---
  const checkbox = useCheckboxSelect<PendingProduct>(pendingProducts, (p) => p.id);

  // --- Approval ---
  const [approveConfirm, setApproveConfirm] = useState<{ open: boolean; productId: number; productName: string }>({
    open: false, productId: 0, productName: '',
  });
  const [partnerRejecting, setPartnerRejecting] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; productId: number; productName: string; reason: string }>({
    open: false, productId: 0, productName: '', reason: '',
  });
  const [bulkApproving, setBulkApproving] = useState(false);

  const handleApprove = async () => {
    const { productId } = approveConfirm;
    try {
      await adminApi.approveProduct(productId, 'APPROVED');
      showToast({ message: '상품이 승인되었습니다.', type: 'success' });
      loadPendingProducts();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상품 승인에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setApproveConfirm({ open: false, productId: 0, productName: '' });
    }
  };

  const handleReject = async () => {
    const { productId, reason } = rejectModal;
    if (!reason.trim()) {
      showToast({ message: '거절 사유를 입력해주세요.', type: 'error' });
      return;
    }
    setPartnerRejecting(true);
    try {
      await adminApi.approveProduct(productId, 'REJECTED', reason.trim());
      showToast({ message: '상품이 거절되었습니다.', type: 'success' });
      loadPendingProducts();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '상품 거절에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setRejectModal({ open: false, productId: 0, productName: '', reason: '' });
      setPartnerRejecting(false);
    }
  };

  const handleBulkApprove = async () => {
    const selected = checkbox.getSelectedItems(pendingProducts);
    if (selected.length === 0) return;
    setBulkApproving(true);
    let successCount = 0;
    let failCount = 0;
    for (const product of selected) {
      try {
        await adminApi.approveProduct(product.id, 'APPROVED');
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) {
      showToast({ message: `${successCount}건 승인 완료${failCount > 0 ? `, ${failCount}건 실패` : ''}`, type: successCount > 0 ? 'success' : 'error' });
    }
    checkbox.clearSelection();
    loadPendingProducts();
    setBulkApproving(false);
  };

  // --- Partner detail modal ---
  const [detailModal, setDetailModal] = useState<{ open: boolean; loading: boolean; partner: PartnerDetail | null; products: PendingProduct[] }>({
    open: false, loading: false, partner: null, products: [],
  });

  const openPartnerDetail = async (partner: Partner) => {
    setDetailModal({ open: true, loading: true, partner: null, products: [] });
    try {
      const [detail, productsRes] = await Promise.all([
        adminApi.getUser(partner.id),
        adminApi.getAllProducts({ page: 1, limit: 20, partnerId: partner.id } as any),
      ]);
      setDetailModal({
        open: true,
        loading: false,
        partner: detail,
        products: productsRes?.items ?? [],
      });
    } catch {
      showToast({ message: '파트너 정보를 불러오는데 실패했습니다.', type: 'error' });
      setDetailModal({ open: false, loading: false, partner: null, products: [] });
    }
  };

  const closeDetailModal = () => {
    setDetailModal({ open: false, loading: false, partner: null, products: [] });
  };

  const handleLockUnlock = async (partnerId: number, isLocked: boolean) => {
    try {
      if (isLocked) {
        await adminApi.unlockUser(partnerId);
        showToast({ message: '계정 잠금이 해제되었습니다.', type: 'success' });
      } else {
        const until = new Date();
        until.setFullYear(until.getFullYear() + 1);
        await adminApi.lockUser(partnerId, until.toISOString(), '관리자 파트너 관리에서 잠금');
        showToast({ message: '계정이 잠금되었습니다.', type: 'success' });
      }
      reloadPartners();
      closeDetailModal();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '작업에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    }
  };

  const [demoteConfirm, setDemoteConfirm] = useState<{ open: boolean; partnerId: number; partnerName: string }>({
    open: false, partnerId: 0, partnerName: '',
  });

  const handleDemotePartner = async () => {
    const { partnerId } = demoteConfirm;
    try {
      await adminApi.updateUserRole(partnerId, 'USER');
      showToast({ message: '파트너가 해제되었습니다.', type: 'success' });
      reloadPartners();
      closeDetailModal();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '파트너 해제에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setDemoteConfirm({ open: false, partnerId: 0, partnerName: '' });
    }
  };

  // --- Partner config ---
  const [partnerConfig, setPartnerConfig] = useState<{
    commissionRate: string;
    payoutFrequency: string;
    dailyPinLimit: string;
  }>({ commissionRate: '', payoutFrequency: '', dailyPinLimit: '' });
  const [configSaving, setConfigSaving] = useState(false);

  // Sync partner config when detail modal opens
  useEffect(() => {
    if (detailModal.partner) {
      setPartnerConfig({
        commissionRate: detailModal.partner.commissionRate != null ? String(detailModal.partner.commissionRate) : '',
        payoutFrequency: detailModal.partner.payoutFrequency || '',
        dailyPinLimit: detailModal.partner.dailyPinLimit != null ? String(detailModal.partner.dailyPinLimit) : '',
      });
    }
  }, [detailModal.partner]);

  const handleSavePartnerConfig = async () => {
    if (!detailModal.partner) return;
    setConfigSaving(true);
    try {
      const partnerId = detailModal.partner.id;
      const promises: Promise<any>[] = [];

      if (partnerConfig.commissionRate !== '') {
        promises.push(adminApi.setPartnerCommission(partnerId, Number(partnerConfig.commissionRate)));
      }
      if (partnerConfig.payoutFrequency !== '') {
        promises.push(adminApi.setPartnerPayoutFrequency(partnerId, partnerConfig.payoutFrequency));
      }
      if (partnerConfig.dailyPinLimit !== '') {
        promises.push(adminApi.setPartnerLimits(partnerId, Number(partnerConfig.dailyPinLimit)));
      }

      await Promise.all(promises);
      showToast({ message: '파트너 설정이 저장되었습니다.', type: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || '파트너 설정 저장에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setConfigSaving(false);
    }
  };

  // --- Document Delete ---
  const [docDeleteTarget, setDocDeleteTarget] = useState<{ open: boolean; id: number; name: string }>({ open: false, id: 0, name: '' });
  const [docDeleting, setDocDeleting] = useState(false);

  // --- Business Info ---
  const [bizInfos, setBizInfos] = useState<any[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [bizVerifying, setBizVerifying] = useState(false);
  const [bizDeleting, setBizDeleting] = useState(false);
  const [bizVerifyModal, setBizVerifyModal] = useState<{ open: boolean; id: number; verified: boolean }>({
    open: false, id: 0, verified: false,
  });
  const [bizDeleteModal, setBizDeleteModal] = useState<{ open: boolean; id: number }>({
    open: false, id: 0,
  });

  const loadBusinessInfos = useCallback(async () => {
    setBizLoading(true);
    try {
      const data = await adminApi.getAllPartnerBusinessInfos();
      setBizInfos(Array.isArray(data) ? data : data?.items ?? []);
    } catch {
      showToast({ message: '사업자 정보 로드 실패', type: 'error' });
    } finally {
      setBizLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadBusinessInfos(); }, [loadBusinessInfos]);

  const handleBizVerify = async () => {
    setBizVerifying(true);
    try {
      await adminApi.verifyPartnerBusinessInfo(bizVerifyModal.id, { verified: true });
      showToast({ message: '사업자 정보가 검증되었습니다.', type: 'success' });
      loadBusinessInfos();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '사업자 정보 검증에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setBizVerifyModal({ open: false, id: 0, verified: false });
      setBizVerifying(false);
    }
  };

  const handleBizDelete = async () => {
    setBizDeleting(true);
    try {
      await adminApi.deletePartnerBusinessInfo(bizDeleteModal.id);
      showToast({ message: '사업자 정보가 삭제되었습니다.', type: 'success' });
      loadBusinessInfos();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '사업자 정보 삭제에 실패했습니다.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setBizDeleteModal({ open: false, id: 0 });
      setBizDeleting(false);
    }
  };

  // --- Helpers ---
  const isUserLocked = (u: Partner) => u.lockedUntil && new Date(u.lockedUntil) > new Date();

  const getApprovalLabel = (status?: string) =>
    APPROVAL_STATUS_OPTIONS.find(o => o.value === status)?.label || status || '-';

  /** Mask account number: show first 4 + last 2, mask middle */
  const maskAccountNumber = (acc?: string) => {
    if (!acc || acc.length <= 6) return acc || '--';
    return acc.slice(0, 4) + '*'.repeat(acc.length - 6) + acc.slice(-2);
  };

  // ─── Partner list columns ──────────────────────────

  const partnerColumns: Column<Partner>[] = [
    {
      key: 'name', header: '이름',
      render: (p) => (
        <div>
          <button
            type="button"
            className="admin-user-name"
            onClick={() => openPartnerDetail(p)}
            style={{ fontWeight: 600, cursor: 'pointer', color: COLORS.primary, background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left' }}
          >
            {p.name || 'N/A'}
          </button>
          <div className="admin-sub-text" title={p.email}>{maskEmail(p.email)}</div>
        </div>
      )
    },
    { key: 'phone', header: '연락처' },
    {
      key: 'createdAt', header: '가입일',
      render: (p) => (
        <div>
          <div>{new Date(p.createdAt).toLocaleDateString()}</div>
          <div className="admin-sub-text">{formatRelativeTime(p.createdAt)}</div>
        </div>
      )
    },
    {
      key: 'status', header: '상태',
      render: (p) => isUserLocked(p)
        ? <Badge color="red" variant="weak" size="small">잠금</Badge>
        : <Badge color="green" variant="weak" size="small">활성</Badge>
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (p) => (
        <div className="admin-actions">
          <Button variant="ghost" size="sm" onClick={() => openPartnerDetail(p)}>상세</Button>
        </div>
      )
    },
  ];

  // ─── Pending products columns ─────────────────────

  const pendingColumns: Column<PendingProduct>[] = [
    {
      key: 'select', header: (
        <input
          type="checkbox"
          checked={checkbox.allSelected}
          onChange={checkbox.toggleSelectAll}
          aria-label="전체 선택"
        />
      ) as any,
      render: (p) => (
        <input
          type="checkbox"
          checked={checkbox.selectedIds.has(p.id)}
          onChange={() => checkbox.toggleSelect(p.id)}
          aria-label={`${p.name} 선택`}
        />
      ),
    },
    {
      key: 'name', header: '상품명',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 500 }}>{p.name}</div>
          <div className="admin-sub-text">
            {BRAND_LABEL_MAP.get(p.brandCode as any) || p.brandCode}
          </div>
        </div>
      )
    },
    {
      key: 'partner', header: '파트너',
      render: (p) => p.partnerName
        ? <Badge color="teal" variant="weak" size="small">{p.partnerName}</Badge>
        : <span style={{ color: COLORS.grey400, fontSize: '12px' }}>P#{p.partnerId}</span>
    },
    { key: 'price', header: '액면가', align: 'right', render: (p) => formatPrice(Number(p.price)) },
    {
      key: 'buyPrice', header: '판매가', align: 'right',
      render: (p) => (
        <div>
          <span style={{ color: COLORS.error, fontWeight: 600 }}>{formatPrice(Number(p.buyPrice))}</span>
          <span style={{ fontSize: '11px', color: COLORS.grey500, marginLeft: '4px' }}>({p.discountRate}%)</span>
        </div>
      )
    },
    {
      key: 'createdAt', header: '등록일',
      render: (p) => new Date(p.createdAt).toLocaleDateString()
    },
    {
      key: 'actions', header: '작업', align: 'right',
      render: (p) => (
        <div className="admin-actions">
          <Button variant="success" size="sm" onClick={() => setApproveConfirm({ open: true, productId: p.id, productName: p.name })}>승인</Button>
          <Button variant="danger" size="sm" onClick={() => setRejectModal({ open: true, productId: p.id, productName: p.name, reason: '' })}>거절</Button>
        </div>
      )
    },
  ];

  return (
    <div className="admin-tab">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">파트너 관리</h2>
          <p className="admin-page-desc">파트너 회원과 상품 승인을 관리합니다</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <span className="admin-stat-label">총 파트너</span>
          <span className="admin-stat-value">{stats.partnerCount}</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">승인 대기 상품</span>
          <span className="admin-stat-value" style={{ color: pendingTotal > 0 ? COLORS.error : undefined }}>
            {pendingTotal}
          </span>
        </div>
      </div>

      {/* Pending Approval Banner */}
      {pendingTotal > 0 && (
        <div className="admin-alert warning" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} aria-hidden="true" />
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-grey-800)' }}>
            승인 대기 파트너 상품 <strong>{pendingTotal}건</strong>이 있습니다.
          </span>
        </div>
      )}

      {/* ── Partner List ── */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.grey900, marginBottom: 'var(--space-3)' }}>
          파트너 목록
        </h3>
        <div className="admin-table-card">
          <AdminTable
            columns={partnerColumns}
            data={partners}
            keyField="id"
            isLoading={partnersLoading}
            pagination={{
              currentPage: page,
              totalItems: total,
              itemsPerPage: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
              onPageChange: setPage,
            }}
            emptyMessage="등록된 파트너가 없습니다."
            caption="파트너 목록"
          />
        </div>
      </div>

      {/* ── Pending Approval Queue ── */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.grey900, marginBottom: 'var(--space-3)' }}>
          승인 대기 상품
        </h3>

        {/* Bulk action bar */}
        {checkbox.selectedIds.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-blue-50, #EBF5FF)',
            borderRadius: 'var(--radius-sm, 8px)',
            marginBottom: 'var(--space-3)',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: COLORS.grey700 }}>
              {checkbox.selectedIds.size}건 선택됨
            </span>
            <Button variant="success" size="sm" onClick={handleBulkApprove} loading={bulkApproving}>
              일괄 승인
            </Button>
            <Button variant="ghost" size="sm" onClick={checkbox.clearSelection}>
              선택 해제
            </Button>
          </div>
        )}

        <div className="admin-table-card">
          <AdminTable
            columns={pendingColumns}
            data={pendingProducts}
            keyField="id"
            isLoading={pendingLoading}
            emptyMessage="승인 대기 중인 상품이 없습니다."
            caption="승인 대기 상품 목록"
          />
        </div>
      </div>

      {/* ── Partner Detail Modal ── */}
      <AdminDetailModal
        isOpen={detailModal.open}
        onClose={closeDetailModal}
        title="파트너 상세"
        loading={detailModal.loading}
      >
        {detailModal.partner && (
          <>
            {/* Basic info */}
            <AdminDetailModal.Section title="기본 정보">
              <AdminDetailModal.InfoGrid columns={2}>
                <AdminDetailModal.InfoRow label="이름" value={detailModal.partner.name} />
                <AdminDetailModal.InfoRow label="이메일" value={detailModal.partner.email} />
                <AdminDetailModal.InfoRow label="연락처" value={detailModal.partner.phone || undefined} />
                <AdminDetailModal.InfoRow label="가입일" value={formatDateTime(detailModal.partner.createdAt)} />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            {/* Partner activity */}
            <AdminDetailModal.Section title="파트너 활동">
              <AdminDetailModal.InfoGrid columns={2}>
                <AdminDetailModal.InfoRow label="주문 수" value={`${detailModal.partner._count?.orders ?? 0}건`} />
                <AdminDetailModal.InfoRow label="매입 수" value={`${detailModal.partner._count?.tradeIns ?? 0}건`} />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            {/* Bank info */}
            <AdminDetailModal.Section title="은행 정보">
              <AdminDetailModal.InfoGrid columns={2}>
                <AdminDetailModal.InfoRow label="은행" value={detailModal.partner.bankName || undefined} />
                <AdminDetailModal.InfoRow label="예금주" value={detailModal.partner.accountHolder || undefined} />
                <AdminDetailModal.InfoRow label="계좌번호" value={maskAccountNumber(detailModal.partner.accountNumber)} mono />
              </AdminDetailModal.InfoGrid>
            </AdminDetailModal.Section>

            {/* Document management */}
            <AdminDetailModal.Section title="문서 관리">
              <PartnerDocumentSection partnerId={detailModal.partner.id} />
            </AdminDetailModal.Section>

            {/* Registered products */}
            {detailModal.products.length > 0 && (
              <AdminDetailModal.Section title="등록 상품">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <caption className="sr-only">파트너 등록 상품 목록</caption>
                    <thead>
                      <tr style={{ background: COLORS.grey50 }}>
                        <th scope="col" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>상품명</th>
                        <th scope="col" style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 500 }}>승인</th>
                        <th scope="col" style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500 }}>액면가</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModal.products.map((prod) => {
                        const approvalColor = APPROVAL_STATUS_COLOR_MAP.get(prod.approvalStatus || '') || 'elephant';
                        return (
                          <tr key={prod.id} style={{ borderTop: `1px solid ${COLORS.grey100}` }}>
                            <td style={{ padding: '6px 8px' }}>{prod.name}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <Badge color={approvalColor as any} variant="weak" size="xsmall">
                                {getApprovalLabel(prod.approvalStatus)}
                              </Badge>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatPrice(Number(prod.price))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </AdminDetailModal.Section>
            )}

            {/* Partner Config */}
            <AdminDetailModal.Section title="정산 설정">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: COLORS.grey600, display: 'block', marginBottom: '4px' }}>
                    수수료율 (%)
                  </label>
                  <input
                    type="number"
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: '6px',
                      border: `1px solid ${COLORS.grey200}`, fontSize: '13px',
                    }}
                    value={partnerConfig.commissionRate}
                    onChange={e => setPartnerConfig(prev => ({ ...prev, commissionRate: e.target.value }))}
                    placeholder="전역 설정값 사용"
                    min={0}
                    max={100}
                    step={0.1}
                  />
                  <span style={{ fontSize: '11px', color: COLORS.grey400 }}>비워두면 전역 설정값 적용</span>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: COLORS.grey600, display: 'block', marginBottom: '4px' }}>
                    정산 주기
                  </label>
                  <select
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: '6px',
                      border: `1px solid ${COLORS.grey200}`, fontSize: '13px',
                    }}
                    value={partnerConfig.payoutFrequency}
                    onChange={e => setPartnerConfig(prev => ({ ...prev, payoutFrequency: e.target.value }))}
                  >
                    <option value="">전역 설정값 사용</option>
                    {SETTLEMENT_FREQUENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: COLORS.grey600, display: 'block', marginBottom: '4px' }}>
                    일일 PIN 한도 (개)
                  </label>
                  <input
                    type="number"
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: '6px',
                      border: `1px solid ${COLORS.grey200}`, fontSize: '13px',
                    }}
                    value={partnerConfig.dailyPinLimit}
                    onChange={e => setPartnerConfig(prev => ({ ...prev, dailyPinLimit: e.target.value }))}
                    placeholder="전역 설정값 사용"
                    min={0}
                    step={1}
                  />
                  <span style={{ fontSize: '11px', color: COLORS.grey400 }}>비워두면 전역 설정값 적용</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSavePartnerConfig}
                    loading={configSaving}
                    style={{ width: '100%' }}
                  >
                    설정 저장
                  </Button>
                </div>
              </div>
            </AdminDetailModal.Section>

            <AdminDetailModal.Divider />

            {/* Actions */}
            <AdminDetailModal.Section title="액션">
              <div style={{ display: 'flex', gap: SPACING[2], flexWrap: 'wrap' }}>
                {isUserLocked(detailModal.partner as any) ? (
                  <Button variant="secondary" size="sm" style={{ color: COLORS.warning }} onClick={() => handleLockUnlock(detailModal.partner!.id, true)}>
                    잠금 해제
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => handleLockUnlock(detailModal.partner!.id, false)}>
                    계정 잠금
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDemoteConfirm({
                    open: true,
                    partnerId: detailModal.partner!.id,
                    partnerName: detailModal.partner!.name || detailModal.partner!.email,
                  })}
                >
                  파트너 해제
                </Button>
              </div>
            </AdminDetailModal.Section>

            <AdminDetailModal.ActionBar>
              <Button variant="ghost" onClick={closeDetailModal}>닫기</Button>
            </AdminDetailModal.ActionBar>
          </>
        )}
      </AdminDetailModal>

      {/* ── Approval Confirm Modal ── */}
      <ConfirmModal
        isOpen={approveConfirm.open}
        onClose={() => setApproveConfirm({ open: false, productId: 0, productName: '' })}
        onConfirm={handleApprove}
        title="상품 승인 확인"
        confirmLabel="승인"
      >
        <p>
          <strong>{approveConfirm.productName}</strong> 상품을 승인하시겠습니까?
        </p>
      </ConfirmModal>

      {/* ── Rejection Modal ── */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, productId: 0, productName: '', reason: '' })}
        title="상품 거절"
        size="small"
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-grey-700)' }}>
            <strong>{rejectModal.productName}</strong> 상품을 거절합니다.
          </p>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label className="admin-form-label">거절 사유 *</label>
            <textarea
              className="textarea textarea-bordered w-full resize-y"
              value={rejectModal.reason}
              onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="거절 사유를 입력해주세요"
              rows={3}
              required
            />
          </div>
          <div className="admin-form-footer">
            <Button variant="ghost" type="button" onClick={() => setRejectModal({ open: false, productId: 0, productName: '', reason: '' })} disabled={partnerRejecting}>취소</Button>
            <Button
              variant="danger"
              onClick={handleReject}
              loading={partnerRejecting}
              disabled={!rejectModal.reason.trim() || partnerRejecting}
            >
              거절
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Partner Demote Confirm ── */}
      <ConfirmModal
        isOpen={demoteConfirm.open}
        onClose={() => setDemoteConfirm({ open: false, partnerId: 0, partnerName: '' })}
        onConfirm={handleDemotePartner}
        title="파트너 해제 확인"
        confirmLabel="해제"
        danger
      >
        <p>
          <strong>{demoteConfirm.partnerName}</strong>님을 파트너에서 해제하시겠습니까?
          <br />
          <span style={{ fontSize: '13px', color: 'var(--color-error)' }}>역할이 USER로 변경됩니다.</span>
        </p>
      </ConfirmModal>

      {/* ── 사업자 정보 관리 ── */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 'var(--radius-sm)',
            background: COLORS.grey100,
          }}>
            <Briefcase size={18} style={{ color: COLORS.grey600 }} aria-hidden="true" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.grey900, margin: 0 }}>사업자 정보 관리</h3>
            <p style={{ fontSize: '12px', color: COLORS.grey500, margin: 0 }}>파트너 사업자 등록 정보를 조회하고 검증합니다</p>
          </div>
        </div>

        <div className="admin-table-card">
          {bizLoading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: COLORS.grey400, fontSize: '14px' }}>
              불러오는 중...
            </div>
          ) : bizInfos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: COLORS.grey400, fontSize: '14px' }}>
              등록된 사업자 정보가 없습니다.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <caption className="sr-only">사업자 정보 목록</caption>
                <thead>
                  <tr style={{ background: COLORS.grey50 }}>
                    <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: COLORS.grey700, borderBottom: `1px solid ${COLORS.grey200}` }}>파트너 ID</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: COLORS.grey700, borderBottom: `1px solid ${COLORS.grey200}` }}>상호명</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: COLORS.grey700, borderBottom: `1px solid ${COLORS.grey200}` }}>사업자번호</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: COLORS.grey700, borderBottom: `1px solid ${COLORS.grey200}` }}>대표자</th>
                    <th scope="col" style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: COLORS.grey700, borderBottom: `1px solid ${COLORS.grey200}` }}>검증 상태</th>
                    <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600, color: COLORS.grey700, borderBottom: `1px solid ${COLORS.grey200}` }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {bizInfos.map((biz) => (
                    <tr key={biz.id} style={{ borderTop: `1px solid ${COLORS.grey100}` }}>
                      <td style={{ padding: '10px 12px', color: COLORS.grey500, fontFamily: 'var(--font-family-mono)', fontSize: '12px' }}>
                        #{biz.partnerId ?? biz.userId ?? biz.id}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: COLORS.grey900 }}>
                        {biz.companyName || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-family-mono)', fontSize: '12px', color: COLORS.grey700 }}>
                        {biz.bizNumber || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: COLORS.grey700 }}>
                        {biz.representative || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {biz.verified ? (
                          <Badge color="green" variant="weak" size="small">검증 완료</Badge>
                        ) : (
                          <Badge color="red" variant="weak" size="small">미검증</Badge>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                          {!biz.verified && (
                            <Button
                              variant="success"
                              size="sm"
                              type="button"
                              onClick={() => setBizVerifyModal({ open: true, id: biz.id, verified: biz.verified })}
                            >
                              검증
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            style={{ color: COLORS.error }}
                            onClick={() => setBizDeleteModal({ open: true, id: biz.id })}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── 문서 삭제 확인 ── */}
      <ConfirmModal
        isOpen={docDeleteTarget.open}
        onClose={() => setDocDeleteTarget({ open: false, id: 0, name: '' })}
        onConfirm={handleDeleteDoc}
        title="문서 삭제"
        confirmLabel="삭제"
        danger
        loading={docDeleting}
      >
        <p style={{ fontSize: '14px', color: 'var(--color-grey-700)' }}>
          &ldquo;{docDeleteTarget.name}&rdquo; 문서를 삭제하시겠습니까?
        </p>
      </ConfirmModal>

      {/* ── 사업자 정보 검증 확인 ── */}
      <ConfirmModal
        isOpen={bizVerifyModal.open}
        onClose={() => setBizVerifyModal({ open: false, id: 0, verified: false })}
        onConfirm={handleBizVerify}
        title="사업자 정보 검증"
        confirmLabel="검증"
        loading={bizVerifying}
      >
        <p style={{ fontSize: '14px', color: 'var(--color-grey-700)' }}>
          해당 사업자 정보를 검증 완료 처리하시겠습니까?
        </p>
      </ConfirmModal>

      {/* ── 사업자 정보 삭제 확인 ── */}
      <ConfirmModal
        isOpen={bizDeleteModal.open}
        onClose={() => setBizDeleteModal({ open: false, id: 0 })}
        onConfirm={handleBizDelete}
        title="사업자 정보 삭제"
        confirmLabel="삭제"
        danger
        loading={bizDeleting}
      >
        <p style={{ fontSize: '14px', color: 'var(--color-grey-700)' }}>
          사업자 정보를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
      </ConfirmModal>
    </div>
  );
};

export default PartnersTab;
