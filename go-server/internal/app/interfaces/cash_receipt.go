package interfaces

// CashReceiptIssueRequest는 현금영수증 즉시 발급 요청 데이터입니다.
type CashReceiptIssueRequest struct {
	MgtKey       string // 문서 관리번호 (사업자번호당 고유)
	TradeType    string // "승인거래"
	IdentityNum  string // 식별번호 (휴대폰/사업자번호/카드번호)
	ItemName     string // 품목명
	SupplyAmount int64  // 공급가액
	TaxAmount    int64  // 부가세
	TotalAmount  int64  // 총 금액
	TradeUsage   string // "소득공제용" 또는 "지출증빙용"
	TradeOpt     string // "01"(휴대폰), "02"(사업자번호), "03"(카드번호)
}

type CashReceiptIssueResponse struct {
	Success    bool
	ConfirmNum string
	TradeDate  string
}

type CashReceiptCancelRequest struct {
	MgtKey        string
	OrgConfirmNum string
	OrgTradeDate  string
	SupplyAmount  int64
	TaxAmount     int64
	TotalAmount   int64
	CancelReason  string
}

type CashReceiptCancelResponse struct {
	Success    bool
	ConfirmNum string
	TradeDate  string
}

type CashReceiptInfo struct {
	MgtKey     string
	ConfirmNum string
	TradeDate  string
	StateCode  int
	StateDT    string
}

// ICashReceiptProvider는 현금영수증 외부 발급 서비스의 추상화입니다.
type ICashReceiptProvider interface {
	Issue(req CashReceiptIssueRequest) (*CashReceiptIssueResponse, error)
	Cancel(req CashReceiptCancelRequest) (*CashReceiptCancelResponse, error)
	GetInfo(mgtKey string) (*CashReceiptInfo, error)
	UpdateTransaction(mgtKey string, identityNum string, tradeUsage string) error
}
