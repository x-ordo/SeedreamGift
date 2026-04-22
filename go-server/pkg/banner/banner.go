// Package banner는 서버 시작 시 콘솔에 로고와 서버 정보를 출력하는 기능을 제공합니다.
package banner

import (
	"fmt"
	"runtime"
	"strings"
)

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorPurple = "\033[35m"
	colorCyan   = "\033[36m"
	colorWhite  = "\033[37m"
	colorBold   = "\033[1m"
)

// Print는 콘솔에 ASCII 로고와 서버 버전, 빌드 정보, OS/Arch 정보를 출력합니다.
func Print(version, buildTime string) {
	logo := `
  _      __  ___  __  __   ___ ___ ___ _____ 
 | | /| / / / _ \/ / / /  / __|_ _| __|_   _|
 | |/ |/ / | (_) / /_/ / | (_ || || _|  | |  
 |__/|__/   \___/\____/   \___|___|_|   |_|  
                                             `

	fmt.Println(colorCyan + colorBold + logo + colorReset)
	fmt.Printf("%s%s WOW-GIFT API Server %s%s\n", colorBlue, colorBold, colorReset, colorCyan+VersionInfo(version, buildTime)+colorReset)
	fmt.Printf("%s%s OS/Arch:%s %s/%s\n", colorYellow, colorBold, colorReset, runtime.GOOS, runtime.GOARCH)
	fmt.Printf("%s%s Go Version:%s %s\n", colorYellow, colorBold, colorReset, runtime.Version())
	fmt.Println(strings.Repeat("-", 60))
}

// VersionInfo는 버전과 빌드 시간을 포맷팅하여 반환합니다.
func VersionInfo(version, buildTime string) string {
	if buildTime == "unknown" {
		return version
	}
	return fmt.Sprintf("%s (built at %s)", version, buildTime)
}

// PrintSummary는 서버 포트, 모드, 데이터베이스 종류 등 설정 요약을 출력합니다.
func PrintSummary(port int, mode string, dbType string) {
	fmt.Printf("%s%s [System Summary] %s\n", colorPurple, colorBold, colorReset)
	fmt.Printf("  • %sPort:%s %d\n", colorBold, colorReset, port)
	fmt.Printf("  • %sMode:%s %s\n", colorBold, colorReset, mode)
	fmt.Printf("  • %sDatabase:%s %s\n", colorBold, colorReset, dbType)
	fmt.Printf("  • %sHealth:%s %shttp://localhost:%d/health%s\n", colorBold, colorReset, colorBlue, port, colorReset)
	fmt.Printf("  • %sSwagger:%s %shttp://localhost:%d/docs/index.html%s\n", colorBold, colorReset, colorBlue, port, colorReset)
	fmt.Println(strings.Repeat("-", 60))
}
