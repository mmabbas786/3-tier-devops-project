# Project Overview

A production-grade, containerized **3-Tier DevOps Application** comprising a React frontend, a Node.js/Express REST API, and a MySQL relational database, orchestrated with an **Nginx Reverse Proxy**, an automated **Jenkins CI/CD Pipeline**, and an enterprise **Prometheus & Grafana Monitoring Stack**.

This repository serves as a complete demonstration of modern DevOps practices, including infrastructure containerization, reverse proxy routing, multi-stage continuous integration and continuous deployment, automated vulnerability and code quality scanning, telemetry monitoring with alert rules, and cloud deployment on AWS EC2.

### Key Highlights
- **RESTful API**: Node.js/Express backend featuring JWT authentication, role-based access control (RBAC), database health probing, and Prometheus metrics exposition via `prom-client`.
- **Single Page Application**: Responsive React 19 client with token management, user dashboards, and animated components.
- **Microservices Orchestration**: Fully containerized multi-tier architecture with Docker and Docker Compose.
- **Edge Reverse Proxy**: Dedicated Nginx gateway handling SSL termination, API routing, and static asset caching.
- **Continuous Delivery**: End-to-end Jenkins pipeline covering Git checkout, compilation, automated testing, security scanning (GitLeaks, SonarQube, Trivy), image building, container deployment, and automated health checks.
- **Full Observability**: Prometheus scraping container and application metrics with custom alert rules, and Grafana displaying pre-provisioned live telemetry dashboards.
- **Cloud Deployment**: Deployed and operational on AWS EC2 (`http://54.87.253.5`).

---

# API Documentation

The REST API runs on port `5000` internally and is accessible directly or reverse-proxied via Nginx (`http://localhost/api` or `http://localhost:5000`).

## Endpoints Summary

| Method | Endpoint | Description | Auth Required | Success Status | Error Statuses |
|---|---|---|---|---|---|
| `GET` | `/` | API Root / Discovery | No | `200 OK` | `500` |
| `GET` | `/health` | Liveness & Database Health | No | `200 OK` | `503 Service Unavailable` |
| `GET` | `/metrics` | Prometheus Metrics Exposition | No | `200 OK` | `500` |
| `POST` | `/api/auth/register` | Register New User | No | `201 Created` | `400`, `409 Conflict` |
| `POST` | `/api/auth/login` | Authenticate User & Issue JWT | No | `200 OK` | `400`, `401 Unauthorized` |
| `GET` | `/api/users` | List All Users | Bearer Token (Any) | `200 OK` | `401`, `403` |
| `POST` | `/api/users` | Create New User | Bearer Token (Any) | `201 Created` | `400`, `401` |
| `PUT` | `/api/users/:id` | Update User Details | Bearer Token (Admin) | `200 OK` | `400`, `401`, `403`, `404` |
| `DELETE` | `/api/users/:id` | Delete User Account | Bearer Token (Admin) | `200 OK` | `401`, `403`, `404` |

---

## Request/Response Examples

### 1. Root Discovery Endpoint (`GET /`)
**Request:**
```bash
curl -X GET http://localhost:5000/
```
**Response (`200 OK`):**
```json
{
  "status": "ok",
  "message": "Mirza's 3-Tier DevOps REST API is online",
  "version": "1.0.0",
  "timestamp": "2026-09-09T02:00:00.000Z",
  "endpoints": {
    "root": "GET /",
    "health": "GET /health",
    "metrics": "GET /metrics",
    "auth": {
      "register": "POST /api/auth/register",
      "login": "POST /api/auth/login"
    },
    "users": {
      "list": "GET /api/users",
      "create": "POST /api/users",
      "update": "PUT /api/users/:id",
      "delete": "DELETE /api/users/:id"
    }
  }
}
```

### 2. Health Check Endpoint (`GET /health`)
**Request:**
```bash
curl -X GET http://localhost:5000/health
```
**Response (`200 OK`):**
```json
{
  "status": "ok",
  "uptime": 1245.82,
  "timestamp": "2026-09-09T02:00:00.000Z",
  "database": "healthy",
  "memoryUsage": {
    "rss": 49246208,
    "heapTotal": 21852160,
    "heapUsed": 15923840,
    "external": 1823901
  }
}
```

### 3. User Authentication (`POST /api/auth/login`)
**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```
**Response (`200 OK`):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### 4. Fetch Users (`GET /api/users`)
**Request:**
```bash
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```
**Response (`200 OK`):**
```json
[
  {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "created_at": "2026-09-08T14:24:16.000Z"
  }
]
```

### 5. Error Handling Example (Unauthorized Access)
**Request:**
```bash
curl -X GET http://localhost:5000/api/users
```
**Response (`401 Unauthorized`):**
```json
{
  "error": "Access denied. No token provided."
}
```

---

# Architecture

## Architecture Diagram

```
                             +-----------------------+
                             |   End Users / Client  |
                             +-----------+-----------+
                                         |
                                         | HTTP (Port 80 / 443)
                                         v
                             +-----------------------+
                             |   Nginx Reverse Proxy |
                             |   (3tier-nginx-proxy) |
                             +-----+-----------+-----+
                                   |           |
               Path: / or static   |           |  Path: /api/*, /health, /metrics
                                   v           v
           +-----------------------+           +-----------------------+
           |     Frontend Tier     |           |     Application Tier  |
           |     React 19 (SPA)    |           |  Express REST API     |
           |   (3tier-client:80)   |           |    (3tier-api:5000)   |
           +-----------------------+           +-----------+-----------+
                                                           |
                                                           | MySQL Protocol (Port 3306)
                                                           v
                                               +-----------------------+
                                               |     Database Tier     |
                                               |     MySQL 8.0 Server  |
                                               |   (3tier-mysql:3306)  |
                                               +-----------------------+

================================== Observability & CI/CD ==================================

   +-----------------------+                          +-----------------------+
   |      Prometheus       | --- Scrapes /metrics --> |   Express REST API    |
   |   (Port 9090:9090)    |                          +-----------------------+
   +-----------+-----------+
               |
               | Metrics Data Source
               v
   +-----------------------+                          +-----------------------+
   |        Grafana        |                          |     Jenkins CI/CD     |
   |   (Port 3001:3000)    |                          |  Git -> Build -> Test |
   +-----------------------+                          | -> Scan -> Deploy     |
                                                      +-----------------------+
```

## Components

1. **Nginx Reverse Proxy (`nginx/`)**: Front-facing web server handling unified HTTP ingress routing: directs client traffic to the React UI and API queries to the backend.
2. **Client Tier (`client/`)**: Modern Single Page Application built with React 19, react-router-dom, Axios interceptors, and custom CSS animations.
3. **API Tier (`api/`)**: Express.js REST API providing secure JWT authentication, password hashing with bcryptjs, automated DB migrations, admin seeding, and Prometheus metrics via `prom-client`.
4. **Database Tier (`mysql`)**: MySQL 8.0 instance running with persistent volumes, automated schema initialization, and health probes.
5. **Monitoring (`monitoring/`)**:
   - **Prometheus**: Time-series database scraping target metrics every 5 seconds with automated alerting rules (`ApiDown`, `HighHttpErrorRate`).
   - **Grafana**: Web interface displaying customized telemetry dashboards for API latency, request rates, error codes, and memory utilization.
6. **CI/CD Pipeline (`Jenkinsfile`)**: Declarative multi-stage pipeline orchestrating builds, unit tests, code analysis, Docker packaging, and automated validation.

---

# Prerequisites

Ensure the following tools are installed on your host machine:

- **Docker Engine** (>= 20.10.x) & **Docker Compose** (>= 2.x)
- **Node.js** (>= 18.x or 20.x) & **npm** (>= 9.x)
- **Git** (>= 2.30.x)
- **curl** (for API verification)
- **Jenkins** (for local/remote CI/CD execution)

---

# Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/mmabbas786/3-tier-devops-project.git
cd 3-tier-devops-project
```

### 2. Environment Configuration
Copy the provided environment template:
```bash
cp .env.example .env
cp api/.env.example api/.env
cp client/.env.example client/.env
```

### 3. Running Locally Without Docker
If you wish to run the tiers natively on your host:

```bash
# 1. Start MySQL locally on port 3306 with database `crud_app`
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS crud_app;"

# 2. Start the Backend API
cd api
npm install
npm start

# 3. Start the Frontend Client (in a separate terminal)
cd ../client
npm install
npm start
```

---

# Docker Setup

Docker Compose builds and starts all 6 interconnected services simultaneously with a single command.

### Build and Launch the Stack
```bash
docker compose up --build -d
```

### Verify Running Containers
```bash
docker compose ps
```
Expected output:
```
NAME                 IMAGE                     STATUS                   PORTS
3tier-mysql          mysql:8.0                 Up (healthy)             3306/tcp
3tier-api            3-tier-devops-project-api Up                       0.0.0.0:5000->5000/tcp
3tier-client         3-tier-devops-project-client Up                    0.0.0.0:3000->80/tcp
3tier-nginx-proxy    3-tier-devops-project-nginx Up                     0.0.0.0:80->80/tcp
3tier-prometheus     prom/prometheus:v2.50.0   Up                       0.0.0.0:9090->9090/tcp
3tier-grafana        grafana/grafana:10.3.3    Up                       0.0.0.0:3001->3000/tcp
```

### Stop the Containers
```bash
docker compose down
```

---

# Nginx Configuration

The dedicated reverse proxy configuration resides in `nginx/nginx.conf`:

```nginx
events { worker_connections 1024; }

http {
    upstream backend_api {
        server api:5000;
        keepalive 32;
    }

    upstream frontend_client {
        server client:80;
        keepalive 32;
    }

    server {
        listen 80;

        location /api/ {
            proxy_pass http://backend_api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /health {
            proxy_pass http://backend_api/health;
        }

        location /metrics {
            proxy_pass http://backend_api/metrics;
        }

        location / {
            proxy_pass http://frontend_client;
            proxy_set_header Host $host;
        }
    }
}
```

### Testing the Proxy
- Frontend access: `http://localhost/`
- API access via proxy: `http://localhost/api/`
- Health check via proxy: `http://localhost/health`

---

# CI/CD

The continuous integration and continuous deployment process is defined in the canonical declarative [Jenkinsfile](file:///Users/mirzamehediabbas/.gemini/antigravity-ide/scratch/3-tier-devops-project/Jenkinsfile).

## Jenkins Setup
1. In Jenkins, create a new **Pipeline** job named `3-Tier-DevOps-Pipeline`.
2. Under **Pipeline Definition**, select **Pipeline script from SCM**.
3. Set SCM to **Git** and Repository URL to `https://github.com/mmabbas786/3-tier-devops-project.git`.
4. Set Branch Specifier to `*/dev` or `*/main`.
5. Script Path: `Jenkinsfile`.
6. Ensure Jenkins has the **NodeJS Plugin**, **Docker Pipeline**, and required credentials configured.

## Pipeline Stages

```
 +------------------+     +------------------+     +------------------+
 | 1. Git Checkout  | --> | 2. Build         | --> | 3. Test          |
 | (Checkout SCM)   |     | (Frontend/API)   |     | (npm test)       |
 +------------------+     +------------------+     +------------------+
                                                             |
                                                             v
 +------------------+     +------------------+     +------------------+
 | 6. Health Check  | <-- | 5. Deploy        | <-- | 4. Security Scan |
 | (curl /health)   |     | (Docker Compose) |     | (Trivy/Sonar)    |
 +------------------+     +------------------+     +------------------+
```

1. **Git Checkout**: Pulls the target branch from the GitHub repository.
2. **Build**:
   - `client`: Runs `npm ci` and compiles production assets with `npm run build`.
   - `api`: Installs backend dependencies with `npm install`.
3. **Test**:
   - `client`: Executes automated test suite with `npm test`.
   - `api`: Executes syntax validation and API tests with `npm test`.
4. **Security & Code Quality**:
   - **GitLeaks**: Scans the codebase for leaked credentials or secrets.
   - **SonarQube**: Static code analysis and code smell inspection.
   - **Trivy**: Scans the filesystem for known CVE vulnerabilities.
5. **Docker Build**: Packages Docker images for the API, Client, and Nginx proxy.
6. **Deploy**: Deploys updated containers cleanly using `docker compose up -d`.
7. **Health Check**: Polls `http://localhost:5000/health` until a `200 OK` is returned, guaranteeing zero-downtime health verification.

---

# Monitoring

Real-time telemetry and metric dashboards are configured under `monitoring/`.

## Prometheus
- **Web UI**: [http://localhost:9090](http://localhost:9090)
- **Scrape Interval**: 5 seconds
- **Targets**:
  - `devops-api` (`api:5000/metrics`)
  - `prometheus` (`localhost:9090`)

## Grafana
- **Web UI**: [http://localhost:3001](http://localhost:3001)
- **Default Credentials**: `admin` / `admin`
- **Automated Provisioning**:
  - Data Source: Automatically connected to Prometheus at `http://prometheus:9090`.
  - Dashboard: Pre-loaded **DevOps REST API & Container Overview** dashboard (`devops-api-overview`).

## Alerts
Defined in `monitoring/prometheus/alert_rules.yml`:
1. **`ApiDown`**: Triggers with `severity: critical` if `up{job="devops-api"} == 0` for more than 1 minute.
2. **`HighHttpErrorRate`**: Triggers with `severity: warning` if HTTP 5xx responses exceed 5% of total traffic over a 5-minute window.
3. **`HighMemoryUsage`**: Triggers with `severity: warning` if Node.js process memory exceeds 500 MB for 5 minutes.

---

# Configuration / Environment Variables

| Variable | Default Value | Service | Description |
|---|---|---|---|
| `PORT` | `5000` | API | Port the Express REST API listens on |
| `DB_HOST` | `mysql` | API | Database host (container name in Docker) |
| `DB_PORT` | `3306` | API | Database connection port |
| `DB_USER` | `root` | API / MySQL | MySQL database user |
| `DB_PASSWORD` | `rootpassword` | API / MySQL | MySQL database password |
| `DB_NAME` | `crud_app` | API / MySQL | Name of the application database |
| `DB_SSL` | `false` | API | Enable/disable SSL for database connection |
| `JWT_SECRET` | `mirzaDevopsSuperSecretKey` | API | Secret key used for signing JWT tokens |
| `ADMIN_NAME` | `Admin User` | API | Default seeded admin account name |
| `ADMIN_EMAIL` | `admin@example.com` | API | Default seeded admin account email |
| `ADMIN_PASSWORD` | `admin123` | API | Default seeded admin account password |
| `ADMIN_ROLE` | `admin` | API | Default seeded admin account role |
| `REACT_APP_API` | `http://localhost:5000/api` | Client | Base URL used by React Axios client |
| `GF_SECURITY_ADMIN_USER` | `admin` | Grafana | Grafana administrator username |
| `GF_SECURITY_ADMIN_PASSWORD` | `admin` | Grafana | Grafana administrator password |

---

# AWS Deployment (Optional)

The application has been deployed on **Amazon Web Services (AWS)** using an EC2 virtual machine instance.

## AWS Architecture
- **Cloud Provider**: Amazon Web Services (AWS)
- **Region**: `us-east-1` (N. Virginia)
- **Compute**: Amazon EC2 `t3.medium` / `t2.medium`
- **Operating System**: Ubuntu 24.04 LTS (x86_64)
- **Inbound Security Group Rules**:
  - `SSH` (`22`): Admin access
  - `HTTP` (`80`): Nginx Reverse Proxy entrypoint
  - `Custom TCP` (`3000`): React Frontend direct port
  - `Custom TCP` (`5000`): REST API direct port
  - `Custom TCP` (`9090`): Prometheus web UI
  - `Custom TCP` (`3001`): Grafana dashboard UI

## Services Used
- **Amazon EC2**: Virtual server hosting the Docker runtime and microservices.
- **Amazon VPC & Security Groups**: Network firewall rules restricting and permitting ingress traffic.
- **Elastic IP**: Static public IP allocation.

## Public API & Application URLs
- **Public Frontend UI**: [http://54.87.253.5:3000](http://54.87.253.5:3000) or [http://54.87.253.5](http://54.87.253.5)
- **Public API Root**: [http://54.87.253.5:5000/](http://54.87.253.5:5000/)
- **Public API Health Check**: [http://54.87.253.5:5000/health](http://54.87.253.5:5000/health)
- **Public Prometheus**: [http://54.87.253.5:9090](http://54.87.253.5:9090)
- **Public Grafana**: [http://54.87.253.5:3001](http://54.87.253.5:3001)

---

# Railway Cloud Deployment (Live HTTPS URL)

The repository is configured for 1-click or repository-linked deployment on [Railway.app](https://railway.app) to get instant public HTTPS URLs.

### Step 1: Deploy Database on Railway
1. In your Railway project, click **+ New** → **Database** → **Add MySQL**.
2. Railway will automatically provision MySQL and expose standard variables (`MYSQL_URL`, `DATABASE_URL`, `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`).
3. The API in `api/models/db.js` automatically detects these variables.

### Step 2: Deploy Backend API Service
1. Click **+ New** → **GitHub Repo** → select `mmabbas786/3-tier-devops-project`.
2. In service **Settings**:
   - Set **Root Directory** to `/api`.
   - In **Variables**, connect `DATABASE_URL` to reference the MySQL plugin (`${{MySQL.DATABASE_URL}}`), and set `JWT_SECRET=mirzaDevopsSuperSecretKey`.
3. In **Networking**, click **Generate Domain** to obtain your live API URL (e.g., `https://devops-api-production.up.railway.app`).

### Step 3: Deploy Frontend Client Service
1. Click **+ New** → **GitHub Repo** → select `mmabbas786/3-tier-devops-project`.
2. In service **Settings**:
   - Set **Root Directory** to `/client`.
   - In **Variables**, set:
     ```env
     REACT_APP_API=https://devops-api-production.up.railway.app
     ```
3. In **Networking**, click **Generate Domain** to obtain your live frontend URL (e.g., `https://devops-client-production.up.railway.app`).

---

# Kubernetes Deployment (`k8s/`)

Production-ready declarative manifests reside in the `k8s/` directory.

### Manifest Components
- **`k8s/namespace.yaml`**: Creates the `devops-project` isolated namespace.
- **`k8s/mysql.yaml`**: Deploys MySQL 8.0 with a 5Gi PersistentVolumeClaim (`mysql-pvc`), Secret credentials, and ClusterIP service.
- **`k8s/api.yaml`**: Deploys the Node.js API with 2 replicas, liveness/readiness health probes, resource requests/limits, ClusterIP service, and HorizontalPodAutoscaler (`api-hpa`).
- **`k8s/client.yaml`**: Deploys the React frontend with 2 replicas, health checks, and ClusterIP service.
- **`k8s/ingress.yaml`**: Nginx Ingress resource routing `/` to the frontend and `/api`, `/health`, and `/metrics` to the API.

### Deploying to a Kubernetes Cluster (Minikube / EKS / K3s)
```bash
# 1. Apply all manifests using Kustomize
kubectl apply -k k8s/

# 2. Verify pods and services
kubectl get pods -n devops-project
kubectl get svc -n devops-project
kubectl get ingress -n devops-project

# 3. Access via Ingress / Port-Forward
kubectl port-forward svc/api-svc 5000:5000 -n devops-project
kubectl port-forward svc/client-svc 3000:80 -n devops-project
```

---

# Screenshots

*(Screenshots can be placed in `docs/screenshots/` and linked below)*

### 1. Application Dashboard & Login
![Application Dashboard](docs/screenshots/app-dashboard.png)

### 2. Jenkins CI/CD Pipeline Execution
![Jenkins Pipeline](docs/screenshots/jenkins-pipeline.png)

### 3. Prometheus Targets & Metrics
![Prometheus Targets](docs/screenshots/prometheus-targets.png)

### 4. Grafana Monitoring Dashboard
![Grafana Dashboard](docs/screenshots/grafana-dashboard.png)

### 5. AWS EC2 Instance & Terminal
![AWS EC2 Terminal](docs/screenshots/aws-ec2.png)
