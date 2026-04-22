/**
 * @file maskUtils.ts
 * @description 개인정보 마스킹 유틸리티
 * @module utils
 */

/**
 * 이메일 주소의 로컬 부분을 일부 마스킹 처리합니다.
 * @description
 * 사용자 개인정보 보호를 위해 이메일 아이디의 앞 3글자만 표시하고 나머지는 '*'로 대체합니다.
 * @param {string | undefined | null} email 마스킹할 원본 이메일 주소
 * @returns {string} 마스킹된 이메일 (예: 'adm***@example.com')
 * @example
 * maskEmail('admin@example.com') → 'adm***@example.com'
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  const visible = Math.min(3, local.length);
  return `${local.slice(0, visible)}***@${domain}`;
}
