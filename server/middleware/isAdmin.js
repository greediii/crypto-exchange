const db = require('../db');

const isAdmin = (req, res, next) => {
  console.log('isAdmin middleware - userId:', req.user.userId);
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId);
  console.log('user role:', user?.role);
  
  if (!user || user.role.toLowerCase() !== 'owner') {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

module.exports = isAdmin; 