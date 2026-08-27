package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mssola/useragent"
	"github.com/redis/go-redis/v9"
	"github.com/yourusername/url-shortener/internal/model"
	"github.com/yourusername/url-shortener/internal/repository"
)

var (
	ErrInvalidURL   = errors.New("invalid url")
	ErrAliasTaken   = errors.New("short code or alias already exists")
	ErrURLExpired   = errors.New("url expired")
	ErrURLNotFound  = errors.New("url not found")
	ErrInvalidAlias = errors.New("alias must be 3-64 characters using letters, numbers, underscores, or hyphens")
)

type URLService struct {
	urls     *repository.URLRepository
	clicks   *repository.ClickRepository
	cache    *redis.Client
	baseURL  string
	cacheTTL time.Duration
}

type CreateURLInput struct {
	UserID      *uuid.UUID
	OriginalURL string
	CustomAlias string
	ExpiresAt   *time.Time
}

type ClickInput struct {
	IP        string
	UserAgent string
	Referrer  string
	Country   string
}

func NewURLService(urls *repository.URLRepository, clicks *repository.ClickRepository, cache *redis.Client, baseURL string, cacheTTL time.Duration) *URLService {
	return &URLService{urls: urls, clicks: clicks, cache: cache, baseURL: baseURL, cacheTTL: cacheTTL}
}

func (s *URLService) Create(ctx context.Context, input CreateURLInput) (*model.URL, string, error) {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(input.OriginalURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, "", ErrInvalidURL
	}

	shortCode := strings.TrimSpace(input.CustomAlias)
	if shortCode != "" {
		if !ValidAlias(shortCode) {
			return nil, "", ErrInvalidAlias
		}
		exists, err := s.urls.ExistsByShortCode(shortCode)
		if err != nil {
			return nil, "", err
		}
		if exists {
			return nil, "", ErrAliasTaken
		}
	} else {
		shortCode, err = s.generateUniqueCode()
		if err != nil {
			return nil, "", err
		}
	}

	record := &model.URL{
		UserID:      input.UserID,
		OriginalURL: parsed.String(),
		ShortCode:   shortCode,
		ExpiresAt:   input.ExpiresAt,
	}
	if input.CustomAlias != "" {
		record.CustomAlias = shortCode
	}
	if err := s.urls.Create(record); err != nil {
		return nil, "", err
	}
	s.cacheSet(ctx, shortCode, record.OriginalURL)
	return record, s.ShortURL(shortCode), nil
}

func (s *URLService) Resolve(ctx context.Context, shortCode string, click ClickInput) (string, error) {
	if cached := s.cacheGet(ctx, shortCode); cached != "" {
		urlRecord, err := s.urls.FindByShortCode(shortCode)
		if err == nil && !urlRecord.Expired(time.Now()) {
			_ = s.recordClick(urlRecord, click)
			return cached, nil
		}
	}

	urlRecord, err := s.urls.FindByShortCode(shortCode)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return "", ErrURLNotFound
		}
		return "", err
	}
	if urlRecord.Expired(time.Now()) {
		s.cacheDelete(ctx, shortCode)
		return "", ErrURLExpired
	}

	s.cacheSet(ctx, shortCode, urlRecord.OriginalURL)
	_ = s.recordClick(urlRecord, click)
	return urlRecord.OriginalURL, nil
}

func (s *URLService) ListForUser(userID uuid.UUID) ([]model.URL, error) {
	return s.urls.ListByUser(userID)
}

func (s *URLService) FindForUser(id, userID uuid.UUID) (*model.URL, error) {
	return s.urls.FindByIDForUser(id, userID)
}

func (s *URLService) DeleteForUser(ctx context.Context, id, userID uuid.UUID) error {
	record, err := s.urls.FindByIDForUser(id, userID)
	if err != nil {
		return err
	}
	if err := s.urls.DeleteForUser(id, userID); err != nil {
		return err
	}
	s.cacheDelete(ctx, record.ShortCode)
	return nil
}

func (s *URLService) ShortURL(shortCode string) string {
	return s.baseURL + "/" + shortCode
}

func (s *URLService) generateUniqueCode() (string, error) {
	for i := 0; i < 8; i++ {
		code, err := GenerateShortCode(7)
		if err != nil {
			return "", err
		}
		exists, err := s.urls.ExistsByShortCode(code)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "", fmt.Errorf("could not generate unique short code")
}

func (s *URLService) recordClick(urlRecord *model.URL, input ClickInput) error {
	ua := useragent.New(input.UserAgent)
	browser, _ := ua.Browser()
	device := "desktop"
	if ua.Mobile() {
		device = "mobile"
	}
	if ua.Bot() {
		device = "bot"
	}

	click := &model.Click{
		URLID:    urlRecord.ID,
		IPHash:   hashIP(input.IP),
		Country:  emptyToUnknown(input.Country),
		Device:   device,
		Browser:  emptyToUnknown(browser),
		OS:       emptyToUnknown(ua.OS()),
		Referrer: input.Referrer,
	}

	if err := s.clicks.Create(click); err != nil {
		return err
	}
	return s.urls.IncrementClickCount(urlRecord.ID)
}

func hashIP(ip string) string {
	parsed := net.ParseIP(ip)
	if parsed != nil {
		ip = parsed.String()
	}
	sum := sha256.Sum256([]byte(ip))
	return hex.EncodeToString(sum[:])
}

func emptyToUnknown(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "unknown"
	}
	return value
}

func (s *URLService) cacheGet(ctx context.Context, shortCode string) string {
	if s.cache == nil {
		return ""
	}
	value, err := s.cache.Get(ctx, cacheKey(shortCode)).Result()
	if err != nil {
		return ""
	}
	return value
}

func (s *URLService) cacheSet(ctx context.Context, shortCode, originalURL string) {
	if s.cache != nil {
		_ = s.cache.Set(ctx, cacheKey(shortCode), originalURL, s.cacheTTL).Err()
	}
}

func (s *URLService) cacheDelete(ctx context.Context, shortCode string) {
	if s.cache != nil {
		_ = s.cache.Del(ctx, cacheKey(shortCode)).Err()
	}
}

func cacheKey(shortCode string) string {
	return "short:" + shortCode
}
