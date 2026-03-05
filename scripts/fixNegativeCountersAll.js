/**
 * Fix All Negative Counters Script
 * 
 * This script fixes all negative counter values in the User model
 * by setting them to 0 (their minimum allowed value).
 * 
 * Run with: node scripts/fixNegativeCountersAll.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const fixAllNegativeCounters = async () => {
    try {
        console.log('🔧 Starting fix for all negative counters...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Define all counter fields that should never be negative
        const counterFields = [
            'totalCategoriesCount',
            'totalItemsCount',
            'totalServicesCount',
            'totalSuppliersCount',
            'totalQuotationsCount',
            'totalInvoicesCount',
            'totalMaterialSalesCount',
            'totalPurchaseOrdersCount',
            'totalJobCostsCount',
            'totalSiteVisitsCount',
            'siteVisitCounter',
            'materialSaleCounter',
            'jobCostCounter'
        ];

        console.log('📊 Counter fields to check:', counterFields.join(', '), '\n');

        // Find all users with any negative counter
        const query = {
            $or: counterFields.map(field => ({ [field]: { $lt: 0 } }))
        };

        const usersWithNegativeCounters = await User.find(query);
        
        console.log(`🔍 Found ${usersWithNegativeCounters.length} users with negative counters\n`);

        if (usersWithNegativeCounters.length === 0) {
            console.log('✅ No negative counters found! All counters are valid.\n');
            await mongoose.connection.close();
            return;
        }

        // Fix each user
        let fixedCount = 0;
        for (const user of usersWithNegativeCounters) {
            console.log(`\n👤 Fixing user: ${user.name} (${user.email})`);
            console.log(`   ID: ${user._id}`);
            
            const updates = {};
            let hasNegative = false;

            // Check each counter field
            for (const field of counterFields) {
                const value = user[field];
                if (value < 0) {
                    console.log(`   ❌ ${field}: ${value} → 0`);
                    updates[field] = 0;
                    hasNegative = true;
                } else if (value === undefined || value === null) {
                    console.log(`   ⚠️  ${field}: ${value} → 0 (undefined/null)`);
                    updates[field] = 0;
                    hasNegative = true;
                }
            }

            if (hasNegative) {
                // Use findByIdAndUpdate to avoid validation issues
                await User.findByIdAndUpdate(
                    user._id,
                    { $set: updates },
                    { runValidators: false } // Skip validation to allow the fix
                );
                
                fixedCount++;
                console.log(`   ✅ Fixed ${Object.keys(updates).length} counters`);
            }
        }

        console.log(`\n✅ Successfully fixed ${fixedCount} users\n`);

        // Verify the fix
        console.log('🔍 Verifying fix...');
        const remainingNegative = await User.find(query);
        
        if (remainingNegative.length === 0) {
            console.log('✅ Verification passed! No negative counters remain.\n');
        } else {
            console.log(`⚠️  Warning: ${remainingNegative.length} users still have negative counters\n`);
            for (const user of remainingNegative) {
                console.log(`   - ${user.name} (${user.email})`);
                for (const field of counterFields) {
                    if (user[field] < 0) {
                        console.log(`     ${field}: ${user[field]}`);
                    }
                }
            }
        }

        // Close connection
        await mongoose.connection.close();
        console.log('✅ Database connection closed\n');
        console.log('🎉 Script completed successfully!\n');

    } catch (error) {
        console.error('❌ Error fixing negative counters:', error);
        process.exit(1);
    }
};

// Run the script
fixAllNegativeCounters();
