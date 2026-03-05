// Rename existing BULK PO IDs to BPO format
const mongoose = require('mongoose');
require('dotenv').config();

const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');

async function renameBulkPOIds() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all bulk POs (with sourceType = 'material_sale')
    const bulkPOs = await PurchaseOrder.find({
      sourceType: 'material_sale'
    }).sort({ createdAt: 1 }); // Sort by creation date

    console.log(`\n📊 Found ${bulkPOs.length} Bulk POs to rename:\n`);

    if (bulkPOs.length === 0) {
      console.log('✅ No Bulk POs to rename!');
      return;
    }

    // Rename each PO with sequential BPO IDs
    let counter = 1;
    for (const po of bulkPOs) {
      const oldId = po.poId;
      const newId = `BPO-${String(counter).padStart(3, '0')}`;
      
      console.log(`Renaming: ${oldId} → ${newId}`);
      
      // Update using updateOne to avoid hooks
      await PurchaseOrder.updateOne(
        { _id: po._id },
        { $set: { poId: newId } }
      );
      
      counter++;
    }

    console.log(`\n✅ Renamed ${bulkPOs.length} Bulk POs to BPO format`);
    console.log(`   Next BPO ID will be: BPO-${String(counter).padStart(3, '0')}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

renameBulkPOIds();
