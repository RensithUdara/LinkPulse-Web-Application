package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func RateLimit(cache *redis.Client, limitPerMinute int) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cache == nil || limitPerMinute <= 0 {
			c.Next()
			return
		}

		key := "rate:" + c.ClientIP()
		ctx := c.Request.Context()
		count, err := cache.Incr(ctx, key).Result()
		if err != nil {
			c.Next()
			return
		}
		if count == 1 {
			_ = cache.Expire(ctx, key, time.Minute).Err()
		}
		if count > int64(limitPerMinute) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
