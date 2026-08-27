package main

import (
	"log"

	"github.com/yourusername/url-shortener/internal/app"
	"github.com/yourusername/url-shortener/internal/config"
)

func main() {
	cfg := config.Load()

	server, err := app.New(cfg)
	if err != nil {
		log.Fatalf("start application: %v", err)
	}

	if err := server.Run(); err != nil {
		log.Fatalf("run server: %v", err)
	}
}
