const WebSocket = require('ws');
const axios = require('axios');
const { getWalletBalances, getCryptoPrices } = require('./services/wallet');

const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server });
  const adminClients = new Set();

  // Define broadcast function within scope
  const broadcastWalletUpdate = async () => {
    try {
      if (adminClients.size === 0) return;

      const walletBalances = await getWalletBalances();
      const cryptoPrices = await getCryptoPrices();

      // Log the data being sent
      console.log('Broadcasting wallet update:', {
        balances: walletBalances,
        prices: cryptoPrices
      });

      const message = JSON.stringify({
        type: 'WALLET_UPDATE',
        balances: walletBalances,
        prices: cryptoPrices,
        timestamp: new Date().toISOString()
      });

      for (const client of adminClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    } catch (error) {
      console.error('Error broadcasting wallet update:', error);
    }
  };

  // Set up regular wallet updates
  const updateInterval = setInterval(broadcastWalletUpdate, 10000);

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === 'AUTH') {
          const token = data.token;
          // Verify token here if needed
          adminClients.add(ws);
          
          // Send initial wallet data
          await broadcastWalletUpdate();
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      adminClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      adminClients.delete(ws);
    });
  });

  // Cleanup on server shutdown
  wss.on('close', () => {
    clearInterval(updateInterval);
  });

  return {
    wss,
    broadcastWalletUpdate // Export for external use if needed
  };
};

module.exports = setupWebSocket;