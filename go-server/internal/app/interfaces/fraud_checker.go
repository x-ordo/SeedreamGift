package interfaces

// FraudCheckResult는 더치트 + 블랙리스트 스크리닝 조회 결과를 나타냅니다.
type FraudCheckResult struct {
	// ── 더치트 (TheCheat) ──
	PhoneCaution   string `json:"phoneCaution"`   // "Y" | "N" | "" (전화번호 없으면 빈값)
	AccountCaution string `json:"accountCaution"` // "Y" | "N" | "" (계좌 없으면 빈값)
	PhoneURL       string `json:"phoneUrl"`       // 전화번호 피해사례 열람 URL
	AccountURL     string `json:"accountUrl"`     // 계좌번호 피해사례 열람 URL

	// ── 블랙리스트 스크리닝 (Blacklist-DB) ──
	BlacklistStatus        string `json:"blacklistStatus"`        // "BLOCKED" | "CLEARED" | "" (미조회)
	BlacklistMatchCode     string `json:"blacklistMatchCode"`     // 5자리 비트맵: [이름][전화][계좌][예비][예비]
	BlacklistIncidentCount int    `json:"blacklistIncidentCount"` // 매칭된 사고 건수

	// ── 종합 판정 ──
	IsFlagged   bool     `json:"isFlagged"`   // 더치트 OR 블랙리스트 중 하나라도 위험이면 true
	FlagSources []string `json:"flagSources"` // 플래그 출처 목록 (예: ["THECHEAT_PHONE", "BLACKLIST"])
	Reason      string   `json:"reason"`      // 사람이 읽을 수 있는 종합 사유
}

// FraudChecker는 사기 조회 기능의 추상 인터페이스입니다.
type FraudChecker interface {
	Check(userID int, source string) (*FraudCheckResult, error)
	CheckRealtime(userID int) (*FraudCheckResult, error)
}
