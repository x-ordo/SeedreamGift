package blacklistdb

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── IsNameBasedBlock 테스트 ──

func TestIsNameBasedBlock(t *testing.T) {
	tests := []struct {
		name      string
		matchCode string
		want      bool
	}{
		{"이름+전화 → 차단", "11000", true},
		{"이름+계좌 → 차단", "10100", true},
		{"이름+전화+계좌 → 차단", "11100", true},
		{"전화만 → 통과", "01000", false},
		{"계좌만 → 통과", "00100", false},
		{"전화+계좌 (이름 없음) → 통과", "01100", false},
		{"매칭 없음 → 통과", "00000", false},
		{"이름만 → 통과", "10000", false},
		{"빈 문자열 → 통과", "", false},
		{"짧은 문자열 → 통과", "11", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, IsNameBasedBlock(tt.matchCode))
		})
	}
}

// ── Screen API 클라이언트 테스트 ──

func TestScreen_Blocked(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 헤더 검증
		assert.Equal(t, "test-key", r.Header.Get("X-API-KEY"))
		assert.Equal(t, "admin", r.Header.Get("X-Partner-Id"))
		assert.Equal(t, "application/json; charset=utf-8", r.Header.Get("Content-Type"))
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/partner/screening/check", r.URL.Path)

		// 요청 바디 검증
		var req screeningRequest
		json.NewDecoder(r.Body).Decode(&req)
		require.Len(t, req.Candidates, 1)
		assert.Equal(t, "홍길동", req.Candidates[0].CandidateName)
		assert.Equal(t, "01012345678", req.Candidates[0].Phone)
		assert.Equal(t, "1234567890", req.Candidates[0].Account)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(apiResponse{
			Success: true,
			Data: screeningData{
				RequestID:      1,
				CandidateCount: 1,
				BlockedCount:   1,
				ClearedCount:   0,
				Results: []ScreeningResult{
					{RefID: "user-1", Status: "BLOCKED", MatchCode: "11000", IncidentCount: 3},
				},
			},
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-1", "홍길동", "01012345678", "1234567890")
	require.NoError(t, err)
	assert.Equal(t, "BLOCKED", result.Status)
	assert.Equal(t, "11000", result.MatchCode)
	assert.Equal(t, 3, result.IncidentCount)
}

func TestScreen_Cleared(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(apiResponse{
			Success: true,
			Data: screeningData{
				RequestID:      2,
				CandidateCount: 1,
				BlockedCount:   0,
				ClearedCount:   1,
				Results: []ScreeningResult{
					{RefID: "user-2", Status: "CLEARED", MatchCode: "00000", IncidentCount: 0},
				},
			},
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-2", "김철수", "01099998888", "")
	require.NoError(t, err)
	assert.Equal(t, "CLEARED", result.Status)
	assert.Equal(t, "00000", result.MatchCode)
	assert.Equal(t, 0, result.IncidentCount)
}

func TestScreen_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusPaymentRequired)
		json.NewEncoder(w).Encode(apiResponse{
			Success: false,
			Error:   "잔액이 부족합니다.",
			Code:    "INSUFFICIENT_BALANCE",
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	_, err := client.Screen("user-3", "이영희", "01011112222", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "INSUFFICIENT_BALANCE")
}

func TestScreen_EmptyResults(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(apiResponse{
			Success: true,
			Data: screeningData{
				RequestID:      3,
				CandidateCount: 1,
				Results:        []ScreeningResult{},
			},
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	_, err := client.Screen("user-4", "박민수", "01033334444", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "결과가 없습니다")
}

func TestScreen_PhoneOnlyNoAccount(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req screeningRequest
		json.NewDecoder(r.Body).Decode(&req)
		// account가 비어있으면 JSON에 포함되지 않아야 함 (omitempty)
		assert.Equal(t, "", req.Candidates[0].Account)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(apiResponse{
			Success: true,
			Data: screeningData{
				Results: []ScreeningResult{
					{RefID: "user-5", Status: "CLEARED", MatchCode: "00000", IncidentCount: 0},
				},
			},
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL, "test-key", "admin")
	result, err := client.Screen("user-5", "정하나", "01055556666", "")
	require.NoError(t, err)
	assert.Equal(t, "CLEARED", result.Status)
}
