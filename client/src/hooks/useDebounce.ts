/**
 * @file useDebounce.ts
 * @description 값 디바운싱 훅 - 빠른 연속 입력 시 마지막 값만 처리
 * @module hooks
 *
 * 주요 기능:
 * - 지정된 시간(delay) 동안 값 변경이 없을 때만 업데이트
 * - 검색 입력, API 호출 최적화에 유용
 * - 컴포넌트 언마운트 시 타이머 정리
 *
 * 사용 예시:
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchSearchResults(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 * ```
 */
import { useState, useEffect } from 'react';

/**
 * 값을 디바운싱하는 훅
 * @param value - 디바운싱할 값
 * @param delay - 지연 시간 (밀리초)
 * @returns 디바운싱된 값
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
