require("dotenv").config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

async function registerAdmin() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: process.env.ADMIN_NAME || 'Admin User',
        email: process.env.ADMIN_EMAIL || 'admin@grievmitra.gov.in',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        phone: process.env.ADMIN_PHONE || '1234567890',
        role: 'admin'
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('Admin registered successfully:', data);
    } else {
      console.log('Registration failed:', data);
    }
  } catch (error) {
    console.error('Error registering admin:', error);
  }
}

registerAdmin();
