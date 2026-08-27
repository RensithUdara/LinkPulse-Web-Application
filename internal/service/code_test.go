package service

import "testing"

func TestGenerateShortCode(t *testing.T) {
	code, err := GenerateShortCode(7)
	if err != nil {
		t.Fatalf("GenerateShortCode returned error: %v", err)
	}
	if len(code) != 7 {
		t.Fatalf("expected code length 7, got %d", len(code))
	}
	for _, char := range code {
		if !containsRune(charset, char) {
			t.Fatalf("code contains invalid character %q", char)
		}
	}
}

func TestGenerateShortCodeRejectsInvalidLength(t *testing.T) {
	if _, err := GenerateShortCode(0); err == nil {
		t.Fatal("expected invalid length error")
	}
}

func TestValidAlias(t *testing.T) {
	tests := map[string]bool{
		"abc":       true,
		"my-link":   true,
		"my_link_1": true,
		"ab":        false,
		"bad link":  false,
		"bad/link":  false,
	}

	for alias, want := range tests {
		if got := ValidAlias(alias); got != want {
			t.Fatalf("ValidAlias(%q) = %v, want %v", alias, got, want)
		}
	}
}

func TestStrongPassword(t *testing.T) {
	tests := map[string]bool{
		"abc12345":    true,
		"Password1":   true,
		"short1":      false,
		"onlyletters": false,
		"12345678":    false,
	}

	for password, want := range tests {
		if got := StrongPassword(password); got != want {
			t.Fatalf("StrongPassword(%q) = %v, want %v", password, got, want)
		}
	}
}

func containsRune(value string, needle rune) bool {
	for _, char := range value {
		if char == needle {
			return true
		}
	}
	return false
}
