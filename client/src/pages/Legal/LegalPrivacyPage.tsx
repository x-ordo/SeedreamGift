import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../components/common/SEO';
import { Card } from '../../design-system';
import siteConfig from '../../../../site.config.json';
import { PRIVACY_POLICY } from '../../constants/legal';
import { parseLegalText } from '../../utils/parseLegalText';
import { axiosInstance } from '../../lib/axios';

const LegalPrivacyPage: React.FC = () => {
  const [content, setContent] = useState<string>(PRIVACY_POLICY);
  const [title, setTitle] = useState('개인정보처리방침');

  useEffect(() => {
    axiosInstance.get('/policies/PRIVACY')
      .then(res => {
        const policy = res.data?.data || res.data;
        if (policy?.content) {
          setContent(policy.content);
          if (policy.title) setTitle(policy.title);
        }
      })
      .catch(() => {
        // API 실패 시 기존 상수 사용 (fallback)
      });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 mt-8 sm:mt-12 mb-12">
      <SEO title={title} description={`${siteConfig.company.brand} ${title}`} />
      <Card className="p-4 sm:p-6 shadow-md rounded-2xl">
        <h1 className="font-bold mb-1" style={{ fontSize: 'var(--text-title, 22px)' }}>
          {title}
        </h1>
        <p className="text-base-content/50 text-xs sm:text-sm mb-4">시행일: 2025년 1월 1일</p>
        <article className="legal-content">
          {parseLegalText(content)}
        </article>
        <div className="mt-4 text-center">
          <Link to="/" className="no-underline text-base-content/50 text-xs sm:text-sm hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default LegalPrivacyPage;
