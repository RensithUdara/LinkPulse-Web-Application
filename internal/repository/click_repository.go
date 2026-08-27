package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/yourusername/url-shortener/internal/model"
	"gorm.io/gorm"
)

type ClickRepository struct {
	db *gorm.DB
}

func NewClickRepository(db *gorm.DB) *ClickRepository {
	return &ClickRepository{db: db}
}

func (r *ClickRepository) Create(click *model.Click) error {
	return r.db.Create(click).Error
}

func (r *ClickRepository) Count(urlID uuid.UUID) (int64, error) {
	var count int64
	if err := r.db.Model(&model.Click{}).Where("url_id = ?", urlID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *ClickRepository) CountUniqueVisitors(urlID uuid.UUID) (int64, error) {
	var count int64
	if err := r.db.Model(&model.Click{}).Where("url_id = ?", urlID).Distinct("ip_hash").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

type LabelCount struct {
	Label string `json:"label"`
	Count int64  `json:"count"`
}

type DailyCount struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

func (r *ClickRepository) CountByField(urlID uuid.UUID, field string, limit int) ([]LabelCount, error) {
	var rows []LabelCount
	if err := r.db.Model(&model.Click{}).
		Select(field+" AS label, count(*) AS count").
		Where("url_id = ?", urlID).
		Group(field).
		Order("count desc").
		Limit(limit).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *ClickRepository) CountByDay(urlID uuid.UUID) ([]DailyCount, error) {
	var rows []DailyCount
	if err := r.db.Model(&model.Click{}).
		Select("to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, count(*) AS count").
		Where("url_id = ? AND created_at >= ?", urlID, time.Now().AddDate(0, 0, -30)).
		Group("date_trunc('day', created_at)").
		Order("date ASC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}
