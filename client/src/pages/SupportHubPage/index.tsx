/**
 * @file SupportHubPage/index.tsx
 * @description 통합 고객지원 페이지 - 공지사항, FAQ, 1:1 문의, 이벤트
 */
import React, { useCallback } from 'react';
import { Headphones } from 'lucide-react';
import {
  SupportTabs,
  NoticeTab,
  FaqTab,
  InquiryTab,
  EventTab,
  SupportContactBanner,
} from './components';
import { PageHeader } from '../../design-system';
import { useSupportTabs, SupportTabId } from './hooks';
import './SupportHubPage.css';

export const SupportHubPage: React.FC = () => {
  const {
    activeTab,
    category,
    expandId,
    setActiveTab,
    setCategory,
    setExpandId,
  } = useSupportTabs();

  const handleTabChange = useCallback(
    (tabId: SupportTabId) => {
      if (tabId === activeTab) return;
      setActiveTab(tabId);
    },
    [activeTab, setActiveTab]
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'notice':
        return (
          <NoticeTab
            expandId={expandId}
            onExpandChange={setExpandId}
          />
        );
      case 'faq':
        return (
          <FaqTab
            category={category}
            expandId={expandId}
            onCategoryChange={setCategory}
            onExpandChange={setExpandId}
          />
        );
      case 'inquiry':
        return <InquiryTab />;
      case 'event':
        return <EventTab />;
      default:
        return null;
    }
  };

  return (
    <div className="page-container">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="고객지원"
          subtitle="무엇을 도와드릴까요? 빠른 해결을 도와드립니다"
          icon={Headphones}
        />

        <SupportTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="mt-4 flex flex-col gap-8">
          <div
            className="min-h-[300px]"
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            <div className="support-hub-page__tab-content" key={activeTab}>
              {renderTabContent()}
            </div>
          </div>

          <div className="mb-16">
            <SupportContactBanner />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportHubPage;
