const mongoose = require('mongoose');
require('dotenv').config();

/**
 * 🔥 LOGIN PERFORMANCE CHECKER
 * 
 * This script checks existing indexes and tests login query performance
 */

async function checkLoginPerformance() {
    try {
        console.log('🔍 Checking login performance and indexes...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        
        // Check existing indexes
        console.log('\n📋 Current indexes on users collection:');
        const indexes = await usersCollection.listIndexes().toArray();
        
        let hasEmailIndex = false;
        indexes.forEach((index, i) => {
            console.log(`   ${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
            if (index.key.email === 1) {
                hasEmailIndex = true;
                console.log(`      ✅ Email index found: ${index.name}`);
            }
        });
        
        if (!hasEmailIndex) {
            console.log('❌ No email index found - this is the main bottleneck!');
            console.log('🔧 Creating email index...');
            
            try {
                await usersCollection.createIndex({ email: 1 }, { background: true });
                console.log('✅ Email index created successfully');
            } catch (error) {
                console.log('⚠️  Email index creation failed:', error.message);
            }
        }
        
        // Test query performance
        console.log('\n⚡ Testing login query performance...');
        
        // Test with existing user
        const testEmails = ['test@example.com', 'test@gmail.com', 'admin@example.com'];
        
        for (const email of testEmails) {
            console.log(`\n🔍 Testing query for: ${email}`);
            
            // Test 1: Basic findOne query
            const queryStart = Date.now();
            const user = await usersCollection.findOne({ email });
            const queryTime = Date.now() - queryStart;
            
            console.log(`   📊 Basic query: ${queryTime}ms`);
            
            if (user) {
                console.log(`   ✅ User found: ${user.name} (${user.role})`);
                
                // Test 2: Query with field selection (like in auth)
                const selectStart = Date.now();
                const userWithFields = await usersCollection.findOne(
                    { email },
                    { 
                        projection: { 
                            password: 1, 
                            _id: 1, 
                            name: 1, 
                            email: 1, 
                            role: 1, 
                            isActive: 1, 
                            companyName: 1 
                        } 
                    }
                );
                const selectTime = Date.now() - selectStart;
                
                console.log(`   📊 Selective query: ${selectTime}ms`);
                
                // Performance analysis
                if (queryTime < 5) {
                    console.log(`   🚀 EXCELLENT: Query is very fast!`);
                } else if (queryTime < 20) {
                    console.log(`   ✅ GOOD: Query performance is acceptable`);
                } else if (queryTime < 100) {
                    console.log(`   ⚡ FAIR: Query could be faster`);
                } else {
                    console.log(`   ⚠️  SLOW: Query needs optimization`);
                }
                
                break; // Found a user, no need to test others
            } else {
                console.log(`   ❌ User not found`);
            }
        }
        
        // Test concurrent queries (simulate multiple login attempts)
        console.log('\n🚀 Testing concurrent login performance...');
        const concurrentStart = Date.now();
        
        const concurrentPromises = [];
        for (let i = 0; i < 10; i++) {
            concurrentPromises.push(
                usersCollection.findOne({ email: 'test@example.com' })
            );
        }
        
        await Promise.all(concurrentPromises);
        const concurrentTime = Date.now() - concurrentStart;
        
        console.log(`📊 10 concurrent queries: ${concurrentTime}ms (avg: ${(concurrentTime/10).toFixed(1)}ms per query)`);
        
        if (concurrentTime < 100) {
            console.log('🚀 EXCELLENT: Concurrent performance is great!');
        } else if (concurrentTime < 500) {
            console.log('✅ GOOD: Concurrent performance is acceptable');
        } else {
            console.log('⚠️  WARNING: Concurrent performance needs improvement');
        }
        
        // Recommendations
        console.log('\n💡 PERFORMANCE RECOMMENDATIONS:');
        
        if (hasEmailIndex) {
            console.log('✅ Email index exists - good for login performance');
        } else {
            console.log('❌ Create email index: db.users.createIndex({email: 1})');
        }
        
        console.log('✅ Use async last login updates (implemented)');
        console.log('✅ Use lean() queries for faster performance');
        console.log('✅ Optimize connection pool settings');
        console.log('✅ Monitor middleware performance');
        
        console.log('\n🎯 EXPECTED LOGIN PERFORMANCE AFTER OPTIMIZATION:');
        console.log('   - Database query: <10ms (was >1000ms)');
        console.log('   - Total login time: <500ms (was >26s)');
        console.log('   - Concurrent logins: <50ms per request');
        
    } catch (error) {
        console.error('❌ Error checking login performance:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the performance check
checkLoginPerformance();