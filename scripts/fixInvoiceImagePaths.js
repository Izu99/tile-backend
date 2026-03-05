const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

async function fixInvoiceImagePaths() {
    try {
        console.log('🔄 Starting invoice image path migration...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tilework');
        console.log('✅ Connected to MongoDB');

        const PurchaseOrder = require('../models/PurchaseOrder');

        // Find all purchase orders with wrong invoice image path formats
        const purchaseOrders = await PurchaseOrder.find({
            $or: [
                { invoiceImagePath: { $regex: '^tile_uploads/invoices/' } },
                { invoiceImagePath: { $regex: '^uploads/invoices/' } },
                { invoiceImagePath: { $regex: '^invoices/' } }
            ]
        });

        console.log(`📋 Found ${purchaseOrders.length} purchase orders with incorrect invoice image paths`);

        let updatedCount = 0;

        for (const po of purchaseOrders) {
            const oldPath = po.invoiceImagePath;
            
            // Extract filename from old path
            const filename = path.basename(oldPath);
            
            // Get company ID from the purchase order's user field
            const companyId = po.user;
            
            // Create new path format: companyId/invoices/filename
            const newPath = `${companyId}/invoices/${filename}`;
            
            console.log(`🔄 Updating PO ${po.poId}:`);
            console.log(`   Old path: ${oldPath}`);
            console.log(`   New path: ${newPath}`);
            
            // Update the purchase order
            await PurchaseOrder.updateOne(
                { _id: po._id },
                { 
                    $set: { 
                        invoiceImagePath: newPath,
                        updatedAt: new Date()
                    }
                }
            );
            
            updatedCount++;
        }

        console.log(`✅ Migration completed! Updated ${updatedCount} purchase orders`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

// Run the migration
fixInvoiceImagePaths();