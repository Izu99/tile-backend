// Check Bulk PO sourceType values
const mongoose = require('mongoose');
require('dotenv').config();

const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier'); // Import Supplier model

async function checkBulkPOs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all bulk POs (quotationId = 'BULK')
    const bulkPOs = await PurchaseOrder.find({ quotationId: 'BULK' }).lean(); // Use lean() to avoid hooks

    console.log(`\n📊 Found ${bulkPOs.length} Bulk POs:\n`);

    bulkPOs.forEach((po, index) => {
      console.log(`${index + 1}. PO ID: ${po.poId}`);
      console.log(`   Customer: ${po.customerName}`);
      console.log(`   Supplier: ${po.supplier?.name || 'N/A'}`);
      console.log(`   Source Type: ${po.sourceType || 'NOT SET'}`);
      console.log(`   Status: ${po.status}`);
      console.log(`   Created: ${po.createdAt}`);
      console.log('');
    });

    // Count by sourceType
    const withSourceType = bulkPOs.filter(po => po.sourceType === 'material_sale').length;
    const withoutSourceType = bulkPOs.filter(po => !po.sourceType || po.sourceType !== 'material_sale').length;

    console.log(`\n📈 Summary:`);
    console.log(`   With sourceType='material_sale': ${withSourceType}`);
    console.log(`   Without proper sourceType: ${withoutSourceType}`);

    if (withoutSourceType > 0) {
      console.log(`\n⚠️  ${withoutSourceType} Bulk POs need sourceType update!`);
      console.log(`   Run: node scripts/fixBulkPOSourceType.js`);
    } else {
      console.log(`\n✅ All Bulk POs have correct sourceType!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkBulkPOs();
