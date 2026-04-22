import { describe, it, expect } from 'vitest';
import { getMyPageTabsForRole, MYPAGE_TAB_CONFIG, VALID_MYPAGE_TABS } from './mypage';

describe('getMyPageTabsForRole', () => {
  it('USER 역할은 모든 탭 반환', () => {
    const tabs = getMyPageTabsForRole('USER');
    expect(tabs).toEqual(MYPAGE_TAB_CONFIG);
    expect(tabs.length).toBeGreaterThanOrEqual(4);
  });

  it('PARTNER 역할은 settings 탭만 반환', () => {
    const tabs = getMyPageTabsForRole('PARTNER');
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe('settings');
  });

  it('ADMIN 역할은 모든 탭 반환', () => {
    const tabs = getMyPageTabsForRole('ADMIN');
    expect(tabs).toEqual(MYPAGE_TAB_CONFIG);
  });

  it('undefined 역할은 모든 탭 반환', () => {
    const tabs = getMyPageTabsForRole(undefined);
    expect(tabs).toEqual(MYPAGE_TAB_CONFIG);
  });
});

describe('VALID_MYPAGE_TABS', () => {
  it('모든 유효 탭 ID 포함', () => {
    expect(VALID_MYPAGE_TABS).toContain('orders');
    expect(VALID_MYPAGE_TABS).toContain('settings');
  });

  it('MYPAGE_TAB_CONFIG의 ID와 일치', () => {
    const configIds = MYPAGE_TAB_CONFIG.map(t => t.id);
    for (const tabId of VALID_MYPAGE_TABS) {
      expect(configIds).toContain(tabId);
    }
  });
});
