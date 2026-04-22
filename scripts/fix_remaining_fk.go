package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/microsoft/go-mssqldb"
)

func main() {
	dsn := "server=103.97.209.131;port=7335;user id=dnflrhdwnghkdlxldsql;password=dnflrhdwnghkdlxld2024!@;database=SEEDREAM_GIFT_DB"
	db, err := sql.Open("sqlserver", dsn)
	if err != nil {
		fmt.Println("Connection error:", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Println("Ping failed:", err)
		os.Exit(1)
	}

	// CartItems → Users (NO ACTION instead of CASCADE, MSSQL blocks CASCADE due to multiple paths)
	var exists int
	db.QueryRow("SELECT COUNT(*) FROM sys.foreign_keys WHERE name = 'FK_CartItems_Users'").Scan(&exists)
	if exists == 0 {
		_, err := db.Exec("ALTER TABLE CartItems WITH NOCHECK ADD CONSTRAINT FK_CartItems_Users FOREIGN KEY (UserId) REFERENCES Users(Id)")
		if err != nil {
			fmt.Printf("[ERROR] FK_CartItems_Users: %v\n", err)
		} else {
			db.Exec("ALTER TABLE CartItems CHECK CONSTRAINT FK_CartItems_Users")
			fmt.Println("[OK] FK_CartItems_Users created (NO ACTION)")
		}
	} else {
		fmt.Println("[SKIP] FK_CartItems_Users already exists")
	}

	// RefreshTokens → Users (NO ACTION instead of CASCADE)
	db.QueryRow("SELECT COUNT(*) FROM sys.foreign_keys WHERE name = 'FK_RefreshTokens_Users'").Scan(&exists)
	if exists == 0 {
		_, err := db.Exec("ALTER TABLE RefreshTokens WITH NOCHECK ADD CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES Users(Id)")
		if err != nil {
			fmt.Printf("[ERROR] FK_RefreshTokens_Users: %v\n", err)
		} else {
			db.Exec("ALTER TABLE RefreshTokens CHECK CONSTRAINT FK_RefreshTokens_Users")
			fmt.Println("[OK] FK_RefreshTokens_Users created (NO ACTION)")
		}
	} else {
		fmt.Println("[SKIP] FK_RefreshTokens_Users already exists")
	}

	// Final count
	var fkCount int
	db.QueryRow("SELECT COUNT(*) FROM sys.foreign_keys WHERE name LIKE 'FK_%'").Scan(&fkCount)
	fmt.Printf("\nTotal FK constraints: %d\n", fkCount)
}
