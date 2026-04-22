import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Shield,
  Users,
  ScrollText,
  Clock,
  Settings,
  RefreshCw,
  Power,
  Server,
  Lock,
  Package,
  Globe,
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import LogViewer from './components/LogViewer';
import IPSecurity from './components/IPSecurity';
import Sessions from './components/Sessions';
import AuditLog from './components/AuditLog';
import CronJobs from './components/CronJobs';
import ServerControl from './components/ServerControl';
import SecuritySettings from './components/SecuritySettings';
import StockAlerts from './components/StockAlerts';
import ServerInfo from './components/ServerInfo';
import { RestartServer, ShutdownServer } from '../wailsjs/go/gui/App';

/**
 * 탭 식별자 타입
 */
type TabId = 'dashboard' | 'logs' | 'ip-security' | 'sessions' | 'audit' | 'cron' | 'security' | 'stock-alerts' | 'server-info' | 'server';

/**
 * 네비게이션 항목 인터페이스
 */
interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

/**
 * 네비게이션 메뉴 구성
 */
const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={16} /> },
  { id: 'logs', label: '이벤트 뷰어', icon: <FileText size={16} /> },
  { id: 'ip-security', label: 'IP 보안', icon: <Shield size={16} /> },
  { id: 'sessions', label: '세션 관리', icon: <Users size={16} /> },
  { id: 'audit', label: '감사 로그', icon: <ScrollText size={16} /> },
  { id: 'cron', label: '예약 작업', icon: <Clock size={16} /> },
  { id: 'security', label: '보안 설정', icon: <Lock size={16} /> },
  { id: 'stock-alerts', label: '재고 알림', icon: <Package size={16} /> },
  { id: 'server-info', label: '서버 환경', icon: <Globe size={16} /> },
  { id: 'server', label: '서버 관리', icon: <Settings size={16} /> },
];

/**
 * 애플리케이션 메인 컴포넌트
 * 사이드바 네비게이션과 메인 콘텐츠 영역을 관리합니다.
 */
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);

  const handleRestart = async () => {
    if (!restartConfirm) {
      setRestartConfirm(true);
      setTimeout(() => setRestartConfirm(false), 3000);
      return;
    }
    setRestartConfirm(false);
    await RestartServer();
  };

  const handleStop = async () => {
    if (!stopConfirm) {
      setStopConfirm(true);
      setTimeout(() => setStopConfirm(false), 3000);
      return;
    }
    setStopConfirm(false);
    await ShutdownServer();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':    return <Dashboard />;
      case 'logs':         return <LogViewer />;
      case 'ip-security':  return <IPSecurity />;
      case 'sessions':     return <Sessions />;
      case 'audit':        return <AuditLog />;
      case 'cron':         return <CronJobs />;
      case 'security':     return <SecuritySettings />;
      case 'stock-alerts': return <StockAlerts />;
      case 'server-info':  return <ServerInfo />;
      case 'server':       return <ServerControl />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F3F4F6] text-[#1F2937] select-none" style={{ fontFamily: "'Pretendard Variable', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <div className="w-60 bg-white border-r border-[#E5E7EB] flex flex-col shadow-sm z-10 flex-shrink-0">
        {/* Sidebar header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-blue-200 shadow-lg">
              <Server size={18} />
            </div>
            <div>
              <span className="text-[15px] font-black text-[#111827] leading-none block">서버 제어판</span>
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-1">SeedreamGift API v2.1</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] rounded-xl text-left transition-all duration-200',
                      isActive
                        ? 'bg-[#EFF6FF] text-[#2563EB] font-bold'
                        : 'hover:bg-[#F9FAFB] text-[#4B5563] font-medium hover:text-[#1F2937]',
                    ].join(' ')}
                  >
                    <span className={isActive ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}>{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom action buttons */}
        <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
          <button
            onClick={handleRestart}
            className={[
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[12px] font-bold border rounded-xl shadow-sm transition-all active:scale-95',
              restartConfirm
                ? 'bg-[#FEF3C7] border-[#FCD34D] text-[#92400E]'
                : 'border-[#E5E7EB] bg-white hover:bg-white hover:shadow-md text-[#374151]',
            ].join(' ')}
          >
            <RefreshCw size={14} className={restartConfirm ? 'animate-spin' : 'text-[#2563EB]'} />
            {restartConfirm ? '다시 클릭하여 확인' : '서비스 재시작'}
          </button>
          <button
            onClick={handleStop}
            className={[
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[12px] font-bold border rounded-xl shadow-sm transition-all active:scale-95',
              stopConfirm
                ? 'bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B]'
                : 'border-[#E5E7EB] bg-white hover:bg-[#FEE2E2] hover:border-[#FCA5A5] text-[#DC2626]',
            ].join(' ')}
          >
            <Power size={14} />
            {stopConfirm ? '중지 확인 (클릭!)' : '서비스 중지'}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden bg-white m-3 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col min-w-0 animate-fade">
        {renderContent()}
      </div>
    </div>
  );
};

export default App;
