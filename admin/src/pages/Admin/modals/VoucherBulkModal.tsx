
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../../../contexts/ToastContext';
import { adminApi } from '../../../api';
import { Button, Modal } from '../../../design-system';
import { COLORS } from '../../../constants/designTokens';

interface Product {
    id: number;
    name: string;
    brandCode: string;
}

interface StructuredVoucher {
    pin: string;
    giftNumber?: string;
    securityCode?: string;
}

interface VoucherBulkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type InputMode = 'excel' | 'text';

/** EX 등 giftNumberPattern이 있는 브랜드인지 판별 */
const EX_BRAND_CODES = ['EX'];

const VoucherBulkModal: React.FC<VoucherBulkModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
    const [pinCodes, setPinCodes] = useState('');
    const [inputMode, setInputMode] = useState<InputMode>('excel');
    const [excelPins, setExcelPins] = useState<string[]>([]);
    const [excelVouchers, setExcelVouchers] = useState<StructuredVoucher[]>([]);
    const [excelFileName, setExcelFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const selectedProduct = useMemo(
        () => products.find(p => p.id === selectedProductId),
        [products, selectedProductId],
    );
    const isExBrand = selectedProduct && EX_BRAND_CODES.includes(selectedProduct.brandCode);

    useEffect(() => {
        if (isOpen) {
            loadProducts();
            setPinCodes('');
            setExcelPins([]);
            setExcelVouchers([]);
            setExcelFileName('');
        }
    }, [isOpen]);

    const loadProducts = async () => {
        try {
            const res = await adminApi.getAllProducts({ page: 1, limit: 100 });
            setProducts(res?.items ?? []);
        } catch {
            showToast({ message: '상품 목록을 불러오지 못했습니다.', type: 'error' });
        }
    };

    // --- Excel Template Download (브랜드별 분기) ---
    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();

        if (isExBrand) {
            const data = [
                ['CODE1', 'CODE2', 'CODE3', 'GIFT_PW', 'AMOUNT'],
                ['S00', '9007', '85970', 'QcwjbhUw50GtvSpu', '10000'],
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 10 }];
            XLSX.utils.book_append_sheet(wb, ws, 'EX상품권');
            XLSX.writeFile(wb, 'EX_대량등록_템플릿.xlsx');
        } else {
            const data = [
                ['PIN코드'],
                ['1111-2222-3333-4444'],
                ['5555-6666-7777-8888'],
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!cols'] = [{ wch: 25 }];
            XLSX.utils.book_append_sheet(wb, ws, 'PIN목록');
            XLSX.writeFile(wb, 'PIN_대량등록_템플릿.xlsx');
        }
    };

    // --- Excel File Upload ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];

                if (isExBrand) {
                    // EX 브랜드: CODE1, CODE2, CODE3, GIFT_PW 컬럼
                    const vouchers: StructuredVoucher[] = rows
                        .slice(1)
                        .filter(row => row.length >= 4 && String(row[3] ?? '').trim())
                        .map(row => ({
                            giftNumber: `${String(row[0] ?? '').trim()}${String(row[1] ?? '').trim()}${String(row[2] ?? '').trim()}`,
                            pin: String(row[3] ?? '').trim(),
                        }));

                    if (vouchers.length === 0) {
                        showToast({ message: '유효한 데이터가 없습니다. CODE1~CODE3, GIFT_PW 열을 확인해주세요.', type: 'warning' });
                        return;
                    }

                    setExcelVouchers(vouchers);
                    setExcelPins([]);
                    setExcelFileName(file.name);
                    showToast({ message: `${vouchers.length}개의 바우처를 읽었습니다.`, type: 'success' });
                } else {
                    // 기존 브랜드: 첫 컬럼만 PIN
                    const pins = rows
                        .slice(1)
                        .map(row => String(row[0] ?? '').trim())
                        .filter(pin => pin.length > 0);

                    if (pins.length === 0) {
                        showToast({ message: '유효한 PIN 코드가 없습니다. 첫 번째 열에 PIN을 입력해주세요.', type: 'warning' });
                        return;
                    }

                    setExcelPins(pins);
                    setExcelVouchers([]);
                    setExcelFileName(file.name);
                    showToast({ message: `${pins.length}개의 PIN 코드를 읽었습니다.`, type: 'success' });
                }
            } catch {
                showToast({ message: '엑셀 파일 파싱에 실패했습니다. 올바른 .xlsx 파일인지 확인해주세요.', type: 'error' });
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const handleRemoveFile = () => {
        setExcelPins([]);
        setExcelVouchers([]);
        setExcelFileName('');
    };

    // --- Submit ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProductId) {
            showToast({ message: '상품을 선택해주세요.', type: 'warning' });
            return;
        }

        // EX 브랜드이고 구조화 데이터가 있으면 vouchers로 전송
        if (isExBrand && excelVouchers.length > 0) {
            setLoading(true);
            try {
                const result = await adminApi.bulkCreateVouchers({
                    productId: Number(selectedProductId),
                    vouchers: excelVouchers,
                });

                const created = result?.count ?? result?.success ?? 0;
                showToast({ message: `${created}건 등록 완료`, type: 'success' });
                onSuccess();
            } catch {
                showToast({ message: '등록 실패', type: 'error' });
            } finally {
                setLoading(false);
            }
            return;
        }

        // 기존 방식 (pinCodes)
        const pins = inputMode === 'excel'
            ? excelPins
            : pinCodes.split('\n').map(p => p.trim()).filter(p => p);

        if (pins.length === 0) {
            showToast({ message: 'PIN 코드를 입력해주세요.', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const result = await adminApi.bulkCreateVouchers({
                productId: Number(selectedProductId),
                pinCodes: pins
            });

            const created = result?.count ?? result?.success ?? pins.length;
            const duplicates = result?.duplicates ?? 0;
            const errors = result?.errors?.length ?? 0;

            const parts = [`${created}건 등록`];
            if (duplicates > 0) parts.push(`${duplicates}건 중복 스킵`);
            if (errors > 0) parts.push(`${errors}건 오류`);

            const type = errors > 0 ? 'error' : duplicates > 0 ? 'warning' : 'success';
            showToast({ message: parts.join(', '), type });
            onSuccess();
        } catch {
            showToast({ message: '등록 실패', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const activePinCount = isExBrand
        ? excelVouchers.length
        : inputMode === 'excel'
            ? excelPins.length
            : pinCodes.split('\n').filter(p => p.trim()).length;

    const previewItems = isExBrand
        ? excelVouchers.slice(0, 5).map(v => `${v.giftNumber} | ${v.pin}`)
        : excelPins.slice(0, 5);

    const totalExcelCount = isExBrand ? excelVouchers.length : excelPins.length;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="바우처 대량 등록"
            footer={
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={onClose} type="button">취소</Button>
                    <Button variant="primary" type="button" loading={loading} disabled={activePinCount === 0} onClick={handleSubmit}>
                        일괄 등록 ({activePinCount}건)
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="admin-form-body">
                {/* 상품 선택 */}
                <div>
                    <label className="admin-form-label">상품 선택</label>
                    <select
                        className="form-control"
                        value={selectedProductId}
                        onChange={e => {
                            setSelectedProductId(Number(e.target.value));
                            handleRemoveFile();
                        }}
                        required
                    >
                        <option value="">상품을 선택하세요</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.brandCode})</option>
                        ))}
                    </select>
                </div>

                {/* EX 브랜드 안내 */}
                {isExBrand && (
                    <div
                        className="p-2 rounded-sm text-xs leading-normal"
                        style={{ background: '#F3F0FF', color: '#6D28D9' }}
                    >
                        EX 상품권은 엑셀에서 CODE1, CODE2, CODE3, GIFT_PW 열을 읽습니다.
                        카드번호(CODE1+2+3)와 인증코드(GIFT_PW)로 분리 저장됩니다.
                    </div>
                )}

                {/* 입력 방식 전환 탭 */}
                <div className="flex gap-1 mb-2" style={{ borderBottom: `1px solid ${COLORS.grey200}` }}>
                    {([['excel', '엑셀 업로드'], ['text', '직접 입력']] as const).map(([mode, label]) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setInputMode(mode)}
                            className="px-3 py-2 bg-transparent border-none cursor-pointer -mb-px"
                            style={{
                                fontSize: '13px',
                                fontWeight: inputMode === mode ? 600 : 400,
                                color: inputMode === mode ? COLORS.primary : COLORS.grey500,
                                borderBottom: inputMode === mode ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* 엑셀 업로드 모드 */}
                {inputMode === 'excel' && (
                    <div>
                        <div className="flex gap-2 mb-3">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleDownloadTemplate}
                            >
                                템플릿 다운로드
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                엑셀 파일 업로드
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                aria-label="엑셀 파일 선택"
                            />
                        </div>

                        {excelFileName ? (
                            <div className="p-3 bg-base-200/50 rounded-md border border-base-300">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-semibold">{excelFileName}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        type="button"
                                        onClick={handleRemoveFile}
                                        style={{ color: COLORS.error, fontSize: '12px' }}
                                    >
                                        제거
                                    </Button>
                                </div>
                                <div className="text-xs mb-2" style={{ color: COLORS.grey600 }}>
                                    총 <strong className="text-primary">{totalExcelCount}</strong>개 {isExBrand ? '바우처' : 'PIN 코드'}
                                </div>
                                {previewItems.length > 0 && (
                                    <div className="max-h-30 overflow-y-auto text-xs font-mono leading-relaxed" style={{ color: COLORS.grey600 }}>
                                        {previewItems.map((item, i) => (
                                            <div key={i}>{item}</div>
                                        ))}
                                        {totalExcelCount > 5 && (
                                            <div className="text-base-content/40">... 외 {totalExcelCount - 5}개</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-5 text-center bg-base-200/50 rounded-md text-xs" style={{ border: `1px dashed ${COLORS.grey300}`, color: COLORS.grey400 }}>
                                {isExBrand
                                    ? 'EX 상품권 엑셀 파일(CODE1~3, GIFT_PW 열)을 업로드하세요'
                                    : '템플릿을 다운받아 PIN 코드를 입력한 후 업로드하세요'}
                            </div>
                        )}
                    </div>
                )}

                {/* 직접 입력 모드 (기존 — EX에서는 비활성) */}
                {inputMode === 'text' && (
                    <div>
                        {isExBrand ? (
                            <div className="p-3 text-center text-xs" style={{ color: COLORS.grey400 }}>
                                EX 상품권은 엑셀 업로드만 지원합니다.
                            </div>
                        ) : (
                            <>
                                <label className="admin-form-label">PIN 코드 (줄바꿈으로 구분, 최소 8자 이상)</label>
                                <textarea
                                    className="form-control"
                                    value={pinCodes}
                                    onChange={e => setPinCodes(e.target.value)}
                                    rows={10}
                                    placeholder={'1111-2222-3333-4444\n5555-6666-7777-8888\n\n* 4자리 숫자 + 하이픈 형태 권장\n* 최소 8자 이상의 코드'}
                                    required={inputMode === 'text'}
                                    style={{ fontFamily: 'var(--font-family-mono, monospace)', fontSize: '13px' }}
                                />
                                {(() => {
                                    const lines = pinCodes.split('\n').filter(p => p.trim());
                                    const short = lines.filter(p => p.trim().replace(/[-\s]/g, '').length < 8);
                                    return short.length > 0 ? (
                                        <div style={{ color: 'var(--color-warning)', fontSize: '12px', marginTop: '4px' }}>
                                            ⚠ {short.length}개 PIN이 8자 미만입니다 (유효하지 않을 수 있음)
                                        </div>
                                    ) : null;
                                })()}
                            </>
                        )}
                    </div>
                )}

                {/* PIN 카운트 */}
                <div className="admin-sub-text -mt-1">
                    총 {activePinCount}개
                </div>

            </form>
        </Modal>
    );
};

export default VoucherBulkModal;
