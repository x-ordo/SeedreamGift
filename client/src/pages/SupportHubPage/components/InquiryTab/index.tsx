/**
 * @file InquiryTab/index.tsx
 * @description 1:1 문의 탭 — 디자인시스템 컴포넌트 통일
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleUser, LogIn, SquarePen, ChevronDown,
  Send, Clock, CircleCheck, XCircle, ChevronRight,
  Pencil, Trash2, Inbox, MessageSquareText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useToast } from '../../../../contexts/ToastContext';
import { inquiryApi } from '../../../../api';
import type { Inquiry } from '../../../../api/manual';
import { Button, Card, Badge, Modal } from '../../../../design-system';

const INQUIRY_CATEGORIES = [
  { id: 'order', label: '주문/결제' },
  { id: 'delivery', label: '배송' },
  { id: 'refund', label: '환불/취소' },
  { id: 'tradein', label: '상품권 매입' },
  { id: 'account', label: '회원/계정' },
  { id: 'etc', label: '기타' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: LucideIcon; color: 'orange' | 'green' | 'elephant' }> = {
  PENDING: { label: '답변대기', icon: Clock, color: 'orange' },
  ANSWERED: { label: '답변완료', icon: CircleCheck, color: 'green' },
  CLOSED: { label: '종료', icon: XCircle, color: 'elephant' },
};

export const InquiryTab: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isFormOpen, setIsFormOpen] = useState(true);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formTouched, setFormTouched] = useState(false);

  const [history, setHistory] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editContent, setEditContent] = useState('');

  const [swipedItemId, setSwipedItemId] = useState<number | null>(null);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inquiryApi.getMyInquiries();
      setHistory(data);
    } catch {
      showToast({ message: '문의 내역을 불러오는데 실패했습니다', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthenticated) loadInquiries();
  }, [isAuthenticated, loadInquiries]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormTouched(true);
    if (!category || !subject.trim() || !content.trim()) {
      showToast({ message: '모든 필수 항목을 입력해주세요', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    try {
      await inquiryApi.createInquiry({ category, subject: subject.trim(), content: content.trim() });
      showToast({ message: '문의가 접수되었습니다. 빠른 시일 내 답변드리겠습니다', type: 'success' });
      setCategory(''); setSubject(''); setContent(''); setFormTouched(false); setIsFormOpen(false);
      loadInquiries();
    } catch {
      showToast({ message: '문의 접수에 실패했습니다. 다시 시도해주세요', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [category, subject, content, showToast, loadInquiries]);

  const handleOpenDetail = useCallback((inquiry: Inquiry) => {
    setSelectedInquiry(inquiry); setIsDetailOpen(true); setSwipedItemId(null);
  }, []);
  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false); setSelectedInquiry(null); setIsEditMode(false);
  }, []);
  const handleStartEdit = useCallback(() => {
    if (selectedInquiry) {
      setEditCategory(selectedInquiry.category); setEditSubject(selectedInquiry.subject); setEditContent(selectedInquiry.content); setIsEditMode(true);
    }
  }, [selectedInquiry]);
  const handleSaveEdit = useCallback(async () => {
    if (!selectedInquiry || !editSubject.trim() || !editContent.trim()) {
      showToast({ message: '모든 필수 항목을 입력해주세요', type: 'error' }); return;
    }
    try {
      const updated = await inquiryApi.updateInquiry(selectedInquiry.id, { category: editCategory, subject: editSubject.trim(), content: editContent.trim() });
      setSelectedInquiry(updated); setIsEditMode(false);
      showToast({ message: '문의가 수정되었습니다', type: 'success' }); loadInquiries();
    } catch { showToast({ message: '문의 수정에 실패했습니다', type: 'error' }); }
  }, [selectedInquiry, editCategory, editSubject, editContent, showToast, loadInquiries]);
  const handleDeleteRequest = useCallback(() => { setIsDeleteConfirmOpen(true); }, []);
  const handleConfirmDelete = useCallback(async () => {
    if (!selectedInquiry) return;
    try {
      await inquiryApi.deleteInquiry(selectedInquiry.id);
      setIsDeleteConfirmOpen(false); setIsDetailOpen(false); setSelectedInquiry(null);
      showToast({ message: '문의가 삭제되었습니다', type: 'success' }); loadInquiries();
    } catch { showToast({ message: '문의 삭제에 실패했습니다', type: 'error' }); }
  }, [selectedInquiry, showToast, loadInquiries]);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchCurrentX.current = e.touches[0].clientX; }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => { touchCurrentX.current = e.touches[0].clientX; }, []);
  const handleTouchEnd = useCallback((id: number) => {
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 60) setSwipedItemId(id);
    else if (diff < -60) setSwipedItemId(null);
  }, []);
  const handleQuickDelete = useCallback((inquiry: Inquiry) => {
    setSelectedInquiry(inquiry); setIsDeleteConfirmOpen(true); setSwipedItemId(null);
  }, []);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
        <CircleUser size={48} className="text-base-content/30" aria-hidden="true" />
        <h3 className="text-lg sm:text-xl font-bold text-base-content">로그인이 필요합니다</h3>
        <p className="text-sm sm:text-base text-base-content/50">1:1 문의를 작성하려면 로그인해주세요.</p>
        <Button variant="primary" size="lg" onClick={() => navigate('/login', { state: { from: '/support?tab=inquiry' } })} icon={<LogIn size={16} />}>
          로그인하기
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:items-start">
        {/* 새 문의 작성 */}
        <Card className="p-0 overflow-hidden border-0 shadow-[0_1px_4px_rgba(49,130,246,0.04),0_4px_12px_rgba(0,0,0,0.03)] lg:w-[400px] lg:flex-shrink-0 lg:sticky lg:top-[calc(var(--header-height,64px)+60px)]">
          <button
            type="button"
            className="flex items-center justify-between w-full p-5 text-left border-b border-grey-50"
            onClick={() => setIsFormOpen(!isFormOpen)}
            aria-expanded={isFormOpen}
            aria-controls="inquiry-form-content"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-base-content">
              <SquarePen size={16} className="text-primary" aria-hidden="true" />
              새 문의 작성
            </span>
            <ChevronDown size={16} className={`text-base-content/30 transition-transform duration-200 ${isFormOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          {isFormOpen && (
            <div id="inquiry-form-content" className="p-5">
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="inquiry-category" className="text-xs font-bold text-base-content/60 mb-1.5 block">
                    문의 유형 <span className="text-error">*</span>
                  </label>
                  <select
                    id="inquiry-category"
                    className={`w-full h-12 px-4 rounded-2xl border bg-white text-sm font-medium transition-colors ${formTouched && !category ? 'border-error' : 'border-grey-100 focus:border-grey-300'}`}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    aria-invalid={formTouched && !category}
                  >
                    <option value="">선택해주세요</option>
                    {INQUIRY_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                  {formTouched && !category && <p className="text-xs text-error mt-1" role="alert">문의 유형을 선택해주세요.</p>}
                </div>

                <div>
                  <label htmlFor="inquiry-subject" className="text-xs font-bold text-base-content/60 mb-1.5 block">
                    제목 <span className="text-error">*</span>
                  </label>
                  <input
                    id="inquiry-subject"
                    type="text"
                    className={`w-full h-12 px-4 rounded-2xl border bg-white text-sm font-medium transition-colors ${formTouched && !subject.trim() ? 'border-error' : 'border-grey-100 focus:border-grey-300'}`}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="문의 제목을 입력해주세요"
                    maxLength={100}
                    required
                    autoComplete="off"
                    aria-invalid={formTouched && !subject.trim()}
                  />
                  {formTouched && !subject.trim() && <p className="text-xs text-error mt-1" role="alert">제목을 입력해주세요.</p>}
                </div>

                <div>
                  <label htmlFor="inquiry-content" className="text-xs font-bold text-base-content/60 mb-1.5 block">
                    문의 내용 <span className="text-error">*</span>
                  </label>
                  <textarea
                    id="inquiry-content"
                    className={`w-full min-h-40 px-4 py-3 rounded-2xl border bg-white text-sm font-medium leading-relaxed transition-colors resize-y ${formTouched && !content.trim() ? 'border-error' : 'border-grey-100 focus:border-grey-300'}`}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={'문의 내용을 상세히 입력해주세요.\n\n• 주문 번호가 있다면 함께 입력해주세요.\n• 스크린샷이 있다면 이메일로 추가 발송해주세요.'}
                    maxLength={2000}
                    required
                    aria-invalid={formTouched && !content.trim()}
                  />
                  {formTouched && !content.trim() && <p className="text-xs text-error mt-1" role="alert">문의 내용을 입력해주세요.</p>}
                  <div className="text-right text-xs text-base-content/30 mt-1">{content.length}/2000</div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={isSubmitting || !category || !subject.trim() || !content.trim()}
                  isLoading={isSubmitting}
                  icon={<Send size={16} />}
                >
                  문의 접수
                </Button>
              </form>
            </div>
          )}
        </Card>

        {/* 문의 내역 */}
        <Card className="p-0 overflow-hidden border-0 shadow-[0_1px_4px_rgba(49,130,246,0.04),0_4px_12px_rgba(0,0,0,0.03)] flex-1 min-w-0">
          <div className="flex items-center justify-between p-5 border-b border-grey-50">
            <span className="flex items-center gap-2 text-sm font-bold text-base-content">
              <Clock size={16} className="text-base-content/40" aria-hidden="true" />
              내 문의 내역
            </span>
            <Badge color="elephant" variant="weak" size="sm">{history.length}건</Badge>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-base-content/40">
              <span className="loading loading-spinner loading-md" aria-hidden="true" />
              <p className="text-sm">불러오는 중...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Inbox size={32} className="text-base-content/35" aria-hidden="true" />
              <p className="text-sm font-bold text-base-content/50">문의 내역이 없습니다</p>
              <span className="text-xs text-base-content/30">새 문의를 작성해보세요.</span>
            </div>
          ) : (
            <ul className="divide-y divide-grey-50/50">
              {history.map((item) => {
                const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                const categoryLabel = INQUIRY_CATEGORIES.find((c) => c.id === item.category)?.label || item.category;
                const isSwiped = swipedItemId === item.id;
                const StatusIcon = statusConfig.icon;

                return (
                  <li key={item.id} className="relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 bottom-0 flex items-stretch transition-[transform,opacity] duration-200 z-10 ${isSwiped ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:opacity-0 lg:group-hover:opacity-100'}`}>
                      {item.status === 'PENDING' && (
                        <button type="button" className="flex items-center justify-center w-14 bg-primary text-white" onClick={() => handleOpenDetail(item)} aria-label="수정">
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button type="button" className="flex items-center justify-center w-14 bg-error text-white" onClick={() => handleQuickDelete(item)} aria-label="삭제">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`w-full text-left p-5 transition-transform duration-200 bg-white hover:bg-grey-50/50 ${isSwiped ? '-translate-x-[120px]' : ''}`}
                      onClick={() => handleOpenDetail(item)}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={() => handleTouchEnd(item.id)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-base-content/40">{categoryLabel}</span>
                        <span className="text-xs text-base-content/30">{formatDate(item.createdAt)}</span>
                      </div>
                      <div className="text-sm font-bold text-base-content truncate mb-2">{item.subject}</div>
                      <div className="flex items-center justify-between">
                        <Badge color={statusConfig.color} variant="weak" size="sm">
                          <StatusIcon size={12} aria-hidden="true" className="mr-1" />
                          {statusConfig.label}
                        </Badge>
                        <ChevronRight size={16} className="text-base-content/35" aria-hidden="true" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={isDetailOpen} onClose={handleCloseDetail} title={isEditMode ? '문의 수정' : '문의 상세'} size="large" footer={
        selectedInquiry ? (
          isEditMode ? (
            <div className="flex gap-2 w-full">
              <Button variant="secondary" fullWidth onClick={() => setIsEditMode(false)}>취소</Button>
              <Button variant="primary" fullWidth onClick={handleSaveEdit}>저장</Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full">
              {selectedInquiry.status === 'PENDING' && (
                <Button variant="primary" fullWidth onClick={handleStartEdit} leftIcon={<Pencil size={14} />}>수정</Button>
              )}
              <Button variant="danger" fullWidth onClick={handleDeleteRequest} leftIcon={<Trash2 size={14} />}>삭제</Button>
            </div>
          )
        ) : undefined
      }>
        {selectedInquiry && (
          <div className="py-2">
            {isEditMode ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="edit-category" className="text-xs font-bold text-base-content/60 mb-1.5 block">문의 유형</label>
                  <select id="edit-category" className="w-full h-12 px-4 rounded-2xl border border-grey-200 bg-white text-sm font-medium" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {INQUIRY_CATEGORIES.map((cat) => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-subject" className="text-xs font-bold text-base-content/60 mb-1.5 block">제목</label>
                  <input id="edit-subject" type="text" className="w-full h-12 px-4 rounded-2xl border border-grey-200 bg-white text-sm font-medium" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} maxLength={100} autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="edit-content" className="text-xs font-bold text-base-content/60 mb-1.5 block">문의 내용</label>
                  <textarea id="edit-content" className="w-full min-h-40 px-4 py-3 rounded-2xl border border-grey-200 bg-white text-sm font-medium leading-relaxed resize-y" value={editContent} onChange={(e) => setEditContent(e.target.value)} maxLength={2000} />
                  <div className="text-right text-xs text-base-content/30 mt-1">{editContent.length}/2000</div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge color="blue" variant="weak" size="sm">
                      {INQUIRY_CATEGORIES.find((c) => c.id === selectedInquiry.category)?.label}
                    </Badge>
                    <span className="text-xs text-base-content/40">{formatDate(selectedInquiry.createdAt)}</span>
                  </div>
                  {(() => {
                    const config = STATUS_CONFIG[selectedInquiry.status] || STATUS_CONFIG.PENDING;
                    const SIcon = config.icon;
                    return <Badge color={config.color} variant="weak" size="sm"><SIcon size={12} className="mr-1" />{config.label}</Badge>;
                  })()}
                </div>

                <h3 className="text-base sm:text-lg font-bold text-base-content mb-4 leading-snug">{selectedInquiry.subject}</h3>

                <div className="flex flex-col gap-4">
                  <div className="bg-grey-50 rounded-2xl p-4">
                    <div className="text-xs font-bold text-base-content/40 mb-2">문의 내용</div>
                    <p className="text-sm text-base-content/70 leading-relaxed whitespace-pre-wrap m-0">{selectedInquiry.content}</p>
                  </div>

                  {selectedInquiry.answer && (
                    <div className="bg-success/5 border border-success/20 rounded-2xl p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-success mb-2">
                        <MessageSquareText size={14} aria-hidden="true" />
                        답변 ({selectedInquiry.answeredAt ? formatDate(selectedInquiry.answeredAt) : ''})
                      </div>
                      <p className="text-sm text-base-content/70 leading-relaxed whitespace-pre-wrap m-0">{selectedInquiry.answer}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="문의 삭제" size="small" footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" fullWidth onClick={() => setIsDeleteConfirmOpen(false)}>취소</Button>
          <Button variant="danger" fullWidth onClick={handleConfirmDelete}>삭제</Button>
        </div>
      }>
        <div className="text-center py-2">
          <p className="text-base font-bold text-base-content mb-1">이 문의를 삭제하시겠습니까?</p>
          <p className="text-sm text-base-content/50">삭제된 문의는 복구할 수 없습니다.</p>
        </div>
      </Modal>
    </div>
  );
};

export default InquiryTab;
