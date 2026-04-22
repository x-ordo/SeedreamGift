/**
 * @file event-crud.e2e-spec.ts
 * @description 이벤트 CRUD 및 공개 조회 E2E 테스트
 *
 * 시나리오:
 * 1. 관리자 이벤트 생성 (POST /admin/events)
 * 2. 관리자 이벤트 목록 조회 (GET /admin/events)
 * 3. 관리자 이벤트 상세 조회 (GET /admin/events/:id)
 * 4. 관리자 이벤트 수정 (PATCH /admin/events/:id)
 * 5. 공개 이벤트 목록 조회 (GET /events)
 * 6. 공개 활성 이벤트 필터 (GET /events/active?status=)
 * 7. 공개 Featured 이벤트 (GET /events/featured)
 * 8. 조회수 증가 (PATCH /events/:id/view)
 * 9. 관리자 이벤트 삭제 (DELETE /admin/events/:id)
 * 10. 권한 검증 (일반 유저 CRUD 차단)
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getData,
  HTTP_STATUS,
  TEST_TIMEOUT,
} from '../helpers/test-setup';
import { createAndLoginUser, loginAsSeededUser } from '../helpers/test-users';

describe('Event CRUD (이벤트 관리)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  // 테스트용 이벤트 데이터
  const now = new Date();
  const futureStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // +1일
  const futureEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30일
  const pastStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // -30일
  const pastEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // -1일
  const ongoingStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // -5일

  let ongoingEventId: number;
  let upcomingEventId: number;
  let endedEventId: number;
  let featuredEventId: number;
  let inactiveEventId: number;

  beforeAll(async () => {
    app = await createTestApp();

    // Admin 로그인
    const admin = await loginAsSeededUser(app, 'admin');
    adminToken = admin.token;

    // 일반 유저 생성
    const user = await createAndLoginUser(app, 'event-tester');
    userToken = user.token;
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ========================================
  // 1. 관리자 이벤트 생성
  // ========================================
  describe('1. 관리자 이벤트 생성 (POST /admin/events)', () => {
    it('진행 중 이벤트를 생성할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '진행 중 이벤트',
          description: '<p>현재 진행 중인 이벤트입니다.</p>',
          imageUrl: '/images/events/ongoing.jpg',
          startDate: ongoingStart.toISOString(),
          endDate: futureEnd.toISOString(),
          isActive: true,
          isFeatured: false,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).id).toBeDefined();
      expect(getData(res).title).toBe('진행 중 이벤트');
      expect(getData(res).isActive).toBe(true);
      expect(getData(res).isFeatured).toBe(false);
      expect(getData(res).viewCount).toBe(0);
      ongoingEventId = getData(res).id;
    });

    it('예정 이벤트를 생성할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '예정 이벤트',
          description: '곧 시작될 이벤트입니다.',
          startDate: futureStart.toISOString(),
          endDate: futureEnd.toISOString(),
          isActive: true,
        })
        .expect(HTTP_STATUS.CREATED);

      upcomingEventId = getData(res).id;
    });

    it('종료된 이벤트를 생성할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '종료된 이벤트',
          description: '이미 종료된 이벤트입니다.',
          startDate: pastStart.toISOString(),
          endDate: pastEnd.toISOString(),
          isActive: true,
        })
        .expect(HTTP_STATUS.CREATED);

      endedEventId = getData(res).id;
    });

    it('Featured 이벤트를 생성할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '메인 노출 이벤트',
          description: '홈페이지에 노출되는 특별 이벤트입니다.',
          imageUrl: '/images/events/featured.jpg',
          startDate: ongoingStart.toISOString(),
          endDate: futureEnd.toISOString(),
          isActive: true,
          isFeatured: true,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).isFeatured).toBe(true);
      featuredEventId = getData(res).id;
    });

    it('비활성 이벤트를 생성할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '비활성 이벤트',
          description: '비활성 상태입니다.',
          startDate: ongoingStart.toISOString(),
          endDate: futureEnd.toISOString(),
          isActive: false,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(getData(res).isActive).toBe(false);
      inactiveEventId = getData(res).id;
    });

    it('필수 필드 누락 시 400 에러', async () => {
      await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '제목만 있는 이벤트',
          // description, startDate, endDate 누락
        })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });
  });

  // ========================================
  // 2. 관리자 이벤트 목록 조회
  // ========================================
  describe('2. 관리자 이벤트 목록 조회 (GET /admin/events)', () => {
    it('페이지네이션된 목록을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).items).toBeDefined();
      expect(Array.isArray(getData(res).items)).toBe(true);
      expect(getData(res).meta).toBeDefined();
      expect(getData(res).meta.total).toBeGreaterThanOrEqual(5);
    });

    it('page/limit 파라미터가 동작한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/events')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).items.length).toBeLessThanOrEqual(2);
      expect(getData(res).meta.limit).toBe(2);
    });
  });

  // ========================================
  // 3. 관리자 이벤트 상세 조회
  // ========================================
  describe('3. 관리자 이벤트 상세 조회 (GET /admin/events/:id)', () => {
    it('이벤트 상세 정보를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/events/${ongoingEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).id).toBe(ongoingEventId);
      expect(getData(res).title).toBe('진행 중 이벤트');
      expect(getData(res).description).toContain('현재 진행 중');
      expect(getData(res).startDate).toBeDefined();
      expect(getData(res).endDate).toBeDefined();
    });

    it('존재하지 않는 ID는 404', async () => {
      await request(app.getHttpServer())
        .get('/admin/events/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HTTP_STATUS.NOT_FOUND);
    });
  });

  // ========================================
  // 4. 관리자 이벤트 수정
  // ========================================
  describe('4. 관리자 이벤트 수정 (PATCH /admin/events/:id)', () => {
    it('제목을 수정할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/events/${ongoingEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '진행 중 이벤트 (수정됨)' })
        .expect(HTTP_STATUS.OK);

      expect(getData(res).title).toBe('진행 중 이벤트 (수정됨)');
    });

    it('isFeatured를 변경할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/events/${ongoingEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isFeatured: true })
        .expect(HTTP_STATUS.OK);

      expect(getData(res).isFeatured).toBe(true);
    });

    it('isActive를 변경할 수 있다', async () => {
      // 비활성 → 활성
      const res = await request(app.getHttpServer())
        .patch(`/admin/events/${inactiveEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true })
        .expect(HTTP_STATUS.OK);

      expect(getData(res).isActive).toBe(true);

      // 다시 비활성으로 복원
      await request(app.getHttpServer())
        .patch(`/admin/events/${inactiveEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(HTTP_STATUS.OK);
    });

    it('날짜를 수정할 수 있다', async () => {
      const newEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const res = await request(app.getHttpServer())
        .patch(`/admin/events/${ongoingEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ endDate: newEnd.toISOString() })
        .expect(HTTP_STATUS.OK);

      expect(new Date(getData(res).endDate).getTime()).toBeCloseTo(
        newEnd.getTime(),
        -3,
      );
    });
  });

  // ========================================
  // 5. 공개 이벤트 목록 조회
  // ========================================
  describe('5. 공개 이벤트 목록 조회 (GET /events)', () => {
    it('인증 없이 이벤트 목록을 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/events')
        .expect(HTTP_STATUS.OK);

      expect(getData(res).items).toBeDefined();
      expect(Array.isArray(getData(res).items)).toBe(true);
      expect(getData(res).items.length).toBeGreaterThanOrEqual(1);
    });

    it('단일 이벤트를 조회할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .get(`/events/${ongoingEventId}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).id).toBe(ongoingEventId);
      expect(getData(res).title).toBeDefined();
    });
  });

  // ========================================
  // 6. 활성 이벤트 필터링
  // ========================================
  describe('6. 활성 이벤트 필터 (GET /events/active)', () => {
    it('진행 중 이벤트만 조회 (status=ongoing)', async () => {
      const res = await request(app.getHttpServer())
        .get('/events/active')
        .query({ status: 'ongoing' })
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getData(res))).toBe(true);
      // 진행 중 이벤트가 최소 1개 이상 (ongoingEventId, featuredEventId)
      expect(getData(res).length).toBeGreaterThanOrEqual(1);

      // 모든 결과가 isActive=true이고 날짜가 현재 범위 내
      for (const event of getData(res)) {
        expect(event.isActive).toBe(true);
        expect(new Date(event.startDate).getTime()).toBeLessThanOrEqual(
          Date.now(),
        );
        expect(new Date(event.endDate).getTime()).toBeGreaterThanOrEqual(
          Date.now(),
        );
      }
    });

    it('예정 이벤트만 조회 (status=upcoming)', async () => {
      const res = await request(app.getHttpServer())
        .get('/events/active')
        .query({ status: 'upcoming' })
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getData(res))).toBe(true);
      expect(getData(res).length).toBeGreaterThanOrEqual(1);

      for (const event of getData(res)) {
        expect(event.isActive).toBe(true);
        expect(new Date(event.startDate).getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('종료된 이벤트만 조회 (status=ended)', async () => {
      const res = await request(app.getHttpServer())
        .get('/events/active')
        .query({ status: 'ended' })
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getData(res))).toBe(true);
      expect(getData(res).length).toBeGreaterThanOrEqual(1);

      for (const event of getData(res)) {
        expect(event.isActive).toBe(true);
        expect(new Date(event.endDate).getTime()).toBeLessThan(Date.now());
      }
    });

    it('비활성 이벤트는 조회되지 않는다', async () => {
      const res = await request(app.getHttpServer())
        .get('/events/active')
        .expect(HTTP_STATUS.OK);

      const inactiveFound = getData(res).find(
        (e: any) => e.id === inactiveEventId,
      );
      expect(inactiveFound).toBeUndefined();
    });

    it('status 없이 호출하면 활성 이벤트 전체 반환', async () => {
      const res = await request(app.getHttpServer())
        .get('/events/active')
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getData(res))).toBe(true);
      for (const event of getData(res)) {
        expect(event.isActive).toBe(true);
      }
    });
  });

  // ========================================
  // 7. Featured 이벤트 조회
  // ========================================
  describe('7. Featured 이벤트 (GET /events/featured)', () => {
    it('Featured 이벤트만 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/events/featured')
        .expect(HTTP_STATUS.OK);

      expect(Array.isArray(getData(res))).toBe(true);
      expect(getData(res).length).toBeGreaterThanOrEqual(1);

      for (const event of getData(res)) {
        expect(event.isFeatured).toBe(true);
        expect(event.isActive).toBe(true);
      }
    });

    it('최대 5개까지 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/events/featured')
        .expect(HTTP_STATUS.OK);

      expect(getData(res).length).toBeLessThanOrEqual(5);
    });
  });

  // ========================================
  // 8. 조회수 증가
  // ========================================
  describe('8. 조회수 증가 (PATCH /events/:id/view)', () => {
    it('조회수가 1 증가한다', async () => {
      // 초기 조회수 확인
      const before = await request(app.getHttpServer())
        .get(`/events/${ongoingEventId}`)
        .expect(HTTP_STATUS.OK);

      const initialCount = getData(before).viewCount;

      // 조회수 증가
      const res = await request(app.getHttpServer())
        .patch(`/events/${ongoingEventId}/view`)
        .expect(HTTP_STATUS.OK);

      expect(getData(res).viewCount).toBe(initialCount + 1);
    });

    it('여러 번 호출하면 누적된다', async () => {
      const before = await request(app.getHttpServer())
        .get(`/events/${upcomingEventId}`)
        .expect(HTTP_STATUS.OK);

      const initialCount = getData(before).viewCount;

      await request(app.getHttpServer())
        .patch(`/events/${upcomingEventId}/view`)
        .expect(HTTP_STATUS.OK);
      await request(app.getHttpServer())
        .patch(`/events/${upcomingEventId}/view`)
        .expect(HTTP_STATUS.OK);

      const after = await request(app.getHttpServer())
        .get(`/events/${upcomingEventId}`)
        .expect(HTTP_STATUS.OK);

      expect(getData(after).viewCount).toBe(initialCount + 2);
    });
  });

  // ========================================
  // 9. 관리자 이벤트 삭제
  // ========================================
  describe('9. 관리자 이벤트 삭제 (DELETE /admin/events/:id)', () => {
    it('이벤트를 삭제할 수 있다', async () => {
      // 삭제용 이벤트 생성
      const created = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '삭제될 이벤트',
          description: '삭제 테스트용',
          startDate: ongoingStart.toISOString(),
          endDate: futureEnd.toISOString(),
        })
        .expect(HTTP_STATUS.CREATED);

      const deleteId = getData(created).id;

      // 삭제
      await request(app.getHttpServer())
        .delete(`/admin/events/${deleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HTTP_STATUS.OK);

      // 삭제 확인
      await request(app.getHttpServer())
        .get(`/admin/events/${deleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HTTP_STATUS.NOT_FOUND);
    });
  });

  // ========================================
  // 10. 권한 검증
  // ========================================
  describe('10. 권한 검증', () => {
    it('일반 유저는 이벤트를 생성할 수 없다 (POST /events)', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: '유저가 만든 이벤트',
          description: '거부되어야 함',
          startDate: ongoingStart.toISOString(),
          endDate: futureEnd.toISOString(),
        })
        .expect(HTTP_STATUS.FORBIDDEN);
    });

    it('일반 유저는 이벤트를 수정할 수 없다 (PATCH /events/:id)', async () => {
      await request(app.getHttpServer())
        .patch(`/events/${ongoingEventId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: '유저가 수정' })
        .expect(HTTP_STATUS.FORBIDDEN);
    });

    it('일반 유저는 이벤트를 삭제할 수 없다 (DELETE /events/:id)', async () => {
      await request(app.getHttpServer())
        .delete(`/events/${ongoingEventId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(HTTP_STATUS.FORBIDDEN);
    });

    it('비로그인 시 이벤트 생성 401', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .send({
          title: '비인증 이벤트',
          description: '거부',
          startDate: ongoingStart.toISOString(),
          endDate: futureEnd.toISOString(),
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it('비로그인도 공개 조회는 가능하다', async () => {
      await request(app.getHttpServer())
        .get('/events/active')
        .expect(HTTP_STATUS.OK);

      await request(app.getHttpServer())
        .get('/events/featured')
        .expect(HTTP_STATUS.OK);

      await request(app.getHttpServer())
        .get(`/events/${ongoingEventId}`)
        .expect(HTTP_STATUS.OK);
    });
  });
});
