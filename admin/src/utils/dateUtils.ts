/**
 * @file dateUtils.ts
 * @description 날짜/시간 관련 유틸리티 함수
 * @module utils
 *
 * 사용처:
 * - MyPage: 주문/매입 날짜 포맷팅
 * - OrderCard: 주문 일시 표시
 */

/**
 * 날짜를 한국어 형식으로 포맷팅 (년.월.일)
 *
 * @param date - 포맷팅할 날짜 (Date, string, number)
 * @returns 포맷팅된 문자열 (예: "2024.01.15")
 *
 * @example
 * formatDate(new Date())       // "2024.01.15"
 * formatDate('2024-01-15')     // "2024.01.15"
 */
export const formatDate = (date: Date | string | number): string => {
  const d = new Date(date);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '');
};

/**
 * 날짜를 한국어 형식으로 포맷팅 (년.월.일 시:분)
 *
 * @param date - 포맷팅할 날짜
 * @returns 포맷팅된 문자열 (예: "2024.01.15 14:30")
 */
export const formatDateTime = (date: Date | string | number): string => {
  const d = new Date(date);
  const dateStr = formatDate(d);
  const timeStr = d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr} ${timeStr}`;
};

/**
 * 상대적 시간 표시 (예: "3일 전", "방금 전")
 *
 * @param date - 비교할 날짜
 * @returns 상대적 시간 문자열
 *
 * @example
 * getRelativeTime(Date.now() - 60000)  // "1분 전"
 * getRelativeTime(Date.now() - 3600000) // "1시간 전"
 */
export const getRelativeTime = (date: Date | string | number): string => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  if (seconds < 60) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 30) return `${days}일 전`;
  if (months < 12) return `${months}개월 전`;
  return `${years}년 전`;
};

/**
 * 오늘 날짜인지 확인
 *
 * @param date - 확인할 날짜
 * @returns 오늘이면 true
 */
export const isToday = (date: Date | string | number): boolean => {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

/**
 * 날짜 범위 텍스트 생성
 *
 * @param startDate - 시작 날짜
 * @param endDate - 종료 날짜
 * @returns 날짜 범위 문자열 (예: "2024.01.01 ~ 2024.01.31")
 */
export const formatDateRange = (
  startDate: Date | string | number,
  endDate: Date | string | number
): string => {
  return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
};

/**
 * 상대적 시간 표시 (별칭)
 * @see getRelativeTime
 */
export const formatRelativeTime = getRelativeTime;
