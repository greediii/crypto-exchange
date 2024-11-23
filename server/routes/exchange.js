const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const db = require('../db');
const { sendCrypto } = require('../services/bitgo');

const getFeePercentage = () => {
  try {
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('feePercentage');
    return setting ? parseFloat(setting.value) : 22; // fallback to 22 if not set
  } catch (error) {
    console.error('Error fetching fee percentage:', error);
    return 22; // fallback to default
  }
};

router.post('/create', auth, async (req, res) => {
  try {
    const { cashAppAmount, cryptoType, walletAddress, priceAtSubmission } = req.body;
    
    // More detailed debug logging
    console.log('Exchange request details:', {
      userId: req.user.userId,
      body: req.body,
      headers: req.headers
    });

    // Validate inputs
    if (!cashAppAmount || !cryptoType || !walletAddress || !priceAtSubmission) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        received: { cashAppAmount, cryptoType, walletAddress, priceAtSubmission }
      });
    }

    // Get dynamic fee percentage from settings
    const feePercentage = getFeePercentage();
    
    // Calculate fees using dynamic percentage
    const amount = parseFloat(cashAppAmount);
    const price = parseFloat(priceAtSubmission);
    const feeAmount = (amount * feePercentage) / 100;
    const netAmount = amount - feeAmount;
    const cryptoAmountAfterFees = (netAmount / price).toFixed(8);

    // Generate transaction ID
    const transactionId = `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(
        `cashapp://payment?amount=${amount}&transaction_id=${transactionId}`
      );

      // Store transaction in database
      db.transaction(() => {
        // Insert the transaction
        db.prepare(`
          INSERT INTO transactions (
            user_id, amount_usd, amount_crypto, crypto_type,
            wallet_address, exchange_rate, transaction_id, status,
            fee_percentage, fee_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.user.userId,
          amount,
          cryptoAmountAfterFees,
          cryptoType,
          walletAddress,
          price,
          transactionId,
          'pending',
          feePercentage,
          feeAmount
        );

        // Update or insert crypto stats
        db.prepare(`
          INSERT INTO user_crypto_stats (user_id, crypto_type, transaction_count, total_amount_usd, total_amount_crypto)
          VALUES (?, ?, 1, ?, ?)
          ON CONFLICT(user_id, crypto_type) DO UPDATE SET
            transaction_count = transaction_count + 1,
            total_amount_usd = total_amount_usd + ?,
            total_amount_crypto = total_amount_crypto + ?
        `).run(
          req.user.userId,
          cryptoType,
          amount,
          cryptoAmountAfterFees,
          amount,
          cryptoAmountAfterFees
        );
      })();

      // Send response
      res.json({
        transactionId,
        qrCodeUrl,
        feeAmount: feeAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        cryptoAmountAfterFees
      });

    } catch (dbError) {
      console.error('Database or QR Code error:', dbError);
      res.status(500).json({ 
        message: 'Failed to process exchange',
        error: dbError.message 
      });
    }

  } catch (error) {
    // Detailed error logging
    console.error('Exchange creation failed:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      requestBody: req.body
    });
    res.status(500).json({ 
      message: 'Failed to process exchange',
      error: error.message 
    });
  }
});

router.post('/verify', auth, async (req, res) => {
  try {
    const { transactionId } = req.body;

    // Get transaction details from database
    const transaction = db.prepare(`
      SELECT t.*, u.id as user_id 
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.transaction_id = ? AND t.status = 'pending'
    `).get(transactionId);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or already processed' });
    }

    try {
      // Send crypto using BitGo
      const bitgoTx = await sendCrypto(
        transaction.crypto_type,
        transaction.wallet_address,
        transaction.amount_crypto
      );

      // Begin transaction to update both transaction status and user total
      db.transaction(() => {
        // Update transaction status
        db.prepare(`
          UPDATE transactions 
          SET 
            status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            tx_hash = ?
          WHERE transaction_id = ?
        `).run(bitgoTx.txid, transactionId);

        // Update user's total_exchanged
        db.prepare(`
          UPDATE users 
          SET total_exchanged = total_exchanged + ?
          WHERE id = ?
        `).run(transaction.amount_usd, transaction.user_id);
      })();

      res.json({ 
        message: 'Transaction completed successfully',
        txHash: bitgoTx.txid
      });
    } catch (bitgoError) {
      console.error('BitGo transaction failed:', bitgoError);
      
      // Update transaction status to failed
      db.prepare(`
        UPDATE transactions 
        SET status = 'failed'
        WHERE transaction_id = ?
      `).run(transactionId);

      throw new Error('Failed to send cryptocurrency');
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      message: 'Failed to verify transaction',
      error: error.message 
    });
  }
});

router.post('/transactions/:transactionId/confirm', auth, isAdmin, async (req, res) => {
  try {
    // ... existing confirmation logic ...

    // Broadcast the update
    global.broadcastUpdate({
      type: 'TRANSACTION_STATUS_CHANGE',
      transactionId: req.params.transactionId,
      status: 'completed'
    });

    res.json({ message: 'Transaction confirmed successfully' });
  } catch (error) {
    // ... error handling ...
  }
});

module.exports = router;