require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// Add this to verify the secret is loaded
console.log('JWT_SECRET loaded:', JWT_SECRET ? 'Yes' : 'No');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

module.exports = { JWT_SECRET }; 