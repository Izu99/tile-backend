const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

/**
 * Script to fix negative counter values in User documents
 * This addresses the validation error where totalQuotationsCount is -5
 */

async function fixNegativeCounters() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find users with negative counter values
        const usersWithNegativeCounters = await User.find({
            $or: [
                { totalCategoriesCount: { $lt: 0 } },
                { totalItemsCount: { $lt: 0 } },
                { totalServicesCount: { $lt: 0 } },
                { totalSuppliersCount: { $lt: 0 } },
                { totalQuotationsCount: { $lt: 0 } },
                { totalInvoicesCount: { $lt: 0 } },
                { totalMaterialSalesCount: { $lt: 0 } },
                { totalPurchaseOrdersCount: { $lt: 0 } },
                { totalJobCostsCount: { $lt: 0 } },
                { totalSiteVisitsCount: { $lt: 0 } },
                { siteVisitCounter: { $lt: 0 } },
                { materialSaleCounter: { $lt: 0 } },
                { jobCostCounter: { $lt: 0 } }
            ]
        });

        console.log(`🔍 Found ${usersWithNegativeCounters.length} users with negative counters`);

        if (usersWithNegativeCounters.length === 0) {
            console.log('✅ No users with negative counters found');
            return;
        }

        // Fix each user
        for (const user of usersWithNegativeCounters) {
            console.log(`🔧 Fixing user: ${user.name} (${user._id})`);
            
            const updates = {};
            
            // Check and fix each counter field
            const counterFields = [
                'totalCategoriesCount', 'totalItemsCount', 'totalServicesCount',
                'totalSuppliersCount', 'totalQuotationsCount', 'totalInvoicesCount',
                'totalMaterialSalesCount', 'totalPurchaseOrdersCount', 'totalJobCostsCount',
                'totalSiteVisitsCount', 'siteVisitCounter', 'materialSaleCounter', 'jobCostCounter'
            ];

            for (const field of counterFields) {
                if (user[field] < 0) {
                    console.log(`  - Fixing ${field}: ${user[field]} → 0`);
                    updates[field] = 0;
                }
            }

            // Update the user with fixed counters
            await User.findByIdAndUpdate(
                user._id,
                { $set: updates },
                { validateBeforeSave: false } // Skip validation to avoid the error
            );

            console.log(`✅ Fixed user: ${user.name}`);
        }

        console.log('🎉 All negative counters have been fixed!');

    } catch (error) {
        console.error('❌ Error fixing negative counters:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
    }
}

// Run the script
fixNegativeCounters();