/**
 * @file KakaoFloatingButton.tsx
 * @description 카카오톡 채널 상담 연결을 위한 플로팅 액션 버튼 (FAB)
 * @module components/common
 *
 * 사용처:
 * - App.tsx 또는 Layout: 페이지 우하단에 항상 표시되어 고객 상담 채널로 바로 연결
 *
 * 동작:
 * - hover 시 "카카오톡 상담" 툴팁 노출
 * - 클릭 시 카카오 채널 URL을 새 탭으로 열어줌
 */
import React, { useState, memo } from 'react';
import { SUPPORT_CONTACT } from '../../constants/site';
import './KakaoFloatingButton.css';

export const KakaoFloatingButton: React.FC = memo(() => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="kakao-fab-container">
      {isExpanded && (
        <div className="kakao-fab-tooltip">
          <span>카카오톡 상담</span>
          <button
            type="button"
            className="kakao-fab-tooltip-close"
            onClick={() => setIsExpanded(false)}
            aria-label="닫기"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}
      <a
        href={SUPPORT_CONTACT.kakaoHref}
        target="_blank"
        rel="noopener noreferrer"
        className="kakao-fab-button"
        aria-label="카카오톡으로 상담하기"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        onClick={() => setIsExpanded(false)}
      >
        <svg
          className="kakao-fab-icon"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.722 1.803 5.108 4.517 6.451l-.96 3.544a.4.4 0 00.612.44l4.12-2.744c.556.072 1.124.109 1.711.109 5.523 0 10-3.463 10-7.8C22 6.463 17.523 3 12 3z"/>
        </svg>
      </a>
    </div>
  );
});

KakaoFloatingButton.displayName = 'KakaoFloatingButton';

export default KakaoFloatingButton;
