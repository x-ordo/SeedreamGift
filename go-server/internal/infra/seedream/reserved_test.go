package seedream

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReservedIndex2For(t *testing.T) {
	pid := "A7"

	tests := []struct {
		name      string
		source    string
		partnerID *string
		want      string
		wantErr   bool
		errSub    string
	}{
		// USER (일반 고객)
		{"USER → partner-default", "USER", nil, "partner-default", false, ""},
		{"USER, partnerID 무시", "USER", &pid, "partner-default", false, ""},

		// PARTNER
		{"PARTNER + id=A7", "PARTNER", &pid, "partner-A7", false, ""},

		// ADMIN 대리
		{"ADMIN → partner-admin", "ADMIN", nil, "partner-admin", false, ""},
		{"ADMIN, partnerID 무시", "ADMIN", &pid, "partner-admin", false, ""},

		// 에러 케이스
		{"PARTNER 누락 partnerID", "PARTNER", nil, "", true, "partnerID"},
		{"PARTNER 빈 partnerID", "PARTNER", ptrStr(""), "", true, "partnerID"},
		{"PARTNER 12자 초과", "PARTNER", ptrStr(strings.Repeat("x", 13)), "", true, "20자"},
		{"알 수 없는 Source", "GUEST", nil, "", true, "Source"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ReservedIndex2For(tc.source, tc.partnerID)
			if tc.wantErr {
				if assert.Error(t, err) {
					assert.Contains(t, err.Error(), tc.errSub)
				}
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tc.want, got)
			assert.LessOrEqual(t, len(got), 20, "reservedIndex2 max 20자")
		})
	}
}

func ptrStr(s string) *string { return &s }
