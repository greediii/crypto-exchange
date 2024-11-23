const BitGoJS = require('bitgo');

const bitgo = new BitGoJS.BitGo({
  env: 'test',  // Use 'prod' for production
  accessToken: process.env.BITGO_ACCESS_TOKEN
});

const getWalletId = (cryptoType) => {
  switch (cryptoType) {
    case 'BTC':
      return process.env.BITGO_BTC_WALLET_ID;
    case 'ETH':
      return process.env.BITGO_ETH_WALLET_ID;
    case 'LTC':
      return process.env.BITGO_LTC_WALLET_ID;
    default:
      throw new Error('Unsupported cryptocurrency type');
  }
};

const getCoinType = (cryptoType) => {
  switch (cryptoType) {
    case 'BTC':
      return 'tbtc';  // Use 'btc' for production
    case 'ETH':
      return 'teth';  // Use 'eth' for production
    case 'LTC':
      return 'tltc';  // Use 'ltc' for production
    default:
      throw new Error('Unsupported cryptocurrency type');
  }
};

const sendCrypto = async (cryptoType, address, amount) => {
  try {
    const walletId = getWalletId(cryptoType);
    const coin = getCoinType(cryptoType);
    
    const wallet = await bitgo.coin(coin).wallets().get({ id: walletId });
    
    const transaction = await wallet.send({
      address: address,
      amount: amount,
      walletPassphrase: process.env.BITGO_WALLET_PASSPHRASE
    });

    return transaction;
  } catch (error) {
    console.error('BitGo send error:', error);
    throw error;
  }
};

module.exports = {
  sendCrypto
}; 