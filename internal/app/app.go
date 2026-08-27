package app

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/yourusername/url-shortener/internal/config"
	"github.com/yourusername/url-shortener/internal/database"
	"github.com/yourusername/url-shortener/internal/handler"
	"github.com/yourusername/url-shortener/internal/middleware"
	"github.com/yourusername/url-shortener/internal/repository"
	"github.com/yourusername/url-shortener/internal/service"
	"gorm.io/gorm"
)

type Server struct {
	cfg    config.Config
	db     *gorm.DB
	cache  *redis.Client
	router *gin.Engine
}

func New(cfg config.Config) (*Server, error) {
	db, err := database.NewPostgres(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}

	var cache *redis.Client
	if redisClient, err := database.NewRedis(context.Background(), cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB); err == nil {
		cache = redisClient
	} else {
		log.Printf("redis unavailable, continuing without cache: %v", err)
	}

	server := &Server{cfg: cfg, db: db, cache: cache}
	server.router = server.routes()
	return server, nil
}

func (s *Server) Run() error {
	return s.router.Run(":" + s.cfg.Port)
}

func (s *Server) routes() *gin.Engine {
	router := gin.Default()
	if s.cfg.TrustedProxyCIDR != "" {
		_ = router.SetTrustedProxies([]string{s.cfg.TrustedProxyCIDR})
	} else {
		_ = router.SetTrustedProxies(nil)
	}
	router.Use(cors(s.cfg.FrontendOrigin))
	router.Use(middleware.RateLimit(s.cache, s.cfg.RateLimitPerMin))

	userRepo := repository.NewUserRepository(s.db)
	urlRepo := repository.NewURLRepository(s.db)
	clickRepo := repository.NewClickRepository(s.db)

	authService := service.NewAuthService(userRepo, s.cfg.JWTSecret)
	urlService := service.NewURLService(urlRepo, clickRepo, s.cache, s.cfg.BaseURL, s.cfg.CacheTTL)
	analyticsService := service.NewAnalyticsService(urlRepo, clickRepo)

	authHandler := handler.NewAuthHandler(authService)
	urlHandler := handler.NewURLHandler(urlService)
	analyticsHandler := handler.NewAnalyticsHandler(analyticsService)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	api := router.Group("/api")
	{
		api.POST("/auth/register", authHandler.Register)
		api.POST("/auth/login", authHandler.Login)

		protected := api.Group("", middleware.Auth(authService))
		{
			protected.GET("/auth/me", authHandler.Me)
			protected.PUT("/auth/password", authHandler.ChangePassword)
			protected.POST("/urls", urlHandler.Create)
			protected.GET("/urls", urlHandler.List)
			protected.GET("/urls/:id", urlHandler.Get)
			protected.DELETE("/urls/:id", urlHandler.Delete)
			protected.GET("/urls/:id/analytics", analyticsHandler.Get)
		}
	}

	router.NoRoute(func(c *gin.Context) {
		path := strings.Trim(c.Request.URL.Path, "/")
		if c.Request.Method == http.MethodGet && path != "" && path != "api" && !strings.HasPrefix(path, "api/") && !strings.Contains(path, "/") {
			c.Params = append(c.Params, gin.Param{Key: "shortCode", Value: path})
			urlHandler.Redirect(c)
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
	})

	return router
}

func cors(frontendOrigin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == frontendOrigin || frontendOrigin == "*" {
			c.Header("Access-Control-Allow-Origin", origin)
		} else if origin == "" {
			c.Header("Access-Control-Allow-Origin", frontendOrigin)
		}
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
