import { registerAs } from '@nestjs/config';

export interface KycConfig {
  coocon: {
    baseUrl: string;
    /** Coocon 서버 루트 URL (KCB 엔드포인트용, baseUrl에서 /api/coocon 제거) */
    serverUrl: string;
    /** Coocon 회사 코드 */
    company: string;
    timeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
  };
}

export default registerAs('kyc', (): KycConfig => {
  const baseUrl =
    process.env.COOCON_API_URL || 'http://103.97.209.176:8091/api/coocon';
  // KCB 엔드포인트는 /api/kcb/... 경로에 있으므로 /api/coocon 제거
  const serverUrl = baseUrl.replace(/\/api\/coocon\/?$/, '');

  return {
    coocon: {
      baseUrl,
      serverUrl,
      company: process.env.COOCON_COMPANY || 'gift',
      timeoutMs: parseInt(process.env.COOCON_API_TIMEOUT_MS || '10000', 10),
      maxRetries: parseInt(process.env.COOCON_API_MAX_RETRIES || '3', 10),
      retryDelayMs: parseInt(
        process.env.COOCON_API_RETRY_DELAY_MS || '1000',
        10,
      ),
    },
  };
});
