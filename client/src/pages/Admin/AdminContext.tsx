/**
 * @file AdminContext.tsx
 * @description 관리자 페이지 컨텍스트 - 탭 간 상태 공유
 * @module pages/Admin
 *
 * 사용처:
 * - AdminPage: Provider로 감싸서 하위 탭 컴포넌트에 컨텍스트 제공
 * - Admin/tabs/*: useAdminContext()로 현재 탭 상태 접근 및 탭 전환
 *
 * 제공 값:
 * - activeTab: 현재 활성화된 탭 ID
 * - setActiveTab: 탭 전환 함수 (방문 기록 추가)
 *
 * 사용 예시:
 * const { activeTab, setActiveTab } = useAdminContext();
 * setActiveTab('users'); // 회원 관리 탭으로 이동
 */
import { createContext, useContext } from 'react';
import { AdminTab } from './constants';

interface AdminContextType {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
}

export const AdminContext = createContext<AdminContextType | null>(null);

export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used within AdminPage');
  }
  return context;
}
