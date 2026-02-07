const mongoose = require('mongoose');
require('colors');

/**
 * 🔥 QUOTATION DOCUMENT DUPLICATE CLEANUP MIGRATION
 * 
 * This migration script cleans up any existing duplicate documentNumbers for the same user and type
 * before applying the new compound unique index { documentNumber: 1, type: 1, user: 1 }.
 * 
 * IMPORTANT: Run this script BEFORE deploying the updated QuotationDocument model
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

// Define QuotationDocument schema for migration (without new indexes)
const QuotationDocumentSchema = new mongoose.Schema({
    documentNumber: { type: String, required: true },
    type: { type: String, enum: ['quotation', 'invoice'], default: 'quotation' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    projectTitle: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    invoiceDate: { type: Date, default: Date.now },
    // ... other fields
}, { timestamps: true });

const QuotationDocument = mongoose.model('QuotationDocument', QuotationDocumentSchema);

/**
 * Find and resolve duplicate documentNumbers for the same user and type
 */
const cleanupDuplicateDocuments = async () => {
    try {
        console.log('🔍 Scanning for duplicate documentNumbers within the same user and type...'.yellow);

        // Aggregate to find duplicates
        const duplicates = await QuotationDocument.aggregate([
            {
                $group: {
                    _id: { 
                        documentNumber: '$documentNumber', 
                        type: '$type', 
                        user: '$user' 
                    },
                    count: { $sum: 1 },
                    docs: { 
                        $push: { 
                            _id: '$_id', 
                            createdAt: '$createdAt',
                            customerName: '$customerName',
                            projectTitle: '$projectTitle',
                            status: '$status'
                        } 
                    }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (duplicates.length === 0) {
            console.log('✅ No duplicate documentNumbers found. Database is clean!'.green);
            return { cleaned: 0, total: 0 };
        }

        console.log(`⚠️  Found ${duplicates.length} sets of duplicate documentNumbers`.yellow);

        let totalCleaned = 0;
        let totalDocuments = 0;

        for (const duplicate of duplicates) {
            const { documentNumber, type, user } = duplicate._id;
            const docs = duplicate.docs;
            totalDocuments += docs.length;

            console.log(`\n🔧 Processing duplicates for documentNumber: ${documentNumber}, type: ${type}, user: ${user}`.cyan);
            console.log(`   Found ${docs.length} duplicate documents`.gray);

            // Sort by creation date (keep the oldest, remove the rest)
            docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const keepDoc = docs[0];
            const removeIds = docs.slice(1).map(doc => doc._id);

            console.log(`   Keeping document: ${keepDoc._id}`.green);
            console.log(`     - Created: ${keepDoc.createdAt}`.gray);
            console.log(`     - Customer: ${keepDoc.customerName}`.gray);
            console.log(`     - Project: ${keepDoc.projectTitle || 'N/A'}`.gray);
            console.log(`     - Status: ${keepDoc.status}`.gray);

            console.log(`   Removing ${removeIds.length} duplicate(s):`.red);
            docs.slice(1).forEach((doc, index) => {
                console.log(`     ${index + 1}. ${doc._id} (${doc.customerName} - ${doc.status})`.red);
            });

            // Remove duplicate documents
            const deleteResult = await QuotationDocument.deleteMany({
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

        const remainingDuplicates = await QuotationDocument.aggregate([
            {
                $group: {
                    _id: { 
                        documentNumber: '$documentNumber', 
                        type: '$type', 
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
            console.log('✅ Verification passed! No duplicate documentNumbers remain.'.green.bold);
            return true;
        } else {
            console.log(`❌ Verification failed! ${remainingDuplicates.length} duplicate sets still exist.`.red);
            remainingDuplicates.forEach(dup => {
                console.log(`   - ${dup._id.documentNumber} (${dup._id.type}) for user ${dup._id.user}: ${dup.count} documents`.red);
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

        const totalDocs = await QuotationDocument.countDocuments();
        const uniqueUsers = await QuotationDocument.distinct('user');
        const typeStats = await QuotationDocument.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);
        const statusStats = await QuotationDocument.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        console.log('📈 Database Statistics:'.blue.bold);
        console.log(`   Total Quotation Documents: ${totalDocs}`.cyan);
        console.log(`   Unique Users: ${uniqueUsers.length}`.cyan);
        
        console.log('   Document Types:'.cyan);
        typeStats.forEach(stat => {
            console.log(`     ${stat._id}: ${stat.count}`.gray);
        });
        
        console.log('   Document Status Distribution:'.cyan);
        statusStats.forEach(stat => {
            console.log(`     ${stat._id}: ${stat.count}`.gray);
        });

        // Check for cross-user document number usage (this is OK)
        const crossUserDocs = await QuotationDocument.aggregate([
            {
                $group: {
                    _id: { documentNumber: '$documentNumber', type: '$type' },
                    users: { $addToSet: '$user' },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        if (crossUserDocs.length > 0) {
            console.log(`\n✅ Found ${crossUserDocs.length} document numbers used by multiple users (this is expected):`.green);
            crossUserDocs.slice(0, 5).forEach(doc => {
                console.log(`   ${doc._id.documentNumber} (${doc._id.type}): used by ${doc.users.length} different users`.gray);
            });
            if (crossUserDocs.length > 5) {
                console.log(`   ... and ${crossUserDocs.length - 5} more`.gray);
            }
        }

        // Check for potential issues with document numbering
        const numberingIssues = await QuotationDocument.aggregate([
            {
                $group: {
                    _id: '$user',
                    quotationNumbers: {
                        $push: {
                            $cond: [
                                { $eq: ['$type', 'quotation'] },
                                '$documentNumber',
                                null
                            ]
                        }
                    },
                    invoiceNumbers: {
                        $push: {
                            $cond: [
                                { $eq: ['$type', 'invoice'] },
                                '$documentNumber',
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        console.log(`\n📋 Document Numbering Analysis for ${numberingIssues.length} users completed`.blue);

    } catch (error) {
        console.error('❌ Error generating report:', error.message.red);
    }
};

/**
 * Main migration function
 */
const runMigration = async () => {
    console.log('🚀 Starting Quotation Document Duplicate Cleanup Migration'.blue.bold);
    console.log('=' .repeat(70).blue);

    try {
        // Connect to database
        await connectDB();

        // Generate initial report
        await generateReport();

        // Clean up duplicates
        const result = await cleanupDuplicateDocuments();

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
                console.log('   - Check for any business impact from removed duplicates'.yellow);
            }

            console.log('\n📋 NEXT STEPS:'.blue.bold);
            console.log('   1. Deploy the updated QuotationDocument model with new indexes'.blue);
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
    cleanupDuplicateDocuments,
    verifyCleanup,
    generateReport
};