const { exec } = require('child_process');
const path = require('path');

class ServerManager {
  static async cleanup() {
    return new Promise((resolve, reject) => {
      // Kill any existing node processes
      exec('taskkill /F /IM node.exe', (error, stdout, stderr) => {
        if (error) {
          console.log('No existing node processes to clean up');
        }
        
        // Wait a moment for ports to be released
        setTimeout(() => {
          // Check if port 3001 is free
          exec('netstat -ano | findstr :3001', (error, stdout, stderr) => {
            if (stdout) {
              console.log('Warning: Port 3001 still has lingering connections');
            }
            resolve();
          });
        }, 1000);
      });
    });
  }

  static async start() {
    try {
      // Clean up first
      await this.cleanup();

      // Start the server
      const server = require('./index');
      
      // Handle graceful shutdown
      process.on('SIGTERM', () => {
        console.log('SIGTERM received. Shutting down gracefully...');
        server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        console.log('SIGINT received. Shutting down gracefully...');
        server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
      });

      return server;
    } catch (error) {
      console.error('Server start error:', error);
      throw error;
    }
  }
}

module.exports = ServerManager; 