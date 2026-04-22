/**
 * @file AdminTable.tsx
 * @description 관리자 페이지용 범용 테이블 컴포넌트 - DaisyUI table + Tailwind 유틸리티
 * @module components/admin
 *
 * 사용처:
 * - AdminPage: 사용자 관리, 주문 관리, 상품 관리 등 관리자 대시보드의 모든 테이블
 *
 * 주요 Props:
 * - columns: 컬럼 정의 배열 (key, header, width, align, render, sortable)
 * - data: 표시할 데이터 배열
 * - keyField: 각 행의 고유 키로 사용할 필드명
 * - isLoading: 로딩 상태 (true일 때 스켈레톤 표시)
 * - emptyMessage: 데이터가 없을 때 표시할 메시지
 * - caption: 테이블 접근성용 캡션 (스크린 리더 전용)
 * - pagination: 페이지네이션 설정 (currentPage, totalItems, itemsPerPage, onPageChange)
 *
 * 특징:
 * - DaisyUI table 컴포넌트 + Tailwind 유틸리티 사용
 * - 반응형: 모바일에서는 카드 뷰로 전환 (CSS로 제어)
 * - 접근성: role="table", scope 속성, aria-label, aria-live 적용
 */
import React from 'react';
import { Skeleton, Button, Result } from '../../design-system';

/**
 * 테이블 컬럼 정의 인터페이스
 * @template T - 테이블 데이터 타입
 */
export interface Column<T> {
  /** 데이터 필드 키 */
  key: string;
  /** 헤더 표시 텍스트 */
  header: string;
  /** 컬럼 너비 (CSS 값) */
  width?: string;
  /** 텍스트 정렬 */
  align?: 'left' | 'center' | 'right';
  /** 커스텀 렌더러 함수 */
  render?: (item: T) => React.ReactNode;
  /** 커스텀 헤더 렌더러 (체크박스 등) */
  headerRender?: () => React.ReactNode;
  /** 정렬 가능 여부 (미구현) */
  sortable?: boolean;
}

/**
 * AdminTable Props 인터페이스
 * @template T - 테이블 데이터 타입
 */
interface AdminTableProps<T> {
  /** 컬럼 정의 배열 */
  columns: Column<T>[];
  /** 표시할 데이터 배열 */
  data: T[];
  /** 각 행의 고유 키로 사용할 필드명 */
  keyField: keyof T;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 데이터 없을 때 메시지 */
  emptyMessage?: string;
  /** 데이터 없을 때 CTA 버튼 */
  emptyAction?: { label: string; onClick: () => void };
  /** 테이블 접근성 캡션 */
  caption?: string;
  /** 페이지네이션 설정 */
  pagination?: {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
  };
}

const ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function AdminTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  isLoading = false,
  emptyMessage = '데이터가 없습니다.',
  emptyAction,
  caption,
  pagination,
}: AdminTableProps<T>) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2" role="status" aria-busy="true" aria-label="데이터 로딩 중">
        <Skeleton height={40} className="mb-2" />
        <Skeleton height={60} className="mb-2" />
        <Skeleton height={60} className="mb-2" />
        <Skeleton height={60} />
      </div>
    );
  }

  const totalPages = pagination ? Math.ceil(pagination.totalItems / pagination.itemsPerPage) : 0;

  return (
    <div className="w-full overflow-x-auto">
      <table
        className="table table-zebra w-full min-w-[600px]"
        role="table"
        aria-label={caption || '데이터 테이블'}
      >
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`${ALIGN_CLASS[col.align || 'left']} whitespace-nowrap`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.headerRender ? col.headerRender() : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item) => (
              <tr
                key={String(item[keyField])}
                className="hover"
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={`${String(item[keyField])}-${col.key}`}
                    className={`${ALIGN_CLASS[col.align || 'left']} align-middle`}
                    {...(colIndex === 0 ? { scope: 'row' } : {})}
                  >
                    {col.render ? col.render(item) : item[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center">
                <Result icon="info" title={emptyMessage} />
                {emptyAction && (
                  <div className="mt-3">
                    <Button variant="secondary" size="sm" onClick={emptyAction.onClick}>{emptyAction.label}</Button>
                  </div>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pagination && totalPages > 1 && (
        <nav
          aria-label="테이블 페이지네이션"
          className="flex justify-between items-center gap-2 p-4 border-t border-base-200"
        >
          <span className="text-xs text-base-content/50" aria-live="polite" aria-atomic="true">
            {pagination.totalItems}건 중 {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}-{Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              aria-label="이전 페이지"
            >
              Prev
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(pagination.currentPage - 2, totalPages - 4));
              const pageNum = start + i;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => pagination.onPageChange(pageNum)}
                  className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                    pageNum === pagination.currentPage
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  aria-label={`${pageNum}페이지`}
                  aria-current={pageNum === pagination.currentPage ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.currentPage >= totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              aria-label="다음 페이지"
            >
              Next
            </Button>
          </div>
        </nav>
      )}

      {/* 모바일 카드 뷰 */}
      <div className="admin-table-cards hidden">
        {data.map((item) => (
          <div
            key={String(item[keyField])}
            className="admin-table-card p-4 border-b border-base-200 bg-base-100"
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex justify-between items-start py-2"
              >
                <span className="text-xs text-base-content/50 font-medium">
                  {col.header}
                </span>
                <span className="text-sm text-base-content text-right">
                  {col.render ? col.render(item) : item[col.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
