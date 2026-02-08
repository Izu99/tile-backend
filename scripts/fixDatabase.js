const mongoose = require('mongoose');
require('dotenv').config();

const fix = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const collection = mongoose.connection.db.collection('quotationdocuments');

        // පියවර 1: මුලින්ම පරණ වැරදි Indexes ඔක්කොම මකා දමන්න
        // එතකොට තමයි ඊළඟ පියවරේදී Duplicate අංක සේව් කරන්න ඉඩ දෙන්නේ
        console.log('🗑️  Step 1: Dropping all old indexes...');
        const indexes = await collection.indexes();
        for (const idx of indexes) {
            if (idx.name !== '_id_') {
                await collection.dropIndex(idx.name);
                console.log(`   Dropped Index: ${idx.name}`);
            }
        }

        // පියවර 2: දැන් Prefix අයින් කරන්න (දැන් Index එක නැති නිසා Error එක එන්නේ නැහැ)
        console.log('\n📄 Step 2: Removing prefixes from documentNumber...');
        const docs = await collection.find({}).toArray();

        for (const doc of docs) {
            if (doc.documentNumber && typeof doc.documentNumber === 'string' && doc.documentNumber.includes('-')) {
                const numberOnly = doc.documentNumber.split('-').pop();
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { documentNumber: numberOnly } }
                );
                console.log(`   Updated: ${doc.documentNumber} → ${numberOnly}`);
            }
        }

        // පියවර 3: දැන් අලුත් නිවැරදි Compound Index එක හදන්න
        console.log('\n📌 Step 3: Creating new multi-company unique index...');
        await collection.createIndex(
            { documentNumber: 1, type: 1, user: 1 },
            { unique: true, name: 'docNum_type_user_unique' }
        );
        console.log('   ✅ Created: docNum_type_user_unique');

        // 4. Verification
        console.log('\n📋 Final Verification of indexes:');
        const finalIndexes = await collection.indexes();
        finalIndexes.forEach(idx => console.log(`   - ${idx.name}`));

        console.log('\n🚀 DATABASE FIX COMPLETED SUCCESSFULLY!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
        process.exit(1);
    }
};

fix();
