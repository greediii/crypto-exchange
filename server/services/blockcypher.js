const axios = require('axios');
const bitcoin = require('bitcoinjs-lib');
require('dotenv').config();

const BLOCKCYPHER_BASE_URL = 'https://api.blockcypher.com/v1';

const cryptoService = {
  // Send BTC
  sendBTC: async (toAddress, amountBTC) => {
    try {
      const fromAddress = process.env.BTC_WALLET_ADDRESS;
      const privateKey = process.env.BTC_PRIVATE_KEY;
      
      // Convert BTC to satoshis
      const amountSatoshis = Math.floor(amountBTC * 100000000);

      // 1. Create new transaction
      const newTx = await axios.post(`${BLOCKCYPHER_BASE_URL}/btc/main/txs/new`, {
        inputs: [{ addresses: [fromAddress] }],
        outputs: [{ addresses: [toAddress], value: amountSatoshis }]
      }, {
        params: { token: process.env.BLOCKCYPHER_TOKEN }
      });

      // 2. Sign the transaction
      const keyPair = bitcoin.ECPair.fromWIF(privateKey);
      const txHex = await this.signTransaction(newTx.data.tosign[0], keyPair);

      // 3. Send the signed transaction
      const finalTx = await axios.post(`${BLOCKCYPHER_BASE_URL}/btc/main/txs/send`, {
        tx: newTx.data.tx,
        signatures: [txHex],
        pubkeys: [keyPair.publicKey.toString('hex')]
      }, {
        params: { token: process.env.BLOCKCYPHER_TOKEN }
      });

      return {
        txid: finalTx.data.hash,
        status: 'pending',
        amount: amountBTC,
        to: toAddress
      };
    } catch (error) {
      console.error('BTC send error:', {
        message: error.message,
        response: error.response?.data
      });
      throw error;
    }
  },

  // Helper function to sign transaction
  signTransaction: async (tosign, keyPair) => {
    const signature = keyPair.sign(Buffer.from(tosign, 'hex'));
    return signature.toString('hex');
  },

  // Get balance
  getBalance: async (address) => {
    try {
      const response = await axios.get(
        `${BLOCKCYPHER_BASE_URL}/btc/main/addrs/${address}/balance`,
        {
          params: { token: process.env.BLOCKCYPHER_TOKEN }
        }
      );

      return {
        balance: response.data.balance / 100000000,
        unconfirmed: response.data.unconfirmed_balance / 100000000
      };
    } catch (error) {
      console.error('Balance check error:', error);
      throw error;
    }
  }
};

module.exports = cryptoService; 