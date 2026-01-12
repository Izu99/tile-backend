require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Category = require('./models/Category');

const cleanupOrphanedCategories = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/business_management');
        console.log('Connected to database');

        // Find all categories
        const allCategories = await Category.find({});
        console.log(`Found ${allCategories.length} total categories`);

        let orphanedCount = 0;
        let validCount = 0;

        for (const category of allCategories) {
            // Check if the company still exists
            const companyExists = await User.findById(category.companyId);

            if (!companyExists) {
                console.log(`Orphaned category: "${category.name}" (ID: ${category._id}) - Company ${category.companyId} not found`);
                await Category.findByIdAndDelete(category._id);
                orphanedCount++;
            } else {
                console.log(`Valid category: "${category.name}" - Company: ${companyExists.companyName}`);
                validCount++;
            }
        }

        console.log(`\nCleanup Summary:`);
        console.log(`- Valid categories: ${validCount}`);
        console.log(`- Orphaned categories deleted: ${orphanedCount}`);
        console.log(`- Total remaining: ${validCount}`);

        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
};

cleanupOrphanedCategories();
