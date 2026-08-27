package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/url-shortener/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
}

type authRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorJSON(c, http.StatusBadRequest, err.Error())
		return
	}

	user, token, err := h.auth.Register(req.Email, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrEmailTaken) {
			errorJSON(c, http.StatusConflict, err.Error())
			return
		}
		errorJSON(c, http.StatusBadRequest, err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": user, "token": token})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorJSON(c, http.StatusBadRequest, err.Error())
		return
	}

	user, token, err := h.auth.Login(req.Email, req.Password)
	if err != nil {
		errorJSON(c, http.StatusUnauthorized, "invalid email or password")
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
}
