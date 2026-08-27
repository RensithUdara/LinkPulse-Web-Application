package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type URL struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID      *uuid.UUID `gorm:"type:uuid;index" json:"user_id,omitempty"`
	User        *User      `gorm:"constraint:OnDelete:SET NULL" json:"-"`
	OriginalURL string     `gorm:"not null" json:"original_url"`
	ShortCode   string     `gorm:"uniqueIndex;not null" json:"short_code"`
	CustomAlias string     `gorm:"index" json:"custom_alias,omitempty"`
	ClickCount  int64      `gorm:"not null;default:0" json:"click_count"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

func (u *URL) BeforeCreate(_ *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

func (u URL) Expired(now time.Time) bool {
	return u.ExpiresAt != nil && now.After(*u.ExpiresAt)
}
