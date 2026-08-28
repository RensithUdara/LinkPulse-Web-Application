<div align="center">
  <img src="./logo.png" alt="LinkPulse logo" width="140" />

  # 🔗 LinkPulse

  ### Smart short links with analytics, authentication, QR sharing, and a modern React dashboard.

  [![Go](https://img.shields.io/badge/Go-1.23+-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev/)
  [![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
</div>

---

## ✨ Overview

**LinkPulse** is a full-stack URL shortener web application built with a Go backend and a React frontend. It lets users create short links, manage custom aliases, generate QR codes, track clicks, inspect analytics, and manage their account from a modern dashboard.

This project is designed as a portfolio-ready full-stack application with real backend APIs, database persistence, JWT authentication, frontend state, and analytics tracking.

---

## 🚀 Features

- 🔐 **User authentication** with register, login, JWT tokens, profile loading, and password change
- 🔗 **Short link creation** from long destination URLs
- 🏷️ **Custom aliases** for branded short URLs
- ⏰ **Optional expiry dates** for temporary campaign links
- 📋 **Link management dashboard** with search, filters, sorting, copy, open, favorite, and delete actions
- 📊 **Analytics dashboard** with total clicks, unique visitors, daily click trends, devices, browsers, countries, operating systems, and referrers
- 📱 **QR code generation** for every short link
- 🧹 **Clear expired links** from the frontend
- 🌙 **Dark mode toggle**
- 📱 **Responsive frontend** for desktop, tablet, and mobile screens
- ⚡ **Redis support** for redirect cache and rate limiting
- 🐘 **PostgreSQL persistence** with GORM models
- 🐳 **Docker Compose setup** for frontend, backend, PostgreSQL, and Redis

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go, Gin |
| Database | PostgreSQL |
| ORM | GORM |
| Cache / Rate Limit | Redis |
| Auth | JWT, bcrypt |
| Frontend | React, TypeScript, Vite |
| Icons | lucide-react |
| QR Codes | qrcode.react |
| DevOps | Docker Compose |

---

## 📁 Project Structure

```text
.
├── cmd/
│   └── server/              # Go application entry point
├── internal/
│   ├── app/                 # Gin server setup, routes, CORS
│   ├── config/              # Environment config loader
│   ├── database/            # PostgreSQL and Redis connections
│   ├── handler/             # HTTP handlers
│   ├── middleware/          # Auth and rate limit middleware
│   ├── model/               # GORM models
│   ├── repository/          # Database access layer
│   └── service/             # Business logic
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # React application UI
│   │   ├── api.ts           # Frontend API client
│   │   ├── styles.css       # Full dashboard styling
│   │   └── assets/          # Frontend logo/assets
│   └── package.json
├── docker-compose.yml
├── .env.example
├── logo.png
└── README.md
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
PORT=8080
BASE_URL=http://localhost:8080
DATABASE_URL=postgres://urlshortener:password@localhost:5432/urlshortener?sslmode=disable
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
JWT_SECRET=replace-with-a-long-random-secret
CACHE_TTL_SECONDS=3600
RATE_LIMIT_PER_MIN=120
FRONTEND_ORIGIN=http://localhost:5173
```

> 🔒 For production, change `JWT_SECRET` to a long random value and do not commit your real `.env` file.

---

## 🐳 Quick Start With Docker

Run the full app stack:

```bash
docker compose up --build
```

Then open:

- 🌐 Frontend: `http://localhost:5173`
- 🧠 Backend API: `http://localhost:8080`
- ✅ Health check: `http://localhost:8080/health`

Docker Compose starts:

- React frontend
- Go API
- PostgreSQL
- Redis

---

## 💻 Manual Local Setup

### 1. Clone the project

```bash
git clone https://github.com/RensithUdara/LinkPulse-Web-Application.git
cd LinkPulse-Web-Application
```

### 2. Install Go dependencies

```bash
go mod download
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Create `.env`

Copy `.env.example` to `.env`, then update database and Redis settings if needed.

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

---

## 🐘 PostgreSQL Setup

If you are not using Docker, create the database manually.

### Login as PostgreSQL admin

```powershell
$env:PGPASSWORD='your-postgres-admin-password'
psql -U postgres -h localhost -d postgres
```

### Create database and user

```sql
CREATE DATABASE urlshortener;
CREATE USER urlshortener WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE urlshortener TO urlshortener;
\c urlshortener
GRANT ALL ON SCHEMA public TO urlshortener;
\q
```

### Test the connection

```powershell
$env:PGPASSWORD='password'
psql -U urlshortener -h localhost -d urlshortener -c "SELECT current_user, current_database();"
```

Expected output:

```text
current_user | current_database
-------------+------------------
urlshortener | urlshortener
```

---

## 🧠 Redis Setup

Redis is used for redirect caching and rate limiting.

With Docker:

```bash
docker compose up redis
```

If Redis is not running, the backend can still start and continue without cache:

```text
redis unavailable, continuing without cache
```

For best performance, keep Redis running.

---

## ▶️ Run The Backend

From the project root:

```bash
go run ./cmd/server
```

Expected routes include:

```text
GET    /health
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/password
POST   /api/urls
GET    /api/urls
GET    /api/urls/:id
DELETE /api/urls/:id
GET    /api/urls/:id/analytics
GET    /:shortCode
```

Test backend:

```bash
curl http://localhost:8080/health
```

Expected:

```json
{"status":"ok"}
```

---

## 🎨 Run The Frontend

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

The frontend expects the backend at:

```text
http://localhost:8080
```

You can override it with:

```env
VITE_API_BASE_URL=http://localhost:8080
```

---

## 📡 API Documentation

### ✅ Health Check

```http
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

### 📝 Register

```http
POST /api/auth/register
Content-Type: application/json
```

Body:

```json
{
  "email": "you@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "you@example.com",
    "created_at": "2026-08-28T00:00:00Z",
    "updated_at": "2026-08-28T00:00:00Z"
  },
  "token": "jwt-token"
}
```

### 🔑 Login

```http
POST /api/auth/login
Content-Type: application/json
```

Body:

```json
{
  "email": "you@example.com",
  "password": "password123"
}
```

Response includes a JWT token.

### 👤 Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 🔒 Change Password

```http
PUT /api/auth/password
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "current_password": "password123",
  "new_password": "newpassword123"
}
```

### 🔗 Create Short URL

```http
POST /api/urls
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "original_url": "https://example.com/products/12345",
  "custom_alias": "launch-offer",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

Notes:

- `custom_alias` is optional
- `expires_at` is optional
- Passwords must be at least 8 characters and include a letter and a number

Response:

```json
{
  "id": "uuid",
  "original_url": "https://example.com/products/12345",
  "short_code": "launch-offer",
  "short_url": "http://localhost:8080/launch-offer",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

### 📚 List URLs

```http
GET /api/urls
Authorization: Bearer <token>
```

### 🔍 Get URL

```http
GET /api/urls/:id
Authorization: Bearer <token>
```

### 🗑️ Delete URL

```http
DELETE /api/urls/:id
Authorization: Bearer <token>
```

Success response:

```text
204 No Content
```

### 📊 Get Analytics

```http
GET /api/urls/:id/analytics
Authorization: Bearer <token>
```

Response includes:

- Total clicks
- Unique visitors
- Clicks by day
- Countries
- Devices
- Browsers
- Operating systems
- Referrers

### 🚀 Redirect Short Link

```http
GET /:shortCode
```

Example:

```text
http://localhost:8080/launch-offer
```

The API redirects to the original URL and records click analytics.

---

## 🧪 Testing

Run Go tests:

```bash
go test ./...
```

Build frontend:

```bash
cd frontend
npm run build
```

Run frontend lint:

```bash
cd frontend
npm run lint
```

---

## 🖼️ UI Highlights

The frontend includes:

- 🧭 Fixed sidebar navigation
- 🔎 Global search bar
- 📈 Overview metrics
- 🔗 Link library screen
- 📊 Analytics screen with graphs and breakdown rows
- 👤 Account/profile screen
- 🌙 Dark mode
- 📱 Mobile responsive layouts
- 🧊 3D-style card depth and hover effects

---

## 🧯 Troubleshooting

### ❌ `GET /api/auth/me 404`

This means the backend process running on `localhost:8080` is old or not started from the current project.

Fix:

```bash
go run ./cmd/server
```

When the route exists, calling it without a token should return:

```json
{"error":"missing bearer token"}
```

That `401` response is correct.

### ❌ CORS error from frontend

Make sure `.env` has:

```env
FRONTEND_ORIGIN=http://localhost:5173
```

Then restart the backend.

### ❌ PostgreSQL password authentication failed

Reset the app database user password:

```sql
ALTER USER urlshortener WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE urlshortener TO urlshortener;
\c urlshortener
GRANT ALL ON SCHEMA public TO urlshortener;
```

Then update `.env`:

```env
DATABASE_URL=postgres://urlshortener:password@localhost:5432/urlshortener?sslmode=disable
```

### ⚠️ Redis connection refused

Start Redis:

```bash
docker compose up redis
```

The backend can run without Redis, but caching/rate-limit storage will be unavailable.

### ❌ Frontend cannot connect to backend

Check both servers:

```bash
curl http://localhost:8080/health
```

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## 🔐 Security Notes

- Passwords are hashed with bcrypt
- Auth uses JWT bearer tokens
- Protected endpoints require `Authorization: Bearer <token>`
- Rate limiting is enabled through Redis middleware
- Never commit real `.env` secrets
- Use HTTPS in production

---

## 🚀 Production Notes

Before deploying:

- Replace `JWT_SECRET`
- Use managed PostgreSQL
- Use managed Redis
- Set production `BASE_URL`
- Set production `FRONTEND_ORIGIN`
- Enable HTTPS
- Configure trusted proxy settings if behind a reverse proxy

Example production-style environment:

```env
PORT=8080
BASE_URL=https://your-domain.com
DATABASE_URL=postgres://user:password@host:5432/dbname?sslmode=require
REDIS_ADDR=redis-host:6379
JWT_SECRET=your-long-random-secret
FRONTEND_ORIGIN=https://your-frontend-domain.com
GIN_MODE=release
```

---

## 👨‍💻 Author

Built by **Rensith Udara**.

GitHub: [RensithUdara/LinkPulse-Web-Application](https://github.com/RensithUdara/LinkPulse-Web-Application)

---

## ⭐ Project Goal

LinkPulse demonstrates a complete full-stack application with backend API design, authentication, database modeling, analytics processing, frontend state management, responsive UI design, and Docker-based local development.

It is suitable for learning, portfolio presentation, and extending into a production-ready SaaS-style URL shortener.
