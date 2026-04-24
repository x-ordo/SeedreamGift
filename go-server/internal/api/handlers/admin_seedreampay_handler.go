// Package handlers — Seedreampay admin-facing HTTP endpoints.
//
// Admin endpoints provide a read-only view of the Seedreampay voucher
// inventory. Sensitive fields (SecretHash, PinCode, PinHash) are explicitly
// excluded from all responses — the database stores them for verification
// only, never for display.
package handlers

import (
	"errors"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"seedream-gift-server/pkg/response"
)

const sdpProviderCodeAdmin = "SEEDREAMPAY"

// AdminSeedreampayHandler exposes admin-only read endpoints restricted to the
// SEEDREAMPAY product ProviderCode via an inner join on Products.
type AdminSeedreampayHandler struct {
	db *gorm.DB
}

// NewAdminSeedreampayHandler constructs an admin handler over the given DB.
func NewAdminSeedreampayHandler(db *gorm.DB) *AdminSeedreampayHandler {
	return &AdminSeedreampayHandler{db: db}
}

// seedreampayAdminRow is the narrow projection returned by admin endpoints.
// Fields are chosen to expose enough data for ops diagnostics without leaking
// any secret material (SecretHash, PinCode, PinHash are deliberately absent).
type seedreampayAdminRow struct {
	ID              int        `json:"id" gorm:"column:Id"`
	SerialNo        *string    `json:"serialNo" gorm:"column:SerialNo"`
	Status          string     `json:"status" gorm:"column:Status"`
	ProductID       int        `json:"productId" gorm:"column:ProductId"`
	OrderID         *int       `json:"orderId" gorm:"column:OrderId"`
	CreatedAt       time.Time  `json:"createdAt" gorm:"column:CreatedAt"`
	SoldAt          *time.Time `json:"soldAt" gorm:"column:SoldAt"`
	UsedAt          *time.Time `json:"usedAt" gorm:"column:UsedAt"`
	ExpiredAt       *time.Time `json:"expiredAt" gorm:"column:ExpiredAt"`
	RedeemedOrderID *int       `json:"redeemedOrderId" gorm:"column:RedeemedOrderId"`
	RedeemedIP      *string    `json:"redeemedIp" gorm:"column:RedeemedIp"`
}

// ListVouchers handles GET /admin/seedreampay/vouchers with paging + filters.
// Filters supported: status, serialNo, productId. Always restricted to rows
// whose Product.ProviderCode = 'SEEDREAMPAY'.
func (h *AdminSeedreampayHandler) ListVouchers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	status := c.Query("status")
	serialNo := c.Query("serialNo")
	productIDStr := c.Query("productId")

	// Base query restricted to SEEDREAMPAY provider. Using Joins against the
	// concrete "Products" alias keeps column names unambiguous.
	baseCols := `"VoucherCodes"."Id", "VoucherCodes"."SerialNo", "VoucherCodes"."Status",
		"VoucherCodes"."ProductId", "VoucherCodes"."OrderId",
		"VoucherCodes"."CreatedAt", "VoucherCodes"."SoldAt", "VoucherCodes"."UsedAt",
		"VoucherCodes"."ExpiredAt", "VoucherCodes"."RedeemedOrderId", "VoucherCodes"."RedeemedIp"`

	q := h.db.WithContext(c.Request.Context()).
		Table(`"VoucherCodes"`).
		Joins(`JOIN "Products" ON "Products"."Id" = "VoucherCodes"."ProductId"`).
		Where(`"Products"."ProviderCode" = ?`, sdpProviderCodeAdmin)

	if status != "" {
		q = q.Where(`"VoucherCodes"."Status" = ?`, status)
	}
	if serialNo != "" {
		q = q.Where(`"VoucherCodes"."SerialNo" = ?`, serialNo)
	}
	if productIDStr != "" {
		if pid, err := strconv.Atoi(productIDStr); err == nil && pid > 0 {
			q = q.Where(`"VoucherCodes"."ProductId" = ?`, pid)
		}
	}

	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		response.InternalServerError(c, "목록 조회 실패")
		return
	}

	var rows []seedreampayAdminRow
	err := q.Session(&gorm.Session{}).
		Select(baseCols).
		Order(`"VoucherCodes"."CreatedAt" DESC`).
		Limit(limit).
		Offset((page - 1) * limit).
		Scan(&rows).Error
	if err != nil {
		response.InternalServerError(c, "목록 조회 실패")
		return
	}
	if rows == nil {
		rows = []seedreampayAdminRow{}
	}

	response.Success(c, gin.H{
		"items": rows,
		"page":  page,
		"limit": limit,
		"total": total,
	})
}

// GetVoucher handles GET /admin/seedreampay/vouchers/:serialNo.
func (h *AdminSeedreampayHandler) GetVoucher(c *gin.Context) {
	serial := c.Param("serialNo")
	if serial == "" {
		response.BadRequest(c, "serialNo는 필수입니다")
		return
	}
	baseCols := `"VoucherCodes"."Id", "VoucherCodes"."SerialNo", "VoucherCodes"."Status",
		"VoucherCodes"."ProductId", "VoucherCodes"."OrderId",
		"VoucherCodes"."CreatedAt", "VoucherCodes"."SoldAt", "VoucherCodes"."UsedAt",
		"VoucherCodes"."ExpiredAt", "VoucherCodes"."RedeemedOrderId", "VoucherCodes"."RedeemedIp"`

	var row seedreampayAdminRow
	err := h.db.WithContext(c.Request.Context()).
		Table(`"VoucherCodes"`).
		Select(baseCols).
		Joins(`JOIN "Products" ON "Products"."Id" = "VoucherCodes"."ProductId"`).
		Where(`"Products"."ProviderCode" = ? AND "VoucherCodes"."SerialNo" = ?`, sdpProviderCodeAdmin, serial).
		Scan(&row).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		response.InternalServerError(c, "조회 실패")
		return
	}
	// Gorm .Scan doesn't raise ErrRecordNotFound — detect via empty PK.
	if row.ID == 0 {
		response.NotFound(c, "바우처를 찾을 수 없습니다")
		return
	}
	response.Success(c, row)
}
