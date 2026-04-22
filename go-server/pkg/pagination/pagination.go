// Package pagination은 목록 결과의 페이지네이션을 위한 표준화된 구조와 유틸리티를 제공합니다.
package pagination

// Meta는 페이지네이션 메타데이터를 담는 구조체입니다.
type Meta struct {
	Total       int64 `json:"total"`       // 전체 항목 수
	Page        int   `json:"page"`        // 현재 페이지 번호
	Limit       int   `json:"limit"`       // 페이지 당 항목 수
	TotalPages  int   `json:"totalPages"`  // 전체 페이지 수
	HasNextPage bool  `json:"hasNextPage"` // 다음 페이지 존재 여부
	HasPrevPage bool  `json:"hasPrevPage"` // 이전 페이지 존재 여부
}

// PaginatedResponse는 페이지네이션된 데이터와 메타데이터를 포함하는 응답 구조체입니다.
type PaginatedResponse[T any] struct {
	Items []T  `json:"items"` // 데이터 목록
	Meta  Meta `json:"meta"`  // 페이지네이션 메타데이터
}

// CreatePaginatedResponse는 목록과 통계 정보를 바탕으로 PaginatedResponse를 생성합니다.
func CreatePaginatedResponse[T any](items []T, total int64, page int, limit int) PaginatedResponse[T] {
	totalPages := int((total + int64(limit) - 1) / int64(limit))
	if totalPages == 0 && total == 0 {
		totalPages = 0
	}

	return PaginatedResponse[T]{
		Items: items,
		Meta: Meta{
			Total:       total,
			Page:        page,
			Limit:       limit,
			TotalPages:  totalPages,
			HasNextPage: page < totalPages,
			HasPrevPage: page > 1,
		},
	}
}

// QueryParams는 목록 조회 시 사용되는 공통 쿼리 파라미터입니다.
type QueryParams struct {
	Page  int    `form:"page,default=1"`     // 요청 페이지 번호
	Limit int    `form:"limit,default=20"`   // 요청 항목 수
	Sort  string `form:"sort"`               // 정렬 기준 컬럼
	Order string `form:"order,default=desc"` // 정렬 순서 (asc/desc)
}
