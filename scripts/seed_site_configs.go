package main

import (
	"database/sql"
	"fmt"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	dsn := "server=103.97.209.131;port=7335;user id=dnflrhdwnghkdlxldsql;password=dnflrhdwnghkdlxld2024!@;database=SEEDREAM_GIFT_DB"
	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		fmt.Println("Connection error:", err)
		return
	}
	defer db.Close()

	configs := []struct{ key, value, typ, desc string }{
		{"PAYMENT_BANK_NAME", "국민은행", "string", "입금 은행명"},
		{"PAYMENT_BANK_ACCOUNT", "123-456-789012", "string", "입금 계좌번호"},
		{"PAYMENT_BANK_HOLDER", "주식회사 더블유에이아이씨", "string", "예금주"},
	}

	for _, c := range configs {
		var count int
		db.QueryRow("SELECT COUNT(*) FROM SiteConfigs WHERE [Key] = @p1", c.key).Scan(&count)
		if count > 0 {
			fmt.Printf("[SKIP] %s already exists\n", c.key)
			continue
		}
		_, err := db.Exec(
			"INSERT INTO SiteConfigs ([Key], Value, Type, Description) VALUES (@p1, @p2, @p3, @p4)",
			c.key, c.value, c.typ, c.desc,
		)
		if err != nil {
			fmt.Printf("[ERROR] %s: %v\n", c.key, err)
		} else {
			fmt.Printf("[OK] %s = %s\n", c.key, c.value)
		}
	}
}
