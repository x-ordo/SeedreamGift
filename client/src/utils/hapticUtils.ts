/**
 * @file hapticUtils.ts
 * @description 햅틱 피드백 및 사운드 유틸리티
 * @module utils
 *
 * 사용처:
 * - ToastContext: 토스트 알림 시 진동/사운드 피드백
 * - TradeInFormView: 매입 신청 시 촉각 피드백
 * - 장바구니 추가/삭제 등 인터랙션 피드백
 */

/**
 * 진동 패턴 프리셋 (밀리초 단위)
 * - 단일 숫자: 지속 시간
 * - 배열: [진동, 휴식, 진동, ...] 패턴
 */
export const VIBRATION_PATTERNS = {
    /** 짧은 탭 피드백 (50ms) */
    tap: 50,
    /** 성공 피드백 (100ms) */
    success: 100,
    /** 경고 피드백 (100ms, 50ms gap, 100ms) */
    warning: [100, 50, 100],
    /** 에러 피드백 (200ms, 100ms gap, 200ms) */
    error: [200, 100, 200],
    /** 알림 피드백 (100ms, 30ms gap, 100ms, 30ms gap, 100ms) */
    notification: [100, 30, 100, 30, 100],
} as const;

/**
 * 디바이스 진동 피드백
 * @param pattern 진동 패턴 (밀리초 단위 숫자 또는 배열)
 * @returns 진동 실행 성공 여부
 */
export const vibrate = (pattern: number | number[]): boolean => {
    // 브라우저 지원 확인
    if (!('vibrate' in navigator)) {
        return false;
    }

    // 사용자 인터랙션 전에는 Chrome이 vibrate를 차단함
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
        return false;
    }

    // prefers-reduced-motion 확인
    if (typeof window !== 'undefined') {
        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        if (prefersReducedMotion) {
            return false;
        }
    }

    try {
        navigator.vibrate(pattern);
        return true;
    } catch {
        return false;
    }
};

/** 지원되는 사운드 타입 */
export type SoundType = 'success' | 'error' | 'warning' | 'notification' | 'click';

/** 사운드 타입별 기본 파일 경로 */
const DEFAULT_AUDIO_PATHS: Record<SoundType, string> = {
    success: '/audio/success.mp3',
    error: '/audio/error.mp3',
    warning: '/audio/warning.mp3',
    notification: '/audio/notification.mp3',
    click: '/audio/click.mp3',
};

/** playSound 옵션 */
export interface PlaySoundOptions {
    /** 볼륨 (0-1, 기본값 0.3) */
    volume?: number;
    /** 오디오 파일 기본 경로 (기본: '/audio') */
    basePath?: string;
}

/**
 * 사운드 캐시 (Audio 요소 재사용)
 * - 동일 사운드 반복 재생 시 성능 최적화
 */
const soundCache = new Map<string, HTMLAudioElement>();

/**
 * 사운드 효과 재생
 * @param type 사운드 타입
 * @param options 볼륨 및 경로 옵션 (또는 볼륨 숫자, 하위 호환)
 * @returns Promise<boolean> 재생 성공 여부
 */
export const playSound = async (
    type: SoundType,
    options: number | PlaySoundOptions = {}
): Promise<boolean> => {
    const opts: PlaySoundOptions =
        typeof options === 'number' ? { volume: options } : options;
    const { volume = 0.3, basePath } = opts;

    // prefers-reduced-motion 확인
    if (typeof window !== 'undefined') {
        const prefersReducedMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        if (prefersReducedMotion) {
            return false;
        }
    }

    try {
        const audioPath = basePath
            ? `${basePath}/${type}.mp3`
            : DEFAULT_AUDIO_PATHS[type];

        let audio = soundCache.get(audioPath);

        if (!audio) {
            audio = new Audio(audioPath);
            soundCache.set(audioPath, audio);
        }

        audio.volume = Math.max(0, Math.min(1, volume));
        audio.currentTime = 0;

        await audio.play();
        return true;
    } catch {
        // 자동 재생 차단 또는 오디오 파일 없음
        return false;
    }
};
