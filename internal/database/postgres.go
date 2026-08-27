package database

import (
	"fmt"

	"github.com/yourusername/url-shortener/internal/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func NewPostgres(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	if err := db.AutoMigrate(&model.User{}, &model.URL{}, &model.Click{}); err != nil {
		return nil, fmt.Errorf("migrate postgres: %w", err)
	}

	return db, nil
}
