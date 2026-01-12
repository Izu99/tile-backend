// Quick script to drop the problematic invoiceId index from jobcosts collection
// Run this with: node drop_invoice_index.js

const mongoose = require('mongoose');

async function dropIndex() {
  try {
    console.log('🔧 Connecting to MongoDB...');

    // Connect to your database - update the connection string if needed
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/business-management');

    console.log('✅ Connected to MongoDB');

    // Get the jobcosts collection
    const collection = mongoose.connection.db.collection('jobcosts');

    // Drop the unique index on invoiceId
    try {
      await collection.dropIndex("invoiceId_1");
      console.log('✅ Successfully dropped unique index on invoiceId');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️ Index invoiceId_1 not found or already removed');
      } else {
        throw error;
      }
    }

    console.log('🎉 Index fix completed! JobCost creation should now work.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Alternative: Manual MongoDB commands
console.log(`
📝 MANUAL ALTERNATIVE: If the script doesn't work, run this in MongoDB shell:

// Connect to your database
use business-management;

// Drop the unique index on invoiceId
db.jobcosts.dropIndex("invoiceId_1");

// Verify the index is gone
db.jobcosts.getIndexes();

✅ After dropping the index, try approving quotation 024 again.
`);

if (require.main === module) {
  dropIndex();
}

module.exports = { dropIndex };
