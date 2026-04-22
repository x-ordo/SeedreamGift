/**
 * @file BoardRow/index.tsx
 * @description TDS BoardRow - Q&A 스타일 아코디언 컴포넌트
 * @module design-system/molecules
 *
 * 접근성:
 * - button 요소로 클릭 가능한 영역 명시
 * - aria-expanded로 열림/닫힘 상태 전달
 * - 키보드 접근 가능 (Enter/Space)
 *
 * 사용법:
 * <BoardRow
 *   title="매도 환전이 무엇인가요?"
 *   prefix={<BoardRow.Prefix>Q</BoardRow.Prefix>}
 *   icon={<BoardRow.ArrowIcon />}
 * >
 *   <BoardRow.Text>답변 내용입니다.</BoardRow.Text>
 * </BoardRow>
 */
import React, { useState, useId, createContext, useContext } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './BoardRow.module.css';

// ============================================================================
// Context
// ============================================================================

interface BoardRowContextValue {
  isOpened: boolean;
}

const BoardRowContext = createContext<BoardRowContextValue>({ isOpened: false });

// ============================================================================
// BoardRow.Prefix
// ============================================================================

export interface BoardRowPrefixProps {
  children: React.ReactNode;
  /** 색상 (기본: primary) */
  color?: string;
  /** 폰트 굵기 */
  fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold';
  className?: string;
}

const BoardRowPrefix: React.FC<BoardRowPrefixProps> = ({
  children,
  color,
  fontWeight = 'semibold',
  className = '',
}) => {
  const fontWeightMap = {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  };

  return (
    <span
      className={`${styles.prefix} ${className}`}
      style={{
        color: color || 'var(--color-primary)',
        fontWeight: fontWeightMap[fontWeight],
      }}
    >
      {children}
    </span>
  );
};

// ============================================================================
// BoardRow.ArrowIcon
// ============================================================================

export interface BoardRowArrowIconProps {
  /** 아이콘 색상 */
  color?: string;
  /** 아이콘 크기 (px) */
  size?: number;
  className?: string;
}

const BoardRowArrowIcon: React.FC<BoardRowArrowIconProps> = ({
  color,
  size = 20,
  className = '',
}) => {
  const { isOpened } = useContext(BoardRowContext);

  return (
    <span
      className={`${styles.arrowIcon} ${isOpened ? styles.arrowIconOpen : ''} ${className}`}
      style={{
        color: color || 'var(--color-grey-400)',
        fontSize: size,
      }}
      aria-hidden="true"
    >
      <ChevronDown size={size} />
    </span>
  );
};

// ============================================================================
// BoardRow.Text
// ============================================================================

export interface BoardRowTextProps {
  children: React.ReactNode;
  className?: string;
}

const BoardRowText: React.FC<BoardRowTextProps> = ({ children, className = '' }) => {
  return <div className={`${styles.text} ${className}`}>{children}</div>;
};

// ============================================================================
// BoardRow (Main Component)
// ============================================================================

export interface BoardRowProps {
  /** 헤더 제목 */
  title: React.ReactNode;
  /** 콘텐츠 영역 */
  children: React.ReactNode;
  /** 제목 앞 프리픽스 (BoardRow.Prefix 사용) */
  prefix?: React.ReactNode;
  /** 제목 뒤 아이콘 (BoardRow.ArrowIcon 사용) */
  icon?: React.ReactNode;
  /** 초기 열림 상태 (비제어 모드) */
  initialOpened?: boolean;
  /** 열림 상태 (제어 모드) */
  isOpened?: boolean;
  /** 열릴 때 콜백 */
  onOpen?: () => void;
  /** 닫힐 때 콜백 */
  onClose?: () => void;
  /** li 요소 속성 */
  liAttributes?: React.LiHTMLAttributes<HTMLLIElement>;
  className?: string;
}

const BoardRowMain: React.FC<BoardRowProps> = ({
  title,
  children,
  prefix,
  icon,
  initialOpened = false,
  isOpened: controlledIsOpened,
  onOpen,
  onClose,
  liAttributes,
  className = '',
}) => {
  const generatedId = useId();
  const headerId = `boardrow-header-${generatedId}`;
  const panelId = `boardrow-panel-${generatedId}`;

  // 제어/비제어 모드 처리
  const [internalIsOpened, setInternalIsOpened] = useState(initialOpened);
  const isControlled = controlledIsOpened !== undefined;
  const isOpened = isControlled ? controlledIsOpened : internalIsOpened;

  const handleToggle = () => {
    if (isControlled) {
      if (isOpened) {
        onClose?.();
      } else {
        onOpen?.();
      }
    } else {
      setInternalIsOpened((prev) => !prev);
    }
  };

  const Wrapper = liAttributes ? 'li' : 'div';

  return (
    <BoardRowContext.Provider value={{ isOpened }}>
      <Wrapper
        className={`${styles.boardRow} ${isOpened ? styles.boardRowOpen : ''} ${className}`}
        {...(liAttributes as any)}
      >
        <button
          type="button"
          id={headerId}
          className={styles.header}
          aria-expanded={isOpened}
          aria-controls={panelId}
          onClick={handleToggle}
        >
          {prefix && <span className={styles.prefixWrapper}>{prefix}</span>}
          <span className={styles.title}>{title}</span>
          {icon && <span className={styles.iconWrapper}>{icon}</span>}
        </button>

        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className={`${styles.panel} ${isOpened ? styles.panelOpen : ''}`}
          hidden={!isOpened}
        >
          <div className={styles.panelContent}>{children}</div>
        </div>
      </Wrapper>
    </BoardRowContext.Provider>
  );
};

// ============================================================================
// Compound Component Export
// ============================================================================

type BoardRowComponent = typeof BoardRowMain & {
  Prefix: typeof BoardRowPrefix;
  ArrowIcon: typeof BoardRowArrowIcon;
  Text: typeof BoardRowText;
};

export const BoardRow = BoardRowMain as BoardRowComponent;
BoardRow.Prefix = BoardRowPrefix;
BoardRow.ArrowIcon = BoardRowArrowIcon;
BoardRow.Text = BoardRowText;

// ============================================================================
// Board (Container for multiple BoardRows)
// ============================================================================

export interface BoardProps {
  children: React.ReactNode;
  className?: string;
}

export const Board: React.FC<BoardProps> = ({ children, className = '' }) => {
  return (
    <ul className={`${styles.board} ${className}`}>
      {children}
    </ul>
  );
};

export default BoardRow;
