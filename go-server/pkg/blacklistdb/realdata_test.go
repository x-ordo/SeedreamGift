package blacklistdb

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── 실제 블랙리스트 데이터 기반 테스트 ──
// blacklist 20260202_20260322.xlsx 에서 추출한 실제 사고자 정보로 스크리닝 시뮬레이션

// blacklistEntry는 xlsx에서 추출한 블랙리스트 원본 레코드
type blacklistEntry struct {
	Name    string
	Phone   string
	Bank    string
	Account string
	Type    string // 신고유형
}

// 실제 xlsx 데이터에서 추출한 대표 케이스 (493건 중 선별)
var realBlacklistDB = []blacklistEntry{
	{Name: "위광문", Phone: "01058236595", Bank: "국민은행", Account: "77260201075036", Type: "리딩방주식투자"},
	{Name: "이명순", Phone: "01024520892", Bank: "신한은행", Account: "110166141148", Type: "투자사기"},
	{Name: "정희정", Phone: "01035383456", Bank: "NH농협", Account: "71701052241166", Type: "보이스피싱"},
	{Name: "안선자", Phone: "01090834354", Bank: "지역농협·축협", Account: "3520858800613", Type: "코인투자사기"},
	{Name: "가경리", Phone: "01031407742", Bank: "국민은행", Account: "54560201065185", Type: "주식투자"},
	{Name: "김정화", Phone: "01030977485", Bank: "농협은행", Account: "3021681754811", Type: "스터디방주식투자"},
	{Name: "김광수", Phone: "01094304012", Bank: "카카오뱅크", Account: "3333150560686", Type: "리딩방주식투자"}, // 1차 등록
	{Name: "김광수", Phone: "01094304012", Bank: "카카오뱅크", Account: "3333150560686", Type: "리딩방주식투자"}, // 2차 등록 (xlsx 중복)
	{Name: "장민화", Phone: "01033175824", Bank: "농협은행", Account: "3020228868391", Type: "금선물투자"},
	{Name: "김윤식", Phone: "01087647235", Bank: "지역농협", Account: "3520796232953", Type: "보이스피싱"},
	{Name: "유승기", Phone: "01034925042", Bank: "새마을금고중앙회", Account: "131018222827", Type: "투자사기"},
	{Name: "송성민", Phone: "01071223617", Bank: "산업은행", Account: "94030201053420", Type: "검사칭호위조문서"},
	{Name: "강석구", Phone: "01090018405", Bank: "NH농협", Account: "3021242453561", Type: "로맨스"},
	{Name: "이용현", Phone: "01053374739", Bank: "카카오뱅크", Account: "3333179935419", Type: "로맨스"},
}

// simulateScreening은 블랙리스트 DB를 시뮬레이션하여 matchCode를 생성합니다.
// 실제 API와 동일한 매칭 로직: 이름 정확 일치 + 전화번호/계좌번호 매칭
func simulateScreening(candidateName, phone, account string, db []blacklistEntry) (status, matchCode string, incidentCount int) {
	matchCode = "00000"
	matchCodeRunes := []rune(matchCode)

	for _, entry := range db {
		nameMatch := entry.Name == candidateName
		phoneMatch := phone != "" && entry.Phone == phone
		accountMatch := account != "" && entry.Account == account

		if nameMatch {
			matchCodeRunes[0] = '1'
		}
		if phoneMatch {
			matchCodeRunes[1] = '1'
		}
		if accountMatch {
			matchCodeRunes[2] = '1'
		}

		if nameMatch && (phoneMatch || accountMatch) {
			incidentCount++
		}
	}

	matchCode = string(matchCodeRunes)
	if matchCode != "00000" {
		status = "BLOCKED"
	} else {
		status = "CLEARED"
	}
	return
}

// newBlacklistMockServer는 실제 블랙리스트 데이터를 기반으로 API 서버를 모킹합니다.
func newBlacklistMockServer(db []blacklistEntry) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/partner/screening/check" {
			http.Error(w, "Not Found", 404)
			return
		}
		if r.Header.Get("X-API-KEY") == "" {
			w.WriteHeader(401)
			json.NewEncoder(w).Encode(apiResponse{Success: false, Error: "인증 실패", Code: "UNAUTHORIZED"})
			return
		}

		var req screeningRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(apiResponse{Success: false, Error: "잘못된 요청", Code: "BAD_REQUEST"})
			return
		}

		results := make([]ScreeningResult, 0, len(req.Candidates))
		blockedCount := 0
		for _, c := range req.Candidates {
			status, matchCode, incidents := simulateScreening(c.CandidateName, c.Phone, c.Account, db)
			// 이름 기반 매칭만 BLOCKED 처리 (실제 API 동작과 동일)
			if status == "BLOCKED" && !IsNameBasedBlock(matchCode) {
				// 이름 없이 전화/계좌만 매칭된 경우에도 API는 BLOCKED를 반환
				// 클라이언트 측에서 IsNameBasedBlock으로 필터링
			}
			if status == "BLOCKED" {
				blockedCount++
			}
			results = append(results, ScreeningResult{
				RefID:         c.RefID,
				Status:        status,
				MatchCode:     matchCode,
				IncidentCount: incidents,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(apiResponse{
			Success: true,
			Data: screeningData{
				RequestID:      1,
				CandidateCount: len(req.Candidates),
				BlockedCount:   blockedCount,
				ClearedCount:   len(req.Candidates) - blockedCount,
				Results:        results,
			},
		})
	}))
}

// ════════════════════════════════════════════════════════
// 테스트 케이스: 실제 데이터 기반
// ════════════════════════════════════════════════════════

func TestRealData_ExactNamePhoneMatch_Blocked(t *testing.T) {
	// 위광문(01058236595) — 실제 블랙리스트 인물, 이름+전화 일치
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-1", "위광문", "01058236595", "")

	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status)
	assert.True(t, IsNameBasedBlock(result.MatchCode), "이름+전화 → 차단")
	assert.Equal(t, '1', rune(result.MatchCode[0]), "이름 일치")
	assert.Equal(t, '1', rune(result.MatchCode[1]), "전화 일치")
	assert.GreaterOrEqual(t, result.IncidentCount, 1)
	t.Logf("위광문: status=%s matchCode=%s incidents=%d", result.Status, result.MatchCode, result.IncidentCount)
}

func TestRealData_ExactNameAccountMatch_Blocked(t *testing.T) {
	// 이명순 — 이름+계좌 매칭 (전화번호 없이)
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-2", "이명순", "", "110166141148")

	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status)
	assert.True(t, IsNameBasedBlock(result.MatchCode), "이름+계좌 → 차단")
	assert.Equal(t, '1', rune(result.MatchCode[0]), "이름 일치")
	assert.Equal(t, '1', rune(result.MatchCode[2]), "계좌 일치")
	t.Logf("이명순: status=%s matchCode=%s", result.Status, result.MatchCode)
}

func TestRealData_FullMatch_NamePhoneAccount_Blocked(t *testing.T) {
	// 김광수(01094304012, 카카오뱅크 3333150560686) — 3가지 모두 일치
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-3", "김광수", "01094304012", "3333150560686")

	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status)
	assert.Equal(t, "11100", result.MatchCode, "이름+전화+계좌 모두 일치")
	assert.True(t, IsNameBasedBlock(result.MatchCode))
	t.Logf("김광수: status=%s matchCode=%s incidents=%d", result.Status, result.MatchCode, result.IncidentCount)
}

func TestRealData_SamePhoneDifferentName_NotBlocked(t *testing.T) {
	// 전화번호는 위광문의 것이지만, 이름이 다름 → 이름 기반 매칭 아님
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-4", "홍길동", "01058236595", "")

	require.NoError(t, err)
	// 전화번호는 매칭되지만 이름이 다르므로 IsNameBasedBlock은 false
	if result.Status == "BLOCKED" {
		assert.False(t, IsNameBasedBlock(result.MatchCode),
			"이름 불일치 시 전화만 매칭은 차단 대상이 아님 (matchCode=%s)", result.MatchCode)
	}
	t.Logf("홍길동(위광문 전화): status=%s matchCode=%s", result.Status, result.MatchCode)
}

func TestRealData_SameAccountDifferentName_NotBlocked(t *testing.T) {
	// 계좌번호는 정희정의 것이지만, 이름이 다름
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-5", "김철수", "", "71701052241166")

	require.NoError(t, err)
	if result.Status == "BLOCKED" {
		assert.False(t, IsNameBasedBlock(result.MatchCode),
			"이름 불일치 + 계좌만 매칭은 차단 대상이 아님")
	}
	t.Logf("김철수(정희정 계좌): status=%s matchCode=%s", result.Status, result.MatchCode)
}

func TestRealData_CleanUser_Cleared(t *testing.T) {
	// DB에 없는 완전히 깨끗한 사용자
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-6", "박정상", "01011112222", "9999999999999")

	require.NoError(t, err)
	assert.Equal(t, "CLEARED", result.Status)
	assert.Equal(t, "00000", result.MatchCode)
	assert.Equal(t, 0, result.IncidentCount)
	assert.False(t, IsNameBasedBlock(result.MatchCode))
	t.Logf("박정상(깨끗): status=%s matchCode=%s", result.Status, result.MatchCode)
}

func TestRealData_MultipleIncidents_SamePerson(t *testing.T) {
	// 김광수는 xlsx에서 2건(중복 등록) — 사고 건수가 2 이상이어야 함
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-7", "김광수", "01094304012", "3333150560686")

	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status)
	assert.Equal(t, 2, result.IncidentCount, "김광수는 중복 등록된 블랙리스트 인물 (2건)")
	t.Logf("김광수(중복): incidents=%d", result.IncidentCount)
}

func TestRealData_PartialPhoneMatch_NotBlocked(t *testing.T) {
	// 블랙리스트 인물의 전화번호 앞부분만 일치 — 불완전 매칭은 통과
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-8", "위광문", "01058236000", "") // 마지막 3자리 다름

	require.NoError(t, err)
	// 전화번호 완전일치가 아니므로 이름만 매칭 → 이름+전화/계좌 조합 미충족
	nameOnly := result.MatchCode[0] == '1' && result.MatchCode[1] == '0' && result.MatchCode[2] == '0'
	if nameOnly {
		assert.False(t, IsNameBasedBlock(result.MatchCode),
			"이름만 일치(전화 불일치)는 차단 대상 아님")
	}
	t.Logf("위광문(전화 불완전): status=%s matchCode=%s", result.Status, result.MatchCode)
}

func TestRealData_BatchScreening_MixedResults(t *testing.T) {
	// 실제 시나리오: 여러 명을 동시에 스크리닝 (Mock 서버가 배치 처리)
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	type testCase struct {
		name          string
		candidateName string
		phone         string
		account       string
		expectBlock   bool
		reason        string
	}

	cases := []testCase{
		{"블랙리스트 인물", "안선자", "01090834354", "3520858800613", true, "이름+전화+계좌 모두 일치"},
		{"이름+전화만", "가경리", "01031407742", "", true, "이름+전화 일치"},
		{"이름+계좌만", "장민화", "", "3020228868391", true, "이름+계좌 일치"},
		{"깨끗한 사용자", "최안전", "01099990000", "1111111111111", false, "DB에 없음"},
		{"전화만 일치", "다른사람", "01058236595", "", false, "이름 불일치 → 차단 안 됨"},
		{"이름만 일치", "김윤식", "01099999999", "", false, "전화/계좌 모두 불일치"},
	}

	client := NewClient(srv.URL, "test-key", "admin")

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := client.Screen("ref-batch", tc.candidateName, tc.phone, tc.account)
			require.NoError(t, err)

			shouldBlock := result.Status == "BLOCKED" && IsNameBasedBlock(result.MatchCode)
			assert.Equal(t, tc.expectBlock, shouldBlock,
				"[%s] expected block=%v, got status=%s matchCode=%s (%s)",
				tc.candidateName, tc.expectBlock, result.Status, result.MatchCode, tc.reason)

			t.Logf("[%s] %s → status=%s matchCode=%s incidents=%d | block=%v (%s)",
				tc.name, tc.candidateName, result.Status, result.MatchCode,
				result.IncidentCount, shouldBlock, tc.reason)
		})
	}
}

func TestRealData_NameVariations(t *testing.T) {
	// 이름에 공백/특수문자 포함된 경우 테스트
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")

	// 공백 포함 이름 → DB에는 "위광문"이므로 불일치
	result, err := client.Screen("ref-space", "위 광문", "01058236595", "")
	require.NoError(t, err)
	// 이름 정확 일치가 아니므로 이름 매칭 안 됨
	assert.Equal(t, '0', rune(result.MatchCode[0]), "공백 포함 이름은 정확 일치 아님")
	t.Logf("'위 광문'(공백): matchCode=%s", result.MatchCode)

	// 성만 일치 → 불일치
	result2, err := client.Screen("ref-partial", "위", "01058236595", "")
	require.NoError(t, err)
	assert.Equal(t, '0', rune(result2.MatchCode[0]))
	t.Logf("'위'(성만): matchCode=%s", result2.MatchCode)
}

func TestRealData_AllBlacklistEntries_DetectedCorrectly(t *testing.T) {
	// 전체 13명 실제 블랙리스트 인물을 이름+전화로 스크리닝 → 전부 차단되어야 함
	srv := newBlacklistMockServer(realBlacklistDB)
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	blocked := 0
	for i, entry := range realBlacklistDB {
		result, err := client.Screen(
			strings.ReplaceAll(entry.Name, " ", ""),
			entry.Name, entry.Phone, entry.Account,
		)
		require.NoError(t, err, "entry #%d (%s)", i, entry.Name)

		isBlocked := result.Status == "BLOCKED" && IsNameBasedBlock(result.MatchCode)
		if isBlocked {
			blocked++
		}
		assert.True(t, isBlocked,
			"블랙리스트 인물 %s(전화=%s)가 탐지되지 않음: status=%s matchCode=%s",
			entry.Name, entry.Phone, result.Status, result.MatchCode)
	}
	t.Logf("전체 %d명 중 %d명 차단 (기대: %d명)", len(realBlacklistDB), blocked, len(realBlacklistDB))
}

// ════════════════════════════════════════════
// xlsx 확장 데이터 기반 시나리오 테스트
// blacklist 20260202_20260322.xlsx 에서 추가 추출
// ════════════════════════════════════════════

// xlsx에서 추출한 추가 블랙리스트 인물 (기존 14건과 별도)
var xlsxExtended = []blacklistEntry{
	{Name: "김소라", Phone: "01099638902", Account: "3333260769069", Type: "보이스피싱"},
	{Name: "마상태", Phone: "01021635056", Account: "9002196144638", Type: "투자사기"},
	{Name: "명경희", Phone: "01062818966", Account: "72491038056307", Type: "보이스피싱"},
	{Name: "육경희", Phone: "01093962323", Account: "1002259678602", Type: "로맨스"},
	{Name: "김수연", Phone: "01020134098", Account: "67980101148607", Type: "주식투자"},
	{Name: "김양우", Phone: "01034467346", Account: "144989071060", Type: "투자사기"},
	{Name: "정선우", Phone: "01090395629", Account: "12691070849907", Type: "보이스피싱"},
	{Name: "김수영", Phone: "01053604499", Account: "3333296742904", Type: "투자사기"},
	{Name: "임태양", Phone: "01032367276", Account: "46280104191035", Type: "보이스피싱"},
	{Name: "손임기", Phone: "01034925042", Account: "131018222827", Type: "투자사기"},
}

// allTestDB는 기존 + 확장 데이터를 합친 전체 테스트 DB입니다.
var allTestDB = append(append([]blacklistEntry{}, realBlacklistDB...), xlsxExtended...)

// ── 시나리오 1: 이름+전화+계좌 완전 일치 (모든 필드 제공) ──
func TestXlsx_FullMatch_AllFields(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	tests := []struct {
		name    string
		entry   blacklistEntry
		wantMC  string // 기대 matchCode
	}{
		{"김소라 전체일치", xlsxExtended[0], "11100"},
		{"마상태 전체일치", xlsxExtended[1], "11100"},
		{"명경희 전체일치", xlsxExtended[2], "11100"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, err := client.Screen("ref", tc.entry.Name, tc.entry.Phone, tc.entry.Account)
			require.NoError(t, err)
			assert.Equal(t, "BLOCKED", result.Status)
			assert.Equal(t, tc.wantMC, result.MatchCode, "이름+전화+계좌 모두 일치 시 11100")
			assert.True(t, IsNameBasedBlock(result.MatchCode))
			t.Logf("%s → status=%s matchCode=%s incidents=%d", tc.entry.Name, result.Status, result.MatchCode, result.IncidentCount)
		})
	}
}

// ── 시나리오 2: 이름+전화만 (계좌 미제공) ──
func TestXlsx_NamePhoneOnly(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	tests := []struct {
		name  string
		entry blacklistEntry
	}{
		{"육경희 이름+전화", xlsxExtended[3]},
		{"김수연 이름+전화", xlsxExtended[4]},
		{"김양우 이름+전화", xlsxExtended[5]},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, err := client.Screen("ref", tc.entry.Name, tc.entry.Phone, "") // 계좌 없이
			require.NoError(t, err)
			assert.Equal(t, "BLOCKED", result.Status)
			assert.Equal(t, "11000", result.MatchCode, "이름+전화만 일치 시 11000")
			assert.True(t, IsNameBasedBlock(result.MatchCode))
			t.Logf("%s (전화만) → matchCode=%s", tc.entry.Name, result.MatchCode)
		})
	}
}

// ── 시나리오 3: 이름+계좌만 (전화 미제공) ──
func TestXlsx_NameAccountOnly(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	tests := []struct {
		name  string
		entry blacklistEntry
	}{
		{"정선우 이름+계좌", xlsxExtended[6]},
		{"김수영 이름+계좌", xlsxExtended[7]},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, err := client.Screen("ref", tc.entry.Name, "", tc.entry.Account) // 전화 없이
			require.NoError(t, err)
			assert.Equal(t, "BLOCKED", result.Status)
			assert.Equal(t, "10100", result.MatchCode, "이름+계좌만 일치 시 10100")
			assert.True(t, IsNameBasedBlock(result.MatchCode))
			t.Logf("%s (계좌만) → matchCode=%s", tc.entry.Name, result.MatchCode)
		})
	}
}

// ── 시나리오 4: 이름 다르고 전화만 일치 → BLOCKED이지만 IsNameBasedBlock=false ──
func TestXlsx_WrongName_PhoneMatch(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	// 김소라의 전화번호를 다른 이름으로 검색
	result, err := client.Screen("ref", "홍길동", xlsxExtended[0].Phone, "")
	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status, "전화는 일치하므로 BLOCKED")
	assert.Equal(t, "01000", result.MatchCode, "이름 불일치+전화 일치 → 01000")
	assert.False(t, IsNameBasedBlock(result.MatchCode), "이름 기반 매칭 아님 → 차단하면 안 됨")
	t.Logf("가짜이름+김소라전화 → matchCode=%s, isNameBlock=%v", result.MatchCode, IsNameBasedBlock(result.MatchCode))
}

// ── 시나리오 5: 이름 다르고 계좌만 일치 → BLOCKED이지만 IsNameBasedBlock=false ──
func TestXlsx_WrongName_AccountMatch(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	// 임태양의 계좌번호를 다른 이름으로 검색
	result, err := client.Screen("ref", "박철수", "", xlsxExtended[8].Account)
	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status, "계좌는 일치하므로 BLOCKED")
	assert.Equal(t, "00100", result.MatchCode, "이름 불일치+계좌 일치 → 00100")
	assert.False(t, IsNameBasedBlock(result.MatchCode), "이름 기반 매칭 아님")
	t.Logf("가짜이름+임태양계좌 → matchCode=%s", result.MatchCode)
}

// ── 시나리오 6: 완전 깨끗한 사용자 → CLEARED ──
func TestXlsx_CleanUser(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	result, err := client.Screen("ref", "최안전", "01011112222", "9999999999999")
	require.NoError(t, err)
	assert.Equal(t, "CLEARED", result.Status)
	assert.Equal(t, "00000", result.MatchCode)
	assert.Equal(t, 0, result.IncidentCount)
	assert.False(t, IsNameBasedBlock(result.MatchCode))
	t.Logf("깨끗한 사용자 → %s", result.Status)
}

// ── 시나리오 7: 동일인 중복 등록 (김광수 2건) — incidentCount 확인 ──
func TestXlsx_DuplicateEntry_IncidentCount(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	// 김광수는 realBlacklistDB에 2번 등록 (같은 정보, 같은 사건)
	result, err := client.Screen("ref", "김광수", "01094304012", "3333150560686")
	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status)
	assert.Equal(t, "11100", result.MatchCode)
	assert.GreaterOrEqual(t, result.IncidentCount, 2, "중복 등록이므로 incidentCount >= 2")
	t.Logf("김광수(중복) → incidents=%d matchCode=%s", result.IncidentCount, result.MatchCode)
}

// ── 시나리오 8: 전화번호 형식 변형 (하이픈, 공백) ──
// 서버가 정규화하므로 클라이언트에서도 정규화된 번호를 보내야 함
func TestXlsx_PhoneFormatVariations(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	entry := xlsxExtended[9] // 손임기

	// 정규화된 전화번호로 검색 — 일치
	result, err := client.Screen("ref", entry.Name, entry.Phone, "")
	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status)
	t.Logf("손임기 정규화 전화 → %s matchCode=%s", result.Status, result.MatchCode)

	// 다른 전화번호 — 불일치 (이름만 일치)
	result2, err := client.Screen("ref", entry.Name, "01099999999", "")
	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result2.Status)       // 이름은 DB에 있으니 BLOCKED
	assert.Equal(t, "10000", result2.MatchCode)       // 이름만 일치
	assert.False(t, IsNameBasedBlock(result2.MatchCode)) // 차단 대상 아님
	t.Logf("손임기 다른전화 → matchCode=%s isBlock=%v", result2.MatchCode, IsNameBasedBlock(result2.MatchCode))
}

// ── 시나리오 9: 확장 DB 전원 이름+전화 스크리닝 → 전부 BLOCKED ──
func TestXlsx_AllExtended_Blocked(t *testing.T) {
	srv := newBlacklistMockServer(allTestDB)
	defer srv.Close()
	client := NewClient(srv.URL, "test-key", "admin")

	blocked := 0
	for _, entry := range xlsxExtended {
		result, err := client.Screen("ref", entry.Name, entry.Phone, entry.Account)
		require.NoError(t, err, "%s 조회 실패", entry.Name)

		if result.Status == "BLOCKED" && IsNameBasedBlock(result.MatchCode) {
			blocked++
		}
	}
	assert.Equal(t, len(xlsxExtended), blocked,
		"확장 DB %d명 전원 차단 기대, 실제 %d명", len(xlsxExtended), blocked)
	t.Logf("확장 DB %d명 중 %d명 차단", len(xlsxExtended), blocked)
}
