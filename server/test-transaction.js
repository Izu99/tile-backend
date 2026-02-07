const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            readPreference: 'primary', // Required for transactions
            readConcern: { level: 'majority' }
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

const testTransaction = async () => {
    await connectDB();
    
    const User = require('./models/User');
    const QuotationDocument = require('./models/QuotationDocument');
    
    try {
        console.log('🔍 Testing transaction functionality...');
        
        // First, let's create a test quotation
        const testUser = await User.findOne({ email: 'test@example.com' });
        if (!testUser) {
            console.log('❌ Test user not found. Please run create-test-user.js first');
            return;
        }
        
        console.log(`✅ Found test user: ${testUser.name}`);
        
        // Create a test quotation
        const testQuotation = await QuotationDocument.create({
            user: testUser._id,
            documentNumber: `TEST-${Date.now()}`, // Add required document number
            type: 'quotation',
            status: 'approved', // Must be approved to convert
            customerName: 'Test Customer',
            customerPhone: '123-456-7890',
            customerAddress: 'Test Address',
            projectTitle: 'Test Project',
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            paymentTerms: 30,
            lineItems: [{
                item: {
                    name: 'Test Item',
                    sellingPrice: 100
                },
                quantity: 2,
                description: 'Test item description'
            }],
            serviceItems: [],
            paymentHistory: []
        });
        
        console.log(`✅ Created test quotation: ${testQuotation.displayDocumentNumber}`);
        
        // Now test the transaction - convert quotation to invoice
        console.log('🔄 Testing convertToInvoice transaction...');
        
        const convertedInvoice = await QuotationDocument.convertToInvoice(
            testQuotation._id,
            testUser._id,
            {
                customDueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) // 45 days from now
            }
        );
        
        console.log(`✅ Transaction successful! Converted to invoice: ${convertedInvoice.displayDocumentNumber}`);
        console.log(`   Type: ${convertedInvoice.type}`);
        console.log(`   Status: ${convertedInvoice.status}`);
        console.log(`   Due Date: ${convertedInvoice.dueDate}`);
        
        // Clean up - delete the test document
        await QuotationDocument.findByIdAndDelete(convertedInvoice._id);
        console.log('🧹 Cleaned up test document');
        
        console.log('\n🎉 Transaction test completed successfully!');
        console.log('✅ MongoDB transactions are working correctly with primary read preference');
        
    } catch (error) {
        console.error('❌ Transaction test failed:', error);
        
        if (error.message.includes('Read preference in a transaction must be primary')) {
            console.error('🚨 TRANSACTION ERROR: Read preference issue still exists');
            console.error('💡 Check MongoDB connection configuration');
        } else if (error.message.includes('Transaction')) {
            console.error('🚨 TRANSACTION ERROR: General transaction failure');
        } else {
            console.error('🚨 OTHER ERROR:', error.message);
        }
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
};

testTransaction();