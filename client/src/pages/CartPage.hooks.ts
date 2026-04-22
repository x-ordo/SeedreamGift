import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, useIsMobile } from '../hooks';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

export const useCartPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  
  // useCart 훅 사용 (피드백 포함 액션)
  const { items, removeFromCart, removeSelectedItems, updateQuantity, checkoutFromCart } = useCart();
  
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 선택된 아이템 IDs
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(items.map(i => i.id)));

  // items가 비동기로 도착했을 때 selectedIds를 초기화
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && items.length > 0) {
      initializedRef.current = true;
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }, [items]);

  // 전체 선택 여부
  const isAllSelected = useMemo(() =>
    items.length > 0 && selectedIds.size === items.length,
    [items.length, selectedIds.size]);

  // 선택된 아이템들
  const selectedItems = useMemo(() =>
    items.filter(item => selectedIds.has(item.id)),
    [items, selectedIds]);

  // 선택된 아이템 중 구매 가능한 것만 (품절 제외)
  const purchasableItems = useMemo(() =>
    selectedItems.filter(item => (item.availableStock ?? 1) > 0),
    [selectedItems]);

  // 총 상품 금액 (정가 기준, 품절 아이템 제외)
  const totalOriginalPrice = useMemo(() =>
    purchasableItems.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0),
    [purchasableItems]);

  // 총 할인 금액 (품절 아이템 제외)
  const totalDiscount = useMemo(() =>
    purchasableItems.reduce((sum, item) => sum + ((Number(item.price) || 0) - (Number(item.buyPrice) || 0)) * item.quantity, 0),
    [purchasableItems]);

  // 총 결제 금액 (품절 아이템 제외)
  const totalPrice = useMemo(() =>
    purchasableItems.reduce((sum, item) => sum + (Number(item.buyPrice) || 0) * item.quantity, 0),
    [purchasableItems]);

  /**
   * 전체 선택 토글
   */
  const handleToggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }, [isAllSelected, items]);

  /**
   * 개별 아이템 선택 토글
   */
  const handleToggleItem = useCallback((id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  /**
   * 선택 삭제 확인 모달 열기
   */
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) {
      showToast({ message: '삭제할 상품을 선택해주세요', type: 'error' });
      return;
    }
    setShowDeleteConfirm(true);
  }, [selectedIds.size, showToast]);

  /**
   * 선택 삭제 처리
   */
  const handleConfirmDelete = useCallback(async () => {
    const idsArray = Array.from(selectedIds);
    try {
      setIsDeletingBatch(true);
      setShowDeleteConfirm(false);
      await removeSelectedItems(idsArray);
    } finally {
      setIsDeletingBatch(false);
      setSelectedIds(new Set());
    }
  }, [selectedIds, removeSelectedItems]);

  /**
   * 수량 직접 설정 (NumericSpinner용)
   */
  const handleQuantitySet = useCallback((id: number, qty: number) => {
    updateQuantity(id, qty);
  }, [updateQuantity]);

  /**
   * 아이템 삭제 (useCart의 removeFromCart 사용)
   */
  const handleRemoveItem = useCallback((id: number, name: string) => {
    removeFromCart(id, name);
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, [removeFromCart]);

  /**
   * 주문하기 (useCart의 goToCheckout 사용)
   */
  const handleCheckout = useCallback(() => {
    if (!isAuthenticated) {
      showToast({ message: '로그인 후 이용해주세요', type: 'info' });
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    if (purchasableItems.length === 0) {
      showToast({ message: '주문 가능한 상품을 선택해주세요', type: 'error' });
      return;
    }
    checkoutFromCart(purchasableItems);
  }, [purchasableItems, checkoutFromCart, showToast, isAuthenticated, navigate]);

  /**
   * 선물하기 클릭
   */
  const handleGiftClick = useCallback(() => {
    if (!isAuthenticated) {
      showToast({ message: '로그인 후 이용해주세요', type: 'info' });
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    if (purchasableItems.length === 0) {
      showToast({ message: '선물 가능한 상품을 선택해주세요', type: 'error' });
      return;
    }
    setShowGiftModal(true);
  }, [purchasableItems.length, showToast, isAuthenticated, navigate]);

  /**
   * 선물 정보 입력 완료
   */
  const handleGiftConfirm = useCallback((target: { email: string; name: string; message: string }) => {
    checkoutFromCart(purchasableItems, target);
  }, [purchasableItems, checkoutFromCart]);

  return {
    items,
    isMobile,
    isDeletingBatch,
    showGiftModal,
    setShowGiftModal,
    showDeleteConfirm,
    setShowDeleteConfirm,
    selectedIds,
    isAllSelected,
    purchasableItems,
    totalOriginalPrice,
    totalDiscount,
    totalPrice,
    handleToggleAll,
    handleToggleItem,
    handleDeleteSelected,
    handleConfirmDelete,
    handleQuantitySet,
    handleRemoveItem,
    handleCheckout,
    handleGiftClick,
    handleGiftConfirm,
    navigate,
  };
};
