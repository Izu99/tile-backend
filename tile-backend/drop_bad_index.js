const mongoose = require('mongoose');

async function dropBadIndex() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/business_management');
        console.log('🔌 Connected to MongoDB');

        // Drop the index
        await mongoose.connection.db.collection('jobcosts').dropIndex('invoiceId_1');
        console.log('✅ Index dropped successfully!');

    } catch (err) {
        console.log('❌ Error or Index already deleted:', err.message);
    } finally {
        // Close connection
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the function
dropBadIndex();
