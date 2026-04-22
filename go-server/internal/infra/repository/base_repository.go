// Package repository는 애플리케이션의 데이터 액세스 계층을 제공합니다.
// Base Repository는 데이터베이스 작업을 위한 일반적이고 재사용 가능한 패턴을 구현합니다.
package repository

import (
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// BaseRepository는 제네릭 타입을 사용하는 기본 저장소 구조체입니다.
type BaseRepository[T any] struct {
	db *gorm.DB
}

// NewBaseRepository는 새로운 BaseRepository 인스턴스를 생성하여 반환합니다.
func NewBaseRepository[T any](db *gorm.DB) *BaseRepository[T] {
	return &BaseRepository[T]{db: db}
}

// allowedSortColumns는 ORDER BY 절에 사용할 수 있는 안전한 컬럼 이름 목록입니다.
var allowedSortColumns = map[string]bool{
	"Id": true, "CreatedAt": true, "UpdatedAt": true, "Name": true,
	"Email": true, "Price": true, "Order": true, "Status": true,
	"Title": true, "ViewCount": true, "Code": true, "BrandCode": true,
}

// allowedSortOrders는 유효한 정렬 방향 정의입니다.
var allowedSortOrders = map[string]bool{
	"asc": true, "desc": true, "ASC": true, "DESC": true,
}

// GetDB는 커스텀 쿼리를 위해 내부 GORM DB 인스턴스를 반환합니다.
func (r *BaseRepository[T]) GetDB() *gorm.DB {
	return r.db
}

// FindAll은 주어진 조건과 페이지네이션 파라미터에 맞는 모든 엔티티를 조회합니다.
// 1. 요청된 페이지와 제한(Limit) 값을 검증하고 기본값을 설정합니다.
// 2. SQL Injection 방지를 위해 정렬 컬럼(Sort)과 방향(Order)을 화이트리스트 기반으로 필터링합니다.
// 3. 전체 데이터 개수를 조회하여 페이지네이션 메타데이터를 생성합니다.
// 4. 최종적으로 정렬, 오프셋, 제한 조건을 적용하여 데이터를 조회합니다.
func (r *BaseRepository[T]) FindAll(params pagination.QueryParams, where any) (pagination.PaginatedResponse[T], error) {
	var items []T
	var total int64

	// 조회할 모델 인스턴스 설정
	db := r.db.Model(new(T))
	if where != nil {
		db = db.Where(where)
	}

	// 페이지네이션 처리를 위한 전체 레코드 수 조회
	db.Count(&total)

	// 페이지네이션 파라미터 유효성 검사 및 보정
	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Limit > 100 {
		params.Limit = 100 // 서버 부하 방지를 위한 최대치 제한
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	// 데이터 시작 위치(Offset) 계산
	offset := (params.Page - 1) * params.Limit

	// 정렬 보안 처리 (SQL Injection 방지)
	// 화이트리스트(allowedSortColumns)에 포함된 컬럼만 정렬에 사용합니다.
	orderBy := "CreatedAt" // 기본 정렬 값 (모든 모델에 존재하는 컬럼)
	if params.Sort != "" && allowedSortColumns[params.Sort] {
		orderBy = params.Sort
	}
	sortOrder := "desc"
	if allowedSortOrders[params.Order] {
		sortOrder = params.Order
	}
	orderClause := orderBy + " " + sortOrder

	// Count() 호출 후 GORM 세션 오염을 방지하기 위해 새 쿼리를 생성합니다.
	dataQuery := r.db.Model(new(T))
	if where != nil {
		dataQuery = dataQuery.Where(where)
	}

	// 최종 쿼리 실행
	err := dataQuery.Order(orderClause).Offset(offset).Limit(params.Limit).Find(&items).Error
	if err != nil {
		// 정렬 쿼리 실패 시 정렬 없이 재시도합니다.
		items = nil
		freshQuery := r.db.Model(new(T))
		if where != nil {
			freshQuery = freshQuery.Where(where)
		}
		err = freshQuery.Offset(offset).Limit(params.Limit).Find(&items).Error
	}
	if err != nil {
		return pagination.PaginatedResponse[T]{}, err
	}

	// 조회된 데이터와 전체 카운트를 기반으로 표준 응답 객체 생성
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), nil
}

// FindByID는 기본 키를 사용하여 단일 엔티티를 조회합니다.
func (r *BaseRepository[T]) FindByID(id any) (*T, error) {
	var item T
	err := r.db.First(&item, id).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// Create은 데이터베이스에 새로운 엔티티를 삽입합니다.
func (r *BaseRepository[T]) Create(entity *T) error {
	return r.db.Create(entity).Error
}

// Update는 ID로 식별된 기존 엔티티를 수정합니다.
func (r *BaseRepository[T]) Update(id any, entity *T) error {
	return r.db.Model(new(T)).Where("Id = ?", id).Updates(entity).Error
}

// Delete는 기본 키를 사용하여 엔티티를 삭제합니다.
func (r *BaseRepository[T]) Delete(id any) error {
	return r.db.Delete(new(T), id).Error
}

// FindOne은 주어진 조건과 일치하는 단일 엔티티를 조회합니다.
func (r *BaseRepository[T]) FindOne(where any) (*T, error) {
	var item T
	err := r.db.Where(where).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}
