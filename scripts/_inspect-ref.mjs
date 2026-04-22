import * as XLSX from '../client/node_modules/xlsx/xlsx.mjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const files = [
  'data/송영수_상품권_구매거래내역.xlsx',
  'data/은행제출_판매거래_증빙_2026-02-26_송영수.xlsx',
  'data/은행제출_박영례_매입거래_증빙_2026-02-26.xlsx',
];

for (const f of files) {
  console.log(`\n════════════════════════════════════════`);
  console.log(`FILE: ${f}`);
  console.log(`════════════════════════════════════════`);
  const buf = readFileSync(join(rootDir, f));
  const wb = XLSX.read(buf, { type: 'buffer' });
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log(`\n--- Sheet: ${sn} (rows=${rows.length}) ---`);
    const max = Math.min(rows.length, 20);
    for (let i = 0; i < max; i++) console.log(`[${i}]`, JSON.stringify(rows[i]));
    if (rows.length > max) console.log(`... (+${rows.length - max} more rows)`);
  }
}
