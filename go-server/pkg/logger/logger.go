// Package logger는 Uber의 Zap을 기반으로 한 고성능 구조화 로깅 시스템을 제공합니다.
package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

// Log는 애플리케이션 전역에서 사용하는 공유 로거 인스턴스입니다.
// InitLogger 호출 전에도 nil 역참조 패닉이 발생하지 않도록 기본값으로 nop 로거를 사용합니다.
var Log *zap.Logger = zap.NewNop()

// InitLogger는 로거를 초기화하고 콘솔 및 파일 출력 설정을 구성합니다.
// 로그 경로, 레벨, 파일 크기 제한, 백업 수, 보관 기간 등을 설정합니다.
func InitLogger(logPath string, level string, maxSizeMB int, maxBackups int, maxAgeDays int) {
	var l = new(zapcore.Level)
	err := l.UnmarshalText([]byte(level))
	if err != nil {
		*l = zapcore.InfoLevel
	}

	// 1. Console Core (Human readable)
	consoleEncoder := getConsoleEncoder()
	consoleCore := zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), l)

	// 2. File Core (Structured JSON)
	fileEncoder := getJSONEncoder()
	fileWriter := getFileWriter(logPath, maxSizeMB, maxBackups, maxAgeDays)
	fileCore := zapcore.NewCore(fileEncoder, fileWriter, l)

	// Combine cores
	core := zapcore.NewTee(consoleCore, fileCore)

	Log = zap.New(core,
		zap.AddCaller(),
		zap.AddStacktrace(zapcore.ErrorLevel),
	)
}

// getJSONEncoder는 프로덕션 환경을 위한 JSON 형식의 엔코더를 반환합니다.
func getJSONEncoder() zapcore.Encoder {
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder
	return zapcore.NewJSONEncoder(encoderConfig)
}

// getConsoleEncoder는 개발 환경을 위한 가독성이 좋은 콘솔 형식의 엔코더를 반환합니다.
func getConsoleEncoder() zapcore.Encoder {
	encoderConfig := zap.NewDevelopmentEncoderConfig()
	encoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout("2006-01-02 15:04:05")
	encoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	encoderConfig.EncodeCaller = zapcore.ShortCallerEncoder
	return zapcore.NewConsoleEncoder(encoderConfig)
}

// getFileWriter는 lumberjack을 사용하여 로그 파일 로테이션 기능이 포함된 WriteSyncer를 반환합니다.
func getFileWriter(logPath string, maxSizeMB int, maxBackups int, maxAgeDays int) zapcore.WriteSyncer {
	lumberJackLogger := &lumberjack.Logger{
		Filename:   logPath,
		MaxSize:    maxSizeMB,
		MaxBackups: maxBackups,
		MaxAge:     maxAgeDays,
		Compress:   true,
	}
	return zapcore.AddSync(lumberJackLogger)
}
