// Dynamic API Base URL - works locally and on deployment
// For local development: http://localhost:5000
// For production: set API_BASE_URL environment variable or use current hostname

const getApiBaseUrl = () => {
  // Check if custom API URL is set in environment variable (for Vercel)
  // You can set this in Vercel dashboard: Settings > Environment Variables
  if (typeof window !== 'undefined' && window.ENV && window.ENV.API_BASE_URL) {
    return window.ENV.API_BASE_URL;
  }
  
  // Check if we're on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // For production deployment on Vercel, use the current origin
  // This will work when backend is also on Vercel or separate hosting
  return window.location.origin;
};

export const API_BASE_URL = getApiBaseUrl();
