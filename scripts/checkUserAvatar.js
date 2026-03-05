require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function checkUserAvatar() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find user with the specific company ID
        const user = await User.findOne({ _id: '6964cb6d2b1ffc22e5631267' });
        
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log('👤 User found:', user.name);
        console.log('📧 Email:', user.email);
        console.log('🏢 Company:', user.companyName);
        
        console.log('\n📸 Avatar Data:');
        console.log('   avatarId:', user.avatarId || 'Not set');
        console.log('   avatarPath:', user.avatarPath || 'Not set');
        console.log('   originalAvatarName:', user.originalAvatarName || 'Not set');
        console.log('   avatar (Base64):', user.avatar ? `${user.avatar.substring(0, 50)}...` : 'Not set');
        
        console.log('\n🖊️ Signature Data:');
        console.log('   signatureId:', user.signatureId || 'Not set');
        console.log('   signaturePath:', user.signaturePath || 'Not set');
        console.log('   originalSignatureName:', user.originalSignatureName || 'Not set');
        console.log('   signature (Base64):', user.signature ? `${user.signature.substring(0, 50)}...` : 'Not set');

        // Check if avatar file exists
        const fs = require('fs');
        const path = require('path');
        
        if (user.avatarPath) {
            const fullPath = path.resolve(__dirname, '..', '..', 'tile_uploads', user.avatarPath);
            console.log('\n📁 File System Check:');
            console.log('   Expected path:', fullPath);
            console.log('   File exists:', fs.existsSync(fullPath));
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

checkUserAvatar();