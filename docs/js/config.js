// Dynamic API Base URL - works locally and on deployment
// For local development: http://localhost:5000
// For Koyeb: https://your-app.koyeb.app

const getApiBaseUrl = () => {
  // Check if we're on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // For production deployment (Koyeb, Railway, etc.)
  // Use the current protocol and hostname
  return `${window.location.protocol}//${window.location.hostname}`;
};

export const API_BASE_URL = getApiBaseUrl();
