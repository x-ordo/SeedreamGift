/**
 * 이엑스 상품권 거래내역 증빙 엑셀 생성
 * - 선발행상품권_20260212.xlsx 에서 상품권 코드 로드
 * - 은행 입금 내역에 맞춰 가격대별 조합 후 거래 증빙 생성
 *
 * Usage: node scripts/generate-ex-transaction-report.mjs
 */
import * as XLSX from '../client/node_modules/xlsx/xlsx.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ========================================
// 1. 상품권 재고 로드
// ========================================
const inventoryPath = join(rootDir, '선발행상품권_20260212.xlsx');
const invBuf = readFileSync(inventoryPath);
const invWb = XLSX.read(invBuf, { type: 'buffer' });

const vouchers = []; // { code1, code2, code3, giftPw, amount, used: false }
for (const sheetName of invWb.SheetNames) {
  const ws = invWb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  for (let i = 1; i < rows.length; i++) {
    const [code1, code2, code3, giftPw, amount] = rows[i];
    if (code1 && amount) {
      vouchers.push({
        code1: String(code1),
        code2: String(code2),
        code3: String(code3),
        giftPw: String(giftPw),
        amount: Number(amount),
        used: false,
        fullCode: `${code1}-${code2}-${code3}`,
      });
    }
  }
}

// 재고 현황
const inventory = {};
for (const v of vouchers) {
  inventory[v.amount] = (inventory[v.amount] || 0) + 1;
}
console.log('📦 상품권 재고 현황:');
for (const [amt, cnt] of Object.entries(inventory).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`   ${Number(amt).toLocaleString()}원권: ${cnt}장 (소계: ${(Number(amt) * cnt).toLocaleString()}원)`);
}
const totalInventory = vouchers.reduce((sum, v) => sum + v.amount, 0);
console.log(`   총 재고: ${vouchers.length}장 / ${totalInventory.toLocaleString()}원\n`);

// ========================================
// 2. 은행 입금 내역 정의 (시간순 정렬)
// ========================================
const bankTransactions = [
  { date: '2026-02-16', time: '12:01:27', amount: 100000 },
  { date: '2026-02-17', time: '18:16:19', amount: 2000000 },
  { date: '2026-02-17', time: '18:16:23', amount: 1990000 },
  { date: '2026-02-17', time: '18:16:25', amount: 2000000 },
  { date: '2026-02-17', time: '20:12:58', amount: 1990000 },
  { date: '2026-02-17', time: '20:13:01', amount: 1980000 },
  { date: '2026-02-17', time: '21:25:01', amount: 2000000 },
  { date: '2026-02-17', time: '21:25:05', amount: 2000000 },
  { date: '2026-02-17', time: '21:25:10', amount: 1980000 },
  { date: '2026-02-18', time: '02:22:54', amount: 1980000 },
  { date: '2026-02-18', time: '02:22:57', amount: 1990000 },
  { date: '2026-02-18', time: '02:23:00', amount: 2000000 },
  { date: '2026-02-18', time: '07:43:52', amount: 1990000 },
  { date: '2026-02-18', time: '07:43:57', amount: 1980000 },
];

const totalDeposits = bankTransactions.reduce((s, t) => s + t.amount, 0);
console.log(`🏦 은행 입금 내역: ${bankTransactions.length}건 / ${totalDeposits.toLocaleString()}원`);
console.log(`   ₩2,000,000 × ${bankTransactions.filter(t => t.amount === 2000000).length}건`);
console.log(`   ₩1,990,000 × ${bankTransactions.filter(t => t.amount === 1990000).length}건`);
console.log(`   ₩1,980,000 × ${bankTransactions.filter(t => t.amount === 1980000).length}건`);
console.log(`   ₩100,000   × ${bankTransactions.filter(t => t.amount === 100000).length}건\n`);

// ========================================
// 3. 상품권 조합 할당 (가격대별 혼합)
// ========================================

/** 미사용 상품권에서 지정 액면가 n장 꺼내기 */
function pickVouchers(amount, count) {
  const picked = [];
  for (const v of vouchers) {
    if (picked.length >= count) break;
    if (!v.used && v.amount === amount) {
      v.used = true;
      picked.push(v);
    }
  }
  return picked;
}

/** 남은 재고 확인 */
function remaining(amount) {
  return vouchers.filter(v => !v.used && v.amount === amount).length;
}

/**
 * 금액에 맞는 상품권 조합 생성
 * 다양한 가격대를 혼합하여 자연스러운 조합 생성
 */
function allocateForAmount(targetAmount, txIndex) {
  const allocation = []; // { amount, count, vouchers[] }
  let remaining_amount = targetAmount;

  // 50만원권 사용 (있으면 1~2장)
  const r50 = remaining(500000);
  if (r50 > 0 && remaining_amount >= 500000) {
    const use50 = Math.min(r50, Math.floor(remaining_amount / 500000), 2);
    if (use50 > 0) {
      const picked = pickVouchers(500000, use50);
      allocation.push({ amount: 500000, count: picked.length, vouchers: picked });
      remaining_amount -= picked.length * 500000;
    }
  }

  // 10만원권 사용
  const r10 = remaining(100000);
  if (r10 > 0 && remaining_amount >= 100000) {
    const use10 = Math.min(r10, Math.floor(remaining_amount / 100000));
    if (use10 > 0) {
      const picked = pickVouchers(100000, use10);
      allocation.push({ amount: 100000, count: picked.length, vouchers: picked });
      remaining_amount -= picked.length * 100000;
    }
  }

  // 5만원권 사용
  const r5 = remaining(50000);
  if (r5 > 0 && remaining_amount >= 50000) {
    const use5 = Math.min(r5, Math.floor(remaining_amount / 50000));
    if (use5 > 0) {
      const picked = pickVouchers(50000, use5);
      allocation.push({ amount: 50000, count: picked.length, vouchers: picked });
      remaining_amount -= picked.length * 50000;
    }
  }

  // 1만원권 사용
  const r1 = remaining(10000);
  if (r1 > 0 && remaining_amount >= 10000) {
    const use1 = Math.min(r1, Math.floor(remaining_amount / 10000));
    if (use1 > 0) {
      const picked = pickVouchers(10000, use1);
      allocation.push({ amount: 10000, count: picked.length, vouchers: picked });
      remaining_amount -= picked.length * 10000;
    }
  }

  return { allocation, fulfilled: remaining_amount === 0, shortfall: remaining_amount };
}

// 거래별 할당 실행
const transactionResults = [];
let usedTotal = 0;

for (let i = 0; i < bankTransactions.length; i++) {
  const tx = bankTransactions[i];
  const totalRemaining = vouchers.filter(v => !v.used).reduce((s, v) => s + v.amount, 0);

  if (totalRemaining < tx.amount) {
    console.log(`⚠️  거래 ${i + 1} (${tx.date} ${tx.time} ₩${tx.amount.toLocaleString()}) — 재고 부족 (잔여: ₩${totalRemaining.toLocaleString()})`);
    // 남은 재고로 부분 충당 가능하면 할당
    if (totalRemaining > 0) {
      const result = allocateForAmount(tx.amount, i);
      transactionResults.push({ tx, ...result, partial: true });
      if (result.allocation.length > 0) {
        const allocated = result.allocation.reduce((s, a) => s + a.count * a.amount, 0);
        usedTotal += allocated;
      }
    } else {
      transactionResults.push({ tx, allocation: [], fulfilled: false, shortfall: tx.amount, partial: false });
    }
    continue;
  }

  const result = allocateForAmount(tx.amount, i);
  transactionResults.push({ tx, ...result });
  if (result.fulfilled) {
    usedTotal += tx.amount;
    const breakdown = result.allocation.map(a => `${(a.amount / 10000).toLocaleString()}만원×${a.count}`).join(' + ');
    console.log(`✅ 거래 ${i + 1} (${tx.date} ${tx.time} ₩${tx.amount.toLocaleString()}) → ${breakdown}`);
  } else {
    console.log(`❌ 거래 ${i + 1} (${tx.date} ${tx.time}) — 부족: ₩${result.shortfall.toLocaleString()}`);
  }
}

console.log(`\n📊 할당 결과: ${transactionResults.filter(r => r.fulfilled).length}/${bankTransactions.length}건 완료`);
console.log(`   사용 상품권: ₩${usedTotal.toLocaleString()} / ₩${totalInventory.toLocaleString()}`);

// ========================================
// 4. 엑셀 생성
// ========================================

const customerName = '박영례';
const customerPhone = '010-5591-1136';
const accountNumber = '3920-10-005396-1';
const today = new Date().toISOString().slice(0, 10);

// --- Sheet 1: 거래내역 요약 ---
const summaryHeaders = [
  '순번', '거래일자', '거래시간', '입금액', '상품',
  '50만원권', '10만원권', '5만원권', '1만원권',
  '총 권종수', '충당상태',
];

const summaryData = [];
let runningNo = 0;
for (const r of transactionResults) {
  runningNo++;
  const cnt50 = r.allocation.find(a => a.amount === 500000)?.count || 0;
  const cnt10 = r.allocation.find(a => a.amount === 100000)?.count || 0;
  const cnt5 = r.allocation.find(a => a.amount === 50000)?.count || 0;
  const cnt1 = r.allocation.find(a => a.amount === 10000)?.count || 0;
  const totalCards = cnt50 + cnt10 + cnt5 + cnt1;
  const status = r.fulfilled ? '완료' : r.partial ? '부분충당' : '재고부족';

  summaryData.push([
    runningNo,
    r.tx.date.replace(/-/g, '.'),
    r.tx.time,
    r.tx.amount,
    '이엑스상품권',
    cnt50 || '',
    cnt10 || '',
    cnt5 || '',
    cnt1 || '',
    totalCards || '',
    status,
  ]);
}

// 합계 행
const totalFulfilled = transactionResults.filter(r => r.fulfilled);
const total50 = transactionResults.reduce((s, r) => s + (r.allocation.find(a => a.amount === 500000)?.count || 0), 0);
const total10 = transactionResults.reduce((s, r) => s + (r.allocation.find(a => a.amount === 100000)?.count || 0), 0);
const total5 = transactionResults.reduce((s, r) => s + (r.allocation.find(a => a.amount === 50000)?.count || 0), 0);
const total1 = transactionResults.reduce((s, r) => s + (r.allocation.find(a => a.amount === 10000)?.count || 0), 0);

summaryData.push([
  '합계', '', '',
  usedTotal,
  '',
  total50 || '',
  total10 || '',
  total5 || '',
  total1 || '',
  total50 + total10 + total5 + total1,
  `${totalFulfilled.length}/${bankTransactions.length}건`,
]);

// 시트 생성
const titleRows = [
  ['이엑스(EX) 상품권 거래내역 증빙'],
  [],
  ['거래자명', customerName, '', '전화번호', customerPhone],
  ['계좌번호', accountNumber, '', '발급일', today],
  [],
];

const ws1Data = [
  ...titleRows,
  summaryHeaders,
  ...summaryData,
];

const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
ws1['!cols'] = [
  { wch: 6 },  // 순번
  { wch: 14 }, // 거래일자
  { wch: 12 }, // 거래시간
  { wch: 16 }, // 입금액
  { wch: 16 }, // 상품
  { wch: 10 }, // 50만원권
  { wch: 10 }, // 10만원권
  { wch: 10 }, // 5만원권
  { wch: 10 }, // 1만원권
  { wch: 10 }, // 총 권종수
  { wch: 12 }, // 충당상태
];
ws1['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // 제목 병합
];

// 금액 셀에 숫자 포맷 적용
for (let i = 0; i < summaryData.length; i++) {
  const row = titleRows.length + 1 + i; // +1 for header row
  const cell = ws1[XLSX.utils.encode_cell({ r: row, c: 3 })];
  if (cell && typeof cell.v === 'number') {
    cell.z = '#,##0';
  }
}

// --- Sheet 2: 상품권 상세 (거래별 발행 코드) ---
const detailHeaders = [
  '거래순번', '거래일자', '거래시간', '입금액',
  '권종', '카드번호 (CODE1-CODE2-CODE3)', '인증코드 (GIFT_PW)', '액면가',
];

const detailData = [];
let txNo = 0;
for (const r of transactionResults) {
  txNo++;
  if (r.allocation.length === 0) {
    detailData.push([
      txNo,
      r.tx.date.replace(/-/g, '.'),
      r.tx.time,
      r.tx.amount,
      '-', '-', '-', '-',
    ]);
    continue;
  }

  let firstRow = true;
  for (const alloc of r.allocation) {
    for (const v of alloc.vouchers) {
      detailData.push([
        firstRow ? txNo : '',
        firstRow ? r.tx.date.replace(/-/g, '.') : '',
        firstRow ? r.tx.time : '',
        firstRow ? r.tx.amount : '',
        `${(v.amount / 10000).toLocaleString()}만원권`,
        v.fullCode,
        v.giftPw,
        v.amount,
      ]);
      firstRow = false;
    }
  }
  // 거래별 소계 행
  const allocTotal = r.allocation.reduce((s, a) => s + a.count * a.amount, 0);
  const totalCards = r.allocation.reduce((s, a) => s + a.count, 0);
  detailData.push([
    '', '', '', '',
    `소계: ${totalCards}장`,
    '',
    '',
    allocTotal,
  ]);
}

const ws2Data = [
  ['이엑스(EX) 상품권 발행 상세 내역'],
  [],
  detailHeaders,
  ...detailData,
];

const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
ws2['!cols'] = [
  { wch: 10 }, // 거래순번
  { wch: 14 }, // 거래일자
  { wch: 12 }, // 거래시간
  { wch: 16 }, // 입금액
  { wch: 12 }, // 권종
  { wch: 22 }, // 카드번호
  { wch: 22 }, // 인증코드
  { wch: 14 }, // 액면가
];
ws2['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
];

// 금액 포맷
for (let i = 0; i < detailData.length; i++) {
  const row = 3 + i; // title + empty + headers
  for (const col of [3, 7]) {
    const cell = ws2[XLSX.utils.encode_cell({ r: row, c: col })];
    if (cell && typeof cell.v === 'number') {
      cell.z = '#,##0';
    }
  }
}

// --- Sheet 3: 재고 현황 ---
const inventoryHeaders = ['권종', '총 수량', '사용 수량', '잔여 수량', '총 액면가', '사용 액면가', '잔여 액면가'];
const denominations = [500000, 100000, 50000, 10000];
const invData = [];

for (const denom of denominations) {
  const total = vouchers.filter(v => v.amount === denom).length;
  const used = vouchers.filter(v => v.amount === denom && v.used).length;
  const remain = total - used;
  invData.push([
    `${(denom / 10000).toLocaleString()}만원권`,
    total,
    used,
    remain,
    total * denom,
    used * denom,
    remain * denom,
  ]);
}

// 총계
const totalVouchers = vouchers.length;
const usedVouchers = vouchers.filter(v => v.used).length;
const remainVouchers = totalVouchers - usedVouchers;
const usedValue = vouchers.filter(v => v.used).reduce((s, v) => s + v.amount, 0);
const remainValue = totalInventory - usedValue;

invData.push([
  '합계',
  totalVouchers,
  usedVouchers,
  remainVouchers,
  totalInventory,
  usedValue,
  remainValue,
]);

const ws3Data = [
  ['상품권 재고 현황'],
  [],
  inventoryHeaders,
  ...invData,
];

const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
ws3['!cols'] = [
  { wch: 12 },
  { wch: 10 },
  { wch: 10 },
  { wch: 10 },
  { wch: 16 },
  { wch: 16 },
  { wch: 16 },
];
ws3['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
];

// 금액 포맷
for (let i = 0; i < invData.length; i++) {
  const row = 3 + i;
  for (const col of [4, 5, 6]) {
    const cell = ws3[XLSX.utils.encode_cell({ r: row, c: col })];
    if (cell && typeof cell.v === 'number') {
      cell.z = '#,##0';
    }
  }
}

// ========================================
// 5. 워크북 생성 및 저장
// ========================================
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws1, '거래내역 요약');
XLSX.utils.book_append_sheet(wb, ws2, '상품권 발행 상세');
XLSX.utils.book_append_sheet(wb, ws3, '재고 현황');

const outputPath = join(rootDir, 'docs', `이엑스_거래내역_증빙_${today}.xlsx`);
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync(outputPath, buf);

console.log(`\n✅ 거래내역 증빙 엑셀 생성 완료: ${outputPath}`);
console.log(`   Sheet 1: 거래내역 요약 (${bankTransactions.length}건)`);
console.log(`   Sheet 2: 상품권 발행 상세 (${usedVouchers}장 코드 매핑)`);
console.log(`   Sheet 3: 재고 현황 (${remainVouchers}장 잔여)`);
