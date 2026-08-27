# URL Shortener + Analytics

A portfolio-ready Go backend for shortening URLs, redirecting visitors, and collecting click analytics.

## Stack

- Go + Gin REST API
- PostgreSQL persistence with GORM
- Redis redirect cache and rate limiting
- JWT authentication
- Docker Compose local development
- Go tests for core service behavior

## Quick Start

```bash
docker compose up --build
```

The API runs on `http://localhost:8080`.

## Local Development

Start PostgreSQL and Redis:

```bash
docker compose up postgres redis
```

Run the API:

```bash
go run ./cmd/server
```

Run tests:

```bash
go test ./...
```

## API

### Health

```http
GET /health
```

### Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "password123"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "password123"
}
```

Both auth endpoints return a JWT token.

### Create Short URL

```http
POST /api/urls
Authorization: Bearer <token>
Content-Type: application/json

{
  "original_url": "https://example.com/products/12345",
  "custom_alias": "my-product",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

`custom_alias` and `expires_at` are optional.

### Redirect

```http
GET /my-product
```

Returns `302 Found` and records a click event.

### Manage URLs

```http
GET    /api/urls
GET    /api/urls/:id
DELETE /api/urls/:id
```

All require `Authorization: Bearer <token>`.

### Analytics

```http
GET /api/urls/:id/analytics
Authorization: Bearer <token>
```

Returns total clicks, unique visitors, clicks by day, and grouped analytics by country, device, browser, OS, and referrer.

## Environment

Copy `.env.example` values into your shell or Compose environment and change `JWT_SECRET` before using this outside local development.
