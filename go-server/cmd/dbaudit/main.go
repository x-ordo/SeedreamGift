// cmd/dbaudit/main.go — 프로덕션 DB 스키마 감사 도구
// 인덱스, FK, 컬럼 명명규칙, 중복 등을 분석합니다.
package main

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "sqlserver://dnflrhdwnghkdlxldsql:dnflrhdwnghkdlxld2024!%40@103.97.209.194:7335?database=WOWGIFT_DB&encrypt=true&trustServerCertificate=true"
	}

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

	fmt.Println("========================================")
	fmt.Println(" W Gift DB Schema Audit")
	fmt.Println("========================================")

	// 1. All tables
	fmt.Println("\n--- 1. TABLES ---")
	query(db, `SELECT TABLE_NAME, (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME = t.TABLE_NAME) as col_count
		FROM INFORMATION_SCHEMA.TABLES t WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`)

	// 2. All indexes with columns
	fmt.Println("\n--- 2. ALL INDEXES ---")
	query(db, `SELECT t.name AS [Table], i.name AS [Index], i.type_desc AS [Type],
		i.is_unique AS [Unique], i.has_filter AS [Filtered],
		STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS [Columns]
		FROM sys.indexes i
		JOIN sys.tables t ON i.object_id = t.object_id
		JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
		JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
		WHERE t.is_ms_shipped = 0 AND i.name IS NOT NULL
		GROUP BY t.name, i.name, i.type_desc, i.is_unique, i.has_filter
		ORDER BY t.name, i.name`)

	// 3. Duplicate/overlapping indexes (same table, first column identical)
	fmt.Println("\n--- 3. POTENTIALLY DUPLICATE INDEXES (same table + leading column) ---")
	query(db, `WITH idx AS (
		SELECT t.name AS tbl, i.name AS idx_name, i.index_id,
			FIRST_VALUE(c.name) OVER (PARTITION BY i.object_id, i.index_id ORDER BY ic.key_ordinal) AS lead_col,
			COUNT(*) OVER (PARTITION BY i.object_id, i.index_id) AS col_count
		FROM sys.indexes i
		JOIN sys.tables t ON i.object_id = t.object_id
		JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
		JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
		WHERE t.is_ms_shipped = 0 AND i.name IS NOT NULL AND ic.key_ordinal = 1
	)
	SELECT a.tbl AS [Table], a.idx_name AS [Index1], b.idx_name AS [Index2], a.lead_col AS [SharedLeadColumn]
	FROM idx a JOIN idx b ON a.tbl = b.tbl AND a.lead_col = b.lead_col AND a.idx_name < b.idx_name`)

	// 4. Foreign keys
	fmt.Println("\n--- 4. FOREIGN KEYS ---")
	query(db, `SELECT fk.name AS [FK_Name],
		tp.name AS [ParentTable], cp.name AS [ParentColumn],
		tr.name AS [ReferencedTable], cr.name AS [ReferencedColumn]
		FROM sys.foreign_keys fk
		JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
		JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
		JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
		JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
		JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
		ORDER BY tp.name, fk.name`)

	// 5. Column naming inconsistencies (mixed PascalCase vs camelCase vs snake_case)
	fmt.Println("\n--- 5. COLUMN NAMING PATTERNS ---")
	query(db, `SELECT TABLE_NAME, COLUMN_NAME,
		CASE
			WHEN COLUMN_NAME LIKE '%[_]%' THEN 'snake_case'
			WHEN COLUMN_NAME COLLATE Latin1_General_BIN LIKE '[a-z]%' THEN 'camelCase'
			WHEN COLUMN_NAME COLLATE Latin1_General_BIN LIKE '[A-Z]%' THEN 'PascalCase'
			ELSE 'other'
		END AS [Convention]
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME IN (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE')
		ORDER BY TABLE_NAME, COLUMN_NAME`)

	// 6. Columns without indexes that might need them (FK columns)
	fmt.Println("\n--- 6. FK COLUMNS WITHOUT DEDICATED INDEX ---")
	query(db, `SELECT t.name AS [Table], c.name AS [FKColumn]
		FROM sys.foreign_key_columns fkc
		JOIN sys.tables t ON fkc.parent_object_id = t.object_id
		JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
		WHERE NOT EXISTS (
			SELECT 1 FROM sys.index_columns ic
			JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
			WHERE ic.object_id = fkc.parent_object_id AND ic.column_id = fkc.parent_column_id
			AND ic.key_ordinal = 1 AND i.is_primary_key = 0
		)`)

	// 7. Nullable vs NOT NULL distribution per table
	fmt.Println("\n--- 7. NULLABLE DISTRIBUTION ---")
	query(db, `SELECT TABLE_NAME,
		SUM(CASE WHEN IS_NULLABLE='YES' THEN 1 ELSE 0 END) AS [Nullable],
		SUM(CASE WHEN IS_NULLABLE='NO' THEN 1 ELSE 0 END) AS [NotNull],
		COUNT(*) AS [Total]
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME IN (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE')
		GROUP BY TABLE_NAME ORDER BY TABLE_NAME`)

	fmt.Println("\n========================================")
	fmt.Println(" Audit Complete")
	fmt.Println("========================================")
}

func query(db *sql.DB, q string) {
	rows, err := db.Query(q)
	if err != nil {
		fmt.Printf("  ERROR: %v\n", err)
		return
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	fmt.Printf("  %-30s", cols[0])
	for _, c := range cols[1:] {
		fmt.Printf("| %-25s", c)
	}
	fmt.Println()
	fmt.Println("  " + strings.Repeat("-", 30+26*len(cols[1:])))

	vals := make([]sql.NullString, len(cols))
	ptrs := make([]any, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}

	count := 0
	for rows.Next() {
		rows.Scan(ptrs...)
		fmt.Printf("  %-30s", vals[0].String)
		for _, v := range vals[1:] {
			fmt.Printf("| %-25s", v.String)
		}
		fmt.Println()
		count++
	}
	if count == 0 {
		fmt.Println("  (none)")
	}
	fmt.Printf("  [%d rows]\n", count)
}
