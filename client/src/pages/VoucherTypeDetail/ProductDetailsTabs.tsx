import { useState, memo } from 'react';
import { CircleCheck, FileText, Gift, Info, ListChecks, Signpost, CircleAlert, Clock, RefreshCw, TriangleAlert } from 'lucide-react';
import { TableRow, FadeIn } from '../../design-system';
import { formatPrice } from '../../utils';
import { BRAND_DESCRIPTIONS, DEFAULT_BRAND_DESCRIPTION } from './brandDescriptions';
import type { Product } from '../../types';

type TabId = 'description' | 'guide';

export interface ProductDetailsTabsProps {
  voucherType: string;
  voucherTypeInfo: { displayName: string; description: string };
  products: Product[];
  maxDiscount: number;
}

/**
 * 상세 설명 탭 — 상품 설명 / 이용 안내 전환
 */
export const ProductDetailsTabs = memo(function ProductDetailsTabs({ voucherType, voucherTypeInfo, products, maxDiscount }: ProductDetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('description');

  const brandDesc = BRAND_DESCRIPTIONS[voucherType] || DEFAULT_BRAND_DESCRIPTION;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'description', label: '상품 설명', icon: <FileText size={16} aria-hidden="true" /> },
    { id: 'guide', label: '이용 안내', icon: <Info size={16} aria-hidden="true" /> },
  ];

  return (
    <FadeIn direction="up" distance={20} delay={0.2}>
      <section className="vt-tabs" aria-label="상품 상세 정보">
        <div className="vt-tabs-header" role="tablist" aria-label="상품 정보 탭">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              className={`vt-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="vt-tabs-content">
          {/* 상품 설명 + 상품 정보 */}
          {activeTab === 'description' && (
            <div className="vt-tab-panel" role="tabpanel" id="tabpanel-description" aria-labelledby="tab-description">
              <div className="vt-desc-section">
                <p className="vt-desc-summary">{brandDesc.summary}</p>

                <div className="vt-desc-block">
                  <h3 className="vt-desc-block-title">
                    <CircleCheck size={18} aria-hidden="true" />
                    주요 특징
                  </h3>
                  <ul className="vt-desc-list">
                    {brandDesc.features.map((feat, i) => (
                      <li key={i}>{feat}</li>
                    ))}
                  </ul>
                </div>

                <div className="vt-desc-block">
                  <h3 className="vt-desc-block-title">
                    <Gift size={18} aria-hidden="true" />
                    추천 용도
                  </h3>
                  <div className="vt-desc-tags">
                    {brandDesc.useCases.map((uc, i) => (
                      <span key={i} className="vt-desc-tag">{uc}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="vt-section-divider" />

              <div className="vt-sub-section">
                <h3 className="vt-sub-section-title">
                  <ListChecks size={18} aria-hidden="true" />
                  상품 정보
                </h3>
                <div className="vt-info-list">
                  <TableRow align="left" leftRatio={28} left="상품명" right={`${voucherTypeInfo.displayName} 모바일 상품권`} withBorder />
                  <TableRow align="left" leftRatio={28} left="브랜드" right={voucherTypeInfo.displayName} withBorder />
                  <TableRow align="left" leftRatio={28} left="상품 유형" right="모바일 상품권 (PIN)" withBorder />
                  <TableRow align="left" leftRatio={28} left="판매 권종" right={`${products.length}종 (${products.map(p => formatPrice(Number(p.price))).join(', ')})`} withBorder />
                  {maxDiscount > 0 && (
                    <TableRow align="left" leftRatio={28} left="최대 할인율" right={`${Math.round(maxDiscount)}%`} withBorder />
                  )}
                  <TableRow align="left" leftRatio={28} left="유효기간" right="발행일로부터 5년" withBorder />
                  <TableRow align="left" leftRatio={28} left="발행처" right={voucherTypeInfo.displayName} withBorder />
                  <TableRow align="left" leftRatio={28} left="사용처" right={voucherTypeInfo.description || `전국 ${voucherTypeInfo.displayName} 매장`} />
                </div>
              </div>
            </div>
          )}

          {/* 이용 안내 + 유의사항 */}
          {activeTab === 'guide' && (
            <div className="vt-tab-panel" role="tabpanel" id="tabpanel-guide" aria-labelledby="tab-guide">
              <div className="vt-guide-section">
                <h3 className="vt-sub-section-title">
                  <Signpost size={18} aria-hidden="true" />
                  이용 방법
                </h3>
                <div className="vt-guide-steps">
                  <div className="vt-guide-step">
                    <div className="vt-guide-step-num">1</div>
                    <div>
                      <strong>금액 선택 및 결제</strong>
                      <p>원하는 금액권을 선택하고 결제를 완료합니다.</p>
                    </div>
                  </div>
                  <div className="vt-guide-step">
                    <div className="vt-guide-step-num">2</div>
                    <div>
                      <strong>PIN 번호 수령</strong>
                      <p>결제 완료 후 마이페이지 주문내역에서 PIN 번호를 확인합니다.</p>
                    </div>
                  </div>
                  <div className="vt-guide-step">
                    <div className="vt-guide-step-num">3</div>
                    <div>
                      <strong>매장 방문 교환</strong>
                      <p>전국 {voucherTypeInfo.displayName} 매장 안내데스크에서 지류 상품권으로 교환합니다.</p>
                    </div>
                  </div>
                  <div className="vt-guide-step">
                    <div className="vt-guide-step-num">4</div>
                    <div>
                      <strong>상품권 사용</strong>
                      <p>교환한 상품권으로 매장 내 상품을 구매합니다.</p>
                    </div>
                  </div>
                </div>

                <div className="vt-info-list" style={{ marginTop: 'var(--space-4)' }}>
                  <TableRow align="left" leftRatio={28} left="교환처" right={`전국 ${voucherTypeInfo.displayName} 백화점 및 관련 매장`} withBorder />
                  <TableRow align="left" leftRatio={28} left="주문한도" right="1회 최대 200만원" withBorder />
                  <TableRow align="left" leftRatio={28} left="고객센터" right="평일 09:30~18:00" />
                </div>
              </div>

              <div className="vt-section-divider" />

              <div className="vt-sub-section">
                <h3 className="vt-sub-section-title">
                  <CircleAlert size={18} aria-hidden="true" />
                  유의사항
                </h3>
                <div className="vt-note-list">
                  <div className="vt-note-item">
                    <Clock size={18} aria-hidden="true" />
                    <div>
                      <strong>유효기간</strong>
                      <p>발행일로부터 5년이며, 발행일이 표기되지 않은 경우 제한이 없습니다.</p>
                    </div>
                  </div>
                  <div className="vt-note-item">
                    <RefreshCw size={18} aria-hidden="true" />
                    <div>
                      <strong>교환 후 취소 불가</strong>
                      <p>지류 상품권으로 교환한 후에는 취소 및 환불이 불가합니다.</p>
                    </div>
                  </div>
                  <div className="vt-note-item warning">
                    <TriangleAlert size={18} aria-hidden="true" />
                    <div>
                      <strong>단순 변심 환불 불가</strong>
                      <p>유가증권 특성상 상품 하자가 아닌 단순 변심에 의한 반품은 불가합니다.</p>
                    </div>
                  </div>
                  {voucherType === '신세계' && (
                    <div className="vt-note-item info">
                      <FileText size={18} aria-hidden="true" />
                      <div>
                        <strong>스크래치 안내</strong>
                        <p>신세계 5만원권, 10만원권에만 스크래치가 있으며, 온/오프라인 모두 사용 가능합니다.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </FadeIn>
  );
});
