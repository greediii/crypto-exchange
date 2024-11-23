const express = require('express');
const router = express.Router();
const axios = require('axios');

// Cache prices for 30 seconds
let priceCache = {
  data: null,
  timestamp: 0
};

router.get('/prices', async (req, res) => {
  try {
    const now = Date.now();
    // Use cache if available and less than 30 seconds old
    if (priceCache.data && now - priceCache.timestamp < 30000) {
      console.log('Returning cached prices:', priceCache.data);
      return res.json(priceCache.data);
    }

    console.log('Fetching fresh prices from CoinGecko...');
    // Fetch new prices from CoinGecko with timeout
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      {
        params: {
          ids: 'bitcoin,ethereum,litecoin',
          vs_currencies: 'usd',
          include_24hr_change: true
        },
        timeout: 5000, // 5 second timeout
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'YourApp/1.0'
        }
      }
    );

    console.log('CoinGecko response:', response.data);

    if (!response.data || !response.data.bitcoin || !response.data.ethereum || !response.data.litecoin) {
      throw new Error('Incomplete data received from CoinGecko');
    }

    // Transform data to match our format
    const prices = {
      BTC: {
        price: response.data.bitcoin.usd || 0,
        change24h: response.data.bitcoin.usd_24h_change || 0
      },
      ETH: {
        price: response.data.ethereum.usd || 0,
        change24h: response.data.ethereum.usd_24h_change || 0
      },
      LTC: {
        price: response.data.litecoin.usd || 0,
        change24h: response.data.litecoin.usd_24h_change || 0
      }
    };

    // Validate prices
    if (Object.values(prices).some(crypto => crypto.price === 0)) {
      throw new Error('Invalid price values received');
    }

    // Update cache
    priceCache = {
      data: prices,
      timestamp: now
    };

    res.json(prices);
  } catch (error) {
    console.error('Crypto price fetch error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    // If we have cached data, return it even if expired
    if (priceCache.data) {
      console.log('Returning expired cache data due to error');
      return res.json(priceCache.data);
    }

    // Return a more detailed error response
    res.status(error.response?.status || 500).json({
      message: 'Failed to fetch crypto prices',
      error: error.message,
      isRateLimit: error.response?.status === 429
    });
  }
});

module.exports = router;