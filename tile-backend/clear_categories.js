require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

const clearCategories = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/business_management');
        console.log('Connected to database');

        const result = await Category.deleteMany({});
        console.log(`Cleared ${result.deletedCount} categories from database`);

        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error clearing categories:', error);
        process.exit(1);
    }
};

clearCategories();
