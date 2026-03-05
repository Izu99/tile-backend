/**
 * Check Specific User Script
 * Check the user mentioned in the error
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const checkUser = async () => {
    try {
        console.log('🔍 Checking specific user...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const userId = '698c2aafc57190cc675a3ff8';
        const user = await User.findById(userId);

        if (!user) {
            console.log('❌ User not found!\n');
            await mongoose.connection.close();
            return;
        }

        console.log(`👤 User: ${user.name} (${user.email})`);
        console.log(`   ID: ${user._id}\n`);

        // Check all counter fields
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

        console.log('📊 Counter Values:');
        let hasNegative = false;
        for (const field of counterFields) {
            const value = user[field];
            const status = value < 0 ? '❌' : value === 0 ? '⚪' : '✅';
            console.log(`   ${status} ${field}: ${value}`);
            if (value < 0) hasNegative = true;
        }

        if (hasNegative) {
            console.log('\n⚠️  User has negative counters! Fixing...\n');
            
            const updates = {};
            for (const field of counterFields) {
                if (user[field] < 0) {
                    updates[field] = 0;
                }
            }

            await User.findByIdAndUpdate(
                userId,
                { $set: updates },
                { runValidators: false }
            );

            console.log('✅ Fixed negative counters\n');
        } else {
            console.log('\n✅ All counters are valid!\n');
        }

        await mongoose.connection.close();
        console.log('✅ Done\n');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkUser();
