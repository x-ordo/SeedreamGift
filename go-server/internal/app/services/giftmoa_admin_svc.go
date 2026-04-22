package services

import (
	"context"

	"seedream-gift-server/internal/infra/issuance"
	"seedream-gift-server/pkg/logger"

	"go.uber.org/zap"
)

// GiftMoaAdminService는 Gift MOA API에 대한 관리자용 서비스입니다.
type GiftMoaAdminService struct {
	client *issuance.GiftMoaClient
}

// NewGiftMoaAdminService는 새로운 GiftMoaAdminService를 생성합니다.
func NewGiftMoaAdminService(baseURL, apiKey string) *GiftMoaAdminService {
	return &GiftMoaAdminService{
		client: issuance.NewGiftMoaClient(baseURL, apiKey, nil, nil),
	}
}

// IssuanceList는 발행 이력을 조회합니다.
func (s *GiftMoaAdminService) IssuanceList(ctx context.Context, sDate, eDate string) ([]issuance.MoaIssuanceRecord, error) {
	logger.Log.Info("admin: MOA 발행이력 조회", zap.String("sDate", sDate), zap.String("eDate", eDate))
	return s.client.IssuanceList(ctx, sDate, eDate)
}

// IssuanceDetail은 발행 상세(개별 PIN)를 조회합니다.
func (s *GiftMoaAdminService) IssuanceDetail(ctx context.Context, publishCnt string) ([]issuance.MoaVoucher, error) {
	logger.Log.Info("admin: MOA 발행상세 조회", zap.String("publishCnt", publishCnt))
	return s.client.IssuanceDetail(ctx, publishCnt)
}

// GiftInfoByCode는 상품권 정보를 코드로 조회합니다.
func (s *GiftMoaAdminService) GiftInfoByCode(ctx context.Context, giftCode, giftPw string) (*issuance.MoaGiftInfo, error) {
	logger.Log.Info("admin: MOA 상품권 조회", zap.String("giftCode", giftCode))
	return s.client.GiftInfoByCode(ctx, giftCode, giftPw)
}

// GiftInfoByURLParam은 암호화 URL로 상품권 정보를 조회합니다.
func (s *GiftMoaAdminService) GiftInfoByURLParam(ctx context.Context, urlParam string) (*issuance.MoaGiftInfo, error) {
	logger.Log.Info("admin: MOA 상품권 ENC 조회")
	return s.client.GiftInfoByURLParam(ctx, urlParam)
}

// GiftRefund는 상품권을 환불 처리합니다.
func (s *GiftMoaAdminService) GiftRefund(ctx context.Context, giftCode, giftPw, refundName, refundTel string) error {
	logger.Log.Info("admin: MOA 상품권 환불", zap.String("giftCode", giftCode))
	return s.client.GiftRefund(ctx, giftCode, giftPw, refundName, refundTel)
}

// GiftUse는 상품권을 사용 처리합니다.
func (s *GiftMoaAdminService) GiftUse(ctx context.Context, giftCode, giftPw string) error {
	logger.Log.Info("admin: MOA 상품권 사용처리", zap.String("giftCode", giftCode))
	return s.client.GiftUse(ctx, giftCode, giftPw)
}
