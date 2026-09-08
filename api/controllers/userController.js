const db = require('../models/db');
const bcrypt = require('bcryptjs');

// GET all users
exports.getAllUsers = (req, res) => {
  db.query('SELECT id, name, email, role, created_at FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: err.message, message: 'Failed to fetch users' });
    res.json(results);
  });
};

// CREATE new user
exports.addUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing fields', message: 'Name, email, and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'viewer'],
      (err, result) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Email already exists', message: 'A user with this email already exists' });
          }
          return res.status(500).json({ error: err.message, message: 'Failed to create user' });
        }
        res.status(201).json({ id: result.insertId, name, email, role: role || 'viewer' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error while hashing password', message: 'Failed to hash password' });
  }
};

// UPDATE user
exports.updateUser = (req, res) => {
  const { name, email } = req.body;
  db.query(
    'UPDATE users SET name = ?, email = ? WHERE id = ?',
    [name, email, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ id: req.params.id, name, email });
    }
  );
};

// DELETE user
exports.deleteUser = (req, res) => {
  db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'User deleted' });
  });
};

