async function registerAdmin() {
  try {
    const response = await fetch('http://localhost:5000/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Admin User',
        email: 'admin@grievmitra.gov.in',
        password: 'admin123',
        phone: '1234567890',
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
