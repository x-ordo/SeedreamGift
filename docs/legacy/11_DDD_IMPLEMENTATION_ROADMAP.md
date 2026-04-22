> **[Legacy] 레거시 참조용** — 이 문서는 구 W Gift(wowgift.co.kr) 시절 작성되었으며 역사 보존 목적으로만 유지됩니다. 현재 시스템은 Seedream Gift(seedreamgift.com)입니다.

# 11. DDD 구현 로드맵

W기프트 프로젝트에 Domain-Driven Design을 단계적으로 적용하기 위한 6주 실행 계획서.

---

## 목차

1. [현재 상태 및 목표](#1-현재-상태-및-목표)
2. [Phase 1: Foundation (Week 1-2)](#2-phase-1-foundation-week-1-2)
3. [Phase 2: Core Aggregates (Week 3-4)](#3-phase-2-core-aggregates-week-3-4)
4. [Phase 3: Domain Events (Week 5)](#4-phase-3-domain-events-week-5)
5. [Phase 4: Supporting Contexts (Week 6)](#5-phase-4-supporting-contexts-week-6)
6. [디렉토리 구조 변경](#6-디렉토리-구조-변경)
7. [마이그레이션 전략](#7-마이그레이션-전략)
8. [위험 요소 및 대응](#8-위험-요소-및-대응)

---

## 1. 현재 상태 및 목표

### 1.1 현재 상태 (As-Is)

```
server/src/
├── base/                    # BaseCrudService, BaseCrudController
├── modules/
│   ├── orders/              # Procedural service logic
│   ├── voucher/             # PIN 관리 (anemic)
│   ├── trade-in/            # 매입 처리 (anemic)
│   ├── users/               # 사용자 관리
│   └── ...
└── shared/
    └── prisma/              # Data access (Prisma ORM)
```

**문제점:**
- Anemic Domain Model (데이터만 있는 엔티티)
- 비즈니스 로직이 Service에 산재
- 상태 전이 규칙 없음 (String enum)
- Cross-context 통신이 직접 호출
- 테스트하기 어려운 구조

### 1.2 목표 상태 (To-Be)

```
server/src/
├── domain/                  # 순수 비즈니스 로직
│   ├── sales/               # Sales Bounded Context
│   │   ├── aggregates/
│   │   ├── value-objects/
│   │   ├── events/
│   │   └── repositories/    # Interface only
│   ├── inventory/           # Inventory Context
│   ├── trade-in/            # Trade-In Context
│   └── shared/              # Cross-cutting domain
├── application/             # Use Cases (orchestration)
├── infrastructure/          # Prisma, external services
└── interfaces/              # Controllers, DTOs
```

**개선 효과:**
- Rich Domain Model (행위 + 데이터)
- 비즈니스 규칙 캡슐화
- 상태 머신으로 유효성 보장
- Domain Events로 느슨한 결합
- 단위 테스트 용이

---

## 2. Phase 1: Foundation (Week 1-2)

### Week 1: Value Objects 생성

#### 2.1.1 Money Value Object

```typescript
// server/src/domain/shared/value-objects/money.vo.ts

import { Decimal } from '@prisma/client/runtime/library';

export class Money {
  private constructor(
    public readonly amount: Decimal,
    public readonly currency: string = 'KRW'
  ) {
    if (amount.lessThan(0)) {
      throw new Error('Money cannot be negative');
    }
  }

  static of(amount: number | Decimal | string): Money {
    const decimal = amount instanceof Decimal
      ? amount
      : new Decimal(amount);
    return new Money(decimal);
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.add(other.amount), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.sub(other.amount), this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount.mul(factor), this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.greaterThan(other.amount);
  }

  isLessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.lessThanOrEqualTo(other.amount);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency &&
           this.amount.equals(other.amount);
  }

  toNumber(): number {
    return this.amount.toNumber();
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(0)}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
```

#### 2.1.2 OrderStatus Value Object (State Machine)

```typescript
// server/src/domain/sales/value-objects/order-status.vo.ts

export enum OrderStatusType {
  PENDING = 'PENDING',
  PAID = 'PAID',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

const VALID_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
  [OrderStatusType.PENDING]: [OrderStatusType.PAID, OrderStatusType.CANCELLED],
  [OrderStatusType.PAID]: [OrderStatusType.DELIVERED, OrderStatusType.CANCELLED],
  [OrderStatusType.DELIVERED]: [], // Terminal state
  [OrderStatusType.CANCELLED]: [], // Terminal state
};

export class OrderStatus {
  private constructor(public readonly value: OrderStatusType) {}

  static of(value: string): OrderStatus {
    if (!Object.values(OrderStatusType).includes(value as OrderStatusType)) {
      throw new Error(`Invalid order status: ${value}`);
    }
    return new OrderStatus(value as OrderStatusType);
  }

  static pending(): OrderStatus {
    return new OrderStatus(OrderStatusType.PENDING);
  }

  canTransitionTo(target: OrderStatusType): boolean {
    return VALID_TRANSITIONS[this.value].includes(target);
  }

  transitionTo(target: OrderStatusType): OrderStatus {
    if (!this.canTransitionTo(target)) {
      throw new Error(
        `Invalid transition: ${this.value} → ${target}. ` +
        `Allowed: ${VALID_TRANSITIONS[this.value].join(', ') || 'none'}`
      );
    }
    return new OrderStatus(target);
  }

  isPending(): boolean {
    return this.value === OrderStatusType.PENDING;
  }

  isPaid(): boolean {
    return this.value === OrderStatusType.PAID;
  }

  isTerminal(): boolean {
    return VALID_TRANSITIONS[this.value].length === 0;
  }

  equals(other: OrderStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

#### 2.1.3 PurchaseLimit Value Object

```typescript
// server/src/domain/sales/value-objects/purchase-limit.vo.ts

import { Money } from '../../shared/value-objects/money.vo';

export class PurchaseLimit {
  private constructor(
    public readonly dailyLimit: Money,
    public readonly perTransactionLimit: Money
  ) {
    if (perTransactionLimit.isGreaterThan(dailyLimit)) {
      throw new Error('Per-transaction limit cannot exceed daily limit');
    }
  }

  static of(daily: number, perTx: number): PurchaseLimit {
    return new PurchaseLimit(Money.of(daily), Money.of(perTx));
  }

  static default(): PurchaseLimit {
    return PurchaseLimit.of(500000, 100000); // 50만/일, 10만/건
  }

  static unlimited(): PurchaseLimit {
    return PurchaseLimit.of(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  }

  canPurchase(amount: Money, todayTotal: Money): boolean {
    // 건당 한도 체크
    if (amount.isGreaterThan(this.perTransactionLimit)) {
      return false;
    }
    // 일일 한도 체크
    const newTotal = todayTotal.add(amount);
    return newTotal.isLessThanOrEqual(this.dailyLimit);
  }

  getRemainingDaily(todayTotal: Money): Money {
    return this.dailyLimit.subtract(todayTotal);
  }
}
```

#### 2.1.4 TradeInStatus Value Object

```typescript
// server/src/domain/trade-in/value-objects/trade-in-status.vo.ts

export enum TradeInStatusType {
  REQUESTED = 'REQUESTED',
  VERIFIED = 'VERIFIED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

const VALID_TRANSITIONS: Record<TradeInStatusType, TradeInStatusType[]> = {
  [TradeInStatusType.REQUESTED]: [TradeInStatusType.VERIFIED, TradeInStatusType.REJECTED],
  [TradeInStatusType.VERIFIED]: [TradeInStatusType.PAID, TradeInStatusType.REJECTED],
  [TradeInStatusType.PAID]: [],
  [TradeInStatusType.REJECTED]: [],
};

export class TradeInStatus {
  private constructor(public readonly value: TradeInStatusType) {}

  static of(value: string): TradeInStatus {
    if (!Object.values(TradeInStatusType).includes(value as TradeInStatusType)) {
      throw new Error(`Invalid trade-in status: ${value}`);
    }
    return new TradeInStatus(value as TradeInStatusType);
  }

  static requested(): TradeInStatus {
    return new TradeInStatus(TradeInStatusType.REQUESTED);
  }

  canTransitionTo(target: TradeInStatusType): boolean {
    return VALID_TRANSITIONS[this.value].includes(target);
  }

  transitionTo(target: TradeInStatusType): TradeInStatus {
    if (!this.canTransitionTo(target)) {
      throw new Error(`Invalid transition: ${this.value} → ${target}`);
    }
    return new TradeInStatus(target);
  }

  isTerminal(): boolean {
    return VALID_TRANSITIONS[this.value].length === 0;
  }
}
```

### Week 2: Domain Events 인프라

#### 2.2.1 Base Domain Event

```typescript
// server/src/domain/shared/events/domain-event.ts

export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventId: string;

  constructor() {
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
  }

  abstract get eventName(): string;
}
```

#### 2.2.2 Aggregate Root Base

```typescript
// server/src/domain/shared/aggregate-root.ts

import { DomainEvent } from './events/domain-event';

export abstract class AggregateRoot<TId = string> {
  public readonly id: TId;
  private _domainEvents: DomainEvent[] = [];

  constructor(id: TId) {
    this.id = id;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  public getDomainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }
}
```

#### 2.2.3 Event Bus Interface

```typescript
// server/src/domain/shared/events/event-bus.interface.ts

import { DomainEvent } from './domain-event';

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

export const EVENT_BUS = Symbol('EVENT_BUS');
```

#### 2.2.4 NestJS Event Bus Implementation

```typescript
// server/src/infrastructure/events/nestjs-event-bus.ts

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IEventBus } from '../../domain/shared/events/event-bus.interface';
import { DomainEvent } from '../../domain/shared/events/domain-event';

@Injectable()
export class NestJsEventBus implements IEventBus {
  constructor(private eventEmitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    this.eventEmitter.emit(event.eventName, event);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
```

### Week 1-2 체크리스트

- [ ] `Money` Value Object 생성 및 테스트
- [ ] `OrderStatus` Value Object 생성 및 테스트
- [ ] `TradeInStatus` Value Object 생성 및 테스트
- [ ] `PurchaseLimit` Value Object 생성 및 테스트
- [ ] `DomainEvent` 베이스 클래스 생성
- [ ] `AggregateRoot` 베이스 클래스 생성
- [ ] `IEventBus` 인터페이스 및 NestJS 구현
- [ ] EventEmitter2 모듈 설치 및 설정
- [ ] 기존 서비스에서 Value Objects 점진적 적용

---

## 3. Phase 2: Core Aggregates (Week 3-4)

### Week 3: Order Aggregate

#### 3.1.1 Order Entity (Aggregate Root)

```typescript
// server/src/domain/sales/aggregates/order/order.entity.ts

import { AggregateRoot } from '../../../shared/aggregate-root';
import { Money } from '../../../shared/value-objects/money.vo';
import { OrderStatus, OrderStatusType } from '../../value-objects/order-status.vo';
import { OrderItem } from './order-item.entity';
import { OrderCreatedEvent } from '../../events/order-created.event';
import { OrderPaidEvent } from '../../events/order-paid.event';

export class Order extends AggregateRoot<string> {
  private _status: OrderStatus;
  private _items: OrderItem[];
  private _totalAmount: Money;
  private _userId: string;
  private _giftReceiverId?: string;
  private _paymentKey?: string;
  private _createdAt: Date;
  private _paidAt?: Date;

  private constructor(props: OrderProps) {
    super(props.id);
    this._status = props.status;
    this._items = props.items;
    this._totalAmount = props.totalAmount;
    this._userId = props.userId;
    this._giftReceiverId = props.giftReceiverId;
    this._paymentKey = props.paymentKey;
    this._createdAt = props.createdAt;
    this._paidAt = props.paidAt;
  }

  // Factory method
  static create(props: CreateOrderProps): Order {
    const order = new Order({
      id: crypto.randomUUID(),
      status: OrderStatus.pending(),
      items: props.items,
      totalAmount: Order.calculateTotal(props.items),
      userId: props.userId,
      giftReceiverId: props.giftReceiverId,
      createdAt: new Date(),
    });

    order.addDomainEvent(new OrderCreatedEvent(
      order.id,
      order._userId,
      order._totalAmount.toNumber(),
      order._giftReceiverId
    ));

    return order;
  }

  // Reconstitute from persistence
  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  // Business logic
  markAsPaid(paymentKey: string): void {
    this._status = this._status.transitionTo(OrderStatusType.PAID);
    this._paymentKey = paymentKey;
    this._paidAt = new Date();

    this.addDomainEvent(new OrderPaidEvent(
      this.id,
      paymentKey,
      this._totalAmount.toNumber()
    ));
  }

  markAsDelivered(): void {
    this._status = this._status.transitionTo(OrderStatusType.DELIVERED);
  }

  cancel(reason: string): void {
    if (this._status.isTerminal()) {
      throw new Error('Cannot cancel terminal order');
    }
    this._status = this._status.transitionTo(OrderStatusType.CANCELLED);
    // Add cancelled event
  }

  // Invariant checks
  private static calculateTotal(items: OrderItem[]): Money {
    return items.reduce(
      (total, item) => total.add(item.subtotal),
      Money.zero()
    );
  }

  // Getters
  get status(): OrderStatus { return this._status; }
  get items(): readonly OrderItem[] { return this._items; }
  get totalAmount(): Money { return this._totalAmount; }
  get userId(): string { return this._userId; }
  get isGift(): boolean { return !!this._giftReceiverId; }
  get giftReceiverId(): string | undefined { return this._giftReceiverId; }
}

interface OrderProps {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: Money;
  userId: string;
  giftReceiverId?: string;
  paymentKey?: string;
  createdAt: Date;
  paidAt?: Date;
}

interface CreateOrderProps {
  userId: string;
  items: OrderItem[];
  giftReceiverId?: string;
}
```

#### 3.1.2 Order Repository Interface

```typescript
// server/src/domain/sales/repositories/order.repository.interface.ts

import { Order } from '../aggregates/order/order.entity';
import { Money } from '../../shared/value-objects/money.vo';

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  getTodayTotalByUser(userId: string): Promise<Money>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
```

#### 3.1.3 Create Order Use Case

```typescript
// server/src/application/sales/use-cases/create-order.use-case.ts

import { Inject, Injectable } from '@nestjs/common';
import { Order } from '../../../domain/sales/aggregates/order/order.entity';
import { IOrderRepository, ORDER_REPOSITORY } from '../../../domain/sales/repositories/order.repository.interface';
import { IEventBus, EVENT_BUS } from '../../../domain/shared/events/event-bus.interface';
import { PurchaseLimit } from '../../../domain/sales/value-objects/purchase-limit.vo';
import { Money } from '../../../domain/shared/value-objects/money.vo';

export interface CreateOrderRequest {
  userId: string;
  items: { productId: string; quantity: number; price: number }[];
  giftReceiverId?: string;
  userPurchaseLimit?: { daily: number; perTx: number };
}

export interface CreateOrderResponse {
  success: boolean;
  order?: Order;
  error?: string;
}

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private orderRepo: IOrderRepository,
    @Inject(EVENT_BUS) private eventBus: IEventBus,
  ) {}

  async execute(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    // 1. Build order items
    const orderItems = request.items.map(item =>
      OrderItem.create(item.productId, item.quantity, Money.of(item.price))
    );

    // 2. Calculate total
    const totalAmount = orderItems.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.zero()
    );

    // 3. Check purchase limits
    const limit = request.userPurchaseLimit
      ? PurchaseLimit.of(request.userPurchaseLimit.daily, request.userPurchaseLimit.perTx)
      : PurchaseLimit.default();

    const todayTotal = await this.orderRepo.getTodayTotalByUser(request.userId);

    if (!limit.canPurchase(totalAmount, todayTotal)) {
      return {
        success: false,
        error: `구매 한도 초과. 일일 잔여: ${limit.getRemainingDaily(todayTotal)}원`
      };
    }

    // 4. Create order aggregate
    const order = Order.create({
      userId: request.userId,
      items: orderItems,
      giftReceiverId: request.giftReceiverId,
    });

    // 5. Persist
    await this.orderRepo.save(order);

    // 6. Publish domain events
    await this.eventBus.publishAll(order.pullDomainEvents());

    return { success: true, order };
  }
}
```

### Week 4: Trade-In Aggregate

#### 3.2.1 TradeIn Entity (Aggregate Root)

```typescript
// server/src/domain/trade-in/aggregates/trade-in.entity.ts

import { AggregateRoot } from '../../shared/aggregate-root';
import { Money } from '../../shared/value-objects/money.vo';
import { TradeInStatus, TradeInStatusType } from '../value-objects/trade-in-status.vo';
import { TradeInRequestedEvent } from '../events/trade-in-requested.event';
import { TradeInApprovedEvent } from '../events/trade-in-approved.event';

export class TradeIn extends AggregateRoot<string> {
  private _status: TradeInStatus;
  private _userId: string;
  private _productId: string;
  private _pinCode: string; // encrypted
  private _payoutAmount: Money;
  private _bankAccount: string; // encrypted
  private _adminNotes?: string;
  private _processedBy?: string;
  private _createdAt: Date;
  private _processedAt?: Date;

  private constructor(props: TradeInProps) {
    super(props.id);
    this._status = props.status;
    this._userId = props.userId;
    this._productId = props.productId;
    this._pinCode = props.pinCode;
    this._payoutAmount = props.payoutAmount;
    this._bankAccount = props.bankAccount;
    this._adminNotes = props.adminNotes;
    this._processedBy = props.processedBy;
    this._createdAt = props.createdAt;
    this._processedAt = props.processedAt;
  }

  static create(props: CreateTradeInProps): TradeIn {
    // Calculate payout: price * (1 - tradeInRate/100)
    const payoutAmount = props.productPrice.multiply(1 - props.tradeInRate / 100);

    const tradeIn = new TradeIn({
      id: crypto.randomUUID(),
      status: TradeInStatus.requested(),
      userId: props.userId,
      productId: props.productId,
      pinCode: props.encryptedPinCode,
      payoutAmount,
      bankAccount: props.encryptedBankAccount,
      createdAt: new Date(),
    });

    tradeIn.addDomainEvent(new TradeInRequestedEvent(
      tradeIn.id,
      tradeIn._userId,
      tradeIn._productId,
      payoutAmount.toNumber()
    ));

    return tradeIn;
  }

  static reconstitute(props: TradeInProps): TradeIn {
    return new TradeIn(props);
  }

  verify(adminId: string): void {
    this._status = this._status.transitionTo(TradeInStatusType.VERIFIED);
    this._processedBy = adminId;
  }

  approve(adminId: string, notes?: string): void {
    this._status = this._status.transitionTo(TradeInStatusType.PAID);
    this._processedBy = adminId;
    this._adminNotes = notes;
    this._processedAt = new Date();

    this.addDomainEvent(new TradeInApprovedEvent(
      this.id,
      adminId,
      this._payoutAmount.toNumber()
    ));
  }

  reject(adminId: string, reason: string): void {
    this._status = this._status.transitionTo(TradeInStatusType.REJECTED);
    this._processedBy = adminId;
    this._adminNotes = reason;
    this._processedAt = new Date();
  }

  // Getters
  get status(): TradeInStatus { return this._status; }
  get payoutAmount(): Money { return this._payoutAmount; }
  get userId(): string { return this._userId; }
}

interface TradeInProps {
  id: string;
  status: TradeInStatus;
  userId: string;
  productId: string;
  pinCode: string;
  payoutAmount: Money;
  bankAccount: string;
  adminNotes?: string;
  processedBy?: string;
  createdAt: Date;
  processedAt?: Date;
}

interface CreateTradeInProps {
  userId: string;
  productId: string;
  encryptedPinCode: string;
  encryptedBankAccount: string;
  productPrice: Money;
  tradeInRate: number;
}
```

### Week 3-4 체크리스트

- [ ] `Order` Aggregate Root 구현
- [ ] `OrderItem` Entity 구현
- [ ] `IOrderRepository` 인터페이스 정의
- [ ] `PrismaOrderRepository` 구현
- [ ] `CreateOrderUseCase` 구현
- [ ] `TradeIn` Aggregate Root 구현
- [ ] `ITradeInRepository` 인터페이스 정의
- [ ] `PrismaTradeInRepository` 구현
- [ ] `CreateTradeInUseCase`, `ApproveTradeInUseCase` 구현
- [ ] 기존 서비스에서 Use Case 호출로 전환
- [ ] 통합 테스트 작성

---

## 4. Phase 3: Domain Events (Week 5)

### 4.1 핵심 이벤트 정의

#### 4.1.1 Sales Events

```typescript
// server/src/domain/sales/events/order-created.event.ts

import { DomainEvent } from '../../shared/events/domain-event';

export class OrderCreatedEvent extends DomainEvent {
  get eventName(): string { return 'order.created'; }

  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly giftReceiverId?: string,
  ) {
    super();
  }
}

// order-paid.event.ts
export class OrderPaidEvent extends DomainEvent {
  get eventName(): string { return 'order.paid'; }

  constructor(
    public readonly orderId: string,
    public readonly paymentKey: string,
    public readonly totalAmount: number,
  ) {
    super();
  }
}

// vouchers-assigned.event.ts
export class VouchersAssignedEvent extends DomainEvent {
  get eventName(): string { return 'order.vouchers_assigned'; }

  constructor(
    public readonly orderId: string,
    public readonly voucherIds: string[],
  ) {
    super();
  }
}
```

#### 4.1.2 Inventory Events

```typescript
// server/src/domain/inventory/events/low-stock-warning.event.ts

import { DomainEvent } from '../../shared/events/domain-event';

export class LowStockWarningEvent extends DomainEvent {
  get eventName(): string { return 'inventory.low_stock'; }

  constructor(
    public readonly productId: string,
    public readonly productName: string,
    public readonly remainingCount: number,
    public readonly threshold: number,
  ) {
    super();
  }
}
```

### 4.2 Event Handlers

```typescript
// server/src/application/event-handlers/order-paid.handler.ts

import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Inject } from '@nestjs/common';
import { OrderPaidEvent } from '../../domain/sales/events/order-paid.event';
import { IVoucherService, VOUCHER_SERVICE } from '../inventory/voucher.service.interface';

@Injectable()
export class OrderPaidHandler {
  constructor(
    @Inject(VOUCHER_SERVICE) private voucherService: IVoucherService,
  ) {}

  @OnEvent('order.paid')
  async handle(event: OrderPaidEvent): Promise<void> {
    console.log(`[Event] Order paid: ${event.orderId}, assigning vouchers...`);

    // Assign vouchers to order
    await this.voucherService.assignVouchersToOrder(event.orderId);
  }
}

// trade-in-approved.handler.ts
@Injectable()
export class TradeInApprovedHandler {
  constructor(private notificationService: NotificationService) {}

  @OnEvent('trade-in.approved')
  async handle(event: TradeInApprovedEvent): Promise<void> {
    // Send notification to user
    await this.notificationService.sendTradeInApprovalNotification(
      event.tradeInId,
      event.payoutAmount
    );
  }
}

// low-stock-warning.handler.ts
@Injectable()
export class LowStockWarningHandler {
  constructor(private adminNotificationService: AdminNotificationService) {}

  @OnEvent('inventory.low_stock')
  async handle(event: LowStockWarningEvent): Promise<void> {
    await this.adminNotificationService.alertLowStock(
      event.productName,
      event.remainingCount
    );
  }
}
```

### 4.3 Event Module 등록

```typescript
// server/src/infrastructure/events/events.module.ts

import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NestJsEventBus } from './nestjs-event-bus';
import { EVENT_BUS } from '../../domain/shared/events/event-bus.interface';
import { OrderPaidHandler } from '../../application/event-handlers/order-paid.handler';
import { TradeInApprovedHandler } from '../../application/event-handlers/trade-in-approved.handler';
import { LowStockWarningHandler } from '../../application/event-handlers/low-stock-warning.handler';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
  ],
  providers: [
    {
      provide: EVENT_BUS,
      useClass: NestJsEventBus,
    },
    OrderPaidHandler,
    TradeInApprovedHandler,
    LowStockWarningHandler,
  ],
  exports: [EVENT_BUS],
})
export class EventsModule {}
```

### Week 5 체크리스트

- [ ] `@nestjs/event-emitter` 패키지 설치
- [ ] `EventsModule` 생성 및 AppModule에 등록
- [ ] Sales 이벤트 (`OrderCreated`, `OrderPaid`, `VouchersAssigned`)
- [ ] Inventory 이벤트 (`LowStockWarning`)
- [ ] Trade-In 이벤트 (`TradeInRequested`, `TradeInApproved`)
- [ ] Event Handlers 구현
- [ ] 이벤트 발행 로직 Aggregate에 통합
- [ ] E2E 테스트 (이벤트 발행 확인)

---

## 5. Phase 4: Supporting Contexts (Week 6)

### 5.1 User Aggregate 개선

```typescript
// server/src/domain/user/aggregates/user.entity.ts

export class User extends AggregateRoot<string> {
  private _email: string;
  private _role: UserRole;
  private _kycStatus: KycStatus;
  private _purchaseLimit: PurchaseLimit;
  private _canReceiveGift: boolean;

  // KYC 승인 비즈니스 로직
  approveKyc(adminId: string): void {
    if (this._kycStatus !== KycStatus.PENDING) {
      throw new Error('Can only approve pending KYC');
    }
    this._kycStatus = KycStatus.VERIFIED;
    this.addDomainEvent(new KycVerifiedEvent(this.id, adminId));
  }

  // 역할 변경 비즈니스 로직
  changeRole(newRole: UserRole, adminId: string): void {
    const oldRole = this._role;
    this._role = newRole;

    // Partner 승격 시 한도 자동 조정
    if (newRole === UserRole.PARTNER) {
      this._purchaseLimit = PurchaseLimit.of(5000000, 1000000);
    }

    this.addDomainEvent(new RoleChangedEvent(this.id, oldRole, newRole, adminId));
  }

  // 선물 수령 자격 부여
  enableGiftReceiving(adminId: string): void {
    if (this._kycStatus !== KycStatus.VERIFIED) {
      throw new Error('KYC must be verified to receive gifts');
    }
    this._canReceiveGift = true;
    this.addDomainEvent(new GiftEligibilityGrantedEvent(this.id, adminId));
  }
}
```

### 5.2 Product Catalog 개선

```typescript
// server/src/domain/catalog/value-objects/pricing-policy.vo.ts

export class PricingPolicy {
  private constructor(
    public readonly faceValue: Money,
    public readonly discountRate: number,
    public readonly buyPrice: Money,
  ) {}

  static create(faceValue: Money, discountRate: number): PricingPolicy {
    if (discountRate < 0 || discountRate > 100) {
      throw new Error('Discount rate must be between 0 and 100');
    }

    const buyPrice = faceValue.multiply(1 - discountRate / 100);
    return new PricingPolicy(faceValue, discountRate, buyPrice);
  }

  updateDiscount(newRate: number): PricingPolicy {
    return PricingPolicy.create(this.faceValue, newRate);
  }
}
```

### Week 6 체크리스트

- [ ] `User` Aggregate 비즈니스 로직 추가
- [ ] `KycVerification` Value Object
- [ ] `PricingPolicy` Value Object
- [ ] User/Catalog Repository 인터페이스 및 구현
- [ ] 관련 Use Cases 구현
- [ ] 전체 통합 테스트
- [ ] 문서화 및 팀 리뷰

---

## 6. 디렉토리 구조 변경

### 6.1 최종 구조

```
server/src/
├── domain/                          # 순수 도메인 (프레임워크 무관)
│   ├── shared/
│   │   ├── aggregate-root.ts
│   │   ├── value-objects/
│   │   │   └── money.vo.ts
│   │   └── events/
│   │       ├── domain-event.ts
│   │       └── event-bus.interface.ts
│   ├── sales/                       # Sales Bounded Context
│   │   ├── aggregates/
│   │   │   ├── order/
│   │   │   │   ├── order.entity.ts
│   │   │   │   └── order-item.entity.ts
│   │   │   └── cart/
│   │   │       └── cart.entity.ts
│   │   ├── value-objects/
│   │   │   ├── order-status.vo.ts
│   │   │   └── purchase-limit.vo.ts
│   │   ├── events/
│   │   │   ├── order-created.event.ts
│   │   │   └── order-paid.event.ts
│   │   └── repositories/
│   │       └── order.repository.interface.ts
│   ├── inventory/                   # Inventory Context
│   │   ├── aggregates/
│   │   ├── value-objects/
│   │   ├── events/
│   │   └── repositories/
│   ├── trade-in/                    # Trade-In Context
│   │   ├── aggregates/
│   │   ├── value-objects/
│   │   ├── events/
│   │   └── repositories/
│   └── user/                        # User Context
│       ├── aggregates/
│       ├── value-objects/
│       └── repositories/
│
├── application/                     # Use Cases (Application Layer)
│   ├── sales/
│   │   └── use-cases/
│   │       ├── create-order.use-case.ts
│   │       └── pay-order.use-case.ts
│   ├── trade-in/
│   │   └── use-cases/
│   └── event-handlers/
│       ├── order-paid.handler.ts
│       └── low-stock-warning.handler.ts
│
├── infrastructure/                  # 외부 의존성
│   ├── persistence/
│   │   ├── prisma/
│   │   │   └── prisma.service.ts
│   │   └── repositories/
│   │       ├── prisma-order.repository.ts
│   │       └── prisma-trade-in.repository.ts
│   ├── events/
│   │   ├── events.module.ts
│   │   └── nestjs-event-bus.ts
│   └── external/
│       └── payment-gateway.ts
│
├── interfaces/                      # API Layer (Controllers)
│   ├── http/
│   │   ├── controllers/
│   │   │   ├── orders.controller.ts
│   │   │   └── trade-in.controller.ts
│   │   └── dtos/
│   │       ├── create-order.dto.ts
│   │       └── create-trade-in.dto.ts
│   └── guards/
│
└── modules/                         # NestJS Modules (기존 호환)
    ├── sales.module.ts
    ├── inventory.module.ts
    └── trade-in.module.ts
```

---

## 7. 마이그레이션 전략

### 7.1 점진적 마이그레이션 (Strangler Pattern)

기존 서비스를 한 번에 교체하지 않고, 새 DDD 구조와 병행:

```typescript
// 기존 OrdersService (유지)
@Injectable()
export class OrdersService extends BaseCrudService<Order> {
  // 기존 메소드 유지
}

// 새 CreateOrderUseCase (추가)
@Injectable()
export class CreateOrderUseCase {
  // DDD 방식 구현
}

// Controller에서 선택적 사용
@Controller('orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,        // 기존
    private createOrderUseCase: CreateOrderUseCase, // 신규
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    // Feature flag로 전환
    if (this.useDddMode) {
      return this.createOrderUseCase.execute(dto);
    }
    return this.ordersService.create(dto);
  }
}
```

### 7.2 테스트 전략

```
1. Unit Tests (domain/)
   - Value Objects: 불변성, 검증 로직
   - Entities: 비즈니스 규칙, 상태 전이
   - Aggregates: 불변식 유지

2. Integration Tests (application/)
   - Use Cases: Repository mock, 시나리오 검증
   - Event Handlers: 이벤트 발행/구독

3. E2E Tests (interfaces/)
   - API 엔드포인트 전체 플로우
```

---

## 8. 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| 마이그레이션 중 장애 | High | Feature flag 활용, 롤백 준비 |
| 팀 학습 곡선 | Medium | 주간 세미나, 페어 프로그래밍 |
| 성능 저하 | Low | Aggregate 크기 제한, lazy loading |
| 과도한 추상화 | Medium | YAGNI 원칙, 필요 시점에 도입 |
| 트랜잭션 복잡도 | Medium | Saga 패턴 검토, eventual consistency |

---

## 부록: 의존성 추가

```bash
# NestJS Event Emitter
pnpm add @nestjs/event-emitter

# UUID 생성 (crypto.randomUUID 대신 사용 가능)
pnpm add uuid
pnpm add -D @types/uuid
```

---

## 참고 문서

- [docs/02_ARCHITECTURE.md](./02_ARCHITECTURE.md) - 현재 시스템 아키텍처
- [docs/03_ERD.md](./03_ERD.md) - 데이터베이스 스키마
- [docs/08_TEST_SPEC.md](./08_TEST_SPEC.md) - 테스트 규격

---

**문서 버전**: 1.0
**작성일**: 2026-02-05
**다음 리뷰**: Phase 1 완료 시점
