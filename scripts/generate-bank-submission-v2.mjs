/**
 * 은행제출용 이엑스 상품권 매입 거래내역 증빙 엑셀 생성
 *
 * - 박영례(판매자)가 상품권을 판매 → 씨드림기프트(매입자)가 매입 → 대금 계좌이체
 * - PIN 소스: secure_gift_pins.csv (TSV)
 * - 액면가와 입금액 1:1 매칭 (greedy: 큰 권종 우선)
 * - 거래번호: WG-YYYYMMDD-XXXXX 시스템 코드 규칙 적용
 *
 * Usage: node scripts/generate-bank-submission-v2.mjs
 */
import * as XLSX from '../client/node_modules/xlsx/xlsx.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ========================================
// 설정
// ========================================
const SELLER_NAME = '박영례';
const SELLER_PHONE = '010-5591-1136';
const SELLER_BANK = '농협';
const SELLER_ACCOUNT = '3920-10-005396-1';
const BUYER_NAME = '씨드림기프트';
const ISSUE_DATE = '2026-02-26';
const PRODUCT_NAME = '이엑스(EX)상품권';
const BRAND_CODE = 'EX';

// ========================================
// 주문코드 생성: WG-YYYYMMDD-XXXXX (시스템 규칙)
// ========================================
const ORDER_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O/0/I/1 제외

function generateOrderCode(dateStr) {
  // dateStr: '2026.02.16' → '20260216'
  const d = dateStr.replace(/\./g, '');
  const bytes = randomBytes(5);
  let rand = '';
  for (let i = 0; i < 5; i++) {
    rand += ORDER_CODE_CHARS[bytes[i] % ORDER_CODE_CHARS.length];
  }
  return `WG-${d}-${rand}`;
}

// ========================================
// 1. 상품권 재고 로드 (secure_gift_pins.csv — TSV)
// ========================================
const csvText = readFileSync(join(rootDir, 'secure_gift_pins.csv'), 'utf-8');
const csvLines = csvText.split('\n').map(l => l.trim()).filter(Boolean);

const pool = { 500000: [], 100000: [], 50000: [], 10000: [] };
for (let i = 1; i < csvLines.length; i++) {
  const cols = csvLines[i].split('\t');
  const [code1, code2, code3, giftPw, amountStr] = cols;
  if (!code1 || !amountStr) continue;
  const amount = Number(amountStr);
  if (!pool[amount]) continue;
  pool[amount].push({
    code1: String(code1),
    code2: String(code2),
    code3: String(code3),
    giftPw: String(giftPw),
    amount,
    fullCode: `${code1}-${code2}-${code3}`,
  });
}

const totalCards = Object.values(pool).reduce((s, arr) => s + arr.length, 0);
const totalInventory = Object.entries(pool).reduce((s, [amt, arr]) => s + arr.length * Number(amt), 0);

console.log(`📦 재고: ${totalCards}장 / ₩${totalInventory.toLocaleString()}`);
Object.entries(pool)
  .sort((a, b) => Number(b[0]) - Number(a[0]))
  .forEach(([amt, arr]) => console.log(`   ${Number(amt) / 10000}만원권: ${arr.length}장`));

// ========================================
// 2. 은행 송금 내역 (씨드림기프트 → 박영례 대금 지급)
// ========================================
const transactions = [
  { date: '2026.02.16', time: '12:01:27', amount: 100000 },
  { date: '2026.02.17', time: '18:16:19', amount: 2000000 },
  { date: '2026.02.17', time: '18:16:23', amount: 1990000 },
  { date: '2026.02.17', time: '18:16:25', amount: 2000000 },
  { date: '2026.02.17', time: '20:12:58', amount: 1990000 },
  { date: '2026.02.17', time: '20:13:01', amount: 1980000 },
  { date: '2026.02.17', time: '21:25:01', amount: 2000000 },
  { date: '2026.02.17', time: '21:25:05', amount: 2000000 },
  { date: '2026.02.17', time: '21:25:10', amount: 1980000 },
  { date: '2026.02.18', time: '02:22:54', amount: 1980000 },
  { date: '2026.02.18', time: '02:22:57', amount: 1990000 },
  { date: '2026.02.18', time: '02:23:00', amount: 2000000 },
  { date: '2026.02.18', time: '07:43:52', amount: 1990000 },
  { date: '2026.02.18', time: '07:43:57', amount: 1980000 },
];

// 각 거래에 주문코드 부여 (거래일 기준 WG-YYYYMMDD-XXXXX)
for (const tx of transactions) {
  tx.orderCode = generateOrderCode(tx.date);
}

const totalPayments = transactions.reduce((s, t) => s + t.amount, 0);
console.log(`\n🏦 매입대금 지급: ${transactions.length}건 / ₩${totalPayments.toLocaleString()}`);

// ========================================
// 3. 액면가 1:1 매칭 (greedy: 큰 권종 우선)
// ========================================
const denoms = [500000, 100000, 50000, 10000];
const poolIdx = {};
for (const d of denoms) poolIdx[d] = 0;

const txVouchers = transactions.map(() => []);

for (let i = 0; i < transactions.length; i++) {
  let remaining = transactions[i].amount;
  for (const denom of denoms) {
    while (remaining >= denom && poolIdx[denom] < pool[denom].length) {
      txVouchers[i].push(pool[denom][poolIdx[denom]]);
      poolIdx[denom]++;
      remaining -= denom;
    }
  }
  if (remaining > 0) {
    console.warn(`⚠️ 거래 ${i + 1}: ₩${remaining.toLocaleString()} 미매칭 (재고 부족)`);
  }
}

// 검증 로그
const totalAssigned = txVouchers.reduce((s, arr) => s + arr.length, 0);
const totalFaceAssigned = txVouchers.reduce((s, arr) => s + arr.reduce((ss, v) => ss + v.amount, 0), 0);
console.log(`\n✅ 매칭: ${totalAssigned}장 배분 / 총 액면 ₩${totalFaceAssigned.toLocaleString()}`);

for (let i = 0; i < transactions.length; i++) {
  const tx = transactions[i];
  const vv = txVouchers[i];
  const fv = vv.reduce((s, v) => s + v.amount, 0);
  const denomBreakdown = {};
  for (const v of vv) {
    const k = `${v.amount / 10000}만원`;
    denomBreakdown[k] = (denomBreakdown[k] || 0) + 1;
  }
  const bd = Object.entries(denomBreakdown).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).map(([k, v]) => `${k}×${v}`).join('+');
  console.log(`   ${tx.orderCode} | ${tx.date} ${tx.time} | ₩${tx.amount.toLocaleString()} | ${vv.length}장 | 액면 ₩${fv.toLocaleString()} | ${bd || '-'}`);
}

// ========================================
// 4. 엑셀 생성 — exportBankSubmissionReport 양식 통일
// ========================================

let grandFace = 0;
let grandCards = 0;

// ---- Sheet 1: 매입 거래내역 증빙 ----
const titleRows = [
  [`${BUYER_NAME} 매입 거래내역 증빙 — 판매자: ${SELLER_NAME} (${ISSUE_DATE} 발급)`],
  [],
  ['매입자(당사)', `${BUYER_NAME} (seedreamgift.com)`, '', '판매자', SELLER_NAME, '', '판매자 계좌', `${SELLER_BANK} ${SELLER_ACCOUNT}`],
  ['판매자 연락처', SELLER_PHONE, '', '매입상품', PRODUCT_NAME, '', '발급일', ISSUE_DATE],
  [],
];

const s1Headers = [
  '거래번호', '거래유형', '거래일시', '상품명', '브랜드',
  '수량', '액면가', '매입대금', 'PIN번호',
  '상태', '결제수단', '판매자', '연락처',
  '입금은행', '입금계좌', '예금주',
];

const s1Data = [];
for (let i = 0; i < transactions.length; i++) {
  const tx = transactions[i];
  const vv = txVouchers[i];
  const faceValue = vv.reduce((s, v) => s + v.amount, 0);
  grandFace += faceValue;
  grandCards += vv.length;
  const hasVouchers = vv.length > 0;

  const pinList = hasVouchers
    ? vv.map(v => `${v.code1}-${v.code2}-****`).join('\n')
    : '-';

  s1Data.push([
    tx.orderCode,
    '매입(환매)',
    `${tx.date} ${tx.time}`,
    hasVouchers ? PRODUCT_NAME : '',
    hasVouchers ? BRAND_CODE : '',
    hasVouchers ? vv.length : '',
    hasVouchers ? faceValue : '',
    tx.amount,
    pinList,
    hasVouchers ? '지급완료' : '대금지급(미배분)',
    '계좌이체',
    SELLER_NAME,
    SELLER_PHONE,
    SELLER_BANK,
    SELLER_ACCOUNT,
    SELLER_NAME,
  ]);
}

const s1SummaryRow = [
  '합계', '', '', '', '',
  grandCards,
  grandFace,
  totalPayments,
  '',
  `${transactions.length}건`,
  '', SELLER_NAME, '',
  SELLER_BANK, SELLER_ACCOUNT, SELLER_NAME,
];

const ws1All = [...titleRows, s1Headers, ...s1Data, [], s1SummaryRow];
const ws1 = XLSX.utils.aoa_to_sheet(ws1All);

ws1['!cols'] = [
  { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 6 },
  { wch: 6 },  { wch: 14 }, { wch: 14 }, { wch: 28 },
  { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 16 },
  { wch: 8 },  { wch: 22 }, { wch: 10 },
];
ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }];

// 숫자 서식: 액면가(col6), 매입대금(col7)
const hdrRow = titleRows.length;
for (let i = 0; i <= s1Data.length + 1; i++) {
  const r = hdrRow + 1 + i;
  for (const c of [6, 7]) {
    const cell = ws1[XLSX.utils.encode_cell({ r, c })];
    if (cell && typeof cell.v === 'number') cell.z = '#,##0';
  }
}

// ---- Sheet 2: 상품권 매입 상세 ----
const s2Title = [
  [`${PRODUCT_NAME} 매입 상세 — 판매자: ${SELLER_NAME} (${ISSUE_DATE} 발급)`],
  [],
];

const s2Headers = [
  '거래번호', '거래일시', '매입대금', '순번',
  '권종', '카드번호', '인증코드(GIFT_PW)', '액면가',
];

const s2Rows = [];
for (let i = 0; i < transactions.length; i++) {
  const tx = transactions[i];
  const vv = txVouchers[i];

  if (vv.length === 0) {
    s2Rows.push([
      tx.orderCode,
      `${tx.date} ${tx.time}`,
      tx.amount,
      '', '', '(상품권 미배분)', '', '',
    ]);
    s2Rows.push([]);
    continue;
  }

  let seq = 0;
  for (const v of vv) {
    seq++;
    s2Rows.push([
      seq === 1 ? tx.orderCode : '',
      seq === 1 ? `${tx.date} ${tx.time}` : '',
      seq === 1 ? tx.amount : '',
      seq,
      `${v.amount / 10000}만원권`,
      v.fullCode,
      v.giftPw,
      v.amount,
    ]);
  }
  const subFace = vv.reduce((s, v) => s + v.amount, 0);
  s2Rows.push(['', '', '', '', `소계: ${vv.length}장`, '', '', subFace]);
  s2Rows.push([]);
}

s2Rows.push(['총계', '', totalPayments, '', `${grandCards}장`, '', '', grandFace]);

const ws2All = [...s2Title, s2Headers, ...s2Rows];
const ws2 = XLSX.utils.aoa_to_sheet(ws2All);

ws2['!cols'] = [
  { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 6 },
  { wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 14 },
];
ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

// 숫자 서식: 매입대금(col2), 액면가(col7)
for (let i = 0; i < s2Rows.length; i++) {
  for (const c of [2, 7]) {
    const cell = ws2[XLSX.utils.encode_cell({ r: s2Title.length + 1 + i, c })];
    if (cell && typeof cell.v === 'number') cell.z = '#,##0';
  }
}

// ---- 저장 ----
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws1, '매입 거래내역 증빙');
XLSX.utils.book_append_sheet(wb, ws2, '상품권 매입 상세');

const outputPath = join(rootDir, 'docs', `은행제출_${SELLER_NAME}_매입거래_증빙_${ISSUE_DATE}.xlsx`);
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync(outputPath, buf);

console.log(`\n✅ 생성 완료: ${outputPath}`);
