const axios = require('axios');
require('dotenv').config();

const BLOCKCYPHER_BASE_URL = 'https://api.blockcypher.com/v1';

async function testBlockcypher() {
  console.log('Testing BlockCypher configuration...');
  
  try {
    // Test wallet balance
    console.log('Checking wallet balance...');
    const address = process.env.BTC_WALLET_ADDRESS;
    
    const response = await axios.get(
      `${BLOCKCYPHER_BASE_URL}/btc/main/addrs/${address}/balance`,
      {
        params: {
          token: process.env.BLOCKCYPHER_TOKEN
        }
      }
    );

    console.log('Wallet info:', {
      address: address,
      balance: response.data.balance / 100000000, // Convert satoshis to BTC
      totalReceived: response.data.total_received / 100000000,
      totalSent: response.data.total_sent / 100000000,
      unconfirmedBalance: response.data.unconfirmed_balance / 100000000
    });

    // Test API token
    const tokenInfo = await axios.get(
      `${BLOCKCYPHER_BASE_URL}/tokens/${process.env.BLOCKCYPHER_TOKEN}`
    );

    console.log('API Token info:', {
      limits: tokenInfo.data.limits,
      token: process.env.BLOCKCYPHER_TOKEN.substring(0, 5) + '...'
    });

    return true;
  } catch (error) {
    console.error('BlockCypher test failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return false;
  }
}

// Run the test
console.log('Environment check:', {
  hasToken: !!process.env.BLOCKCYPHER_TOKEN,
  hasWallet: !!process.env.BTC_WALLET_ADDRESS,
  hasPrivateKey: !!process.env.BTC_PRIVATE_KEY,
  walletAddress: process.env.BTC_WALLET_ADDRESS
});

testBlockcypher().then(success => {
  if (success) {
    console.log('BlockCypher test successful!');
  } else {
    console.log('BlockCypher test failed.');
    process.exit(1);
  }
}).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
}); 