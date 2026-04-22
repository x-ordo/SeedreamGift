/**
 * @file BulkPinInput.tsx
 * @description 대량 PIN 입력 컴포넌트 - 붙여넣기/수동 입력 모드 지원
 * @module pages/Product
 *
 * 사용처:
 * - 관리자 재고 등록 시 다수의 PIN 일괄 입력
 * - 대량 매입 신청 시 여러 상품권 PIN 입력
 *
 * 입력 모드:
 * - paste: 텍스트 영역에 줄바꿈으로 구분된 PIN 일괄 붙여넣기 (최대 50건)
 * - manual: 개별 입력 필드로 하나씩 추가 (최대 50건)
 *
 * 주요 기능:
 * - 브랜드별 PIN 패턴 자동 포맷팅 (getPinConfig 기반)
 * - 실시간 유효성 검증 (형식 오류, 중복 감지)
 * - 유효/무효 PIN 개수 통계 표시
 * - 유효한 PIN만 상위 컴포넌트로 전달
 *
 * 주요 함수:
 * - parsedPins: 붙여넣기 텍스트를 파싱하여 PinEntry[] 생성 (useMemo)
 * - updateManualPin: 수동 입력 모드에서 개별 PIN 업데이트
 * - handleConfirm: 유효한 PIN만 필터링하여 onPinsChange 콜백 호출
 */
import React, { useState, useCallback, useMemo, memo } from 'react';
import { Clipboard, Pencil, CircleCheck, XCircle, Check, X, PlusCircle } from 'lucide-react';
import { Button } from '../../design-system';
import { getPinConfig, formatPin, unformatPin, isValidPin } from '../../constants';
import './BulkPinInput.css';

interface BulkPinInputProps {
  brand: string;
  onPinsChange: (pins: PinEntry[]) => void;
}

export interface PinEntry {
  id: string;
  pinCode: string;
  securityCode?: string;
  giftNumber?: string;
  isValid: boolean;
  isDuplicate: boolean;
}

type InputMode = 'paste' | 'manual';

const MAX_BULK_PINS = 50;

const BulkPinInput: React.FC<BulkPinInputProps> = memo(({ brand, onPinsChange }) => {
  const [mode, setMode] = useState<InputMode>('paste');
  const [pasteText, setPasteText] = useState('');
  const [manualPins, setManualPins] = useState<PinEntry[]>([
    { id: crypto.randomUUID(), pinCode: '', isValid: false, isDuplicate: false },
  ]);

  const pinConfig = useMemo(() => getPinConfig(brand), [brand]);

  // Parse pasted text into pins
  const parsedPins = useMemo((): PinEntry[] => {
    if (!pasteText.trim()) return [];
    const lines = pasteText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
    const seen = new Set<string>();

    return lines.map((line, i) => {
      const digits = line.replace(/\D/g, '');
      const formatted = formatPin(digits, pinConfig.pinPattern);
      const valid = isValidPin(digits, pinConfig.pinPattern) ||
        (pinConfig.allowedLengths?.includes(digits.length) ?? false);
      const isDuplicate = seen.has(digits);
      seen.add(digits);

      return {
        id: `paste-${i}`,
        pinCode: formatted || line,
        isValid: valid && !isDuplicate,
        isDuplicate,
      };
    });
  }, [pasteText, pinConfig]);

  const validCount = useMemo(() => {
    const pins = mode === 'paste' ? parsedPins : manualPins;
    return pins.filter(p => p.isValid && p.pinCode.length > 0).length;
  }, [mode, parsedPins, manualPins]);

  const invalidCount = useMemo(() => {
    const pins = mode === 'paste' ? parsedPins : manualPins;
    return pins.filter(p => !p.isValid && p.pinCode.length > 0).length;
  }, [mode, parsedPins, manualPins]);

  // Manual mode: add row
  const addManualRow = useCallback(() => {
    if (manualPins.length >= MAX_BULK_PINS) return;
    setManualPins(prev => [
      ...prev,
      { id: crypto.randomUUID(), pinCode: '', isValid: false, isDuplicate: false },
    ]);
  }, [manualPins.length]);

  // Manual mode: remove row
  const removeManualRow = useCallback((id: string) => {
    setManualPins(prev => {
      const next = prev.filter(p => p.id !== id);
      return next.length === 0
        ? [{ id: crypto.randomUUID(), pinCode: '', isValid: false, isDuplicate: false }]
        : next;
    });
  }, []);

  // Manual mode: update pin
  const updateManualPin = useCallback((id: string, raw: string) => {
    setManualPins(prev => {
      const digits = raw.replace(/\D/g, '');
      const formatted = formatPin(digits, pinConfig.pinPattern);
      const valid = isValidPin(digits, pinConfig.pinPattern) ||
        (pinConfig.allowedLengths?.includes(digits.length) ?? false);

      const updated = prev.map(p => p.id === id ? { ...p, pinCode: formatted, isValid: valid } : p);

      // Check duplicates
      const seen = new Set<string>();
      return updated.map(p => {
        const d = unformatPin(p.pinCode);
        const isDuplicate = d.length > 0 && seen.has(d);
        seen.add(d);
        return { ...p, isDuplicate, isValid: p.isValid && !isDuplicate };
      });
    });
  }, [pinConfig]);

  // Notify parent of valid pins
  const handleConfirm = useCallback(() => {
    const pins = mode === 'paste' ? parsedPins : manualPins;
    const validPins = pins.filter(p => p.isValid && p.pinCode.length > 0);
    onPinsChange(validPins);
  }, [mode, parsedPins, manualPins, onPinsChange]);

  return (
    <div className="bulk-pin-container">
      <div className="bulk-pin-mode-toggle">
        <button
          type="button"
          className={`bulk-pin-mode-btn ${mode === 'paste' ? 'active' : ''}`}
          onClick={() => setMode('paste')}
        >
          <Clipboard size={16} aria-hidden="true" />
          붙여넣기
        </button>
        <button
          type="button"
          className={`bulk-pin-mode-btn ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => setMode('manual')}
        >
          <Pencil size={16} aria-hidden="true" />
          수동 입력
        </button>
      </div>

      {mode === 'paste' ? (
        <div className="bulk-pin-paste-section">
          <textarea
            className="bulk-pin-textarea"
            name="pinCodes"
            aria-label="PIN 코드 입력"
            placeholder={`PIN 번호를 줄바꿈으로 구분하여 입력하세요 (최대 ${MAX_BULK_PINS}건)\n\n예시:\n1234-5678-9012-3456\n2345-6789-0123-4567\n3456-7890-1234-5678`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
          />
          {parsedPins.length > 0 && (
            <div className="bulk-pin-preview">
              <div className="bulk-pin-stats">
                <span className="bulk-pin-stat valid">
                  <CircleCheck size={16} aria-hidden="true" />
                  유효 {validCount}건
                </span>
                {invalidCount > 0 && (
                  <span className="bulk-pin-stat invalid">
                    <XCircle size={16} aria-hidden="true" />
                    무효 {invalidCount}건
                  </span>
                )}
              </div>
              <div className="bulk-pin-list">
                {parsedPins.slice(0, 10).map((pin) => (
                  <div key={pin.id} className={`bulk-pin-item ${pin.isValid ? 'valid' : 'invalid'}`}>
                    <span className="bulk-pin-code">{pin.pinCode}</span>
                    {pin.isDuplicate && <span className="bulk-pin-error">중복</span>}
                    {!pin.isValid && !pin.isDuplicate && <span className="bulk-pin-error">형식 오류</span>}
                    {pin.isValid && <Check size={16} aria-hidden="true" />}
                  </div>
                ))}
                {parsedPins.length > 10 && (
                  <div className="bulk-pin-more">외 {parsedPins.length - 10}건</div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bulk-pin-manual-section">
          {manualPins.map((pin, index) => (
            <div key={pin.id} className="bulk-pin-manual-row">
              <span className="bulk-pin-row-num">{index + 1}</span>
              <input
                type="text"
                name="pinCode"
                aria-label="PIN 코드"
                className={`bulk-pin-manual-input ${pin.pinCode && !pin.isValid ? 'error' : ''} ${pin.isValid ? 'valid' : ''}`}
                placeholder={pinConfig.pinPattern.map(n => '0'.repeat(n)).join('-')}
                value={pin.pinCode}
                onChange={(e) => updateManualPin(pin.id, e.target.value)}
                autoComplete="off"
              />
              {pin.isDuplicate && <span className="bulk-pin-error">중복</span>}
              <button
                type="button"
                className="bulk-pin-remove-btn"
                onClick={() => removeManualRow(pin.id)}
                aria-label="삭제"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          {manualPins.length < MAX_BULK_PINS && (
            <button type="button" className="bulk-pin-add-btn" onClick={addManualRow}>
              <PlusCircle size={16} aria-hidden="true" />
              PIN 추가
            </button>
          )}
        </div>
      )}

      <div className="bulk-pin-footer">
        <div className="bulk-pin-summary">
          유효 PIN <strong>{validCount}</strong>건
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleConfirm}
          disabled={validCount === 0}
        >
          {validCount}건 적용
        </Button>
      </div>
    </div>
  );
});

BulkPinInput.displayName = 'BulkPinInput';
export default BulkPinInput;
