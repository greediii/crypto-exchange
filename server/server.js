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
const auth = require('./middleware/auth');
const WebSocket = require('ws');
const { JWT_SECRET } = require('./config/jwt');
const path = require('path');
const axios = require('axios');

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

console.log(process.env.JWT_SECRET)

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
  origin: [
    'https://teds-project.vercel.app',  // Your Vercel frontend domain
    'http://localhost:3000'             // Local development
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Add after your other middleware, before routes
app.use(express.static(path.join(__dirname, '../public')));

// Add this before your routes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log('Request body:', req.body);
  next();
});

// Routes
app.use('/api/auth', (req, res, next) => {
  console.log('Auth route accessed:', req.path);
  next();
}, authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);

// Test routes for JWT verification
app.get('/api/test/jwt', (req, res) => {
  try {
    // Create a test token with userId
    const testToken = jwt.sign(
      { 
        userId: 1,  // Make sure this user exists in your database
        test: 'data',
        timestamp: Date.now() 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Log the current JWT secret
    console.log('Current JWT_SECRET:', JWT_SECRET);
    
    // Try to verify the token immediately
    const decoded = jwt.verify(testToken, JWT_SECRET);
    
    // Send detailed response
    res.json({
      success: true,
      message: 'JWT configuration is working',
      testToken,
      decoded,
      secretFirstChars: JWT_SECRET.substring(0, 4) + '...',
      test: {
        tokenCreated: true,
        tokenVerified: true,
        tokenLength: testToken.length,
        decodedData: decoded
      }
    });
  } catch (error) {
    // Send detailed error response
    console.error('JWT Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.name,
      secretLoaded: !!JWT_SECRET,
      secretFirstChars: JWT_SECRET ? (JWT_SECRET.substring(0, 4) + '...') : 'not loaded',
      debug: {
        secretExists: !!JWT_SECRET,
        secretType: typeof JWT_SECRET,
        secretLength: JWT_SECRET ? JWT_SECRET.length : 0
      }
    });
  }
});

// Add a protected test route
app.get('/api/test/protected', auth, (req, res) => {
  res.json({
    success: true,
    message: 'You accessed a protected route',
    user: req.user
  });
});

// Add a catch-all route for React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

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
