const mongoose = require('mongoose');
const colors = require('colors');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tile-management';

async function checkUserData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB'.green);

        const User = require('../models/User');

        // Find all company users
        const users = await User.find({ role: 'company' })
            .select('name email companyName avatar signature avatarPath signaturePath avatarId signatureId')
            .lean();

        console.log(`\n📊 Found ${users.length} company users\n`.cyan);

        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.email})`.yellow);
            console.log(`   Company: ${user.companyName || 'N/A'}`);
            
            // Check avatar data
            if (user.avatar && user.avatar.length > 0) {
                const avatarSize = user.avatar.length;
                const avatarSizeKB = (avatarSize / 1024).toFixed(2);
                console.log(`   ⚠️  Avatar (Base64): ${avatarSizeKB} KB`.red);
            } else if (user.avatarPath) {
                console.log(`   ✅ Avatar Path: ${user.avatarPath}`.green);
            } else {
                console.log(`   ℹ️  No avatar`);
            }

            // Check signature data
            if (user.signature && user.signature.length > 0) {
                const signatureSize = user.signature.length;
                const signatureSizeKB = (signatureSize / 1024).toFixed(2);
                console.log(`   ⚠️  Signature (Base64): ${signatureSizeKB} KB`.red);
            } else if (user.signaturePath) {
                console.log(`   ✅ Signature Path: ${user.signaturePath}`.green);
            } else {
                console.log(`   ℹ️  No signature`);
            }

            console.log('');
        });

        // Summary
        const usersWithBase64Avatar = users.filter(u => u.avatar && u.avatar.length > 100);
        const usersWithBase64Signature = users.filter(u => u.signature && u.signature.length > 100);

        console.log('📈 Summary:'.cyan);
        console.log(`   Total users: ${users.length}`);
        console.log(`   Users with Base64 avatar: ${usersWithBase64Avatar.length}`.yellow);
        console.log(`   Users with Base64 signature: ${usersWithBase64Signature.length}`.yellow);

        if (usersWithBase64Avatar.length > 0 || usersWithBase64Signature.length > 0) {
            console.log('\n⚠️  WARNING: Some users have Base64 image data!'.red);
            console.log('   This can cause performance issues during login and PDF generation.'.yellow);
            console.log('\n💡 Solution: Run cleanup script:'.cyan);
            console.log('   node scripts/cleanupUserImages.js'.white);
        } else {
            console.log('\n✅ All users are clean (no Base64 data)!'.green);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB'.green);
    }
}

checkUserData();
