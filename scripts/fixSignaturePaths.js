require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

async function fixSignaturePaths() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find users with old signature paths (without company ID)
        const usersWithOldSignatures = await User.find({
            signaturePath: { $exists: true, $ne: '' },
            signaturePath: { $not: /^[0-9a-f]{24}\// } // Doesn't start with ObjectId pattern
        });

        console.log(`\n🔍 Found ${usersWithOldSignatures.length} users with old signature paths`);

        for (const user of usersWithOldSignatures) {
            console.log(`\n👤 Processing user: ${user.name} (${user._id})`);
            console.log(`   Current signature path: ${user.signaturePath}`);

            // Extract filename from old path
            const oldPath = user.signaturePath;
            const filename = path.basename(oldPath);
            
            // Create new path with company ID
            const newPath = `${user._id}/signatures/${filename}`;
            console.log(`   New signature path: ${newPath}`);

            // Check if old file exists
            const BASE_STORAGE_PATH = path.resolve(__dirname, '..', 'tile_uploads');
            const oldFullPath = path.join(BASE_STORAGE_PATH, oldPath);
            const newFullPath = path.join(BASE_STORAGE_PATH, newPath);

            console.log(`   Old file path: ${oldFullPath}`);
            console.log(`   New file path: ${newFullPath}`);

            // Create new directory structure
            const newDir = path.dirname(newFullPath);
            if (!fs.existsSync(newDir)) {
                fs.mkdirSync(newDir, { recursive: true });
                console.log(`   📁 Created directory: ${newDir}`);
            }

            // Move file if it exists
            if (fs.existsSync(oldFullPath)) {
                try {
                    fs.copyFileSync(oldFullPath, newFullPath);
                    console.log(`   📋 Copied file to new location`);
                    
                    // Verify copy was successful
                    if (fs.existsSync(newFullPath)) {
                        fs.unlinkSync(oldFullPath);
                        console.log(`   🗑️ Deleted old file`);
                    }
                } catch (error) {
                    console.error(`   ❌ Error moving file:`, error.message);
                    continue;
                }
            } else {
                console.log(`   ⚠️ Old file not found, will update path only`);
            }

            // Update database with new path
            try {
                await User.findByIdAndUpdate(
                    user._id,
                    { $set: { signaturePath: newPath } },
                    { runValidators: false }
                );
                console.log(`   ✅ Updated database with new path`);
            } catch (error) {
                console.error(`   ❌ Error updating database:`, error.message);
            }
        }

        console.log(`\n🎉 Signature path migration completed!`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

fixSignaturePaths();