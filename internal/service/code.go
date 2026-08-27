package service

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"regexp"
)

const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

var aliasPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,64}$`)

func GenerateShortCode(length int) (string, error) {
	if length <= 0 {
		return "", fmt.Errorf("length must be positive")
	}

	code := make([]byte, length)
	max := big.NewInt(int64(len(charset)))
	for i := range code {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		code[i] = charset[n.Int64()]
	}
	return string(code), nil
}

func ValidAlias(alias string) bool {
	return aliasPattern.MatchString(alias)
}
