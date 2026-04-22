import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * 모든 string 필드의 앞뒤 공백을 제거하는 전역 파이프.
 * body 객체의 모든 string 값에 .trim()을 적용합니다.
 */
@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' || !value || typeof value !== 'object') {
      return value;
    }
    return this.trimDeep(value);
  }

  private trimDeep(obj: any): any {
    if (typeof obj === 'string') return obj.trim();
    if (Array.isArray(obj)) return obj.map((item) => this.trimDeep(item));
    if (obj && typeof obj === 'object') {
      const trimmed: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        trimmed[key] = this.trimDeep(val);
      }
      return trimmed;
    }
    return obj;
  }
}
