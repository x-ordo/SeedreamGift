/**
 * @file SupportTabs/index.tsx
 * @description 고객지원 탭 네비게이션 — daisyUI tabs
 */
import React from 'react';
import { SUPPORT_TABS, SupportTabId } from '../../hooks';
import './SupportTabs.css';

interface SupportTabsProps {
  activeTab: SupportTabId;
  onTabChange: (tabId: SupportTabId) => void;
}

export const SupportTabs: React.FC<SupportTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="support-tabs sticky top-[var(--header-height)] z-[var(--z-sticky)] bg-base-100/95 backdrop-blur-sm rounded-box"
      aria-label="고객지원 탭"
    >
      <div role="tablist" className="tabs flex-row! flex-nowrap overflow-x-auto scrollbar-none">
        {SUPPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`tab flex-1 gap-1.5 sm:gap-2 text-xs sm:text-sm min-h-[44px] whitespace-nowrap ${
              activeTab === tab.id
                ? 'tab-active text-primary font-semibold'
                : 'text-base-content/40 hover:text-base-content/70'
            }`}
            onClick={() => onTabChange(tab.id)}
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
          >
            <tab.icon size={16} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default SupportTabs;
