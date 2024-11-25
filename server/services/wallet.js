const db = require('../db');
const axios = require('axios');

const getCryptoPrices = async () => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'bitcoin,ethereum,litecoin',
        vs_currencies: 'usd'
      }
    });

    return {
      BTC: response.data.bitcoin.usd,
      ETH: response.data.ethereum.usd,
      LTC: response.data.litecoin.usd
    };
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return {
      BTC: 40000,
      ETH: 2000,
      LTC: 100
    };
  }
};

const getWalletBalances = async () => {
  try {
    const balances = await db.prepare(`
      SELECT 
        crypto_type,
        COALESCE(SUM(amount_crypto), 0) as balance
      FROM transactions
      WHERE status = 'completed'
      GROUP BY crypto_type
    `).all();

    const walletBalances = {
      BTC: { balance: 0 },
      ETH: { balance: 0 },
      LTC: { balance: 0 }
    };

    balances.forEach(({ crypto_type, balance }) => {
      if (walletBalances[crypto_type]) {
        walletBalances[crypto_type].balance = parseFloat(balance) || 0;
      }
    });

    return walletBalances;
  } catch (error) {
    console.error('Error fetching wallet balances:', error);
    return {
      BTC: { balance: 0 },
      ETH: { balance: 0 },
      LTC: { balance: 0 }
    };
  }
};

module.exports = {
  getWalletBalances,
  getCryptoPrices
}; 