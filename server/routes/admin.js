const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const { getWalletBalances } = require('../services/wallet');

// Get all users
router.get('/users', auth, isAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, role, total_exchanged, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get admin stats
router.get('/stats', auth, isAdmin, (req, res) => {
  try {
    const basicStats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users) as totalUsers,
        (SELECT COUNT(*) FROM transactions WHERE status = 'completed') as totalTransactions,
        (SELECT COALESCE(SUM(amount_usd), 0) 
         FROM transactions 
         WHERE status = 'completed'
         AND amount_usd > 0) as totalVolume
    `).get();

    res.json({
      totalUsers: basicStats.totalUsers,
      totalTransactions: basicStats.totalTransactions,
      totalVolume: basicStats.totalVolume
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get admin settings
router.get('/settings', auth, isAdmin, (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT key, value FROM settings
      WHERE key IN ('feePercentage', 'cashappUsername')
    `).all();

    // Convert array to object
    const settingsObject = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {
      feePercentage: '22',  // default value
      cashappUsername: ''   // default value
    });

    res.json(settingsObject);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update admin settings
router.put('/settings', auth, isAdmin, (req, res) => {
  try {
    const { feePercentage } = req.body;

    const updateSetting = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `);

    db.transaction(() => {
      if (feePercentage !== undefined) {
        updateSetting.run('feePercentage', feePercentage.toString());
      }
    })();

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user transactions
router.get('/users/:userId/transactions', auth, isAdmin, (req, res) => {
  console.log('=== Transaction Route Debug ===');
  console.log('1. Route Handler Entry');
  console.log('Request params:', req.params);
  console.log('Request user:', req.user);
  console.log('Request headers:', req.headers);
  
  try {
    console.log('2. Executing database query');
    const transactions = db.prepare(`
      SELECT 
        t.*,
        u.username,
        u.cashapp_username
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `).all(req.params.userId);
    
    console.log('3. Query results:', {
      transactionCount: transactions.length,
      userId: req.params.userId,
      firstTransaction: transactions[0]
    });
    
    res.json(transactions);
  } catch (error) {
    console.error('4. Error in route handler:', {
      error: error.message,
      stack: error.stack,
      userId: req.params.userId
    });
    res.status(500).json({ 
      message: 'Server error',
      details: error.message 
    });
  }
});

// Confirm transaction and send crypto
router.post('/transactions/:transactionId/confirm', auth, isAdmin, (req, res) => {
  try {
    console.log('Confirming transaction:', req.params.transactionId);
    
    // First check if transaction exists
    const transaction = db.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(req.params.transactionId);

    if (!transaction) {
      console.log('Transaction not found:', req.params.transactionId);
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status === 'completed') {
      console.log('Transaction already completed:', req.params.transactionId);
      return res.status(400).json({ message: 'Transaction already completed' });
    }

    // Perform the update within a transaction
    db.transaction(() => {
      // Update transaction status
      const updateTx = db.prepare(`
        UPDATE transactions 
        SET 
          status = 'completed',
          completed_at = datetime('now')
        WHERE id = ?
      `);
      updateTx.run(req.params.transactionId);

      // Update user's total exchanged amount
      const updateUser = db.prepare(`
        UPDATE users 
        SET total_exchanged = COALESCE(total_exchanged, 0) + ?
        WHERE id = ?
      `);
      updateUser.run(transaction.amount_usd, transaction.user_id);

      console.log('Transaction confirmed successfully:', req.params.transactionId);
    })();

    res.json({ 
      message: 'Transaction confirmed successfully',
      transaction: {
        ...transaction,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Error confirming transaction:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Failed to confirm transaction',
      error: error.message 
    });
  }
});

// Add a test route to verify routing is working
router.get('/test', (req, res) => {
  console.log('DEBUG: Test route hit');
  res.json({ message: 'Admin routes are working' });
});

// Update user role
router.put('/users/:userId/role', auth, isAdmin, (req, res) => {
  try {
    const { role } = req.body;
    const { userId } = req.params;

    // Validate role
    const validRoles = ['user', 'support', 'admin', 'owner'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Don't allow changing owner's role
    const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (targetUser.role === 'owner') {
      return res.status(403).json({ message: 'Cannot modify owner role' });
    }

    // Update user role
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role.toLowerCase(), userId);

    // Try to log the change, but don't fail if logging fails
    try {
      db.prepare(`
        INSERT INTO admin_logs (admin_id, action, details)
        VALUES (?, 'role_change', ?)
      `).run(
        req.user.userId,
        JSON.stringify({ userId, oldRole: targetUser.role, newRole: role })
      );
    } catch (logError) {
      console.warn('Failed to log role change:', logError);
      // Continue execution even if logging fails
    }

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Get extended admin stats
router.get('/extended-stats', auth, isAdmin, async (req, res) => {
  try {
    // Get current stats
    const currentStats = db.prepare(`
      WITH recent_transactions AS (
        SELECT 
          *,
          ROUND((julianday('now') - julianday(created_at)) * 24 * 60, 2) as response_time_mins
        FROM transactions 
        WHERE created_at > datetime('now', '-24 hours')
      )
      SELECT 
        COUNT(DISTINCT user_id) as daily_active_users,
        COUNT(*) as total_transactions,
        ROUND(AVG(amount_usd), 2) as avg_transaction_size,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
        ROUND(AVG(CASE WHEN status = 'completed' THEN response_time_mins END), 2) as avg_response_time,
        ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2) as success_rate,
        COALESCE(SUM(amount_usd), 0) as total_volume
      FROM recent_transactions
    `).get() || {
      daily_active_users: 0,
      total_transactions: 0,
      avg_transaction_size: 0,
      pending_transactions: 0,
      avg_response_time: 0,
      success_rate: 0,
      total_volume: 0
    };

    // Get previous stats
    const previousStats = db.prepare(`
      WITH prev_transactions AS (
        SELECT 
          *,
          ROUND((julianday('now', '-24 hours') - julianday(created_at)) * 24 * 60, 2) as response_time_mins
        FROM transactions 
        WHERE created_at BETWEEN datetime('now', '-48 hours') AND datetime('now', '-24 hours')
      )
      SELECT 
        COUNT(DISTINCT user_id) as daily_active_users,
        COUNT(*) as total_transactions,
        ROUND(AVG(amount_usd), 2) as avg_transaction_size,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
        ROUND(AVG(CASE WHEN status = 'completed' THEN response_time_mins END), 2) as avg_response_time,
        ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2) as success_rate,
        COALESCE(SUM(amount_usd), 0) as total_volume
      FROM prev_transactions
    `).get() || {
      daily_active_users: 0,
      total_transactions: 0,
      avg_transaction_size: 0,
      pending_transactions: 0,
      avg_response_time: 0,
      success_rate: 0,
      total_volume: 0
    };

    // Calculate percentage changes with null safety
    const calculateChange = (current, previous) => {
      if (!previous || previous === 0) return '0';
      return ((current - previous) / previous * 100).toFixed(1);
    };

    // Get current online users count
    const currentOnline = req.app.get('wsServer')?.getOnlineCount() || 0;
    
    // Get new users today with null safety
    const newUsersToday = db.prepare(`
      SELECT COUNT(*) as count
      FROM users 
      WHERE created_at > date('now')
    `).get()?.count || 0;

    // Get new users yesterday with null safety
    const newUsersYesterday = db.prepare(`
      SELECT COUNT(*) as count
      FROM users 
      WHERE created_at BETWEEN date('now', '-1 day') AND date('now')
    `).get()?.count || 0;

    // Get last hour transactions with null safety
    const lastHourStats = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount_usd), 0) as volume
      FROM transactions 
      WHERE created_at > datetime('now', '-1 hour')
    `).get() || { count: 0, volume: 0 };

    // Get previous hour transactions with null safety
    const prevHourStats = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount_usd), 0) as volume
      FROM transactions 
      WHERE created_at BETWEEN datetime('now', '-2 hours') AND datetime('now', '-1 hour')
    `).get() || { count: 0, volume: 0 };

    // Get wallet balances with null safety
    const walletBalances = await getWalletBalances() || {};

    // Format the response
    const response = {
      dailyActiveUsers: {
        value: currentStats.daily_active_users || 0,
        change: calculateChange(currentStats.daily_active_users, previousStats.daily_active_users)
      },
      currentOnline: {
        value: currentOnline,
        change: '0'
      },
      successRate: {
        value: currentStats.success_rate || 0,
        change: calculateChange(currentStats.success_rate, previousStats.success_rate)
      },
      pendingTransactions: {
        value: currentStats.pending_transactions || 0,
        change: calculateChange(currentStats.pending_transactions, previousStats.pending_transactions)
      },
      lastHourTransactions: {
        value: lastHourStats.count || 0,
        change: calculateChange(lastHourStats.count, prevHourStats.count)
      },
      averageTransactionSize: {
        value: currentStats.avg_transaction_size || 0,
        change: calculateChange(currentStats.avg_transaction_size, previousStats.avg_transaction_size)
      },
      averageResponseTime: {
        value: currentStats.avg_response_time || 0,
        change: calculateChange(currentStats.avg_response_time, previousStats.avg_response_time)
      },
      newUsersToday: {
        value: newUsersToday,
        change: calculateChange(newUsersToday, newUsersYesterday)
      },
      walletBalances
    };

    res.json(response);
  } catch (error) {
    console.error('Error in extended stats:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Add this new route to handle exchange toggling
router.post('/toggle-exchange', auth, isAdmin, (req, res) => {
  try {
    // Get current exchange status
    const currentStatus = db.prepare(`
      SELECT value FROM settings WHERE key = 'exchangeEnabled'
    `).get();

    // Toggle the status (if not exists, create as enabled)
    const newStatus = currentStatus?.value === 'true' ? 'false' : 'true';

    // Update or insert the setting
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES ('exchangeEnabled', ?)
    `).run(newStatus);

    // Broadcast the status change to all connected clients
    if (global.broadcastUpdate) {
      global.broadcastUpdate({
        type: 'EXCHANGE_STATUS',
        status: newStatus === 'true'
      });
    }

    res.json({ 
      success: true, 
      enabled: newStatus === 'true'
    });
  } catch (error) {
    console.error('Error toggling exchange:', error);
    res.status(500).json({ 
      message: 'Failed to toggle exchange status',
      error: error.message 
    });
  }
});

// Add this GET route to check exchange status
router.get('/exchange-status', auth, isAdmin, (req, res) => {
  try {
    const status = db.prepare(`
      SELECT value FROM settings WHERE key = 'exchangeEnabled'
    `).get();

    res.json({ 
      enabled: status?.value === 'true' 
    });
  } catch (error) {
    console.error('Error getting exchange status:', error);
    res.status(500).json({ 
      message: 'Failed to get exchange status',
      error: error.message 
    });
  }
});

router.post('/fee-rules', auth, isAdmin, (req, res) => {
    const { crypto_type, price_range_start, price_range_end, fee_percentage } = req.body;

    try {
        db.prepare(`
            INSERT INTO fee_rules (crypto_type, price_range_start, price_range_end, fee_percentage)
            VALUES (?, ?, ?, ?)
        `).run(crypto_type, price_range_start, price_range_end, fee_percentage);

        res.status(201).json({ message: 'Fee rule added successfully' });
    } catch (error) {
        console.error('Error adding fee rule:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/fee-rules', auth, isAdmin, (req, res) => {
    try {
        const rules = db.prepare(`
            SELECT * FROM fee_rules
            ORDER BY crypto_type, price_range_start
        `).all();

        res.json(rules);
    } catch (error) {
        console.error('Error fetching fee rules:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update settings
router.post('/settings', auth, async (req, res) => {
  try {
    // Check if user is admin or owner
    if (!['admin', 'owner'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Unauthorized to modify settings' 
      });
    }

    const { key, value } = req.body;

    // Validate input
    if (!key || value === undefined) {
      return res.status(400).json({ 
        message: 'Key and value are required' 
      });
    }

    // Update or insert the setting
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(key, value);

    res.json({ 
      message: 'Setting updated successfully',
      key,
      value 
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ 
      message: 'Failed to update settings',
      error: error.message 
    });
  }
});

module.exports = router;