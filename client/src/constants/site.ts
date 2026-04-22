/**
 * @file site.ts
 * @description 사이트 전역 상수 — site.config.json에서 통합 관리
 *
 * 사업자정보, 연락처, 매입 수령 주소 등은 모두 `/src/site.config.json` 에서 관리합니다.
 * 이 파일은 JSON을 import하여 기존 상수 인터페이스를 유지합니다.
 */
import siteConfig from '../../../site.config.json';

/** 고객센터 연락처 */
export const SUPPORT_CONTACT = {
  phone: siteConfig.contact.phone,
  phoneHref: siteConfig.contact.phoneHref,
  phoneHours: siteConfig.contact.phoneHours,
  kakao: siteConfig.contact.kakao,
  kakaoHref: siteConfig.contact.kakaoHref,
  kakaoHours: siteConfig.contact.kakaoHours,
  email: siteConfig.contact.email,
  emailHref: siteConfig.contact.emailHref,
  emailHours: siteConfig.contact.emailHours,
} as const;

/** 회사 정보 (사업자등록 기준) */
export const COMPANY_INFO = {
  name: siteConfig.company.name,
  nameShort: siteConfig.company.nameShort,
  owner: siteConfig.company.owner,
  licenseNo: siteConfig.company.licenseNo,
  address: siteConfig.company.address,
} as const;

/**
 * 결제 은행 계좌 정보
 * @deprecated SiteConfig DB로 이관됨. useBankInfo() 훅 사용. fallback용으로만 유지.
 */
export const PAYMENT_BANK_INFO = {
  bankName: '',
  accountNumber: '',
  accountHolder: '',
} as const;

/** 이미지 플레이스홀더 URL */
export const IMAGE_PLACEHOLDER_URL = 'https://placehold.co/300x300?text=No+Image';

/** 히어로/파티클 기본 색상 */
export const PARTICLE_COLORS = ['#3182F6', '#FFBB00', '#22C55E', '#FF6B6B', '#A855F7'] as const;

/** 상품권 매입(판매) 수령 주소 */
export const TRADEIN_RECEIVING_ADDRESS = {
  recipient: siteConfig.tradeIn.recipientName,
  zipCode: siteConfig.tradeIn.zipCode,
  address: siteConfig.tradeIn.address,
  phone: siteConfig.tradeIn.phone,
  notice: siteConfig.tradeIn.notice,
} as const;

/** SEO 기본 설정 */
export const SEO_DEFAULTS = siteConfig.seo;

/** 개인정보보호 담당자 */
export const PRIVACY_OFFICER = siteConfig.privacy;

/** URL 설정 */
export const SITE_URLS = siteConfig.urls;

/** 인기 검색어 */
export const POPULAR_SEARCH_KEYWORDS = ['환불', '배송', '회원탈퇴', '상품권 사용', '매입', 'PIN번호'] as const;

/** 전체 설정 객체 (직접 접근 필요 시) */
export { siteConfig };
