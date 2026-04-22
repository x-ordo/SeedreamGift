/**
 * @file Overlay
 * @description 오버레이 컴포넌트 - 처리중/성공 상태 표시
 * @module design-system/molecules
 *
 * 사용법:
 * - Overlay.Processing: 비동기 작업 진행 중
 * - Overlay.Success: 작업 완료 축하 화면
 */
import './Overlay.css';
import Processing from './Overlay.Processing';
import Success from './Overlay.Success';

export type { ProcessingProps } from './Overlay.Processing';
export type { SuccessProps } from './Overlay.Success';

export const Overlay = {
  Processing,
  Success,
};
