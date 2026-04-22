package domain

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// ── ValidateEmail ──

func TestValidateEmail(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		wantErr bool
		errMsg  string
	}{
		// 실패 케이스
		{"빈 문자열", "", true, "이메일을 입력해주세요"},
		{"@만 있음", "@", true, "유효하지 않은 이메일 형식입니다"},
		{"도메인 없음", "user@", true, "유효하지 않은 이메일 형식입니다"},
		{"로컬파트 없음", "@example.com", true, "유효하지 않은 이메일 형식입니다"},
		{"TLD 없음", "user@example", true, "유효하지 않은 이메일 형식입니다"},
		{"공백 포함", "user @example.com", true, "유효하지 않은 이메일 형식입니다"},

		// 성공 케이스
		{"기본 이메일", "user@example.com", false, ""},
		{"서브도메인", "user@mail.example.com", false, ""},
		{"점 포함 로컬파트", "first.last@example.com", false, ""},
		{"플러스 태그", "user+tag@example.com", false, ""},
		{"하이픈 도메인", "user@my-domain.co.kr", false, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateEmail(tc.email)
			if tc.wantErr {
				if assert.Error(t, err) {
					assert.Contains(t, err.Error(), tc.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// ── ValidatePassword ──

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name    string
		pwd     string
		wantErr bool
		errMsg  string
	}{
		// 길이 경계값
		{"7자 (최소 미달)", "Aa1!xyz", true, "최소 8자"},
		{"8자 (최소 충족)", "Aa1!xyzw", false, ""},
		{"72자 (최대 충족)", strings.Repeat("a", 69) + "A1!", false, ""},
		{"73자 (최대 초과)", strings.Repeat("a", 70) + "A1!", true, "최대 72자"},

		// 복잡도 규칙
		{"영문자 없음", "12345678!", true, "영문자가 포함"},
		{"숫자 없음", "Abcdefg!", true, "숫자가 포함"},
		{"특수문자 없음", "Abcdefg1", true, "특수문자가 포함"},

		// 유효한 비밀번호
		{"기본 유효", "Password1!", false, ""},
		{"한글 특수문자 포함", "Aa1!가나다라", false, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidatePassword(tc.pwd)
			if tc.wantErr {
				if assert.Error(t, err) {
					assert.Contains(t, err.Error(), tc.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// ── ValidatePhone ──

func TestValidatePhone(t *testing.T) {
	tests := []struct {
		name    string
		phone   string
		wantErr bool
	}{
		// 빈 값은 선택 사항이므로 통과
		{"빈 문자열", "", false},

		// 유효한 형식
		{"010 하이픈 있음", "010-1234-5678", false},
		{"010 하이픈 없음", "01012345678", false},
		{"011 번호", "01112345678", false},
		{"016 번호", "01612345678", false},

		// 잘못된 형식
		{"짧은 번호", "010-123-456", true},
		{"잘못된 시작번호", "02012345678", true},
		{"문자 포함", "010-abcd-5678", true},
		{"너무 긴 번호", "010123456789", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidatePhone(tc.phone)
			if tc.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
