import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useCart, useCreateOrder, useBankInfo, useInitiatePayment } from '../hooks';
import { useCheckoutStore } from '../store/useCheckoutStore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PaymentMethod, CashReceiptType, OrderResultData, VoucherDisplay } from '../types';
import type { Address } from 'react-daum-postcode';

export const useCheckoutPage = () => {
  // 체크아웃 스토어에서 단일 useShallow 셀렉터로 추출
  const {
    items,
    giftTarget,
    shippingInfo,
    setShippingInfo,
    clearCheckout,
  } = useCheckoutStore(useShallow((s) => ({
    items: s.checkoutItems,
    giftTarget: s.giftTarget,
    shippingInfo: s.shippingInfo,
    setShippingInfo: s.setShippingInfo,
    clearCheckout: s.clear,
  })));
  const { removeSelectedItems } = useCart();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const createOrderMutation = useCreateOrder();
  const initiatePaymentMutation = useInitiatePayment();
  const bankInfo = useBankInfo();

  // 현금영수증 상태
  const [cashReceiptType, setCashReceiptType] = useState<CashReceiptType>('NO_RECEIPT');
  const [cashReceiptNumber, setCashReceiptNumber] = useState(user?.phone || '');
  const [showPostcode, setShowPostcodeRaw] = useState(false);
  const postcodeCooldownRef = useRef(false);
  const setShowPostcode = useCallback((show: boolean) => {
    if (show && postcodeCooldownRef.current) return; // 쿨다운 중 무시
    setShowPostcodeRaw(show);
    if (show) {
      postcodeCooldownRef.current = true;
      setTimeout(() => { postcodeCooldownRef.current = false; }, 3000); // 3초 쿨다운
    }
  }, []);
  const [orderItemsOpen, setOrderItemsOpen] = useState(true);

  // 총 결제 금액
  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.buyPrice) || 0) * item.quantity, 0),
    [items]
  );

  const idempotencyKeyRef = useRef<string>(crypto.randomUUID().replace(/-/g, ''));

  // ProtectedRoute in App.tsx handles auth redirect — no duplicate check needed here

  const hasPhysicalItems = items.some(item => item.type !== 'DIGITAL');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  // 선호 은행 (선택사항). 빈 문자열 = 모든 은행 허용. VIRTUAL_ACCOUNT 결제 시에만 의미.
  const [preferredBankCode, setPreferredBankCode] = useState<string>('');
  const [orderResult, setOrderResult] = useState<OrderResultData | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const submitLockRef = useRef(false);
  const isSubmitting = createOrderMutation.isPending;

  // 언마운트 시 submitLock 리셋 (네트워크 지연 중 페이지 이탈 → 재진입 시 주문 불가 방지)
  useEffect(() => {
    return () => { submitLockRef.current = false; };
  }, []);

  const totalOriginalPrice = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0),
    [items]
  );

  const totalDiscount = useMemo(
    () => items.reduce((sum, item) => sum + ((Number(item.price) || 0) - (Number(item.buyPrice) || 0)) * item.quantity, 0),
    [items]
  );

  // 마운트 시 sessionStorage에서 배송 정보 복원
  useEffect(() => {
    const saved = sessionStorage.getItem('seedream_checkout_form');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setShippingInfo(parsed);
      } catch {
        // 파싱 실패 시 무시
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasPhysicalItems && !shippingInfo) {
      setShippingInfo({
        method: 'DELIVERY',
        recipientName: user?.name || '',
        recipientPhone: user?.phone || '',
        recipientAddr: user?.address || '',
        recipientZip: user?.zipCode || '',
      });
    }
  }, [hasPhysicalItems, shippingInfo, setShippingInfo, user]);

  // 배송 정보 변경 시 sessionStorage에 저장
  useEffect(() => {
    if (shippingInfo?.recipientName || shippingInfo?.recipientPhone) {
      sessionStorage.setItem('seedream_checkout_form', JSON.stringify(shippingInfo));
    }
  }, [shippingInfo]);

  // 주소 검색 완료 핸들러
  const handlePostcodeComplete = (data: Address) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
      fullAddress += extraAddress !== '' ? ` (${extraAddress})` : '';
    }

    setShippingInfo({
      ...shippingInfo!,
      recipientZip: data.zonecode,
      recipientAddr: fullAddress,
    });
    setShowPostcode(false);
  };

  const handleCopyAccount = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(bankInfo.accountNumber);
      showToast({ message: '계좌번호가 복사되었어요', type: 'success' });
    } catch {
      showToast({ message: '복사에 실패했어요', type: 'error' });
    }
  }, [showToast, bankInfo.accountNumber]);

  const handleCopyPin = useCallback(async (pin: string) => {
    try {
      await navigator.clipboard.writeText(pin);
      showToast({ message: 'PIN 번호가 복사되었어요', type: 'success' });
    } catch {
      showToast({ message: '복사에 실패했어요', type: 'error' });
    }
  }, [showToast]);

  const handleOrderClick = useCallback(() => {
    if (!isAuthenticated) {
      showToast({ message: '로그인 후 이용 가능해요', type: 'error' });
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }

    if (items.length === 0) {
      showToast({ message: '주문할 상품이 없어요', type: 'error' });
      return;
    }

    if (hasPhysicalItems && shippingInfo?.method === 'DELIVERY') {
      if (!shippingInfo.recipientName || !shippingInfo.recipientPhone || !shippingInfo.recipientAddr) {
        showToast({ message: '배송 정보를 입력해주세요', type: 'error' });
        return;
      }
    }

    // [비활성화] 유가증권은 현금영수증 발급 대상 아님
    // if (paymentMethod === 'CASH' && cashReceiptType !== 'NO_RECEIPT' && !cashReceiptNumber) {
    //   showToast({ message: '현금영수증 번호를 입력해주세요', type: 'error' });
    //   return;
    // }

    setShowConfirmModal(true);
  }, [isAuthenticated, items.length, navigate, showToast, location, hasPhysicalItems, shippingInfo, paymentMethod, cashReceiptType, cashReceiptNumber]);

  const handleOrderConfirm = useCallback(() => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    createOrderMutation.mutate(
      {
        items: items.map(item => ({ productId: item.id, quantity: item.quantity })),
        paymentMethod: paymentMethod,
        giftReceiverEmail: giftTarget?.email,
        giftMessage: giftTarget?.message,
        idempotencyKey: idempotencyKeyRef.current,
        // [비활성화] 유가증권은 현금영수증 발급 대상 아님
        cashReceiptType: undefined,
        cashReceiptNumber: undefined,
        // 배송 정보
        ...(hasPhysicalItems && shippingInfo ? {
          shippingMethod: shippingInfo.method,
          recipientName: shippingInfo.recipientName,
          recipientPhone: shippingInfo.recipientPhone,
          recipientAddr: shippingInfo.recipientAddr,
          recipientZip: shippingInfo.recipientZip,
        } : {})
      },
      {
        onSuccess: (orderData) => {
          // VIRTUAL_ACCOUNT: Seedream LINK 모드 — 주문 생성 후 바로 VA 발급 요청 →
          // /checkout/redirect 로 이동해 키움페이 은행선택 창으로 auto-submit.
          // PIN 결과 표시와 checkout 정리는 아직 하지 않음 (결제 완료는 webhook 경유).
          if (paymentMethod === 'VIRTUAL_ACCOUNT') {
            const isMobile = /Mobi|Android/i.test(navigator.userAgent);
            initiatePaymentMutation.mutate(
              {
                orderId: orderData.id,
                clientType: isMobile ? 'M' : 'P',
                bankCode: preferredBankCode || undefined,
              },
              {
                onSuccess: (ip) => {
                  submitLockRef.current = false;
                  setShowConfirmModal(false);
                  sessionStorage.removeItem('seedream_checkout_form');
                  idempotencyKeyRef.current = crypto.randomUUID().replace(/-/g, '');
                  navigate('/checkout/redirect', {
                    state: {
                      targetUrl: ip.targetUrl,
                      formData: ip.formData,
                      orderCode: ip.orderCode,
                    },
                    replace: true,
                  });
                },
                onError: (err) => {
                  submitLockRef.current = false;
                  setShowConfirmModal(false);
                  const errMsg = err instanceof Error ? err.message : '결제창 연결에 실패했어요';
                  showToast({ message: errMsg, type: 'error' });
                },
              }
            );
            return;
          }

          submitLockRef.current = false;
          setShowConfirmModal(false);
          // 먼저 정리 — 이탈/새로고침 시에도 중복 주문 방지
          clearCheckout();
          // 주문 완료 후 임시 저장된 배송 정보 삭제
          sessionStorage.removeItem('seedream_checkout_form');
          // 구매한 상품들을 장바구니에서 일괄 제거 (단일 API 호출)
          const purchasedProductIds = items.map(item => item.id);
          removeSelectedItems(purchasedProductIds);
          idempotencyKeyRef.current = crypto.randomUUID().replace(/-/g, '');
          // 결과 표시
          const vcs = orderData.voucherCodes || [];
          setOrderResult({
            orderId: orderData.id,
            orderCode: orderData.orderCode || null,
            pinCodes: vcs.map((v: { pinCode: string; giftNumber?: string }) => v.pinCode),
            vouchers: vcs.map((v: { pinCode: string; giftNumber?: string }): VoucherDisplay => ({
              pinCode: v.pinCode,
              giftNumber: v.giftNumber,
            })),
            totalAmount: totalPrice
          });
        },
        onError: (error) => {
          submitLockRef.current = false;
          setShowConfirmModal(false);
          const errMsg = error instanceof Error ? error.message : '결제 중 오류가 발생했어요.';
          // 정책 관련 에러는 5초 표시 + 액션 유도
          const isPolicy = errMsg.includes('한도') || errMsg.includes('KYC') || errMsg.includes('본인 인증') || errMsg.includes('계좌 인증');
          showToast({
            message: errMsg,
            type: 'error',
            duration: isPolicy ? 5000 : 3000,
            ...(errMsg.includes('본인 인증') || errMsg.includes('KYC') ? {
              action: { label: '인증하기', onClick: () => window.location.href = '/mypage?tab=settings' }
            } : {}),
          });
        },
      }
    );
  }, [items, paymentMethod, preferredBankCode, cashReceiptType, cashReceiptNumber, totalPrice, removeSelectedItems, clearCheckout, showToast, giftTarget, createOrderMutation, initiatePaymentMutation, navigate, hasPhysicalItems, shippingInfo]);

  return {
    items,
    giftTarget,
    shippingInfo,
    setShippingInfo,
    isAuthenticated,
    user,
    bankInfo,
    cashReceiptType,
    setCashReceiptType,
    cashReceiptNumber,
    setCashReceiptNumber,
    showPostcode,
    setShowPostcode,
    orderItemsOpen,
    setOrderItemsOpen,
    totalPrice,
    hasPhysicalItems,
    paymentMethod,
    setPaymentMethod,
    preferredBankCode,
    setPreferredBankCode,
    orderResult,
    showConfirmModal,
    setShowConfirmModal,
    isSubmitting,
    totalOriginalPrice,
    totalDiscount,
    handlePostcodeComplete,
    handleCopyAccount,
    handleCopyPin,
    handleOrderClick,
    handleOrderConfirm,
    navigate,
  };
};
