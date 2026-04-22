// Package jwt는 JSON Web Token(JWT) 생성 및 검증을 위한 유틸리티를 제공합니다.
package jwt

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims는 JWT 토큰에 포함될 사용자 정의 페이로드 구조체입니다.
type Claims struct {
	UserID  int    `json:"userId"`
	Email   string `json:"email"`
	Role    string `json:"role"`
	Purpose string `json:"purpose,omitempty"` // 예: 중간 MFA 토큰을 위한 "mfa"
	jwt.RegisteredClaims
}

// GenerateToken은 지정된 사용자 정보와 비밀 키를 사용하여 새로운 JWT 액세스 토큰을 생성합니다.
func GenerateToken(userID int, email string, role string, secret string, expiry time.Duration) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GenerateMFAToken은 MFA 인증 단계를 위한 목적으로 단기 수명 토큰을 생성합니다.
// 하위 호환성 유지를 위해 기존 시그니처를 그대로 유지하며 내부적으로 GenerateMFATokenWithSecret을 호출합니다.
func GenerateMFAToken(userID int, secret string, expiry time.Duration) (string, error) {
	return GenerateMFATokenWithSecret(userID, secret, expiry)
}

// GenerateMFATokenWithSecret은 전용 MFA 비밀키를 사용하여 MFA 전용 단기 수명 토큰을 생성합니다.
// 일반 액세스 토큰과 별도의 시크릿을 사용함으로써 MFA 토큰이 인증 엔드포인트에서 오용되는 것을 방지합니다.
func GenerateMFATokenWithSecret(userID int, mfaSecret string, expiry time.Duration) (string, error) {
	claims := Claims{
		UserID:  userID,
		Purpose: "mfa",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(mfaSecret))
}

// ValidateToken은 JWT 토큰 문자열의 서명을 검증하고 클레임을 파싱하여 반환합니다.
func ValidateToken(tokenString string, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}
