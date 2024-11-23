const isDevelopment = process.env.NODE_ENV === 'development';

const config = {
  API_URL: isDevelopment ? 'http://localhost:3001' : 'http://YOUR_SERVER_IP:3001',
  WS_URL: isDevelopment ? 'ws://localhost:3001/ws' : 'ws://YOUR_SERVER_IP:3001/ws'
};

export default config; 