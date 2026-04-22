/**
 * 사용자 거래내역 증빙 엑셀 템플릿 생성 스크립트
 * Usage: node scripts/generate-export-template.mjs
 */
import * as XLSX from '../client/node_modules/xlsx/xlsx.mjs';

// ========================================
// 상태/유형 라벨
// ========================================
const TYPE_LABEL = { SALE: '판매(구매)', PURCHASE: '매입(환매)' };
const STATUS_LABEL = {
  PENDING: '대기', PAID: '결제완료', DELIVERED: '배송완료',
  CANCELLED: '취소', REQUESTED: '요청', VERIFIED: '확인',
  REJECTED: '거부', PAID_OUT: '지급완료',
};

// ========================================
// 샘플 데이터
// ========================================
const sampleItems = [
  {
    transactionId: 'ORD-1001',
    type: 'SALE',
    date: '2026-02-10T09:30:00.000Z',
    productName: '신세계 5만원권',
    brandCode: 'SHINSEGAE',
    quantity: 2,
    unitPrice: 47500,
    totalAmount: 95000,
    pin: '3A8F****',
    status: 'DELIVERED',
    paymentMethod: '계좌이체',
    recipientName: '홍길동',
    recipientPhone: '010-1234-5678',
    recipientAddr: '서울시 강남구 테헤란로 123',
    bankName: '',
    accountNum: '',
    accountHolder: '',
    note: '',
  },
  {
    transactionId: 'ORD-1002',
    type: 'SALE',
    date: '2026-02-12T14:15:00.000Z',
    productName: '현대 10만원권',
    brandCode: 'HYUNDAI',
    quantity: 1,
    unitPrice: 95000,
    totalAmount: 95000,
    pin: '7B2C****',
    status: 'PAID',
    paymentMethod: '계좌이체',
    recipientName: '',
    recipientPhone: '',
    recipientAddr: '',
    bankName: '',
    accountNum: '',
    accountHolder: '',
    note: '',
  },
  {
    transactionId: 'ORD-1003',
    type: 'SALE',
    date: '2026-02-15T11:00:00.000Z',
    productName: '롯데 3만원권',
    brandCode: 'LOTTE',
    quantity: 3,
    unitPrice: 28500,
    totalAmount: 85500,
    pin: '9D4E****, 1F6G****, 2H8J****',
    status: 'DELIVERED',
    paymentMethod: '계좌이체',
    recipientName: '김영희',
    recipientPhone: '010-9876-5432',
    recipientAddr: '부산시 해운대구 센텀로 45',
    bankName: '',
    accountNum: '',
    accountHolder: '',
    note: '',
  },
  {
    transactionId: 'TI-501',
    type: 'PURCHASE',
    date: '2026-02-11T16:45:00.000Z',
    productName: '신세계 10만원권',
    brandCode: 'SHINSEGAE',
    quantity: 1,
    unitPrice: 100000,
    totalAmount: 92000,
    pin: '5K2M****',
    status: 'PAID_OUT',
    paymentMethod: '계좌이체',
    recipientName: '',
    recipientPhone: '',
    recipientAddr: '',
    bankName: '국민은행',
    accountNum: '***-****-4567',
    accountHolder: '홍길동',
    note: '',
  },
  {
    transactionId: 'TI-502',
    type: 'PURCHASE',
    date: '2026-02-18T10:20:00.000Z',
    productName: '현대 5만원권',
    brandCode: 'HYUNDAI',
    quantity: 2,
    unitPrice: 50000,
    totalAmount: 90000,
    pin: '4N7P****, 8Q1R****',
    status: 'VERIFIED',
    paymentMethod: '계좌이체',
    recipientName: '',
    recipientPhone: '',
    recipientAddr: '',
    bankName: '신한은행',
    accountNum: '***-****-8901',
    accountHolder: '홍길동',
    note: '',
  },
  {
    transactionId: 'ORD-1004',
    type: 'SALE',
    date: '2026-02-20T08:10:00.000Z',
    productName: '다이소 1만원권',
    brandCode: 'DAISO',
    quantity: 5,
    unitPrice: 9500,
    totalAmount: 47500,
    pin: '6S3T****, 0U5V****, 2W7X****, 4Y9Z****, 1A3B****',
    status: 'PENDING',
    paymentMethod: '계좌이체',
    recipientName: '',
    recipientPhone: '',
    recipientAddr: '',
    bankName: '',
    accountNum: '',
    accountHolder: '',
    note: '',
  },
  {
    transactionId: 'TI-503',
    type: 'PURCHASE',
    date: '2026-02-22T13:30:00.000Z',
    productName: '올리브영 3만원권',
    brandCode: 'OLIVEYOUNG',
    quantity: 1,
    unitPrice: 30000,
    totalAmount: 27000,
    pin: '8C1D****',
    status: 'REJECTED',
    paymentMethod: '계좌이체',
    recipientName: '',
    recipientPhone: '',
    recipientAddr: '',
    bankName: '우리은행',
    accountNum: '***-****-2345',
    accountHolder: '홍길동',
    note: 'PIN 유효기간 만료',
  },
];

const summary = {
  totalSales: 323000,
  totalPurchases: 209000,
  netAmount: 114000,
  salesCount: 4,
  purchasesCount: 3,
  transactionCount: 7,
};

// ========================================
// 컬럼 정의
// ========================================
const columns = [
  { header: '거래번호', key: 'transactionId', width: 14 },
  { header: '거래유형', key: 'type', width: 14, format: (v) => TYPE_LABEL[v] || v },
  { header: '거래일시', key: 'date', width: 20, format: (v) => new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) },
  { header: '상품명', key: 'productName', width: 20 },
  { header: '브랜드', key: 'brandCode', width: 14 },
  { header: '수량', key: 'quantity', width: 8 },
  { header: '단가', key: 'unitPrice', width: 14 },
  { header: '거래금액', key: 'totalAmount', width: 14 },
  { header: 'PIN번호', key: 'pin', width: 36 },
  { header: '상태', key: 'status', width: 12, format: (v) => STATUS_LABEL[v] || v },
  { header: '결제수단', key: 'paymentMethod', width: 12 },
  { header: '수령인', key: 'recipientName', width: 12 },
  { header: '수령인 연락처', key: 'recipientPhone', width: 16 },
  { header: '배송주소', key: 'recipientAddr', width: 30 },
  { header: '입금은행', key: 'bankName', width: 12 },
  { header: '계좌번호', key: 'accountNum', width: 16 },
  { header: '예금주', key: 'accountHolder', width: 10 },
  { header: '비고', key: 'note', width: 20 },
];

// ========================================
// 엑셀 생성
// ========================================
const today = new Date().toISOString().slice(0, 10);

// 헤더 + 데이터 행 생성
const headers = columns.map(c => c.header);
const dataRows = sampleItems.map(item =>
  columns.map(c => {
    const val = item[c.key] ?? '';
    return c.format ? c.format(val) : val;
  })
);

// 합계 행
const summaryRow = [
  '합계', '', '', '', '',
  summary.transactionCount,
  '',
  summary.netAmount,
  '',
  `판매 ${summary.salesCount}건 (${summary.totalSales.toLocaleString()}원) / 매입 ${summary.purchasesCount}건 (${summary.totalPurchases.toLocaleString()}원)`,
  '', '', '', '', '', '', '',
  `발급일: ${today} | 씨드림기프트 (seedreamgift.com)`,
];

// 시트 제목 행
const titleRow = [`씨드림기프트 거래내역 증빙 — 홍길동 (${today} 발급)`];
const emptyRow = [];

const allRows = [
  titleRow,
  emptyRow,
  headers,
  ...dataRows,
  emptyRow,
  summaryRow,
];

const ws = XLSX.utils.aoa_to_sheet(allRows);

// 열 너비 설정
ws['!cols'] = columns.map(c => ({ wch: c.width }));

// 셀 병합: 제목 행 (A1:R1)
ws['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '거래내역');

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '..', 'docs', '거래내역_증빙_템플릿_샘플.xlsx');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync(outputPath, buf);

console.log(`✅ 템플릿 생성 완료: ${outputPath}`);
console.log(`   - 샘플 데이터: ${sampleItems.length}건 (판매 ${summary.salesCount}건 + 매입 ${summary.purchasesCount}건)`);
console.log(`   - 컬럼: ${columns.length}열`);
console.log(`   - 합계 행 포함`);
