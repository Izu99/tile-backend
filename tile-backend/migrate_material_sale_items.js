require('dotenv').config();
const mongoose = require('mongoose');
const MaterialSale = require('./models/MaterialSale');
const Category = require('./models/Category');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/business_management');
        console.log('MongoDB Connected for migration');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

const migrateMaterialSaleItems = async () => {
    try {
        console.log('Starting migration of material sale items...');

        // Get all material sales
        const materialSales = await MaterialSale.find({});
        console.log(`Found ${materialSales.length} material sales to migrate`);

        // Get all categories with their items
        const categories = await Category.find({});
        console.log(`Found ${categories.length} categories`);

        // Create a map for quick lookup
        const categoryMap = new Map();
        const itemMap = new Map();

        categories.forEach(category => {
            categoryMap.set(category.name, category);

            category.items.forEach(item => {
                const key = `${category.name}:${item.itemName}`;
                itemMap.set(key, {
                    categoryId: category._id.toString(),
                    categoryName: category.name,
                    itemId: item._id.toString(),
                    item: item
                });
            });
        });

        let updatedCount = 0;

        for (const sale of materialSales) {
            let saleUpdated = false;

            for (const item of sale.items) {
                // If the item doesn't have categoryId but has category and productName
                if (!item.categoryId && item.category && item.productName) {
                    const key = `${item.category}:${item.productName}`;
                    const itemInfo = itemMap.get(key);

                    if (itemInfo) {
                        item.categoryId = itemInfo.categoryId;
                        item.categoryName = itemInfo.categoryName;
                        item.itemId = itemInfo.itemId;
                        saleUpdated = true;
                        console.log(`Updated item: ${item.productName} in sale ${sale.invoiceNumber}`);
                    } else {
                        console.log(`Could not find matching item for: ${key} in sale ${sale.invoiceNumber}`);
                    }
                }
            }

            if (saleUpdated) {
                await sale.save();
                updatedCount++;
            }
        }

        console.log(`Migration completed. Updated ${updatedCount} material sales.`);

    } catch (error) {
        console.error('Migration error:', error);
    }
};

const runMigration = async () => {
    await connectDB();
    await migrateMaterialSaleItems();
    console.log('Migration completed');
    process.exit(0);
};

runMigration();
