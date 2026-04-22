/**
 * @file prisma.types.ts
 * @description Prisma 트랜잭션 클라이언트 타입 정의
 *
 * Prisma의 $transaction() 콜백에 전달되는 트랜잭션 클라이언트 타입.
 * `tx?: any` 대신 이 타입을 사용하여 타입 안전성을 확보합니다.
 */
import { Prisma } from './generated/client';

/** Prisma 인터랙티브 트랜잭션 내부에서 사용하는 클라이언트 타입 */
export type PrismaTx = Prisma.TransactionClient;
