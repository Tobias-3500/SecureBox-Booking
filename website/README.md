# Serenity Salon - Booking System

A beautiful, modern booking appointment system for a small haircut salon with soothing colors and smooth animations.

## Features

- ✨ Beautiful, modern UI with soothing color palette
- 📅 Easy appointment booking system
- 🎨 Service display with pricing and duration
- ⏰ Real-time availability checking
- 🐳 Docker Compose setup for easy deployment
- 📱 Responsive design for all devices

## Tech Stack

- **Frontend**: React 18
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Containerization**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Ports 3000, 3001, and 5432 available

### Running the Application

1. Navigate to the project directory:
```bash
cd website
```

2. Start all services with Docker Compose:
```bash
docker-compose up --build
```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database: localhost:5432

### Stopping the Application

```bash
docker-compose down
```

To remove volumes (database data):
```bash
docker-compose down -v
```

## Project Structure

```
website/
├── docker-compose.yml       # Docker Compose configuration
├── backend/
│   ├── Dockerfile          # Backend container configuration
│   ├── package.json        # Backend dependencies
│   ├── server.js           # Express server
│   └── init.sql            # Database initialization
├── frontend/
│   ├── Dockerfile          # Frontend container configuration
│   ├── package.json        # Frontend dependencies
│   ├── nginx.conf          # Nginx configuration
│   └── src/
│       ├── App.js          # Main React component
│       ├── components/     # React components
│       └── ...
└── README.md
```

## API Endpoints

- `GET /api/services` - Get all available services
- `GET /api/availability/:date` - Get booked time slots for a date
- `POST /api/appointments` - Create a new appointment
- `GET /api/appointments` - Get all appointments
- `GET /api/health` - Health check endpoint

## Default Services

The system comes with 6 pre-configured services:
- Haircut
- Haircut & Wash
- Beard Trim
- Haircut & Beard
- Hair Color
- Hair Styling

## Development

### Running Frontend Locally

1. Create a `.env` file in the `frontend` directory:
```bash
cd frontend
echo "REACT_APP_API_URL=http://localhost:3001" > .env
```

2. Install dependencies and start:
```bash
npm install
npm start
```

The frontend will run on http://localhost:3000

### Running Backend Locally

1. Make sure PostgreSQL is running and create a database:
```sql
CREATE DATABASE salon_db;
CREATE USER salon_user WITH PASSWORD 'salon_password';
GRANT ALL PRIVILEGES ON DATABASE salon_db TO salon_user;
```

2. Run the initialization script:
```bash
psql -U salon_user -d salon_db -f init.sql
```

3. Install dependencies and start:
```bash
cd backend
npm install
npm run dev
```

The backend will run on http://localhost:3001

**Note**: When running in Docker, the frontend uses relative API paths that are proxied by nginx. For local development, you need to set `REACT_APP_API_URL` in the frontend `.env` file.

## Color Palette

The design uses a soothing green color palette:
- Primary: #6b9f78 (Sage Green)
- Secondary: #a8d5ba (Mint Green)
- Dark: #2d5016 (Forest Green)
- Light: #e8f5e9 (Light Mint)
- Background: Gradient from #e8f5e9 to #fff9e6

## License

This project is created for demonstration purposes.
