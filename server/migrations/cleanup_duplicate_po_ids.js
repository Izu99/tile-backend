const mongoose = require('mongoose');
require('colors');

/**
 * 🔥 PURCHASE ORDER DUPLICATE CLEANUP MIGRATION
 * 
 * This migration script cleans up any existing duplicate poIds for the same user
 * before applying the new compound unique index { poId: 1, user: 1 }.
 * 
 * IMPORTANT: Run this script BEFORE deploying the updated PurchaseOrder model
 * to avoid unique constraint violations.
 */

// Connect to MongoDB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`.cyan.underline);
    } catch (error) {
        console.error('❌ Database connection failed:', error.message.red);
        process.exit(1);
    }
};

// Define PurchaseOrder schema for migration (without new indexes)
const PurchaseOrderSchema = new mongoose.Schema({
    poId: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    orderDate: { type: Date, default: Date.now },
    status: { type: String, default: 'Draft' },
    items: [{ type: mongoose.Schema.Types.Mixed }],
    // ... other fields
}, { timestamps: true });

const PurchaseOrder = mongoose.model('PurchaseOrder', PurchaseOrderSchema);

/**
 * Find and resolve duplicate poIds for the same user
 */
const cleanupDuplicatePoIds = async () => {
    try {
        console.log('🔍 Scanning for duplicate poIds within the same user...'.yellow);

        // Aggregate to find duplicates
        const duplicates = await PurchaseOrder.aggregate([
            {
                $group: {
                    _id: { poId: '$poId', user: '$user' },
                    count: { $sum: 1 },
                    docs: { $push: { _id: '$_id', createdAt: '$createdAt' } }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (duplicates.length === 0) {
            console.log('✅ No duplicate poIds found. Database is clean!'.green);
            return { cleaned: 0, total: 0 };
        }

        console.log(`⚠️  Found ${duplicates.length} sets of duplicate poIds`.yellow);

        let totalCleaned = 0;
        let totalDocuments = 0;

        for (const duplicate of duplicates) {
            const { poId, user } = duplicate._id;
            const docs = duplicate.docs;
            totalDocuments += docs.length;

            console.log(`\n🔧 Processing duplicates for poId: ${poId}, user: ${user}`.cyan);
            console.log(`   Found ${docs.length} duplicate documents`.gray);

            // Sort by creation date (keep the oldest, remove the rest)
            docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const keepDoc = docs[0];
            const removeIds = docs.slice(1).map(doc => doc._id);

            console.log(`   Keeping document: ${keepDoc._id} (created: ${keepDoc.createdAt})`.green);
            console.log(`   Removing ${removeIds.length} duplicate(s): ${removeIds.join(', ')}`.red);

            // Remove duplicate documents
            const deleteResult = await PurchaseOrder.deleteMany({
                _id: { $in: removeIds }
            });

            console.log(`   ✅ Removed ${deleteResult.deletedCount} duplicate documents`.green);
            totalCleaned += deleteResult.deletedCount;
        }

        console.log(`\n🎉 Cleanup completed!`.green.bold);
        console.log(`   Total documents processed: ${totalDocuments}`.cyan);
        console.log(`   Duplicate documents removed: ${totalCleaned}`.green);
        console.log(`   Documents remaining: ${totalDocuments - totalCleaned}`.blue);

        return { cleaned: totalCleaned, total: totalDocuments };

    } catch (error) {
        console.error('❌ Error during cleanup:', error.message.red);
        throw error;
    }
};

/**
 * Verify the cleanup was successful
 */
const verifyCleanup = async () => {
    try {
        console.log('\n🔍 Verifying cleanup results...'.yellow);

        const remainingDuplicates = await PurchaseOrder.aggregate([
            {
                $group: {
                    _id: { poId: '$poId', user: '$user' },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (remainingDuplicates.length === 0) {
            console.log('✅ Verification passed! No duplicate poIds remain.'.green.bold);
            return true;
        } else {
            console.log(`❌ Verification failed! ${remainingDuplicates.length} duplicate sets still exist.`.red);
            return false;
        }

    } catch (error) {
        console.error('❌ Error during verification:', error.message.red);
        return false;
    }
};

/**
 * Generate a report of the current state
 */
const generateReport = async () => {
    try {
        console.log('\n📊 Generating database report...'.yellow);

        const totalPOs = await PurchaseOrder.countDocuments();
        const uniqueUsers = await PurchaseOrder.distinct('user');
        const uniquePoIds = await PurchaseOrder.distinct('poId');

        console.log('📈 Database Statistics:'.blue.bold);
        console.log(`   Total Purchase Orders: ${totalPOs}`.cyan);
        console.log(`   Unique Users: ${uniqueUsers.length}`.cyan);
        console.log(`   Unique PO IDs: ${uniquePoIds.length}`.cyan);

        // Check for any remaining issues
        const potentialIssues = await PurchaseOrder.aggregate([
            {
                $group: {
                    _id: '$poId',
                    users: { $addToSet: '$user' },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (potentialIssues.length > 0) {
            console.log(`\n⚠️  Found ${potentialIssues.length} poIds used by multiple users (this is OK):`.yellow);
            potentialIssues.slice(0, 5).forEach(issue => {
                console.log(`   ${issue._id}: used by ${issue.users.length} different users`.gray);
            });
            if (potentialIssues.length > 5) {
                console.log(`   ... and ${potentialIssues.length - 5} more`.gray);
            }
        }

    } catch (error) {
        console.error('❌ Error generating report:', error.message.red);
    }
};

/**
 * Main migration function
 */
const runMigration = async () => {
    console.log('🚀 Starting Purchase Order Duplicate Cleanup Migration'.blue.bold);
    console.log('=' .repeat(60).blue);

    try {
        // Connect to database
        await connectDB();

        // Generate initial report
        await generateReport();

        // Clean up duplicates
        const result = await cleanupDuplicatePoIds();

        // Verify cleanup
        const verified = await verifyCleanup();

        // Generate final report
        await generateReport();

        if (verified && result.cleaned >= 0) {
            console.log('\n🎉 Migration completed successfully!'.green.bold);
            console.log('✅ Database is ready for the new compound unique index.'.green);
            
            if (result.cleaned > 0) {
                console.log('\n⚠️  IMPORTANT NOTES:'.yellow.bold);
                console.log(`   - ${result.cleaned} duplicate documents were removed`.yellow);
                console.log('   - The oldest document was kept for each duplicate set'.yellow);
                console.log('   - Please verify that the remaining documents are correct'.yellow);
                console.log('   - Consider backing up the database before deploying the new model'.yellow);
            }
        } else {
            console.log('\n❌ Migration failed or verification unsuccessful'.red.bold);
            console.log('   Please review the errors above and run the migration again'.red);
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message.red);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('\n📡 Database connection closed'.gray);
    }
};

// Run migration if this file is executed directly
if (require.main === module) {
    // Load environment variables
    require('dotenv').config();
    
    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI environment variable is required'.red);
        process.exit(1);
    }

    runMigration();
}

module.exports = {
    runMigration,
    cleanupDuplicatePoIds,
    verifyCleanup,
    generateReport
};