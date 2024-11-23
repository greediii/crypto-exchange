const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No token provided');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user role from database
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    req.user = {
      userId: user.id,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
}; 