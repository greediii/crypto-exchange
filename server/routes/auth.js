const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../config/jwt');

// Add this at the top of your auth.js routes file
router.use((req, res, next) => {
  console.log('Auth route accessed:', {
    method: req.method,
    path: req.path,
    body: req.body
  });
  next();
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        message: 'Username and password are required',
        details: { username: !!username, password: !!password }
      });
    }

    // Check if username exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const insert = db.prepare(`
      INSERT INTO users (username, password, role) 
      VALUES (?, ?, 'user')
    `);
    
    const result = insert.run(username, hashedPassword);

    // Generate JWT
    const token = jwt.sign(
      { userId: result.lastInsertRowid },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration',
      details: error.message 
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Add debugging
    console.log('Creating token with:', {
      userId: user.id,
      secret: JWT_SECRET.substring(0, 4) + '...',
      secretLength: JWT_SECRET.length
    });

    // Generate JWT
    const token = jwt.sign(
      { 
        userId: user.id,  // Make sure this matches the column name in your users table
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Verify token immediately after creation
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('Token verified successfully:', decoded);
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);
    }

    res.json({
      message: 'Login successful',
      token,
      role: user.role,
      userId: user.id
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this route to verify tokens
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    console.log('Verifying token with secret:', JWT_SECRET.substring(0, 4) + '...');
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(decoded.userId);
    
    res.json({
      valid: true,
      decoded,
      user: user ? { id: user.id, role: user.role } : null
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: error.message
    });
  }
});

module.exports = router; 