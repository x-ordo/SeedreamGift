/**
 * @file QuickMenu.tsx
 * @description 홈 화면 퀵 메뉴 (서비스 바로가기)
 * @module components/home
 */
import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Building, MapPin, Headphones } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './QuickMenu.css';

interface QuickMenuItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isExternal?: boolean;
}

const QuickMenuItem: React.FC<QuickMenuItemProps> = ({ to, icon: IconComp, label, isExternal }) => {
  if (isExternal) {
    return (
      <a href={to} className="quick-menu-item" target="_blank" rel="noopener noreferrer">
        <div className="quick-menu-icon">
          <IconComp size={24} aria-hidden="true" />
        </div>
        <span className="quick-menu-label">{label}</span>
      </a>
    );
  }

  return (
    <Link to={to} className="quick-menu-item">
      <div className="quick-menu-icon">
        <IconComp size={24} aria-hidden="true" />
      </div>
      <span className="quick-menu-label">{label}</span>
    </Link>
  );
};

export const QuickMenu: React.FC = memo(() => {
  const menuItems = [
    {
      id: 'rates',
      to: '/rates',
      icon: TrendingUp,
      label: '시세조회',
    },
    {
      id: 'bulk',
      to: '/support?tab=inquiry', // 대량/기업 문의 (임시 경로)
      icon: Building, // 기업 아이콘
      label: '기업/대량',
    },
    {
      id: 'branch',
      to: '/support?tab=location', // 지점 안내 (임시 경로)
      icon: MapPin, // 지도 아이콘
      label: '매장찾기',
    },
    {
      id: 'help',
      to: '/support', // 고객센터
      icon: Headphones, // 상담 아이콘
      label: '고객센터',
    },
  ];

  return (
    <nav className="quick-menu-container" aria-label="주요 서비스 메뉴">
      <div className="quick-menu-grid">
        {menuItems.map((item) => (
          <QuickMenuItem
            key={item.id}
            to={item.to}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </div>
    </nav>
  );
});

QuickMenu.displayName = 'QuickMenu';
export default QuickMenu;
