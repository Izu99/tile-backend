const mongoose = require('mongoose');
require('colors');

/**
 * 🔥 SITE VISIT DUPLICATE CLEANUP MIGRATION
 * 
 * This migration script cleans up any existing duplicate site visit IDs for the same company
 * before applying the new compound unique index { id: 1, companyId: 1 }.
 * 
 * IMPORTANT: Run this script BEFORE deploying the updated SiteVisit model
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

// Define SiteVisit schema for migration (without new indexes)
const SiteVisitSchema = new mongoose.Schema({
    id: { type: String, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    projectTitle: { type: String, required: true },
    contactNo: { type: String, required: true },
    location: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, default: 'pending' },
    charge: { type: Number, required: true },
    // ... other fields
}, { timestamps: true });

const SiteVisit = mongoose.model('SiteVisit', SiteVisitSchema);

/**
 * Find and resolve duplicate site visit IDs for the same company
 */
const cleanupDuplicateSiteVisitIds = async () => {
    try {
        console.log('🔍 Scanning for duplicate site visit IDs within the same company...'.yellow);

        // Aggregate to find duplicates
        const duplicates = await SiteVisit.aggregate([
            {
                $group: {
                    _id: { 
                        id: '$id', 
                        companyId: '$companyId' 
                    },
                    count: { $sum: 1 },
                    docs: { 
                        $push: { 
                            _id: '$_id', 
                            createdAt: '$createdAt',
                            customerName: '$customerName',
                            projectTitle: '$projectTitle',
                            status: '$status',
                            charge: '$charge'
                        } 
                    }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (duplicates.length === 0) {
            console.log('✅ No duplicate site visit IDs found. Database is clean!'.green);
            return { cleaned: 0, total: 0 };
        }

        console.log(`⚠️  Found ${duplicates.length} sets of duplicate site visit IDs`.yellow);

        let totalCleaned = 0;
        let totalDocuments = 0;

        for (const duplicate of duplicates) {
            const { id, companyId } = duplicate._id;
            const docs = duplicate.docs;
            totalDocuments += docs.length;

            console.log(`\n🔧 Processing duplicates for site visit ID: ${id}, company: ${companyId}`.cyan);
            console.log(`   Found ${docs.length} duplicate documents`.gray);

            // Sort by creation date (keep the oldest, remove the rest)
            docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const keepDoc = docs[0];
            const removeIds = docs.slice(1).map(doc => doc._id);

            console.log(`   Keeping document: ${keepDoc._id}`.green);
            console.log(`     - Created: ${keepDoc.createdAt}`.gray);
            console.log(`     - Customer: ${keepDoc.customerName}`.gray);
            console.log(`     - Project: ${keepDoc.projectTitle}`.gray);
            console.log(`     - Status: ${keepDoc.status}`.gray);
            console.log(`     - Charge: $${keepDoc.charge}`.gray);

            console.log(`   Removing ${removeIds.length} duplicate(s):`.red);
            docs.slice(1).forEach((doc, index) => {
                console.log(`     ${index + 1}. ${doc._id} (${doc.customerName} - ${doc.status} - $${doc.charge})`.red);
            });

            // Remove duplicate documents
            const deleteResult = await SiteVisit.deleteMany({
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

        const remainingDuplicates = await SiteVisit.aggregate([
            {
                $group: {
                    _id: { 
                        id: '$id', 
                        companyId: '$companyId' 
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (remainingDuplicates.length === 0) {
            console.log('✅ Verification passed! No duplicate site visit IDs remain.'.green.bold);
            return true;
        } else {
            console.log(`❌ Verification failed! ${remainingDuplicates.length} duplicate sets still exist.`.red);
            remainingDuplicates.forEach(dup => {
                console.log(`   - ${dup._id.id} for company ${dup._id.companyId}: ${dup.count} documents`.red);
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

        const totalSiteVisits = await SiteVisit.countDocuments();
        const uniqueCompanies = await SiteVisit.distinct('companyId');
        const uniqueSiteVisitIds = await SiteVisit.distinct('id');
        
        const statusStats = await SiteVisit.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const revenueStats = await SiteVisit.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$charge' },
                    averageCharge: { $avg: '$charge' },
                    minCharge: { $min: '$charge' },
                    maxCharge: { $max: '$charge' }
                }
            }
        ]);

        console.log('📈 Database Statistics:'.blue.bold);
        console.log(`   Total Site Visits: ${totalSiteVisits}`.cyan);
        console.log(`   Unique Companies: ${uniqueCompanies.length}`.cyan);
        console.log(`   Unique Site Visit IDs: ${uniqueSiteVisitIds.length}`.cyan);
        
        console.log('   Status Distribution:'.cyan);
        statusStats.forEach(stat => {
            console.log(`     ${stat._id}: ${stat.count}`.gray);
        });

        if (revenueStats.length > 0) {
            const revenue = revenueStats[0];
            console.log('   Revenue Statistics:'.cyan);
            console.log(`     Total Revenue: $${revenue.totalRevenue?.toFixed(2) || 0}`.gray);
            console.log(`     Average Charge: $${revenue.averageCharge?.toFixed(2) || 0}`.gray);
            console.log(`     Min Charge: $${revenue.minCharge?.toFixed(2) || 0}`.gray);
            console.log(`     Max Charge: $${revenue.maxCharge?.toFixed(2) || 0}`.gray);
        }

        // Check for cross-company site visit ID usage (this is OK)
        const crossCompanyIds = await SiteVisit.aggregate([
            {
                $group: {
                    _id: '$id',
                    companies: { $addToSet: '$companyId' },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (crossCompanyIds.length > 0) {
            console.log(`\n✅ Found ${crossCompanyIds.length} site visit IDs used by multiple companies (this is expected):`.green);
            crossCompanyIds.slice(0, 5).forEach(sv => {
                console.log(`   ${sv._id}: used by ${sv.companies.length} different companies`.gray);
            });
            if (crossCompanyIds.length > 5) {
                console.log(`   ... and ${crossCompanyIds.length - 5} more`.gray);
            }
        }

        // Analyze ID numbering patterns
        const idPatterns = await SiteVisit.aggregate([
            {
                $group: {
                    _id: '$companyId',
                    siteVisitIds: { $push: '$id' },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    companyId: '$_id',
                    count: 1,
                    sampleIds: { $slice: ['$siteVisitIds', 5] }
                }
            }
        ]);

        console.log(`\n📋 ID Numbering Analysis for ${idPatterns.length} companies:`.blue);
        idPatterns.slice(0, 3).forEach(pattern => {
            console.log(`   Company ${pattern.companyId}: ${pattern.count} site visits`.gray);
            console.log(`     Sample IDs: ${pattern.sampleIds.join(', ')}`.gray);
        });
        if (idPatterns.length > 3) {
            console.log(`   ... and ${idPatterns.length - 3} more companies`.gray);
        }

    } catch (error) {
        console.error('❌ Error generating report:', error.message.red);
    }
};

/**
 * Main migration function
 */
const runMigration = async () => {
    console.log('🚀 Starting Site Visit Duplicate Cleanup Migration'.blue.bold);
    console.log('=' .repeat(60).blue);

    try {
        // Connect to database
        await connectDB();

        // Generate initial report
        await generateReport();

        // Clean up duplicates
        const result = await cleanupDuplicateSiteVisitIds();

        // Verify cleanup
        const verified = await verifyCleanup();

        // Generate final report
        await generateReport();

        if (verified && result.cleaned >= 0) {
            console.log('\n🎉 Migration completed successfully!'.green.bold);
            console.log('✅ Database is ready for the new compound unique index.'.green);
            
            if (result.cleaned > 0) {
                console.log('\n⚠️  IMPORTANT NOTES:'.yellow.bold);
                console.log(`   - ${result.cleaned} duplicate site visit documents were removed`.yellow);
                console.log('   - The oldest document was kept for each duplicate set'.yellow);
                console.log('   - Please verify that the remaining documents are correct'.yellow);
                console.log('   - Consider backing up the database before deploying the new model'.yellow);
                console.log('   - Check for any business impact from removed duplicates'.yellow);
            }

            console.log('\n📋 NEXT STEPS:'.blue.bold);
            console.log('   1. Deploy the updated SiteVisit model with new indexes'.blue);
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
    cleanupDuplicateSiteVisitIds,
    verifyCleanup,
    generateReport
};