/**
 * @file NotFoundPage.tsx
 * @description 404 에러 페이지 - 존재하지 않는 경로 접근 시 표시
 */
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Result, Button } from '../design-system';

const NotFoundPage: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] supports-[min-height:100dvh]:min-h-[calc(100dvh-60px)] px-4">
            <Result
                icon="warning"
                title="페이지를 찾을 수 없습니다"
                description="요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다."
                button={
                    <Button variant="primary" size="lg" onClick={() => navigate('/')}>
                        홈으로 이동
                    </Button>
                }
            />
            <div className="flex flex-wrap justify-center gap-4 mt-8 text-sm">
                <Link to="/products" className="text-primary hover:underline font-medium">상품권 구매</Link>
                <Link to="/trade-in" className="text-primary hover:underline font-medium">상품권 판매</Link>
                <Link to="/rates" className="text-primary hover:underline font-medium">시세 조회</Link>
                <Link to="/support" className="text-primary hover:underline font-medium">고객센터</Link>
            </div>
        </div>
    );
};

export default NotFoundPage;
