/**
 * @file maskUtils.ts
 * @description 개인정보 마스킹 유틸리티
 * @module utils
 */

/**
 * 이메일 주소 마스킹
 * @example maskEmail('admin@example.com') → 'adm***@example.com'
 * @example maskEmail('ab@example.com') → 'ab***@example.com'
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  const visible = Math.min(3, local.length);
  return `${local.slice(0, visible)}***@${domain}`;
}
