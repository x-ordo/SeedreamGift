package issuance

import "encoding/json"

// ──────────────────────────────────────────────
// Gift MOA API 공통 응답 envelope
// ──────────────────────────────────────────────

type giftMoaBaseResponse struct {
	Result     string          `json:"result"`     // "SUC" | "FAL"
	StoreSeq   string          `json:"storeSeq"`
	ResultCode string          `json:"resultCode"` // "0000"=성공
	Results    json.RawMessage `json:"results"`
}

// ──────────────────────────────────────────────
// 3-1. 상품권 발행
// POST /gift-moa/issuance
// ──────────────────────────────────────────────

type moaIssuanceRequest struct {
	PublishTypeInt int `json:"publishTypeInt"` // 1=5만, 2=1만, 3=5천, 4=1천
	Count          int `json:"count"`          // 최대 100
}

type moaIssuanceResult struct {
	StoreID        string      `json:"STORE_ID"`
	InsertDate     string      `json:"INSERT_DATE"`
	PublishYear    json.Number `json:"PUBLISH_YEAR"`     // int 또는 string으로 올 수 있음
	PublishTypeInt int         `json:"PUBLISH_TYPE_INT"` // 권종 금액 (예: 10000)
	PublishTypeCnt int         `json:"PUBLISH_TYPE_CNT"` // 발행 수량
	PublishMoney   int         `json:"PUBLISH_MONEY"`    // 총 발행 금액
	PublishCnt     string      `json:"PUBLISH_CNT"`      // 발행 회차 번호
	StorePoint     int         `json:"STORE_POINT"`      // 잔여 포인트
}

// MoaIssuanceResponse는 발행 응답의 최종 파싱 결과입니다.
type MoaIssuanceResponse struct {
	PublishCnt string // 발행 회차 번호
	Result     moaIssuanceResult
}

// ──────────────────────────────────────────────
// 3-2. 발행 이력 조회
// POST /gift-moa/issuance/list
// ──────────────────────────────────────────────

type moaIssuanceListRequest struct {
	SDate string `json:"sDate"` // YYYYMMDD
	EDate string `json:"eDate"` // YYYYMMDD
}

// MoaIssuanceRecord는 발행 이력 단일 레코드입니다.
type MoaIssuanceRecord struct {
	StoreID        string      `json:"STORE_ID"`
	PublishCnt     string      `json:"PUBLISH_CNT"`
	PublishYear    json.Number `json:"PUBLISH_YEAR"`     // int 또는 string
	PublishTypeInt int         `json:"PUBLISH_TYPE_INT"`
	PublishTypeCnt int         `json:"PUBLISH_TYPE_CNT"`
	PublishMoney   int         `json:"PUBLISH_MONEY"`
	InsertDate     string      `json:"INSERT_DATE"`
}

// ──────────────────────────────────────────────
// 3-3. 발행 상세내역
// POST /gift-moa/issuance/detail
// ──────────────────────────────────────────────

type moaIssuanceDetailRequest struct {
	PublishCnt int `json:"publishCnt"` // API 문서 타입: int
}

// MoaVoucher는 개별 상품권 정보입니다.
type MoaVoucher struct {
	URLParam  string `json:"URL_PARAM"`
	Code1     string `json:"CODE1"`      // 시리즈 코드 (예: S24)
	Code2     string `json:"CODE2"`      // 4자리 숫자
	Code3     string `json:"CODE3"`      // 5자리 숫자
	StoreCode string `json:"STORE_CODE"`
	StoreID   string `json:"STORE_ID"`
	Amount    int    `json:"AMOUNT"`     // 금액 (int — 문서 예시: 10000)
	GiftPw    string `json:"GIFT_PW"`    // 16자리 PIN
	GiftSts   string `json:"GIFT_STS"`   // "10"=사용가능, "50"=사용완료
}

// GiftCode는 "CODE1-CODE2-CODE3" 포맷의 상품권 코드를 반환합니다.
func (v MoaVoucher) GiftCode() string {
	return v.Code1 + "-" + v.Code2 + "-" + v.Code3
}

// ──────────────────────────────────────────────
// 3-4/3-5. 상품권 정보 조회
// ──────────────────────────────────────────────

type moaGiftInfoRequest struct {
	GiftCode string `json:"giftCode"`
	GiftPw   string `json:"giftPw"`
}

type moaGiftInfoEncRequest struct {
	URLParam string `json:"urlParam"`
}

// MoaGiftInfo는 상품권 조회 결과입니다.
type MoaGiftInfo struct {
	URLParam        string `json:"URL_PARAM"`
	Code1           string `json:"CODE1"`
	Code2           string `json:"CODE2"`
	Code3           string `json:"CODE3"`
	StoreCode       string `json:"STORE_CODE"`
	StoreName       string `json:"STORE_NAME"`
	StoreID         string `json:"STORE_ID"`
	Amount          int    `json:"AMOUNT"`            // int — 문서 예시: 10000
	GiftPw          string `json:"GIFT_PW"`
	GiftSts         string `json:"GIFT_STS"`          // "10"=사용가능, "50"=사용완료
	InsertDate      string `json:"INSERT_DATE"`
	UpdateDatetime  string `json:"UPDATE_DATETIME"`
}

// ──────────────────────────────────────────────
// 3-6. 상품권 환불
// POST /gift-moa/gift/refund
// ──────────────────────────────────────────────

type moaGiftRefundRequest struct {
	GiftCode   string `json:"giftCode"`
	GiftPw     string `json:"giftPw"`
	RefundName string `json:"refundName"`
	RefundTel  string `json:"refundTel"`
}

// ──────────────────────────────────────────────
// 3-7. 상품권 사용
// POST /gift-moa/gift/use
// ──────────────────────────────────────────────

type moaGiftUseRequest struct {
	GiftCode string `json:"giftCode"`
	GiftPw   string `json:"giftPw"`
}
