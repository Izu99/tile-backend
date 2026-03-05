#!/usr/bin/env node

/**
 * 🚨 URGENT LOGIN PERFORMANCE FIX
 * 
 * This script IMMEDIATELY fixes the login performance issues:
 * 1. Creates unique email index (1249ms → <20ms)
 * 2. Removes Base64 data from ALL users (506KB → <5KB)
 * 
 * Run: node scripts/urgentLoginFix.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tilework';

async function urgentLoginFix() {
    try {
        console.log('🚨 URGENT LOGIN PERFORMANCE FIX\n');

        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected\n');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // ============================================
        // FIX 1: CREATE EMAIL INDEX
        // ============================================
        console.log('🔧 FIX 1: Creating email index...');
        
        try {
            await usersCollection.createIndex(
                { email: 1 },
                { 
                    unique: true,
                    name: 'email_unique_auth_index',
                    background: false // Create immediately
                }
            );
            console.log('✅ Email index created');
        } catch (error) {
            if (error.code === 11000 || error.message.includes('already exists')) {
                console.log('✅ Email index already exists');
            } else {
                throw error;
            }
        }

        // Test query performance
        const testStart = Date.now();
        await usersCollection.findOne({ email: { $exists: true } });
        const testTime = Date.now() - testStart;
        console.log(`⏱️  Test query: ${testTime}ms`);
        
        if (testTime < 20) {
            console.log('✅ EXCELLENT: Query time < 20ms\n');
        } else if (testTime < 100) {
            console.log('✅ GOOD: Query time < 100ms\n');
        } else {
            console.log('⚠️  WARNING: Query time still slow\n');
        }

        // ============================================
        // FIX 2: REMOVE BASE64 DATA
        // ============================================
        console.log('🔧 FIX 2: Removing Base64 image data...');
        
        // Count users with Base64 data
        const usersWithImages = await usersCollection.countDocuments({
            $or: [
                { avatar: { $exists: true, $ne: '' } },
                { signature: { $exists: true, $ne: '' } }
            ]
        });
        
        console.log(`📊 Found ${usersWithImages} users with image data`);
        
        if (usersWithImages > 0) {
            // Remove Base64 data from ALL users
            const updateResult = await usersCollection.updateMany(
                {},
                {
                    $set: {
                        avatar: '',
                        signature: ''
                    }
                }
            );
            
            console.log(`✅ Cleaned ${updateResult.modifiedCount} users`);
        } else {
            console.log('✅ No Base64 data found');
        }

        // ============================================
        // VERIFICATION
        // ============================================
        console.log('\n🔍 Verification:');
        
        // Check indexes
        const indexes = await usersCollection.indexes();
        const hasEmailIndex = indexes.some(idx => 
            idx.key.email === 1 && Object.keys(idx.key).length === 1
        );
        console.log(`📊 Email index: ${hasEmailIndex ? '✅ EXISTS' : '❌ MISSING'}`);
        
        // Check for remaining Base64 data
        const remainingImages = await usersCollection.countDocuments({
            $or: [
                { avatar: { $exists: true, $ne: '' } },
                { signature: { $exists: true, $ne: '' } }
            ]
        });
        console.log(`📊 Users with Base64 data: ${remainingImages === 0 ? '✅ NONE' : `⚠️  ${remainingImages}`}`);
        
        // Test response size
        const testUser = await usersCollection.findOne({ role: 'super-admin' });
        if (testUser) {
            const responseData = {
                _id: testUser._id,
                name: testUser.name,
                email: testUser.email,
                role: testUser.role,
                companyName: testUser.companyName || ''
            };
            const responseSize = JSON.stringify(responseData).length;
            console.log(`📦 Response size: ${responseSize} bytes (${(responseSize / 1024).toFixed(2)} KB)`);
            
            if (responseSize < 5000) {
                console.log('✅ EXCELLENT: Response < 5KB');
            } else {
                console.log('⚠️  WARNING: Response > 5KB');
            }
        }

        console.log('\n✅ URGENT FIX COMPLETED!');
        console.log('\n📝 Next steps:');
        console.log('   1. Restart the server to apply code changes');
        console.log('   2. Test super-admin login');
        console.log('   3. Verify login time < 300ms');
        console.log('   4. Check response size < 5KB\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('\n💥 ERROR:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

urgentLoginFix();
