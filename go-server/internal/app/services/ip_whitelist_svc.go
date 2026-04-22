package services

import (
	"net"
	"strings"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"

	"gorm.io/gorm"
)

// IPWhitelistService handles CRUD for per-user IP whitelist entries.
type IPWhitelistService struct {
	db *gorm.DB
}

func NewIPWhitelistService(db *gorm.DB) *IPWhitelistService {
	return &IPWhitelistService{db: db}
}

// GetEntries returns all whitelist entries for a user.
func (s *IPWhitelistService) GetEntries(userID int) ([]domain.IPWhitelistEntry, error) {
	var entries []domain.IPWhitelistEntry
	err := s.db.Where("UserId = ?", userID).Order("Id DESC").Find(&entries).Error
	return entries, err
}

// AddEntry adds an IP to the user's whitelist.
func (s *IPWhitelistService) AddEntry(userID int, ip string, description string) (*domain.IPWhitelistEntry, error) {
	ip = strings.TrimSpace(ip)
	if !isValidIP(ip) {
		return nil, apperror.Validationf("유효하지 않은 IP 주소입니다: %s", ip)
	}

	// Check duplicate
	var count int64
	s.db.Model(&domain.IPWhitelistEntry{}).Where("UserId = ? AND IpAddress = ?", userID, ip).Count(&count)
	if count > 0 {
		return nil, apperror.Conflict("이미 등록된 IP 주소입니다")
	}

	entry := &domain.IPWhitelistEntry{
		UserID:      userID,
		IpAddress:   ip,
		Description: strings.TrimSpace(description),
	}
	if err := s.db.Create(entry).Error; err != nil {
		return nil, err
	}
	return entry, nil
}

// DeleteEntry removes an entry if it belongs to the user.
func (s *IPWhitelistService) DeleteEntry(userID int, entryID int) error {
	result := s.db.Where("Id = ? AND UserId = ?", entryID, userID).Delete(&domain.IPWhitelistEntry{})
	if result.RowsAffected == 0 {
		return apperror.NotFound("항목을 찾을 수 없습니다")
	}
	return result.Error
}

// SetEnabled toggles IP whitelist enforcement for a user.
func (s *IPWhitelistService) SetEnabled(userID int, enabled bool) error {
	return s.db.Model(&domain.User{}).Where("Id = ?", userID).
		Update("IpWhitelistEnabled", enabled).Error
}

// GetEnabled returns whether IP whitelist is enabled for a user.
func (s *IPWhitelistService) GetEnabled(userID int) (bool, error) {
	var user struct{ IpWhitelistEnabled bool }
	err := s.db.Model(&domain.User{}).Select("IpWhitelistEnabled").Where("Id = ?", userID).Scan(&user).Error
	return user.IpWhitelistEnabled, err
}

// IsIPAllowed checks if the given IP is allowed for the user.
// Returns true if whitelist is disabled OR the IP is in the whitelist.
func (s *IPWhitelistService) IsIPAllowed(userID int, clientIP string) (bool, error) {
	enabled, err := s.GetEnabled(userID)
	if err != nil || !enabled {
		return true, err
	}

	var count int64
	err = s.db.Model(&domain.IPWhitelistEntry{}).
		Where("UserId = ? AND IpAddress = ?", userID, clientIP).
		Count(&count).Error
	return count > 0, err
}

func isValidIP(ip string) bool {
	// Support single IP (v4/v6)
	if parsed := net.ParseIP(ip); parsed != nil {
		return true
	}
	// Support CIDR notation
	if _, _, err := net.ParseCIDR(ip); err == nil {
		return true
	}
	return false
}
