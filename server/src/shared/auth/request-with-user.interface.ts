import { Request } from 'express';

/**
 * JWT 인증 후 request.user에 주입되는 사용자 정보 타입
 *
 * JwtStrategy.validate()가 반환하는 사용자 객체 (password 제외)
 * 컨트롤러에서 @Request() req: RequestWithUser 로 사용
 */
export interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    role: string;
    name: string | null;
  };
}
