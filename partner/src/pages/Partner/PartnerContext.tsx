/**
 * @file PartnerContext.tsx
 * @description Partner page context — tab state sharing between tabs
 */
import { createContext, useContext } from 'react';
import type { PartnerTab } from './constants';

interface PartnerContextType {
  activeTab: PartnerTab;
  setActiveTab: (tab: PartnerTab) => void;
}

export const PartnerContext = createContext<PartnerContextType | null>(null);

export function usePartnerContext() {
  const context = useContext(PartnerContext);
  if (!context) {
    throw new Error('usePartnerContext must be used within PartnerPage');
  }
  return context;
}
