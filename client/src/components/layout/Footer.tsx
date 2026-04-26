/**
 * @file Footer.tsx
 * @description 미니멀 푸터 — 토스/뱅크샐러드 스타일
 */
import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { COMPANY_INFO, SUPPORT_CONTACT, siteConfig } from '../../constants/site';
import Logo from '../common/Logo';
import './Footer.css';

export const Footer: React.FC = memo(() => {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        {/* ── Row 1: 로고 + 네비게이션 + 연락처 ── */}
        <div className="footer-top">
          {/* 로고 & 슬로건 */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo-link" aria-label="홈으로 이동">
              <Logo size={24} />
            </Link>
            <p className="footer-slogan">
              빠르고 안전한 상품권 직거래
            </p>
          </div>

          {/* 서비스 & 고객지원 — 2그룹을 가로 나열 */}
          <nav className="footer-nav" aria-label="하단 네비게이션">
            <div className="footer-nav-group">
              <Link to="/products">상품권 구매</Link>
              <Link to="/trade-in">상품권 판매</Link>
              <Link to="/rates">실시간 시세</Link>
            </div>
            <div className="footer-nav-group">
              <Link to="/support">고객센터</Link>
              <Link to="/support?tab=faq">자주 묻는 질문</Link>
              <Link to="/support?tab=notice">공지사항</Link>
            </div>
          </nav>

          {/* 연락처 */}
          <div className="footer-contact">
            <a href={SUPPORT_CONTACT.phoneHref} className="footer-phone">
              {SUPPORT_CONTACT.phone}
            </a>
            <span className="footer-hours">{SUPPORT_CONTACT.phoneHours}</span>
          </div>
        </div>

        {/* ── 구분선 ── */}
        <hr className="footer-divider" />

        {/* ── Row 2: 사업자 정보 + 법적 링크 ── */}
        <div className="footer-bottom">
          <div className="footer-legal-info">
            <span>{COMPANY_INFO.name}</span>
            <span className="footer-sep" aria-hidden="true" />
            <span>대표: {COMPANY_INFO.owner}</span>
            <span className="footer-sep" aria-hidden="true" />
            <span>사업자번호: {COMPANY_INFO.licenseNo}</span>
            <span className="footer-sep" aria-hidden="true" />
            <span>{COMPANY_INFO.address}</span>
          </div>

          <div className="footer-bottom-row">
            <div className="footer-legal-links">
              <Link to="/legal/terms">이용약관</Link>
              <Link to="/legal/privacy" className="footer-privacy">개인정보처리방침</Link>
              <Link to="/legal/refund">환불/교환 정책</Link>
              <a
                href={`https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${COMPANY_INFO.licenseNo.replace(/-/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                사업자등록 확인
              </a>
            </div>
            <p className="footer-copyright">
              &copy; {new Date().getFullYear()} {siteConfig.company.nameShort}
              <span className="footer-sep" aria-hidden="true" />
              <a
                href="https://dnwgroup.biz"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-parent-link"
              >
                회사 홈페이지
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
