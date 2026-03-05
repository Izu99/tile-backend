const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkSubUserAvatar() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find the sub-user with the problematic avatar
        // From path: 69660bcc2b1ffc22e563133a/profiles/69a598b681dd58724461de33.png
        const companyId = '69660bcc2b1ffc22e563133a';
        const subUserId = '69a598b681dd58724461de33';
        
        console.log('\n🔍 Looking for sub-user:', subUserId);
        console.log('   Expected company ID:', companyId);
        
        const subUser = await User.findById(subUserId).lean();

        if (!subUser) {
            console.log('❌ Sub-user not found');
            return;
        }

        console.log('\n📋 Sub-User Details:');
        console.log('   ID:', subUser._id);
        console.log('   Name:', subUser.name);
        console.log('   Email:', subUser.email);
        console.log('   Role:', subUser.role);
        console.log('   Company ID:', subUser.companyId);
        console.log('   Avatar Path:', subUser.avatarPath);
        console.log('   Avatar ID:', subUser.avatarId);

        if (subUser.companyId) {
            console.log('\n📋 Company Owner Details:');
            const companyOwner = await User.findById(subUser.companyId).lean();
            
            if (companyOwner) {
                console.log('   ID:', companyOwner._id);
                console.log('   Name:', companyOwner.name);
                console.log('   Email:', companyOwner.email);
                console.log('   Role:', companyOwner.role);
                console.log('   Avatar Path:', companyOwner.avatarPath);
                console.log('   Avatar ID:', companyOwner.avatarId);

                console.log('\n🔍 Analysis:');
                if (subUser.avatarPath && subUser.avatarPath !== companyOwner.avatarPath) {
                    console.log('   ⚠️ Sub-user has different avatar path than company owner');
                    console.log('   Sub-user path:', subUser.avatarPath);
                    console.log('   Company owner path:', companyOwner.avatarPath);
                    console.log('   ✅ Should inherit from company owner');
                } else if (!companyOwner.avatarPath) {
                    console.log('   ⚠️ Company owner has no avatar path');
                } else {
                    console.log('   ✅ Paths match correctly');
                }
            } else {
                console.log('   ❌ Company owner not found');
            }
        } else {
            console.log('\n⚠️ Sub-user has no companyId set');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

checkSubUserAvatar();
