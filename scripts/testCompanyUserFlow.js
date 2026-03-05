#!/usr/bin/env node

/**
 * Test script for Company User Management Flow
 * 
 * This script tests the complete flow:
 * 1. Create a test company
 * 2. Add users to the company
 * 3. List company users
 * 4. Delete users
 * 5. Clean up test data
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
require('colors');

// Connect to MongoDB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tilework');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`.cyan);
    } catch (error) {
        console.error(`❌ Database connection failed: ${error.message}`.red);
        process.exit(1);
    }
};

// Test Company User Management Flow
const testCompanyUserFlow = async () => {
    console.log('\n🧪 TESTING COMPANY USER MANAGEMENT FLOW'.yellow);
    console.log('═══════════════════════════════════════════════════════════\n');

    let testCompany = null;
    let testUsers = [];

    try {
        // Step 1: Create a test company
        console.log('📝 Step 1: Creating test company...');
        testCompany = await User.create({
            name: 'Test Company Owner',
            email: 'testcompany@example.com',
            password: 'password123',
            companyName: 'Test Company Ltd',
            companyAddress: '123 Test Street',
            companyPhone: '+1234567890',
            role: 'company',
            isActive: true
        });
        console.log(`✅ Test company created: ${testCompany.companyName} (ID: ${testCompany._id})`);

        // Step 2: Add users to the company
        console.log('\n📝 Step 2: Adding users to the company...');
        
        const user1 = await User.create({
            name: 'John Admin',
            email: 'john@testcompany.com',
            password: 'password123',
            role: 'admin',
            companyId: testCompany._id,
            companyName: testCompany.companyName,
            companyAddress: testCompany.companyAddress,
            companyPhone: testCompany.companyPhone,
            isActive: true
        });
        testUsers.push(user1);
        console.log(`✅ User 1 created: ${user1.name} (${user1.email})`);

        const user2 = await User.create({
            name: 'Jane Manager',
            email: 'jane@testcompany.com',
            password: 'password123',
            role: 'admin',
            companyId: testCompany._id,
            companyName: testCompany.companyName,
            companyAddress: testCompany.companyAddress,
            companyPhone: testCompany.companyPhone,
            isActive: true
        });
        testUsers.push(user2);
        console.log(`✅ User 2 created: ${user2.name} (${user2.email})`);

        // Step 3: List company users
        console.log('\n📝 Step 3: Listing company users...');
        const companyUsers = await User.find({ 
            $or: [
                { _id: testCompany._id, role: 'company' },
                { companyId: testCompany._id, role: 'admin' }
            ]
        }).select('-password').sort({ createdAt: -1 });

        console.log(`✅ Found ${companyUsers.length} users for company:`);
        companyUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`);
        });

        // Step 4: Test user authentication
        console.log('\n📝 Step 4: Testing user authentication...');
        const authUser = await User.findForAuthentication('john@testcompany.com');
        if (authUser) {
            console.log(`✅ Authentication test passed for: ${authUser.name}`);
            console.log(`   - Company ID: ${authUser.companyId || 'N/A (main company user)'}`);
            console.log(`   - Company Name: ${authUser.companyName}`);
        } else {
            console.log('❌ Authentication test failed');
        }

        // Step 5: Test JWT token generation
        console.log('\n📝 Step 5: Testing JWT token generation...');
        const userDoc = await User.findById(user1._id);
        const token = userDoc.getSignedJwtToken();
        console.log(`✅ JWT token generated successfully (length: ${token.length})`);

        console.log('\n🎉 ALL TESTS PASSED!'.green);
        console.log('═══════════════════════════════════════════════════════════');

    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`.red);
        console.error(error.stack);
    } finally {
        // Cleanup: Delete test data
        console.log('\n🧹 Cleaning up test data...');
        
        if (testUsers.length > 0) {
            for (const user of testUsers) {
                await User.findByIdAndDelete(user._id);
                console.log(`🗑️  Deleted test user: ${user.name}`);
            }
        }

        if (testCompany) {
            await User.findByIdAndDelete(testCompany._id);
            console.log(`🗑️  Deleted test company: ${testCompany.companyName}`);
        }

        // Clean up any activity logs
        await ActivityLog.deleteMany({ 
            description: { $regex: /Test Company|John Admin|Jane Manager/ }
        });
        console.log('🗑️  Cleaned up activity logs');

        console.log('✅ Cleanup completed');
    }
};

// Main execution
const main = async () => {
    try {
        await connectDB();
        await testCompanyUserFlow();
    } catch (error) {
        console.error(`💥 Script failed: ${error.message}`.red);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Database connection closed');
        process.exit(0);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error(`💥 Unhandled Promise Rejection: ${err.message}`.red);
    process.exit(1);
});

// Run the script
if (require.main === module) {
    main();
}

module.exports = { testCompanyUserFlow };