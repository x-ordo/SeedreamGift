/**
 * @file useCheckboxSelect.ts
 * @description 체크박스 다중 선택 훅 — OrdersTab, GiftsTab의 중복 Set 기반 선택 로직 캡슐화
 */
import { useState, useMemo, useCallback } from 'react';

interface UseCheckboxSelectReturn<T> {
  /** 선택된 ID Set */
  selectedIds: Set<number>;
  /** 전체 선택 여부 */
  allSelected: boolean;
  /** 개별 항목 선택/해제 토글 */
  toggleSelect: (id: number) => void;
  /** 전체 선택/해제 토글 */
  toggleSelectAll: () => void;
  /** 선택 초기화 */
  clearSelection: () => void;
  /** 선택된 항목들만 필터링하여 반환 */
  getSelectedItems: (items: T[]) => T[];
}

/**
 * 체크박스 다중 선택 훅
 * @param items - 현재 표시 중인 아이템 목록
 * @param getId - 아이템에서 ID를 추출하는 함수
 */
export function useCheckboxSelect<T>(
  items: T[],
  getId: (item: T) => number,
): UseCheckboxSelectReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const allSelected = useMemo(
    () => items.length > 0 && items.every(item => selectedIds.has(getId(item))),
    [items, selectedIds, getId],
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (items.length > 0 && items.every(item => selectedIds.has(getId(item)))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => getId(item))));
    }
  }, [items, selectedIds, getId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const getSelectedItems = useCallback(
    (allItems: T[]) => allItems.filter(item => selectedIds.has(getId(item))),
    [selectedIds, getId],
  );

  return { selectedIds, allSelected, toggleSelect, toggleSelectAll, clearSelection, getSelectedItems };
}
