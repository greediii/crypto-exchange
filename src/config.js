const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? 'https://your-render-app.onrender.com' 
    : 'http://localhost:3001',
  WS_URL: process.env.NODE_ENV === 'production'
    ? 'wss://your-render-app.onrender.com/ws'
    : 'ws://localhost:3001/ws'
};

export default config; 