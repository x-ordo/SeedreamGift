import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, getRelativeTime, isToday } from './dateUtils';

describe('formatDate', () => {
  it('Date 객체를 한국어 형식으로 포맷', () => {
    const date = new Date(2026, 2, 15); // 2026-03-15
    const result = formatDate(date);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/03/);
    expect(result).toMatch(/15/);
  });

  it('ISO 문자열 처리', () => {
    const result = formatDate('2026-01-01T00:00:00Z');
    expect(result).toMatch(/2026/);
  });
});

describe('getRelativeTime', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('방금 전 (60초 미만)', () => {
    const now = Date.now();
    expect(getRelativeTime(now - 30000)).toBe('방금 전');
  });

  it('N분 전', () => {
    const now = Date.now();
    expect(getRelativeTime(now - 5 * 60 * 1000)).toBe('5분 전');
  });

  it('N시간 전', () => {
    const now = Date.now();
    expect(getRelativeTime(now - 3 * 60 * 60 * 1000)).toBe('3시간 전');
  });

  it('N일 전', () => {
    const now = Date.now();
    expect(getRelativeTime(now - 7 * 24 * 60 * 60 * 1000)).toBe('7일 전');
  });
});

describe('isToday', () => {
  it('오늘 날짜면 true', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('어제면 false', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });
});
