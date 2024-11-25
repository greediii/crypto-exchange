const axios = require('axios');

class NetworkFeeService {
  async getBTCFee() {
    try {
      // Using mempool.space API for BTC fees
      const response = await axios.get('https://mempool.space/api/v1/fees/recommended');
      // Converting sat/vB to BTC (assuming 250 bytes transaction)
      const feeInSatoshis = response.data.fastestFee * 250;
      return feeInSatoshis / 100000000; // Convert to BTC
    } catch (error) {
      console.error('Error fetching BTC fee:', error);
      return 0.0001; // Fallback fee
    }
  }

  async getETHFee() {
    try {
      // Using Etherscan API for ETH gas prices
      const response = await axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`);
      const gweiPrice = response.data.result.FastGasPrice;
      // Convert gwei to ETH (assuming standard 21000 gas limit)
      return (gweiPrice * 21000) / 1000000000;
    } catch (error) {
      console.error('Error fetching ETH fee:', error);
      return 0.002; // Fallback fee
    }
  }

  async getLTCFee() {
    // Similar implementation for LTC
    return 0.0001; // Default LTC fee for now
  }

  async getAllFees() {
    const [btcFee, ethFee, ltcFee] = await Promise.all([
      this.getBTCFee(),
      this.getETHFee(),
      this.getLTCFee()
    ]);

    return {
      BTC: btcFee,
      ETH: ethFee,
      LTC: ltcFee
    };
  }
}

module.exports = new NetworkFeeService(); 