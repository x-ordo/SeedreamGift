#!/usr/bin/env node
/**
 * site.config.json 필수 필드 검증 스크립트
 * 빌드 전에 실행하여 사업자 정보 누락을 사전에 차단합니다.
 *
 * 사용: node scripts/validate-site-config.js
 * CI/CD: pnpm build 전에 자동 실행
 */
const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, '..', 'site.config.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ site.config.json 파일이 없습니다:', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 필수 필드 정의: [경로, 설명]
const requiredFields = [
  // 회사 정보
  ['company.name', '회사명'],
  ['company.nameShort', '회사 약칭'],
  ['company.owner', '대표자명'],
  ['company.licenseNo', '사업자등록번호'],
  ['company.address', '회사 주소'],

  // 연락처
  ['contact.phone', '대표 전화번호'],
  ['contact.email', '고객 문의 이메일'],

  // 개인정보
  ['privacy.officer', '개인정보보호책임자'],
  ['privacy.handler', '개인정보처리담당자'],
  ['privacy.email', '개인정보 문의 이메일'],

  // URL
  ['urls.domain', '서비스 도메인'],
  ['urls.home', '홈페이지 URL'],

  // 매입 수령
  ['tradeIn.recipientName', '매입 수령자명'],
  ['tradeIn.address', '매입 수령 주소'],
  ['tradeIn.phone', '매입 연락처'],
];

let hasError = false;

for (const [fieldPath, label] of requiredFields) {
  const keys = fieldPath.split('.');
  let value = config;
  for (const key of keys) {
    value = value?.[key];
  }

  if (!value || (typeof value === 'string' && value.trim() === '')) {
    console.error(`❌ [${fieldPath}] ${label} — 비어있거나 누락됨`);
    hasError = true;
  }
}

if (hasError) {
  console.error('\n🚫 site.config.json 필수 필드가 누락되었습니다. 빌드를 중단합니다.');
  console.error('   파일 위치:', configPath);
  process.exit(1);
} else {
  console.log('✅ site.config.json 검증 통과 —', requiredFields.length, '개 필수 필드 확인');
}
