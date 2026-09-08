# 3-Tier Application (Client, API, MySQL)

A modern full-stack 3-Tier CRUD application featuring a React frontend, Node.js/Express REST API, and MySQL database with role-based access control (RBAC) and JWT authentication.

---

## 🏛 Architecture Overview

```
                 +-----------------------+
                 |  Client Tier (React)  |
                 |  Nginx on Port 80     |
                 +-----------+-----------+
                             |
                   /api/     | (REST HTTP)
                             v
                 +-----------------------+
                 |   API Tier (Express)  |
                 |   Node.js on Port 5000|
                 +-----------+-----------+
                             |
                  Port 3306  | (MySQL Protocol)
                             v
                 +-----------------------+
                 |  Database Tier (MySQL)|
                 |  MySQL 8.0 on Port 3306|
                 +-----------------------+
```

- **Frontend (`client`)**: React 19 Single Page App with `react-router-dom`, Axios with token interceptor, and AuthContext. Packaged with multi-stage Docker build served via NGINX.
- **Backend (`api`)**: Express.js REST API providing JWT authentication, bcrypt password hashing, automatic schema migration (`users` table), automatic admin seeding, and role-based endpoints (`admin` vs `viewer`).
- **Database (`mysql`)**: MySQL 8.0 instance storing persistent user credentials and metadata.

---

## 🚀 Quick Start (Local Docker Compose)

The easiest way to run the entire 3-tier stack locally:

```bash
docker compose up --build
```

- **Frontend UI**: [http://localhost](http://localhost)
- **API Health**: [http://localhost:5000/health](http://localhost:5000/health)
- **Default Admin Account**:
  - **Email**: `admin@example.com`
  - **Password**: `admin123`

---

## 🛠 Manual Local Development

### 1. Database (MySQL)
Ensure MySQL is running on port 3306 with a database named `crud_app`.

### 2. Backend (`api`)
```bash
cd api
cp .env.example .env
npm install
npm start
```
The API will start at `http://localhost:5000` and automatically create the required database tables.

### 3. Frontend (`client`)
```bash
cd client
cp .env.example .env
npm install
npm start
```
The React development server will start at `http://localhost:3000`.

---

## 📡 API Endpoints

### Authentication (`/api/auth` or `/auth`)
- `POST /register`: Register a new user (`name`, `email`, `password`)
- `POST /login`: Log in and obtain JWT token (`email`, `password`)

### Users (`/api/users` or `/users`)
- `GET /`: List all users (Requires Bearer token, Admin or Viewer)
- `POST /`: Create a new user (Requires Bearer token, Admin or Viewer)
- `PUT /:id`: Update user by ID (Requires Bearer token, Admin only)
- `DELETE /:id`: Delete user by ID (Requires Bearer token, Admin only)

### Health Check
- `GET /health` or `GET /api/health`: System liveness check (`{"status": "ok"}`)
