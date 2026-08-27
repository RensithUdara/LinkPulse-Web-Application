package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/yourusername/url-shortener/internal/middleware"
	"github.com/yourusername/url-shortener/internal/repository"
	"github.com/yourusername/url-shortener/internal/service"
)

type AnalyticsHandler struct {
	analytics *service.AnalyticsService
}

func NewAnalyticsHandler(analytics *service.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{analytics: analytics}
}

func (h *AnalyticsHandler) Get(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errorJSON(c, http.StatusBadRequest, "invalid url id")
		return
	}

	analytics, err := h.analytics.ForURL(id, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			errorJSON(c, http.StatusNotFound, "url not found")
			return
		}
		errorJSON(c, http.StatusInternalServerError, "could not load analytics")
		return
	}
	c.JSON(http.StatusOK, analytics)
}
