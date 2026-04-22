/**
 * @file useDebouncedSearch.ts
 * @description 디바운스 검색 훅 — 검색 입력에 지연을 적용하여 불필요한 API 호출 방지
 *
 * AuditLogsTab, UsersTab의 수동 디바운스 useRef 패턴을 캡슐화.
 */
import { useState, useEffect, useRef } from 'react';

interface UseDebouncedSearchReturn {
  /** 사용자가 입력한 원본 검색어 (input에 바인딩) */
  searchQuery: string;
  /** 디바운스 적용된 검색어 (API 호출에 사용) */
  debouncedQuery: string;
  /** 검색어 변경 핸들러 */
  setSearchQuery: (query: string) => void;
}

/**
 * 디바운스 검색 훅
 * @param delay - 디바운스 지연 시간 (ms). 기본값 300ms.
 */
export function useDebouncedSearch(delay = 300): UseDebouncedSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [searchQuery, delay]);

  return { searchQuery, debouncedQuery, setSearchQuery };
}
