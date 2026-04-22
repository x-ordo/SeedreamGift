package services

import (
	"context"
	"fmt"

	"go.uber.org/zap"
	"seedream-gift-server/pkg/logger"
)

// SagaStep은 Saga의 개별 단계입니다.
type SagaStep struct {
	Name       string
	Execute    func(ctx context.Context) error
	Compensate func(ctx context.Context) error // nil이면 보상 불필요
}

// CompensationError는 보상 트랜잭션 실패 정보를 담습니다.
type CompensationError struct {
	StepName string
	Err      error
}

// SagaError는 Saga 실행 중 발생한 에러와 보상 실패를 모두 포함합니다.
type SagaError struct {
	SagaName         string
	FailedStep       string
	StepError        error
	CompensationErrs []CompensationError
}

func (e *SagaError) Error() string {
	msg := fmt.Sprintf("saga(%s) failed at step '%s': %v", e.SagaName, e.FailedStep, e.StepError)
	if len(e.CompensationErrs) > 0 {
		msg += fmt.Sprintf(" [%d compensation(s) also failed]", len(e.CompensationErrs))
	}
	return msg
}

func (e *SagaError) Unwrap() error {
	return e.StepError
}

// SagaOrchestrator는 여러 SagaStep을 순차 실행하고,
// 실패 시 이미 실행된 단계들의 보상 트랜잭션을 역순으로 실행합니다.
type SagaOrchestrator struct {
	name  string
	steps []SagaStep
}

// NewSaga는 새로운 SagaOrchestrator를 생성합니다.
func NewSaga(name string) *SagaOrchestrator {
	return &SagaOrchestrator{name: name}
}

// AddStep은 Saga에 실행 단계를 추가합니다. 메서드 체이닝을 지원합니다.
func (s *SagaOrchestrator) AddStep(step SagaStep) *SagaOrchestrator {
	s.steps = append(s.steps, step)
	return s
}

// Execute는 모든 단계를 순차 실행합니다.
// 중간에 실패하면 이미 완료된 단계의 Compensate를 역순으로 실행합니다.
// 컨텍스트가 취소되면 즉시 중단합니다.
func (s *SagaOrchestrator) Execute(ctx context.Context) error {
	var completedSteps []SagaStep

	for _, step := range s.steps {
		// 각 단계 실행 전 컨텍스트 취소 여부 확인
		if ctx.Err() != nil {
			return fmt.Errorf("saga(%s) cancelled: %w", s.name, ctx.Err())
		}

		logger.Log.Debug("Saga 단계 실행",
			zap.String("saga", s.name),
			zap.String("step", step.Name),
		)

		if err := step.Execute(ctx); err != nil {
			logger.Log.Error("Saga 단계 실패 — 보상 트랜잭션 시작",
				zap.String("saga", s.name),
				zap.String("failedStep", step.Name),
				zap.Error(err),
			)

			// 역순으로 보상 실행하며 보상 실패도 수집
			var compensationErrs []CompensationError
			for i := len(completedSteps) - 1; i >= 0; i-- {
				comp := completedSteps[i]
				if comp.Compensate != nil {
					if compErr := comp.Compensate(ctx); compErr != nil {
						logger.Log.Error("Saga 보상 실패",
							zap.String("saga", s.name),
							zap.String("step", comp.Name),
							zap.Error(compErr),
						)
						compensationErrs = append(compensationErrs, CompensationError{
							StepName: comp.Name,
							Err:      compErr,
						})
					}
				}
			}

			return &SagaError{
				SagaName:         s.name,
				FailedStep:       step.Name,
				StepError:        err,
				CompensationErrs: compensationErrs,
			}
		}

		completedSteps = append(completedSteps, step)
	}

	logger.Log.Debug("Saga 완료", zap.String("saga", s.name), zap.Int("steps", len(s.steps)))
	return nil
}
