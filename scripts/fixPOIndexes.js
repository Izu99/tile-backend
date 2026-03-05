const mongoose = require('mongoose');
const colors = require('colors');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tile-management';

async function fixPOIndexes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB'.green);

        const db = mongoose.connection.db;
        const collection = db.collection('purchaseorders');

        // Get current indexes
        console.log('\n📊 Current indexes:'.cyan);
        const indexes = await collection.indexes();
        indexes.forEach(index => {
            console.log(`   - ${JSON.stringify(index.key)}: ${index.name}${index.unique ? ' (UNIQUE)' : ''}`);
        });

        // Check if old poId_1 unique index exists
        const oldIndexExists = indexes.some(idx => idx.name === 'poId_1' && idx.unique);
        
        if (oldIndexExists) {
            console.log('\n⚠️  Found old unique index on poId alone'.yellow);
            console.log('🗑️  Dropping old poId_1 index...'.yellow);
            
            try {
                await collection.dropIndex('poId_1');
                console.log('✅ Dropped old poId_1 index'.green);
            } catch (dropError) {
                if (dropError.message.includes('index not found')) {
                    console.log('ℹ️  Index already dropped'.gray);
                } else {
                    throw dropError;
                }
            }
        } else {
            console.log('\n✅ Old poId_1 unique index does not exist'.green);
        }

        // Verify compound index exists
        const compoundIndexExists = indexes.some(idx => 
            idx.key.poId === 1 && idx.key.user === 1 && idx.unique
        );

        if (!compoundIndexExists) {
            console.log('\n⚠️  Compound index { poId: 1, user: 1 } not found'.yellow);
            console.log('🔧 Creating compound unique index...'.cyan);
            
            await collection.createIndex(
                { poId: 1, user: 1 },
                { unique: true, name: 'poId_1_user_1' }
            );
            console.log('✅ Created compound unique index'.green);
        } else {
            console.log('\n✅ Compound index { poId: 1, user: 1 } exists'.green);
        }

        // Show final indexes
        console.log('\n📊 Final indexes:'.cyan);
        const finalIndexes = await collection.indexes();
        finalIndexes.forEach(index => {
            console.log(`   - ${JSON.stringify(index.key)}: ${index.name}${index.unique ? ' (UNIQUE)' : ''}`);
        });

        console.log('\n✅ Index fix complete!'.green);
        console.log('💡 You can now create POs with the same poId for different users'.cyan);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB'.green);
    }
}

fixPOIndexes();
