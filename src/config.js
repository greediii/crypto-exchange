const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://crypto-exchange-8ppb.onrender.com/api' 
    : 'http://localhost:3001/api',
  WS_URL: process.env.NODE_ENV === 'production'
    ? 'wss://crypto-exchange-8ppb.onrender.com/ws'
    : 'ws://localhost:3001/ws'
};

export default config; 