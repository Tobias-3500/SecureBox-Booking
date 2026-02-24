# PHP + MariaDB backend (booking API)

## 1) Create the database schema

Run `mariadb/schema.sql` against your MariaDB server (e.g. using phpMyAdmin or the `mysql` CLI).

The schema creates a database named `booking_system` with tables:
- `customers`
- `services`
- `appointments`

## 2) Configure environment variables

Set these environment variables before starting PHP:

- `DB_HOST` (example: `127.0.0.1`)
- `DB_PORT` (default: `3306`)
- `DB_NAME` (default: `booking_system`)
- `DB_USER` (example: `root`)
- `DB_PASSWORD`

## 3) Run the API locally

From the `php-backend` folder:

```powershell
cd "C:\Users\tobia\Desktop\website\website\php-backend"
php -S localhost:3001 -t public
```

## 4) API endpoints

- `GET /api/health`
- `GET /api/services`
- `GET /api/availability/YYYY-MM-DD`
- `POST /api/appointments`

### POST /api/appointments body (JSON)

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "12345678",
  "service_id": 1,
  "appointment_date": "2026-02-18",
  "time_slot": "09:30"
}
```

Optional (only if you later add customer accounts):

```json
{ "password": "at-least-8-chars" }
```

