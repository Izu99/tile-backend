const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function testInvoiceFlow() {
    try {
        console.log('🧪 Testing invoice upload and delivery confirmation flow...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tilework');
        console.log('✅ Connected to MongoDB');

        const PurchaseOrder = require('../models/PurchaseOrder');

        // Find a purchase order with invoice image
        const poWithInvoice = await PurchaseOrder.findOne({
            invoiceImagePath: { $exists: true, $ne: null, $ne: '' }
        }).sort({ updatedAt: -1 });

        if (!poWithInvoice) {
            console.log('❌ No purchase order with invoice image found');
            return;
        }

        console.log(`\n📄 Testing PO: ${poWithInvoice.poId} (ID: ${poWithInvoice._id})`);
        console.log(`   Current Status: ${poWithInvoice.status}`);
        console.log(`   Current Invoice Path: ${poWithInvoice.invoiceImagePath}`);

        // Check if file exists
        const { BASE_STORAGE_PATH } = require('../middleware/upload');
        const currentFilePath = path.join(BASE_STORAGE_PATH, poWithInvoice.invoiceImagePath);
        const fileExists = fs.existsSync(currentFilePath);
        
        console.log(`   File exists: ${fileExists}`);
        if (fileExists) {
            const stats = fs.statSync(currentFilePath);
            console.log(`   File size: ${stats.size} bytes`);
        }

        // Check what the PO-based filename would be
        const fileExtension = path.extname(poWithInvoice.invoiceImagePath).toLowerCase();
        const poBasedFilename = `${poWithInvoice.poId}${fileExtension}`;
        const companyId = poWithInvoice.user;
        const newRelativeFilePath = `${companyId}/invoices/${poBasedFilename}`;
        const newFilePath = path.join(BASE_STORAGE_PATH, newRelativeFilePath);

        console.log(`\n🎯 Expected after delivery confirmation:`);
        console.log(`   New filename: ${poBasedFilename}`);
        console.log(`   New relative path: ${newRelativeFilePath}`);
        console.log(`   New full path: ${newFilePath}`);
        console.log(`   New file exists: ${fs.existsSync(newFilePath)}`);

        // Check URL construction
        const baseUrl = 'http://127.0.0.1:5000';
        const currentUrl = `${baseUrl}/tile_uploads/${poWithInvoice.invoiceImagePath}`;
        const newUrl = `${baseUrl}/tile_uploads/${newRelativeFilePath}`;

        console.log(`\n🌐 URL comparison:`);
        console.log(`   Current URL: ${currentUrl}`);
        console.log(`   Expected URL after delivery: ${newUrl}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

// Run the test
testInvoiceFlow();