package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/yourusername/url-shortener/internal/middleware"
	"github.com/yourusername/url-shortener/internal/repository"
	"github.com/yourusername/url-shortener/internal/service"
)

type URLHandler struct {
	urls *service.URLService
}

type createURLRequest struct {
	OriginalURL string     `json:"original_url" binding:"required"`
	CustomAlias string     `json:"custom_alias"`
	ExpiresAt   *time.Time `json:"expires_at"`
}

func NewURLHandler(urls *service.URLService) *URLHandler {
	return &URLHandler{urls: urls}
}

func (h *URLHandler) Create(c *gin.Context) {
	var req createURLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorJSON(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, _ := middleware.UserID(c)
	record, shortURL, err := h.urls.Create(c.Request.Context(), service.CreateURLInput{
		UserID:      &userID,
		OriginalURL: req.OriginalURL,
		CustomAlias: req.CustomAlias,
		ExpiresAt:   req.ExpiresAt,
	})
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrAliasTaken) {
			status = http.StatusConflict
		}
		errorJSON(c, status, err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":           record.ID,
		"original_url": record.OriginalURL,
		"short_code":   record.ShortCode,
		"short_url":    shortURL,
		"expires_at":   record.ExpiresAt,
	})
}

func (h *URLHandler) List(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	urls, err := h.urls.ListForUser(userID)
	if err != nil {
		errorJSON(c, http.StatusInternalServerError, "could not list urls")
		return
	}
	c.JSON(http.StatusOK, urls)
}

func (h *URLHandler) Get(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errorJSON(c, http.StatusBadRequest, "invalid url id")
		return
	}

	record, err := h.urls.FindForUser(id, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			errorJSON(c, http.StatusNotFound, "url not found")
			return
		}
		errorJSON(c, http.StatusInternalServerError, "could not get url")
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": record, "short_url": h.urls.ShortURL(record.ShortCode)})
}

func (h *URLHandler) Delete(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errorJSON(c, http.StatusBadRequest, "invalid url id")
		return
	}

	if err := h.urls.DeleteForUser(c.Request.Context(), id, userID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			errorJSON(c, http.StatusNotFound, "url not found")
			return
		}
		errorJSON(c, http.StatusInternalServerError, "could not delete url")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *URLHandler) Redirect(c *gin.Context) {
	destination, err := h.urls.Resolve(c.Request.Context(), c.Param("shortCode"), service.ClickInput{
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		Referrer:  c.Request.Referer(),
		Country:   c.GetHeader("CF-IPCountry"),
	})
	if err != nil {
		if errors.Is(err, service.ErrURLNotFound) {
			errorJSON(c, http.StatusNotFound, "short url not found")
			return
		}
		if errors.Is(err, service.ErrURLExpired) {
			errorJSON(c, http.StatusGone, "short url expired")
			return
		}
		errorJSON(c, http.StatusInternalServerError, "could not resolve url")
		return
	}

	c.Redirect(http.StatusFound, destination)
}
