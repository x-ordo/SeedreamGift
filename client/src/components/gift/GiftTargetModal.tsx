/**
 * @file GiftTargetModal.tsx
 * @description 선물하기 대상 선택 모달 - 이름/이메일로 수신자를 검색하여 선택
 * @module components/gift
 *
 * 사용처:
 * - VoucherTypeDetailPage, ProductListPage: 선물하기 버튼 클릭 시 모달로 표시
 *
 * 주요 Props:
 * - isOpen: 모달 표시 여부
 * - onClose: 모달 닫기 콜백
 * - onConfirm: 수신자 선택 완료 콜백 (email, name 전달)
 *
 * 동작:
 * - 3글자 이상 입력 시 500ms 디바운스로 사용자 검색 API 호출
 * - 검색 결과 드롭다운에서 선택하거나 직접 이메일 입력 가능
 * - 선택 완료 시 onConfirm 호출 후 모달 닫힘
 *
 * API:
 * - GET /gifts/search?query={query} - 사용자 검색
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Gift, ShoppingBag } from 'lucide-react';
import { Modal, Button, Input, ListRow, Result, Stack, Inline } from '../../design-system';
import { axiosInstance } from '../../lib/axios';
import { formatPrice } from '../../utils';

interface GiftTargetModalProps {
    /** 모달 표시 여부 */
    isOpen: boolean;
    /** 모달 닫기 콜백 */
    onClose: () => void;
    /** 수신자 선택 완료 콜백 */
    onConfirm: (receiver: { email: string; name: string; message: string }) => void;
    /** 선물할 상품 수량 (컨텍스트 표시용) */
    itemCount?: number;
    /** 선물할 총 금액 (컨텍스트 표시용) */
    totalAmount?: number;
}

interface UserSearchResult {
    id: number;
    email: string;
    name: string | null;
}

export const GiftTargetModal: React.FC<GiftTargetModalProps> = ({ isOpen, onClose, onConfirm, itemCount, totalAmount }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
    const [giftMessage, setGiftMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedUser(null);
            setGiftMessage('');
            setError('');
        }
    }, [isOpen]);

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!query || query.length < 3) {
                setResults([]);
                return;
            }
            // If already selected, verify if query matches (or just clear selection if typing continues)
            if (selectedUser && query === selectedUser.email) return;

            setLoading(true);
            try {
                const res = await axiosInstance.get('/gifts/search', { params: { query } });
                setResults(res.data);
                setError('');
            } catch (err) {
                // Ignore errors for search typing
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, selectedUser]);

    const handleSelect = (user: UserSearchResult) => {
        setSelectedUser(user);
        setQuery(user.email); // Set email as display
        setResults([]); // Hide list
    };

    const handleSubmit = () => {
        const msg = giftMessage.trim();
        if (selectedUser) {
            onConfirm({ email: selectedUser.email, name: selectedUser.name || '알 수 없음', message: msg });
            onClose();
        } else if (query) {
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)) {
                onConfirm({ email: query, name: query, message: msg });
                onClose();
            } else {
                setError('목록에서 선택하거나 올바른 이메일을 입력하세요.');
            }
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="선물하기"
            footer={
                <Inline gap={2} className="w-full">
                    <Button variant="secondary" onClick={onClose} fullWidth size="md">취소</Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!selectedUser && !query}
                        fullWidth
                        size="md"
                        isLoading={loading}
                    >
                        선물 담기
                    </Button>
                </Inline>
            }
        >
            <Stack gap={3}>
                {/* Gift context summary */}
                {itemCount != null && itemCount > 0 && totalAmount != null && (
                    <div className="p-3 bg-grey-50 rounded-xl text-xs text-base-content/50 flex items-center gap-2">
                        <ShoppingBag size={14} aria-hidden="true" className="shrink-0" />
                        <span>{itemCount}개 상품 · 총 {formatPrice(totalAmount)}</span>
                    </div>
                )}

                <p className="text-sm text-base-content/50">이름이나 이메일로 받는 분을 검색하세요</p>

                <div className="gift-search-container" aria-busy={loading}>
                    <Input
                        label="받는 사람 이메일"
                        fullWidth
                        placeholder="이메일 검색 (3글자 이상)"
                        autoFocus
                        value={query}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setQuery(e.target.value);
                            setSelectedUser(null);
                        }}
                        error={error}
                        helperText={loading ? '검색 중...' : selectedUser ? `To: ${selectedUser.name || '알 수 없음'} (${selectedUser.email})` : ''}
                        aria-expanded={results.length > 0 && !selectedUser}
                        aria-autocomplete="list"
                        role="combobox"
                    />

                    {results.length > 0 && !selectedUser && (
                        <div
                            className="gift-search-results"
                            role="listbox"
                            aria-label={`${results.length}명의 검색 결과`}
                            style={{ maxHeight: '200px', overflowY: 'auto' }}
                        >
                            <div className="sr-only" role="status" aria-live="polite">
                                {results.length}명의 검색 결과
                            </div>
                            {results.map(user => (
                                <div
                                    key={user.id}
                                    role="option"
                                    aria-selected={selectedUser?.id === user.id}
                                    tabIndex={0}
                                    onClick={() => handleSelect(user)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(user); } }}
                                    className="gift-search-item"
                                >
                                    <ListRow
                                        left={user.name || '이름 없음'}
                                        right={user.email}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 선물 메시지 */}
                <div>
                    <label htmlFor="gift-message" className="text-xs font-medium text-base-content/50 block mb-1.5">
                        선물 메시지 (선택)
                    </label>
                    <textarea
                        id="gift-message"
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value.slice(0, 200))}
                        placeholder="축하해요! 🎉 (최대 200자)"
                        rows={3}
                        maxLength={200}
                        className="w-full resize-none rounded-xl border border-grey-200 p-3 text-sm focus:border-primary focus:outline-none transition-colors"
                        aria-label="선물 메시지"
                    />
                    <p className="text-right text-[10px] text-base-content/30 mt-1">{giftMessage.length}/200</p>
                </div>
            </Stack>
        </Modal>
    );
};
