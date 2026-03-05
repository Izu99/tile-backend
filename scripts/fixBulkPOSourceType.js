// Fix Bulk PO sourceType values
const mongoose = require('mongoose');
require('dotenv').config();

const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier'); // Import Supplier model

async function fixBulkPOs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all bulk POs without proper sourceType
    const bulkPOs = await PurchaseOrder.find({
      quotationId: 'BULK',
      $or: [
        { sourceType: { $exists: false } },
        { sourceType: { $ne: 'material_sale' } }
      ]
    });

    console.log(`\n📊 Found ${bulkPOs.length} Bulk POs to update:\n`);

    if (bulkPOs.length === 0) {
      console.log('✅ All Bulk POs already have correct sourceType!');
      return;
    }

    // Update using updateMany to avoid post-save hooks
    const result = await PurchaseOrder.updateMany(
      {
        quotationId: 'BULK',
        $or: [
          { sourceType: { $exists: false } },
          { sourceType: { $ne: 'material_sale' } }
        ]
      },
      {
        $set: { sourceType: 'material_sale' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} Bulk POs with sourceType='material_sale'`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixBulkPOs();
