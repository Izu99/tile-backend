/**
 * 🔥 FIX SITE VISIT SPARSE INDEX
 * 
 * Drops the existing non-sparse unique index on { id: 1, companyId: 1 }
 * and lets Mongoose recreate it with sparse: true so counter documents
 * (which have no 'id' field) don't conflict with the unique constraint.
 * 
 * Run with: node server/migrations/fix_sitevisit_sparse_index.js
 */

const mongoose = require('mongoose');
const colors = require('colors');
require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tile-management';

(async () => {
  try {
    console.log('🔗 Connecting to MongoDB...'.cyan);
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB'.green);

    const db = mongoose.connection.db;
    const collection = db.collection('sitevisits');

    console.log('\n📋 Current indexes on sitevisits collection:'.yellow);
    const indexCursor = await collection.listIndexes();
    const indexes = await indexCursor.toArray();
    console.log(JSON.stringify(indexes, null, 2));

    // Drop the non-sparse unique index if it exists
    const targetIndex = 'id_1_companyId_1';
    const existingIndex = indexes.find(idx => idx.name === targetIndex);
    if (existingIndex) {
      console.log(`\n🔄 Dropping non-sparse index: ${targetIndex}`.yellow);
      await collection.dropIndex(targetIndex);
      console.log(`✅ Dropped index: ${targetIndex}`.green);
    } else {
      console.log(`\n⚠️  Index ${targetIndex} not found. Checking for similar indexes...`.yellow);
      const indexNames = indexes.map(idx => idx.name);
      console.log(`Available indexes: ${indexNames.join(', ')}`);
    }

    // Now recreate by loading the Mongoose model
    console.log('\n🔄 Reloading SiteVisit model to recreate indexes with sparse: true...'.cyan);
    const SiteVisit = require('../models/SiteVisit');
    
    // Ensure indexes - this will create the sparse index
    await SiteVisit.syncIndexes();
    console.log('✅ Indexes synchronized - sparse index created!'.green);

    // Verify the new index
    console.log('\n📋 Updated indexes on sitevisits collection:'.yellow);
    const newIndexCursor = await collection.listIndexes();
    const newIndexes = await newIndexCursor.toArray();
    console.log(JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ Migration complete! Site visit ID generation should now work without null key conflicts.'.green);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:'.red, error);
    process.exit(1);
  }
})();
