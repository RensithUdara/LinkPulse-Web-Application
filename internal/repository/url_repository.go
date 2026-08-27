package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/yourusername/url-shortener/internal/model"
	"gorm.io/gorm"
)

type URLRepository struct {
	db *gorm.DB
}

func NewURLRepository(db *gorm.DB) *URLRepository {
	return &URLRepository{db: db}
}

func (r *URLRepository) Create(url *model.URL) error {
	return r.db.Create(url).Error
}

func (r *URLRepository) ExistsByShortCode(shortCode string) (bool, error) {
	var count int64
	if err := r.db.Model(&model.URL{}).Where("short_code = ?", shortCode).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *URLRepository) FindByShortCode(shortCode string) (*model.URL, error) {
	var url model.URL
	if err := r.db.Where("short_code = ?", shortCode).First(&url).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &url, nil
}

func (r *URLRepository) FindByIDForUser(id, userID uuid.UUID) (*model.URL, error) {
	var url model.URL
	if err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&url).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &url, nil
}

func (r *URLRepository) ListByUser(userID uuid.UUID) ([]model.URL, error) {
	var urls []model.URL
	if err := r.db.Where("user_id = ?", userID).Order("created_at desc").Find(&urls).Error; err != nil {
		return nil, err
	}
	return urls, nil
}

func (r *URLRepository) DeleteForUser(id, userID uuid.UUID) error {
	result := r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.URL{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *URLRepository) IncrementClickCount(id uuid.UUID) error {
	return r.db.Model(&model.URL{}).Where("id = ?", id).UpdateColumn("click_count", gorm.Expr("click_count + ?", 1)).Error
}
