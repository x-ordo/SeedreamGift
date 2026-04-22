/**
 * @file SupportContactBanner/index.tsx
 * @description 고객지원 연락처 배너 — daisyUI card + responsive
 */
import React from 'react';
import { Headphones, Phone, Mail } from 'lucide-react';
import { SUPPORT_CONTACT } from '../../../../constants';

export const SupportContactBanner: React.FC = () => {
  return (
    <div className="card rounded-box w-full" role="region" aria-label="고객센터 연락처" style={{ background: 'white', border: '1px solid var(--color-grey-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.02)' }}>
      <div className="card-body items-center gap-2.5 sm:gap-3 w-full p-4 sm:p-5">
        <div className="text-center">
          <h2 className="flex items-center justify-center gap-1.5 text-xs font-bold text-base-content/80 mb-0.5">
            <Headphones size={14} className="text-primary" aria-hidden="true" />
            더 궁금한 점이 있으신가요?
          </h2>
          <p className="text-xs text-base-content/50 m-0 break-keep">
            고객센터로 문의해주세요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full">
          {/* 전화문의 */}
          <div className="card rounded-box hover:-translate-y-1 hover:shadow-md transition-[transform,box-shadow] duration-200" style={{ background: 'white', border: '1px solid var(--color-grey-100)', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.02)' }}>
            <div className="card-body flex-row sm:flex-col items-center gap-3 p-3 sm:p-4">
              <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-info/10 text-info rounded-xl flex-shrink-0">
                <Phone size={16} aria-hidden="true" />
              </div>
              <div className="flex flex-col sm:items-center gap-0.5">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">전화문의</span>
                <a
                  href={SUPPORT_CONTACT.phoneHref}
                  aria-label={`고객센터 전화 ${SUPPORT_CONTACT.phone}`}
                  className="text-xs font-bold text-base-content hover:text-primary transition-colors duration-200"
                >
                  {SUPPORT_CONTACT.phone}
                </a>
                <span className="text-xs text-base-content/40">{SUPPORT_CONTACT.phoneHours}</span>
              </div>
            </div>
          </div>

          {/* 이메일 */}
          <div className="card rounded-box hover:-translate-y-1 hover:shadow-md transition-[transform,box-shadow] duration-200" style={{ background: 'white', border: '1px solid var(--color-grey-100)', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.02)' }}>
            <div className="card-body flex-row sm:flex-col items-center gap-3 p-3 sm:p-4">
              <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-success/10 text-success rounded-xl flex-shrink-0">
                <Mail size={16} aria-hidden="true" />
              </div>
              <div className="flex flex-col sm:items-center gap-0.5">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">이메일</span>
                <a
                  href={SUPPORT_CONTACT.emailHref}
                  aria-label={`이메일 문의 ${SUPPORT_CONTACT.email}`}
                  className="text-xs font-bold text-base-content hover:text-primary transition-colors duration-200"
                >
                  {SUPPORT_CONTACT.email}
                </a>
                <span className="text-xs text-base-content/40">{SUPPORT_CONTACT.emailHours}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportContactBanner;
