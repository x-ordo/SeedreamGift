/**
 * @file hapticUtils.ts
 * @description Haptic feedback and sound utilities
 */

export const VIBRATION_PATTERNS = {
  tap: 50,
  success: 100,
  warning: [100, 50, 100],
  error: [200, 100, 200],
  notification: [100, 30, 100, 30, 100],
} as const;

export const vibrate = (pattern: number | readonly number[] | number[]): boolean => {
  if (!('vibrate' in navigator)) return false;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;

  if (typeof window !== 'undefined') {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return false;
  }

  try {
    navigator.vibrate(pattern as number | number[]);
    return true;
  } catch {
    return false;
  }
};

export type SoundType = 'success' | 'error' | 'warning' | 'notification' | 'click';

const DEFAULT_AUDIO_PATHS: Record<SoundType, string> = {
  success: '/audio/success.mp3',
  error: '/audio/error.mp3',
  warning: '/audio/warning.mp3',
  notification: '/audio/notification.mp3',
  click: '/audio/click.mp3',
};

export interface PlaySoundOptions {
  volume?: number;
  basePath?: string;
}

const soundCache = new Map<string, HTMLAudioElement>();

export const playSound = async (
  type: SoundType,
  options: number | PlaySoundOptions = {}
): Promise<boolean> => {
  const opts: PlaySoundOptions = typeof options === 'number' ? { volume: options } : options;
  const { volume = 0.3, basePath } = opts;

  if (typeof window !== 'undefined') {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return false;
  }

  try {
    const audioPath = basePath ? `${basePath}/${type}.mp3` : DEFAULT_AUDIO_PATHS[type];
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
    return false;
  }
};
