package issuance

import (
	"context"
	"fmt"
	"strconv"

	"w-gift-server/internal/app/interfaces"
	"w-gift-server/pkg/logger"

	"go.uber.org/zap"
)

// GiftMoaIssuer는 Gift MOA 외부 API를 사용하여 상품권을 발급하는 VoucherIssuer 구현체입니다.
//
// 발급 플로우 (2단계):
//  1. /gift-moa/issuance 호출 → publishCnt(배치 번호) 획득
//  2. /gift-moa/issuance/detail 호출 → 개별 PIN 목록 획득
type GiftMoaIssuer struct {
	client *GiftMoaClient
}

// NewGiftMoaIssuer는 새로운 GiftMoaIssuer를 생성합니다.
func NewGiftMoaIssuer(baseURL, apiKey string) *GiftMoaIssuer {
	return &GiftMoaIssuer{
		client: NewGiftMoaClient(baseURL, apiKey, nil, nil),
	}
}

func (g *GiftMoaIssuer) ProviderCode() string { return "GIFTMOA" }

// Client는 내부 GiftMoaClient를 반환합니다. Reconciliation 등에서 사용합니다.
func (g *GiftMoaIssuer) Client() *GiftMoaClient { return g.client }

// Issue는 Gift MOA API를 통해 상품권을 발급합니다.
//
// req.ProductCode는 publishTypeInt 값이어야 합니다 ("1"=5만, "2"=1만, "3"=5천, "4"=1천).
// Product.ProviderProductCode 필드에 이 값을 저장합니다.
func (g *GiftMoaIssuer) Issue(ctx context.Context, req interfaces.IssueRequest) ([]interfaces.IssuedVoucher, error) {
	// 1. ProductCode → publishTypeInt 파싱
	publishTypeInt, err := strconv.Atoi(req.ProductCode)
	if err != nil || publishTypeInt < 1 || publishTypeInt > 4 {
		return nil, fmt.Errorf("잘못된 publishTypeInt: %q (1~4만 허용)", req.ProductCode)
	}

	if req.Quantity < 1 || req.Quantity > 100 {
		return nil, fmt.Errorf("수량 범위 초과: %d (1~100만 허용)", req.Quantity)
	}

	logger.Log.Info("MOA 상품권 발급 시작",
		zap.String("orderCode", req.OrderCode),
		zap.Int("publishTypeInt", publishTypeInt),
		zap.Int("quantity", req.Quantity),
	)

	// 2. Step 1: 상품권 발행 요청
	issuanceResp, err := g.client.Issuance(ctx, publishTypeInt, req.Quantity)
	if err != nil {
		return nil, fmt.Errorf("MOA 발급 요청 실패: %w", err)
	}

	publishCnt := issuanceResp.PublishCnt
	logger.Log.Info("MOA 발급 성공",
		zap.String("publishCnt", publishCnt),
		zap.Int("publishMoney", issuanceResp.Result.PublishMoney),
		zap.Int("storePoint", issuanceResp.Result.StorePoint),
	)

	// 3. Step 2: 개별 PIN 목록 조회
	moaVouchers, err := g.client.IssuanceDetail(ctx, publishCnt)
	if err != nil {
		// 발급은 성공했으나 상세 조회 실패 — 재시도하면 이중 발급 위험
		logger.Log.Error("MOA 발급 성공이나 상세조회 실패 — 수동 확인 필요",
			zap.String("publishCnt", publishCnt),
			zap.String("orderCode", req.OrderCode),
			zap.Error(err),
		)
		return nil, fmt.Errorf("%w: publishCnt=%s, orderCode=%s: %v",
			ErrMoaPartialIssuance, publishCnt, req.OrderCode, err)
	}

	// 4. 변환: MoaVoucher → interfaces.IssuedVoucher
	// Gift MOA는 giftCode(카드번호) + giftPw(인증코드) 2개가 필요:
	//   giftCode → GiftNumber (고객에게 보이는 카드번호)
	//   giftPw   → PinCode   (고객이 사용 시 입력하는 인증코드)
	vouchers := make([]interfaces.IssuedVoucher, 0, len(moaVouchers))
	for _, mv := range moaVouchers {
		vouchers = append(vouchers, interfaces.IssuedVoucher{
			PinCode:        mv.GiftPw,     // 인증코드 (비밀번호)
			GiftNumber:     mv.GiftCode(), // 카드번호 (CODE1-CODE2-CODE3)
			TransactionRef: publishCnt,
		})
	}

	logger.Log.Info("MOA 발급 완료",
		zap.String("publishCnt", publishCnt),
		zap.Int("voucherCount", len(vouchers)),
	)

	return vouchers, nil
}
