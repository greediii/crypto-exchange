const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

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
    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users) as totalUsers,
        (SELECT COUNT(*) FROM transactions) as totalTransactions,
        (SELECT COALESCE(SUM(amount_usd), 0) 
         FROM transactions 
         WHERE status = 'completed') as totalVolume
    `).get();

    res.json({
      totalUsers: stats.totalUsers,
      totalTransactions: stats.totalTransactions,
      totalVolume: stats.totalVolume
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
    const { feePercentage, cashappUsername } = req.body;

    // Begin transaction
    const updateSetting = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `);

    db.transaction(() => {
      if (feePercentage !== undefined) {
        updateSetting.run('feePercentage', feePercentage.toString());
      }
      if (cashappUsername !== undefined) {
        updateSetting.run('cashappUsername', cashappUsername);
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
    // Basic stats
    const basicStats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users) as totalUsers,
        (SELECT COUNT(*) FROM transactions WHERE status = 'completed') as totalTransactions,
        (SELECT COALESCE(SUM(amount_usd), 0) 
         FROM transactions 
         WHERE status = 'completed'
         AND amount_usd > 0) as totalVolume
    `).get();

    // Daily active users
    const dailyActiveUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM transactions 
      WHERE created_at > datetime('now', '-1 day')
    `).get();

    const previousDayUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM transactions 
      WHERE created_at BETWEEN datetime('now', '-2 days') AND datetime('now', '-1 day')
    `).get();

    // Calculate daily change percentage
    const dailyChange = previousDayUsers.count > 0 
      ? ((dailyActiveUsers.count - previousDayUsers.count) / previousDayUsers.count * 100)
      : 0;

    // Get new users today
    const newUsersToday = db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE created_at > datetime('now', 'start of day')
    `).get();

    // Get repeat users (users with more than one transaction)
    const repeatUsers = db.prepare(`
      SELECT 
        COUNT(DISTINCT user_id) * 100.0 / (SELECT COUNT(*) FROM users) as percentage
      FROM transactions
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `).get();

    // Get last hour transactions
    const lastHourTransactions = db.prepare(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE created_at > datetime('now', '-1 hour')
    `).get();

    // Calculate average transaction size
    const avgTransactionSize = db.prepare(`
      SELECT COALESCE(AVG(amount_usd), 0) as average
      FROM transactions
      WHERE status = 'completed'
      AND amount_usd > 0
    `).get();

    // Get peak hour volume
    const peakHourVolume = db.prepare(`
      SELECT COALESCE(MAX(hourly_volume), 0) as volume
      FROM (
        SELECT SUM(amount_usd) as hourly_volume
        FROM transactions
        WHERE status = 'completed'
        AND created_at > datetime('now', '-24 hours')
        AND amount_usd > 0
        GROUP BY strftime('%H', created_at)
      )
    `).get();

    // Get crypto distribution
    const cryptoDistribution = db.prepare(`
      SELECT 
        crypto_type,
        COUNT(*) * 100.0 / (
          SELECT COUNT(*) 
          FROM transactions 
          WHERE status = 'completed'
        ) as percentage
      FROM transactions
      WHERE status = 'completed'
      GROUP BY crypto_type
      ORDER BY COUNT(*) DESC
      LIMIT 3
    `).all();

    // Get recent activity
    const recentActivity = db.prepare(`
      SELECT 
        t.id,
        t.amount_usd,
        t.amount_crypto,
        t.crypto_type,
        t.created_at,
        t.status,
        u.username,
        t.wallet_address
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.created_at > datetime('now', '-24 hours')
      ORDER BY t.created_at DESC
      LIMIT 10
    `).all();

    // Format response
    const response = {
      // Main stats
      totalUsers: basicStats.totalUsers,
      totalTransactions: basicStats.totalTransactions,
      totalVolume: basicStats.totalVolume,
      
      // Detailed stats
      dailyActiveUsers: {
        value: dailyActiveUsers.count,
        change: dailyChange.toFixed(1)
      },
      newUsersToday: newUsersToday.count,
      repeatUsers: repeatUsers?.percentage?.toFixed(1) || 0,
      lastHourTransactions: lastHourTransactions.count,
      averageTransactionSize: avgTransactionSize.average?.toFixed(2) || 0,
      peakHourVolume: peakHourVolume?.volume?.toFixed(2) || 0,
      
      // Crypto distribution
      topCryptos: cryptoDistribution.map(crypto => ({
        name: crypto.crypto_type,
        percentage: parseFloat(crypto.percentage.toFixed(1))
      })),
      
      // Recent activity with more details
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        type: 'exchange',
        amount: activity.amount_usd,
        cryptoAmount: activity.amount_crypto,
        crypto: activity.crypto_type,
        time: activity.created_at,
        username: activity.username,
        status: activity.status,
        walletAddress: activity.wallet_address?.slice(0, 8) + '...' // Truncate for privacy
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error in extended stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;