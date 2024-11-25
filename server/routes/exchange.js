const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const cryptoService = require('../services/blockcypher');
const webReceiptVerifier = require('../services/webReceiptVerification');
const emailVerifier = require('../services/emailVerification');

// Get fee rate for a specific amount and crypto type
router.get('/fee-rate', (req, res) => {
  try {
    const { amount, cryptoType } = req.query;
    const numericAmount = parseFloat(amount);

    const feeRule = db.prepare(`
      SELECT fee_percentage 
      FROM fee_rules 
      WHERE crypto_type = ? 
      AND price_range_start <= ? 
      AND price_range_end >= ?
    `).get(cryptoType, numericAmount, numericAmount);

    // If no rule matches, return a default fee percentage
    const feePercentage = feeRule ? feeRule.fee_percentage : 22;

    res.json({ feePercentage });
  } catch (error) {
    console.error('Error getting fee rate:', error);
    res.status(500).json({ error: 'Failed to get fee rate' });
  }
});

// Create new exchange transaction
router.post('/create', auth, async (req, res) => {
  try {
    const { cashAppAmount, cryptoType, walletAddress, priceAtSubmission } = req.body;
    
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.userId;
    const FEE_PERCENTAGE = 22;
    
    // Calculate amounts
    const netAmount = cashAppAmount / 1.22;
    const cryptoAmount = netAmount / priceAtSubmission;
    const feeAmount = cashAppAmount - netAmount;

    // Get next transaction ID
    const maxIdResult = db.prepare('SELECT MAX(transaction_id) as max_id FROM transactions').get();
    const nextTransactionId = (maxIdResult.max_id || 0) + 1;

    // Create transaction record
    const result = db.prepare(`
      INSERT INTO transactions (
        transaction_id,
        user_id,
        amount_usd,
        amount_crypto,
        crypto_type,
        wallet_address,
        status,
        exchange_rate,
        fee_amount,
        fee_percentage,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      nextTransactionId,
      userId,
      cashAppAmount,
      cryptoAmount,
      cryptoType,
      walletAddress,
      'pending',
      priceAtSubmission,
      feeAmount,
      FEE_PERCENTAGE
    );

    // Get the created transaction
    const transaction = db.prepare(`
      SELECT * FROM transactions WHERE transaction_id = ?
    `).get(nextTransactionId);

    return res.json({
      success: true,
      transaction: {
        id: transaction.transaction_id,
        amount_usd: transaction.amount_usd,
        amount_crypto: transaction.amount_crypto,
        crypto_type: transaction.crypto_type,
        status: transaction.status,
        exchange_rate: transaction.exchange_rate,
        fee_amount: transaction.fee_amount,
        fee_percentage: transaction.fee_percentage
      }
    });

  } catch (error) {
    console.error('Exchange creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create exchange',
      error: error.message
    });
  }
});

// Verify and complete transaction
router.post('/verify-and-complete', auth, async (req, res) => {
  const { transactionId, receipt, identifier, amount, fromUsername } = req.body;

  try {
    // Get transaction first
    const transaction = db.prepare(`
      SELECT * FROM transactions 
      WHERE transaction_id = ? AND status = 'pending'
    `).get(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        step: 'transaction_check',
        message: 'Transaction not found or already completed'
      });
    }

    // Step 1: Web Receipt Verification
    console.log('Starting web receipt verification for transaction:', transactionId);
    let webVerification = null;
    try {
      webVerification = await webReceiptVerifier.verifyReceipt(receipt);
      console.log('Web verification successful:', webVerification);
    } catch (webError) {
      console.error('Web verification failed:', webError);
      return res.status(400).json({
        success: false,
        step: 'web_verification',
        message: 'Could not verify web receipt',
        error: webError.message
      });
    }

    // Step 2: Email Verification
    console.log('Starting email verification with identifier:', webVerification.identifier);
    const emailResults = await emailVerifier.findPaymentEmail(
      webVerification.identifier,
      amount,
      fromUsername
    );

    if (!emailResults || emailResults.length === 0) {
      console.error('No matching email found for identifier:', webVerification.identifier);
      return res.status(400).json({
        success: false,
        step: 'email_verification',
        message: 'No matching payment found in emails'
      });
    }

    // Step 3: Cross-verify details
    const matchingEmail = emailResults.find(email => 
      email.verified && 
      email.identifier === webVerification.identifier &&
      Math.abs(email.amount - parseFloat(amount)) < 0.01 // Account for floating point
    );

    if (!matchingEmail) {
      console.error('Email verification failed:', {
        expectedAmount: amount,
        foundAmount: emailResults[0]?.amount,
        identifier: webVerification.identifier
      });
      return res.status(400).json({
        success: false,
        step: 'cross_verification',
        message: 'Payment details do not match'
      });
    }

    // Step 4: Verify payment timing
    const paymentTime = new Date(matchingEmail.timestamp);
    const timeDiff = Date.now() - paymentTime.getTime();
    if (timeDiff > 30 * 60 * 1000) { // 30 minutes
      return res.status(400).json({
        success: false,
        step: 'time_verification',
        message: 'Payment is too old (must be within 30 minutes)'
      });
    }

    // Step 5: Update transaction status
    db.prepare(`
      UPDATE transactions 
      SET 
        status = 'verified',
        verified_at = CURRENT_TIMESTAMP,
        receipt_identifier = ?,
        verification_method = 'dual_verification'
      WHERE transaction_id = ?
    `).run(webVerification.identifier, transactionId);

    // Step 6: Check wallet balance before proceeding
    const walletBalance = await cryptoService.getBalance(process.env.BTC_WALLET_ADDRESS);
    if (walletBalance.balance < transaction.amount_crypto) {
      return res.status(400).json({
        success: false,
        step: 'balance_check',
        message: 'Insufficient funds in exchange wallet'
      });
    }

    // Step 7: Send crypto
    const sendResult = await cryptoService.sendBTC(
      transaction.wallet_address,
      transaction.amount_crypto
    );

    // Step 8: Update transaction to completed
    db.prepare(`
      UPDATE transactions 
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        tx_hash = ?
      WHERE transaction_id = ?
    `).run(sendResult.txid, transactionId);

    // Success response with full details
    return res.json({
      success: true,
      message: 'Transaction verified and completed',
      details: {
        transactionId,
        verificationMethod: 'dual_verification',
        webReceipt: {
          verified: true,
          identifier: webVerification.identifier
        },
        emailVerification: {
          verified: true,
          timestamp: matchingEmail.timestamp
        },
        crypto: {
          txHash: sendResult.txid,
          amount: transaction.amount_crypto
        }
      }
    });

  } catch (error) {
    console.error('Verification process failed:', error);
    return res.status(500).json({
      success: false,
      step: 'system_error',
      message: 'System error during verification',
      error: error.message
    });
  }
});

module.exports = router;