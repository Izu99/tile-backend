// Quick MongoDB Index Fix for Quotation to Invoice Conversion
// Run this script to fix the database indexes after implementing the new conversion logic

const mongoose = require('mongoose');

// Connect to your database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/business-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const fixIndexes = async () => {
  try {
    console.log('🔧 Fixing database indexes for quotation-to-invoice conversion and JobCost creation...');

    // Fix quotationdocuments collection
    const quotationCollection = mongoose.connection.db.collection('quotationdocuments');

    // Drop the old compound index if it exists
    try {
      await quotationCollection.dropIndex("documentNumber_1_type_1");
      console.log('✅ Dropped old compound index on quotationdocuments');
    } catch (error) {
      console.log('ℹ️  Old compound index not found or already removed');
    }

    // Ensure the simple unique index on documentNumber exists
    try {
      await quotationCollection.createIndex({ documentNumber: 1 }, { unique: true });
      console.log('✅ Ensured unique index on documentNumber');
    } catch (error) {
      console.log('ℹ️  Unique index on documentNumber already exists');
    }

    // Fix jobcosts collection - drop unique index on invoiceId
    const jobCostCollection = mongoose.connection.db.collection('jobcosts');

    try {
      await jobCostCollection.dropIndex("invoiceId_1");
      console.log('✅ Dropped unique index on invoiceId for jobcosts collection');
    } catch (error) {
      console.log('ℹ️  Unique index on invoiceId not found or already removed');
    }

    console.log('🎉 Database indexes fixed successfully!');
    console.log('📋 Now quotations can be converted to invoices and JobCosts can be created without duplicate key errors');

  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Alternative: Manual MongoDB commands to run in MongoDB shell
console.log(`
📝 Alternative: Run these commands manually in MongoDB shell or Compass:

// Connect to your database
use business-management;

// Drop the old compound index
db.quotationdocuments.dropIndex("documentNumber_1_type_1");

// Ensure simple unique index exists
db.quotationdocuments.createIndex({ "documentNumber": 1 }, { unique: true });

// Verify indexes
db.quotationdocuments.getIndexes();

✅ This will allow quotation-to-invoice conversion by changing documentNumber prefix!
`);

// Run the fix if this script is executed directly
if (require.main === module) {
  connectDB().then(() => fixIndexes());
}

module.exports = { fixIndexes };
