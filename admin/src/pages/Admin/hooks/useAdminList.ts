/**
 * @file useAdminList.ts
 * @description 어드민 리스트 페이지 공통 훅 — 데이터 로드 + 페이지네이션 + 로딩 상태
 *
 * 13개 어드민 탭의 반복되는 loadData + pagination 패턴을 캡슐화.
 *
 * @example
 * const { items, loading, page, total, setPage, reload } = useAdminList(
 *   (params) => adminApi.getAllOrders(params),
 *   { filters: { status: statusFilter }, pageSize: 20, errorMessage: '주문 목록을 불러오는데 실패했습니다.' }
 * );
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { ADMIN_PAGINATION } from '../constants';

interface PaginatedResponse<T> {
  items?: T[];
  meta?: { total?: number };
}

interface UseAdminListOptions {
  /** 서버에 전달할 필터 파라미터 (status, category 등) */
  filters?: Record<string, string | number | undefined>;
  /** 페이지 크기 (기본값: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE) */
  pageSize?: number;
  /** 에러 발생 시 토스트 메시지 */
  errorMessage?: string;
  /** 데이터 자동 로드 비활성화 */
  disabled?: boolean;
}

interface UseAdminListReturn<T> {
  items: T[];
  loading: boolean;
  page: number;
  total: number;
  setPage: (page: number) => void;
  reload: () => void;
}

/**
 * 어드민 리스트 공통 훅
 *
 * @param fetcher - API 호출 함수. PaginatedResponse<T> 또는 T[]를 반환.
 * @param options - 필터, 페이지 크기, 에러 메시지 등
 */
export function useAdminList<T>(
  fetcher: (params: Record<string, any>) => Promise<PaginatedResponse<T> | T[] | any>,
  options: UseAdminListOptions = {},
): UseAdminListReturn<T> {
  const {
    filters = {},
    pageSize = ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
    errorMessage = '데이터를 불러오는데 실패했습니다.',
    disabled = false,
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(!disabled);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const { showToast } = useToast();

  // 필터 변경 시 페이지 리셋
  const prevFiltersRef = useRef(JSON.stringify(filters));
  useEffect(() => {
    const serialized = JSON.stringify(filters);
    if (serialized !== prevFiltersRef.current) {
      prevFiltersRef.current = serialized;
      setPage(1);
    }
  }, [filters]);

  const loadData = useCallback(async () => {
    if (disabled) return;
    setLoading(true);
    try {
      // 유효한 필터만 포함
      const params: Record<string, any> = { page, limit: pageSize };
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') {
          params[key] = value;
        }
      }

      const res = await fetcher(params);

      // 다양한 응답 형태 처리
      if (Array.isArray(res)) {
        setItems(res);
        setTotal(res.length);
      } else {
        setItems(res?.items ?? []);
        setTotal(res?.meta?.total ?? 0);
      }
    } catch {
      showToast({ message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, disabled, JSON.stringify(filters)]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { items, loading, page, total, setPage, reload: loadData };
}
