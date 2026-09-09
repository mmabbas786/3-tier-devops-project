require('dotenv').config();
const mysql = require('mysql2');

let pool;

if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
  const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL;
  pool = mysql.createPool(connectionUri);
} else {
  const poolConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'crud_app',
    port: process.env.DB_PORT
      ? parseInt(process.env.DB_PORT, 10)
      : (process.env.MYSQLPORT ? parseInt(process.env.MYSQLPORT, 10) : 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };

  if (process.env.DB_SSL === 'true' || process.env.MYSQLSSL === 'true') {
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }

  pool = mysql.createPool(poolConfig);
}

module.exports = pool;
