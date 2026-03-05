/**
 * 🔥 CLEANUP SUPER ADMIN IMAGE DATA
 * 
 * This script removes all image-related fields from super-admin users
 * to optimize performance and reduce payload size.
 * 
 * Fields to be nullified:
 * - avatar (Base64 string)
 * - signature (Base64 string)
 * - avatarId
 * - avatarPath
 * - originalAvatarName
 * - signatureId
 * - signaturePath
 * - originalSignatureName
 * 
 * Run: node scripts/cleanupSuperAdminImages.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const colors = require('colors');

// Connect to database
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected'.green.bold);
    } catch (error) {
        console.error('❌ MongoDB Connection Error:'.red.bold, error);
        process.exit(1);
    }
};

// Cleanup function
const cleanupSuperAdminImages = async () => {
    try {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════'.cyan);
        console.log('🧹 CLEANUP SUPER ADMIN IMAGE DATA'.cyan.bold);
        console.log('═══════════════════════════════════════════════════════════'.cyan);
        console.log('');

        const User = require('../models/User');

        // Find all super-admin users
        console.log('🔍 Finding super-admin users...'.yellow);
        const superAdmins = await User.find({ role: 'super-admin' });
        
        console.log(`📊 Found ${superAdmins.length} super-admin user(s)`.cyan);
        console.log('');

        if (superAdmins.length === 0) {
            console.log('ℹ️  No super-admin users found. Nothing to cleanup.'.yellow);
            return;
        }

        // Display current data
        console.log('📋 Current Image Data:'.yellow);
        superAdmins.forEach((admin, index) => {
            console.log(`\n${index + 1}. ${admin.name} (${admin.email})`.cyan);
            console.log(`   - avatar: ${admin.avatar ? `${admin.avatar.substring(0, 50)}... (${admin.avatar.length} chars)` : 'null'}`.gray);
            console.log(`   - signature: ${admin.signature ? `${admin.signature.substring(0, 50)}... (${admin.signature.length} chars)` : 'null'}`.gray);
            console.log(`   - avatarId: ${admin.avatarId || 'null'}`.gray);
            console.log(`   - avatarPath: ${admin.avatarPath || 'null'}`.gray);
            console.log(`   - signatureId: ${admin.signatureId || 'null'}`.gray);
            console.log(`   - signaturePath: ${admin.signaturePath || 'null'}`.gray);
        });

        console.log('');
        console.log('🗑️  Cleaning up image data...'.yellow);

        // Update all super-admin users
        const result = await User.updateMany(
            { role: 'super-admin' },
            {
                $set: {
                    avatar: '',
                    signature: '',
                    avatarId: '',
                    avatarPath: '',
                    originalAvatarName: '',
                    signatureId: '',
                    signaturePath: '',
                    originalSignatureName: ''
                }
            }
        );

        console.log('');
        console.log('═══════════════════════════════════════════════════════════'.green);
        console.log('✅ CLEANUP COMPLETED'.green.bold);
        console.log('═══════════════════════════════════════════════════════════'.green);
        console.log(`📊 Modified ${result.modifiedCount} user(s)`.green);
        console.log('');

        // Verify cleanup
        console.log('🔍 Verifying cleanup...'.yellow);
        const verifyAdmins = await User.find({ role: 'super-admin' });
        
        let allClean = true;
        verifyAdmins.forEach((admin, index) => {
            const hasImageData = admin.avatar || admin.signature || admin.avatarId || 
                                 admin.avatarPath || admin.signatureId || admin.signaturePath;
            
            if (hasImageData) {
                console.log(`❌ ${admin.name} still has image data!`.red);
                allClean = false;
            } else {
                console.log(`✅ ${admin.name} - All image fields cleared`.green);
            }
        });

        console.log('');
        if (allClean) {
            console.log('✅ All super-admin users are clean!'.green.bold);
        } else {
            console.log('⚠️  Some users still have image data. Please check manually.'.yellow.bold);
        }

        console.log('');
        console.log('💡 Benefits:'.cyan);
        console.log('   - Reduced login payload size (~518KB saved per request)'.cyan);
        console.log('   - Faster authentication response'.cyan);
        console.log('   - Improved super-admin dashboard performance'.cyan);
        console.log('');

    } catch (error) {
        console.error('');
        console.error('═══════════════════════════════════════════════════════════'.red);
        console.error('❌ CLEANUP FAILED'.red.bold);
        console.error('═══════════════════════════════════════════════════════════'.red);
        console.error('Error:', error);
        console.error('');
        throw error;
    }
};

// Main execution
const main = async () => {
    try {
        await connectDB();
        await cleanupSuperAdminImages();
        
        console.log('✅ Script completed successfully'.green.bold);
        process.exit(0);
    } catch (error) {
        console.error('❌ Script failed:'.red.bold, error);
        process.exit(1);
    }
};

// Run the script
main();
