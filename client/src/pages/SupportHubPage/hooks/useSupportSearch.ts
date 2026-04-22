/**
 * @file useSupportSearch.ts
 * @description 고객센터 통합 검색 훅 - FAQ + 공지사항 동시 검색
 * @module pages/SupportHubPage/hooks
 *
 * 사용처:
 * - SupportHubPage: 검색바 입력 시 실시간 결과 제공
 *
 * 검색 전략:
 * - 초기 로드 시 FAQ/공지사항 데이터를 전부 캐싱 (소규모 데이터셋)
 * - 입력 → 300ms 디바운스 → 클라이언트 사이드 매칭 (서버 부하 제로)
 * - 정확 매칭 > 시작 부분 > 포함 > 초성 순으로 점수를 매겨 정렬
 * - 한글 초성 검색 지원 (예: 'ㅂㅅ' → '배송')
 * - 검색 히스토리를 localStorage에 저장하여 재방문 시 활용
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDebounce } from '../../../hooks';
import { faqApi, noticeApi } from '../../../api/manual';
import { MISC_STORAGE_KEYS, MAX_SEARCH_HISTORY } from '../../../constants';
import { POPULAR_SEARCH_KEYWORDS } from '../../../constants';

export interface SearchResult {
  id: number;
  type: 'faq' | 'notice';
  title: string;
  content?: string;
  category?: string;
  date?: string;
  score?: number; // 매칭 점수
  matchType?: 'exact' | 'partial' | 'chosung'; // 매칭 타입
}

export interface SearchResults {
  faq: SearchResult[];
  notice: SearchResult[];
  total: number;
}

// 한글 초성 추출
const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const getChosung = (str: string): string => {
  return str
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0) - 0xac00;
      if (code < 0 || code > 11171) return char;
      return CHOSUNG[Math.floor(code / 588)];
    })
    .join('');
};

const isChosungOnly = (str: string): boolean => {
  return /^[ㄱ-ㅎ]+$/.test(str);
};

// 매칭 점수 계산
const calculateScore = (text: string, query: string, isTitle: boolean): { score: number; matchType: 'exact' | 'partial' | 'chosung' } => {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // 정확한 매칭 (제목에서 더 높은 점수)
  if (lowerText === lowerQuery) {
    return { score: isTitle ? 100 : 80, matchType: 'exact' };
  }

  // 시작 부분 매칭
  if (lowerText.startsWith(lowerQuery)) {
    return { score: isTitle ? 90 : 70, matchType: 'exact' };
  }

  // 포함 매칭
  if (lowerText.includes(lowerQuery)) {
    const index = lowerText.indexOf(lowerQuery);
    const positionScore = Math.max(0, 50 - index); // 앞쪽 매칭에 더 높은 점수
    return { score: (isTitle ? 60 : 40) + positionScore, matchType: 'partial' };
  }

  // 초성 매칭
  if (isChosungOnly(query)) {
    const textChosung = getChosung(text);
    if (textChosung.includes(query)) {
      const index = textChosung.indexOf(query);
      const positionScore = Math.max(0, 30 - index);
      return { score: (isTitle ? 40 : 20) + positionScore, matchType: 'chosung' };
    }
  }

  return { score: 0, matchType: 'partial' };
};

// 검색 히스토리 관리
const HISTORY_KEY = MISC_STORAGE_KEYS.SEARCH_HISTORY;
const MAX_HISTORY = MAX_SEARCH_HISTORY;

const loadSearchHistory = (): string[] => {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveSearchHistory = (history: string[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
};

// 인기 검색어 (실제로는 서버에서 가져올 수 있음)
export const POPULAR_KEYWORDS = POPULAR_SEARCH_KEYWORDS;

export function useSupportSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 캐시된 데이터
  const [faqData, setFaqData] = useState<SearchResult[]>([]);
  const [noticeData, setNoticeData] = useState<SearchResult[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 초기 데이터 로드 (독립 요청 — FAQ/공지 한쪽 실패해도 다른 쪽 검색 가능)
  useEffect(() => {
    const loadData = async () => {
      const [faqsResult, noticesResult] = await Promise.allSettled([
        faqApi.getActiveFaqs(),
        noticeApi.getActiveNotices(),
      ]);

      if (faqsResult.status === 'fulfilled') {
        setFaqData(
          faqsResult.value.map((faq) => ({
            id: faq.id,
            type: 'faq' as const,
            title: faq.question,
            content: faq.answer,
            category: faq.category,
          }))
        );
      }

      if (noticesResult.status === 'fulfilled') {
        setNoticeData(
          noticesResult.value.map((notice) => ({
            id: notice.id,
            type: 'notice' as const,
            title: notice.title,
            content: notice.content,
            date: new Date(notice.createdAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).replace(/\. /g, '.').replace(/\.$/, ''),
          }))
        );
      }

      setIsDataLoaded(true);
    };

    loadData();
  }, []);

  // 검색 히스토리 로드
  useEffect(() => {
    setSearchHistory(loadSearchHistory());
  }, []);

  // 검색 결과 계산
  const results = useMemo<SearchResults>(() => {
    if (!debouncedQuery.trim() || !isDataLoaded) {
      return { faq: [], notice: [], total: 0 };
    }

    const searchTerm = debouncedQuery.trim().toLowerCase();
    const searchWords = searchTerm.split(/\s+/).filter(Boolean);

    // FAQ 검색
    const faqResults = faqData
      .map((item) => {
        const titleMatch = calculateScore(item.title, searchTerm, true);
        let bestScore = titleMatch.score;
        let matchType = titleMatch.matchType;

        // 단어별 매칭 추가 점수
        if (searchWords.length > 1) {
          const wordMatches = searchWords.filter(word => 
            item.title.toLowerCase().includes(word) || 
            (item.content && item.content.toLowerCase().includes(word))
          ).length;
          bestScore += wordMatches * 10;
        }

        const contentMatch = item.content ? calculateScore(item.content, searchTerm, false) : { score: 0, matchType: 'partial' as const };
        
        if (contentMatch.score > bestScore) {
          bestScore = contentMatch.score;
          matchType = contentMatch.matchType;
        }

        return {
          ...item,
          score: bestScore,
          matchType,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 8); // 리미트 증가

    // 공지사항 검색
    const noticeResults = noticeData
      .map((item) => {
        const titleMatch = calculateScore(item.title, searchTerm, true);
        const contentMatch = item.content ? calculateScore(item.content, searchTerm, false) : { score: 0, matchType: 'partial' as const };

        const bestScore = Math.max(titleMatch.score, contentMatch.score);
        const matchType = titleMatch.score >= contentMatch.score ? titleMatch.matchType : contentMatch.matchType;

        return {
          ...item,
          score: bestScore,
          matchType,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5); // 리미트 증가

    return {
      faq: faqResults,
      notice: noticeResults,
      total: faqResults.length + noticeResults.length,
    };
  }, [debouncedQuery, faqData, noticeData, isDataLoaded]);

  // 검색 중 상태 업데이트
  useEffect(() => {
    setIsSearching(query !== debouncedQuery);
  }, [query, debouncedQuery]);

  // 결과 패널 열기
  useEffect(() => {
    if (debouncedQuery.trim()) {
      setIsOpen(true);
    }
  }, [debouncedQuery]);

  // 검색어 입력 핸들러
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setIsOpen(false);
    }
  }, []);

  // 검색 히스토리에 추가
  const addToHistory = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      saveSearchHistory(updated);
      return updated;
    });
  }, []);

  // 검색 실행 (수동)
  const performSearch = useCallback((term?: string) => {
    const searchTerm = term || query;
    if (searchTerm.trim()) {
      addToHistory(searchTerm);
      setIsOpen(true);
    }
  }, [query, addToHistory]);

  // 검색 히스토리에서 삭제
  const removeFromHistory = useCallback((term: string) => {
    setSearchHistory((prev) => {
      const updated = prev.filter((item) => item !== term);
      saveSearchHistory(updated);
      return updated;
    });
  }, []);

  // 검색 히스토리 전체 삭제
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  // 검색어 초기화
  const clearSearch = useCallback(() => {
    setQuery('');
    setIsOpen(false);
  }, []);

  // 결과 패널 닫기
  const closeResults = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 검색어 선택 (히스토리/인기검색어)
  const selectKeyword = useCallback((keyword: string) => {
    setQuery(keyword);
    addToHistory(keyword);
    setIsOpen(true);
  }, [addToHistory]);

  return {
    query,
    setQuery: handleSearch,
    clearSearch,
    results,
    isSearching,
    isOpen,
    closeResults,
    performSearch,
    hasResults: results.total > 0,
    isDataLoaded,
    // 검색 히스토리
    searchHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
    selectKeyword,
    // 인기 검색어
    popularKeywords: POPULAR_KEYWORDS,
  };
}

export default useSupportSearch;
