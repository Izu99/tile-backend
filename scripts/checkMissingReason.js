require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const JobCost = require('../models/JobCost');
    const QuotationDocument = require('../models/QuotationDocument');
    
    // Check the 7 that were missing
    const missingIds = ['INV-008', 'INV-019', 'INV-170', 'INV-286', 'INV-294', 'INV-320', 'INV-321'];
    
    for (const id of missingIds) {
        const docNum = id.replace('INV-', '');
        const inv = await QuotationDocument.findOne({ documentNumber: docNum, type: 'invoice' }).lean();
        
        if (inv) {
            console.log(`\n${id}:`);
            console.log(`  status: ${inv.status}`);
            console.log(`  createdAt: ${inv.createdAt}`);
            console.log(`  customerName: ${inv.customerName}`);
            
            // Check if there's a quotation that was converted
            const quo = await QuotationDocument.findOne({ documentNumber: docNum, type: 'quotation' }).lean();
            if (quo) {
                console.log(`  Original quotation status: ${quo.status}`);
                // Check if job cost exists for quotation
                const jcForQuo = await JobCost.findOne({ quotationId: `QUO-${docNum}` }).lean();
                console.log(`  Job cost for QUO-${docNum}: ${jcForQuo ? 'EXISTS' : 'MISSING'}`);
            }
        }
    }
    
    // Check why post-save hook didn't create them
    // Look at when these invoices were created vs when job cost system was implemented
    console.log('\n--- Checking invoice creation dates ---');
    const invoices = await QuotationDocument.find({
        type: 'invoice',
        documentNumber: { $in: ['008', '019', '170', '286', '294', '320', '321'] }
    }).select('documentNumber createdAt status customerName').lean();
    
    invoices.forEach(inv => {
        console.log(`INV-${inv.documentNumber}: created ${inv.createdAt?.toISOString()?.split('T')[0]} | ${inv.status}`);
    });
    
    await mongoose.disconnect();
}
check().catch(console.error);
