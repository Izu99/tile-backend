const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const CacheService = require('../services/cacheService');
const User = require('../models/User');

async function clearCacheAndCheckStats() {
    try {
        console.log('🔄 Clearing cache and checking stats...');
        
        // Clear cache
        CacheService.clearAndPrimeGlobalCache();
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check raw user data
        const companies = await User.find({ role: 'company' }).select('isActive totalCategoriesCount totalItemsCount totalServicesCount');
        console.log('📊 Raw company data:');
        companies.forEach(company => {
            console.log(`  Company ${company._id}: active=${company.isActive}, categories=${company.totalCategoriesCount || 0}, items=${company.totalItemsCount || 0}, services=${company.totalServicesCount || 0}`);
        });
        
        // Get fresh stats
        const stats = await CacheService.getGlobalSystemStats();
        console.log('📈 Fresh stats:', JSON.stringify(stats, null, 2));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

clearCacheAndCheckStats();