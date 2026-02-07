const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAuthFlow() {
    console.log('🔍 Testing Authentication Flow');
    console.log('==============================');
    
    try {
        // Step 1: Test server health
        console.log('\n1. Testing server health...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Server health:', healthResponse.data);
        
        // Step 2: Login to get a token
        console.log('\n2. Attempting login...');
        const loginData = {
            email: 'test@example.com', // Use the test user we just created
            password: 'password123'    // Use the test password
        };
        
        try {
            const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
            console.log('✅ Login successful');
            
            const token = loginResponse.data.data.token;
            console.log(`🔑 Token received: ${token.substring(0, 50)}...`);
            console.log(`🔑 Token length: ${token.length}`);
            
            // Step 3: Test protected endpoint with token
            console.log('\n3. Testing protected endpoint (/quotations)...');
            const quotationsResponse = await axios.get(`${BASE_URL}/quotations`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Quotations endpoint successful');
            console.log(`📊 Response data:`, quotationsResponse.data);
            
        } catch (loginError) {
            if (loginError.response) {
                console.log('❌ Login failed:', loginError.response.data);
                console.log('Status:', loginError.response.status);
            } else {
                console.log('❌ Login error:', loginError.message);
            }
            
            // Try with different credentials or create a test user
            console.log('\n🔄 Trying to register a test user...');
            const timestamp = Date.now();
            const registerData = {
                name: 'Test User',
                email: `test${timestamp}@example.com`, // Use timestamp to avoid conflicts
                password: 'password123',
                companyName: 'Test Company'
            };
            
            try {
                const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
                console.log('✅ Registration successful');
                
                const token = registerResponse.data.data.token;
                console.log(`🔑 New token: ${token.substring(0, 50)}...`);
                
                // Test with new token
                console.log('\n3. Testing with new token...');
                const quotationsResponse = await axios.get(`${BASE_URL}/quotations`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('✅ Quotations endpoint successful with new token');
                console.log(`📊 Response:`, quotationsResponse.data);
                
            } catch (registerError) {
                if (registerError.response) {
                    console.log('❌ Registration failed:', registerError.response.data);
                } else {
                    console.log('❌ Registration error:', registerError.message);
                }
            }
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

// Run the test
testAuthFlow();