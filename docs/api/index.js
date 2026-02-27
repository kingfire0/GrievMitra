// Vercel Serverless Function Entry Point
// This file wraps the backend server for Vercel deployment

const app = require('../backend/server.js');

// Export the Express app for Vercel serverless
module.exports = app;
