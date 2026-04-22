import React from 'react';

/**
 * 법적 텍스트(이용약관, 개인정보처리방침)를 구조화된 HTML로 변환
 *
 * 파싱 규칙:
 * - /^제\d+조/ → <h2> (조항 제목)
 * - /^부칙/ → <h2>
 * - /^\d+\.\s/ → <h3> (번호 항목)
 * - /^-\s/ 또는 /^\s+-\s/ → <li> (대시 목록)
 * - /^\s+·\s/ → <li> (가운뎃점 목록)
 * - 나머지 → <p>
 */
export function parseLegalText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: 'dash' | 'dot' = 'dash';

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={`list-${elements.length}`} className="legal-list">
        {listBuffer.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // 제N조 (…) — 조항 헤딩
    if (/^제\d+조/.test(trimmed)) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="legal-heading">
          {trimmed}
        </h2>
      );
      continue;
    }

    // 부칙
    if (/^부칙/.test(trimmed)) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="legal-heading">
          {trimmed}
        </h2>
      );
      continue;
    }

    // 번호 항목 (1. 2. 3. …) — 개인정보처리방침의 주요 섹션
    if (/^\d+\.\s/.test(trimmed)) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="legal-subheading">
          {trimmed}
        </h3>
      );
      continue;
    }

    // 대시 목록 (- 항목)
    if (/^\s*-\s/.test(line)) {
      if (listBuffer.length > 0 && listType !== 'dash') flushList();
      listType = 'dash';
      listBuffer.push(trimmed.replace(/^-\s*/, ''));
      continue;
    }

    // 가운뎃점 목록 (· 항목)
    if (/^\s*·\s/.test(line)) {
      if (listBuffer.length > 0 && listType !== 'dot') flushList();
      listType = 'dot';
      listBuffer.push(trimmed.replace(/^·\s*/, ''));
      continue;
    }

    // 일반 텍스트
    flushList();
    elements.push(
      <p key={`p-${i}`} className="legal-paragraph">
        {trimmed}
      </p>
    );
  }

  flushList();
  return elements;
}
