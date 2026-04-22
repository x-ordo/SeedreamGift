// cmd/migrate/main.go — 프로덕션 DB 마이그레이션 실행 도구
// Usage: go run ./cmd/migrate
package main

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	dsn := "sqlserver://dnflrhdwnghkdlxldsql:dnflrhdwnghkdlxld2024!%40@localhost:7335?database=SEEDREAM_GIFT_DB&encrypt=true&trustServerCertificate=true"
	if envDSN := os.Getenv("DATABASE_URL"); envDSN != "" {
		dsn = envDSN
	}

	fmt.Println("=== W Gift DB Migration Tool ===")
	fmt.Printf("Target: %s\n\n", dsn)

	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		fmt.Printf("Connection error: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		fmt.Printf("Ping failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Connected successfully.")

	// Read migration SQL — first arg or default
	migrationFile := "migrations/000_full_schema_upgrade.sql"
	if len(os.Args) > 1 {
		migrationFile = os.Args[1]
	}
	fmt.Printf("Migration file: %s\n\n", migrationFile)
	sqlBytes, err := os.ReadFile(migrationFile)
	if err != nil {
		fmt.Printf("Failed to read migration file: %v\n", err)
		os.Exit(1)
	}

	// Split by GO statements (MSSQL batch separator)
	batches := splitByGO(string(sqlBytes))

	successCount := 0
	failCount := 0

	for i, batch := range batches {
		batch = strings.TrimSpace(batch)
		if batch == "" {
			continue
		}

		// Skip PRINT-only batches
		lines := strings.Split(batch, "\n")
		hasStatement := false
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed == "" || strings.HasPrefix(trimmed, "--") || strings.HasPrefix(trimmed, "PRINT") {
				continue
			}
			hasStatement = true
			break
		}
		if !hasStatement {
			continue
		}

		_, err := db.Exec(batch)
		if err != nil {
			fmt.Printf("[BATCH %d] ERROR: %v\n", i+1, err)
			fmt.Printf("  SQL: %.100s...\n", batch)
			failCount++
		} else {
			// Extract PRINT messages as description
			desc := extractDescription(batch)
			if desc != "" {
				fmt.Printf("[BATCH %d] OK: %s\n", i+1, desc)
			} else {
				fmt.Printf("[BATCH %d] OK\n", i+1)
			}
			successCount++
		}
	}

	fmt.Printf("\n=== Migration Complete: %d succeeded, %d failed ===\n", successCount, failCount)
	if failCount > 0 {
		os.Exit(1)
	}
}

// splitByGO splits SQL content by GO batch separators
func splitByGO(sql string) []string {
	var batches []string
	var current strings.Builder

	for _, line := range strings.Split(sql, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.EqualFold(trimmed, "GO") {
			batches = append(batches, current.String())
			current.Reset()
		} else {
			current.WriteString(line)
			current.WriteString("\n")
		}
	}
	if current.Len() > 0 {
		batches = append(batches, current.String())
	}
	return batches
}

// extractDescription extracts PRINT message from a batch for logging
func extractDescription(batch string) string {
	for _, line := range strings.Split(batch, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "PRINT '") {
			msg := strings.TrimPrefix(trimmed, "PRINT '")
			msg = strings.TrimSuffix(msg, "';")
			msg = strings.TrimSuffix(msg, "'")
			return msg
		}
	}
	return ""
}
