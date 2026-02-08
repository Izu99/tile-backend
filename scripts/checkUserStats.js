const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

const User = require('../models/User');

async function checkUserStats() {
    try {
        console.log('🔄 Checking user stats...');
        
        // Get raw user stats
        const userStats = await User.getGlobalSystemStats();
        console.log('📈 User stats:', JSON.stringify(userStats, null, 2));
        
        // Check individual companies
        const companies = await User.find({ role: 'company' }).select('isActive totalCategoriesCount totalItemsCount totalServicesCount companyName');
        console.log('\n📊 Individual companies:');
        companies.forEach(company => {
            console.log(`  ${company.companyName}: active=${company.isActive}, categories=${company.totalCategoriesCount || 0}, items=${company.totalItemsCount || 0}, services=${company.totalServicesCount || 0}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkUserStats();