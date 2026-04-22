import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramAlertService {
  private readonly logger = new Logger(TelegramAlertService.name);
  private readonly botToken?: string;
  private readonly chatId?: string;
  private readonly enabled: boolean;

  /** 중복 알림 방지: path+message → 마지막 전송 시각 */
  private readonly recentAlerts = new Map<string, number>();
  private static readonly DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5분

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');
    this.enabled = !!(this.botToken && this.chatId);

    if (!this.enabled) {
      this.logger.log(
        'Telegram alerts disabled (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set)',
      );
    }
  }

  /**
   * 5xx 에러 발생 시 Telegram 알림 전송 (fire-and-forget)
   * 동일 에러는 5분 내 중복 전송하지 않음
   */
  sendAlert(data: {
    method: string;
    path: string;
    statusCode: number;
    message: string;
    traceId?: string;
  }): void {
    if (!this.enabled) return;

    // 중복 알림 체크
    const dedupeKey = `${data.path}:${data.message}`;
    const lastSent = this.recentAlerts.get(dedupeKey);
    const now = Date.now();

    if (lastSent && now - lastSent < TelegramAlertService.DEDUP_WINDOW_MS) {
      return;
    }
    this.recentAlerts.set(dedupeKey, now);

    // 오래된 항목 정리 (메모리 누수 방지)
    if (this.recentAlerts.size > 100) {
      for (const [key, time] of this.recentAlerts) {
        if (now - time > TelegramAlertService.DEDUP_WINDOW_MS) {
          this.recentAlerts.delete(key);
        }
      }
    }

    const text = [
      `🚨 <b>[${process.env.SITE_BRAND || 'W GIFT'}] ${data.statusCode} Error</b>`,
      `<b>Path:</b> ${data.method} ${data.path}`,
      `<b>Message:</b> ${this.escapeHtml(data.message)}`,
      data.traceId ? `<b>TraceId:</b> ${data.traceId}` : null,
      `<b>Time:</b> ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join('\n');

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    // fire-and-forget: 알림 실패가 요청을 블로킹하지 않음
    this.httpService.axiosRef
      .post(url, {
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
      })
      .catch((err) => {
        this.logger.warn(`Telegram alert failed: ${err.message}`);
      });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
