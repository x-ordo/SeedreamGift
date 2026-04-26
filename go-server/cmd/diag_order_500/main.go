// cmd/diag_order_500/main.go — 일회성 진단 (READ-ONLY + ROLLBACK)
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

func main() {
	logger.Log, _ = zap.NewDevelopment()
	cfg, err := config.LoadConfig(".")
	if err != nil {
		fmt.Fprintf(os.Stderr, "설정 로드 실패: %v\n", err)
		os.Exit(1)
	}
	db, err := gorm.Open(sqlserver.Open(cfg.DBUrl), &gorm.Config{Logger: nil})
	if err != nil {
		fmt.Fprintf(os.Stderr, "DB 연결 실패: %v\n", err)
		os.Exit(1)
	}

	section("[N] OrderEvents 테이블 존재 여부")
	dump(db, `
		SELECT TABLE_NAME, TABLE_TYPE
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_NAME = 'OrderEvents'`)

	section("[O] OrderEvents 스키마 (있다면)")
	dump(db, `
		SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME='OrderEvents' ORDER BY ORDINAL_POSITION`)

	section("[P] 테이블 모두 — 'event' 또는 'audit' 키워드 검색")
	dump(db, `
		SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_NAME LIKE '%Event%' OR TABLE_NAME LIKE '%Audit%'
		ORDER BY TABLE_NAME`)

	section("[Q] GORM tx.Create(&domain.Order{...}) 직접 시도 — ROLLBACK")
	tryGormCreate(db)
}

func tryGormCreate(db *gorm.DB) {
	intentionalRollback := errors.New("INTENTIONAL_ROLLBACK")

	txErr := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		paymentDeadline := now.Add(30 * time.Minute)
		withdrawalDeadline := now.AddDate(0, 0, 7)

		paymentMethod := "VIRTUAL_ACCOUNT"
		idemKey := "diag-test-rollback-key"
		shippingMethod := "DELIVERY"
		recipientName := "박하성"
		recipientPhone := "010-3980-4154"
		recipientAddr := "서울 강남구 테헤란로63길 12 (삼성동, LG 선릉에클라트 B)"
		recipientZip := "06160"
		orderCode := "ORD-DIAG-GORM"

		order := &domain.Order{
			UserID:               881,
			TotalAmount:          domain.NewNumericDecimal(decimal.NewFromInt(10000)),
			Status:               "PENDING",
			Source:               "USER",
			PaymentMethod:        &paymentMethod,
			IdempotencyKey:       &idemKey,
			ShippingMethod:       &shippingMethod,
			RecipientName:        &recipientName,
			RecipientPhone:       &recipientPhone,
			RecipientAddr:        &recipientAddr,
			RecipientZip:         &recipientZip,
			OrderCode:            &orderCode,
			PaymentDeadlineAt:    &paymentDeadline,
			WithdrawalDeadlineAt: &withdrawalDeadline,
		}

		if err := tx.Create(order).Error; err != nil {
			fmt.Printf("❌ [Q1] tx.Create(&Order) 실패\n   error: %v\n", err)
			return intentionalRollback
		}
		fmt.Printf("✅ [Q1] tx.Create(&Order) 성공 (id=%d)\n", order.ID)

		// OrderItem 생성
		oi := &domain.OrderItem{
			OrderID:   order.ID,
			ProductID: 695,
			Quantity:  1,
			Price:     domain.NewNumericDecimal(decimal.NewFromInt(10000)),
		}
		if err := tx.Create(oi).Error; err != nil {
			fmt.Printf("❌ [Q2] tx.Create(&OrderItem) 실패\n   error: %v\n", err)
			return intentionalRollback
		}
		fmt.Printf("✅ [Q2] tx.Create(&OrderItem) 성공 (id=%d)\n", oi.ID)

		// 트랜잭션 안 OrderEvent 기록 시뮬레이션 — Record 함수와 동일 흐름
		payloadBytes, _ := json.Marshal(map[string]any{"totalAmount": "10000", "itemCount": 1})
		event := domain.OrderEvent{
			OrderID:   order.ID,
			EventType: domain.EventOrderCreated,
			Payload:   string(payloadBytes),
			ActorID:   intPtr(881),
			ActorType: "USER",
		}
		if err := tx.Create(&event).Error; err != nil {
			fmt.Printf("❌ [Q3] tx.Create(&OrderEvent) 실패 ⬅ 이게 root cause 가능성 매우 높음\n   error: %v\n", err)
			return intentionalRollback
		}
		fmt.Printf("✅ [Q3] tx.Create(&OrderEvent) 성공 (id=%d)\n", event.ID)

		// 마지막 reload 시뮬레이션
		var reloaded domain.Order
		if err := tx.Preload("OrderItems.Product").Preload("VoucherCodes").First(&reloaded, order.ID).Error; err != nil {
			fmt.Printf("❌ [Q4] Preload reload 실패 ⬅ root cause 가능성 있음\n   error: %v\n", err)
			return intentionalRollback
		}
		fmt.Printf("✅ [Q4] Preload reload 성공\n")

		fmt.Println()
		fmt.Println("⚠️  모든 단계 통과 — 코드 정적 분석 한계 도달. 다음 단계는 실 운영 환경에 진단 패치 배포 후 wrapped error 로그 확인.")
		return intentionalRollback
	})

	if errors.Is(txErr, intentionalRollback) {
		fmt.Println()
		fmt.Println("ℹ️  ROLLBACK 완료 — 데이터 무영향")
	} else if txErr != nil {
		fmt.Printf("\n⚠️  트랜잭션 종료 에러: %v\n", txErr)
	}
}

func intPtr(v int) *int { return &v }

func section(title string) {
	fmt.Println()
	fmt.Println(strings.Repeat("─", 80))
	fmt.Println(title)
	fmt.Println(strings.Repeat("─", 80))
}

func dump(db *gorm.DB, sql string, args ...any) {
	rows, err := db.Raw(sql, args...).Rows()
	if err != nil {
		fmt.Fprintf(os.Stderr, "쿼리 실패: %v\n", err)
		return
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		fmt.Fprintf(os.Stderr, "컬럼 정보 실패: %v\n", err)
		return
	}
	count := 0
	for rows.Next() {
		count++
		values := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			fmt.Fprintf(os.Stderr, "Scan 실패: %v\n", err)
			continue
		}
		row := make(map[string]any, len(cols))
		for i, c := range cols {
			if b, ok := values[i].([]byte); ok {
				row[c] = string(b)
			} else {
				row[c] = values[i]
			}
		}
		b, _ := json.Marshal(row)
		fmt.Printf("  %s\n", string(b))
	}
	if count == 0 {
		fmt.Println("  (no rows)")
	} else {
		fmt.Printf("  → %d rows\n", count)
	}
}
