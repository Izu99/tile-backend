const mongoose = require('mongoose');
require('dotenv').config();

async function fixJobCostStatuses() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const JobCost = require('../models/JobCost');
    const QuotationDocument = require('../models/QuotationDocument');
    
    // Get all job costs with pending status that have a quotationId
    const jobCosts = await JobCost.find({ 
        customerInvoiceStatus: 'pending',
        quotationId: { $exists: true, $ne: null }
    });
    
    console.log(`Found ${jobCosts.length} job costs with pending status`);
    
    let updated = 0;
    for (const jc of jobCosts) {
        // Find matching quotation by documentNumber
        const docNumber = jc.quotationId.replace('QUO-', '');
        const quotation = await QuotationDocument.findOne({ 
            documentNumber: docNumber,
            user: jc.user
        });
        
        if (quotation && quotation.status !== 'pending') {
            await JobCost.updateOne(
                { _id: jc._id },
                { $set: { customerInvoiceStatus: quotation.status } }
            );
            console.log(`Updated ${jc.quotationId}: pending -> ${quotation.status}`);
            updated++;
        } else if (quotation) {
            console.log(`Skipped ${jc.quotationId}: quotation status is ${quotation.status}`);
        } else {
            console.log(`No quotation found for ${jc.quotationId}`);
        }
    }
    
    console.log(`\nDone! Updated ${updated} job costs`);
    await mongoose.disconnect();
}

fixJobCostStatuses().catch(console.error);
