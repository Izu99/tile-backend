const mongoose = require('mongoose');
require('colors');

/**
 * 🔥 SUPPLIER DUPLICATE CLEANUP MIGRATION
 * 
 * This migration script cleans up any existing duplicate supplier names for the same user
 * before applying the new compound unique index { name: 1, user: 1 }.
 * 
 * IMPORTANT: Run this script BEFORE deploying the updated Supplier model
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

// Define Supplier schema for migration (without new indexes)
const SupplierSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    categories: { type: [String], default: [] },
}, { timestamps: true });

const Supplier = mongoose.model('Supplier', SupplierSchema);

/**
 * Find and resolve duplicate supplier names for the same user
 */
const cleanupDuplicateSupplierNames = async () => {
    try {
        console.log('🔍 Scanning for duplicate supplier names within the same user...'.yellow);

        // Aggregate to find duplicates
        const duplicates = await Supplier.aggregate([
            {
                $group: {
                    _id: { 
                        name: '$name', 
                        user: '$user' 
                    },
                    count: { $sum: 1 },
                    docs: { 
                        $push: { 
                            _id: '$_id', 
                            createdAt: '$createdAt',
                            phone: '$phone',
                            email: '$email',
                            address: '$address',
                            categories: '$categories'
                        } 
                    }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (duplicates.length === 0) {
            console.log('✅ No duplicate supplier names found. Database is clean!'.green);
            return { cleaned: 0, total: 0 };
        }

        console.log(`⚠️  Found ${duplicates.length} sets of duplicate supplier names`.yellow);

        let totalCleaned = 0;
        let totalDocuments = 0;

        for (const duplicate of duplicates) {
            const { name, user } = duplicate._id;
            const docs = duplicate.docs;
            totalDocuments += docs.length;

            console.log(`\n🔧 Processing duplicates for supplier: "${name}", user: ${user}`.cyan);
            console.log(`   Found ${docs.length} duplicate documents`.gray);

            // Sort by creation date (keep the oldest, remove the rest)
            docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const keepDoc = docs[0];
            const removeIds = docs.slice(1).map(doc => doc._id);

            console.log(`   Keeping document: ${keepDoc._id}`.green);
            console.log(`     - Created: ${keepDoc.createdAt}`.gray);
            console.log(`     - Phone: ${keepDoc.phone}`.gray);
            console.log(`     - Email: ${keepDoc.email || 'N/A'}`.gray);
            console.log(`     - Categories: ${keepDoc.categories?.join(', ') || 'None'}`.gray);

            console.log(`   Removing ${removeIds.length} duplicate(s):`.red);
            docs.slice(1).forEach((doc, index) => {
                console.log(`     ${index + 1}. ${doc._id} (${doc.phone} - ${doc.email || 'N/A'})`.red);
            });

            // Remove duplicate documents
            const deleteResult = await Supplier.deleteMany({
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

        const remainingDuplicates = await Supplier.aggregate([
            {
                $group: {
                    _id: { 
                        name: '$name', 
                        user: '$user' 
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (remainingDuplicates.length === 0) {
            console.log('✅ Verification passed! No duplicate supplier names remain.'.green.bold);
            return true;
        } else {
            console.log(`❌ Verification failed! ${remainingDuplicates.length} duplicate sets still exist.`.red);
            remainingDuplicates.forEach(dup => {
                console.log(`   - "${dup._id.name}" for user ${dup._id.user}: ${dup.count} documents`.red);
            });
            return false;
        }

    } catch (error) {
        console.error('❌ Error during verification:', error.message.red);
        return false;
    }
};

/**
 * Generate a comprehensive report of the current state
 */
const generateReport = async () => {
    try {
        console.log('\n📊 Generating database report...'.yellow);

        const totalSuppliers = await Supplier.countDocuments();
        const uniqueUsers = await Supplier.distinct('user');
        const uniqueSupplierNames = await Supplier.distinct('name');
        
        const categoryStats = await Supplier.aggregate([
            { $unwind: { path: '$categories', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$categories',
                    count: { $sum: 1 }
                }
            },
            { $match: { _id: { $ne: null } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const phoneStats = await Supplier.aggregate([
            {
                $group: {
                    _id: null,
                    totalWithPhone: { $sum: { $cond: [{ $ne: ['$phone', ''] }, 1, 0] } },
                    totalWithEmail: { $sum: { $cond: [{ $ne: ['$email', ''] }, 1, 0] } },
                    totalWithAddress: { $sum: { $cond: [{ $ne: ['$address', ''] }, 1, 0] } }
                }
            }
        ]);

        console.log('📈 Database Statistics:'.blue.bold);
        console.log(`   Total Suppliers: ${totalSuppliers}`.cyan);
        console.log(`   Unique Users: ${uniqueUsers.length}`.cyan);
        console.log(`   Unique Supplier Names: ${uniqueSupplierNames.length}`.cyan);
        
        if (phoneStats.length > 0) {
            const stats = phoneStats[0];
            console.log('   Contact Information:'.cyan);
            console.log(`     With Phone: ${stats.totalWithPhone}`.gray);
            console.log(`     With Email: ${stats.totalWithEmail}`.gray);
            console.log(`     With Address: ${stats.totalWithAddress}`.gray);
        }

        if (categoryStats.length > 0) {
            console.log('   Top Categories:'.cyan);
            categoryStats.forEach((cat, index) => {
                console.log(`     ${index + 1}. ${cat._id}: ${cat.count} suppliers`.gray);
            });
        }

        // Check for cross-user supplier name usage (this is OK)
        const crossUserNames = await Supplier.aggregate([
            {
                $group: {
                    _id: '$name',
                    users: { $addToSet: '$user' },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (crossUserNames.length > 0) {
            console.log(`\n✅ Found ${crossUserNames.length} supplier names used by multiple users (this is expected):`.green);
            crossUserNames.slice(0, 5).forEach(supplier => {
                console.log(`   "${supplier._id}": used by ${supplier.users.length} different users`.gray);
            });
            if (crossUserNames.length > 5) {
                console.log(`   ... and ${crossUserNames.length - 5} more`.gray);
            }
        }

        // Analyze supplier distribution per user
        const userDistribution = await Supplier.aggregate([
            {
                $group: {
                    _id: '$user',
                    supplierCount: { $sum: 1 },
                    sampleNames: { $push: '$name' }
                }
            },
            {
                $project: {
                    userId: '$_id',
                    supplierCount: 1,
                    sampleNames: { $slice: ['$sampleNames', 3] }
                }
            },
            { $sort: { supplierCount: -1 } }
        ]);

        console.log(`\n📋 Supplier Distribution Analysis for ${userDistribution.length} users:`.blue);
        userDistribution.slice(0, 5).forEach(user => {
            console.log(`   User ${user.userId}: ${user.supplierCount} suppliers`.gray);
            console.log(`     Sample: ${user.sampleNames.join(', ')}`.gray);
        });
        if (userDistribution.length > 5) {
            console.log(`   ... and ${userDistribution.length - 5} more users`.gray);
        }

    } catch (error) {
        console.error('❌ Error generating report:', error.message.red);
    }
};

/**
 * Main migration function
 */
const runMigration = async () => {
    console.log('🚀 Starting Supplier Duplicate Cleanup Migration'.blue.bold);
    console.log('=' .repeat(60).blue);

    try {
        // Connect to database
        await connectDB();

        // Generate initial report
        await generateReport();

        // Clean up duplicates
        const result = await cleanupDuplicateSupplierNames();

        // Verify cleanup
        const verified = await verifyCleanup();

        // Generate final report
        await generateReport();

        if (verified && result.cleaned >= 0) {
            console.log('\n🎉 Migration completed successfully!'.green.bold);
            console.log('✅ Database is ready for the new compound unique index.'.green);
            
            if (result.cleaned > 0) {
                console.log('\n⚠️  IMPORTANT NOTES:'.yellow.bold);
                console.log(`   - ${result.cleaned} duplicate supplier documents were removed`.yellow);
                console.log('   - The oldest document was kept for each duplicate set'.yellow);
                console.log('   - Please verify that the remaining documents are correct'.yellow);
                console.log('   - Consider backing up the database before deploying the new model'.yellow);
                console.log('   - Check for any business impact from removed duplicates'.yellow);
            }

            console.log('\n📋 NEXT STEPS:'.blue.bold);
            console.log('   1. Deploy the updated Supplier model with new indexes'.blue);
            console.log('   2. Verify index creation in production'.blue);
            console.log('   3. Monitor query performance improvements'.blue);
            console.log('   4. Test unique constraint enforcement'.blue);
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
    cleanupDuplicateSupplierNames,
    verifyCleanup,
    generateReport
};