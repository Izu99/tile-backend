const mongoose = require('mongoose');
const colors = require('colors');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tile-management';

async function resetBulkPOIds() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB'.green);

        const PurchaseOrder = require('../models/PurchaseOrder');

        // Find all bulk POs (sourceType = 'material_sale')
        const bulkPOs = await PurchaseOrder.find({ 
            sourceType: 'material_sale' 
        }).sort({ createdAt: 1 }); // Sort by creation date, oldest first

        console.log(`\n📊 Found ${bulkPOs.length} Bulk POs to renumber`.cyan);

        if (bulkPOs.length === 0) {
            console.log('ℹ️  No bulk POs found'.gray);
            return;
        }

        // Show current IDs
        console.log('\n📋 Current Bulk PO IDs:'.yellow);
        bulkPOs.forEach((po, index) => {
            console.log(`   ${index + 1}. ${po.poId} (Created: ${po.createdAt.toLocaleString()})`);
        });

        // Renumber them sequentially
        console.log('\n🔄 Renumbering Bulk POs...'.cyan);
        
        for (let i = 0; i < bulkPOs.length; i++) {
            const po = bulkPOs[i];
            const newId = `BPO-${String(i + 1).padStart(3, '0')}`;
            const oldId = po.poId;
            
            // Update the PO ID
            po.poId = newId;
            await po.save();
            
            console.log(`   ✅ ${oldId} → ${newId}`.green);
        }

        console.log('\n✅ All Bulk POs renumbered successfully!'.green);
        console.log(`📊 Bulk PO sequence now: BPO-001 to BPO-${String(bulkPOs.length).padStart(3, '0')}`.cyan);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB'.green);
    }
}

resetBulkPOIds();
