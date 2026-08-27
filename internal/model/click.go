package model

import (
	"time"

	"github.com/google/uuid"
)

type Click struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	URLID     uuid.UUID `gorm:"type:uuid;index;not null" json:"url_id"`
	URL       URL       `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	IPHash    string    `gorm:"index;not null" json:"ip_hash"`
	Country   string    `json:"country"`
	Device    string    `gorm:"index" json:"device"`
	Browser   string    `gorm:"index" json:"browser"`
	OS        string    `gorm:"index" json:"os"`
	Referrer  string    `json:"referrer"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

func (c *Click) BeforeCreate(_ interface{}) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
