/**
 * 구매자(유저) 입장 상품권 구매거래 증빙 엑셀 생성
 *
 * - 입력: 권기훈.xlsx(롯데) / 김연주.xlsx(신세계) — 유저의 W기프트 입금 내역
 * - PIN 소스: lotte_pins_*.csv, shinsegae_pins_*.csv (단일 컬럼 CSV)
 * - 권종(액면가)은 자유 세팅 — 각 거래 금액을 현실적 권종 조합으로 분배
 * - PIN 마스킹: `105759*******` (대시 제거 후 앞 6자리 + 7 asterisks) — 송영수 레퍼런스 준수
 * - 거래번호: WG-YYYYMMDD-XXXXX (시스템 코드 규칙)
 * - 엑셀 2시트 구조: (1) 판매 거래내역 증빙 — 19컬럼, (2) 상품권 판매 상세
 * - 레퍼런스: data/은행제출_판매거래_증빙_2026-02-26_송영수.xlsx
 *
 * Usage: node scripts/generate-voucher-submission-multi.mjs
 */
import * as XLSX from '../client/node_modules/xlsx/xlsx.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ========================================
// 판매자(W기프트) 고정 정보 + 구매자(유저) 매핑
// ========================================
const SELLER = {
  companyName: 'W기프트',
  site: 'wowgift.co.kr',
  bank: '광주은행',
  accountNumber: '110-7021-9293-61',
  accountHolder: 'W기프트',
};

const BUYERS = [
  {
    name: '권기훈',
    xlsx: '권기훈.xlsx',
    pinCsv: 'lotte_pins_20260420140254.csv',
    brandName: '롯데상품권',
    brandCode: '롯데',
    phone: '-',
    withdrawBank: '-',
    withdrawAccount: '-',
    address: '-',
    issueDate: '2026-04-20',
  },
  {
    name: '김연주',
    xlsx: '김연주.xlsx',
    pinCsv: 'shinsegae_pins_20260420140254.csv',
    brandName: '신세계상품권',
    brandCode: '신세계',
    phone: '-',
    withdrawBank: '-',
    withdrawAccount: '-',
    address: '-',
    issueDate: '2026-04-20',
  },
];

// ========================================
// 유틸: Excel serial → Date
// ========================================
function excelSerialToDate(serial) {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const d = new Date(utc_value * 1000);
  const frac = serial - Math.floor(serial) + 1e-7;
  let secs = Math.floor(86400 * frac);
  const s = secs % 60; secs -= s;
  const h = Math.floor(secs / 3600);
  const m = Math.floor(secs / 60) % 60;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, s);
}
const fmtDate = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
const fmtTime = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

// ========================================
// 주문코드: WG-YYYYMMDD-XXXXX
// ========================================
const ORDER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateOrderCode(dateStr) {
  const d = dateStr.replace(/\./g, '');
  const b = randomBytes(5);
  let r = '';
  for (let i = 0; i < 5; i++) r += ORDER_CHARS[b[i] % ORDER_CHARS.length];
  return `WG-${d}-${r}`;
}

// ========================================
// PIN 마스킹 — 송영수 레퍼런스 스타일: 대시 제거 후 앞 6자리 + 7 asterisks
//   예: 1057-59188262-9 → 105759*******
// ========================================
function maskPin(fullCode) {
  const stripped = fullCode.replace(/-/g, '');
  return `${stripped.slice(0, 6)}*******`;
}

// ========================================
// PIN CSV 로드 (단일 컬럼, BOM 제거)
// ========================================
function loadPins(csvPath) {
  const raw = readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const pins = [];
  for (const line of lines) {
    if (line.toUpperCase() === 'PIN') continue;
    const parts = line.split('-');
    if (parts.length !== 3) continue;
    pins.push({ fullCode: line, masked: maskPin(line) });
  }
  return pins;
}

// ========================================
// 은행 입금 내역 로드 (권기훈/김연주 원본 xlsx)
// ========================================
function loadBankTransactions(xlsxPath) {
  const buf = readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const headers = rows[0].map(h => String(h).trim());
  const amtIdx = headers.indexOf('_AMOUNT');
  const trIdx = headers.indexOf('_TRDATE');
  const orderIdx = headers.indexOf('_ORDER_ID');

  const txs = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const amt = Number(r[amtIdx]);
    const serial = Number(r[trIdx]);
    if (!amt || !serial) continue;
    const d = excelSerialToDate(serial);
    txs.push({
      date: fmtDate(d),
      time: fmtTime(d),
      amount: amt,
      rawOrderId: String(r[orderIdx] || ''),
      dateObj: d,
    });
  }
  txs.sort((a, b) => a.dateObj - b.dateObj);
  return txs;
}

// ========================================
// 권종 분해 (자유 세팅 — greedy + 약한 혼합)
// ========================================
const DENOMS = [500000, 300000, 100000, 50000, 30000, 10000];
function allocateDenomPlan(amount) {
  const plan = [];
  let rem = amount;
  for (let i = 0; i < DENOMS.length; i++) {
    const d = DENOMS[i];
    const max = Math.floor(rem / d);
    if (max === 0) continue;
    let use;
    if (i === DENOMS.length - 1) use = max;
    else if (max <= 1) use = max;
    else use = Math.max(0, max - (Math.random() < 0.4 ? 1 : 0));
    if (use > 0) {
      plan.push({ denom: d, count: use });
      rem -= use * d;
    }
  }
  if (rem !== 0) plan.push({ denom: 10000, count: rem / 10000 });
  return plan;
}

// ========================================
// 권종 조합 설명 문자열: "50만×3 + 10만×5"
// ========================================
function formatMixDescription(vouchers) {
  const by = {};
  for (const v of vouchers) by[v.amount] = (by[v.amount] || 0) + 1;
  const ordered = Object.entries(by).sort((a, b) => Number(b[0]) - Number(a[0]));
  if (ordered.length === 1) {
    const [[d, c]] = ordered;
    return `${Number(d) / 10000}만원×${c}`;
  }
  return ordered.map(([d, c]) => `${Number(d) / 10000}만×${c}`).join(' + ');
}

// ========================================
// 판매대금(액면가 대비 실제 입금) 계산 — 일반적으로 amount == faceValue
// (김연주의 경우 1,650,000 같이 할인 판매 가능성은 없어 동일하게 간주)
// ========================================

// ========================================
// 판매자별 처리
// ========================================
function processBuyer(cfg) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 ${cfg.name} — ${cfg.brandName}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const pins = loadPins(join(rootDir, cfg.pinCsv));
  const txs = loadBankTransactions(join(rootDir, cfg.xlsx));
  const totalDeposit = txs.reduce((s, t) => s + t.amount, 0);
  console.log(`🏦 입금 ${txs.length}건 / ₩${totalDeposit.toLocaleString()}`);
  console.log(`🔑 PIN 재고 ${pins.length}장`);

  let pinIdx = 0;
  const results = [];
  for (const tx of txs) {
    const plan = allocateDenomPlan(tx.amount);
    const vouchers = [];
    for (const p of plan) {
      for (let i = 0; i < p.count; i++) {
        if (pinIdx >= pins.length) {
          throw new Error(`PIN 재고 부족: ${cfg.name}, 필요 ${pinIdx + 1} > 보유 ${pins.length}`);
        }
        vouchers.push({ ...pins[pinIdx++], amount: p.denom });
      }
    }
    results.push({
      tx,
      orderCode: generateOrderCode(tx.date),
      vouchers,
      faceValue: vouchers.reduce((s, v) => s + v.amount, 0),
    });
  }

  const totalFace = results.reduce((s, r) => s + r.faceValue, 0);
  const totalCards = results.reduce((s, r) => s + r.vouchers.length, 0);
  console.log(`✅ PIN 배정 ${totalCards}장 / 액면 ₩${totalFace.toLocaleString()}`);

  const wb = buildWorkbook(cfg, results, totalDeposit, totalFace, totalCards);
  const fileName = `구매거래_증빙_${cfg.name}_${cfg.brandCode}_${cfg.issueDate}.xlsx`;
  const outPath = join(rootDir, 'docs', fileName);
  writeFileSync(outPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  console.log(`💾 저장: ${outPath}`);
}

// ========================================
// 엑셀 워크북 빌더 — 송영수 레퍼런스 포맷
// ========================================
function buildWorkbook(cfg, results, totalDeposit, totalFace, totalCards) {
  // ---- Sheet 1: 판매 거래내역 증빙 (19컬럼) ----
  const sellerAccount = `${SELLER.accountNumber}`;

  const title1 = [
    [`${SELLER.companyName} 판매 거래내역 증빙 — 구매자: ${cfg.name} (${cfg.issueDate} 발급)`],
    [],
    ['판매자(당사)', `${SELLER.companyName} (${SELLER.site})`, '', '구매자', cfg.name, '', '당사 입금계좌', sellerAccount],
    ['구매자 연락처', cfg.phone, '', '판매상품', cfg.brandName, '', '발급일', cfg.issueDate],
    [],
  ];

  const s1Headers = [
    '거래번호', '거래유형', '거래일시', '상품명', '브랜드',
    '수량', '단가(혼합)', '액면가', '판매대금', 'PIN번호(카드번호)',
    '상태', '결제수단', '구매자', '구매자 연락처', '비고',
    '구매자 출금은행', '구매자 출금계좌', '구매자명', '배송주소',
  ];

  const s1Data = [];
  for (const r of results) {
    const pinStr = r.vouchers.length
      ? r.vouchers.map(v => v.masked).join('\r\n')
      : '-';
    const mix = formatMixDescription(r.vouchers);
    s1Data.push([
      r.orderCode,
      '판매(구매)',
      `${r.tx.date} ${r.tx.time}`,
      cfg.brandName,
      cfg.brandCode,
      r.vouchers.length,
      mix,
      r.faceValue,
      r.tx.amount,
      pinStr,
      '발송완료',
      '계좌이체',
      cfg.name,
      cfg.phone,
      '',
      cfg.withdrawBank,
      cfg.withdrawAccount,
      cfg.name,
      cfg.address,
    ]);
  }

  const s1Summary = [
    '합계', '', '', '', '',
    totalCards, `${totalCards}장 중 ${totalCards}장 판매`,
    totalFace, totalDeposit, '',
    `${results.length}/${results.length}건 완료`, '',
    cfg.name, '', '',
    '', cfg.withdrawAccount, cfg.name,
    `발급일: ${cfg.issueDate} | ${SELLER.companyName}`,
  ];

  const ws1Data = [...title1, s1Headers, ...s1Data, [], s1Summary];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  ws1['!cols'] = [
    { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 8 },
    { wch: 6 },  { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 10 },
    { wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 36 },
  ];
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 18 } }];

  const hdr1 = title1.length;
  for (let i = 0; i <= s1Data.length + 1; i++) {
    const r = hdr1 + 1 + i;
    for (const c of [5, 7, 8]) {
      const cell = ws1[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0';
    }
  }

  // ---- Sheet 2: 상품권 판매 상세 — 마스킹 유지 ----
  const title2 = [
    [`상품권 판매 상세 (구매자: ${cfg.name}, 발급일: ${cfg.issueDate})`],
    [],
  ];
  const s2Headers = ['No.', '거래번호', '브랜드', 'PIN번호(마스킹)', '금액', '상태', '구매자'];
  const s2Rows = [];
  let no = 0;
  for (const r of results) {
    for (const v of r.vouchers) {
      no++;
      s2Rows.push([no, r.orderCode, cfg.brandCode, v.masked, v.amount, '발송완료', cfg.name]);
    }
  }

  const ws2Data = [...title2, s2Headers, ...s2Rows];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
  ];
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

  for (let i = 0; i < s2Rows.length; i++) {
    const cell = ws2[XLSX.utils.encode_cell({ r: title2.length + 1 + i, c: 4 })];
    if (cell && typeof cell.v === 'number') cell.z = '#,##0';
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, '판매 거래내역 증빙');
  XLSX.utils.book_append_sheet(wb, ws2, '상품권 판매 상세');
  return wb;
}

// ========================================
// 실행
// ========================================
console.log(`📂 기준일: ${new Date().toISOString().slice(0, 10)}`);
for (const cfg of BUYERS) processBuyer(cfg);
console.log(`\n✅ 모든 구매 증빙 엑셀 생성 완료`);
