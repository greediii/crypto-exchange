const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const cryptoRoutes = require('./routes/crypto');
const exchangeRoutes = require('./routes/exchange');
const adminRoutes = require('./routes/admin');
const ticketRoutes = require('./routes/tickets');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: "/ws",
  perMessageDeflate: false
});

// Store authenticated clients with their user info
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  let authenticated = false;

  // Set up a ping interval to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'AUTH') {
        // Verify the token
        const token = data.token;
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          authenticated = true;
          clients.set(ws, { userId: decoded.userId });
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
        } catch (error) {
          ws.close(4001, 'Authentication failed');
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    clients.delete(ws);
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });

  // Close connection if not authenticated within 5 seconds
  setTimeout(() => {
    if (!authenticated) {
      ws.close(4001, 'Authentication timeout');
    }
  }, 5000);
});

// Updated broadcast function
const broadcast = (data) => {
  clients.forEach((userInfo, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Make broadcast available globally
global.broadcastUpdate = broadcast;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Available routes:');
  console.log('- GET  /api/test');
  console.log('- POST /api/auth/login');
  console.log('- POST /api/auth/register');
});

// Add error handling for the server
server.on('error', (error) => {
  console.error('Server error:', error);
}); 