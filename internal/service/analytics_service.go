package service

import (
	"github.com/google/uuid"
	"github.com/yourusername/url-shortener/internal/repository"
)

type AnalyticsService struct {
	urls   *repository.URLRepository
	clicks *repository.ClickRepository
}

type Analytics struct {
	TotalClicks      int64                   `json:"total_clicks"`
	UniqueVisitors   int64                   `json:"unique_visitors"`
	ClicksByDay      []repository.DailyCount `json:"clicks_by_day"`
	Countries        []repository.LabelCount `json:"countries"`
	Devices          []repository.LabelCount `json:"devices"`
	Browsers         []repository.LabelCount `json:"browsers"`
	OperatingSystems []repository.LabelCount `json:"operating_systems"`
	Referrers        []repository.LabelCount `json:"referrers"`
}

func NewAnalyticsService(urls *repository.URLRepository, clicks *repository.ClickRepository) *AnalyticsService {
	return &AnalyticsService{urls: urls, clicks: clicks}
}

func (s *AnalyticsService) ForURL(id, userID uuid.UUID) (*Analytics, error) {
	if _, err := s.urls.FindByIDForUser(id, userID); err != nil {
		return nil, err
	}

	total, err := s.clicks.Count(id)
	if err != nil {
		return nil, err
	}
	unique, err := s.clicks.CountUniqueVisitors(id)
	if err != nil {
		return nil, err
	}
	byDay, err := s.clicks.CountByDay(id)
	if err != nil {
		return nil, err
	}
	countries, err := s.clicks.CountByField(id, "country", 10)
	if err != nil {
		return nil, err
	}
	devices, err := s.clicks.CountByField(id, "device", 10)
	if err != nil {
		return nil, err
	}
	browsers, err := s.clicks.CountByField(id, "browser", 10)
	if err != nil {
		return nil, err
	}
	oses, err := s.clicks.CountByField(id, "os", 10)
	if err != nil {
		return nil, err
	}
	referrers, err := s.clicks.CountByField(id, "referrer", 10)
	if err != nil {
		return nil, err
	}

	return &Analytics{
		TotalClicks:      total,
		UniqueVisitors:   unique,
		ClicksByDay:      byDay,
		Countries:        countries,
		Devices:          devices,
		Browsers:         browsers,
		OperatingSystems: oses,
		Referrers:        referrers,
	}, nil
}
