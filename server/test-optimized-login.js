const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function testOptimizedLogin() {
    console.log('🚀 Testing Optimized Login Performance');
    console.log('=====================================');
    
    try {
        // Test multiple login attempts to measure performance
        const testCases = [
            { email: 'test@example.com', password: 'password123', name: 'Test 1' },
            { email: 'test@example.com', password: 'password123', name: 'Test 2' },
            { email: 'test@example.com', password: 'password123', name: 'Test 3' }
        ];
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`\n${i + 1}. ${testCase.name} - Testing login performance...`);
            
            const startTime = Date.now();
            
            try {
                const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
                    email: testCase.email,
                    password: testCase.password
                });
                
                const totalTime = Date.now() - startTime;
                
                console.log(`✅ Login successful in ${totalTime}ms`);
                console.log(`📋 User: ${loginResponse.data.data.user.name}`);
                console.log(`📋 Role: ${loginResponse.data.data.user.role}`);
                console.log(`📋 Token length: ${loginResponse.data.data.token.length}`);
                
                // Performance analysis
                if (totalTime < 500) {
                    console.log(`🚀 EXCELLENT: Login took ${totalTime}ms - very fast!`);
                } else if (totalTime < 1000) {
                    console.log(`✅ GOOD: Login took ${totalTime}ms - acceptable`);
                } else if (totalTime < 5000) {
                    console.log(`⚡ FAIR: Login took ${totalTime}ms - could be better`);
                } else {
                    console.log(`⚠️  SLOW: Login took ${totalTime}ms - needs more optimization`);
                }
                
            } catch (error) {
                const totalTime = Date.now() - startTime;
                console.log(`❌ Login failed after ${totalTime}ms:`, error.message);
                if (error.response) {
                    console.log('Response status:', error.response.status);
                    console.log('Response data:', error.response.data);
                }
            }
        }
        
        // Test concurrent logins
        console.log('\n🚀 Testing concurrent login performance...');
        const concurrentStart = Date.now();
        
        const concurrentPromises = [];
        for (let i = 0; i < 5; i++) {
            concurrentPromises.push(
                axios.post(`${BASE_URL}/auth/login`, {
                    email: 'test@example.com',
                    password: 'password123'
                }).catch(error => ({ error: error.message }))
            );
        }
        
        const results = await Promise.all(concurrentPromises);
        const concurrentTime = Date.now() - concurrentStart;
        
        const successCount = results.filter(r => !r.error).length;
        console.log(`📊 5 concurrent logins: ${concurrentTime}ms (avg: ${(concurrentTime/5).toFixed(1)}ms per login)`);
        console.log(`✅ Successful logins: ${successCount}/5`);
        
        if (concurrentTime < 2000) {
            console.log('🚀 EXCELLENT: Concurrent performance is great!');
        } else if (concurrentTime < 5000) {
            console.log('✅ GOOD: Concurrent performance is acceptable');
        } else {
            console.log('⚠️  WARNING: Concurrent performance needs improvement');
        }
        
        console.log('\n🎉 Login performance test completed!');
        console.log('💡 Check server logs for detailed performance breakdown');
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

// Run the test
testOptimizedLogin();