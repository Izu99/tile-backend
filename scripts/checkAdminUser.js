const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

async function checkAdminUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const adminUserId = '699afdac4710bfd3d928ce83';
        const user = await User.findById(adminUserId).lean();

        if (!user) {
            console.log('User not found!');
            return;
        }

        console.log('\n=== Admin User Data ===');
        console.log('ID:', user._id);
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('Role:', user.role);
        console.log('CompanyId:', user.companyId);
        console.log('CompanyName:', user.companyName);

        if (user.companyId) {
            const companyOwner = await User.findById(user.companyId).lean();
            console.log('\n=== Company Owner Data ===');
            console.log('ID:', companyOwner._id);
            console.log('Name:', companyOwner.name);
            console.log('Email:', companyOwner.email);
            console.log('Role:', companyOwner.role);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAdminUser();
