require('dotenv').config();
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

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

// In-memory fallback state for cloud deployments where MySQL is not yet provisioned
let usingFallback = false;
let nextUserId = 2;
let inMemoryUsers = [
  {
    id: 1,
    name: process.env.ADMIN_NAME || 'Admin User',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10),
    role: process.env.ADMIN_ROLE || 'admin',
    created_at: new Date().toISOString()
  }
];

function isConnectionError(err) {
  if (!err) return false;
  const msg = ((err.message || '') + ' ' + (err.code || '')).toLowerCase();
  return (
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('eai_again') ||
    msg.includes('protocol_connection_lost') ||
    msg.includes('connection lost')
  );
}

function executeInMemory(sql, params) {
  const norm = (sql || '').trim().toLowerCase();
  params = params || [];

  if (norm.startsWith('select 1') || norm.startsWith('create table')) {
    return [{ '1': 1 }];
  }

  if (norm.includes('from users where email =')) {
    const email = (params[0] || '').toLowerCase();
    return inMemoryUsers.filter(u => u.email.toLowerCase() === email);
  }

  if (norm.includes('select') && norm.includes('from users')) {
    return inMemoryUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      created_at: u.created_at
    }));
  }

  if (norm.includes('insert into users')) {
    const [name, email, password, role] = params;
    const existing = inMemoryUsers.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (existing) {
      const err = new Error('Duplicate entry for key users.email');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    const id = nextUserId++;
    const newUser = {
      id,
      name,
      email,
      password,
      role: role || 'viewer',
      created_at: new Date().toISOString()
    };
    inMemoryUsers.push(newUser);
    return { insertId: id, affectedRows: 1 };
  }

  if (norm.includes('update users set')) {
    const [name, email, id] = params;
    const user = inMemoryUsers.find(u => u.id === parseInt(id, 10));
    if (user) {
      user.name = name;
      user.email = email;
    }
    return { affectedRows: user ? 1 : 0 };
  }

  if (norm.includes('delete from users where id =')) {
    const id = parseInt(params[0], 10);
    const before = inMemoryUsers.length;
    inMemoryUsers = inMemoryUsers.filter(u => u.id !== id);
    return { affectedRows: before - inMemoryUsers.length };
  }

  return [];
}

const dbWrapper = {
  isUsingFallback: () => usingFallback,

  query: function(sql, values, cb) {
    if (typeof values === 'function') {
      cb = values;
      values = [];
    }

    if (usingFallback) {
      try {
        const result = executeInMemory(sql, values);
        return cb ? cb(null, result) : Promise.resolve(result);
      } catch (err) {
        return cb ? cb(err) : Promise.reject(err);
      }
    }

    pool.query(sql, values, (err, results, fields) => {
      if (err && isConnectionError(err)) {
        if (!usingFallback) {
          console.warn(`⚠️ MySQL offline (${err.message}). Activating in-memory fallback store.`);
          usingFallback = true;
        }
        try {
          const fallbackResult = executeInMemory(sql, values);
          return cb ? cb(null, fallbackResult, fields) : Promise.resolve(fallbackResult);
        } catch (memErr) {
          return cb ? cb(memErr) : Promise.reject(memErr);
        }
      }
      return cb ? cb(err, results, fields) : (err ? Promise.reject(err) : Promise.resolve(results));
    });
  },

  promise: function() {
    return {
      query: (sql, values) => {
        return new Promise((resolve, reject) => {
          this.query(sql, values, (err, results, fields) => {
            if (err) return reject(err);
            resolve([results, fields || []]);
          });
        });
      }
    };
  }
};

module.exports = dbWrapper;

