const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tilework', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const PurchaseOrder = require('../models/PurchaseOrder');

async function checkInvoicePaths() {
    try {
        console.log('🔍 Checking invoice image paths in database...');

        // Find all purchase orders with invoice image paths
        const purchaseOrders = await PurchaseOrder.find({
            invoiceImagePath: { $exists: true, $ne: null, $ne: '' }
        }).sort({ updatedAt: -1 }).limit(10);

        console.log(`📋 Found ${purchaseOrders.length} purchase orders with invoice images (latest 10):`);

        for (const po of purchaseOrders) {
            console.log(`\n📄 PO: ${po.poId} (ID: ${po._id})`);
            console.log(`   User/Company: ${po.user}`);
            console.log(`   Invoice Path: ${po.invoiceImagePath}`);
            console.log(`   Updated: ${po.updatedAt}`);
            console.log(`   Status: ${po.status}`);
        }

        // Also check for any with old format
        const oldFormatPOs = await PurchaseOrder.find({
            invoiceImagePath: { $regex: '^invoices/' }
        });

        console.log(`\n🔍 Purchase orders with old format paths: ${oldFormatPOs.length}`);
        
        for (const po of oldFormatPOs) {
            console.log(`   PO: ${po.poId} - Path: ${po.invoiceImagePath}`);
        }
        
    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the check
checkInvoicePaths();