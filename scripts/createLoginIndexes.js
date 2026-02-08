const mongoose = require('mongoose');
require('dotenv').config();

/**
 * 🔥 LOGIN PERFORMANCE OPTIMIZATION SCRIPT
 * 
 * This script creates essential indexes for ultra-fast login performance:
 * 1. Email index for user lookup (most critical)
 * 2. Compound indexes for authentication queries
 * 3. Performance monitoring indexes
 */

async function createLoginIndexes() {
    try {
        console.log('🚀 Starting login performance optimization...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        
        console.log('\n📊 Creating login performance indexes...');
        
        // 🔥 CRITICAL: Email index for fast user lookup
        console.log('1. Creating email index (CRITICAL for login speed)...');
        await usersCollection.createIndex(
            { email: 1 }, 
            { 
                name: 'email_login_index',
                background: true,
                unique: true
            }
        );
        console.log('✅ Email index created');
        
        // 🔥 Authentication compound index
        console.log('2. Creating authentication compound index...');
        await usersCollection.createIndex(
            { email: 1, isActive: 1 }, 
            { 
                name: 'email_active_auth_index',
                background: true
            }
        );
        console.log('✅ Authentication compound index created');
        
        // 🔥 Role-based authentication index
        console.log('3. Creating role-based authentication index...');
        await usersCollection.createIndex(
            { email: 1, role: 1, isActive: 1 }, 
            { 
                name: 'email_role_active_index',
                background: true
            }
        );
        console.log('✅ Role-based authentication index created');
        
        // 🔥 Last login tracking index (for async updates)
        console.log('4. Creating last login tracking index...');
        await usersCollection.createIndex(
            { _id: 1, lastLoginAt: 1 }, 
            { 
                name: 'id_lastlogin_index',
                background: true
            }
        );
        console.log('✅ Last login tracking index created');
        
        // 🔥 Performance monitoring index
        console.log('5. Creating performance monitoring index...');
        await usersCollection.createIndex(
            { role: 1, isActive: 1, createdAt: -1 }, 
            { 
                name: 'role_active_created_index',
                background: true
            }
        );
        console.log('✅ Performance monitoring index created');
        
        // Verify indexes
        console.log('\n📋 Verifying created indexes...');
        const indexes = await usersCollection.listIndexes().toArray();
        
        console.log('\n📊 Current indexes on users collection:');
        indexes.forEach((index, i) => {
            console.log(`   ${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
        });
        
        // Performance test
        console.log('\n⚡ Testing login query performance...');
        const testEmail = 'test@example.com';
        
        const queryStart = Date.now();
        const testUser = await usersCollection.findOne({ email: testEmail });
        const queryTime = Date.now() - queryStart;
        
        console.log(`📊 Email lookup test: ${queryTime}ms`);
        
        if (queryTime < 10) {
            console.log('🚀 EXCELLENT: Email lookup is very fast!');
        } else if (queryTime < 50) {
            console.log('✅ GOOD: Email lookup performance is acceptable');
        } else {
            console.log('⚠️  WARNING: Email lookup is still slow - check network latency');
        }
        
        console.log('\n🎉 Login performance optimization completed successfully!');
        console.log('💡 Expected improvements:');
        console.log('   - Email lookup: 10-100x faster');
        console.log('   - Login API: 5-20x faster overall');
        console.log('   - Reduced database load');
        
    } catch (error) {
        console.error('❌ Error creating login indexes:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the optimization
createLoginIndexes();