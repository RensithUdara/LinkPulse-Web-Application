package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port             string
	BaseURL          string
	DatabaseURL      string
	RedisAddr        string
	RedisPassword    string
	RedisDB          int
	JWTSecret        string
	CacheTTL         time.Duration
	RateLimitPerMin  int
	TrustedProxyCIDR string
	FrontendOrigin   string
}

func Load() Config {
	loadDotEnv(".env")

	return Config{
		Port:             getEnv("PORT", "8080"),
		BaseURL:          trimRightSlash(getEnv("BASE_URL", "http://localhost:8080")),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://urlshortener:password@localhost:5432/urlshortener?sslmode=disable"),
		RedisAddr:        getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:    getEnv("REDIS_PASSWORD", ""),
		RedisDB:          getEnvInt("REDIS_DB", 0),
		JWTSecret:        getEnv("JWT_SECRET", "change-me-in-production"),
		CacheTTL:         time.Duration(getEnvInt("CACHE_TTL_SECONDS", 3600)) * time.Second,
		RateLimitPerMin:  getEnvInt("RATE_LIMIT_PER_MIN", 120),
		TrustedProxyCIDR: getEnv("TRUSTED_PROXY_CIDR", ""),
		FrontendOrigin:   getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
	}
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key != "" {
			_ = os.Setenv(key, value)
		}
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func trimRightSlash(value string) string {
	for len(value) > 1 && value[len(value)-1] == '/' {
		value = value[:len(value)-1]
	}
	return value
}
