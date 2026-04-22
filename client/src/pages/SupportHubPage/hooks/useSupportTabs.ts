/**
 * @file useSupportTabs.ts
 * @description 탭 상태 관리 훅 - useSearchParams 기반 딥링크 지원
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, CircleHelp, MessageCircle, Gift } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SupportTabId = 'notice' | 'faq' | 'inquiry' | 'event';

export interface SupportTab {
  id: SupportTabId;
  label: string;
  icon: LucideIcon;
}

export const SUPPORT_TABS: SupportTab[] = [
  { id: 'notice', label: '공지사항', icon: Megaphone },
  { id: 'faq', label: '자주 묻는 질문', icon: CircleHelp },
  { id: 'inquiry', label: '1:1 문의', icon: MessageCircle },
  { id: 'event', label: '이벤트', icon: Gift },
];

export const TAB_ORDER: SupportTabId[] = ['notice', 'faq', 'inquiry', 'event'];

export function useSupportTabs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo<SupportTabId>(() => {
    const tab = searchParams.get('tab') as SupportTabId | null;
    return TAB_ORDER.includes(tab as SupportTabId) ? (tab as SupportTabId) : 'notice';
  }, [searchParams]);

  const category = useMemo(() => searchParams.get('category') || 'all', [searchParams]);
  const searchQuery = useMemo(() => searchParams.get('q') || '', [searchParams]);
  const expandId = useMemo(() => searchParams.get('expand') || null, [searchParams]);

  const setActiveTab = useCallback((tabId: SupportTabId) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabId);
    // 탭 변경 시 카테고리와 검색어 초기화
    newParams.delete('category');
    newParams.delete('q');
    newParams.delete('expand');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const setCategory = useCallback((cat: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (cat === 'all') {
      newParams.delete('category');
    } else {
      newParams.set('category', cat);
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const setSearchQuery = useCallback((query: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (query) {
      newParams.set('q', query);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const setExpandId = useCallback((id: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set('expand', id);
    } else {
      newParams.delete('expand');
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  return {
    activeTab,
    category,
    searchQuery,
    expandId,
    setActiveTab,
    setCategory,
    setSearchQuery,
    setExpandId,
    tabs: SUPPORT_TABS,
  };
}

export default useSupportTabs;
