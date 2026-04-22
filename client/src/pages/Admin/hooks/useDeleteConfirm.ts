/**
 * @file useDeleteConfirm.ts
 * @description 삭제 확인 상태 관리 훅 — 8+ 탭의 반복되는 삭제 확인 모달 상태 관리 캡슐화
 *
 * DeleteConfirmState 인터페이스와 열기/닫기/실행 패턴을 통일.
 */
import { useState, useCallback } from 'react';
import { useToast } from '../../../contexts/ToastContext';

interface UseDeleteConfirmReturn<K extends string | number> {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 삭제 대상 ID */
  targetId: K;
  /** 삭제 대상 이름/라벨 (모달에 표시용) */
  targetLabel: string;
  /** 삭제 확인 모달 열기 */
  openConfirm: (id: K, label: string) => void;
  /** 삭제 확인 모달 닫기 */
  closeConfirm: () => void;
  /** 삭제 실행 (API 호출 + 토스트 + reload) */
  executeDelete: () => Promise<void>;
}

interface UseDeleteConfirmOptions<K extends string | number> {
  /** 삭제 API 호출 함수 */
  deleteFn: (id: K) => Promise<any>;
  /** 삭제 성공 시 콜백 (리스트 reload 등) */
  onSuccess?: () => void;
  /** 성공 메시지 */
  successMessage?: string;
  /** 에러 메시지 */
  errorMessage?: string;
}

/**
 * 삭제 확인 훅
 * @param options - 삭제 API, 성공 콜백, 메시지 설정
 */
export function useDeleteConfirm<K extends string | number = number>(
  options: UseDeleteConfirmOptions<K>,
): UseDeleteConfirmReturn<K> {
  const { deleteFn, onSuccess, successMessage = '삭제되었습니다.', errorMessage = '삭제에 실패했습니다.' } = options;
  const { showToast } = useToast();

  const [state, setState] = useState<{ open: boolean; id: K; label: string }>({
    open: false,
    id: '' as unknown as K,
    label: '',
  });

  const openConfirm = useCallback((id: K, label: string) => {
    setState({ open: true, id, label });
  }, []);

  const closeConfirm = useCallback(() => {
    setState(prev => ({ ...prev, open: false }));
  }, []);

  const executeDelete = useCallback(async () => {
    try {
      await deleteFn(state.id);
      showToast({ message: successMessage, type: 'success' });
      onSuccess?.();
    } catch {
      showToast({ message: errorMessage, type: 'error' });
    } finally {
      setState(prev => ({ ...prev, open: false }));
    }
  }, [state.id, deleteFn, onSuccess, successMessage, errorMessage, showToast]);

  return {
    isOpen: state.open,
    targetId: state.id,
    targetLabel: state.label,
    openConfirm,
    closeConfirm,
    executeDelete,
  };
}
