/**
 * @file usePartnerList.ts
 * @description Partner list page common hook — data load + pagination + loading state
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { PARTNER_PAGINATION } from '../constants';

interface PaginatedResponse<T> {
  items?: T[];
  meta?: { total?: number };
}

interface UsePartnerListOptions {
  filters?: Record<string, string | number | undefined>;
  pageSize?: number;
  errorMessage?: string;
  disabled?: boolean;
}

interface UsePartnerListReturn<T> {
  items: T[];
  loading: boolean;
  page: number;
  total: number;
  setPage: (page: number) => void;
  reload: () => void;
}

export function usePartnerList<T>(
  fetcher: (params: Record<string, any>) => Promise<PaginatedResponse<T> | T[] | any>,
  options: UsePartnerListOptions = {},
): UsePartnerListReturn<T> {
  const {
    filters = {},
    pageSize = PARTNER_PAGINATION.DEFAULT_PAGE_SIZE,
    errorMessage = '데이터를 불러오는데 실패했습니다.',
    disabled = false,
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(!disabled);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const { showToast } = useToast();

  // Reset page on filter change
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
      const params: Record<string, any> = { page, limit: pageSize };
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') {
          params[key] = value;
        }
      }

      const res = await fetcher(params);

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
