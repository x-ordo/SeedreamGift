/**
 * @file ModalContext.tsx
 * @description 전역 모달 다이얼로그 관리 — Design System Modal에 위임
 * @module contexts
 *
 * 주요 기능:
 * - openModal()로 어디서든 확인 다이얼로그 표시
 * - Design System Modal 기반 (포털, 포커스 트랩, inert, 접근성 자동 처리)
 *
 * 사용법:
 * const { openModal, closeModal } = useModal();
 * openModal({
 *   title: '확인',
 *   content: <p>정말 삭제하시겠습니까?</p>,
 * });
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Modal, Button } from '../design-system';

/** 모달 옵션 */
interface ModalOptions {
  title: string;                    // 모달 제목
  content: React.ReactNode;         // 모달 본문 내용
  footer?: React.ReactNode;         // 커스텀 푸터 (기본: 확인 버튼)
  closeOnOverlayClick?: boolean;    // 오버레이 클릭 시 닫기 (기본: true)
}

interface ModalContextType {
  openModal: (options: ModalOptions) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

/**
 * 모달 Provider — Design System Modal에 위임
 */
export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalData, setModalData] = useState<ModalOptions | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback((options: ModalOptions) => {
    setModalData(options);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setModalData(null);
  }, []);

  const contextValue = useMemo(() => ({ openModal, closeModal }), [openModal, closeModal]);

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      <Modal
        isOpen={isOpen && modalData !== null}
        onClose={closeModal}
        title={modalData?.title}
        size="small"
        closeOnOverlayClick={modalData?.closeOnOverlayClick !== false}
        footer={
          modalData?.footer || (
            <Button variant="primary" fullWidth size="lg" onClick={closeModal}>확인</Button>
          )
        }
      >
        {modalData?.content}
      </Modal>
    </ModalContext.Provider>
  );
};

/**
 * 모달 상태 접근 훅
 *
 * @returns ModalContextType - openModal, closeModal 함수
 * @throws Error - ModalProvider 외부에서 호출 시
 *
 * @example
 * const { openModal, closeModal } = useModal();
 *
 * openModal({
 *   title: '삭제 확인',
 *   content: <p>정말 삭제하시겠습니까?</p>,
 *   footer: (
 *     <>
 *       <Button onClick={closeModal}>취소</Button>
 *       <Button onClick={handleDelete}>삭제</Button>
 *     </>
 *   ),
 * });
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within a ModalProvider');
  return context;
};
