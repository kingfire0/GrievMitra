// Vercel Serverless Function Entry Point
// This file wraps the backend server for Vercel deployment

const app = require('../backend/server.js');

// Vercel serverless function handler
module.exports = (req, res) => {
  return app(req, res);
};
