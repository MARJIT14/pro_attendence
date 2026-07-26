# 📋 Pro Attendance System

A secure MERN stack student attendance system with **QR code generation** and **GPS geo-fence verification**.

## ✨ Features

- **JWT-based authentication** for students and teachers
- **Dynamic QR codes** that refresh every 30–60 seconds (configurable)
- **GPS geo-fence** — students must be inside the classroom to mark attendance
- **Duplicate prevention** — one attendance per QR session per student
- **MongoDB persistence** with TTL indexes for auto-expiring sessions
- **Modular, well-commented codebase** ready for production deployment

## 🏗 Tech Stack

| Layer      | Technology          |
|------------|---------------------|
| Frontend   | React 18 (Hooks)    |
| Backend    | Express.js          |
| Database   | MongoDB + Mongoose  |
| Auth       | JWT + bcrypt        |
| QR         | `qrcode` npm package|
| Security   | Helmet, CORS        |

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 18+
- MongoDB running locally (or use Docker)

### 1. Clone & Install

```bash
git clone <repo-url> pro-attendance
cd pro-attendance

# Install root dependencies
npm install

# Install server & client dependencies
cd server && npm install
cd ../client && npm install
cd ..
```

### 2. Configure Environment

Edit `server/.env` — at minimum set:
```bash
MONGO_URI=mongodb://localhost:27017/pro_attendance
JWT_SECRET=your_strong_random_secret_here
```

### 3. Start Development Servers

```bash
# Run both frontend & backend concurrently
npm run dev

# OR run them separately:
cd server && npm run dev    # Backend → http://localhost:5000
cd client && npm start      # Frontend → http://localhost:3000
```

### 4. Seed Test Users (Optional)

Use the login page to register:
- **Teacher**: Register with role "teacher"
- **Student**: Register with role "student"

## 🐳 Docker Deployment

### Build & Run with Docker Compose

```bash
# Start all services (MongoDB + API)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop
docker-compose down
```

### Build & Run Manually

```bash
# Build image
docker build -t pro-attendance .

# Run with MongoDB (adjust MONGO_URI as needed)
docker run -d \
  --name pro-attendance \
  -p 5000:5000 \
  -e MONGO_URI=mongodb://host.docker.internal:27017/pro_attendance \
  -e JWT_SECRET=your_production_secret \
  pro-attendance
```

## ☁️ Cloud Deployment

### Deploy to Render / Railway / Fly.io

1. Push this repo to GitHub/GitLab
2. Connect to your cloud provider
3. Add a **MongoDB Atlas** cluster
4. Set environment variables:
   ```
   NODE_ENV=production
   MONGO_URI=mongodb+srv://<user>:<pass>@cluster.xxxxx.mongodb.net/pro_attendance
   JWT_SECRET=<strong_random_string>
   GEO_LATITUDE=27.7172
   GEO_LONGITUDE=85.3240
   GEO_RADIUS_METERS=50
   QR_TTL_SECONDS=45
   ```

## 📁 Project Structure

```
pro-attendance/
├── server/
│   ├── config/          # DB connection, geo-config
│   ├── middleware/       # JWT auth, role-based access
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express route handlers
│   ├── utils/           # QR helper, crypto utilities
│   ├── server.js        # Entry point
│   └── .env             # Environment variables
├── client/
│   ├── src/
│   │   ├── context/     # Auth context provider
│   │   ├── pages/       # Login, Teacher, Student dashboards
│   │   └── App.js       # Router setup
│   └── public/
├── docker-compose.yml   # Multi-service setup
├── Dockerfile           # Multi-stage build
└── README.md
```

## 🔐 API Endpoints

### Auth
| Method | Endpoint          | Description          | Auth Required |
|--------|-------------------|----------------------|---------------|
| POST   | `/api/auth/register` | Register user      | ❌            |
| POST   | `/api/auth/login`    | Login              | ❌            |
| GET    | `/api/auth/me`       | Get current user   | ✅            |

### QR Sessions
| Method | Endpoint             | Description          | Auth Required |
|--------|----------------------|----------------------|---------------|
| POST   | `/api/qr/generate`   | Generate new QR (teacher) | ✅ (teacher) |
| POST   | `/api/qr/validate`   | Validate QR session (student) | ✅ (student) |

### Attendance
| Method | Endpoint                          | Description               | Auth Required |
|--------|-----------------------------------|---------------------------|---------------|
| POST   | `/api/attendance/mark`            | Mark attendance (student) | ✅ (student)  |
| GET    | `/api/attendance/history`         | Student's history         | ✅ (student)  |
| GET    | `/api/attendance/session/:id`     | View session attendance (teacher) | ✅ (teacher) |

## 🛡 Security Features

- Passwords hashed with **bcrypt** (12 salt rounds)
- JWT with configurable expiry (default 7 days)
- Input validation on all routes (`express-validator`)
- HTTP headers secured via **Helmet**
- CORS enabled for development proxy
- No secrets hardcoded — all via environment variables
- QR sessions expire automatically (TTL index in MongoDB)
- Duplicate attendance prevention (compound unique index)

## 📝 License

MIT — Free for personal and commercial use.

