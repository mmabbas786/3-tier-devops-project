const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const db = require('./models/db'); // MySQL pool connection

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Prometheus metrics setup
let register;
let httpRequestDurationMicroseconds;
let httpRequestsTotal;

try {
  const client = require('prom-client');
  register = new client.Registry();
  client.collectDefaultMetrics({ register, prefix: 'devops_api_' });

  httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });
  register.registerMetric(httpRequestDurationMicroseconds);

  httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'code'],
  });
  register.registerMetric(httpRequestsTotal);
} catch {
  // prom-client not yet installed locally; fallback will be used
}

// HTTP Request Duration & Count Tracking Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.baseUrl + (req.route ? req.route.path : req.path);
    if (httpRequestDurationMicroseconds) {
      httpRequestDurationMicroseconds.labels(req.method, route, String(res.statusCode)).observe(duration);
    }
    if (httpRequestsTotal) {
      httpRequestsTotal.labels(req.method, route, String(res.statusCode)).inc();
    }
  });
  next();
});

// Root index endpoint (GET / and GET /api)
const apiIndexHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: "Mirza's 3-Tier DevOps REST API is online",
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      root: 'GET /',
      health: 'GET /health',
      metrics: 'GET /metrics',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      users: {
        list: 'GET /api/users',
        create: 'POST /api/users',
        update: 'PUT /api/users/:id',
        delete: 'DELETE /api/users/:id'
      }
    }
  });
};

// Check if compiled React frontend exists
const clientBuildPaths = [
  path.join(__dirname, 'client_build'),
  path.join(__dirname, '../client/build'),
  path.join(__dirname, 'public/client_build')
];
const foundClientBuild = clientBuildPaths.find(p => fs.existsSync(p));

if (foundClientBuild) {
  console.log(`📦 Serving React UI static files from: ${foundClientBuild}`);
  app.get('/', (req, res, next) => {
    if (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html')) {
      return apiIndexHandler(req, res);
    }
    next();
  });
  app.use(express.static(foundClientBuild));
} else {
  app.get('/', apiIndexHandler);
}

app.get('/api', apiIndexHandler);

// Health check endpoint (GET /health and GET /api/health)
const healthCheckHandler = async (req, res) => {
  let dbStatus = 'healthy';
  try {
    await db.promise().query('SELECT 1');
    if (db.isUsingFallback && db.isUsingFallback()) {
      dbStatus = 'active (in-memory store; attach Railway MySQL for persistent storage)';
    }
  } catch (err) {
    dbStatus = 'degraded (' + err.message + ')';
  }

  const isHealthy = dbStatus === 'healthy';
  res.status(200).json({
    status: isHealthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    memoryUsage: process.memoryUsage()
  });
};

app.get('/health', healthCheckHandler);
app.get('/api/health', healthCheckHandler);

// Prometheus metrics endpoint (GET /metrics and GET /api/metrics)
app.get(['/metrics', '/api/metrics'], async (req, res) => {
  if (register) {
    res.setHeader('Content-Type', register.contentType);
    return res.end(await register.metrics());
  }
  res.setHeader('Content-Type', 'text/plain');
  res.send(
    `# HELP process_uptime_seconds Total uptime\n` +
    `# TYPE process_uptime_seconds gauge\n` +
    `process_uptime_seconds ${process.uptime()}\n` +
    `# HELP process_memory_rss_bytes Resident Set Size\n` +
    `# TYPE process_memory_rss_bytes gauge\n` +
    `process_memory_rss_bytes ${process.memoryUsage().rss}\n`
  );
});

// Routes (support both direct /api prefix and reverse-proxied stripped paths)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

if (foundClientBuild) {
  // SPA fallback for React router routes (e.g. /login, /dashboard, /register)
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/users') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/metrics')
    ) {
      return next();
    }
    res.sendFile(path.join(foundClientBuild, 'index.html'));
  });
}

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    status: 'error',
    statusCode: status,
    message: err.message || 'Internal Server Error'
  });
});

// Function to initialize database tables
const initDatabase = async () => {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'viewer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await db.promise().query(createTableSql);
  console.log('✅ MySQL `users` table ready.');
};

// Function to wait until MySQL is ready
const waitForDb = async (retries = 30, delay = 2000) => {
  while (retries > 0) {
    try {
      await db.promise().query('SELECT 1');
      console.log('✅ MySQL connection established.');
      await initDatabase();
      return true;
    } catch (err) {
      console.warn(`⏳ Waiting for MySQL connection... (${err.message}). Retries left: ${retries}`);
    }

    retries--;
    await new Promise(res => setTimeout(res, delay));
  }
  console.warn('⚠️ MySQL database not available after multiple retries. API running in degraded mode.');
  return false;
};

// Function to seed admin user if not exists
const seedAdminUser = async () => {
  const name = process.env.ADMIN_NAME || 'Admin User';
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const role = process.env.ADMIN_ROLE || 'admin';

  try {
    const [existing] = await db.promise().query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existing.length === 0) {
      const hashed = await bcrypt.hash(password, 10);
      await db.promise().query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hashed, role]
      );
      console.log(`✅ Admin user created → ${email}`);
    } else {
      console.log(`ℹ️ Admin user already exists → ${email}`);
    }
  } catch (err) {
    console.error(`❌ Admin seeding failed: ${err.message}`);
  }
};

// Start server immediately on 0.0.0.0 so cloud reverse proxies and health checks succeed instantly
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  // Asynchronously connect to DB and seed admin in background
  (async () => {
    try {
      const dbConnected = await waitForDb();
      if (dbConnected) {
        await seedAdminUser();
      }
    } catch (err) {
      console.error(`Database background initialization error: ${err.message}`);
    }
  })();
});

