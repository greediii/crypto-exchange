const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Get user profile
router.get('/', auth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT 
        id,
        username,
        role,
        total_exchanged,
        cashapp_username,
        preferred_crypto,
        created_at
      FROM users 
      WHERE id = ?
    `).get(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user transactions
router.get('/transactions', auth, (req, res) => {
  try {
    const transactions = db.prepare(`
      SELECT 
        id,
        amount_usd,
        amount_crypto,
        crypto_type,
        status,
        wallet_address,
        fee_amount,
        exchange_rate,
        created_at,
        completed_at
      FROM transactions 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.userId);

    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/', auth, (req, res) => {
  try {
    const { cashapp_username, preferred_crypto } = req.body;

    db.prepare(`
      UPDATE users 
      SET 
        cashapp_username = ?,
        preferred_crypto = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cashapp_username, preferred_crypto, req.user.userId);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 