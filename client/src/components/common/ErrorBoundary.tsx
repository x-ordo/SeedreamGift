/**
 * @file ErrorBoundary.tsx
 * @description React 에러 경계 컴포넌트 - 하위 트리의 렌더링 에러를 잡아 fallback UI를 표시
 * @module components/common
 *
 * 사용처:
 * - App.tsx: 전체 애플리케이션을 감싸 예기치 않은 에러 시 크래시 대신 안내 화면 표시
 *
 * 에러 복구 전략:
 * - getDerivedStateFromError: 에러 발생 시 hasError 상태를 true로 전환하여 fallback 렌더링
 * - componentDidCatch: 에러 로깅 (콘솔 출력, 추후 Sentry 등 외부 서비스 연동 가능)
 * - 복구 방법: "새로고침" 버튼으로 window.location.reload() 호출 (전체 상태 초기화)
 * - DEV 모드에서만 에러 상세 정보를 화면에 표시하여 디버깅 편의 제공
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from '../../design-system';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 추후 Sentry 등 에러 모니터링 서비스로 전송할 수 있는 지점
        console.error('Uncaught error:', error, errorInfo);
    }

    // 가장 단순하고 확실한 복구: 전체 페이지 리로드로 상태를 초기화한다
    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen supports-[min-height:100dvh]:min-h-dvh flex items-center justify-center">
                    <Result
                        icon="error"
                        title="오류가 발생했습니다"
                        description={
                            <>
                                예기치 않은 오류가 발생했습니다.<br />
                                잠시 후 다시 시도해주세요.
                                {import.meta.env.DEV && this.state.error && (
                                    <div className="mt-4 text-xs text-base-content/50 text-left bg-base-200 p-2.5 rounded-lg">
                                        {this.state.error.toString()}
                                    </div>
                                )}
                            </>
                        }
                        button={<Button onClick={this.handleReload}>새로고침</Button>}
                    />
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
