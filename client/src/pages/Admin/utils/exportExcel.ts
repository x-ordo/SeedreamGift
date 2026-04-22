/**
 * @file exportExcel.ts
 * @description 엑셀 내보내기 유틸리티 (어드민 + 사용자)
 */
import siteConfig from '../../../../../site.config.json';
// XLSX는 동적 import로 로드 (425KB+ 번들 절약)
type XLSX = typeof import('xlsx');
let _xlsx: XLSX | null = null;
async function getXLSX(): Promise<XLSX> {
  if (!_xlsx) _xlsx = await import('xlsx');
  return _xlsx;
}

interface ExcelColumn<T> {
  header: string;
  accessor: (row: T) => string | number | undefined;
}

/**
 * 데이터를 엑셀 파일(.xlsx)로 내보내기
 */
export async function exportToExcel<T>(
  rows: T[],
  columns: ExcelColumn<T>[],
  filename: string,
) {
  const XLSX = await getXLSX();
  const headers = columns.map(c => c.header);
  const data = rows.map(row => columns.map(c => c.accessor(row) ?? ''));

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Auto-fit column widths
  ws['!cols'] = columns.map((_, i) => {
    const maxLen = Math.max(
      headers[i].length,
      ...data.map(row => String(row[i]).length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export type PinOption = 'full' | 'masked' | 'none';

interface BankTransactionRow {
  transactionId: string;
  type: 'SALE' | 'PURCHASE';
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  brandCode: string;
  quantity: number;
  unitPrice: number;
  faceValue?: number;
  totalAmount: number;
  pin: string;
  status: string;
  paymentMethod: string;
}

const TYPE_LABEL: Record<string, string> = { SALE: '판매', PURCHASE: '매입' };
const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기', PAID: '결제완료', DELIVERED: '배송완료',
  CANCELLED: '취소', REQUESTED: '요청', VERIFIED: '확인',
  REJECTED: '거부', PAID_OUT: '지급완료',
};

/** 은행보고서 컬럼 — pinOption에 따라 PIN 포함/제외 */
export function getBankReportColumns(pinOption: PinOption = 'masked'): ExcelColumn<BankTransactionRow>[] {
  const cols: ExcelColumn<BankTransactionRow>[] = [
    { header: '거래번호', accessor: (r) => r.transactionId },
    { header: '거래유형', accessor: (r) => TYPE_LABEL[r.type] || r.type },
    { header: '거래일시', accessor: (r) => new Date(r.date).toLocaleString('ko-KR') },
    { header: '고객명', accessor: (r) => r.customerName },
    { header: '전화번호', accessor: (r) => r.customerPhone },
    { header: '주소', accessor: (r) => r.customerAddress },
    { header: '상품명', accessor: (r) => r.productName },
    { header: '브랜드', accessor: (r) => r.brandCode },
    { header: '수량', accessor: (r) => r.quantity },
    { header: '단가', accessor: (r) => r.unitPrice },
    { header: '액면가', accessor: (r) => r.faceValue ?? '' },
    { header: '거래금액', accessor: (r) => r.totalAmount },
  ];
  if (pinOption !== 'none') {
    cols.push({ header: 'PIN번호', accessor: (r) => r.pin });
  }
  cols.push(
    { header: '상태', accessor: (r) => STATUS_LABEL[r.status] || r.status },
    { header: '결제수단', accessor: (r) => r.paymentMethod },
  );
  return cols;
}

// Backward-compatible export (masked PIN by default)
export const BANK_REPORT_COLUMNS = getBankReportColumns('masked');

/**
 * 은행제출 거래내역 보고서 Excel 내보내기
 * 합계 행 포함
 */
export async function exportBankReport(
  items: BankTransactionRow[],
  summary: { totalSales: number; totalPurchases: number; netAmount: number; transactionCount: number },
  startDate: string,
  endDate: string,
  pinOption: PinOption = 'masked',
) {
  const summaryRow = {
    transactionId: '합계',
    type: '' as any,
    date: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    productName: '',
    brandCode: '',
    quantity: summary.transactionCount,
    unitPrice: 0,
    faceValue: 0,
    totalAmount: summary.netAmount,
    pin: '',
    status: `판매: ${summary.totalSales.toLocaleString()} / 매입: ${summary.totalPurchases.toLocaleString()}`,
    paymentMethod: '',
  };

  const rows = [...items, summaryRow];
  const columns = getBankReportColumns(pinOption);
  const filename = `은행제출_거래내역_${startDate}_${endDate}`;
  await exportToExcel(rows, columns, filename);
}

// ========================================
// 사용자 거래내역 증빙
// ========================================

export interface UserTransactionRow {
  transactionId: string;
  type: 'SALE' | 'PURCHASE';
  date: string;
  productName: string;
  brandCode: string;
  quantity: number;
  unitPrice: number;
  faceValue?: number;
  totalAmount: number;
  pin: string;
  status: string;
  paymentMethod: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddr?: string;
  bankName?: string;
  accountNum?: string;
  accountHolder?: string;
  note?: string;
}

export interface UserTransactionSummary {
  totalSales: number;
  totalPurchases: number;
  netAmount: number;
  salesCount: number;
  purchasesCount: number;
  transactionCount: number;
}

const USER_TYPE_LABEL: Record<string, string> = { SALE: '판매(구매)', PURCHASE: '매입(환매)' };

/** 사용자 거래내역 컬럼 — pinOption에 따라 PIN 포함/제외 */
export function getUserTransactionColumns(pinOption: PinOption = 'masked'): ExcelColumn<UserTransactionRow>[] {
  const cols: ExcelColumn<UserTransactionRow>[] = [
    { header: '거래번호', accessor: (r) => r.transactionId },
    { header: '거래유형', accessor: (r) => USER_TYPE_LABEL[r.type] || r.type },
    { header: '거래일시', accessor: (r) => new Date(r.date).toLocaleString('ko-KR') },
    { header: '상품명', accessor: (r) => r.productName },
    { header: '브랜드', accessor: (r) => r.brandCode },
    { header: '수량', accessor: (r) => r.quantity },
    { header: '단가', accessor: (r) => r.unitPrice },
    { header: '액면가', accessor: (r) => r.faceValue ?? '' },
    { header: '거래금액', accessor: (r) => r.totalAmount },
  ];
  if (pinOption !== 'none') {
    cols.push({ header: 'PIN번호', accessor: (r) => r.pin });
  }
  cols.push(
    { header: '상태', accessor: (r) => STATUS_LABEL[r.status] || r.status },
    { header: '결제수단', accessor: (r) => r.paymentMethod },
    { header: '판매자/수령인', accessor: (r) => r.recipientName || '' },
    { header: '연락처', accessor: (r) => r.recipientPhone || '' },
    { header: '배송주소', accessor: (r) => r.recipientAddr || '' },
    { header: '입금은행', accessor: (r) => r.bankName || '' },
    { header: '계좌번호', accessor: (r) => r.accountNum || '' },
    { header: '예금주', accessor: (r) => r.accountHolder || '' },
    { header: '비고', accessor: (r) => r.note || '' },
  );
  return cols;
}

// Backward-compatible export
export const USER_TRANSACTION_COLUMNS = getUserTransactionColumns('masked');

// ========================================
// 은행제출 매입 증빙 (2-Sheet)
// ========================================

export interface TradeInPayoutRow {
  tradeInId: string;
  date: string;
  sellerName: string;
  sellerPhone: string;
  bankName: string;
  accountHolder: string;
  accountNum: string;
  productName: string;
  brandCode: string;
  quantity: number;
  faceValue: number;
  payoutAmount: number;
  pinCode: string;
  securityCode: string;
  status: string;
  adminNote: string;
}

export interface TradeInPayoutSummary {
  totalRecords: number;
  totalQuantity: number;
  totalFaceValue: number;
  totalPayout: number;
  startDate?: string;
  endDate?: string;
}

interface BankSubmissionOptions {
  buyerName?: string;
  /** admin: PIN/securityCode full 허용, user: 항상 masked */
  role?: 'admin' | 'user';
}

/**
 * 은행제출 매입 증빙 2-Sheet 엑셀 생성
 *
 * Sheet 1: 매입 거래내역 증빙 (요약 + 합계)
 * Sheet 2: 상품권 매입 상세 (거래별 그룹핑, PIN/securityCode 포함)
 */
export async function exportBankSubmissionReport(
  items: TradeInPayoutRow[],
  summary: TradeInPayoutSummary,
  options: BankSubmissionOptions = {},
) {
  const XLSX = await getXLSX();
  const buyerName = options.buyerName || siteConfig.company.nameShort;
  const today = new Date().toISOString().slice(0, 10);

  // ---- Sheet 1: 매입 거래내역 증빙 ----
  const titleRows: (string | number)[][] = [
    [`${buyerName} 매입 거래내역 증빙 (${today} 발급)`],
    [],
    ['매입자(당사)', buyerName, '', '발급일', today],
    [],
  ];

  const sheet1Headers = [
    '거래번호', '거래유형', '거래일시', '상품명', '브랜드',
    '수량', '액면가', '매입대금', 'PIN번호',
    '상태', '결제수단', '판매자', '연락처',
    '입금은행', '입금계좌', '예금주',
  ];

  const sheet1Data = items.map((r) => [
    r.tradeInId,
    '매입(환매)',
    new Date(r.date).toLocaleString('ko-KR'),
    r.productName,
    r.brandCode,
    r.quantity,
    r.faceValue,
    r.payoutAmount,
    r.pinCode || '-',
    STATUS_LABEL[r.status] || r.status,
    '계좌이체',
    r.sellerName,
    r.sellerPhone,
    r.bankName,
    r.accountNum,
    r.accountHolder,
  ]);

  const summaryRow1 = [
    '합계', '', '', '', '',
    summary.totalQuantity,
    summary.totalFaceValue,
    summary.totalPayout,
    '', `${summary.totalRecords}건`, '',
    '', '', '', '', '',
  ];

  const ws1Data = [...titleRows, sheet1Headers, ...sheet1Data, [], summaryRow1];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  ws1['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 8 },
    { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 },
    { wch: 10 }, { wch: 20 }, { wch: 10 },
  ];
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }];

  // Apply number format to amount columns (faceValue=6, payoutAmount=7)
  const hdrRow = titleRows.length;
  for (let i = 0; i <= sheet1Data.length + 1; i++) {
    const r = hdrRow + 1 + i;
    for (const c of [6, 7]) {
      const cell = ws1[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0';
    }
  }

  // ---- Sheet 2: 상품권 매입 상세 ----
  const sheet2Title: (string | number)[][] = [
    [`상품권 매입 상세 — ${buyerName} (${today} 발급)`],
    [],
  ];

  const sheet2Headers = [
    '거래번호', '거래일시', '매입대금', '순번',
    '권종', '카드번호(PIN)', '인증코드', '액면가',
  ];

  // Group by same date + sellerName for visual grouping
  const sheet2Rows: (string | number)[][] = [];
  let globalSeq = 0;

  for (const item of items) {
    for (let q = 0; q < item.quantity; q++) {
      globalSeq++;
      sheet2Rows.push([
        q === 0 ? item.tradeInId : '',
        q === 0 ? new Date(item.date).toLocaleString('ko-KR') : '',
        q === 0 ? item.payoutAmount : '',
        globalSeq,
        `${(item.faceValue / 10000).toFixed(0)}만원권`,
        item.pinCode || '-',
        item.securityCode || '-',
        item.faceValue,
      ]);
    }
  }

  // 총계
  sheet2Rows.push([]);
  sheet2Rows.push([
    '총계', '', summary.totalPayout, '',
    `${summary.totalQuantity}장`, '', '', summary.totalFaceValue,
  ]);

  const ws2Data = [...sheet2Title, sheet2Headers, ...sheet2Rows];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 6 },
    { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 14 },
  ];
  ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

  // Number format for amount columns in sheet 2
  for (let i = 0; i < sheet2Rows.length; i++) {
    for (const c of [2, 7]) {
      const cell = ws2[XLSX.utils.encode_cell({ r: sheet2Title.length + 1 + i, c })];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0';
    }
  }

  // ---- 저장 ----
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, '매입 거래내역 증빙');
  XLSX.utils.book_append_sheet(wb, ws2, '상품권 매입 상세');

  const dateRange = summary.startDate && summary.endDate
    ? `${summary.startDate}_${summary.endDate}`
    : today;
  XLSX.writeFile(wb, `은행제출_매입증빙_${dateRange}.xlsx`);
}

/**
 * 사용자 거래내역 증빙 Excel 내보내기
 * 합계 행 + 발급정보 포함
 */
export async function exportUserTransactionReport(
  items: UserTransactionRow[],
  summary: UserTransactionSummary,
  userName?: string,
  pinOption: PinOption = 'masked',
) {
  const today = new Date().toISOString().slice(0, 10);

  const summaryRow: UserTransactionRow = {
    transactionId: '합계',
    type: '' as any,
    date: '',
    productName: '',
    brandCode: '',
    quantity: summary.transactionCount,
    unitPrice: 0,
    faceValue: 0,
    totalAmount: summary.netAmount,
    pin: '',
    status: `판매 ${summary.salesCount}건 (${summary.totalSales.toLocaleString()}원) / 매입 ${summary.purchasesCount}건 (${summary.totalPurchases.toLocaleString()}원)`,
    paymentMethod: '',
    note: `발급일: ${today} | ${siteConfig.company.nameShort} (${import.meta.env.VITE_SITE_URL || siteConfig.urls.domain})`,
  };

  const rows = [...items, summaryRow];
  const columns = getUserTransactionColumns(pinOption);
  const filename = `거래내역_증빙_${userName || '사용자'}_${today}`;
  await exportToExcel(rows, columns, filename);
}
