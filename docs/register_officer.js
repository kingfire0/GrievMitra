const API_BASE_URL = "http://localhost:5000";

async function registerOfficer() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Officer User',
        email: 'officer@grievmitra.gov.in',
        password: 'officer123',
        phone: '9876543210',
        role: 'officer'
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('Officer registered successfully:', data);
      console.log('\n=== OFFICER LOGIN CREDENTIALS ===');
      console.log('Email: officer@grievmitra.gov.in');
      console.log('Password: officer123');
      console.log('\nNote: Verify email before logging in.');
    } else {
      console.log('Registration response:', data);
      if (data.error && data.error.includes('already exists')) {
        console.log('\n=== OFFICER LOGIN CREDENTIALS ===');
        console.log('Email: officer@grievmitra.gov.in');
        console.log('Password: officer123');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

registerOfficer();
