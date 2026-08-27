package handler

import "github.com/gin-gonic/gin"

func errorJSON(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}
