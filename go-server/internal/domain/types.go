// Package domain은 도메인 모델 전체에서 사용되는 커스텀 타입을 제공합니다.
package domain

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"

	"github.com/shopspring/decimal"
)

// NumericDecimal은 decimal.Decimal을 래핑하여 JSON 직렬화 시 따옴표 없는 숫자 형태로 변환되도록 합니다.
// API 클라이언트는 금액 데이터를 문자열이 아닌 숫자로 수신하기를 기대하기 때문입니다.
type NumericDecimal struct {
	decimal.Decimal
}

// NewNumericDecimal은 decimal.Decimal 값으로부터 NumericDecimal을 생성합니다.
func NewNumericDecimal(d decimal.Decimal) NumericDecimal {
	return NumericDecimal{Decimal: d}
}

// NewNumericDecimalFromInt는 int64 값으로부터 NumericDecimal을 생성합니다.
func NewNumericDecimalFromInt(i int64) NumericDecimal {
	return NumericDecimal{Decimal: decimal.NewFromInt(i)}
}

// MarshalJSON은 값을 JSON 숫자(예: 100 또는 3.14)로 직렬화합니다.
func (nd NumericDecimal) MarshalJSON() ([]byte, error) {
	return []byte(nd.Decimal.String()), nil
}

// UnmarshalJSON은 JSON 문자열("100")과 JSON 숫자(100) 형식을 모두 수용하여 역직렬화합니다.
func (nd *NumericDecimal) UnmarshalJSON(data []byte) error {
	// 먼저 문자열 형식(예: "100.00")으로 파싱을 시도합니다.
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		d, err := decimal.NewFromString(s)
		if err != nil {
			return fmt.Errorf("NumericDecimal: %q를 파싱할 수 없습니다: %w", s, err)
		}
		nd.Decimal = d
		return nil
	}
	// 문자열이 아니면 숫자 형식(예: 100 또는 3.14)으로 파싱을 시도합니다.
	var f float64
	if err := json.Unmarshal(data, &f); err != nil {
		return fmt.Errorf("NumericDecimal: %s를 NumericDecimal로 역직렬화할 수 없습니다", string(data))
	}
	nd.Decimal = decimal.NewFromFloat(f)
	return nil
}

// Scan은 데이터베이스의 decimal/numeric 컬럼 값을 이 타입으로 읽어오기 위한 sql.Scanner 인터페이스 구현입니다.
func (nd *NumericDecimal) Scan(value any) error {
	return nd.Decimal.Scan(value)
}

// Value는 이 타입을 데이터베이스의 decimal/numeric 컬럼에 쓰기 위한 driver.Valuer 인터페이스 구현입니다.
func (nd NumericDecimal) Value() (driver.Value, error) {
	return nd.Decimal.Value()
}
