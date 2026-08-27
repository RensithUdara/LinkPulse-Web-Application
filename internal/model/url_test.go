package model

import (
	"testing"
	"time"
)

func TestURLExpired(t *testing.T) {
	now := time.Date(2026, 8, 27, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Minute)
	future := now.Add(time.Minute)

	if !(URL{ExpiresAt: &past}).Expired(now) {
		t.Fatal("expected URL with past expiry to be expired")
	}
	if (URL{ExpiresAt: &future}).Expired(now) {
		t.Fatal("expected URL with future expiry to be active")
	}
	if (URL{}).Expired(now) {
		t.Fatal("expected URL without expiry to be active")
	}
}
